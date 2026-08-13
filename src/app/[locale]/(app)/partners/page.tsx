import { redirect } from "@/i18n/navigation";

// Activities discovery merged into the Découvrir page — this route now
// only exists so old links/bookmarks still land somewhere. /partners/new
// and /partners/[id]/edit are separate route segments, untouched by this
// redirect.
export default async function PartnersPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  redirect({ href: "/discover", locale });
}
