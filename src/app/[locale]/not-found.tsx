import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { LocaleToggle } from "@/components/layout/locale-toggle";

export default async function NotFound() {
  const t = await getTranslations("NotFound");

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 bg-bg px-6 py-16">
      <div className="w-full max-w-md rounded-3xl border border-border bg-card p-8 text-center shadow-lg">
        <div
          className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full text-sm font-extrabold text-white"
          style={{ backgroundImage: "var(--grad)" }}
        >
          404
        </div>
        <h1 className="text-2xl font-extrabold text-text">{t("title")}</h1>
        <p className="mt-3 text-sm text-muted">{t("body")}</p>

        <div className="mt-6 flex flex-col items-center gap-3">
          <Link
            href="/"
            className="rounded-full px-6 py-2.5 text-sm font-bold text-white transition-opacity hover:opacity-90"
            style={{ backgroundImage: "var(--grad)" }}
          >
            {t("backHome")}
          </Link>
          <LocaleToggle />
        </div>
      </div>
    </main>
  );
}
