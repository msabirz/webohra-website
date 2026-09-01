'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, ChevronLeft, ChevronRight, Maximize2 } from 'lucide-react';

type GalleryImage = { id: number; url: string };

const MAX_TILES = 5;

/**
 * Airbnb-style photo mosaic (one large hero tile + up to four smaller ones,
 * "+N more" on the last tile when there are extras) for the service PDP's
 * Photos section. Any tile opens a full lightbox at that photo; the hero
 * tile also gets an Amazon/Flipkart-style hover magnifier on desktop —
 * hover doesn't exist on touch, so that part is inert (not broken) on
 * mobile, same as the real thing.
 *
 * Both the lightbox and the zoom panel are portaled to document.body
 * (not just positioned absolute/fixed in place) — this page has no hover-
 * transform ancestor today, but that's exactly the bug that bit the
 * consultation/WhatsApp modals earlier (a transformed ancestor creates a
 * new containing block that hijacks `position: fixed`), so portaling is
 * cheap insurance against the same class of bug reappearing here.
 */
export function MosaicGallery({ images }: { images: GalleryImage[] }) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [zoom, setZoom] = useState<{ x: number; y: number; rect: DOMRect } | null>(null);

  if (images.length === 0) return null;

  const tiles = images.slice(0, MAX_TILES);
  const extraCount = images.length - MAX_TILES;

  function handleHeroMove(event: React.MouseEvent<HTMLButtonElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = Math.min(100, Math.max(0, ((event.clientX - rect.left) / rect.width) * 100));
    const y = Math.min(100, Math.max(0, ((event.clientY - rect.top) / rect.height) * 100));
    setZoom({ x, y, rect });
  }

  return (
    <>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 sm:grid-rows-2 sm:gap-2.5">
        {tiles.map((img, i) => {
          const isHero = i === 0;
          const isLastWithMore = i === MAX_TILES - 1 && extraCount > 0;
          return (
            <button
              key={img.id}
              type="button"
              onClick={() => setLightboxIndex(i)}
              onMouseEnter={isHero ? handleHeroMove : undefined}
              onMouseMove={isHero ? handleHeroMove : undefined}
              onMouseLeave={isHero ? () => setZoom(null) : undefined}
              className={`group relative overflow-hidden rounded-2xl bg-ivory-deep ${
                isHero
                  ? 'col-span-3 aspect-[4/3] sm:col-span-2 sm:row-span-2 sm:aspect-auto sm:cursor-zoom-in'
                  : 'aspect-square sm:aspect-auto'
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- seller-uploaded R2 URL, host not known at build time */}
              <img
                src={img.url}
                alt=""
                className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
              />
              {isHero && (
                <span className="absolute bottom-2.5 right-2.5 flex items-center gap-1 rounded-full bg-ink/60 px-2.5 py-1 font-body text-[11px] font-medium text-ivory opacity-0 transition-opacity group-hover:opacity-100">
                  <Maximize2 className="h-3 w-3" strokeWidth={2} />
                  View
                </span>
              )}
              {isHero && zoom && (
                <div
                  className="pointer-events-none absolute hidden border-2 border-white bg-white/20 lg:block"
                  style={{
                    width: '35%',
                    height: '35%',
                    left: `calc(${zoom.x}% - 17.5%)`,
                    top: `calc(${zoom.y}% - 17.5%)`,
                  }}
                />
              )}
              {isLastWithMore && (
                <span className="absolute inset-0 flex items-center justify-center bg-ink/55 font-heading text-lg font-semibold text-ivory">
                  +{extraCount} more
                </span>
              )}
            </button>
          );
        })}
      </div>

      {zoom &&
        createPortal(
          <div
            className="pointer-events-none fixed z-40 hidden overflow-hidden rounded-2xl border border-ink-soft/10 bg-white shadow-2xl lg:block"
            style={{
              left: Math.min(zoom.rect.right + 16, window.innerWidth - 356),
              top: zoom.rect.top,
              width: 340,
              height: zoom.rect.height,
              backgroundImage: `url(${tiles[0].url})`,
              backgroundSize: '220%',
              backgroundPosition: `${zoom.x}% ${zoom.y}%`,
              backgroundRepeat: 'no-repeat',
            }}
          />,
          document.body,
        )}

      {lightboxIndex !== null && (
        <Lightbox images={images} startIndex={lightboxIndex} onClose={() => setLightboxIndex(null)} />
      )}
    </>
  );
}

function Lightbox({
  images,
  startIndex,
  onClose,
}: {
  images: GalleryImage[];
  startIndex: number;
  onClose: () => void;
}) {
  const [index, setIndex] = useState(startIndex);
  const hasMultiple = images.length > 1;

  function prev() {
    setIndex((i) => (i - 1 + images.length) % images.length);
  }
  function next() {
    setIndex((i) => (i + 1) % images.length);
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') prev();
      if (e.key === 'ArrowRight') next();
    }
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [images.length]);

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/90 p-4">
      <button aria-hidden="true" tabIndex={-1} onClick={onClose} className="absolute inset-0" />

      <button
        onClick={onClose}
        aria-label="Close"
        className="absolute right-4 top-4 z-10 rounded-full bg-white/10 p-2 text-ivory transition hover:bg-white/20"
      >
        <X className="h-5 w-5" strokeWidth={2} />
      </button>

      {hasMultiple && (
        <>
          <button
            onClick={prev}
            aria-label="Previous photo"
            className="absolute left-3 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white/10 p-2 text-ivory transition hover:bg-white/20 sm:left-5"
          >
            <ChevronLeft className="h-6 w-6" strokeWidth={2} />
          </button>
          <button
            onClick={next}
            aria-label="Next photo"
            className="absolute right-3 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white/10 p-2 text-ivory transition hover:bg-white/20 sm:right-5"
          >
            <ChevronRight className="h-6 w-6" strokeWidth={2} />
          </button>
        </>
      )}

      <div className="relative flex max-h-[85vh] max-w-4xl flex-col items-center gap-4">
        {/* eslint-disable-next-line @next/next/no-img-element -- seller-uploaded R2 URL, host not known at build time */}
        <img
          src={images[index].url}
          alt=""
          className="max-h-[75vh] max-w-full rounded-lg object-contain shadow-2xl"
        />
        {hasMultiple && (
          <div className="flex items-center gap-3">
            <span className="rounded-full bg-white/10 px-3 py-1 font-body text-xs text-ivory">
              {index + 1} / {images.length}
            </span>
            <div className="hidden gap-2 sm:flex">
              {images.map((img, i) => (
                <button
                  key={img.id}
                  onClick={() => setIndex(i)}
                  aria-label={`Go to photo ${i + 1}`}
                  className={`h-12 w-12 overflow-hidden rounded-lg transition-all ${
                    i === index ? 'ring-2 ring-ivory ring-offset-2 ring-offset-ink' : 'opacity-50 hover:opacity-80'
                  }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- seller-uploaded R2 URL, host not known at build time */}
                  <img src={img.url} alt="" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
