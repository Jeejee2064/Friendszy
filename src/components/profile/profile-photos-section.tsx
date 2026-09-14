"use client";

import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import { uploadProfilePhoto, removeProfilePhoto } from "@/lib/profile/queries";
import { PhotoPicker } from "@/components/media/photo-picker";

const fieldLabelClass = "mb-1.5 block text-xs font-bold uppercase tracking-wide text-muted";

const MAX_PROFILE_PHOTOS = 3; // mirrors the DB-level cap (enforce_profile_photos_limit)

/**
 * "Photos" tab. Upload/removal are already persisted immediately by
 * PhotoPicker (profile_photos lives in its own table) — no save button here,
 * same as before the tabs split.
 */
export function ProfilePhotosSection({
  userId,
  photos,
  onChange,
}: {
  userId: string;
  photos: string[];
  onChange: (photos: string[]) => void;
}) {
  const tFields = useTranslations("ProfileFields");

  return (
    <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-8 shadow-sm">
      <p className={fieldLabelClass}>{tFields("photosLabel")}</p>
      <p className="mb-2 text-xs text-muted">{tFields("photosHint")}</p>
      <PhotoPicker
        value={photos}
        onChange={onChange}
        maxPhotos={MAX_PROFILE_PHOTOS}
        upload={(blob) => uploadProfilePhoto(createClient(), userId, blob)}
        remove={(url) => removeProfilePhoto(createClient(), userId, url)}
        addLabel={tFields("photosAdd")}
        errorLabel={tFields("photosError")}
        removeLabel={tFields("photoRemove")}
      />
    </div>
  );
}
