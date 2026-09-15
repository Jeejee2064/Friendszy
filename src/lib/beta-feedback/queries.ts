import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import type { BetaFeedback, FeedbackCategory, FeedbackStatus } from "./types";

type Client = SupabaseClient<Database>;

const SCREENSHOTS_BUCKET = "beta-feedback-screenshots";
// Long enough that an admin opening the list, then clicking a thumbnail a
// little later, doesn't hit an expired signed URL mid-session.
const SIGNED_URL_TTL_SECONDS = 3600;

// `beta_feedback.category`/`.status` are generated as plain `string` (the
// literal unions live only in the CHECK constraints, not in Postgrest's
// introspection) — casting the read-back rows to BetaFeedback narrows them
// back to FeedbackCategory/FeedbackStatus, which the DB constraint
// guarantees is safe.

export async function submitBetaFeedback(
  supabase: Client,
  params: {
    userId: string;
    category: FeedbackCategory;
    message: string;
    pageUrl: string | null;
    locale: string | null;
    userAgent: string | null;
    screenshotPath: string | null;
  }
): Promise<BetaFeedback> {
  const { data, error } = await supabase
    .from("beta_feedback")
    .insert({
      user_id: params.userId,
      category: params.category,
      message: params.message,
      page_url: params.pageUrl,
      locale: params.locale,
      user_agent: params.userAgent,
      screenshot_path: params.screenshotPath,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as BetaFeedback;
}

export async function listBetaFeedback(
  supabase: Client,
  filters?: { status?: FeedbackStatus; category?: FeedbackCategory }
): Promise<BetaFeedback[]> {
  let query = supabase.from("beta_feedback").select("*");
  if (filters?.status) query = query.eq("status", filters.status);
  if (filters?.category) query = query.eq("category", filters.category);
  const { data, error } = await query.order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as BetaFeedback[];
}

export async function updateBetaFeedbackStatus(
  supabase: Client,
  id: string,
  status: FeedbackStatus
): Promise<BetaFeedback> {
  const { data, error } = await supabase
    .from("beta_feedback")
    .update({ status })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return data as BetaFeedback;
}

// Drives the sidebar badge count, same role as countOpenReports for
// moderation (see src/lib/reports/queries.ts).
export async function countNewBetaFeedback(supabase: Client): Promise<number> {
  const { count, error } = await supabase
    .from("beta_feedback")
    .select("*", { count: "exact", head: true })
    .eq("status", "new");
  if (error) throw error;
  return count ?? 0;
}

// Bucket is private (unlike "avatars"), so there's no getPublicUrl — the
// preview shown right after upload is itself a short-lived signed URL, and
// it's `path` (not that URL) that gets persisted via submitBetaFeedback.
export async function uploadFeedbackScreenshot(
  supabase: Client,
  userId: string,
  blob: Blob
): Promise<{ path: string; previewUrl: string }> {
  const path = `${userId}/${crypto.randomUUID()}.jpg`;
  const { error } = await supabase.storage.from(SCREENSHOTS_BUCKET).upload(path, blob, {
    contentType: "image/jpeg",
  });
  if (error) throw error;

  const { data, error: signError } = await supabase.storage
    .from(SCREENSHOTS_BUCKET)
    .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
  if (signError) throw signError;

  return { path, previewUrl: data.signedUrl };
}

// One batched call for a whole admin list rather than one createSignedUrl
// per row — same "fetch once, join in memory" spirit as getProfilesByIds.
export async function getFeedbackScreenshotSignedUrls(
  supabase: Client,
  paths: string[]
): Promise<Record<string, string>> {
  if (paths.length === 0) return {};
  const { data, error } = await supabase.storage
    .from(SCREENSHOTS_BUCKET)
    .createSignedUrls(paths, SIGNED_URL_TTL_SECONDS);
  if (error) throw error;

  const urls: Record<string, string> = {};
  for (const entry of data ?? []) {
    if (entry.path && entry.signedUrl) urls[entry.path] = entry.signedUrl;
  }
  return urls;
}
