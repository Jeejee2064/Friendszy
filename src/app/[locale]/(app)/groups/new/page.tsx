import { redirect } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";
import { getInterests } from "@/lib/profile/queries";
import { GroupCreationWizard } from "@/components/groups/group-creation-wizard";

export default async function NewGroupPage({
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

  const interests = await getInterests(supabase);

  return <GroupCreationWizard userId={user.id} interests={interests} />;
}
