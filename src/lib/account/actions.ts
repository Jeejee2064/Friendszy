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

  // Vide tout le dossier {userId}/ (avatar + photos supplémentaires,
  // captures d'écran de feedback), pas seulement avatar.jpg.
  for (const bucket of ["avatars", "beta-feedback-screenshots"]) {
    const { data: files } = await admin.storage.from(bucket).list(userId, { limit: 1000 });
    const paths = (files ?? []).map((f) => `${userId}/${f.name}`);
    if (paths.length > 0) await admin.storage.from(bucket).remove(paths);
  }

  const cleanup = await Promise.all([
    admin.from("profile_interests").delete().eq("profile_id", userId),
    admin.from("profile_partner_interests").delete().eq("profile_id", userId),
    admin.from("profile_photos").delete().eq("profile_id", userId),
    admin.from("profile_locations").delete().eq("profile_id", userId),
    admin.from("push_subscriptions").delete().eq("user_id", userId),
    admin.from("analytics_events").delete().eq("user_id", userId),
    admin.from("beta_feedback").delete().eq("user_id", userId),
    admin.from("friendships").delete().or(`requester_id.eq.${userId},addressee_id.eq.${userId}`),
    admin.from("blocks").delete().or(`blocker_id.eq.${userId},blocked_id.eq.${userId}`),
    admin.from("notifications").delete().eq("user_id", userId),
    admin.from("reports").update({ reporter_id: null }).eq("reporter_id", userId),
  ]);
  if (cleanup.some((r) => r.error)) return { error: "anonymize" };

  const { error: anonymizeError } = await admin
    .from("profiles")
    .update({
      full_name: null,
      last_name: null,
      username: null,
      avatar_url: null,
      bio: null,
      city: null,
      age: null,
      gender: null,
      looking_for: [],
      looking_for_other: null,
      languages: [],
    })
    .eq("id", userId);
  if (anonymizeError) return { error: "anonymize" };

  const { error: deleteUserError } = await admin.auth.admin.deleteUser(userId, true);
  if (deleteUserError) return { error: "delete_user" };

  await supabase.auth.signOut();

  redirect({ href: "/login", locale });
  return {};
}
