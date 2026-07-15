"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "@/i18n/navigation";

export async function deleteMyAccount(
  locale: string
): Promise<{ error?: "anonymize" | "delete_user" }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect({ href: "/login", locale });
    return {};
  }

  const userId = user.id;
  const admin = createAdminClient();

  await admin.storage.from("avatars").remove([`${userId}/avatar.jpg`]);

  await admin.from("profile_interests").delete().eq("profile_id", userId);

  await admin
    .from("friendships")
    .delete()
    .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`);

  await admin.from("blocks").delete().or(`blocker_id.eq.${userId},blocked_id.eq.${userId}`);

  await admin.from("notifications").delete().eq("user_id", userId);

  await admin.from("reports").update({ reporter_id: null }).eq("reporter_id", userId);

  const { error: anonymizeError } = await admin
    .from("profiles")
    .update({
      full_name: null,
      username: null,
      avatar_url: null,
      bio: null,
      city: null,
      age: null,
      gender: null,
    })
    .eq("id", userId);
  if (anonymizeError) return { error: "anonymize" };

  const { error: deleteUserError } = await admin.auth.admin.deleteUser(userId, true);
  if (deleteUserError) return { error: "delete_user" };

  await supabase.auth.signOut();

  redirect({ href: "/login", locale });
  return {};
}
