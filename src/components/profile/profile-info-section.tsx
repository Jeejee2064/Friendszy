"use client";

import type { FormEvent } from "react";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import { uploadAvatar } from "@/lib/profile/queries";
import type { Gender } from "@/lib/profile/types";
import { AvatarPicker } from "@/components/profile/avatar-picker";
import { GenderSelect } from "@/components/profile/gender-select";
import { CityAutocomplete } from "@/components/search/city-autocomplete";

const fieldLabelClass = "mb-1.5 block text-xs font-bold uppercase tracking-wide text-muted";
const fieldInputClass =
  "w-full rounded-lg border border-border px-3 py-2.5 text-sm outline-none focus:border-teal2";

type InfoFormState = {
  fullName: string;
  lastName: string;
  avatarUrl: string | null;
  city: string;
  age: number | null;
  gender: Gender | null;
  bio: string;
};

/**
 * "Infos" tab: identity fields saved together via the parent's handleSave
 * (name/city/age/gender/bio) — mirrors the granularity that already existed
 * before the tabs split (avatar auto-saves on upload, photos/interests/trip
 * each have their own save flow in their own tab).
 */
export function ProfileInfoSection({
  userId,
  form,
  onUpdate,
  tripActive,
  pending,
  notice,
  onSubmit,
}: {
  userId: string;
  form: InfoFormState;
  onUpdate: (patch: Partial<InfoFormState>) => void;
  tripActive: boolean;
  pending: boolean;
  notice: { kind: "success" | "error"; message: string } | null;
  onSubmit: (e: FormEvent) => void;
}) {
  const t = useTranslations("Profile");
  const tFields = useTranslations("ProfileFields");
  const tTemporaryCity = useTranslations("TemporaryCity");

  return (
    <form
      onSubmit={onSubmit}
      className="w-full max-w-sm rounded-2xl border border-border bg-card p-8 shadow-sm"
    >
      <div className="flex flex-col items-center gap-4">
        <AvatarPicker
          upload={(blob) => uploadAvatar(createClient(), userId, blob)}
          value={form.avatarUrl}
          onChange={(url) => onUpdate({ avatarUrl: url })}
        />
        <div className="w-full">
          <label htmlFor="profile-full-name" className={fieldLabelClass}>
            {tFields("fullNameLabel")}
          </label>
          <input
            id="profile-full-name"
            type="text"
            required
            placeholder={tFields("fullNamePlaceholder")}
            value={form.fullName}
            onChange={(e) => onUpdate({ fullName: e.target.value })}
            className={fieldInputClass}
          />
        </div>
        <div className="w-full">
          <label htmlFor="profile-last-name" className={fieldLabelClass}>
            {tFields("lastNameLabel")}
          </label>
          <input
            id="profile-last-name"
            type="text"
            required
            placeholder={tFields("lastNamePlaceholder")}
            value={form.lastName}
            onChange={(e) => onUpdate({ lastName: e.target.value })}
            className={fieldInputClass}
          />
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-3">
        <div>
          <p className={fieldLabelClass}>{tFields("cityLabel")}</p>
          <CityAutocomplete
            value={form.city}
            onChange={(v) => onUpdate({ city: v })}
            placeholder={tFields("cityPlaceholder")}
            disabled={tripActive}
          />
          {tripActive && (
            <p className="mt-1.5 text-xs text-muted">{tTemporaryCity("cityFieldLockedHint")}</p>
          )}
        </div>
        <div>
          <label htmlFor="profile-age" className={fieldLabelClass}>
            {tFields("ageLabel")}
          </label>
          <input
            id="profile-age"
            type="number"
            min={18}
            max={120}
            placeholder={tFields("agePlaceholder")}
            value={form.age ?? ""}
            onChange={(e) => onUpdate({ age: e.target.value ? Number(e.target.value) : null })}
            className={fieldInputClass}
          />
        </div>
        <div>
          <p className={fieldLabelClass}>{tFields("genderLabel")}</p>
          <GenderSelect value={form.gender} onChange={(g) => onUpdate({ gender: g })} />
        </div>
      </div>

      <textarea
        rows={4}
        placeholder={tFields("bioPlaceholder")}
        value={form.bio}
        onChange={(e) => onUpdate({ bio: e.target.value })}
        className="mt-4 w-full rounded-lg border border-border px-3 py-2.5 text-sm outline-none focus:border-teal2"
      />

      {notice && (
        <div
          className="mt-4 rounded-lg border p-3 text-sm"
          style={
            notice.kind === "success"
              ? {
                  background: "#e8f8f5",
                  borderColor: "var(--border)",
                  color: "var(--dark)",
                }
              : {
                  background: "#fdecec",
                  borderColor: "#f3c8c8",
                  color: "#e55",
                }
          }
        >
          {notice.message}
        </div>
      )}

      <button
        type="submit"
        disabled={pending}
        className="mt-6 w-full rounded-full py-2.5 font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
        style={{ backgroundImage: "var(--grad)" }}
      >
        {pending ? "…" : t("save")}
      </button>
    </form>
  );
}
