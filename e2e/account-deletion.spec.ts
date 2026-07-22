import { test, expect, type Page } from "@playwright/test";
import { localePath } from "./utils/urls";
import {
  ensureFriendship,
  seedNotification,
  seedOpenReport,
  setProfileAvatar,
  supabaseAdmin,
} from "./fixtures/db";
import { JULIE, SOPHIE, THOMAS, TEST_PASSWORD } from "./fixtures/test-users";

// This is a one-shot, destructive test: it permanently deletes (anonymizes +
// soft-deletes the auth user for) Julie Test2 and Thomas Test5. It can never
// pass again against the same accounts once run. Kept in the repo as a
// reference/template for testing account deletion with fresh disposable
// accounts later — excluded from the regular `npm run test:e2e` run via this
// guard, so the normal suite always sees it as "skipped", never "failed".
test.skip(
  !process.env.RUN_ACCOUNT_DELETION_TEST,
  "One-off destructive test — never reruns with the same accounts. Set RUN_ACCOUNT_DELETION_TEST=1 to run it explicitly."
);

async function loginAs(page: Page, email: string) {
  await page.goto(localePath("fr", "/login"));
  await page.getByLabel("Courriel").fill(email);
  await page.getByLabel("Mot de passe").fill(TEST_PASSWORD);
  await page.getByRole("button", { name: /se connecter/i }).click();
  await expect(page).toHaveURL(localePath("fr", "/"), { timeout: 40_000 });
}

async function deleteAccountViaSettings(page: Page) {
  await page.goto(localePath("fr", "/settings"));
  await page.getByRole("button", { name: "Supprimer mon compte" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByPlaceholder("SUPPRIMER").fill("SUPPRIMER");
  await dialog.getByRole("button", { name: "Supprimer définitivement" }).click();
  await expect(page).toHaveURL(localePath("fr", "/login"), { timeout: 20_000 });
}

test.describe("account deletion", () => {
  test.beforeAll(async () => {
    // Both are complete enough (full_name/city/age/gender from bulk seed)
    // except avatar_url — fill that so login lands on the dashboard/settings
    // instead of being routed into the onboarding wizard first.
    await setProfileAvatar(JULIE.id, "https://placehold.co/200x200");
    await setProfileAvatar(THOMAS.id, "https://placehold.co/200x200");

    // "Proof" data for Julie, so the post-deletion assertions demonstrate
    // actual cleanup rather than an already-empty state.
    await ensureFriendship(JULIE.id, THOMAS.id);
    await seedNotification(JULIE.id, "friend_request_accepted", {
      addressee_id: THOMAS.id,
      friendship_id: "00000000-0000-0000-0000-000000000000",
    });
    await seedOpenReport(JULIE.id, "profile", SOPHIE.id, "other: test fixture");
  });

  test("deletes and anonymizes the account (Julie)", async ({ page }) => {
    await loginAs(page, JULIE.email);
    await deleteAccountViaSettings(page);

    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name, username, avatar_url, bio, city, age, gender")
      .eq("id", JULIE.id)
      .maybeSingle();
    expect(profileError).toBeNull();
    expect(profile).not.toBeNull();
    expect(profile?.full_name).toBeNull();
    expect(profile?.username).toBeNull();
    expect(profile?.avatar_url).toBeNull();
    expect(profile?.bio).toBeNull();
    expect(profile?.city).toBeNull();
    expect(profile?.age).toBeNull();
    expect(profile?.gender).toBeNull();

    const { count: interestsCount } = await supabaseAdmin
      .from("profile_interests")
      .select("*", { count: "exact", head: true })
      .eq("profile_id", JULIE.id);
    expect(interestsCount).toBe(0);

    const { count: friendshipsCount } = await supabaseAdmin
      .from("friendships")
      .select("*", { count: "exact", head: true })
      .or(`requester_id.eq.${JULIE.id},addressee_id.eq.${JULIE.id}`);
    expect(friendshipsCount).toBe(0);

    const { count: notificationsCount } = await supabaseAdmin
      .from("notifications")
      .select("*", { count: "exact", head: true })
      .eq("user_id", JULIE.id);
    expect(notificationsCount).toBe(0);

    const { data: reports } = await supabaseAdmin
      .from("reports")
      .select("id, reporter_id, target_id")
      .eq("target_id", SOPHIE.id)
      .is("reporter_id", null);
    expect((reports ?? []).length).toBeGreaterThan(0);

    // Dismiss it so this fixture's leftover doesn't linger as an open report
    // in admin.spec.ts's moderation queue on future regular-suite runs —
    // this tidies a side artifact, not any part of Julie's actual deletion.
    const anonymizedReportIds = (reports ?? []).map((r) => r.id);
    if (anonymizedReportIds.length > 0) {
      await supabaseAdmin
        .from("reports")
        .update({ status: "dismissed" })
        .in("id", anonymizedReportIds);
    }

    // Documented rather than asserted on: the exact shape of a GoTrue
    // soft-deleted user isn't verifiable from the codebase (see plan). Log
    // what's actually returned so this is on record for next time.
    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.getUserById(
      JULIE.id
    );
    console.log("[account-deletion] auth.users state after deleteUser(id, true):", {
      error: authError?.message ?? null,
      email: authUser?.user?.email ?? null,
      deletedAt: (authUser?.user as { deleted_at?: string } | undefined)?.deleted_at ?? null,
    });

    // Same for conversations/messages — actions.ts never touches them, so
    // whatever remains reflects the DB's own FK behavior, not app logic.
    const [userA, userB] = JULIE.id < THOMAS.id ? [JULIE.id, THOMAS.id] : [THOMAS.id, JULIE.id];
    const { data: conversation } = await supabaseAdmin
      .from("conversations")
      .select("id")
      .eq("user_a", userA)
      .eq("user_b", userB)
      .maybeSingle();
    console.log("[account-deletion] conversation row after deletion:", conversation ?? null);
  });

  test("a stale second tab loses access after deletion (Thomas)", async ({ browser }) => {
    const contextA = await browser.newContext();
    const contextB = await browser.newContext();
    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();

    await loginAs(pageA, THOMAS.email);
    await loginAs(pageB, THOMAS.email);

    await deleteAccountViaSettings(pageA);

    // Stale tab B never saw the deletion — next protected navigation must
    // not show the normal authenticated dashboard. Either /login (session
    // invalidated server-side) or /onboarding (profile now anonymized/
    // incomplete) are acceptable outcomes; only the dashboard itself is not.
    await pageB.goto(localePath("fr", "/"));
    await pageB.waitForLoadState("domcontentloaded");
    console.log("[account-deletion] stale second-tab landed on:", pageB.url());
    // The normal dashboard's quick-access section must not be reachable.
    await expect(pageB.getByText("Accès rapide")).toHaveCount(0);

    await contextA.close();
    await contextB.close();
  });
});
