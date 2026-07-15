import { getTranslations } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { LocaleToggle } from "@/components/layout/locale-toggle";

export default async function SuspendedPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect({ href: "/login", locale });
    return null;
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("moderation_status")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile || profile.moderation_status === "active") {
    redirect({ href: "/", locale });
    return null;
  }

  const banned = profile.moderation_status === "banned";
  const t = await getTranslations("Suspended");

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 bg-bg px-6 py-16">
      <div className="w-full max-w-md rounded-3xl border border-border bg-card p-8 text-center shadow-lg">
        <div
          className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full text-2xl"
          style={{ background: "#fdecec" }}
        >
          🚫
        </div>
        <h1 className="text-2xl font-extrabold text-text">
          {banned ? t("bannedTitle") : t("suspendedTitle")}
        </h1>
        <p className="mt-3 text-sm text-muted">
          {banned ? t("bannedBody") : t("suspendedBody")}
        </p>
        <p className="mt-4 text-sm font-semibold text-teal2">
          {t("contact")}: securite@friendszy.ca
        </p>

        <div className="mt-6 flex flex-col items-center gap-3">
          <SignOutButton />
          <LocaleToggle />
        </div>
      </div>
    </main>
  );
}
