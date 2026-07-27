"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";
import { createGroup, uploadGroupAvatar } from "@/lib/groups/queries";
import type { GroupInvitePermission } from "@/lib/groups/types";
import type { Interest } from "@/lib/profile/types";
import { AvatarPicker } from "@/components/profile/avatar-picker";
import { GroupInterestSelect } from "@/components/groups/group-interest-select";

type FormState = {
  name: string;
  description: string;
  avatarUrl: string | null;
  interestId: number | null;
  invitePermission: GroupInvitePermission;
};

const STEP_COUNT = 3;

export function GroupCreationWizard({
  userId,
  interests,
}: {
  userId: string;
  interests: Interest[];
}) {
  const t = useTranslations("Groups");
  const router = useRouter();
  const [groupId] = useState(() => crypto.randomUUID());
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormState>({
    name: "",
    description: "",
    avatarUrl: null,
    interestId: null,
    invitePermission: "all_members",
  });
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function validateStep(): string | null {
    if (step === 0 && !form.name.trim()) return t("errors.nameRequired");
    if (step === 1 && form.interestId == null) return t("errors.interestRequired");
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

  async function handleCreate() {
    if (form.interestId == null) return;
    setPending(true);
    setError(null);
    try {
      const supabase = createClient();
      await createGroup(
        supabase,
        {
          id: groupId,
          name: form.name.trim(),
          description: form.description.trim() || null,
          avatar_url: form.avatarUrl,
          interest_id: form.interestId,
          invite_permission: form.invitePermission,
        },
        userId
      );
      router.push(`/groups/${groupId}`);
    } catch {
      setError(t("errors.createFailed"));
      setPending(false);
    }
  }

  const stepTitles = [t("steps.basics"), t("steps.interest"), t("steps.review")];

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
          <div className="flex flex-col items-center gap-4">
            <AvatarPicker
              upload={(blob) => uploadGroupAvatar(createClient(), groupId, blob)}
              value={form.avatarUrl}
              onChange={(url) => update("avatarUrl", url)}
            />
            <input
              type="text"
              required
              placeholder={t("namePlaceholder")}
              value={form.name}
              onChange={(e) => update("name", e.target.value)}
              className="w-full rounded-lg border border-border px-3 py-2.5 text-sm outline-none focus:border-teal2"
            />
            <textarea
              rows={3}
              placeholder={t("descriptionPlaceholder")}
              value={form.description}
              onChange={(e) => update("description", e.target.value)}
              className="w-full rounded-lg border border-border px-3 py-2.5 text-sm outline-none focus:border-teal2"
            />
          </div>
        )}

        {step === 1 && (
          <GroupInterestSelect
            interests={interests}
            value={form.interestId}
            onChange={(id) => update("interestId", id)}
          />
        )}

        {step === 2 && (
          <div className="flex flex-col gap-4">
            <div>
              <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-muted">
                {t("invitePermissionLabel")}
              </p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => update("invitePermission", "all_members")}
                  className={`rounded-lg border px-3 py-2 text-sm font-semibold transition-colors ${
                    form.invitePermission === "all_members"
                      ? "text-white"
                      : "border-border text-text"
                  }`}
                  style={
                    form.invitePermission === "all_members"
                      ? { backgroundImage: "var(--grad)", borderColor: "transparent" }
                      : undefined
                  }
                >
                  {t("inviteAllMembers")}
                </button>
                <button
                  type="button"
                  onClick={() => update("invitePermission", "admins_only")}
                  className={`rounded-lg border px-3 py-2 text-sm font-semibold transition-colors ${
                    form.invitePermission === "admins_only"
                      ? "text-white"
                      : "border-border text-text"
                  }`}
                  style={
                    form.invitePermission === "admins_only"
                      ? { backgroundImage: "var(--grad)", borderColor: "transparent" }
                      : undefined
                  }
                >
                  {t("inviteAdminsOnly")}
                </button>
              </div>
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
            onClick={step === STEP_COUNT - 1 ? handleCreate : goNext}
            disabled={pending}
            className="rounded-full px-6 py-2.5 font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
            style={{ backgroundImage: "var(--grad)" }}
          >
            {pending ? "…" : step === STEP_COUNT - 1 ? t("create") : t("next")}
          </button>
        </div>
      </div>
    </main>
  );
}
