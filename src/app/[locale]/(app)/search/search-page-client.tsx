"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  searchProfiles,
  getInterestsForProfiles,
  type SearchResult,
} from "@/lib/search/queries";
import {
  getFriendshipMap,
  sendFriendRequest,
  type FriendshipInfo,
} from "@/lib/friends/queries";
import { getOrCreateConversation } from "@/lib/messages/queries";
import { getMyInterestIds } from "@/lib/profile/queries";
import { GENDERS, type Gender, type Interest } from "@/lib/profile/types";
import { InterestAutocomplete } from "@/components/search/interest-autocomplete";
import { AgeRangeSlider, AGE_MIN, AGE_MAX } from "@/components/search/age-range-slider";
import { Modal } from "@/components/ui/modal";
import { PersonCard } from "@/components/social/person-card";

export function SearchPageClient({
  userId,
  interests,
}: {
  userId: string;
  interests: Interest[];
}) {
  const t = useTranslations("Search");
  const tFriends = useTranslations("Friends");
  const tCommon = useTranslations("Common");
  const tGender = useTranslations("Gender");
  const tFields = useTranslations("ProfileFields");
  const locale = useLocale();
  const router = useRouter();

  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [minAge, setMinAge] = useState(AGE_MIN);
  const [maxAge, setMaxAge] = useState(AGE_MAX);
  const [gender, setGender] = useState<Gender | null>(null);
  const [interestIds, setInterestIds] = useState<number[]>([]);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const [results, setResults] = useState<SearchResult[]>([]);
  const [sharedByProfile, setSharedByProfile] = useState<Map<string, number[]>>(
    new Map()
  );
  const [friendshipMap, setFriendshipMap] = useState<Map<string, FriendshipInfo>>(
    new Map()
  );
  const [myInterestIds, setMyInterestIds] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [sentIds, setSentIds] = useState<Set<string>>(new Set());
  const [messagingId, setMessagingId] = useState<string | null>(null);

  const interestLabel = (id: number) => {
    const interest = interests.find((i) => i.id === id);
    if (!interest) return "";
    return locale === "en" ? interest.label_en : interest.label_fr;
  };

  async function runSearch() {
    setLoading(true);
    const supabase = createClient();
    try {
      const [searchResults, myIds] = await Promise.all([
        searchProfiles(
          supabase,
          {
            name: name || undefined,
            city: city || undefined,
            minAge: minAge > AGE_MIN ? minAge : undefined,
            maxAge: maxAge < AGE_MAX ? maxAge : undefined,
            gender: gender ?? undefined,
            interestIds: interestIds.length > 0 ? interestIds : undefined,
          },
          userId
        ),
        myInterestIds.length > 0
          ? Promise.resolve(myInterestIds)
          : getMyInterestIds(supabase, userId),
      ]);

      setMyInterestIds(myIds);
      setResults(searchResults);

      const [shared, fMap] = await Promise.all([
        getInterestsForProfiles(
          supabase,
          searchResults.map((r) => r.id)
        ),
        getFriendshipMap(supabase, userId),
      ]);
      setSharedByProfile(shared);
      setFriendshipMap(fMap);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    runSearch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const skipInstantEffect = useRef(true);
  useEffect(() => {
    if (skipInstantEffect.current) {
      skipInstantEffect.current = false;
      return;
    }
    runSearch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [interestIds, gender]);

  const skipDebouncedEffect = useRef(true);
  useEffect(() => {
    if (skipDebouncedEffect.current) {
      skipDebouncedEffect.current = false;
      return;
    }
    const timeout = setTimeout(() => {
      runSearch();
    }, 400);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, city, minAge, maxAge]);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    runSearch();
  }

  async function handleAddFriend(targetId: string) {
    setSentIds((prev) => new Set(prev).add(targetId));
    try {
      const supabase = createClient();
      await sendFriendRequest(supabase, userId, targetId);
      setFriendshipMap((prev) => {
        const next = new Map(prev);
        next.set(targetId, { friendshipId: "", status: "pending_sent" });
        return next;
      });
    } catch {
      setSentIds((prev) => {
        const next = new Set(prev);
        next.delete(targetId);
        return next;
      });
    }
  }

  const visibleResults = results.filter((r) => {
    const status = friendshipMap.get(r.id)?.status;
    return status !== "accepted" && status !== "declined_by_them";
  });

  async function handleMessage(targetId: string) {
    setMessagingId(targetId);
    try {
      const supabase = createClient();
      const conversationId = await getOrCreateConversation(supabase, userId, targetId);
      router.push(`/messages?c=${conversationId}`);
    } finally {
      setMessagingId(null);
    }
  }

  const activeFilterCount =
    (city ? 1 : 0) +
    (gender ? 1 : 0) +
    (minAge > AGE_MIN || maxAge < AGE_MAX ? 1 : 0) +
    (interestIds.length > 0 ? 1 : 0);

  return (
    <div className="p-6 md:p-10">
      <h1 className="mb-6 text-2xl font-extrabold text-text">{t("title")}</h1>

      <form onSubmit={handleSubmit} className="mb-6 flex flex-col gap-3 sm:flex-row">
        <input
          type="text"
          placeholder={t("namePlaceholder")}
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="flex-1 rounded-lg border border-border bg-card px-3 py-2.5 text-sm outline-none focus:border-teal2"
        />
        <button
          type="button"
          onClick={() => setFiltersOpen(true)}
          className="flex shrink-0 items-center justify-center gap-2 rounded-lg border border-border bg-card px-4 py-2.5 text-sm font-bold text-text"
        >
          🔍 {t("filtersButton")}
          {activeFilterCount > 0 && (
            <span
              className="flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-xs font-bold text-white"
              style={{ backgroundImage: "var(--grad)" }}
            >
              {activeFilterCount}
            </span>
          )}
        </button>
      </form>

      <p className="mb-3 text-xs font-bold uppercase tracking-wide text-muted">
        {t("suggestedResults")}
      </p>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <AnimatePresence mode="popLayout">
          {loading ? (
            <motion.p
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="col-span-full text-center text-sm text-muted"
            >
              {t("loading")}
            </motion.p>
          ) : visibleResults.length === 0 ? (
            <motion.p
              key="empty"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="col-span-full text-center text-sm text-muted"
            >
              {t("noResults")}
            </motion.p>
          ) : (
            visibleResults.map((result) => {
              const shared = (sharedByProfile.get(result.id) ?? []).filter((id) =>
                myInterestIds.includes(id)
              );
              const info = friendshipMap.get(result.id);
              const pendingSent =
                sentIds.has(result.id) || info?.status === "pending_sent";

              return (
                <motion.div
                  key={result.id}
                  layout
                  initial={{ opacity: 0, scale: 0.9, y: 12 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ duration: 0.22, ease: "easeOut" }}
                >
                  <PersonCard
                    profile={result}
                    sharedInterests={shared.map(interestLabel)}
                    deletedUserLabel={tCommon("deletedUser")}
                    footer={
                      <div className="flex flex-col gap-2">
                        <button
                          onClick={() => handleMessage(result.id)}
                          disabled={messagingId === result.id}
                          className="w-full rounded-full px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
                          style={{ backgroundImage: "var(--grad)" }}
                        >
                          💬 {tFriends("message")}
                        </button>
                        {info?.status === "pending_received" ? (
                          <span className="text-center text-xs text-muted">
                            {tFriends("theySentYouRequest")}
                          </span>
                        ) : pendingSent ? (
                          <span className="text-center text-xs text-muted">
                            {tFriends("requestSent")}
                          </span>
                        ) : (
                          <button
                            onClick={() => handleAddFriend(result.id)}
                            className="w-full rounded-full border border-teal2 px-4 py-2 text-sm font-bold text-teal2"
                          >
                            + {tFriends("addFriend")}
                          </button>
                        )}
                      </div>
                    }
                  />
                </motion.div>
              );
            })
          )}
        </AnimatePresence>
      </div>

      <Modal open={filtersOpen} onClose={() => setFiltersOpen(false)} title={t("filtersTitle")}>
        <div className="flex max-h-[65vh] flex-col gap-5 overflow-y-auto pr-1">
          <label>
            <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-muted">
              {tFields("cityPlaceholder")}
            </span>
            <input
              type="text"
              placeholder={t("cityExample")}
              value={city}
              onChange={(e) => setCity(e.target.value)}
              className="w-full rounded-lg border border-border px-3 py-2.5 text-sm outline-none focus:border-teal2"
            />
          </label>

          <div>
            <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-muted">
              {t("ageRange")}
            </span>
            <AgeRangeSlider
              min={minAge}
              max={maxAge}
              onChange={(nextMin, nextMax) => {
                setMinAge(nextMin);
                setMaxAge(nextMax);
              }}
            />
          </div>

          <div>
            <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-muted">
              {t("genderLabel")}
            </span>
            <div className="flex flex-wrap gap-2">
              <motion.button
                type="button"
                layout
                onClick={() => setGender(null)}
                whileTap={{ scale: 0.92 }}
                animate={{ scale: gender === null ? 1.05 : 1 }}
                transition={{ type: "spring", stiffness: 500, damping: 25 }}
                className={`rounded-lg border px-3 py-2 text-sm font-semibold ${gender === null ? "text-white" : "border-border text-text"}`}
                style={
                  gender === null
                    ? { backgroundImage: "var(--grad)", borderColor: "transparent" }
                    : undefined
                }
              >
                {t("anyGender")}
              </motion.button>
              {GENDERS.map((g) => (
                <motion.button
                  key={g}
                  type="button"
                  layout
                  onClick={() => setGender(g)}
                  whileTap={{ scale: 0.92 }}
                  animate={{ scale: gender === g ? 1.05 : 1 }}
                  transition={{ type: "spring", stiffness: 500, damping: 25 }}
                  className={`rounded-lg border px-3 py-2 text-sm font-semibold ${gender === g ? "text-white" : "border-border text-text"}`}
                  style={
                    gender === g
                      ? { backgroundImage: "var(--grad)", borderColor: "transparent" }
                      : undefined
                  }
                >
                  {tGender(g)}
                </motion.button>
              ))}
            </div>
          </div>

          <div>
            <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-muted">
              {tFields("interests")}
            </span>
            <InterestAutocomplete
              interests={interests}
              selectedIds={interestIds}
              onChange={setInterestIds}
              myInterestIds={myInterestIds}
            />
          </div>
        </div>

        <button
          type="button"
          onClick={() => setFiltersOpen(false)}
          className="mt-5 w-full rounded-full py-2.5 font-bold text-white transition-opacity hover:opacity-90"
          style={{ backgroundImage: "var(--grad)" }}
        >
          {t("viewResults")}
        </button>
      </Modal>
    </div>
  );
}
