import type { Metadata, Viewport } from "next";
import { Nunito, Pacifico } from "next/font/google";
import { notFound } from "next/navigation";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { routing } from "@/i18n/routing";
import { SITE_URL } from "@/lib/seo/site";
import { ServiceWorkerRegister } from "@/components/service-worker-register";
import { CookieConsentBanner } from "@/components/consent/cookie-consent-banner";
import { BetaFeedbackButton } from "@/components/beta-feedback/beta-feedback-button";
import { PresenceProvider } from "@/lib/presence/presence-context";
import { NotificationsProvider } from "@/lib/notifications/notifications-context";
import { UnreadMessagesProvider } from "@/lib/messages/unread-context";
import { ActiveConversationProvider } from "@/lib/messages/active-conversation-context";
import { ToastProvider } from "@/components/ui/toast-context";
import { PwaInstallProvider } from "@/lib/pwa/install-context";
import { AnalyticsSessionPing } from "@/components/analytics/session-ping";
import "../globals.css";

const nunito = Nunito({
  variable: "--font-nunito",
  subsets: ["latin"],
  weight: ["400", "600", "700", "800", "900"],
});

const pacifico = Pacifico({
  variable: "--font-pacifico",
  subsets: ["latin"],
  weight: "400",
});

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Metadata" });

  const ogLocale = { fr: "fr_CA", en: "en_CA", es: "es_ES" }[locale] ?? "fr_CA";

  return {
    metadataBase: new URL(SITE_URL),
    title: { default: t("title"), template: "%s | Friendszy" },
    description: t("description"),
    applicationName: "Friendszy",
    openGraph: {
      type: "website",
      siteName: "Friendszy",
      title: t("title"),
      description: t("description"),
      locale: ogLocale,
      alternateLocale: ["fr_CA", "en_CA", "es_ES"].filter((l) => l !== ogLocale),
      images: [{ url: "/icons/icon-512.png", width: 512, height: 512, alt: "Friendszy" }],
    },
    twitter: {
      card: "summary",
      title: t("title"),
      description: t("description"),
      images: ["/icons/icon-512.png"],
    },
    icons: {
      icon: [
        { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
        { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      ],
      apple: "/icons/apple-touch-icon.png",
    },
    appleWebApp: {
      capable: true,
      statusBarStyle: "default",
      title: "Friendszy",
    },
  };
}

export const viewport: Viewport = {
  themeColor: "#1ecfb0",
};

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }
  setRequestLocale(locale);

  return (
    <html lang={locale} className={`${nunito.variable} ${pacifico.variable}`}>
      <body className="min-h-screen antialiased">
        <NextIntlClientProvider>
          <PwaInstallProvider>
            <ToastProvider>
              <PresenceProvider>
                <ActiveConversationProvider>
                  <NotificationsProvider>
                    <UnreadMessagesProvider>
                      {children}
                      <ServiceWorkerRegister />
                      <CookieConsentBanner />
                      <BetaFeedbackButton />
                      <AnalyticsSessionPing />
                    </UnreadMessagesProvider>
                  </NotificationsProvider>
                </ActiveConversationProvider>
              </PresenceProvider>
            </ToastProvider>
          </PwaInstallProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
