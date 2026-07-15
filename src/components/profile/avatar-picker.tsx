"use client";

import { useState, type ChangeEvent } from "react";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import { processAvatarImage } from "@/lib/image/process-avatar";
import { uploadAvatar } from "@/lib/profile/queries";

export function AvatarPicker({
  userId,
  value,
  onChange,
}: {
  userId: string;
  value: string | null;
  onChange: (url: string) => void;
}) {
  const t = useTranslations("ProfileFields");
  const [preview, setPreview] = useState<string | null>(value);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);

  async function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setError(false);
    setPending(true);
    const localUrl = URL.createObjectURL(file);
    setPreview(localUrl);

    try {
      const blob = await processAvatarImage(file);
      const supabase = createClient();
      const url = await uploadAvatar(supabase, userId, blob);
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
    </div>
  );
}
