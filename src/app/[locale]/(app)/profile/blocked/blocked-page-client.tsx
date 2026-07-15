"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import {
  listBlockedProfiles,
  unblockUser,
  type BlockedProfile,
} from "@/lib/blocks/queries";
import { Notice } from "@/components/ui/notice";

export function BlockedPageClient({ userId }: { userId: string }) {
  const t = useTranslations("Blocked");
  const [profiles, setProfiles] = useState<BlockedProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [unblockError, setUnblockError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setLoadError(false);
      try {
        const supabase = createClient();
        const list = await listBlockedProfiles(supabase);
        if (!cancelled) setProfiles(list);
      } catch {
        if (!cancelled) setLoadError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleUnblock(blockedId: string) {
    setBusyId(blockedId);
    setUnblockError(false);
    try {
      const supabase = createClient();
      await unblockUser(supabase, userId, blockedId);
      setProfiles((prev) => prev.filter((p) => p.id !== blockedId));
    } catch {
      setUnblockError(true);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="p-6 md:p-10">
      <h1 className="mb-6 text-2xl font-extrabold text-text">{t("title")}</h1>

      {unblockError && (
        <Notice kind="error" message={t("unblockError")} className="mb-4 max-w-md" />
      )}

      {loading ? (
        <p className="text-center text-sm text-muted">{t("loading")}</p>
      ) : loadError ? (
        <Notice kind="error" message={t("loadError")} className="max-w-md" />
      ) : profiles.length === 0 ? (
        <p className="text-center text-sm text-muted">{t("empty")}</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {profiles.map((profile) => (
            <div
              key={profile.id}
              className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4"
            >
              <div
                className="h-12 w-12 shrink-0 overflow-hidden rounded-full"
                style={
                  !profile.avatar_url ? { backgroundImage: "var(--grad)" } : undefined
                }
              >
                {profile.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={profile.avatar_url}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-sm font-bold text-white">
                    {(profile.full_name ?? "?").charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-bold text-text">{profile.full_name}</p>
                {profile.city && (
                  <p className="truncate text-sm text-muted">{profile.city}</p>
                )}
              </div>
              <button
                type="button"
                disabled={busyId === profile.id}
                onClick={() => handleUnblock(profile.id)}
                className="shrink-0 rounded-full border border-border px-3 py-2 text-sm font-semibold text-teal2 disabled:opacity-60"
              >
                {t("unblock")}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
