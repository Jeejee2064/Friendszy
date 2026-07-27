import { test, expect, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import ws from "ws";
import { localePath } from "./utils/urls";
import { personCard, groupCard } from "./utils/selectors";
import { ALEX, SAMUEL, CAMILLE, ANTOINE, TEST_PASSWORD } from "./fixtures/test-users";
import {
  ensureFriendship,
  resetRelationship,
  setProfileInterests,
  seedGroup,
  deleteGroups,
  resetGroupsForCreators,
  seedJoinRequest,
  seedGroupMessage,
  getInterestId,
  supabaseAdmin,
} from "./fixtures/db";

// MemberList rows and JoinRequestQueue rows share this exact wrapper class —
// only one of the two tabs is ever mounted at a time, so this is unambiguous.
function row(page: Page, name: string) {
  return page.locator(".rounded-xl.border.border-border.p-3").filter({ hasText: name });
}

test.beforeAll(async () => {
  await resetGroupsForCreators([ALEX.id, SAMUEL.id, CAMILLE.id, ANTOINE.id]);
});

test.describe("group creation", () => {
  let groupId: string | undefined;

  test.afterAll(async () => {
    if (groupId) await deleteGroups([groupId]);
  });

  test("validates required fields before advancing", async ({ browser }) => {
    const context = await browser.newContext({ storageState: "e2e/.auth/alex.json" });
    const page = await context.newPage();

    await page.goto(localePath("fr", "/groups/new"));
    await page.getByRole("button", { name: "Suivant" }).click();
    await expect(page.getByText("Le nom du groupe est requis.")).toBeVisible();

    await page.getByPlaceholder("Nom du groupe").fill("Randonnée Escalade");
    await page.getByRole("button", { name: "Suivant" }).click();
    await page.getByRole("button", { name: "Suivant" }).click();
    await expect(page.getByText("Choisis un centre d'intérêt.")).toBeVisible();

    await context.close();
  });

  test("creates a group with a chosen interest", async ({ browser }) => {
    const context = await browser.newContext({ storageState: "e2e/.auth/alex.json" });
    const page = await context.newPage();

    await page.goto(localePath("fr", "/groups/new"));
    await page.getByPlaceholder("Nom du groupe").fill("Randonnée Escalade");
    await page.getByRole("button", { name: "Suivant" }).click();

    await page.getByPlaceholder("🔍 Rechercher un intérêt...").fill("Arts martiaux");
    await page.getByRole("button", { name: /Arts martiaux/ }).click();
    await page.getByRole("button", { name: "Suivant" }).click();

    await page.getByRole("button", { name: "Créer" }).click();
    await expect(page).toHaveURL(/\/groups\/[0-9a-f-]+$/, { timeout: 20_000 });
    groupId = page.url().split("/groups/")[1];

    await expect(page.getByText("Randonnée Escalade")).toBeVisible();
    await expect(page.getByText(/Arts martiaux/)).toBeVisible();

    await page.getByRole("button", { name: "Membres" }).click();
    await expect(row(page, ALEX.fullName).getByText("Créateur")).toBeVisible();
    await expect(row(page, ALEX.fullName).getByRole("button", { name: "Quitter le groupe" })).toBeVisible();

    await page.goto(localePath("fr", "/groups"));
    await page.getByRole("button", { name: "Mes groupes" }).click();
    await expect(page.getByRole("link", { name: /Randonnée Escalade/ })).toBeVisible();

    await context.close();
  });
});

test.describe("invite modes", () => {
  let groupId: string;

  test.beforeAll(async () => {
    groupId = await seedGroup({
      name: "Cercle Multisport",
      interestLabelFr: "Arts martiaux",
      creatorId: ALEX.id,
    });
    await ensureFriendship(ALEX.id, SAMUEL.id);
    await setProfileInterests(CAMILLE.id, ["Arts martiaux"]);
  });

  test.afterAll(async () => {
    await deleteGroups([groupId]);
    await resetRelationship(ALEX.id, SAMUEL.id);
    await setProfileInterests(CAMILLE.id, []);
  });

  test("invites a friend via the Amis tab", async ({ browser }) => {
    const context = await browser.newContext({ storageState: "e2e/.auth/alex.json" });
    const page = await context.newPage();

    await page.goto(localePath("fr", `/groups/${groupId}`));
    await page.getByRole("button", { name: "Inviter" }).click();
    const card = personCard(page, SAMUEL.fullName);
    await expect(card).toBeVisible();
    await card.getByRole("button", { name: "Inviter" }).click();
    await expect(card.getByText("Invité ✓")).toBeVisible();

    const { data } = await supabaseAdmin
      .from("group_members")
      .select("status")
      .eq("group_id", groupId)
      .eq("profile_id", SAMUEL.id)
      .maybeSingle();
    expect(data?.status).toBe("active");

    await context.close();
  });

  test("invites by name search", async ({ browser }) => {
    const context = await browser.newContext({ storageState: "e2e/.auth/alex.json" });
    const page = await context.newPage();

    await page.goto(localePath("fr", `/groups/${groupId}`));
    await page.getByRole("button", { name: "Inviter" }).click();
    await page.getByRole("button", { name: "Par nom" }).click();
    await page.getByPlaceholder("🔍 Nom").fill("Antoine");

    const card = personCard(page, ANTOINE.fullName);
    await expect(card).toBeVisible();
    await card.getByRole("button", { name: "Inviter" }).click();
    await expect(card.getByText("Invité ✓")).toBeVisible();

    const { data } = await supabaseAdmin
      .from("group_members")
      .select("status")
      .eq("group_id", groupId)
      .eq("profile_id", ANTOINE.id)
      .maybeSingle();
    expect(data?.status).toBe("active");

    await context.close();
  });

  test("invites by interest search pre-filled with the group's own interest", async ({
    browser,
  }) => {
    const context = await browser.newContext({ storageState: "e2e/.auth/alex.json" });
    const page = await context.newPage();

    await page.goto(localePath("fr", `/groups/${groupId}`));
    await page.getByRole("button", { name: "Inviter" }).click();
    await page.getByRole("button", { name: "Par intérêt" }).click();

    const card = personCard(page, CAMILLE.fullName);
    await expect(card).toBeVisible();
    await card.getByRole("button", { name: "Inviter" }).click();
    await expect(card.getByText("Invité ✓")).toBeVisible();

    const { data } = await supabaseAdmin
      .from("group_members")
      .select("status")
      .eq("group_id", groupId)
      .eq("profile_id", CAMILLE.id)
      .maybeSingle();
    expect(data?.status).toBe("active");

    await context.close();
  });
});

test.describe("join request approval", () => {
  let groupId: string;

  test.beforeAll(async () => {
    groupId = await seedGroup({ name: "Club Lecture", interestLabelFr: "Badminton", creatorId: CAMILLE.id });
  });

  test.afterAll(async () => {
    await deleteGroups([groupId]);
  });

  test("a non-member requests to join and gets approved", async ({ browser }) => {
    const antoineContext = await browser.newContext({ storageState: "e2e/.auth/antoine.json" });
    const camilleContext = await browser.newContext({ storageState: "e2e/.auth/camille.json" });
    const antoinePage = await antoineContext.newPage();
    const camillePage = await camilleContext.newPage();

    await antoinePage.goto(localePath("fr", `/groups/${groupId}`));
    await antoinePage.getByRole("button", { name: "Demander à rejoindre" }).click();
    await expect(antoinePage.getByText("Demande envoyée")).toBeVisible();

    await camillePage.goto(localePath("fr", `/groups/${groupId}`));
    await camillePage.getByRole("button", { name: /Demandes/ }).click();
    const requestRow = row(camillePage, ANTOINE.fullName);
    await expect(requestRow).toBeVisible();
    await requestRow.getByRole("button", { name: "Approuver" }).click();
    await expect(requestRow).toHaveCount(0);

    await antoinePage.reload();
    await expect(antoinePage.getByRole("button", { name: "Membres" })).toBeVisible();

    await antoineContext.close();
    await camilleContext.close();
  });

  test("rejecting a request lets the same person re-request", async ({ browser }) => {
    const samuelContext = await browser.newContext({ storageState: "e2e/.auth/samuel.json" });
    const camilleContext = await browser.newContext({ storageState: "e2e/.auth/camille.json" });
    const samuelPage = await samuelContext.newPage();
    const camillePage = await camilleContext.newPage();

    await samuelPage.goto(localePath("fr", `/groups/${groupId}`));
    await samuelPage.getByRole("button", { name: "Demander à rejoindre" }).click();
    await expect(samuelPage.getByText("Demande envoyée")).toBeVisible();

    await camillePage.goto(localePath("fr", `/groups/${groupId}`));
    await camillePage.getByRole("button", { name: /Demandes/ }).click();
    const requestRow = row(camillePage, SAMUEL.fullName);
    await expect(requestRow).toBeVisible();
    await requestRow.getByRole("button", { name: "Refuser" }).click();
    await expect(requestRow).toHaveCount(0);

    await samuelPage.reload();
    await expect(samuelPage.getByRole("button", { name: "Demander à rejoindre" })).toBeVisible();
    await samuelPage.getByRole("button", { name: "Demander à rejoindre" }).click();
    await expect(samuelPage.getByText("Demande envoyée")).toBeVisible();

    await camillePage.reload();
    await camillePage.getByRole("button", { name: /Demandes/ }).click();
    await row(camillePage, SAMUEL.fullName).getByRole("button", { name: "Approuver" }).click();

    await samuelContext.close();
    await camilleContext.close();
  });
});

test.describe("exclude, ban, and role-boundary permissions", () => {
  let groupId: string;

  test.beforeAll(async () => {
    groupId = await seedGroup(
      { name: "Ligue Impro", interestLabelFr: "Badminton", creatorId: ALEX.id },
      [
        { profileId: SAMUEL.id, role: "admin" },
        { profileId: ANTOINE.id, role: "admin" },
        { profileId: CAMILLE.id, role: "member" },
      ]
    );
  });

  test.afterAll(async () => {
    await deleteGroups([groupId]);
  });

  test("a non-creator admin cannot manage another admin, but can manage a plain member", async ({
    browser,
  }) => {
    const context = await browser.newContext({ storageState: "e2e/.auth/samuel.json" });
    const page = await context.newPage();

    await page.goto(localePath("fr", `/groups/${groupId}`));
    await page.getByRole("button", { name: "Membres" }).click();

    await expect(row(page, ANTOINE.fullName).getByRole("button")).toHaveCount(0);
    await expect(row(page, CAMILLE.fullName).getByRole("button", { name: "Promouvoir admin" })).toBeVisible();
    await expect(row(page, CAMILLE.fullName).getByRole("button", { name: "Exclure" })).toBeVisible();
    await expect(row(page, CAMILLE.fullName).getByRole("button", { name: "Bannir" })).toBeVisible();

    await context.close();
  });

  test("excluding then re-inviting by name reactivates the member", async ({ browser }) => {
    const context = await browser.newContext({ storageState: "e2e/.auth/samuel.json" });
    const page = await context.newPage();

    await page.goto(localePath("fr", `/groups/${groupId}`));
    await page.getByRole("button", { name: "Membres" }).click();
    await row(page, CAMILLE.fullName).getByRole("button", { name: "Exclure" }).click();
    await expect(page.getByText("Membres exclus")).toBeVisible();
    await expect(row(page, CAMILLE.fullName).getByRole("button", { name: "Réadmettre" })).toBeVisible();

    await page.getByRole("button", { name: "Inviter" }).click();
    await page.getByRole("button", { name: "Par nom" }).click();
    await page.getByPlaceholder("🔍 Nom").fill("Camille");
    const card = personCard(page, CAMILLE.fullName);
    await expect(card).toBeVisible();
    await card.getByRole("button", { name: "Inviter" }).click();
    await expect(card.getByText("Invité ✓")).toBeVisible();

    // MemberList and the invite modal don't share state (group_members isn't
    // Realtime-enabled) — a reload is required to see the reactivation.
    await page.reload();
    await page.getByRole("button", { name: "Membres" }).click();
    await expect(page.getByText("Membres exclus")).toHaveCount(0);
    await expect(row(page, CAMILLE.fullName).getByRole("button", { name: "Exclure" })).toBeVisible();

    await context.close();
  });

  test("banning removes the member from every view, permanently", async ({ browser }) => {
    const alexContext = await browser.newContext({ storageState: "e2e/.auth/alex.json" });
    const antoineContext = await browser.newContext({ storageState: "e2e/.auth/antoine.json" });
    const alexPage = await alexContext.newPage();
    const antoinePage = await antoineContext.newPage();

    await alexPage.goto(localePath("fr", `/groups/${groupId}`));
    await alexPage.getByRole("button", { name: "Membres" }).click();
    await row(alexPage, ANTOINE.fullName).getByRole("button", { name: "Bannir" }).click();
    await alexPage.reload();
    await alexPage.getByRole("button", { name: "Membres" }).click();
    await expect(alexPage.getByText(ANTOINE.fullName)).toHaveCount(0);

    const { data } = await supabaseAdmin
      .from("group_members")
      .select("status")
      .eq("group_id", groupId)
      .eq("profile_id", ANTOINE.id)
      .maybeSingle();
    expect(data?.status).toBe("banned");

    await antoinePage.goto(localePath("fr", `/groups/${groupId}`));
    await expect(antoinePage.getByText("Tu ne peux plus rejoindre ce groupe.")).toBeVisible();
    await expect(antoinePage.getByRole("button", { name: "Demander à rejoindre" })).toHaveCount(0);

    await alexPage.getByRole("button", { name: "Inviter" }).click();
    await alexPage.getByRole("button", { name: "Par nom" }).click();
    await alexPage.getByPlaceholder("🔍 Nom").fill("Antoine");
    await expect(alexPage.getByText("Aucun résultat.")).toBeVisible();

    await alexContext.close();
    await antoineContext.close();
  });

  test("a stale pending join request for an already-banned member can't reactivate them", async ({
    browser,
  }) => {
    await seedJoinRequest(groupId, ANTOINE.id, "pending");

    const context = await browser.newContext({ storageState: "e2e/.auth/alex.json" });
    const page = await context.newPage();

    await page.goto(localePath("fr", `/groups/${groupId}`));
    await page.getByRole("button", { name: /Demandes/ }).click();
    const requestRow = row(page, ANTOINE.fullName);
    await requestRow.getByRole("button", { name: "Approuver" }).click();
    // Wait for the row to actually disappear (i.e. approveJoinRequest's
    // request/response round-trip — and whatever AFTER UPDATE trigger fires
    // synchronously within it — has genuinely completed server-side) before
    // reading group_members directly, otherwise this races the click.
    await expect(requestRow).toHaveCount(0);

    const { data } = await supabaseAdmin
      .from("group_members")
      .select("status")
      .eq("group_id", groupId)
      .eq("profile_id", ANTOINE.id)
      .maybeSingle();
    expect(data?.status).toBe("banned");

    await context.close();
  });
});

test.describe("discovery: interest filter and default ranking", () => {
  let groupBadminton: string;
  let groupArtsMartiaux: string;

  test.beforeAll(async () => {
    groupBadminton = await seedGroup({
      name: "Mordus de Badminton",
      interestLabelFr: "Badminton",
      creatorId: SAMUEL.id,
    });
    groupArtsMartiaux = await seedGroup({
      name: "Dojo Arts Martiaux",
      interestLabelFr: "Arts martiaux",
      creatorId: CAMILLE.id,
    });
  });

  test.afterAll(async () => {
    await deleteGroups([groupBadminton, groupArtsMartiaux]);
    await setProfileInterests(ANTOINE.id, []);
  });

  test("an explicit interest filter narrows results", async ({ browser }) => {
    const context = await browser.newContext({ storageState: "e2e/.auth/antoine.json" });
    const page = await context.newPage();

    await page.goto(localePath("fr", "/groups"));
    await page.getByRole("button", { name: "Par intérêt" }).click();
    await page.getByRole("button", { name: "Tous les intérêts" }).click();
    // Desktop dropdown and mobile full-screen panel both render at once
    // (only one is visible per breakpoint via CSS) — the desktop version
    // comes first in DOM order and is the one visible at this viewport.
    await page.getByPlaceholder("🔍 Rechercher un intérêt...").first().fill("Badminton");
    await page.getByRole("button", { name: /Badminton/ }).first().click();

    await expect(groupCard(page, "Mordus de Badminton")).toBeVisible();
    await expect(groupCard(page, "Dojo Arts Martiaux")).toHaveCount(0);

    await context.close();
  });

  test("default (no filter) ranks groups matching the viewer's own interests first", async ({
    browser,
  }) => {
    await setProfileInterests(ANTOINE.id, ["Arts martiaux"]);

    const context = await browser.newContext({ storageState: "e2e/.auth/antoine.json" });
    const page = await context.newPage();

    await page.goto(localePath("fr", "/groups"));
    await expect(groupCard(page, "Mordus de Badminton")).toBeVisible();
    await expect(groupCard(page, "Dojo Arts Martiaux")).toBeVisible();

    const text = (await page.locator("main").innerText()) ?? (await page.innerText("body"));
    expect(text.indexOf("Dojo Arts Martiaux")).toBeLessThan(text.indexOf("Mordus de Badminton"));

    await context.close();
  });
});

test.describe("realtime group chat", () => {
  let groupId: string;

  test.beforeAll(async () => {
    groupId = await seedGroup(
      { name: "Chat Test Live", interestLabelFr: "Badminton", creatorId: SAMUEL.id },
      [{ profileId: CAMILLE.id, role: "member" }]
    );
  });

  test.afterAll(async () => {
    await deleteGroups([groupId]);
  });

  test("two members see each other's messages live, no reload", async ({ browser }) => {
    const samuelContext = await browser.newContext({ storageState: "e2e/.auth/samuel.json" });
    const camilleContext = await browser.newContext({ storageState: "e2e/.auth/camille.json" });
    const samuelPage = await samuelContext.newPage();
    const camillePage = await camilleContext.newPage();

    await samuelPage.goto(localePath("fr", `/groups/${groupId}`));
    await camillePage.goto(localePath("fr", `/groups/${groupId}`));

    await samuelPage.getByPlaceholder("Écris un message...").fill("Salut le groupe !");
    await samuelPage.getByRole("button", { name: "Envoyer" }).click();
    await expect(samuelPage.getByText("Salut le groupe !")).toBeVisible();
    await expect(camillePage.getByText("Salut le groupe !")).toBeVisible({ timeout: 10_000 });

    await camillePage.getByPlaceholder("Écris un message...").fill("Présente !");
    await camillePage.getByRole("button", { name: "Envoyer" }).click();
    await expect(samuelPage.getByText("Présente !")).toBeVisible({ timeout: 10_000 });

    await samuelContext.close();
    await camilleContext.close();
  });
});

test.describe("admin removes a group message", () => {
  let groupId: string;
  let messageId: string;

  test.beforeAll(async () => {
    groupId = await seedGroup(
      { name: "Salon Modération", interestLabelFr: "Badminton", creatorId: ALEX.id },
      [{ profileId: CAMILLE.id, role: "member" }]
    );
    messageId = await seedGroupMessage(groupId, CAMILLE.id, "Message original à retirer");
  });

  test.afterAll(async () => {
    await deleteGroups([groupId]);
  });

  test("removing a message replaces it with the placeholder for every viewer, live", async ({
    browser,
  }) => {
    const alexContext = await browser.newContext({ storageState: "e2e/.auth/alex.json" });
    const camilleContext = await browser.newContext({ storageState: "e2e/.auth/camille.json" });
    const alexPage = await alexContext.newPage();
    const camillePage = await camilleContext.newPage();

    await alexPage.goto(localePath("fr", `/groups/${groupId}`));
    await camillePage.goto(localePath("fr", `/groups/${groupId}`));
    await expect(alexPage.getByText("Message original à retirer")).toBeVisible();
    await expect(camillePage.getByText("Message original à retirer")).toBeVisible();

    // Camille is a plain member — the remove affordance must never exist in
    // her DOM at all (canRemove is false, not just CSS-hidden).
    await expect(camillePage.getByLabel("Retirer ce message")).toHaveCount(0);

    const bubble = alexPage.getByText("Message original à retirer").locator("..");
    await bubble.hover();
    await bubble.getByLabel("Retirer ce message").click();

    await expect(alexPage.getByText("Ce message a été retiré")).toBeVisible();
    await expect(alexPage.getByText("Message original à retirer")).toHaveCount(0);
    await expect(camillePage.getByText("Ce message a été retiré")).toBeVisible({ timeout: 10_000 });
    await expect(camillePage.getByText("Message original à retirer")).toHaveCount(0);

    const { data } = await supabaseAdmin
      .from("group_messages")
      .select("removed_at, removed_by")
      .eq("id", messageId)
      .maybeSingle();
    expect(data?.removed_at).not.toBeNull();
    expect(data?.removed_by).toBe(ALEX.id);

    await alexContext.close();
    await camilleContext.close();
  });
});

test.describe("creator leaves — role auto-transfers", () => {
  let groupId: string;

  test.beforeAll(async () => {
    groupId = await seedGroup(
      { name: "Voyage Entre Amis", interestLabelFr: "Badminton", creatorId: ALEX.id },
      [
        { profileId: SAMUEL.id, role: "admin" },
        { profileId: CAMILLE.id, role: "member" },
      ]
    );
  });

  test.afterAll(async () => {
    await deleteGroups([groupId]);
  });

  test("the creator leaving transfers the role to exactly one remaining active member", async ({
    browser,
  }) => {
    const alexContext = await browser.newContext({ storageState: "e2e/.auth/alex.json" });
    const samuelContext = await browser.newContext({ storageState: "e2e/.auth/samuel.json" });
    const alexPage = await alexContext.newPage();
    const samuelPage = await samuelContext.newPage();

    await samuelPage.goto(localePath("fr", `/groups/${groupId}`));
    await samuelPage.getByRole("button", { name: "Membres" }).click();

    await alexPage.goto(localePath("fr", `/groups/${groupId}`));
    await alexPage.getByRole("button", { name: "Membres" }).click();
    await row(alexPage, ALEX.fullName).getByRole("button", { name: "Quitter le groupe" }).click();
    await expect(alexPage).toHaveURL(localePath("fr", "/groups"));

    const { data: alexRow } = await supabaseAdmin
      .from("group_members")
      .select("status")
      .eq("group_id", groupId)
      .eq("profile_id", ALEX.id)
      .maybeSingle();
    expect(alexRow?.status).toBe("left");

    const { data: activeCreators } = await supabaseAdmin
      .from("group_members")
      .select("profile_id")
      .eq("group_id", groupId)
      .eq("status", "active")
      .eq("role", "creator");
    expect(activeCreators ?? []).toHaveLength(1);
    const newCreatorId = activeCreators![0].profile_id;
    expect(newCreatorId).not.toBe(ALEX.id);
    expect([SAMUEL.id, CAMILLE.id]).toContain(newCreatorId);

    const newCreatorName = newCreatorId === SAMUEL.id ? SAMUEL.fullName : CAMILLE.fullName;
    await samuelPage.reload();
    await samuelPage.getByRole("button", { name: "Membres" }).click();
    await expect(row(samuelPage, ALEX.fullName)).toHaveCount(0);
    await expect(row(samuelPage, newCreatorName).getByText("Créateur")).toBeVisible();

    await alexContext.close();
    await samuelContext.close();
  });
});

test.describe("createGroup orphan edge case", () => {
  test("an orphaned group (no member row) is still visible in discovery to any authenticated user", async () => {
    const interestId = await getInterestId("Arts martiaux");
    const { data: orphan, error: insertError } = await supabaseAdmin
      .from("groups")
      .insert({
        name: "Groupe Fantôme",
        creator_id: ALEX.id,
        interest_id: interestId,
        invite_permission: "all_members",
      })
      .select("id")
      .single();
    expect(insertError).toBeNull();
    const orphanId = orphan!.id as string;

    try {
      const plainClient = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
        { auth: { autoRefreshToken: false, persistSession: false }, realtime: { transport: ws as never } }
      );
      const { error: signInError } = await plainClient.auth.signInWithPassword({
        email: SAMUEL.email,
        password: TEST_PASSWORD,
      });
      expect(signInError).toBeNull();

      const { data: visibleGroup, error: selectError } = await plainClient
        .from("groups")
        .select("id")
        .eq("id", orphanId)
        .maybeSingle();
      expect(selectError).toBeNull();
      expect(visibleGroup).not.toBeNull();

      const { count } = await plainClient
        .from("group_members")
        .select("*", { count: "exact", head: true })
        .eq("group_id", orphanId);
      expect(count).toBe(0);
    } finally {
      await deleteGroups([orphanId]);
    }
  });
});
