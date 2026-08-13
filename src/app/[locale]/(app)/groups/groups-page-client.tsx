"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  listGroups,
  getMemberCountsByGroup,
  getMyMembershipMap,
  getMyPendingJoinRequestGroupIds,
  requestToJoinGroup,
} from "@/lib/groups/queries";
import type { GroupRow, GroupCardData, GroupMemberStatus } from "@/lib/groups/types";
import type { Database } from "@/types/supabase";
import type { Interest } from "@/lib/profile/types";
import { GroupInterestSelect } from "@/components/groups/group-interest-select";
import { GroupCard } from "@/components/groups/group-card";
import { TabButton } from "@/components/ui/tab-button";

type Tab = "discover" | "mine";
type DiscoverFilterMode = "name" | "interest";

type MyGroupItem = {
  group: GroupRow;
  memberCount: number;
  preview: string | null;
};

async function fetchDiscoverGroups(
  supabase: SupabaseClient<Database>,
  userId: string,
  interests: Interest[],
  myInterestIds: number[],
  name: string,
  interestId: number | null
): Promise<GroupCardData[]> {
  const rows = await listGroups(supabase, {
    name: name.trim() || undefined,
    interestId: interestId ?? undefined,
  });
  const ids = rows.map((g) => g.id);
  const [counts, myMemberships, pendingIds] = await Promise.all([
    getMemberCountsByGroup(supabase, ids),
    getMyMembershipMap(supabase, ids, userId),
    getMyPendingJoinRequestGroupIds(supabase, ids, userId),
  ]);
  const interestById = new Map(interests.map((i) => [i.id, i]));

  const cards: GroupCardData[] = rows.map((group) => ({
    ...group,
    interest: group.interest_id != null ? (interestById.get(group.interest_id) ?? null) : null,
    memberCount: counts.get(group.id) ?? 0,
    myStatus: (myMemberships.get(group.id)?.status as GroupMemberStatus | undefined) ?? null,
    myPendingJoinRequest: pendingIds.has(group.id),
  }));

  if (interestId != null) return cards;

  // Default ranking (no explicit filter): a stable partition, not a numeric
  // sort — groups matching one of the viewer's own interests come first,
  // everything else after, each tier keeping its created_at desc order.
  const mine = cards.filter(
    (c) => c.interest_id != null && myInterestIds.includes(c.interest_id)
  );
  const rest = cards.filter(
    (c) => !(c.interest_id != null && myInterestIds.includes(c.interest_id))
  );
  return [...mine, ...rest];
}

export function GroupsPageClient({
  userId,
  interests,
  myInterestIds,
  initialDiscoverGroups,
  myGroups,
}: {
  userId: string;
  interests: Interest[];
  myInterestIds: number[];
  initialDiscoverGroups: GroupCardData[];
  myGroups: MyGroupItem[];
}) {
  const t = useTranslations("Groups");
  const [tab, setTab] = useState<Tab>("discover");
  const [filterMode, setFilterMode] = useState<DiscoverFilterMode>("name");
  const [name, setName] = useState("");
  const [interestId, setInterestId] = useState<number | null>(null);

  // Only one filter is ever active at a time — switching tabs clears the
  // other one instead of silently keeping it applied in the background.
  function handleFilterModeChange(mode: DiscoverFilterMode) {
    setFilterMode(mode);
    if (mode === "name") setInterestId(null);
    else setName("");
  }
  const [groups, setGroups] = useState<GroupCardData[]>(initialDiscoverGroups);
  const [loading, setLoading] = useState(false);
  const [requestingId, setRequestingId] = useState<string | null>(null);
  const isFirstRun = useRef(true);

  useEffect(() => {
    if (tab !== "discover") return;
    if (isFirstRun.current) {
      isFirstRun.current = false;
      return;
    }
    const timeout = setTimeout(() => {
      setLoading(true);
      const supabase = createClient();
      fetchDiscoverGroups(supabase, userId, interests, myInterestIds, name, interestId)
        .then(setGroups)
        .finally(() => setLoading(false));
    }, 400);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, name, interestId]);

  async function handleRequestJoin(groupId: string) {
    setRequestingId(groupId);
    try {
      const supabase = createClient();
      await requestToJoinGroup(supabase, groupId, userId);
      setGroups((prev) =>
        prev.map((g) => (g.id === groupId ? { ...g, myPendingJoinRequest: true } : g))
      );
    } finally {
      setRequestingId(null);
    }
  }

  return (
    <div className="overflow-x-hidden p-4 md:p-10">
      <div className="mb-6 flex items-center justify-between gap-3">
        <h1 className="text-2xl font-extrabold text-text">{t("title")}</h1>
        <Link
          href="/groups/new"
          className="shrink-0 rounded-full px-4 py-2 text-sm font-bold text-white"
          style={{ backgroundImage: "var(--grad)" }}
        >
          {/* "+ Créer un groupe" alone was wide enough to push the page past
              320px-wide viewports (shrink-0 refuses to give it up) — collapse
              to just "+" until there's room for the full label. */}
          <span className="sm:hidden">+</span>
          <span className="hidden sm:inline">+ {t("createGroup")}</span>
        </Link>
      </div>

      <div className="mb-6 flex gap-2 rounded-full bg-card p-1">
        <TabButton active={tab === "discover"} onClick={() => setTab("discover")}>
          {t("discoverTab")}
        </TabButton>
        <TabButton active={tab === "mine"} onClick={() => setTab("mine")}>
          {t("myGroupsTab")}
        </TabButton>
      </div>

      {tab === "discover" ? (
        <div className="flex flex-col gap-4">
          <div className="rounded-2xl border border-border bg-card p-3">
            <div className="mb-3 flex gap-4 border-b border-border">
              <FilterTabButton
                active={filterMode === "name"}
                onClick={() => handleFilterModeChange("name")}
              >
                🔍 {t("filterByNameTab")}
              </FilterTabButton>
              <FilterTabButton
                active={filterMode === "interest"}
                onClick={() => handleFilterModeChange("interest")}
              >
                🔍 {t("filterByInterestTab")}
              </FilterTabButton>
            </div>

            {filterMode === "name" ? (
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t("searchPlaceholder")}
                className="w-full rounded-lg border border-border bg-bg px-3 py-2.5 text-sm outline-none focus:border-teal2"
              />
            ) : (
              <GroupInterestSelect
                interests={interests}
                value={interestId}
                onChange={setInterestId}
                allowClear
                collapsible
              />
            )}
          </div>

          {loading ? (
            <p className="text-center text-sm text-muted">{t("loading")}</p>
          ) : groups.length === 0 ? (
            <p className="text-center text-sm text-muted">{t("noGroupsFound")}</p>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {groups.map((group) => (
                <GroupCard
                  key={group.id}
                  group={group}
                  onRequestJoin={handleRequestJoin}
                  requesting={requestingId === group.id}
                />
              ))}
            </div>
          )}
        </div>
      ) : myGroups.length === 0 ? (
        <p className="text-center text-sm text-muted">{t("noMyGroups")}</p>
      ) : (
        <div className="flex flex-col gap-2">
          {myGroups.map(({ group, memberCount, preview }) => (
            <Link
              key={group.id}
              href={`/groups/${group.id}`}
              className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4"
            >
              <div
                className="h-12 w-12 shrink-0 overflow-hidden rounded-full"
                style={!group.avatar_url ? { backgroundImage: "var(--grad)" } : undefined}
              >
                {group.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={group.avatar_url}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center font-bold text-white">
                    {group.name.charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-bold text-text">{group.name}</p>
                <p className="truncate text-sm text-muted">
                  {preview ?? t("memberCount", { count: memberCount })}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

// Deliberately a different shape from the shared pill-style TabButton above
// (imported from @/components/ui/tab-button, also used by the Découvrir
// page's Both/Events/Activities toggle) — that one is reserved for a page's
// actual top-level nav; this is an underline tab inside a bordered card, so
// this filter panel reads as a clearly secondary, self-contained search
// control, not another nav level.
function FilterTabButton({
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
      className={`-mb-px border-b-2 pb-2 text-sm font-bold transition-colors ${
        active ? "border-teal2 text-teal2" : "border-transparent text-muted hover:text-text"
      }`}
    >
      {children}
    </button>
  );
}
