'use client';

import { useCallback, useEffect, useRef, useState, type DragEvent } from 'react';
import { ImagePlus, X, ArrowLeft, ArrowRight, Loader2, UploadCloud } from 'lucide-react';
import { authFetch } from '@/lib/session-client';
import { Skeleton } from '@/components/skeleton';

type ProductImage = { id: number; url: string; sortOrder: number };

const MAX_IMAGES = 8;
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_FILE_BYTES = 8 * 1024 * 1024;

/**
 * Multi-image manager for a product — upload (direct to R2 via a presigned
 * URL, drag-and-drop or click-to-browse), remove, and reorder (the first
 * image is the cover shown everywhere a single thumbnail is used). Only
 * usable once the product already exists (needs a listingId), so
 * ProductForm's "new product" flow saves as a draft first — on the same
 * page, no navigation — before this section becomes visible.
 */
export function ImageManager({ listingId }: { listingId: number }) {
  const [images, setImages] = useState<ProductImage[] | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Drag events fire on every child element too — this counts enter/leave
  // pairs so the highlight doesn't flicker off while dragging over a photo
  // tile inside the dropzone.
  const dragCounter = useRef(0);

  const load = useCallback(async () => {
    const res = await authFetch(`/api/listings/${listingId}/images`);
    const data = await res.json();
    setImages(data.images ?? []);
  }, [listingId]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setError(null);

    const remaining = MAX_IMAGES - (images?.length ?? 0);
    if (remaining <= 0) {
      setError(`A product can have up to ${MAX_IMAGES} photos.`);
      return;
    }

    const toUpload = Array.from(files).slice(0, remaining);
    setUploading(true);
    try {
      for (const file of toUpload) {
        if (!ALLOWED_TYPES.includes(file.type)) {
          setError('Only JPEG, PNG, or WEBP images are allowed.');
          continue;
        }
        if (file.size > MAX_FILE_BYTES) {
          setError('Each photo must be under 8MB.');
          continue;
        }

        try {
          const presignRes = await authFetch('/api/uploads/presign', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contentType: file.type, listingId }),
          });
          const presignData = await presignRes.json();
          if (!presignRes.ok) {
            setError(presignData.error ?? 'Could not start the upload.');
            continue;
          }

          const putRes = await fetch(presignData.uploadUrl, {
            method: 'PUT',
            headers: { 'Content-Type': file.type },
            body: file,
          });
          if (!putRes.ok) {
            setError('Upload to storage failed. Try again.');
            continue;
          }

          const attachRes = await authFetch(`/api/listings/${listingId}/images`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: presignData.publicUrl }),
          });
          const attachData = await attachRes.json();
          if (!attachRes.ok) {
            setError(attachData.error ?? 'Could not save the photo.');
          }
        } catch (err) {
          // A network-level failure (e.g. the R2 bucket's CORS policy
          // blocking the direct browser PUT) throws rather than resolving
          // with a non-ok response — caught here so it surfaces as a normal
          // inline error instead of an unhandled exception. Logged with the
          // real error and target host since "Failed to fetch" alone gives
          // no clue whether this is CORS, DNS, or something else — check
          // the browser's Network tab for the actual failed request too.
          console.error('R2 upload PUT failed:', err);
          setError('Could not reach storage to upload this photo — check the browser console/Network tab for details.');
        }
      }
      await load();
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  async function removeImage(imageId: number) {
    setImages((prev) => prev?.filter((img) => img.id !== imageId) ?? null);
    await authFetch(`/api/listings/${listingId}/images/${imageId}`, { method: 'DELETE' });
    await load();
  }

  async function move(index: number, direction: -1 | 1) {
    if (!images) return;
    const next = [...images];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    setImages(next);
    await authFetch(`/api/listings/${listingId}/images/reorder`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ order: next.map((img) => img.id) }),
    });
  }

  function handleDragEnter(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    if (!event.dataTransfer.types.includes('Files')) return;
    dragCounter.current += 1;
    setDragActive(true);
  }

  function handleDragOver(event: DragEvent<HTMLDivElement>) {
    // Required for onDrop to fire at all — browsers reject a drop on an
    // element whose dragover isn't prevented.
    event.preventDefault();
  }

  function handleDragLeave(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    dragCounter.current = Math.max(0, dragCounter.current - 1);
    if (dragCounter.current === 0) setDragActive(false);
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    dragCounter.current = 0;
    setDragActive(false);
    if (uploading) return;
    handleFiles(event.dataTransfer.files);
  }

  return (
    <div className="flex flex-col gap-3">
      {images === null ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Skeleton className="aspect-square rounded-xl" />
          <Skeleton className="aspect-square rounded-xl" />
          <Skeleton className="aspect-square rounded-xl" />
          <Skeleton className="aspect-square rounded-xl" />
        </div>
      ) : (
        <div
          onDragEnter={handleDragEnter}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`relative grid grid-cols-2 gap-3 rounded-xl transition sm:grid-cols-4 ${
            dragActive ? 'ring-2 ring-navy ring-offset-2' : ''
          }`}
        >
          {dragActive && (
            <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center gap-2 rounded-xl bg-navy/5 backdrop-blur-[1px]">
              <UploadCloud className="h-5 w-5 text-navy" strokeWidth={2} />
              <span className="font-body text-sm font-medium text-navy">Drop photos to upload</span>
            </div>
          )}

          {images.map((img, index) => (
            <div key={img.id} className="group relative aspect-square overflow-hidden rounded-xl bg-ivory-deep ring-1 ring-ink-soft/10">
              {/* eslint-disable-next-line @next/next/no-img-element -- seller-uploaded R2 URL, host not known at build time */}
              <img src={img.url} alt="" className="h-full w-full object-cover" />
              {index === 0 && (
                <span className="absolute left-1.5 top-1.5 rounded-full bg-navy/90 px-2 py-0.5 font-body text-[10px] font-semibold text-ivory">
                  Cover
                </span>
              )}
              <button
                onClick={() => removeImage(img.id)}
                aria-label="Remove photo"
                className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-ink/60 text-ivory opacity-0 transition group-hover:opacity-100"
              >
                <X className="h-3.5 w-3.5" strokeWidth={2.5} />
              </button>
              <div className="absolute inset-x-1.5 bottom-1.5 flex justify-between opacity-0 transition group-hover:opacity-100">
                <button
                  onClick={() => move(index, -1)}
                  disabled={index === 0}
                  aria-label="Move earlier"
                  className="flex h-6 w-6 items-center justify-center rounded-full bg-ink/60 text-ivory disabled:opacity-30"
                >
                  <ArrowLeft className="h-3.5 w-3.5" strokeWidth={2.5} />
                </button>
                <button
                  onClick={() => move(index, 1)}
                  disabled={index === images.length - 1}
                  aria-label="Move later"
                  className="flex h-6 w-6 items-center justify-center rounded-full bg-ink/60 text-ivory disabled:opacity-30"
                >
                  <ArrowRight className="h-3.5 w-3.5" strokeWidth={2.5} />
                </button>
              </div>
            </div>
          ))}

          {(images.length < MAX_IMAGES) && (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="flex aspect-square flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-ink-soft/25 text-ink-soft transition hover:border-navy/40 hover:text-navy disabled:opacity-60"
            >
              {uploading ? (
                <Loader2 className="h-5 w-5 animate-spin" strokeWidth={2} />
              ) : (
                <ImagePlus className="h-5 w-5" strokeWidth={1.75} />
              )}
              <span className="font-body text-xs">{uploading ? 'Uploading…' : 'Add photo'}</span>
              <span className="hidden font-body text-[11px] text-ink-soft/70 sm:block">or drag & drop</span>
            </button>
          )}
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        onChange={(e) => handleFiles(e.target.files)}
        className="hidden"
      />

      <p className="font-body text-xs text-ink-soft">
        Up to {MAX_IMAGES} photos, JPEG/PNG/WEBP, 8MB each. Drag and drop onto the tiles above, or
        click &ldquo;Add photo&rdquo;. The first photo is the cover shown on listing cards.
      </p>
      {error && <p className="font-body text-xs text-red-700">{error}</p>}
    </div>
  );
}
