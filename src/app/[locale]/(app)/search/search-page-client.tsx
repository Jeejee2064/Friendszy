"use client";

import { useEffect, useState, type FormEvent, type ReactNode } from "react";
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
import { InterestPicker, MAX_SEARCH_INTERESTS } from "@/components/search/interest-picker";
import { CityAutocomplete } from "@/components/search/city-autocomplete";
import { AgeBracketPicker, type AgeBracket } from "@/components/search/age-bracket-picker";
import { Modal } from "@/components/ui/modal";
import { PersonCard } from "@/components/social/person-card";

type Tab = "name" | "discover";
type DiscoverStep = "city" | "interests" | "ageGender" | "results";

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
  const locale = useLocale();
  const router = useRouter();

  const [tab, setTab] = useState<Tab>("discover");
  const [step, setStep] = useState<DiscoverStep>("city");

  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [ageBrackets, setAgeBrackets] = useState<AgeBracket[]>([]);
  const [genders, setGenders] = useState<Gender[]>([]);
  const [interestIds, setInterestIds] = useState<number[]>([]);
  const [changeSearchOpen, setChangeSearchOpen] = useState(false);

  const [results, setResults] = useState<SearchResult[]>([]);
  const [sharedByProfile, setSharedByProfile] = useState<Map<string, number[]>>(
    new Map()
  );
  const [friendshipMap, setFriendshipMap] = useState<Map<string, FriendshipInfo>>(
    new Map()
  );
  const [myInterestIds, setMyInterestIds] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);
  const [sentIds, setSentIds] = useState<Set<string>>(new Set());
  const [messagingId, setMessagingId] = useState<string | null>(null);

  // Preloaded early (not tied to a search) so the interests step can already
  // suggest the user's own interests as quick picks.
  useEffect(() => {
    const supabase = createClient();
    getMyInterestIds(supabase, userId).then(setMyInterestIds);
  }, [userId]);

  const interestLabel = (id: number) => {
    const interest = interests.find((i) => i.id === id);
    if (!interest) return "";
    return locale === "en" ? interest.label_en : interest.label_fr;
  };

  async function applyResults(searchResults: SearchResult[]) {
    const supabase = createClient();
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
  }

  async function runNameSearch(query: string) {
    setLoading(true);
    try {
      const supabase = createClient();
      const searchResults = await searchProfiles(supabase, { name: query }, userId);
      await applyResults(searchResults);
    } finally {
      setLoading(false);
    }
  }

  async function runDiscoverSearch() {
    setLoading(true);
    try {
      const supabase = createClient();
      const searchResults = await searchProfiles(
        supabase,
        {
          city: city || undefined,
          interestIds: interestIds.length > 0 ? interestIds : undefined,
          ageRanges: ageBrackets.length > 0 ? ageBrackets : undefined,
          gender: genders.length > 0 ? genders : undefined,
        },
        userId
      );
      await applyResults(searchResults);
    } finally {
      setLoading(false);
    }
  }

  // "Par nom": no query at all while the field is empty.
  useEffect(() => {
    if (tab !== "name") return;
    if (!name.trim()) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setResults([]);
      return;
    }
    const timeout = setTimeout(() => runNameSearch(name), 400);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, name]);

  function handleTabChange(next: Tab) {
    setTab(next);
    setResults([]);
    setSharedByProfile(new Map());
    setStep("city");
  }

  function handleNameSubmit(e: FormEvent) {
    e.preventDefault();
    if (name.trim()) runNameSearch(name);
  }

  function launchDiscoverSearch() {
    setStep("results");
    runDiscoverSearch();
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
    (genders.length > 0 ? 1 : 0) + (ageBrackets.length > 0 ? 1 : 0);

  function renderResultsGrid() {
    return (
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
              const resultInterestIds = sharedByProfile.get(result.id) ?? [];
              const info = friendshipMap.get(result.id);
              const pendingSent =
                sentIds.has(result.id) || info?.status === "pending_sent";

              // In "Trouver des amis", the badges below compare each result
              // against the interests chosen for the search (interestIds),
              // not against the searcher's own profile interests — the "Par
              // nom" tab has no search interests, so it keeps the classic
              // "shared with me" line via PersonCard's own prop instead.
              const searchInterestBadges =
                tab === "discover" && interestIds.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {interestIds.map((id) => {
                      const has = resultInterestIds.includes(id);
                      return (
                        <span
                          key={id}
                          className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${
                            has ? "border-teal2 text-teal2" : "border-border text-muted"
                          }`}
                        >
                          {has ? "✓ " : ""}
                          {interestLabel(id)}
                        </span>
                      );
                    })}
                  </div>
                ) : null;

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
                    sharedInterests={
                      tab === "name"
                        ? resultInterestIds
                            .filter((id) => myInterestIds.includes(id))
                            .map(interestLabel)
                        : undefined
                    }
                    deletedUserLabel={tCommon("deletedUser")}
                    footer={
                      <div className="flex flex-col gap-2">
                        {searchInterestBadges}
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
    );
  }

  return (
    <div className="p-6 md:p-10">
      <h1 className="mb-6 text-2xl font-extrabold text-text">{t("title")}</h1>

      <div className="mb-6 flex gap-2 rounded-full bg-card p-1">
        <TabButton active={tab === "discover"} onClick={() => handleTabChange("discover")}>
          {t("discoverTab")}
        </TabButton>
        <TabButton active={tab === "name"} onClick={() => handleTabChange("name")}>
          {t("nameTab")}
        </TabButton>
      </div>

      {tab === "name" ? (
        <>
          <form onSubmit={handleNameSubmit} className="mb-6 flex flex-col gap-3 sm:flex-row">
            <input
              type="text"
              placeholder={t("namePlaceholder")}
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="flex-1 rounded-lg border border-border bg-card px-3 py-2.5 text-sm outline-none focus:border-teal2"
            />
          </form>
          {name.trim() ? (
            <>
              <p className="mb-3 text-xs font-bold uppercase tracking-wide text-muted">
                {t("suggestedResults")}
              </p>
              {renderResultsGrid()}
            </>
          ) : (
            <p className="text-center text-sm text-muted">{t("nameEmptyHint")}</p>
          )}
        </>
      ) : step === "city" ? (
        <div className="max-w-md">
          <h2 className="mb-3 text-lg font-bold text-text">{t("cityStepTitle")}</h2>
          <CityAutocomplete value={city} onChange={setCity} placeholder={t("cityExample")} />
          <button
            type="button"
            disabled={!city.trim()}
            onClick={() => setStep("interests")}
            className="mt-5 w-full rounded-full py-2.5 font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-40"
            style={{ backgroundImage: "var(--grad)" }}
          >
            {t("next")}
          </button>
        </div>
      ) : step === "interests" ? (
        <div className="max-w-md">
          <h2 className="mb-3 text-lg font-bold text-text">
            {t("interestsStepTitle", { max: MAX_SEARCH_INTERESTS })}
          </h2>
          <InterestPicker
            interests={interests}
            selectedIds={interestIds}
            onChange={setInterestIds}
            myInterestIds={myInterestIds}
          />
          {interestIds.length === 0 && (
            <p className="mt-2 text-xs text-muted">{t("interestsRequiredHint")}</p>
          )}
          <div className="mt-5 flex gap-3">
            <button
              type="button"
              onClick={() => setStep("city")}
              className="flex-1 rounded-full border border-border py-2.5 font-bold text-text"
            >
              {t("back")}
            </button>
            <button
              type="button"
              disabled={interestIds.length === 0}
              onClick={() => setStep("ageGender")}
              className="flex-1 rounded-full py-2.5 font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-40"
              style={{ backgroundImage: "var(--grad)" }}
            >
              {t("next")}
            </button>
          </div>
        </div>
      ) : step === "ageGender" ? (
        <div className="max-w-md">
          <h2 className="mb-3 text-lg font-bold text-text">{t("ageGenderStepTitle")}</h2>
          <AgeGenderFilters
            ageBrackets={ageBrackets}
            onAgeBracketsChange={setAgeBrackets}
            genders={genders}
            onGendersChange={setGenders}
            tGender={tGender}
            anyLabel={t("anyGender")}
            ageRangeLabel={t("ageRange")}
            genderLabel={t("genderLabel")}
          />
          <button
            type="button"
            onClick={launchDiscoverSearch}
            className="mb-3 mt-5 block w-full text-center text-sm font-bold text-teal2 hover:underline"
          >
            {t("skip")}
          </button>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setStep("interests")}
              className="flex-1 rounded-full border border-border py-2.5 font-bold text-text"
            >
              {t("back")}
            </button>
            <button
              type="button"
              onClick={launchDiscoverSearch}
              className="flex-1 rounded-full py-2.5 font-bold text-white transition-opacity hover:opacity-90"
              style={{ backgroundImage: "var(--grad)" }}
            >
              {t("launchSearch")}
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="mb-6 flex justify-end">
            <button
              type="button"
              onClick={() => setChangeSearchOpen(true)}
              className="flex shrink-0 items-center justify-center gap-2 rounded-lg border border-border bg-card px-4 py-2.5 text-sm font-bold text-text"
            >
              ✏️ {t("editSearch")}
              {activeFilterCount > 0 && (
                <span
                  className="flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-xs font-bold text-white"
                  style={{ backgroundImage: "var(--grad)" }}
                >
                  {activeFilterCount}
                </span>
              )}
            </button>
          </div>

          {renderResultsGrid()}

          <Modal
            open={changeSearchOpen}
            onClose={() => setChangeSearchOpen(false)}
            title={t("editSearch")}
          >
            <div className="flex max-h-[65vh] flex-col gap-5 overflow-y-auto pr-1">
              <div>
                <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-muted">
                  {t("cityStepTitle")}
                </span>
                <CityAutocomplete value={city} onChange={setCity} placeholder={t("cityExample")} />
              </div>

              <div>
                <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-muted">
                  {t("interestsStepTitle", { max: MAX_SEARCH_INTERESTS })}
                </span>
                <InterestPicker
                  interests={interests}
                  selectedIds={interestIds}
                  onChange={setInterestIds}
                  myInterestIds={myInterestIds}
                />
                {interestIds.length === 0 && (
                  <p className="mt-2 text-xs text-muted">{t("interestsRequiredHint")}</p>
                )}
              </div>

              <AgeGenderFilters
                ageBrackets={ageBrackets}
                onAgeBracketsChange={setAgeBrackets}
                genders={genders}
                onGendersChange={setGenders}
                tGender={tGender}
                anyLabel={t("anyGender")}
                ageRangeLabel={t("ageRange")}
                genderLabel={t("genderLabel")}
              />
            </div>

            <button
              type="button"
              disabled={!city.trim() || interestIds.length === 0}
              onClick={() => {
                setChangeSearchOpen(false);
                runDiscoverSearch();
              }}
              className="mt-5 w-full rounded-full py-2.5 font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-40"
              style={{ backgroundImage: "var(--grad)" }}
            >
              {t("viewResults")}
            </button>
          </Modal>
        </>
      )}
    </div>
  );
}

function AgeGenderFilters({
  ageBrackets,
  onAgeBracketsChange,
  genders,
  onGendersChange,
  tGender,
  anyLabel,
  ageRangeLabel,
  genderLabel,
}: {
  ageBrackets: AgeBracket[];
  onAgeBracketsChange: (brackets: AgeBracket[]) => void;
  genders: Gender[];
  onGendersChange: (genders: Gender[]) => void;
  tGender: (key: Gender) => string;
  anyLabel: string;
  ageRangeLabel: string;
  genderLabel: string;
}) {
  function toggleGender(g: Gender) {
    onGendersChange(
      genders.includes(g) ? genders.filter((x) => x !== g) : [...genders, g]
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-muted">
          {ageRangeLabel}
        </span>
        <AgeBracketPicker selected={ageBrackets} onChange={onAgeBracketsChange} />
      </div>

      <div>
        <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-muted">
          {genderLabel}
        </span>
        <div className="flex flex-wrap gap-2">
          <motion.button
            type="button"
            layout
            onClick={() => onGendersChange([])}
            whileTap={{ scale: 0.92 }}
            animate={{ scale: genders.length === 0 ? 1.05 : 1 }}
            transition={{ type: "spring", stiffness: 500, damping: 25 }}
            className={`rounded-lg border px-3 py-2 text-sm font-semibold ${genders.length === 0 ? "text-white" : "border-border text-text"}`}
            style={
              genders.length === 0
                ? { backgroundImage: "var(--grad)", borderColor: "transparent" }
                : undefined
            }
          >
            {anyLabel}
          </motion.button>
          {GENDERS.map((g) => {
            const selected = genders.includes(g);
            return (
              <motion.button
                key={g}
                type="button"
                layout
                onClick={() => toggleGender(g)}
                whileTap={{ scale: 0.92 }}
                animate={{ scale: selected ? 1.05 : 1 }}
                transition={{ type: "spring", stiffness: 500, damping: 25 }}
                className={`rounded-lg border px-3 py-2 text-sm font-semibold ${selected ? "text-white" : "border-border text-text"}`}
                style={
                  selected
                    ? { backgroundImage: "var(--grad)", borderColor: "transparent" }
                    : undefined
                }
              >
                {tGender(g)}
              </motion.button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 rounded-full px-4 py-2 text-sm font-bold transition-colors ${active ? "text-white" : "text-muted"}`}
      style={active ? { backgroundImage: "var(--grad)" } : undefined}
    >
      {children}
    </button>
  );
}
