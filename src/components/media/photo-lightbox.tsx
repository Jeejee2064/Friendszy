"use client";

import { useCallback, useEffect } from "react";

// Full-screen photo viewer with prev/next navigation — generic over any
// gallery (partner listing photos today, event photos could reuse it the
// same way later). The caller owns `index` (which photo is open) so it can
// wire it to whichever thumbnail was clicked; passing `null` upstream
// unmounts this component entirely rather than it managing its own
// open/closed state.
export function PhotoLightbox({
  photos,
  index,
  onClose,
  onNavigate,
  closeLabel,
  prevLabel,
  nextLabel,
}: {
  photos: string[];
  index: number;
  onClose: () => void;
  onNavigate: (index: number) => void;
  closeLabel: string;
  prevLabel: string;
  nextLabel: string;
}) {
  const count = photos.length;
  const goPrev = useCallback(
    () => onNavigate((index - 1 + count) % count),
    [index, count, onNavigate]
  );
  const goNext = useCallback(() => onNavigate((index + 1) % count), [index, count, onNavigate]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowLeft") goPrev();
      else if (e.key === "ArrowRight") goNext();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, goPrev, goNext]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/90 p-4"
      onClick={onClose}
    >
      <button
        type="button"
        onClick={onClose}
        aria-label={closeLabel}
        className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-xl text-white transition-colors hover:bg-white/20"
      >
        ✕
      </button>

      {count > 1 && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            goPrev();
          }}
          aria-label={prevLabel}
          className="absolute left-2 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-2xl text-white transition-colors hover:bg-white/20 md:left-4"
        >
          ‹
        </button>
      )}

      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={photos[index]}
        alt=""
        className="max-h-[85vh] max-w-[92vw] rounded-lg object-contain"
        onClick={(e) => e.stopPropagation()}
      />

      {count > 1 && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            goNext();
          }}
          aria-label={nextLabel}
          className="absolute right-2 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-2xl text-white transition-colors hover:bg-white/20 md:right-4"
        >
          ›
        </button>
      )}

      {count > 1 && (
        <p className="mt-4 text-sm font-semibold text-white/80">
          {index + 1} / {count}
        </p>
      )}
    </div>
  );
}
