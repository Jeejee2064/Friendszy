import { createClient } from "@/lib/supabase/server";
import { listBetaFeedbackWithProfiles } from "@/lib/admin/queries";
import { getFeedbackScreenshotSignedUrls } from "@/lib/beta-feedback/queries";
import { AdminBetaFeedbackClient } from "./admin-beta-feedback-client";

export default async function AdminBetaFeedbackPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Auth + is_admin are already enforced by the parent AdminLayout — user is
  // guaranteed non-null here.
  const feedback = await listBetaFeedbackWithProfiles(supabase);
  const screenshotPaths = feedback
    .map((f) => f.screenshot_path)
    .filter((path): path is string => !!path);
  const screenshotUrls = await getFeedbackScreenshotSignedUrls(supabase, screenshotPaths);

  return (
    <AdminBetaFeedbackClient
      adminId={user!.id}
      initialFeedback={feedback}
      initialScreenshotUrls={screenshotUrls}
    />
  );
}
