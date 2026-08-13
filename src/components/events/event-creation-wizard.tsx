"use client";

import { useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  attachEventPhotos,
  createEvent,
  removeEventPhotoFile,
  uploadEventPhotoFile,
} from "@/lib/events/queries";
import type { Interest } from "@/lib/profile/types";
import { CityAutocomplete } from "@/components/search/city-autocomplete";
import { GroupInterestSelect } from "@/components/groups/group-interest-select";
import { PhotoPicker } from "@/components/media/photo-picker";
import { LocationPickerMap } from "@/components/map/location-picker-map";

const fieldLabelClass = "mb-1.5 block text-xs font-bold uppercase tracking-wide text-muted";
const fieldInputClass =
  "w-full rounded-lg border border-border px-3 py-2.5 text-sm outline-none focus:border-teal2";

const MAX_EVENT_PHOTOS = 5; // mirrors the DB-level cap (enforce_event_photos_limit)
const STEP_COUNT = 3;

type EventFormState = {
  title: string;
  description: string;
  interestId: number | null;
  startsAt: string; // <input type="datetime-local"> value
  endsAt: string;
  capacity: string; // raw input; "" = unlimited
  photoUrls: string[];
  city: string;
  address: string;
};

export function EventCreationWizard({
  userId,
  interests,
}: {
  userId: string;
  interests: Interest[];
}) {
  const t = useTranslations("Events.form");
  const format = useFormatter();
  const router = useRouter();

  const [eventId] = useState(() => crypto.randomUUID());
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<EventFormState>({
    title: "",
    description: "",
    interestId: null,
    startsAt: "",
    endsAt: "",
    capacity: "",
    photoUrls: [],
    city: "",
    address: "",
  });
  const [coords, setCoords] = useState<{ latitude: number | null; longitude: number | null }>({
    latitude: null,
    longitude: null,
  });
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  function update<K extends keyof EventFormState>(key: K, value: EventFormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function validateStep(): string | null {
    if (step === 0) {
      if (!form.title.trim()) return t("errors.titleRequired");
      if (form.interestId == null) return t("errors.categoryRequired");
      if (!form.startsAt || !form.endsAt || new Date(form.endsAt) < new Date(form.startsAt)) {
        return t("errors.datesInvalid");
      }
    }
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
      const event = await createEvent(
        supabase,
        {
          id: eventId,
          title: form.title.trim(),
          description: form.description.trim() || null,
          city: form.city.trim(),
          address: form.address.trim() || null,
          latitude: coords.latitude,
          longitude: coords.longitude,
          interest_id: form.interestId!,
          starts_at: new Date(form.startsAt).toISOString(),
          ends_at: new Date(form.endsAt).toISOString(),
          capacity: form.capacity.trim() ? Number(form.capacity) : null,
        },
        userId
      );
      await attachEventPhotos(supabase, event.id, form.photoUrls);
      router.push(`/events/${event.id}`);
    } catch {
      setError(t("errors.saveFailed"));
      setPending(false);
    }
  }

  const stepTitles = [t("steps.basics"), t("steps.location"), t("steps.review")];

  return (
    <main className="flex min-h-screen flex-col items-center gap-8 bg-bg px-6 py-16">
      <div className="text-center">
        <h1 className="text-2xl font-extrabold text-text">{t("createTitle")}</h1>
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
              <label htmlFor="event-title" className={fieldLabelClass}>
                {t("titleLabel")}
              </label>
              <input
                id="event-title"
                type="text"
                required
                placeholder={t("titlePlaceholder")}
                value={form.title}
                onChange={(e) => update("title", e.target.value)}
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
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="event-starts-at" className={fieldLabelClass}>
                  {t("startsAtLabel")}
                </label>
                <input
                  id="event-starts-at"
                  type="datetime-local"
                  value={form.startsAt}
                  onChange={(e) => update("startsAt", e.target.value)}
                  className={fieldInputClass}
                />
              </div>
              <div>
                <label htmlFor="event-ends-at" className={fieldLabelClass}>
                  {t("endsAtLabel")}
                </label>
                <input
                  id="event-ends-at"
                  type="datetime-local"
                  value={form.endsAt}
                  onChange={(e) => update("endsAt", e.target.value)}
                  className={fieldInputClass}
                />
              </div>
            </div>
            <div>
              <label htmlFor="event-capacity" className={fieldLabelClass}>
                {t("capacityLabel")}
              </label>
              <input
                id="event-capacity"
                type="number"
                min={1}
                placeholder={t("capacityPlaceholder")}
                value={form.capacity}
                onChange={(e) => update("capacity", e.target.value)}
                className={fieldInputClass}
              />
              <p className="mt-1 text-xs text-muted">{t("capacityHint")}</p>
            </div>
            <div>
              <p className={fieldLabelClass}>{t("photosLabel")}</p>
              <PhotoPicker
                upload={(blob) => uploadEventPhotoFile(createClient(), eventId, blob)}
                remove={(url) => removeEventPhotoFile(createClient(), url)}
                value={form.photoUrls}
                onChange={(urls) => update("photoUrls", urls)}
                addLabel={t("photosAdd")}
                errorLabel={t("photosError")}
                removeLabel={t("photoRemove")}
                maxPhotos={MAX_EVENT_PHOTOS}
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
              <label htmlFor="event-address" className={fieldLabelClass}>
                {t("addressLabel")}
              </label>
              <input
                id="event-address"
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
          <div className="flex flex-col gap-4 text-sm">
            <div>
              <p className="text-base font-bold text-text">{form.title}</p>
              {form.description && <p className="mt-1 text-muted">{form.description}</p>}
            </div>
            <div>
              <p className={fieldLabelClass}>{t("reviewDate")}</p>
              <p className="text-text">
                {form.startsAt &&
                  format.dateTime(new Date(form.startsAt), {
                    dateStyle: "long",
                    timeStyle: "short",
                  })}
                {" → "}
                {form.endsAt &&
                  format.dateTime(new Date(form.endsAt), {
                    dateStyle: "long",
                    timeStyle: "short",
                  })}
              </p>
            </div>
            <div>
              <p className={fieldLabelClass}>{t("reviewLocation")}</p>
              <p className="text-text">
                {form.city}
                {form.address ? ` — ${form.address}` : ""}
              </p>
            </div>
            <div>
              <p className={fieldLabelClass}>{t("reviewCapacity")}</p>
              <p className="text-text">
                {form.capacity.trim() ? form.capacity : t("reviewCapacityUnlimited")}
              </p>
            </div>
          </div>
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
