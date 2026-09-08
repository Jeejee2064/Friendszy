"use client";

import { useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";
import { setTemporaryCity, clearTemporaryCity } from "@/lib/profile/queries";
import { CityAutocomplete } from "@/components/search/city-autocomplete";
import { Notice } from "@/components/ui/notice";

const DURATIONS = [
  { key: "duration24h", ms: 24 * 60 * 60 * 1000 },
  { key: "duration3d", ms: 3 * 24 * 60 * 60 * 1000 },
  { key: "duration7d", ms: 7 * 24 * 60 * 60 * 1000 },
  { key: "duration14d", ms: 14 * 24 * 60 * 60 * 1000 },
] as const;

export function TemporaryCityCard({
  plan,
  homeCity,
  activeCity,
  activeUntil,
  onActiveChange,
}: {
  plan: string;
  // Ville à laquelle on revient (profiles.home_city) — affichée dans l'état actif.
  homeCity: string | null;
  // Ville temporaire + expiration actuellement en base (null si aucun séjour en cours).
  activeCity: string | null;
  activeUntil: string | null;
  // Prévient ProfileForm pour qu'il désactive le champ ville normal pendant un séjour.
  onActiveChange?: (active: boolean) => void;
}) {
  const t = useTranslations("TemporaryCity");
  const format = useFormatter();
  const router = useRouter();

  const [active, setActive] = useState(
    Boolean(activeUntil && new Date(activeUntil) > new Date())
  );
  const [city, setCity] = useState(activeCity ?? "");
  const [until, setUntil] = useState(activeUntil ?? null);
  const [durationKey, setDurationKey] = useState<(typeof DURATIONS)[number]["key"]>(
    "duration7d"
  );
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isPremium = plan === "premium";

  function setActiveState(nextActive: boolean) {
    setActive(nextActive);
    onActiveChange?.(nextActive);
  }

  async function handleActivate() {
    if (!city.trim()) return;
    setError(null);
    setPending(true);
    try {
      const duration = DURATIONS.find((d) => d.key === durationKey) ?? DURATIONS[2];
      const untilDate = new Date(Date.now() + duration.ms);
      const supabase = createClient();
      await setTemporaryCity(supabase, city.trim(), untilDate);
      setUntil(untilDate.toISOString());
      setActiveState(true);
      router.refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      setError(
        message.includes("temporary_city_requires_premium")
          ? t("errorPremiumRequired")
          : t("errorGeneric")
      );
    } finally {
      setPending(false);
    }
  }

  async function handleDeactivate() {
    setError(null);
    setPending(true);
    try {
      const supabase = createClient();
      await clearTemporaryCity(supabase);
      setActiveState(false);
      setUntil(null);
      router.refresh();
    } catch {
      setError(t("errorGeneric"));
    } finally {
      setPending(false);
    }
  }

  if (!isPremium) {
    return (
      <div className="rounded-2xl border border-border bg-card p-6">
        <div className="mb-2 flex items-center gap-2">
          <h2 className="font-bold text-text">{t("cardTitle")}</h2>
          <span
            className="rounded-full px-2 py-0.5 text-[10px] font-bold text-white"
            style={{ backgroundImage: "var(--grad)" }}
          >
            {t("premiumBadge")}
          </span>
        </div>
        <p className="text-sm text-muted">{t("premiumLockedBody")}</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-6">
      <h2 className="mb-2 font-bold text-text">{t("cardTitle")}</h2>

      {active ? (
        <>
          <p className="mb-4 text-sm text-muted">
            {t("activeBody", {
              city,
              date: until ? format.dateTime(new Date(until), { dateStyle: "long" }) : "",
            })}
          </p>
          {error && <Notice kind="error" message={error} className="mb-3" />}
          <button
            type="button"
            onClick={handleDeactivate}
            disabled={pending}
            className="rounded-full border border-border px-4 py-2.5 text-sm font-bold text-text hover:border-teal2 hover:text-teal2 disabled:opacity-60"
          >
            {pending ? "…" : t("returnNow", { city: homeCity ?? "" })}
          </button>
        </>
      ) : (
        <>
          <p className="mb-4 text-sm text-muted">{t("cardBodyInactive")}</p>
          <div className="flex flex-col gap-3">
            <div>
              <p className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-muted">
                {t("cityLabel")}
              </p>
              <CityAutocomplete
                value={city}
                onChange={setCity}
                placeholder={t("cityPlaceholder")}
              />
            </div>
            <div>
              <p className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-muted">
                {t("durationLabel")}
              </p>
              <select
                value={durationKey}
                onChange={(e) => setDurationKey(e.target.value as typeof durationKey)}
                className="w-full rounded-lg border border-border px-3 py-2.5 text-sm outline-none focus:border-teal2"
              >
                {DURATIONS.map((d) => (
                  <option key={d.key} value={d.key}>
                    {t(d.key)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {error && <Notice kind="error" message={error} className="mt-3" />}

          <button
            type="button"
            onClick={handleActivate}
            disabled={pending || !city.trim()}
            className="mt-4 rounded-full px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60"
            style={{ backgroundImage: "var(--grad)" }}
          >
            {pending ? "…" : t("activate")}
          </button>
        </>
      )}
    </div>
  );
}
