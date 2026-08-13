"use client";

import { useEffect, useId, useState, type FormEvent } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { AuthError, User } from "@supabase/supabase-js";
import { getPathname, Link, useRouter } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";
import { LocaleToggle } from "@/components/layout/locale-toggle";
import {
  signUpWithEmail,
  signInWithEmail,
  signOutUser,
  requestPasswordReset,
  updatePassword,
} from "@/lib/auth";

type Mode = "signIn" | "signUp" | "forgot";

type FormNotice =
  | { kind: "error"; message: string; raw?: string }
  | { kind: "success"; message: string };

function initialsFromEmail(email: string | null | undefined) {
  return (email ?? "?").charAt(0).toUpperCase();
}

export default function LoginPage() {
  const t = useTranslations("Auth");
  const router = useRouter();
  const locale = useLocale();

  const [user, setUser] = useState<User | null>(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const [isRecovery, setIsRecovery] = useState(false);

  const [mode, setMode] = useState<Mode>("signIn");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [resetEmail, setResetEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [privacyAccepted, setPrivacyAccepted] = useState(false);

  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState<FormNotice | null>(null);

  useEffect(() => {
    const supabase = createClient();

    // The reset-password email link lands here via /auth/callback, which
    // already exchanged the code for a real session server-side — by the
    // time this effect runs, getUser() below resolves with a logged-in
    // user just like a normal sign-in, and PASSWORD_RECOVERY may never
    // fire client-side. The "?recovery=1" marker (added by
    // requestPasswordReset's redirectTo) is what actually tells us to show
    // the new-password screen instead of bouncing to "/".
    const isRecoveryLink =
      new URLSearchParams(window.location.search).get("recovery") === "1";
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (isRecoveryLink) setIsRecovery(true);

    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
      setLoadingUser(false);
      if (data.user && !isRecoveryLink) {
        router.replace("/");
      }
    });

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
      if (event === "PASSWORD_RECOVERY") {
        setIsRecovery(true);
      }
      // No redirect here on a fresh sign-in: handleSignIn already pushes to
      // "/" itself. Also redirecting from this listener raced with that
      // explicit push (two competing navigations landing back-to-back) and
      // left the router stuck until an unrelated navigation (e.g. the
      // locale toggle) came along and reset it.
    });

    return () => listener.subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function switchMode(next: Mode) {
    setMode(next);
    setNotice(null);
  }

  function reportError(friendlyMessage: string, error: AuthError | null) {
    setNotice({ kind: "error", message: friendlyMessage, raw: error?.message });
  }

  async function handleSignIn(e: FormEvent) {
    e.preventDefault();
    setNotice(null);
    setPending(true);
    const { error } = await signInWithEmail(email, password);
    if (error) {
      setPending(false);
      reportError(t("signIn.error"), error);
      return;
    }
    // Hard navigation, not router.push(): the App Router's client-side
    // router cache can otherwise reuse whatever account was previously
    // signed in on this browser for shared layout data (e.g. the sidebar's
    // name/avatar), while page-level data loads fresh — a mismatched,
    // mixed-account view. A full reload guarantees nothing carries over.
    window.location.href = getPathname({ href: "/", locale });
  }

  async function handleSignUp(e: FormEvent) {
    e.preventDefault();
    setNotice(null);
    // Defense in depth: the submit button is already disabled until this is
    // checked, but don't rely on that alone.
    if (!privacyAccepted) {
      setNotice({ kind: "error", message: t("privacyRequired") });
      return;
    }
    setPending(true);
    const { error } = await signUpWithEmail(email, password, new Date().toISOString());
    setPending(false);
    if (error) {
      reportError(t("signUp.error"), error);
    } else {
      setNotice({ kind: "success", message: t("signUp.success") });
    }
  }

  async function handleResetRequest(e: FormEvent) {
    e.preventDefault();
    setNotice(null);
    setPending(true);
    const { error } = await requestPasswordReset(resetEmail);
    setPending(false);
    if (error) {
      reportError(t("genericError"), error);
    } else {
      setNotice({ kind: "success", message: t("resetPassword.requestSuccess") });
    }
  }

  async function handleUpdatePassword(e: FormEvent) {
    e.preventDefault();
    setNotice(null);
    setPending(true);
    const { error } = await updatePassword(newPassword);
    if (error) {
      setPending(false);
      reportError(t("genericError"), error);
      return;
    }
    // Same hard-navigation rationale as handleSignIn: the recovery flow
    // already leaves the user with a valid session at this point, so send
    // them straight into the app instead of dropping them on the generic
    // "already signed in" screen after they just set a new password.
    window.location.href = getPathname({ href: "/", locale });
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 bg-bg px-6 py-16">
      <div className="rounded-full bg-card p-1 shadow-sm">
        <LocaleToggle alwaysExpanded />
      </div>
      <div className="relative w-full max-w-md rounded-3xl border border-border bg-card p-8 shadow-lg">
        <button
          type="button"
          onClick={() => {
            // "/" requires auth (see proxy.ts), so navigating there while
            // signed out just bounces the middleware back to /login in its
            // default mode — which reads as "the X does nothing" from the
            // forgot-password / recovery screens. Closing those sub-flows
            // in place is what the user actually expects here.
            if (user) {
              router.replace("/");
            } else {
              setIsRecovery(false);
              switchMode("signIn");
            }
          }}
          aria-label={t("close")}
          className="absolute right-5 top-5 text-lg text-muted hover:text-text"
        >
          ✕
        </button>

        {isRecovery ? (
          <>
            <h1 className="pt-4 text-2xl font-extrabold text-text">
              {t("resetPassword.updateTitle")}
            </h1>
            <form onSubmit={handleUpdatePassword} className="mt-6 flex flex-col gap-4">
              <PasswordField
                label={t("resetPassword.newPassword")}
                value={newPassword}
                onChange={setNewPassword}
                showLabel={t("showPassword")}
                hideLabel={t("hidePassword")}
              />
              <SubmitButton pending={pending}>
                {t("resetPassword.updateSubmit")}
              </SubmitButton>
            </form>
          </>
        ) : !loadingUser && user ? (
          <div className="pt-4 text-center">
            <div
              className="mx-auto flex h-16 w-16 items-center justify-center rounded-full text-2xl font-bold text-white"
              style={{ backgroundImage: "var(--grad)" }}
            >
              {initialsFromEmail(user.email)}
            </div>
            <p className="mt-4 font-bold text-text">{user.email}</p>
            <button
              onClick={() => signOutUser()}
              className="mt-6 w-full rounded-full py-2.5 font-bold text-white transition-opacity hover:opacity-90"
              style={{ backgroundImage: "var(--grad)" }}
            >
              {t("signOut.submit")}
            </button>
          </div>
        ) : loadingUser ? (
          <p className="pt-4 text-center text-sm text-muted">{t("loadingSession")}</p>
        ) : mode === "forgot" ? (
          <>
            <h1 className="pt-4 text-2xl font-extrabold text-text">
              {t("resetPassword.requestTitle")}
            </h1>
            <form onSubmit={handleResetRequest} className="mt-6 flex flex-col gap-4">
              <label>
                <FieldLabel>{t("resetPassword.email")}</FieldLabel>
                <input
                  type="email"
                  required
                  placeholder={t("emailExample")}
                  className="w-full rounded-xl border border-border px-4 py-3 text-sm outline-none focus:border-teal2"
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                />
              </label>
              <SubmitButton pending={pending}>
                {t("resetPassword.requestSubmit")}
              </SubmitButton>
            </form>
            <button
              onClick={() => switchMode("signIn")}
              className="mt-4 text-sm font-semibold text-teal2 hover:underline"
            >
              {t("backToSignIn")}
            </button>
          </>
        ) : (
          <>
            <div className="mb-6 flex border-b border-border">
              <AuthTab active={mode === "signIn"} onClick={() => switchMode("signIn")}>
                🔑 {t("signIn.title")}
              </AuthTab>
              <AuthTab active={mode === "signUp"} onClick={() => switchMode("signUp")}>
                ☀️ {t("signUp.tabLabel")}
              </AuthTab>
            </div>

            <h1 className="text-2xl font-extrabold text-text">
              {mode === "signIn" ? t("signIn.welcomeTitle") : t("signUp.welcomeTitle")}
            </h1>
            <p className="mt-1 text-sm text-muted">
              {mode === "signIn"
                ? t("signIn.welcomeSubtitle")
                : t("signUp.welcomeSubtitle")}
            </p>

            <form
              onSubmit={mode === "signIn" ? handleSignIn : handleSignUp}
              className="mt-6 flex flex-col gap-4"
            >
              <label>
                <FieldLabel>{t("signIn.email")}</FieldLabel>
                <input
                  type="email"
                  required
                  placeholder={t("emailExample")}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-xl border border-border px-4 py-3 text-sm outline-none focus:border-teal2"
                />
              </label>
              <PasswordField
                label={t("signIn.password")}
                value={password}
                onChange={setPassword}
                showLabel={t("showPassword")}
                hideLabel={t("hidePassword")}
              />

              {mode === "signIn" && (
                <button
                  type="button"
                  onClick={() => switchMode("forgot")}
                  className="-mt-2 self-end text-xs font-semibold text-teal2 hover:underline"
                >
                  {t("forgotPasswordLink")}
                </button>
              )}

              {mode === "signUp" && (
                <label className="flex items-start gap-2 text-sm text-muted">
                  <input
                    type="checkbox"
                    checked={privacyAccepted}
                    onChange={(e) => setPrivacyAccepted(e.target.checked)}
                    className="mt-0.5 h-4 w-4 shrink-0 accent-teal2"
                  />
                  <span>
                    {t.rich("privacyConsent", {
                      link: (chunks) => (
                        <Link
                          href="/privacy"
                          target="_blank"
                          className="font-semibold text-teal2 hover:underline"
                        >
                          {chunks}
                        </Link>
                      ),
                    })}
                  </span>
                </label>
              )}

              <SubmitButton
                pending={pending}
                disabled={mode === "signUp" && !privacyAccepted}
              >
                {mode === "signIn" ? t("signIn.submit") : t("signUp.submit")} →
              </SubmitButton>
            </form>

            <p className="mt-5 text-center text-sm text-muted">
              {mode === "signIn" ? (
                <>
                  {t("switchToSignUp")}{" "}
                  <button
                    onClick={() => switchMode("signUp")}
                    className="font-semibold text-teal2 hover:underline"
                  >
                    {t("switchToSignUpLink")}
                  </button>
                </>
              ) : (
                <>
                  {t("switchToSignIn")}{" "}
                  <button
                    onClick={() => switchMode("signIn")}
                    className="font-semibold text-teal2 hover:underline"
                  >
                    {t("switchToSignInLink")}
                  </button>
                </>
              )}
            </p>
          </>
        )}

        {notice && (
          <div
            className="mt-4 rounded-lg border p-3 text-sm"
            style={
              notice.kind === "success"
                ? { background: "#e8f8f5", borderColor: "var(--border)", color: "var(--dark)" }
                : { background: "#fdecec", borderColor: "#f3c8c8", color: "#e55" }
            }
          >
            <p>{notice.message}</p>
            {notice.kind === "error" && notice.raw && (
              <p className="mt-1 text-xs opacity-70">
                {t("errorDetail")}: {notice.raw}
              </p>
            )}
          </div>
        )}
      </div>
    </main>
  );
}

function PasswordField({
  label,
  value,
  onChange,
  showLabel,
  hideLabel,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  showLabel: string;
  hideLabel: string;
}) {
  const [visible, setVisible] = useState(false);
  // Explicit htmlFor/id instead of implicitly wrapping the input in a
  // <label> — the show/hide button used to live inside that label too,
  // which browsers fold into the input's accessible name (it was reading
  // as "Mot de passe Afficher le mot de passe"), breaking anything
  // targeting the field by its label text, screen readers included.
  const inputId = useId();
  return (
    <div>
      <label htmlFor={inputId}>
        <FieldLabel>{label}</FieldLabel>
      </label>
      <div className="relative">
        <input
          id={inputId}
          type={visible ? "text" : "password"}
          required
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-xl border border-border px-4 py-3 pr-11 text-sm outline-none focus:border-teal2"
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? hideLabel : showLabel}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-text"
        >
          {visible ? <EyeOffIcon /> : <EyeIcon />}
        </button>
      </div>
    </div>
  );
}

function EyeIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M1.5 12S5 5 12 5s10.5 7 10.5 7-3.5 7-10.5 7S1.5 12 1.5 12Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 3l18 18" />
      <path d="M10.6 5.1A10.9 10.9 0 0 1 12 5c7 0 10.5 7 10.5 7a13.9 13.9 0 0 1-3.1 4.1M6.6 6.6C3.4 8.6 1.5 12 1.5 12s3.5 7 10.5 7c1.4 0 2.7-.3 3.9-.7" />
      <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
    </svg>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-teal2">
      {children}
    </span>
  );
}

function AuthTab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`-mb-px flex-1 border-b-2 pb-3 text-sm font-bold transition-colors ${
        active ? "border-teal2 text-teal2" : "border-transparent text-muted"
      }`}
    >
      {children}
    </button>
  );
}

function SubmitButton({
  pending,
  disabled = false,
  children,
}: {
  pending: boolean;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="submit"
      disabled={pending || disabled}
      className="mt-1 rounded-full py-3 font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
      style={{ backgroundImage: "var(--grad)" }}
    >
      {pending ? "…" : children}
    </button>
  );
}
