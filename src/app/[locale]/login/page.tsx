"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import type { AuthError, User } from "@supabase/supabase-js";
import { Link, useRouter } from "@/i18n/navigation";
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

  const [user, setUser] = useState<User | null>(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const [isRecovery, setIsRecovery] = useState(false);

  const [mode, setMode] = useState<Mode>("signIn");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [resetEmail, setResetEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");

  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState<FormNotice | null>(null);

  useEffect(() => {
    const supabase = createClient();

    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
      setLoadingUser(false);
      if (data.user) {
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
    // push() alone already fetches fresh server data for "/" — a trailing
    // refresh() here was firing a second, overlapping server round-trip and
    // could leave the transition looking stuck until an unrelated
    // navigation came along.
    router.push("/");
  }

  async function handleSignUp(e: FormEvent) {
    e.preventDefault();
    setNotice(null);
    setPending(true);
    const { error } = await signUpWithEmail(email, password);
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
    setPending(false);
    if (error) {
      reportError(t("genericError"), error);
    } else {
      setNotice({ kind: "success", message: t("resetPassword.updateSuccess") });
      setIsRecovery(false);
    }
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 bg-bg px-6 py-16">
      <div className="rounded-full bg-card p-1 shadow-sm">
        <LocaleToggle />
      </div>
      <div className="relative w-full max-w-md rounded-3xl border border-border bg-card p-8 shadow-lg">
        <Link
          href="/"
          aria-label={t("close")}
          prefetch={false}
          className="absolute right-5 top-5 text-lg text-muted hover:text-text"
        >
          ✕
        </Link>

        {!loadingUser && user ? (
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
        ) : isRecovery ? (
          <>
            <h1 className="pt-4 text-2xl font-extrabold text-text">
              {t("resetPassword.updateTitle")}
            </h1>
            <form onSubmit={handleUpdatePassword} className="mt-6 flex flex-col gap-4">
              <label>
                <FieldLabel>{t("resetPassword.newPassword")}</FieldLabel>
                <input
                  type="password"
                  required
                  className="w-full rounded-xl border border-border px-4 py-3 text-sm outline-none focus:border-teal2"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
              </label>
              <SubmitButton pending={pending}>
                {t("resetPassword.updateSubmit")}
              </SubmitButton>
            </form>
          </>
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
              <label>
                <FieldLabel>{t("signIn.password")}</FieldLabel>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-xl border border-border px-4 py-3 text-sm outline-none focus:border-teal2"
                />
              </label>

              {mode === "signIn" && (
                <button
                  type="button"
                  onClick={() => switchMode("forgot")}
                  className="-mt-2 self-end text-xs font-semibold text-teal2 hover:underline"
                >
                  {t("forgotPasswordLink")}
                </button>
              )}

              <SubmitButton pending={pending}>
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
  children,
}: {
  pending: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="submit"
      disabled={pending}
      className="mt-1 rounded-full py-3 font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
      style={{ backgroundImage: "var(--grad)" }}
    >
      {pending ? "…" : children}
    </button>
  );
}
