"use client";

import { useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { useTranslations } from "next-intl";
import { Modal } from "@/components/ui/modal";

// Taille d'affichage du cadre de recadrage (cercle) et résolution du carré
// exporté avant le pipeline de compression existant (processAvatarImage) —
// assez grand pour rester net une fois passé dans ce pipeline.
const CANVAS_SIZE = 280;
const OUTPUT_SIZE = 640;
const MAX_ZOOM = 3;
// Marge appliquée au-delà du "cover fit" strict : sans elle, la dimension qui
// touche exactement les bords du cadre (largeur pour une photo portrait,
// hauteur pour une photo paysage) a une plage de déplacement de 0 au zoom
// minimal — l'utilisateur peut alors glisser dans un sens mais pas l'autre
// tant qu'il n'a pas d'abord zoomé.
const MIN_OVERSCAN = 1.2;

export function AvatarCropModal({
  imageUrl,
  open,
  onCancel,
  onConfirm,
}: {
  imageUrl: string | null;
  open: boolean;
  onCancel: () => void;
  onConfirm: (blob: Blob) => void;
}) {
  const t = useTranslations("ProfileFields");

  return (
    <Modal open={open} onClose={onCancel} title={t("cropTitle")}>
      {/* Keyed on imageUrl so picking a new file starts from fresh
          zoom/offset state instead of carrying over the previous photo's
          framing via an effect-driven reset. */}
      {imageUrl && (
        <AvatarCropContent
          key={imageUrl}
          imageUrl={imageUrl}
          onCancel={onCancel}
          onConfirm={onConfirm}
        />
      )}
    </Modal>
  );
}

function AvatarCropContent({
  imageUrl,
  onCancel,
  onConfirm,
}: {
  imageUrl: string;
  onCancel: () => void;
  onConfirm: (blob: Blob) => void;
}) {
  const t = useTranslations("ProfileFields");
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [naturalSize, setNaturalSize] = useState<{ w: number; h: number } | null>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const dragRef = useRef<{
    startX: number;
    startY: number;
    startOffsetX: number;
    startOffsetY: number;
  } | null>(null);

  function clampOffset(x: number, y: number, currentScale: number) {
    if (!naturalSize) return { x: 0, y: 0 };
    const displayW = naturalSize.w * currentScale;
    const displayH = naturalSize.h * currentScale;
    const maxX = Math.max(0, (displayW - CANVAS_SIZE) / 2);
    const maxY = Math.max(0, (displayH - CANVAS_SIZE) / 2);
    return {
      x: Math.min(maxX, Math.max(-maxX, x)),
      y: Math.min(maxY, Math.max(-maxY, y)),
    };
  }

  function handleImgLoad() {
    const img = imgRef.current;
    if (!img) return;
    setNaturalSize({ w: img.naturalWidth, h: img.naturalHeight });
  }

  const baseScale = naturalSize
    ? Math.max(CANVAS_SIZE / naturalSize.w, CANVAS_SIZE / naturalSize.h) * MIN_OVERSCAN
    : 1;
  const scale = baseScale * zoom;

  function handlePointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      startOffsetX: offset.x,
      startOffsetY: offset.y,
    };
  }

  function handlePointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    setOffset(
      clampOffset(dragRef.current.startOffsetX + dx, dragRef.current.startOffsetY + dy, scale)
    );
  }

  function handlePointerUp() {
    dragRef.current = null;
  }

  function handleZoomChange(e: React.ChangeEvent<HTMLInputElement>) {
    const nextZoom = Number(e.target.value);
    setZoom(nextZoom);
    setOffset((prev) => clampOffset(prev.x, prev.y, baseScale * nextZoom));
  }

  async function handleConfirm() {
    if (!naturalSize) return;

    const canvas = document.createElement("canvas");
    canvas.width = OUTPUT_SIZE;
    canvas.height = OUTPUT_SIZE;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const img = new Image();
    img.src = imageUrl;
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("image load failed"));
    });

    // Même transform (échelle + décalage) que l'aperçu, à l'échelle de la
    // résolution d'export plutôt que celle du cadre affiché.
    const outputScale = OUTPUT_SIZE / CANVAS_SIZE;
    const drawScale = scale * outputScale;
    const drawW = naturalSize.w * drawScale;
    const drawH = naturalSize.h * drawScale;
    const drawX = OUTPUT_SIZE / 2 - drawW / 2 + offset.x * outputScale;
    const drawY = OUTPUT_SIZE / 2 - drawH / 2 + offset.y * outputScale;
    ctx.drawImage(img, drawX, drawY, drawW, drawH);

    canvas.toBlob(
      (blob) => {
        if (blob) onConfirm(blob);
      },
      "image/jpeg",
      0.92
    );
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <div
        className="relative h-[280px] w-[280px] touch-none overflow-hidden rounded-full border border-border bg-bg"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          ref={imgRef}
          src={imageUrl}
          alt=""
          draggable={false}
          onLoad={handleImgLoad}
          className="pointer-events-none absolute left-1/2 top-1/2 max-w-none select-none"
          style={{
            width: naturalSize ? naturalSize.w * scale : undefined,
            height: naturalSize ? naturalSize.h * scale : undefined,
            transform: `translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px))`,
          }}
        />
      </div>
      <input
        type="range"
        min={1}
        max={MAX_ZOOM}
        step={0.01}
        value={zoom}
        onChange={handleZoomChange}
        className="w-full max-w-[280px]"
        aria-label={t("cropZoom")}
      />
      <div className="flex w-full max-w-[280px] justify-between gap-3">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 rounded-full border border-border px-4 py-2 text-sm font-semibold text-muted"
        >
          {t("cropCancel")}
        </button>
        <button
          type="button"
          onClick={handleConfirm}
          className="flex-1 rounded-full px-4 py-2 text-sm font-semibold text-white"
          style={{ backgroundImage: "var(--grad)" }}
        >
          {t("cropConfirm")}
        </button>
      </div>
    </div>
  );
}
