"use client";

import { useState, type ChangeEvent } from "react";
import { useTranslations } from "next-intl";
import { processAvatarImage } from "@/lib/image/process-avatar";

const MAX_PHOTOS = 8;

export function PhotoPicker({
  upload,
  remove,
  value,
  onChange,
}: {
  upload: (blob: Blob) => Promise<string>;
  remove?: (url: string) => Promise<void>;
  value: string[];
  onChange: (urls: string[]) => void;
}) {
  const t = useTranslations("Partners.form");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);

  async function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (files.length === 0) return;

    const toUpload = files.slice(0, Math.max(0, MAX_PHOTOS - value.length));
    if (toUpload.length === 0) return;

    setError(false);
    setPending(true);
    try {
      const uploaded: string[] = [];
      for (const file of toUpload) {
        const blob = await processAvatarImage(file);
        uploaded.push(await upload(blob));
      }
      onChange([...value, ...uploaded]);
    } catch {
      setError(true);
    } finally {
      setPending(false);
    }
  }

  function handleRemove(url: string) {
    onChange(value.filter((u) => u !== url));
    remove?.(url).catch(() => {});
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-3">
        {value.map((url) => (
          <div
            key={url}
            className="relative h-20 w-20 overflow-hidden rounded-lg border border-border"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url} alt="" className="h-full w-full object-cover" />
            <button
              type="button"
              onClick={() => handleRemove(url)}
              aria-label={t("photoRemove")}
              className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-xs text-white"
            >
              ✕
            </button>
          </div>
        ))}
        {value.length < MAX_PHOTOS && (
          <label className="flex h-20 w-20 cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-border text-center text-xs font-semibold text-teal2">
            {pending ? "…" : `+ ${t("photosAdd")}`}
            <input
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              disabled={pending}
              onChange={handleFileChange}
            />
          </label>
        )}
      </div>
      {error && (
        <p className="text-xs" style={{ color: "#e55" }}>
          {t("photosError")}
        </p>
      )}
    </div>
  );
}
