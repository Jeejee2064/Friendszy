"use client";

import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";
import { upsertMyProfile, setMyInterests } from "@/lib/profile/queries";
import type { Gender, Interest } from "@/lib/profile/types";
import { AvatarPicker } from "@/components/profile/avatar-picker";
import { GenderSelect } from "@/components/profile/gender-select";
import { InterestsGrid } from "@/components/profile/interests-grid";

type FormState = {
  fullName: string;
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
}: {
  userId: string;
  interests: Interest[];
  initial: FormState;
}) {
  const t = useTranslations("Profile");
  const tFields = useTranslations("ProfileFields");

  const [form, setForm] = useState<FormState>(initial);
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState<
    { kind: "success" | "error"; message: string } | null
  >(null);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    setNotice(null);

    if (!form.fullName.trim()) {
      setNotice({ kind: "error", message: t("errors.fullNameRequired") });
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
        avatar_url: form.avatarUrl,
        city: form.city.trim() || null,
        age: form.age,
        gender: form.gender,
        bio: form.bio.trim() || null,
      });
      await setMyInterests(supabase, userId, form.interestIds);
      setNotice({ kind: "success", message: t("saveSuccess") });
    } catch {
      setNotice({ kind: "error", message: t("saveError") });
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="p-6 md:p-10">
      <h1 className="mb-2 text-2xl font-extrabold text-text">{t("title")}</h1>

      <div className="mb-6 flex flex-col gap-2">
        <Link
          href="/friends?tab=blocked"
          className="inline-block text-sm font-semibold text-teal2 hover:underline"
        >
          🚫 {t("blockedUsersLink")}
        </Link>
        <Link
          href="/settings"
          className="inline-block text-sm font-semibold text-teal2 hover:underline"
        >
          ⚙️ {t("settingsLink")}
        </Link>
      </div>

      <form
        onSubmit={handleSave}
        className="w-full max-w-sm rounded-2xl border border-border bg-card p-8 shadow-sm"
      >
        <div className="flex flex-col items-center gap-4">
          <AvatarPicker
            userId={userId}
            value={form.avatarUrl}
            onChange={(url) => update("avatarUrl", url)}
          />
          <input
            type="text"
            required
            placeholder={tFields("fullNamePlaceholder")}
            value={form.fullName}
            onChange={(e) => update("fullName", e.target.value)}
            className="w-full rounded-lg border border-border px-3 py-2.5 text-sm outline-none focus:border-teal2"
          />
        </div>

        <div className="mt-4 flex flex-col gap-3">
          <input
            type="text"
            placeholder={tFields("cityPlaceholder")}
            value={form.city}
            onChange={(e) => update("city", e.target.value)}
            className="rounded-lg border border-border px-3 py-2.5 text-sm outline-none focus:border-teal2"
          />
          <input
            type="number"
            min={18}
            max={120}
            placeholder={tFields("agePlaceholder")}
            value={form.age ?? ""}
            onChange={(e) =>
              update("age", e.target.value ? Number(e.target.value) : null)
            }
            className="rounded-lg border border-border px-3 py-2.5 text-sm outline-none focus:border-teal2"
          />
          <GenderSelect
            value={form.gender}
            onChange={(g) => update("gender", g)}
          />
        </div>

        <div className="mt-4">
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">
            {tFields("interests")}
          </p>
          <InterestsGrid
            interests={interests}
            selectedIds={form.interestIds}
            onChange={(ids) => update("interestIds", ids)}
          />
        </div>

        <textarea
          rows={4}
          placeholder={tFields("bioPlaceholder")}
          value={form.bio}
          onChange={(e) => update("bio", e.target.value)}
          className="mt-4 w-full rounded-lg border border-border px-3 py-2.5 text-sm outline-none focus:border-teal2"
        />

        {notice && (
          <div
            className="mt-4 rounded-lg border p-3 text-sm"
            style={
              notice.kind === "success"
                ? {
                    background: "#e8f8f5",
                    borderColor: "var(--border)",
                    color: "var(--dark)",
                  }
                : {
                    background: "#fdecec",
                    borderColor: "#f3c8c8",
                    color: "#e55",
                  }
            }
          >
            {notice.message}
          </div>
        )}

        <button
          type="submit"
          disabled={pending}
          className="mt-6 w-full rounded-full py-2.5 font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
          style={{ backgroundImage: "var(--grad)" }}
        >
          {pending ? "…" : t("save")}
        </button>
      </form>
    </div>
  );
}
