import type { Metadata } from "next";
import type { ReactNode } from "react";
import { getTranslations } from "next-intl/server";
import { localeAlternates } from "@/lib/seo/site";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Metadata" });
  const alternates = localeAlternates(locale, "/login");
  return { title: t("loginTitle"), alternates, openGraph: { url: alternates.canonical } };
}

export default function LoginLayout({ children }: { children: ReactNode }) {
  return children;
}
