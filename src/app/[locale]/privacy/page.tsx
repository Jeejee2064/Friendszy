import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import {
  PrivacyPolicyContentFr,
  PRIVACY_POLICY_LAST_UPDATED_FR,
} from "@/content/privacy-policy.fr";
import {
  PrivacyPolicyContentEn,
  PRIVACY_POLICY_LAST_UPDATED_EN,
} from "@/content/privacy-policy.en";

export default async function PrivacyPolicyPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations("Privacy");
  const isEnglish = locale === "en";

  return (
    <main className="min-h-screen bg-bg px-6 py-16">
      <div className="mx-auto w-full max-w-2xl rounded-3xl border border-border bg-card p-8 shadow-lg sm:p-10">
        <Link href="/login" className="text-sm font-semibold text-teal2 hover:underline">
          ← {t("backLink")}
        </Link>

        <h1 className="mt-4 text-2xl font-extrabold text-text sm:text-3xl">{t("pageTitle")}</h1>
        <p className="mt-1 text-sm text-muted">
          {t("lastUpdated", {
            date: isEnglish ? PRIVACY_POLICY_LAST_UPDATED_EN : PRIVACY_POLICY_LAST_UPDATED_FR,
          })}
        </p>

        <article className="prose-privacy mt-6 flex flex-col gap-4 text-sm leading-relaxed text-text [&_h2]:mt-4 [&_h2]:text-base [&_h2]:font-extrabold [&_h2]:text-dark [&_li]:ml-5 [&_li]:list-disc [&_p]:text-text [&_strong]:font-bold [&_ul]:flex [&_ul]:flex-col [&_ul]:gap-1.5">
          {isEnglish ? <PrivacyPolicyContentEn /> : <PrivacyPolicyContentFr />}
        </article>
      </div>
    </main>
  );
}
