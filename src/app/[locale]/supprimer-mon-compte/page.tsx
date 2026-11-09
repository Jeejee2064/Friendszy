import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { localeAlternates } from "@/lib/seo/site";
import { Link } from "@/i18n/navigation";

// Page PUBLIQUE (aucune session requise) : exigence Google Play « URL de
// demande de suppression de compte » du formulaire Data safety. Ne pas
// l'ajouter à protectedPaths dans proxy.ts.

const SUPPORT_EMAIL = "info@friendszy.ca";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "DeleteAccount" });
  const alternates = localeAlternates(locale, "/supprimer-mon-compte");
  return { title: t("pageTitle"), alternates, openGraph: { url: alternates.canonical } };
}

export default async function DeleteAccountPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("DeleteAccount");
  const subject = encodeURIComponent(
    locale === "en"
      ? "Friendszy account deletion"
      : locale === "es"
        ? "Eliminación de cuenta de Friendszy"
        : "Suppression de compte Friendszy"
  );

  return (
    <main className="min-h-dvh bg-bg px-6 py-16">
      <div className="mx-auto w-full max-w-2xl rounded-3xl border border-border bg-card p-8 shadow-lg sm:p-10">
        <h1 className="text-2xl font-extrabold text-text sm:text-3xl">{t("pageTitle")}</h1>
        <p className="mt-3 text-sm leading-relaxed text-text">{t("intro")}</p>

        <h2 className="mt-8 text-base font-extrabold text-dark">{t("inAppTitle")}</h2>
        <ol className="mt-2 ml-5 flex list-decimal flex-col gap-1.5 text-sm leading-relaxed text-text">
          <li>{t("inAppStep1")}</li>
          <li>{t("inAppStep2")}</li>
          <li>{t("inAppStep3")}</li>
        </ol>

        <h2 className="mt-8 text-base font-extrabold text-dark">{t("noAppTitle")}</h2>
        <p className="mt-2 text-sm leading-relaxed text-text">{t("noAppBody")}</p>
        <a
          href={`mailto:${SUPPORT_EMAIL}?subject=${subject}`}
          className="mt-4 inline-flex min-h-11 items-center justify-center rounded-full px-6 text-sm font-bold text-white"
          style={{ backgroundImage: "var(--grad)" }}
        >
          {t("noAppButton")}
        </a>
        <p className="mt-2 text-xs text-muted">{SUPPORT_EMAIL} · {t("noAppDelay")}</p>

        <h2 className="mt-8 text-base font-extrabold text-dark">{t("whatTitle")}</h2>
        <p className="mt-2 text-sm leading-relaxed text-text">
          {t.rich("whatBody", {
            link: (chunks) => (
              <Link href="/privacy" className="font-semibold text-teal-ink hover:underline">
                {chunks}
              </Link>
            ),
          })}
        </p>

        <Link
          href="/"
          className="mt-8 inline-flex min-h-11 items-center text-sm font-semibold text-teal-ink hover:underline"
        >
          ← {t("backHome")}
        </Link>
      </div>
    </main>
  );
}
