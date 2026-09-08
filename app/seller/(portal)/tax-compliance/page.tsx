'use client';

import { FormEvent, useRef, useState } from 'react';
import {
  ShieldCheck,
  ShieldAlert,
  Clock,
  FileWarning,
  ExternalLink,
  PlayCircle,
  Landmark,
  Info,
  ImagePlus,
  CheckCircle2,
} from 'lucide-react';
import { authFetch } from '@/lib/session-client';
import { buttonStyles, inputStyles } from '@/lib/button-styles';
import { useSellerPortal } from '@/lib/seller-context';

type TaxIdType = 'gst' | 'udyam';

// Item 37 (2026-09-08) — same allow-list/size cap as every other seller
// photo uploader in this app.
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

/**
 * /seller/tax-compliance — item 33 (2026-09-08), the stakeholder's GST/KYC
 * requirement. Everything else in the seller portal stays fully usable
 * with none of this filled in (register, build draft listings, edit
 * settings) — the ONLY thing this blocks is publishing (going 'active'),
 * enforced server-side in PATCH /api/listings/[idOrSlug] and
 * /api/listings/bulk-status, mirroring the existing ITS-verification gate
 * exactly. This page is display + submission only; it never flips
 * taxIdVerified itself — only Admin can (POST .../tax-compliance PATCH by
 * an isAdmin staff member).
 *
 * Item 37 (2026-09-08) added a certificate photo alongside the number, as
 * optional supporting evidence. Item 38 (2026-09-09) made it compulsory —
 * both the number and a photo of it are required before she can submit
 * for review, and both plus a verified result are required before she can
 * publish (see lib/seller-readiness.ts).
 *
 * Walkthrough video: intentionally reserved as its own card below, not
 * built yet — the user's own stated plan is to add one later so a seller
 * can self-serve this whole page without needing support. Swap the
 * placeholder for a real embed when that's ready; nothing else on this
 * page depends on it existing.
 */
export default function SellerTaxCompliancePage() {
  const { me, refresh } = useSellerPortal();
  const p = me.sellerProfile;

  const [taxIdType, setTaxIdType] = useState<TaxIdType>(p.taxIdType ?? 'gst');
  const [taxIdNumber, setTaxIdNumber] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [justSubmitted, setJustSubmitted] = useState(false);

  // Item 37 (2026-09-08) — optional certificate photo.
  const [taxIdDocumentUrl, setTaxIdDocumentUrl] = useState<string | null>(p.taxIdDocumentUrl ?? null);
  const [docUploading, setDocUploading] = useState(false);
  const [docError, setDocError] = useState<string | null>(null);
  const docInputRef = useRef<HTMLInputElement>(null);

  const status: 'verified' | 'pending' | 'rejected' | 'none' = p.taxIdVerified
    ? 'verified'
    : p.taxIdRejectedReason
      ? 'rejected'
      : p.taxIdType
        ? 'pending'
        : 'none';

  async function handleDocChange(file: File | undefined) {
    if (!file) return;
    setDocError(null);
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      setDocError('Only JPEG, PNG, or WEBP images are allowed.');
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setDocError('Photo must be under 8MB.');
      return;
    }
    setDocUploading(true);
    try {
      const presignRes = await authFetch('/api/uploads/presign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contentType: file.type, purpose: 'tax_document' }),
      });
      const presignData = await presignRes.json();
      if (!presignRes.ok) {
        setDocError(presignData.error ?? 'Could not start the upload.');
        return;
      }
      const putRes = await fetch(presignData.uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type },
        body: file,
      });
      if (!putRes.ok) {
        setDocError('Upload to storage failed. Try again.');
        return;
      }
      setTaxIdDocumentUrl(presignData.publicUrl);
    } catch (err) {
      console.error('Tax document upload failed:', err);
      setDocError('Could not reach storage to upload this photo.');
    } finally {
      setDocUploading(false);
      if (docInputRef.current) docInputRef.current.value = '';
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!taxIdDocumentUrl) {
      setError('Upload a photo of the certificate before submitting.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await authFetch('/api/sellers/tax-compliance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taxIdType, taxIdNumber, taxIdDocumentUrl }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.issues?.taxIdNumber?.[0] ?? data.error ?? 'Could not submit this.');
        return;
      }
      setTaxIdNumber('');
      setJustSubmitted(true);
      setTimeout(() => setJustSubmitted(false), 4000);
      refresh();
    } finally {
      setSaving(false);
    }
  }

  const canSubmit = taxIdNumber.trim().length > 0 && !!taxIdDocumentUrl;

  return (
    <div className="flex max-w-5xl flex-col gap-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold text-ink">Tax & Business Verification</h1>
        <p className="mt-1 font-body text-sm text-ink-soft">
          A government tax-identity reference, required before your products or services can go live —
          the same step every major marketplace asks of its sellers.
        </p>
      </div>

      <StatusBanner status={status} type={p.taxIdType} number={p.taxIdNumber} reason={p.taxIdRejectedReason} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5 lg:items-start">
        {/* Submission form — the primary action, given the wider left column */}
        <form
          onSubmit={submit}
          className="flex flex-col gap-5 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-ink-soft/5 lg:col-span-3"
        >
          <h2 className="font-heading text-sm font-semibold text-ink">
            {status === 'none' ? 'Submit your number' : 'Submit a corrected number'}
          </h2>

          <div className="flex gap-2">
            {(['gst', 'udyam'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTaxIdType(t)}
                className={`flex-1 rounded-xl border px-4 py-2.5 font-body text-sm font-medium transition ${
                  taxIdType === t
                    ? 'border-navy bg-navy/5 text-navy'
                    : 'border-ink-soft/20 text-ink-soft hover:border-navy/30'
                }`}
              >
                {t === 'gst' ? 'GST number' : 'Udyam / MSME enrollment ID'}
              </button>
            ))}
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="font-body text-sm font-medium text-ink">
              {taxIdType === 'gst' ? 'GSTIN' : 'Udyam Registration Number'}
            </label>
            <input
              value={taxIdNumber}
              onChange={(e) => setTaxIdNumber(e.target.value.toUpperCase())}
              placeholder={taxIdType === 'gst' ? 'e.g. 27AAAAA0000A1Z5' : 'e.g. UDYAM-MH-01-1234567'}
              className={`${inputStyles} font-mono uppercase`}
            />
          </div>

          {/* Item 38 (2026-09-09) — the certificate photo is now required,
           *  not optional supporting evidence (see this file's top comment). */}
          <div className="flex flex-col gap-1.5 border-t border-ink-soft/10 pt-4">
            <label className="font-body text-sm font-medium text-ink">Certificate photo</label>
            <p className="font-body text-xs text-ink-soft">
              A clear photo of the actual GST or Udyam certificate — required before this can go to review.
            </p>
            <div className="flex items-center gap-3 pt-1">
              {taxIdDocumentUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={taxIdDocumentUrl}
                  alt="Tax certificate"
                  className="h-20 w-28 rounded-lg object-cover ring-1 ring-ink-soft/10"
                />
              ) : (
                <span className="flex h-20 w-28 items-center justify-center rounded-lg bg-ivory-deep">
                  <ImagePlus className="h-5 w-5 text-ink-soft" strokeWidth={1.75} />
                </span>
              )}
              <div className="flex flex-col gap-1.5">
                <input
                  ref={docInputRef}
                  type="file"
                  accept={ALLOWED_IMAGE_TYPES.join(',')}
                  className="hidden"
                  onChange={(e) => handleDocChange(e.target.files?.[0])}
                />
                <button
                  type="button"
                  onClick={() => docInputRef.current?.click()}
                  disabled={docUploading}
                  className={buttonStyles('secondary', 'sm', 'w-fit')}
                >
                  {docUploading ? 'Uploading…' : taxIdDocumentUrl ? 'Replace photo' : 'Upload photo'}
                </button>
                {docError && <p className="font-body text-xs text-red-600">{docError}</p>}
              </div>
            </div>
          </div>

          {error && <p className="font-body text-sm text-red-600">{error}</p>}
          {justSubmitted && (
            <p className="font-body text-sm text-teal-deep">Submitted — an admin will review it shortly.</p>
          )}

          <button type="submit" disabled={saving || !canSubmit} className={buttonStyles('primary', 'md', 'w-fit')}>
            {saving ? 'Submitting…' : 'Submit for verification'}
          </button>
        </form>

        {/* Help sidebar */}
        <div className="flex flex-col gap-6 lg:col-span-2">
          {/* Why we ask — the user's explicit instruction: state plainly
           *  this is for legality only, WE Bohra doesn't tax based on GST
           *  rules. */}
          <div className="flex flex-col gap-3 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-ink-soft/5">
            <h2 className="flex items-center gap-2 font-heading text-sm font-semibold text-ink">
              <Info className="h-4 w-4 text-ink-soft" strokeWidth={2} />
              Why we ask for this
            </h2>
            <p className="font-body text-sm leading-relaxed text-ink-soft">
              Indian marketplaces are required to record a real tax-identity reference for every seller —
              this is that step, nothing more. <strong className="text-ink">WE Bohra does not tax you</strong>,
              and doesn&apos;t apply GST rules to your sales on your behalf — whatever tax rules already
              apply to your business are between you and the government, exactly as they were before you
              joined WE Bohra. We&apos;re simply required to have this on file and admin-verified before
              your listings can go live.
            </p>
            <div className="flex flex-col gap-2 pt-1">
              <a
                href="https://www.gst.gov.in/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 font-body text-sm font-medium text-navy hover:underline"
              >
                Official GST portal <ExternalLink className="h-3.5 w-3.5" strokeWidth={2} />
              </a>
              <a
                href="https://udyamregistration.gov.in/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 font-body text-sm font-medium text-navy hover:underline"
              >
                Official Udyam Registration portal <ExternalLink className="h-3.5 w-3.5" strokeWidth={2} />
              </a>
            </div>
          </div>

          {/* Which one do I need? */}
          <div className="flex flex-col gap-3 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-ink-soft/5">
            <h2 className="flex items-center gap-2 font-heading text-sm font-semibold text-ink">
              <Landmark className="h-4 w-4 text-ink-soft" strokeWidth={2} />
              Which one do I need?
            </h2>
            <ul className="flex flex-col gap-3 font-body text-sm leading-relaxed text-ink-soft">
              <li className="flex gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-teal" strokeWidth={2} />
                <span>
                  <strong className="text-ink">Already have GST registration?</strong> Submit your
                  15-character GSTIN.
                </span>
              </li>
              <li className="flex gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-teal" strokeWidth={2} />
                <span>
                  <strong className="text-ink">Don&apos;t have GST</strong> (many small home-based
                  businesses don&apos;t need it)? Register for <strong className="text-ink">Udyam</strong>{' '}
                  instead — India&apos;s free MSME enrollment scheme, a genuinely separate scheme from GST,
                  not a lesser substitute for it. It takes a few minutes on the official portal above.
                </span>
              </li>
            </ul>
          </div>

          {/* Video walkthrough — reserved slot, not built yet (see this
           *  file's own top comment). */}
          <div className="flex items-center gap-4 rounded-2xl border border-dashed border-ink-soft/25 bg-ivory-deep/40 p-6">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-ink-soft/10">
              <PlayCircle className="h-5 w-5 text-ink-soft" strokeWidth={1.75} />
            </span>
            <div>
              <p className="font-body text-sm font-semibold text-ink">Step-by-step video walkthrough</p>
              <p className="font-body text-xs text-ink-soft">
                Coming soon — a short video showing exactly how to register for GST or Udyam and submit it
                here.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatusBanner({
  status,
  type,
  number,
  reason,
}: {
  status: 'verified' | 'pending' | 'rejected' | 'none';
  type: TaxIdType | null;
  number: string | null;
  reason: string | null;
}) {
  if (status === 'verified') {
    return (
      <div className="flex items-center gap-3 rounded-2xl bg-teal/10 p-5 ring-1 ring-teal/20">
        <ShieldCheck className="h-8 w-8 shrink-0 text-teal-deep" strokeWidth={1.75} />
        <div>
          <p className="font-body text-sm font-semibold text-ink">Verified</p>
          <p className="font-body text-xs text-ink-soft">
            {type === 'gst' ? 'GSTIN' : 'Udyam ID'} {number} — verified by Admin. Your listings can publish
            normally.
          </p>
        </div>
      </div>
    );
  }
  if (status === 'rejected') {
    return (
      <div className="flex items-center gap-3 rounded-2xl bg-red-50 p-5 ring-1 ring-red-200">
        <FileWarning className="h-8 w-8 shrink-0 text-red-600" strokeWidth={1.75} />
        <div>
          <p className="font-body text-sm font-semibold text-ink">Needs correction</p>
          <p className="font-body text-xs text-ink-soft">
            {type === 'gst' ? 'GSTIN' : 'Udyam ID'} {number} was rejected: {reason}. Submit a corrected
            number below.
          </p>
        </div>
      </div>
    );
  }
  if (status === 'pending') {
    return (
      <div className="flex items-center gap-3 rounded-2xl bg-gold/15 p-5 ring-1 ring-gold/30">
        <Clock className="h-8 w-8 shrink-0 text-ink" strokeWidth={1.75} />
        <div>
          <p className="font-body text-sm font-semibold text-ink">Pending review</p>
          <p className="font-body text-xs text-ink-soft">
            {type === 'gst' ? 'GSTIN' : 'Udyam ID'} {number} — submitted, waiting on Admin to verify it.
          </p>
        </div>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-ivory-deep p-5 ring-1 ring-ink-soft/10">
      <ShieldAlert className="h-8 w-8 shrink-0 text-ink-soft" strokeWidth={1.75} />
      <div>
        <p className="font-body text-sm font-semibold text-ink">Not submitted yet</p>
        <p className="font-body text-xs text-ink-soft">
          You can keep setting up your account and products as normal — you just won&apos;t be able to
          publish anything live until this is submitted and verified.
        </p>
      </div>
    </div>
  );
}
