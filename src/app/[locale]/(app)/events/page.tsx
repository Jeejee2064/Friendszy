import { redirect } from "@/i18n/navigation";

// Events discovery merged into the Découvrir page — this route now only
// exists so old links/bookmarks still land somewhere. /events/new and
// /events/[id] are separate route segments, untouched by this redirect.
export default async function EventsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  redirect({ href: "/discover", locale });
}
