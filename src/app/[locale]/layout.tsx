import type { Metadata, Viewport } from "next";
import { Nunito, Pacifico } from "next/font/google";
import { notFound } from "next/navigation";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { routing } from "@/i18n/routing";
import { ServiceWorkerRegister } from "@/components/service-worker-register";
import { PresenceProvider } from "@/lib/presence/presence-context";
import { NotificationsProvider } from "@/lib/notifications/notifications-context";
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

  return {
    title: t("title"),
    description: t("description"),
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
          <PresenceProvider>
            <NotificationsProvider>
              {children}
              <ServiceWorkerRegister />
            </NotificationsProvider>
          </PresenceProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
