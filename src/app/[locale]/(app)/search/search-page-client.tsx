"use client";

import { useEffect, useState, type FormEvent } from "react";
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
import { InterestsGrid } from "@/components/profile/interests-grid";
import { PersonCard } from "@/components/social/person-card";
import { ReportButton } from "@/components/social/report-button";
import { BlockButton } from "@/components/social/block-button";

const AGE_BUCKETS = [
  { label: "18-28", min: 18, max: 28 },
  { label: "29-44", min: 29, max: 44 },
  { label: "45-60", min: 45, max: 60 },
  { label: "61+", min: 61, max: 120 },
] as const;

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
  const [ageBucket, setAgeBucket] = useState<(typeof AGE_BUCKETS)[number] | null>(
    null
  );
  const [gender, setGender] = useState<Gender | null>(null);
  const [interestIds, setInterestIds] = useState<number[]>([]);

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
            minAge: ageBucket?.min,
            maxAge: ageBucket?.max,
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

  function handleBlocked(targetId: string) {
    setResults((prev) => prev.filter((r) => r.id !== targetId));
  }

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

  return (
    <div className="p-6 md:p-10">
      <h1 className="mb-6 text-2xl font-extrabold text-text">{t("title")}</h1>

      <div className="flex flex-col gap-6 lg:flex-row">
        <form
          onSubmit={handleSubmit}
          className="flex shrink-0 flex-col gap-3 rounded-2xl border border-border bg-card p-6 lg:w-72"
        >
          <p className="text-sm font-bold text-text">🔍 {t("filtersTitle")}</p>
          <input
            type="text"
            placeholder={t("namePlaceholder")}
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="rounded-lg border border-border px-3 py-2.5 text-sm outline-none focus:border-teal2"
          />
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
            <div className="flex flex-wrap gap-2">
              {AGE_BUCKETS.map((bucket) => (
                <button
                  key={bucket.label}
                  type="button"
                  onClick={() =>
                    setAgeBucket((prev) => (prev?.label === bucket.label ? null : bucket))
                  }
                  className={`rounded-lg border px-3 py-2 text-sm font-semibold ${
                    ageBucket?.label === bucket.label
                      ? "text-white"
                      : "border-border text-text"
                  }`}
                  style={
                    ageBucket?.label === bucket.label
                      ? { backgroundImage: "var(--grad)", borderColor: "transparent" }
                      : undefined
                  }
                >
                  {bucket.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-muted">
              {t("genderLabel")}
            </span>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setGender(null)}
                className={`rounded-lg border px-3 py-2 text-sm font-semibold ${gender === null ? "text-white" : "border-border text-text"}`}
                style={
                  gender === null
                    ? { backgroundImage: "var(--grad)", borderColor: "transparent" }
                    : undefined
                }
              >
                {t("anyGender")}
              </button>
              {GENDERS.map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => setGender(g)}
                  className={`rounded-lg border px-3 py-2 text-sm font-semibold ${gender === g ? "text-white" : "border-border text-text"}`}
                  style={
                    gender === g
                      ? { backgroundImage: "var(--grad)", borderColor: "transparent" }
                      : undefined
                  }
                >
                  {tGender(g)}
                </button>
              ))}
            </div>
          </div>

          <InterestsGrid
            interests={interests}
            selectedIds={interestIds}
            onChange={setInterestIds}
          />

          <button
            type="submit"
            className="mt-1 rounded-full py-2.5 font-bold text-white transition-opacity hover:opacity-90"
            style={{ backgroundImage: "var(--grad)" }}
          >
            {t("submit")}
          </button>
        </form>

        <div className="flex-1">
          <p className="mb-3 text-xs font-bold uppercase tracking-wide text-muted">
            {t("suggestedResults")}
          </p>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {loading ? (
              <p className="col-span-full text-center text-sm text-muted">
                {t("loading")}
              </p>
            ) : results.length === 0 ? (
              <p className="col-span-full text-center text-sm text-muted">
                {t("noResults")}
              </p>
            ) : (
              results.map((result) => {
                const shared = (sharedByProfile.get(result.id) ?? []).filter((id) =>
                  myInterestIds.includes(id)
                );
                const info = friendshipMap.get(result.id);
                const pendingSent =
                  sentIds.has(result.id) || info?.status === "pending_sent";

                return (
                  <PersonCard
                    key={result.id}
                    profile={result}
                    sharedInterests={shared.map(interestLabel)}
                    deletedUserLabel={tCommon("deletedUser")}
                    footer={
                      <>
                        <div className="flex items-center justify-between gap-2">
                          <button
                            onClick={() => handleMessage(result.id)}
                            disabled={messagingId === result.id}
                            className="flex-1 rounded-full px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
                            style={{ backgroundImage: "var(--grad)" }}
                          >
                            💬 {tFriends("message")}
                          </button>
                          <ReportButton
                            reporterId={userId}
                            targetType="profile"
                            targetId={result.id}
                          />
                          <BlockButton
                            blockerId={userId}
                            blockedId={result.id}
                            blockedName={result.full_name}
                            onBlocked={() => handleBlocked(result.id)}
                          />
                        </div>
                        {info?.status === "accepted" ? (
                          <span className="text-xs font-semibold text-teal2">
                            {tFriends("friendsBadge")}
                          </span>
                        ) : info?.status === "pending_received" ? (
                          <span className="text-xs text-muted">
                            {tFriends("theySentYouRequest")}
                          </span>
                        ) : pendingSent ? (
                          <span className="text-xs text-muted">
                            {tFriends("requestSent")}
                          </span>
                        ) : (
                          <button
                            onClick={() => handleAddFriend(result.id)}
                            className="self-start text-xs font-semibold text-teal2 hover:underline"
                          >
                            + {tFriends("addFriend")}
                          </button>
                        )}
                      </>
                    }
                  />
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
