"use client";

import { useState, type FormEvent } from "react";
import { useLocale, useTranslations } from "next-intl";
import { getPathname } from "@/i18n/navigation";

export default function AdminGatePage() {
  const t = useTranslations("Admin.gate");
  const locale = useLocale();
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(false);
    const response = await fetch("/api/admin/gate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    if (response.ok) {
      // Hard navigation so the middleware re-evaluates the freshly-set
      // cookie on the next request instead of relying on client router
      // cache.
      window.location.href = getPathname({ href: "/admin", locale });
      return;
    }
    setPending(false);
    setError(true);
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 bg-bg px-6 py-16">
      <div className="w-full max-w-sm rounded-3xl border border-border bg-card p-8 shadow-lg">
        <h1 className="text-2xl font-extrabold text-text">{t("title")}</h1>
        <p className="mt-1 text-sm text-muted">{t("subtitle")}</p>

        <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
          <label>
            <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-teal2">
              {t("passwordLabel")}
            </span>
            <input
              type="password"
              required
              autoFocus
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border border-border px-4 py-3 text-sm outline-none focus:border-teal2"
            />
          </label>

          <button
            type="submit"
            disabled={pending}
            className="mt-1 rounded-full py-3 font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
            style={{ backgroundImage: "var(--grad)" }}
          >
            {pending ? "…" : t("submit")}
          </button>
        </form>

        {error && (
          <div
            className="mt-4 rounded-lg border p-3 text-sm"
            style={{ background: "#fdecec", borderColor: "#f3c8c8", color: "#e55" }}
          >
            {t("error")}
          </div>
        )}
      </div>
    </main>
  );
}
