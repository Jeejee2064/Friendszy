import { setRequestLocale } from "next-intl/server";
import { WelcomeCarousel } from "@/components/welcome/welcome-carousel";

// Intro screens shown to a signed-out visitor on their first visit (see
// proxy.ts). Always reachable directly so it can be replayed.
export default async function WelcomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <WelcomeCarousel />;
}
