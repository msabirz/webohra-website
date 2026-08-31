export interface OtpProvider {
  /** Deliver `code` to `phone`. Throws on delivery failure. */
  send(phone: string, code: string): Promise<void>;
  /** True for providers where the caller (API route) may echo the code back
   *  for local testing — never true for a real delivery provider. */
  readonly isDev: boolean;
}

/**
 * Logs the OTP to the server console instead of sending it anywhere.
 * This is the default until real MSG91 credentials exist — see
 * lib/otp/index.ts for how to swap it.
 */
class DevOtpProvider implements OtpProvider {
  readonly isDev = true;

  async send(phone: string, code: string): Promise<void> {
    console.log(`[dev-otp] ${phone} → ${code} (would be sent via MSG91 in production)`);
  }
}

export const devOtpProvider = new DevOtpProvider();
