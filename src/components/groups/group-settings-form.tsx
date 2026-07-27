"use client";

import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";
import { updateGroupSettings, deleteGroup, uploadGroupAvatar } from "@/lib/groups/queries";
import type { GroupInvitePermission, GroupMemberRole } from "@/lib/groups/types";
import type { Interest } from "@/lib/profile/types";
import { AvatarPicker } from "@/components/profile/avatar-picker";
import { GroupInterestSelect } from "@/components/groups/group-interest-select";
import { Modal } from "@/components/ui/modal";
import { Notice } from "@/components/ui/notice";

type FormState = {
  name: string;
  description: string;
  avatarUrl: string | null;
  interestId: number | null;
  invitePermission: GroupInvitePermission;
};

export function GroupSettingsForm({
  groupId,
  myRole,
  interests,
  initial,
}: {
  groupId: string;
  myRole: GroupMemberRole;
  interests: Interest[];
  initial: FormState;
}) {
  const t = useTranslations("Groups");
  const router = useRouter();
  const [form, setForm] = useState<FormState>(initial);
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState<{ kind: "success" | "error"; message: string } | null>(
    null
  );

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [deleteError, setDeleteError] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const confirmWord = t("deleteConfirmWord");
  const canDelete = confirmText.trim().toUpperCase() === confirmWord.toUpperCase();

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    setNotice(null);

    if (!form.name.trim()) {
      setNotice({ kind: "error", message: t("errors.nameRequired") });
      return;
    }
    if (form.interestId == null) {
      setNotice({ kind: "error", message: t("errors.interestRequired") });
      return;
    }

    setPending(true);
    try {
      const supabase = createClient();
      await updateGroupSettings(supabase, groupId, {
        name: form.name.trim(),
        description: form.description.trim() || null,
        avatar_url: form.avatarUrl,
        interest_id: form.interestId,
        invite_permission: form.invitePermission,
      });
      setNotice({ kind: "success", message: t("saveSuccess") });
      router.refresh();
    } catch {
      setNotice({ kind: "error", message: t("saveError") });
    } finally {
      setPending(false);
    }
  }

  function closeConfirm() {
    if (deleting) return;
    setConfirmOpen(false);
    setConfirmText("");
    setDeleteError(false);
  }

  async function handleDelete() {
    setDeleteError(false);
    setDeleting(true);
    try {
      const supabase = createClient();
      await deleteGroup(supabase, groupId);
      router.push("/groups");
      router.refresh();
    } catch {
      setDeleteError(true);
      setDeleting(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <form
        onSubmit={handleSave}
        className="w-full max-w-sm rounded-2xl border border-border bg-card p-8 shadow-sm"
      >
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

        <div className="mt-4">
          <GroupInterestSelect
            interests={interests}
            value={form.interestId}
            onChange={(id) => update("interestId", id)}
          />
        </div>

        <div className="mt-4">
          <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-muted">
            {t("invitePermissionLabel")}
          </p>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => update("invitePermission", "all_members")}
              className={`rounded-lg border px-3 py-2 text-sm font-semibold transition-colors ${
                form.invitePermission === "all_members" ? "text-white" : "border-border text-text"
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
                form.invitePermission === "admins_only" ? "text-white" : "border-border text-text"
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

        {notice && <Notice kind={notice.kind} message={notice.message} className="mt-4" />}

        <button
          type="submit"
          disabled={pending}
          className="mt-6 w-full rounded-full py-2.5 font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
          style={{ backgroundImage: "var(--grad)" }}
        >
          {pending ? "…" : t("save")}
        </button>
      </form>

      {myRole === "creator" && (
        <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-6">
          <h2 className="mb-2 font-bold text-text">{t("deleteGroupTitle")}</h2>
          <p className="mb-4 text-sm text-muted">{t("deleteGroupBody")}</p>
          <button
            type="button"
            onClick={() => setConfirmOpen(true)}
            className="rounded-full px-4 py-2.5 text-sm font-bold text-white"
            style={{ background: "#e55" }}
          >
            {t("deleteGroupButton")}
          </button>
        </div>
      )}

      <Modal open={confirmOpen} onClose={closeConfirm} title={t("deleteGroupTitle")}>
        <div className="flex flex-col gap-3">
          <p className="text-sm text-muted">{t("deleteGroupWarning")}</p>
          <p className="text-sm text-text">{t("deleteConfirmPrompt", { word: confirmWord })}</p>
          <input
            type="text"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder={confirmWord}
            className="rounded-lg border border-border px-3 py-2.5 text-sm outline-none focus:border-teal2"
          />

          {deleteError && <Notice kind="error" message={t("deleteGroupError")} />}

          <div className="mt-1 flex justify-end gap-2">
            <button
              type="button"
              onClick={closeConfirm}
              disabled={deleting}
              className="rounded-full border border-border px-4 py-2.5 text-sm font-semibold text-muted disabled:opacity-60"
            >
              {t("cancel")}
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={!canDelete || deleting}
              className="rounded-full px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60"
              style={{ background: "#e55" }}
            >
              {deleting ? "…" : t("deleteGroupConfirmButton")}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
