"use client";

import { useState, type ChangeEvent } from "react";
import { useTranslations } from "next-intl";
import { processAvatarImage } from "@/lib/image/process-avatar";
import { AvatarCropModal } from "@/components/profile/avatar-crop-modal";

export function AvatarPicker({
  upload,
  value,
  onChange,
}: {
  upload: (blob: Blob) => Promise<string>;
  value: string | null;
  onChange: (url: string) => void;
}) {
  const t = useTranslations("ProfileFields");
  const [preview, setPreview] = useState<string | null>(value);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);
  const [cropSrc, setCropSrc] = useState<string | null>(null);

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setError(false);
    setCropSrc(URL.createObjectURL(file));
  }

  function handleCropCancel() {
    if (cropSrc) URL.revokeObjectURL(cropSrc);
    setCropSrc(null);
  }

  async function handleCropConfirm(croppedBlob: Blob) {
    if (cropSrc) URL.revokeObjectURL(cropSrc);
    setCropSrc(null);

    setPending(true);
    const localUrl = URL.createObjectURL(croppedBlob);
    setPreview(localUrl);

    try {
      const blob = await processAvatarImage(croppedBlob);
      const url = await upload(blob);
      onChange(url);
      setPreview(url);
    } catch {
      setError(true);
      setPreview(value);
    } finally {
      URL.revokeObjectURL(localUrl);
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <div
        className="flex h-28 w-28 items-center justify-center overflow-hidden rounded-full border border-border text-3xl font-bold text-white"
        style={!preview ? { backgroundImage: "var(--grad)" } : undefined}
      >
        {preview ? (
          // Aperçu d'un fichier local (blob:) ou d'une URL Supabase Storage — next/image ne gère pas les blob URLs.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="" className="h-full w-full object-cover" />
        ) : (
          "?"
        )}
      </div>
      <label className="cursor-pointer text-sm font-semibold text-teal2 hover:underline">
        {pending ? t("photoUploading") : t("photoChoose")}
        <input
          type="file"
          accept="image/*"
          className="hidden"
          disabled={pending}
          onChange={handleFileChange}
        />
      </label>
      {error && <p className="text-xs" style={{ color: "#e55" }}>{t("photoError")}</p>}
      <AvatarCropModal
        imageUrl={cropSrc}
        open={!!cropSrc}
        onCancel={handleCropCancel}
        onConfirm={handleCropConfirm}
      />
    </div>
  );
}
