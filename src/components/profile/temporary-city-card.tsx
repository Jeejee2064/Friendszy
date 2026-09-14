"use client";

import { useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";
import { setTemporaryCity, clearTemporaryCity } from "@/lib/profile/queries";
import { CityAutocomplete } from "@/components/search/city-autocomplete";
import { Notice } from "@/components/ui/notice";

const MAX_TRIP_DAYS = 30; // mirrors set_temporary_city()'s p_until <= p_from + 30 days

function todayInputValue(): string {
  return new Date().toISOString().slice(0, 10);
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

// <input type="date"> values ("yyyy-mm-dd") parse as UTC midnight if handed
// straight to `new Date()` — in a negative-UTC-offset timezone (e.g. Québec)
// that silently shifts the picked day back by several hours. Anchor to
// local midnight/end-of-day instead so "15 sept" means 15 sept here.
function startOfLocalDay(dateStr: string): Date {
  return new Date(`${dateStr}T00:00:00`);
}
function endOfLocalDay(dateStr: string): Date {
  return new Date(`${dateStr}T23:59:59`);
}

export function TemporaryCityCard({
  homeCity,
  destination,
  from,
  until,
  onActiveChange,
}: {
  // Ville à laquelle on revient (profiles.home_city) — affichée dans l'état
  // planifié/en cours.
  homeCity: string | null;
  // Séjour actuellement en base, planifié ou déjà en cours (null si aucun) —
  // voir supabase/migrations/20260913120000_temporary_city_date_range.sql.
  destination: string | null;
  from: string | null;
  until: string | null;
  // Prévient ProfileForm pour qu'il désactive le champ ville normal tant
  // qu'un séjour existe (planifié ou en cours).
  onActiveChange?: (hasTrip: boolean) => void;
}) {
  const t = useTranslations("TemporaryCity");
  const format = useFormatter();
  const router = useRouter();

  const [hasTrip, setHasTrip] = useState(Boolean(until && new Date(until) > new Date()));
  const [city, setCity] = useState(destination ?? "");
  const [tripFrom, setTripFrom] = useState(from);
  const [tripUntil, setTripUntil] = useState(until);
  const [arrivalInput, setArrivalInput] = useState(todayInputValue());
  const [departureInput, setDepartureInput] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Un séjour peut être planifié à l'avance — tant que l'arrivée n'est pas
  // là, profiles.city n'a pas encore changé (voir set_temporary_city()).
  const hasArrived = !tripFrom || new Date(tripFrom) <= new Date();

  function setTripState(next: boolean) {
    setHasTrip(next);
    onActiveChange?.(next);
  }

  async function handleSave() {
    if (!city.trim() || !arrivalInput || !departureInput) return;
    const fromDate = startOfLocalDay(arrivalInput);
    const untilDate = endOfLocalDay(departureInput);
    if (untilDate <= fromDate) {
      setError(t("errorInvalidDates"));
      return;
    }
    setError(null);
    setPending(true);
    try {
      const supabase = createClient();
      await setTemporaryCity(supabase, city.trim(), fromDate, untilDate);
      setTripFrom(fromDate.toISOString());
      setTripUntil(untilDate.toISOString());
      setTripState(true);
      router.refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      setError(message.includes("invalid_") ? t("errorInvalidDates") : t("errorGeneric"));
    } finally {
      setPending(false);
    }
  }

  async function handleCancel() {
    setError(null);
    setPending(true);
    try {
      const supabase = createClient();
      await clearTemporaryCity(supabase);
      setTripState(false);
      setTripFrom(null);
      setTripUntil(null);
      router.refresh();
    } catch {
      setError(t("errorGeneric"));
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-6">
      <h2 className="mb-2 font-bold text-text">{t("cardTitle")}</h2>

      {hasTrip ? (
        <>
          <p className="mb-4 text-sm text-muted">
            {hasArrived
              ? t("activeBody", {
                  city,
                  date: tripUntil ? format.dateTime(new Date(tripUntil), { dateStyle: "long" }) : "",
                })
              : t("scheduledBody", {
                  city,
                  from: tripFrom ? format.dateTime(new Date(tripFrom), { dateStyle: "long" }) : "",
                  until: tripUntil ? format.dateTime(new Date(tripUntil), { dateStyle: "long" }) : "",
                })}
          </p>
          {error && <Notice kind="error" message={error} className="mb-3" />}
          <button
            type="button"
            onClick={handleCancel}
            disabled={pending}
            className="rounded-full border border-border px-4 py-2.5 text-sm font-bold text-text hover:border-teal2 hover:text-teal2 disabled:opacity-60"
          >
            {pending
              ? "…"
              : hasArrived
                ? t("returnNow", { city: homeCity ?? "" })
                : t("cancelTrip")}
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
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-muted">
                  {t("arrivalLabel")}
                </p>
                <input
                  type="date"
                  value={arrivalInput}
                  min={todayInputValue()}
                  onChange={(e) => {
                    setArrivalInput(e.target.value);
                    // Une arrivée repoussée après le départ actuellement
                    // saisi rendrait la plage invalide côté serveur.
                    if (departureInput && departureInput < e.target.value) {
                      setDepartureInput("");
                    }
                  }}
                  className="w-full rounded-lg border border-border px-3 py-2.5 text-sm outline-none focus:border-teal2"
                />
              </div>
              <div>
                <p className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-muted">
                  {t("departureLabel")}
                </p>
                <input
                  type="date"
                  value={departureInput}
                  min={arrivalInput || todayInputValue()}
                  max={addDays(arrivalInput || todayInputValue(), MAX_TRIP_DAYS)}
                  onChange={(e) => setDepartureInput(e.target.value)}
                  className="w-full rounded-lg border border-border px-3 py-2.5 text-sm outline-none focus:border-teal2"
                />
              </div>
            </div>
          </div>

          {error && <Notice kind="error" message={error} className="mt-3" />}

          <button
            type="button"
            onClick={handleSave}
            disabled={pending || !city.trim() || !arrivalInput || !departureInput}
            className="mt-4 rounded-full px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60"
            style={{ backgroundImage: "var(--grad)" }}
          >
            {pending ? "…" : t("saveTrip")}
          </button>
        </>
      )}
    </div>
  );
}
