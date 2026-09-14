"use client";

import { useState, type FormEvent } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  upsertMyProfile,
  setMyInterests,
  uploadAvatar,
  uploadProfilePhoto,
  removeProfilePhoto,
} from "@/lib/profile/queries";
import type { Gender, Interest } from "@/lib/profile/types";
import { localizedInterestLabel } from "@/lib/interests/label";
import { AvatarPicker } from "@/components/profile/avatar-picker";
import { PhotoPicker } from "@/components/media/photo-picker";
import { GenderSelect } from "@/components/profile/gender-select";
import { InterestsGrid } from "@/components/profile/interests-grid";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { CityAutocomplete } from "@/components/search/city-autocomplete";
import { TemporaryCityCard } from "@/components/profile/temporary-city-card";

const chipButtonClass =
  "inline-flex items-center gap-1.5 rounded-full border border-border px-3.5 py-1.5 text-xs font-semibold text-muted transition-colors hover:border-teal2 hover:text-teal2";
const signOutChipClass =
  "inline-flex items-center gap-1.5 rounded-full border border-[#a8543a]/30 px-3.5 py-1.5 text-xs font-semibold transition-colors hover:border-[#a8543a] disabled:opacity-60";
const fieldLabelClass = "mb-1.5 block text-xs font-bold uppercase tracking-wide text-muted";
const fieldInputClass =
  "w-full rounded-lg border border-border px-3 py-2.5 text-sm outline-none focus:border-teal2";

const MAX_PROFILE_PHOTOS = 3; // mirrors the DB-level cap (enforce_profile_photos_limit)

function sameInterestSet(a: number[], b: number[]) {
  if (a.length !== b.length) return false;
  const set = new Set(a);
  return b.every((id) => set.has(id));
}

type FormState = {
  fullName: string;
  lastName: string;
  avatarUrl: string | null;
  city: string;
  age: number | null;
  gender: Gender | null;
  interestIds: number[];
  bio: string;
};

export function ProfileForm({
  userId,
  interests,
  initial,
  temporaryCity,
  photos: initialPhotos,
}: {
  userId: string;
  interests: Interest[];
  initial: FormState;
  temporaryCity: {
    homeCity: string | null;
    destination: string | null;
    from: string | null;
    until: string | null;
  };
  photos: string[];
}) {
  const t = useTranslations("Profile");
  const tFields = useTranslations("ProfileFields");
  const tTemporaryCity = useTranslations("TemporaryCity");
  const locale = useLocale();

  const [form, setForm] = useState<FormState>(initial);
  // Contrairement aux autres champs, les photos supplémentaires vivent dans
  // leur propre table (profile_photos) et sont persistées tout de suite à
  // l'ajout/au retrait (via PhotoPicker) plutôt qu'au clic sur "Enregistrer".
  const [photos, setPhotos] = useState<string[]>(initialPhotos);
  // Mirrors TemporaryCityCard's own active/inactive state (lifted up via
  // onActiveChange) so the city field below can be disabled while a trip is
  // active — editing it directly would otherwise silently get clobbered by
  // save (see handleSave) or fight with set_temporary_city()/pg_cron.
  const [tripActive, setTripActive] = useState(Boolean(temporaryCity.until));
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState<
    { kind: "success" | "error"; message: string } | null
  >(null);
  const [collapseSignal, setCollapseSignal] = useState(0);

  // Tracks what's actually persisted for interests specifically, so the
  // floating "save interests" button only shows up once the selection
  // diverges from the DB — and so the whole-form save (which also persists
  // interests) can keep it in sync too.
  const [savedInterestIds, setSavedInterestIds] = useState<number[]>(
    initial.interestIds
  );
  const [interestsPending, setInterestsPending] = useState(false);
  const [interestsSaved, setInterestsSaved] = useState(false);
  const interestsDirty = !sameInterestSet(form.interestIds, savedInterestIds);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSaveInterests() {
    setInterestsSaved(false);
    setInterestsPending(true);
    try {
      const supabase = createClient();
      await setMyInterests(supabase, userId, form.interestIds);
      setSavedInterestIds(form.interestIds);
      setCollapseSignal((v) => v + 1);
      setInterestsSaved(true);
    } catch {
      setNotice({ kind: "error", message: t("saveError") });
    } finally {
      setInterestsPending(false);
    }
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    setNotice(null);

    if (!form.fullName.trim()) {
      setNotice({ kind: "error", message: t("errors.fullNameRequired") });
      return;
    }
    if (!form.lastName.trim()) {
      setNotice({ kind: "error", message: t("errors.lastNameRequired") });
      return;
    }
    if (form.age !== null && (form.age < 18 || form.age > 120)) {
      setNotice({ kind: "error", message: t("errors.ageInvalid") });
      return;
    }

    setPending(true);
    try {
      const supabase = createClient();
      await upsertMyProfile(supabase, userId, {
        full_name: form.fullName.trim(),
        last_name: form.lastName.trim(),
        avatar_url: form.avatarUrl,
        // Omitted while a temporary city trip is active: the field is
        // disabled below and profiles.city currently holds the travel
        // destination, not what's in form.city (the home city) — sending
        // it here would silently end the trip as a side effect of an
        // unrelated save (name/age/bio).
        ...(tripActive ? {} : { city: form.city.trim() || null }),
        age: form.age,
        gender: form.gender,
        bio: form.bio.trim() || null,
      });
      await setMyInterests(supabase, userId, form.interestIds);
      setSavedInterestIds(form.interestIds);
      setNotice({ kind: "success", message: t("saveSuccess") });
      setCollapseSignal((v) => v + 1);
    } catch {
      setNotice({ kind: "error", message: t("saveError") });
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="p-6 md:p-10">
      <h1 className="mb-4 text-2xl font-extrabold text-text">{t("title")}</h1>

      <div className="mb-6 flex flex-wrap gap-2">
        <Link href="/friends?tab=blocked" className={chipButtonClass}>
          🚫 {t("blockedUsersLink")}
        </Link>
        <Link href="/settings" className={chipButtonClass}>
          ⚙️ {t("settingsLink")}
        </Link>
        <SignOutButton iconOnly={false} className={signOutChipClass} />
      </div>

      <form
        onSubmit={handleSave}
        className="w-full max-w-sm rounded-2xl border border-border bg-card p-8 shadow-sm"
      >
        <div className="flex flex-col items-center gap-4">
          <AvatarPicker
            upload={(blob) => uploadAvatar(createClient(), userId, blob)}
            value={form.avatarUrl}
            onChange={(url) => update("avatarUrl", url)}
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
              onChange={(e) => update("fullName", e.target.value)}
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
              onChange={(e) => update("lastName", e.target.value)}
              className={fieldInputClass}
            />
          </div>
        </div>

        <div className="mt-4">
          <p className={fieldLabelClass}>{tFields("photosLabel")}</p>
          <p className="mb-2 text-xs text-muted">{tFields("photosHint")}</p>
          <PhotoPicker
            value={photos}
            onChange={setPhotos}
            maxPhotos={MAX_PROFILE_PHOTOS}
            upload={(blob) => uploadProfilePhoto(createClient(), userId, blob)}
            remove={(url) => removeProfilePhoto(createClient(), userId, url)}
            addLabel={tFields("photosAdd")}
            errorLabel={tFields("photosError")}
            removeLabel={tFields("photoRemove")}
          />
        </div>

        <div className="mt-4 flex flex-col gap-3">
          <div>
            <p className={fieldLabelClass}>{tFields("cityLabel")}</p>
            <CityAutocomplete
              value={form.city}
              onChange={(v) => update("city", v)}
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
              onChange={(e) =>
                update("age", e.target.value ? Number(e.target.value) : null)
              }
              className={fieldInputClass}
            />
          </div>
          <div>
            <p className={fieldLabelClass}>{tFields("genderLabel")}</p>
            <GenderSelect
              value={form.gender}
              onChange={(g) => update("gender", g)}
            />
          </div>
        </div>

        <div className="mt-4">
          <p className={fieldLabelClass}>
            {tFields("interests")} ({form.interestIds.length})
          </p>
          {form.interestIds.length > 0 && (
            <div className="mb-3 flex flex-wrap gap-1.5">
              {interests
                .filter((interest) => form.interestIds.includes(interest.id))
                .map((interest) => (
                  <span
                    key={interest.id}
                    className="rounded-full border border-border bg-bg px-2.5 py-1 text-xs font-semibold text-muted"
                  >
                    {interest.emoji ? `${interest.emoji} ` : ""}
                    {localizedInterestLabel(interest, locale)}
                  </span>
                ))}
            </div>
          )}
          <InterestsGrid
            interests={interests}
            selectedIds={form.interestIds}
            onChange={(ids) => {
              setInterestsSaved(false);
              update("interestIds", ids);
            }}
            userId={userId}
            collapseSignal={collapseSignal}
          />

          <AnimatePresence>
            {interestsDirty && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.15 }}
                className="sticky bottom-3 z-10 mt-3 flex justify-center"
              >
                <button
                  type="button"
                  onClick={handleSaveInterests}
                  disabled={interestsPending}
                  className="rounded-full px-5 py-2 text-sm font-bold text-white shadow-lg disabled:opacity-60"
                  style={{ backgroundImage: "var(--grad)" }}
                >
                  {interestsPending ? "…" : t("saveInterests")}
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {interestsSaved && !interestsDirty && (
            <p className="mt-2 text-center text-xs font-semibold text-teal2">
              {t("interestsSaved")}
            </p>
          )}
        </div>

        <textarea
          rows={4}
          placeholder={tFields("bioPlaceholder")}
          value={form.bio}
          onChange={(e) => update("bio", e.target.value)}
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

      <div className="mt-4 w-full max-w-sm">
        <TemporaryCityCard
          homeCity={temporaryCity.homeCity}
          destination={temporaryCity.destination}
          from={temporaryCity.from}
          until={temporaryCity.until}
          onActiveChange={setTripActive}
        />
      </div>
    </div>
  );
}
