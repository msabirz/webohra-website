/**
 * RazorpayX — Fulfillment & Subscriptions redesign, Phase 5c. Contacts and
 * Fund Accounts (confirmed working directly against the real API, same
 * key_id/key_secret as the payment gateway) are still used for the
 * 'bank_account' payout method, specifically so a seller's raw account
 * number/IFSC never has to be stored in our own database — see
 * payoutMethodEnum's own comment in db/schema.ts for the full 2026-09-03
 * redesign. `createPayout` (the actual money-moving call) is kept here but
 * no longer used by default — RazorpayX Payouts turned out to need a real
 * current account this business isn't set up for, so Admin pays sellers
 * directly through her own banking/UPI app instead (see lib/payouts.ts's
 * markPayoutPaidManually and lib/upi-qr.ts). The code stays intact in case
 * that changes later; nothing currently calls it from the UI.
 */

const RAZORPAY_API_BASE = 'https://api.razorpay.com/v1';

function authHeader(): string {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) {
    throw new Error('RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET are not set');
  }
  return 'Basic ' + Buffer.from(`${keyId}:${keySecret}`).toString('base64');
}

async function razorpayRequest<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const res = await fetch(`${RAZORPAY_API_BASE}${path}`, {
    method: 'POST',
    headers: { Authorization: authHeader(), 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) {
    const message = data?.error?.description || `Razorpay request to ${path} failed (${res.status})`;
    throw new Error(message);
  }
  return data as T;
}

/** A RazorpayX "contact" — the payee identity a fund account (her bank
 *  account or UPI VPA) attaches to. One per seller, created once, reused
 *  for every future fund account change. */
export async function createRazorpayContact(params: {
  name: string;
  email?: string;
  phone: string;
}): Promise<{ id: string }> {
  return razorpayRequest('/contacts', {
    name: params.name,
    email: params.email,
    contact: params.phone,
    type: 'vendor',
  });
}

export type BankFundAccountResult = { id: string; bankName: string | null; lastFour: string };

/** Attaches a bank account to an existing contact. Confirmed working
 *  directly against the real API — this genuinely succeeds today, unlike
 *  the actual payout call below. */
export async function createBankFundAccount(params: {
  contactId: string;
  accountHolderName: string;
  ifsc: string;
  accountNumber: string;
}): Promise<BankFundAccountResult> {
  const result = await razorpayRequest<{
    id: string;
    bank_account: { bank_name?: string; account_number: string };
  }>('/fund_accounts', {
    contact_id: params.contactId,
    account_type: 'bank_account',
    bank_account: {
      name: params.accountHolderName,
      ifsc: params.ifsc,
      account_number: params.accountNumber,
    },
  });
  return {
    id: result.id,
    bankName: result.bank_account.bank_name ?? null,
    lastFour: result.bank_account.account_number.slice(-4),
  };
}

export type UpiFundAccountResult = { id: string; vpa: string };

/** Attaches a UPI VPA to an existing contact. */
export async function createUpiFundAccount(params: {
  contactId: string;
  vpa: string;
}): Promise<UpiFundAccountResult> {
  const result = await razorpayRequest<{ id: string; vpa: { address: string } }>('/fund_accounts', {
    contact_id: params.contactId,
    account_type: 'vpa',
    vpa: { address: params.vpa },
  });
  return { id: result.id, vpa: result.vpa.address };
}

export type BankFundAccountFullDetails = {
  accountHolderName: string;
  accountNumber: string;
  ifsc: string;
  bankName: string | null;
};

/**
 * Fetches the REAL, unmasked bank account details back from Razorpay —
 * confirmed directly that this returns the full account number and IFSC,
 * not a masked version. This is the payoff of never storing them
 * ourselves: Admin sees them only at the moment she actually needs to pay
 * someone, fetched fresh, never persisted here.
 */
export async function getBankFundAccountDetails(fundAccountId: string): Promise<BankFundAccountFullDetails> {
  const res = await fetch(`${RAZORPAY_API_BASE}/fund_accounts/${fundAccountId}`, {
    headers: { Authorization: authHeader() },
  });
  const data = await res.json();
  if (!res.ok) {
    const message = data?.error?.description || `Could not fetch payout account details (${res.status})`;
    throw new Error(message);
  }
  return {
    accountHolderName: data.bank_account.name,
    accountNumber: data.bank_account.account_number,
    ifsc: data.bank_account.ifsc,
    bankName: data.bank_account.bank_name ?? null,
  };
}

/**
 * The actual money-moving call — the one piece of this module that isn't
 * live yet. Requires RAZORPAYX_ACCOUNT_NUMBER (the platform's real
 * RazorpayX current/virtual account number, only assigned once RazorpayX
 * is actually provisioned on this Razorpay account — confirmed via direct
 * API testing that contacts/fund_accounts already work, but a real payout
 * needs this account number, which the user hasn't supplied yet). Throws
 * a clear, specific error rather than attempting a call that's guaranteed
 * to fail some other, less legible way — callers (see lib/payouts.ts)
 * catch this and record it as the payout's failureReason, not an
 * unhandled 500.
 */
export async function createPayout(params: {
  fundAccountId: string;
  amountRupees: number;
  referenceId: string;
  narration: string;
}): Promise<{ id: string; status: string }> {
  const accountNumber = process.env.RAZORPAYX_ACCOUNT_NUMBER;
  if (!accountNumber) {
    throw new Error(
      "RazorpayX payouts aren't configured yet — RAZORPAYX_ACCOUNT_NUMBER is not set. " +
        'Every other piece of this is ready; this is the one missing setting.',
    );
  }

  return razorpayRequest('/payouts', {
    account_number: accountNumber,
    fund_account_id: params.fundAccountId,
    amount: Math.round(params.amountRupees * 100),
    currency: 'INR',
    mode: 'IMPS',
    purpose: 'payout',
    queue_if_low_balance: true,
    reference_id: params.referenceId,
    narration: params.narration,
  });
}

const IFSC_REGEX = /^[A-Z]{4}0[A-Z0-9]{6}$/;
const UPI_VPA_REGEX = /^[\w.-]{2,256}@[a-zA-Z]{2,64}$/;

export function isValidIfsc(ifsc: string): boolean {
  return IFSC_REGEX.test(ifsc);
}

export function isValidUpiVpa(vpa: string): boolean {
  return UPI_VPA_REGEX.test(vpa);
}
