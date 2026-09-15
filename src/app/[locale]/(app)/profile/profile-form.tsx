"use client";

import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import { upsertMyProfile, setMyInterests } from "@/lib/profile/queries";
import type { Gender, Interest } from "@/lib/profile/types";
import { ProfileTabs, type ProfileTab } from "@/components/profile/profile-tabs";
import { ProfileInfoSection } from "@/components/profile/profile-info-section";
import { ProfilePhotosSection } from "@/components/profile/profile-photos-section";
import { ProfileInterestsSection } from "@/components/profile/profile-interests-section";
import { ProfileSettingsSection } from "@/components/profile/profile-settings-section";
import { TemporaryCityCard } from "@/components/profile/temporary-city-card";

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

  const [activeTab, setActiveTab] = useState<ProfileTab>("info");
  const [form, setForm] = useState<FormState>(initial);
  // Contrairement aux autres champs, les photos supplémentaires vivent dans
  // leur propre table (profile_photos) et sont persistées tout de suite à
  // l'ajout/au retrait (via PhotoPicker) plutôt qu'au clic sur "Enregistrer".
  const [photos, setPhotos] = useState<string[]>(initialPhotos);
  // Mirrors TemporaryCityCard's own active/inactive state (lifted up via
  // onActiveChange) so the city field in the Infos tab can be disabled while
  // a trip is active — editing it directly would otherwise silently get
  // clobbered by save (see handleSave) or fight with
  // set_temporary_city()/pg_cron.
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
        // disabled in the Infos tab and profiles.city currently holds the
        // travel destination, not what's in form.city (the home city) —
        // sending it here would silently end the trip as a side effect of
        // an unrelated save (name/age/bio).
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

      <ProfileTabs
        active={activeTab}
        onChange={setActiveTab}
        labels={{
          info: t("tabInfo"),
          photos: t("tabPhotos"),
          interests: t("tabInterests"),
          // Texte seul pour les 3 autres onglets, mais "Paramètres" est le
          // mot le plus long et fait déborder la barre à largeur mobile —
          // on garde juste l'icône ici (avec un libellé accessible caché
          // pour les lecteurs d'écran).
          settings: (
            <>
              <span aria-hidden>⚙️</span>
              <span className="sr-only">{t("tabSettings")}</span>
            </>
          ),
        }}
      />

      {activeTab === "info" && (
        <>
          <ProfileInfoSection
            userId={userId}
            form={form}
            onUpdate={(patch) => setForm((prev) => ({ ...prev, ...patch }))}
            tripActive={tripActive}
            pending={pending}
            notice={notice}
            onSubmit={handleSave}
          />
          <div className="mt-4 w-full max-w-sm">
            <TemporaryCityCard
              homeCity={temporaryCity.homeCity}
              destination={temporaryCity.destination}
              from={temporaryCity.from}
              until={temporaryCity.until}
              onActiveChange={setTripActive}
            />
          </div>
        </>
      )}

      {activeTab === "photos" && (
        <ProfilePhotosSection userId={userId} photos={photos} onChange={setPhotos} />
      )}

      {activeTab === "interests" && (
        <ProfileInterestsSection
          userId={userId}
          interests={interests}
          selectedIds={form.interestIds}
          onSelectedIdsChange={(ids) => {
            setInterestsSaved(false);
            update("interestIds", ids);
          }}
          collapseSignal={collapseSignal}
          dirty={interestsDirty}
          pending={interestsPending}
          saved={interestsSaved}
          onSave={handleSaveInterests}
        />
      )}

      {activeTab === "settings" && <ProfileSettingsSection />}
    </div>
  );
}
