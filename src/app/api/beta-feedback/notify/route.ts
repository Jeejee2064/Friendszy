import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const DEFAULT_RECIPIENT = "jdwapp@gmail.com";
const DEFAULT_SENDER = "Friendszy <onboarding@resend.dev>";
const SCREENSHOT_LINK_TTL_SECONDS = 7 * 24 * 3600;

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Appelée par le client juste après l'insertion d'un feedback (voir
// BetaFeedbackButton). Le feedback est relu via le client authentifié, donc
// seul son auteur (ou un admin) peut déclencher l'envoi pour un id donné, et
// seules les catégories "bug" donnent lieu à un courriel.
export async function POST(request: Request) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return NextResponse.json({ sent: false, reason: "not_configured" });

  const body = await request.json().catch(() => null);
  const id = typeof body?.id === "string" ? body.id : null;
  if (!id) return NextResponse.json({ error: "bad_request" }, { status: 400 });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data: feedback } = await supabase
    .from("beta_feedback")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!feedback) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (feedback.category !== "bug") return NextResponse.json({ sent: false, reason: "not_bug" });

  const admin = createAdminClient();
  const [{ data: profile }, signed] = await Promise.all([
    admin
      .from("profiles")
      .select("full_name, last_name")
      .eq("id", feedback.user_id)
      .maybeSingle(),
    feedback.screenshot_path
      ? admin.storage
          .from("beta-feedback-screenshots")
          .createSignedUrl(feedback.screenshot_path, SCREENSHOT_LINK_TTL_SECONDS)
      : Promise.resolve({ data: null }),
  ]);

  const author =
    [profile?.full_name, profile?.last_name].filter(Boolean).join(" ") || feedback.user_id;
  const rows: [string, string][] = [
    ["Auteur", author],
    ["Page", feedback.page_url ?? "—"],
    ["Langue", feedback.locale ?? "—"],
    ["Navigateur", feedback.user_agent ?? "—"],
  ];
  if (signed.data?.signedUrl) rows.push(["Capture d'écran (lien valide 7 jours)", signed.data.signedUrl]);

  const html = `
    <h2>Nouveau rapport de bug — Friendszy</h2>
    <p style="white-space:pre-wrap">${escapeHtml(feedback.message)}</p>
    <ul>${rows
      .map(([k, v]) => `<li><strong>${escapeHtml(k)} :</strong> ${escapeHtml(v)}</li>`)
      .join("")}</ul>`;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: process.env.BUG_REPORT_FROM ?? DEFAULT_SENDER,
      to: process.env.BUG_REPORT_NOTIFY_TO ?? DEFAULT_RECIPIENT,
      subject: `[Friendszy] Nouveau bug : ${feedback.message.slice(0, 60)}`,
      html,
    }),
  });

  return NextResponse.json({ sent: res.ok }, { status: res.ok ? 200 : 502 });
}
