"use client";

import { useEffect, useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { deleteMyAccount } from "@/lib/account/actions";
import { resetCookieConsent } from "@/lib/consent/cookie-consent";
import { Modal } from "@/components/ui/modal";
import { Notice } from "@/components/ui/notice";
import { usePwaInstall } from "@/lib/pwa/install-context";
import { IosInstallSteps } from "@/components/pwa/ios-install-steps";
import { useGoOffline } from "@/lib/presence/presence-context";
import { createClient } from "@/lib/supabase/client";
import { isPushSupported, subscribeToPush } from "@/lib/push/subscribe";

/**
 * The actual settings cards (PWA install, push, data export, privacy link,
 * cookie consent reset, account deletion) — no page wrapper/title, so it can
 * be dropped either into the standalone /settings page (SettingsPageClient)
 * or inline into another page's own layout (the profile edit page's
 * Paramètres tab, see profile-settings-section.tsx) without a duplicated
 * heading or double p-6/md:p-10 padding.
 */
export function SettingsSections({ locale }: { locale: string }) {
  const t = useTranslations("Settings");
  const tPrivacy = useTranslations("Privacy");
  const tCookies = useTranslations("CookieConsent");
  const goOffline = useGoOffline();
  const localeForPush = useLocale();
  const { platform, alreadyInstalled, deferredPrompt, promptInstall } = usePwaInstall();
  // Install is offered on iOS, Android *and* desktop (Chrome/Edge support
  // `beforeinstallprompt` there too) — only "other" (unrecognized mobile
  // browsers, e.g. in-app browsers) is excluded, since installability
  // there isn't reliable.
  const canInstall = platform !== "other";
  const [iosInstructionsOpen, setIosInstructionsOpen] = useState(false);
  const [pushSupported, setPushSupported] = useState(false);
  const [pushPermission, setPushPermission] = useState<NotificationPermission | null>(null);
  const [pushEnabling, setPushEnabling] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [deleteError, setDeleteError] = useState(false);
  const [isPending, startTransition] = useTransition();

  const confirmWord = t("deleteConfirmWord");
  const canDelete = confirmText.trim().toUpperCase() === confirmWord.toUpperCase();

  async function handleExport() {
    setExporting(true);
    setExportError(false);
    try {
      const response = await fetch("/api/account/export");
      if (!response.ok) throw new Error("export failed");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `friendszy-donnees-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch {
      setExportError(true);
    } finally {
      setExporting(false);
    }
  }

  function closeConfirm() {
    if (isPending) return;
    setConfirmOpen(false);
    setConfirmText("");
    setDeleteError(false);
  }

  function handleDelete() {
    setDeleteError(false);
    startTransition(async () => {
      // Untrack presence while the session is still valid — deleteMyAccount
      // signs out server-side, which races the client's own SIGNED_OUT
      // teardown of the presence channel and can leave the account looking
      // "online" to others until they refresh.
      await goOffline();
      const result = await deleteMyAccount(locale);
      if (result?.error) setDeleteError(true);
    });
  }

  function handleInstallClick() {
    if (platform === "ios") {
      setIosInstructionsOpen(true);
      return;
    }
    promptInstall();
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPushSupported(isPushSupported());
    if (typeof Notification !== "undefined") setPushPermission(Notification.permission);
  }, []);

  async function handleEnablePush() {
    // Toujours une tentative directe d'activation, même sur iPhone/iPad
    // sans installation — la marche à suivre pour installer d'abord
    // l'appli vit dans sa propre carte explicative ci-dessous, pas
    // derrière ce bouton (qui ne doit faire qu'une seule chose : essayer
    // d'activer les notifications). Le petit tuto pas-à-pas
    // (IosInstallSteps/setIosInstructionsOpen) reste réservé au bouton
    // "Installer l'application" de la carte PWA.
    setPushEnabling(true);
    try {
      // No `await` before this call — some Android Chrome builds silently
      // drop the permission request (no prompt, permission stays
      // "default" forever) if it isn't the first async step after the
      // click. subscribeToPush fetches the user id itself, after the
      // permission prompt, for exactly this reason.
      await subscribeToPush(createClient(), localeForPush);
      if (typeof Notification !== "undefined") setPushPermission(Notification.permission);
    } finally {
      setPushEnabling(false);
    }
  }

  return (
    <>
      <div className="flex w-full max-w-sm flex-col gap-4">
        {canInstall && (
          <div className="rounded-2xl border border-border bg-card p-6">
            <h2 className="mb-2 font-bold text-text">{t("pwaTitle")}</h2>
            {alreadyInstalled ? (
              <p className="text-sm font-semibold text-teal2">{t("pwaInstalledLabel")}</p>
            ) : (
              <>
                <p className="mb-4 text-sm text-muted">{t("pwaBody")}</p>
                <button
                  type="button"
                  onClick={handleInstallClick}
                  disabled={platform !== "ios" && !deferredPrompt}
                  className="rounded-full px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60"
                  style={{ backgroundImage: "var(--grad)" }}
                >
                  {t("pwaButton")}
                </button>
              </>
            )}
          </div>
        )}

        {pushSupported && (
          <div className="rounded-2xl border border-border bg-card p-6">
            <h2 className="mb-2 font-bold text-text">{t("pushTitle")}</h2>
            {pushPermission === "granted" ? (
              <p className="text-sm font-semibold text-teal2">{t("pushEnabledLabel")}</p>
            ) : pushPermission === "denied" ? (
              <p className="text-sm text-muted">{t("pushBlockedLabel")}</p>
            ) : (
              // Ce bouton ne fait toujours qu'une chose : tenter d'activer
              // les notifications (handleEnablePush) — y compris sur
              // iPhone/iPad sans installation. La marche à suivre pour
              // ceux qui en ont besoin vit dans la carte "Comment recevoir
              // des notifications ?" ci-dessous, pas ici.
              <>
                <p className="mb-4 text-sm text-muted">{t("pushBody")}</p>
                <button
                  type="button"
                  onClick={handleEnablePush}
                  disabled={pushEnabling}
                  className="rounded-full px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60"
                  style={{ backgroundImage: "var(--grad)" }}
                >
                  {pushEnabling ? "…" : t("pushButton")}
                </button>
              </>
            )}
          </div>
        )}

        {canInstall && (
          <div className="rounded-2xl border border-border bg-card p-6">
            <h2 className="mb-2 font-bold text-text">{t("pushHowToTitle")}</h2>
            {platform === "ios" ? (
              alreadyInstalled ? (
                <p className="text-sm text-muted">{t("pushHowToIosInstalled")}</p>
              ) : (
                <>
                  <p className="mb-3 text-sm text-muted">{t("pushIosNeedsInstallBody")}</p>
                  <IosInstallSteps />
                </>
              )
            ) : (
              <p className="text-sm text-muted">{t("pushHowToOther")}</p>
            )}
          </div>
        )}

        <div className="rounded-2xl border border-border bg-card p-6">
          <h2 className="mb-2 font-bold text-text">{t("exportTitle")}</h2>
          <p className="mb-4 text-sm text-muted">{t("exportBody")}</p>
          {exportError && (
            <Notice kind="error" message={t("exportError")} className="mb-3" />
          )}
          <button
            type="button"
            onClick={handleExport}
            disabled={exporting}
            className="rounded-full px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60"
            style={{ backgroundImage: "var(--grad)" }}
          >
            {exporting ? "…" : t("exportButton")}
          </button>
        </div>

        <div className="rounded-2xl border border-border bg-card p-6">
          <h2 className="mb-2 font-bold text-text">{tPrivacy("settingsCardTitle")}</h2>
          <p className="mb-4 text-sm text-muted">{tPrivacy("settingsCardBody")}</p>
          <Link
            href="/privacy"
            className="inline-block rounded-full border border-border px-4 py-2.5 text-sm font-bold text-text hover:border-teal2 hover:text-teal2"
          >
            {tPrivacy("settingsCardLink")}
          </Link>
        </div>

        <div className="rounded-2xl border border-border bg-card p-6">
          <h2 className="mb-2 font-bold text-text">{tCookies("settingsCardTitle")}</h2>
          <p className="mb-4 text-sm text-muted">{tCookies("settingsCardBody")}</p>
          <button
            type="button"
            onClick={() => {
              resetCookieConsent();
              window.location.reload();
            }}
            className="inline-block rounded-full border border-border px-4 py-2.5 text-sm font-bold text-text hover:border-teal2 hover:text-teal2"
          >
            {tCookies("settingsCardButton")}
          </button>
        </div>

        <div className="rounded-2xl border border-border bg-card p-6">
          <h2 className="mb-2 font-bold text-text">{t("deleteTitle")}</h2>
          <p className="mb-4 text-sm text-muted">{t("deleteBody")}</p>
          <button
            type="button"
            onClick={() => setConfirmOpen(true)}
            className="rounded-full px-4 py-2.5 text-sm font-bold text-white"
            style={{ background: "#e55" }}
          >
            {t("deleteButton")}
          </button>
        </div>
      </div>

      <Modal
        open={iosInstructionsOpen}
        onClose={() => setIosInstructionsOpen(false)}
        title={t("pwaTitle")}
        align="top"
      >
        <IosInstallSteps />
      </Modal>

      <Modal open={confirmOpen} onClose={closeConfirm} title={t("deleteTitle")}>
        <div className="flex flex-col gap-3">
          <p className="text-sm text-muted">{t("deleteWarning")}</p>
          <p className="text-sm text-text">
            {t("deleteConfirmPrompt", { word: confirmWord })}
          </p>
          <input
            type="text"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder={confirmWord}
            className="rounded-lg border border-border px-3 py-2.5 text-sm outline-none focus:border-teal2"
          />

          {deleteError && <Notice kind="error" message={t("deleteError")} />}

          <div className="mt-1 flex justify-end gap-2">
            <button
              type="button"
              onClick={closeConfirm}
              disabled={isPending}
              className="rounded-full border border-border px-4 py-2.5 text-sm font-semibold text-muted disabled:opacity-60"
            >
              {t("cancel")}
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={!canDelete || isPending}
              className="rounded-full px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60"
              style={{ background: "#e55" }}
            >
              {isPending ? "…" : t("deleteConfirmButton")}
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}
