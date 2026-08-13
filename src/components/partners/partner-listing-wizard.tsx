"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  createPartnerListing,
  updatePartnerListing,
  uploadPartnerListingPhoto,
  removePartnerListingPhoto,
} from "@/lib/partners/queries";
import type { Interest } from "@/lib/profile/types";
import { CityAutocomplete } from "@/components/search/city-autocomplete";
import { GroupInterestSelect } from "@/components/groups/group-interest-select";
import { PhotoPicker } from "@/components/media/photo-picker";
import { LocationPickerMap } from "@/components/map/location-picker-map";

const fieldLabelClass = "mb-1.5 block text-xs font-bold uppercase tracking-wide text-muted";
const fieldInputClass =
  "w-full rounded-lg border border-border px-3 py-2.5 text-sm outline-none focus:border-teal2";

export type PartnerListingFormState = {
  name: string;
  description: string;
  interestId: number | null;
  city: string;
  address: string;
  phone: string;
  website: string;
  photoUrls: string[];
};

const STEP_COUNT = 4;

export function PartnerListingWizard({
  userId,
  interests,
  mode,
  listingId: editListingId,
  initial,
  initialCoordinates,
}: {
  userId: string;
  interests: Interest[];
  mode: "create" | "edit";
  listingId?: string;
  initial?: PartnerListingFormState;
  initialCoordinates?: { latitude: number | null; longitude: number | null };
}) {
  const t = useTranslations("Partners.form");
  const router = useRouter();

  const [listingId] = useState(() => editListingId ?? crypto.randomUUID());
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<PartnerListingFormState>(
    initial ?? {
      name: "",
      description: "",
      interestId: null,
      city: "",
      address: "",
      phone: "",
      website: "",
      photoUrls: [],
    }
  );
  const [coords, setCoords] = useState(initialCoordinates ?? { latitude: null, longitude: null });
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  function update<K extends keyof PartnerListingFormState>(
    key: K,
    value: PartnerListingFormState[K]
  ) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function validateStep(): string | null {
    if (step === 0 && !form.name.trim()) return t("errors.nameRequired");
    if (step === 0 && form.interestId == null) return t("errors.categoryRequired");
    if (step === 1 && !form.city.trim()) return t("errors.cityRequired");
    return null;
  }

  function goNext() {
    const validationError = validateStep();
    if (validationError) {
      setError(validationError);
      return;
    }
    setError(null);
    setStep((s) => Math.min(s + 1, STEP_COUNT - 1));
  }

  function goBack() {
    setError(null);
    setStep((s) => Math.max(s - 1, 0));
  }

  async function finish() {
    setPending(true);
    setError(null);
    try {
      const supabase = createClient();
      const fields = {
        name: form.name.trim(),
        description: form.description.trim() || null,
        interest_id: form.interestId!,
        city: form.city.trim(),
        address: form.address.trim() || null,
        latitude: coords.latitude,
        longitude: coords.longitude,
        phone: form.phone.trim() || null,
        website: form.website.trim() || null,
        photo_urls: form.photoUrls,
      };

      if (mode === "create") {
        await createPartnerListing(supabase, { id: listingId, ...fields }, userId);
      } else {
        await updatePartnerListing(supabase, listingId, fields);
      }
      router.push("/partners");
    } catch {
      setError(t("errors.saveFailed"));
      setPending(false);
    }
  }

  const stepTitles = [t("steps.basics"), t("steps.location"), t("steps.contact"), t("steps.photos")];

  return (
    <main className="flex min-h-screen flex-col items-center gap-8 bg-bg px-6 py-16">
      <div className="text-center">
        <h1 className="text-2xl font-extrabold text-text">
          {mode === "create" ? t("createTitle") : t("editTitle")}
        </h1>
        <p className="mt-1 text-sm text-muted">
          {t("stepOf", { step: step + 1, total: STEP_COUNT })}
        </p>
      </div>

      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-8 shadow-sm">
        <div className="mb-5 flex justify-center gap-2">
          {Array.from({ length: STEP_COUNT }).map((_, i) => (
            <span
              key={i}
              className="h-1.5 w-8 rounded-full"
              style={{
                backgroundImage: i <= step ? "var(--grad)" : undefined,
                backgroundColor: i <= step ? undefined : "var(--border)",
              }}
            />
          ))}
        </div>

        <h2 className="mb-4 text-lg font-extrabold text-text">{stepTitles[step]}</h2>

        {step === 0 && (
          <div className="flex flex-col gap-3">
            <div>
              <label htmlFor="partner-name" className={fieldLabelClass}>
                {t("nameLabel")}
              </label>
              <input
                id="partner-name"
                type="text"
                required
                placeholder={t("namePlaceholder")}
                value={form.name}
                onChange={(e) => update("name", e.target.value)}
                className={fieldInputClass}
              />
            </div>
            <div>
              <p className={fieldLabelClass}>{t("descriptionLabel")}</p>
              <textarea
                rows={3}
                placeholder={t("descriptionPlaceholder")}
                value={form.description}
                onChange={(e) => update("description", e.target.value)}
                className={fieldInputClass}
              />
            </div>
            <div>
              <p className={fieldLabelClass}>{t("categoryLabel")}</p>
              <GroupInterestSelect
                interests={interests}
                value={form.interestId}
                onChange={(id) => update("interestId", id)}
                collapsible
              />
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="flex flex-col gap-3">
            <div>
              <p className={fieldLabelClass}>{t("cityLabel")}</p>
              <CityAutocomplete
                value={form.city}
                onChange={(v) => update("city", v)}
                placeholder={t("cityPlaceholder")}
              />
            </div>
            <div>
              <label htmlFor="partner-address" className={fieldLabelClass}>
                {t("addressLabel")}
              </label>
              <input
                id="partner-address"
                type="text"
                placeholder={t("addressPlaceholder")}
                value={form.address}
                onChange={(e) => update("address", e.target.value)}
                className={fieldInputClass}
              />
            </div>
            <LocationPickerMap
              city={form.city}
              address={form.address}
              value={coords}
              onChange={setCoords}
              hintText={t("mapHint")}
              locatingText={t("mapLocating")}
            />
          </div>
        )}

        {step === 2 && (
          <div className="flex flex-col gap-3">
            <div>
              <label htmlFor="partner-phone" className={fieldLabelClass}>
                {t("phoneLabel")}
              </label>
              <input
                id="partner-phone"
                type="tel"
                placeholder={t("phonePlaceholder")}
                value={form.phone}
                onChange={(e) => update("phone", e.target.value)}
                className={fieldInputClass}
              />
            </div>
            <div>
              <label htmlFor="partner-website" className={fieldLabelClass}>
                {t("websiteLabel")}
              </label>
              <input
                id="partner-website"
                type="url"
                placeholder={t("websitePlaceholder")}
                value={form.website}
                onChange={(e) => update("website", e.target.value)}
                className={fieldInputClass}
              />
            </div>
          </div>
        )}

        {step === 3 && (
          <PhotoPicker
            upload={(blob) => uploadPartnerListingPhoto(createClient(), listingId, blob)}
            remove={(url) => removePartnerListingPhoto(createClient(), url)}
            value={form.photoUrls}
            onChange={(urls) => update("photoUrls", urls)}
            addLabel={t("photosAdd")}
            errorLabel={t("photosError")}
            removeLabel={t("photoRemove")}
          />
        )}

        {error && (
          <div
            className="mt-4 rounded-lg border p-3 text-sm"
            style={{ background: "#fdecec", borderColor: "#f3c8c8", color: "#e55" }}
          >
            {error}
          </div>
        )}

        <div className="mt-6 flex items-center justify-between gap-3">
          {step > 0 ? (
            <button
              type="button"
              onClick={goBack}
              className="text-sm font-semibold text-muted hover:underline"
            >
              {t("back")}
            </button>
          ) : (
            <span />
          )}

          <button
            type="button"
            onClick={step === STEP_COUNT - 1 ? finish : goNext}
            disabled={pending}
            className="rounded-full px-6 py-2.5 font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
            style={{ backgroundImage: "var(--grad)" }}
          >
            {pending ? "…" : step === STEP_COUNT - 1 ? t("finish") : t("next")}
          </button>
        </div>
      </div>
    </main>
  );
}
