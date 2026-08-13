import { test, expect } from "@playwright/test";
import { localePath } from "./utils/urls";
import { ALEX, SAMUEL, CAMILLE, ANTOINE } from "./fixtures/test-users";
import { seedEvent, deleteEvents, resetEventsForCreators, supabaseAdmin } from "./fixtures/db";

test.beforeAll(async () => {
  await resetEventsForCreators([ALEX.id, SAMUEL.id, CAMILLE.id, ANTOINE.id]);
});

test.describe("event creation", () => {
  let eventId: string | undefined;

  test.afterAll(async () => {
    if (eventId) await deleteEvents([eventId]);
  });

  test("validates required fields before advancing", async ({ browser }) => {
    const context = await browser.newContext({ storageState: "e2e/.auth/alex.json" });
    const page = await context.newPage();

    await page.goto(localePath("fr", "/events/new"));
    await page.getByRole("button", { name: "Suivant" }).click();
    await expect(page.getByText("Le titre est requis.")).toBeVisible();

    await page.getByLabel("Titre").fill("Soirée jeux de société");
    await page.getByRole("button", { name: "Suivant" }).click();
    await expect(page.getByText("Choisis une catégorie.")).toBeVisible();

    await context.close();
  });

  test("creates an event end to end and the creator is auto-registered", async ({ browser }) => {
    const context = await browser.newContext({ storageState: "e2e/.auth/alex.json" });
    const page = await context.newPage();

    await page.goto(localePath("fr", "/events/new"));
    await page.getByLabel("Titre").fill("Soirée Jeux de Société");

    // The interest picker is collapsible here (unlike groups' own dedicated
    // step) — closed by default, needs an explicit click to reveal the search.
    await page.getByRole("button", { name: "Tous les intérêts" }).click();
    await page.getByPlaceholder("🔍 Rechercher un intérêt...").first().fill("Arts martiaux");
    await page.getByRole("button", { name: /Arts martiaux/ }).first().click();

    const startsAt = new Date(Date.now() + 24 * 3600 * 1000);
    const endsAt = new Date(Date.now() + 26 * 3600 * 1000);
    const toLocalInput = (d: Date) => d.toISOString().slice(0, 16);
    await page.getByLabel("Début").fill(toLocalInput(startsAt));
    await page.getByLabel("Fin").fill(toLocalInput(endsAt));
    await page.getByRole("button", { name: "Suivant" }).click();

    await page.getByPlaceholder("Ex. Montréal").fill("Québec");
    await page.getByRole("button", { name: "Suivant" }).click();

    await page.getByRole("button", { name: "Créer l'événement" }).click();
    await expect(page).toHaveURL(/\/events\/[0-9a-f-]+$/, { timeout: 20_000 });
    eventId = page.url().split("/events/")[1];

    await expect(page.getByText("Soirée Jeux de Société")).toBeVisible();
    await expect(page.getByText(/Arts martiaux/)).toBeVisible();
    await expect(page.getByText("Tu es inscrit·e à cet événement.")).toBeVisible();

    const { data } = await supabaseAdmin
      .from("event_registrations")
      .select("profile_id")
      .eq("event_id", eventId)
      .eq("profile_id", ALEX.id)
      .maybeSingle();
    expect(data?.profile_id).toBe(ALEX.id);

    await page.goto(localePath("fr", "/discover"));
    await expect(page.getByRole("link", { name: /Soirée Jeux de Société/ })).toBeVisible();

    await context.close();
  });
});

test.describe("discovery: category filter", () => {
  let eventBadminton: string;
  let eventArtsMartiaux: string;

  test.beforeAll(async () => {
    eventBadminton = await seedEvent({
      title: "Tournoi Badminton Amical",
      interestLabelFr: "Badminton",
      creatorId: SAMUEL.id,
    });
    eventArtsMartiaux = await seedEvent({
      title: "Cours Découverte Arts Martiaux",
      interestLabelFr: "Arts martiaux",
      creatorId: CAMILLE.id,
    });
  });

  test.afterAll(async () => {
    await deleteEvents([eventBadminton, eventArtsMartiaux]);
  });

  test("an explicit category filter narrows results", async ({ browser }) => {
    const context = await browser.newContext({ storageState: "e2e/.auth/antoine.json" });
    const page = await context.newPage();

    await page.goto(localePath("fr", "/discover"));
    await expect(page.getByRole("link", { name: /Tournoi Badminton Amical/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /Cours Découverte Arts Martiaux/ })).toBeVisible();

    await page.getByRole("button", { name: "Tous les intérêts" }).click();
    await page.getByPlaceholder("🔍 Rechercher un intérêt...").first().fill("Badminton");
    await page.getByRole("button", { name: /Badminton/ }).first().click();

    await expect(page.getByRole("link", { name: /Tournoi Badminton Amical/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /Cours Découverte Arts Martiaux/ })).toHaveCount(0);

    await context.close();
  });
});

test.describe("capacity enforcement", () => {
  let eventId: string;

  test.beforeAll(async () => {
    // Capacity 1, filled entirely by the creator's own auto-registration.
    eventId = await seedEvent({
      title: "Atelier Complet",
      interestLabelFr: "Badminton",
      creatorId: ALEX.id,
      capacity: 1,
    });
  });

  test.afterAll(async () => {
    await deleteEvents([eventId]);
  });

  test("a full event shows Complet and blocks registration until a spot frees up", async ({
    browser,
  }) => {
    const samuelContext = await browser.newContext({ storageState: "e2e/.auth/samuel.json" });
    const samuelPage = await samuelContext.newPage();

    await samuelPage.goto(localePath("fr", `/events/${eventId}`));
    await expect(samuelPage.getByText("Cet événement est complet.")).toBeVisible();
    await expect(samuelPage.getByRole("button", { name: "S'inscrire" })).toBeDisabled();

    const { data: countBefore } = await supabaseAdmin
      .from("event_registrations")
      .select("profile_id")
      .eq("event_id", eventId);
    expect(countBefore).toHaveLength(1);

    // The creator (Alex) frees their spot — Samuel can now register.
    const alexContext = await browser.newContext({ storageState: "e2e/.auth/alex.json" });
    const alexPage = await alexContext.newPage();
    await alexPage.goto(localePath("fr", `/events/${eventId}`));
    await alexPage.getByRole("button", { name: "Se désinscrire" }).click();
    await expect(alexPage.getByRole("button", { name: "S'inscrire" })).toBeEnabled();

    await samuelPage.reload();
    await expect(samuelPage.getByText("Cet événement est complet.")).toHaveCount(0);
    await samuelPage.getByRole("button", { name: "S'inscrire" }).click();
    await expect(samuelPage.getByText("Tu es inscrit·e à cet événement.")).toBeVisible();

    const { data: registrations } = await supabaseAdmin
      .from("event_registrations")
      .select("profile_id")
      .eq("event_id", eventId);
    expect((registrations ?? []).map((r) => r.profile_id).sort()).toEqual(
      [SAMUEL.id].sort()
    );

    await samuelContext.close();
    await alexContext.close();
  });
});

test.describe("chat is reserved to registered participants", () => {
  let eventId: string;

  test.beforeAll(async () => {
    eventId = await seedEvent(
      { title: "Rando Photo Automne", interestLabelFr: "Badminton", creatorId: ALEX.id },
      [{ profileId: CAMILLE.id }]
    );
  });

  test.afterAll(async () => {
    await deleteEvents([eventId]);
  });

  test("a non-registered visitor sees a locked notice, not the chat", async ({ browser }) => {
    const context = await browser.newContext({ storageState: "e2e/.auth/antoine.json" });
    const page = await context.newPage();

    await page.goto(localePath("fr", `/events/${eventId}`));
    await expect(page.getByText("Inscris-toi pour accéder à la discussion.")).toBeVisible();
    await expect(page.getByPlaceholder("Écris un message...")).toHaveCount(0);

    await context.close();
  });

  test("two registered participants see each other's messages live", async ({ browser }) => {
    const alexContext = await browser.newContext({ storageState: "e2e/.auth/alex.json" });
    const camilleContext = await browser.newContext({ storageState: "e2e/.auth/camille.json" });
    const alexPage = await alexContext.newPage();
    const camillePage = await camilleContext.newPage();

    await alexPage.goto(localePath("fr", `/events/${eventId}`));
    await camillePage.goto(localePath("fr", `/events/${eventId}`));

    await alexPage.getByPlaceholder("Écris un message...").fill("Salut, hâte d'y être !");
    await alexPage.getByRole("button", { name: "Envoyer" }).click();
    await expect(alexPage.getByText("Salut, hâte d'y être !")).toBeVisible();
    await expect(camillePage.getByText("Salut, hâte d'y être !")).toBeVisible({ timeout: 10_000 });

    await alexContext.close();
    await camilleContext.close();
  });
});

test.describe("contact the organizer", () => {
  let eventId: string;

  test.beforeAll(async () => {
    eventId = await seedEvent({
      title: "Brunch Communautaire",
      interestLabelFr: "Badminton",
      creatorId: ALEX.id,
    });
  });

  test.afterAll(async () => {
    await deleteEvents([eventId]);
  });

  test("a visitor can message the organizer via the 1:1 messaging system", async ({ browser }) => {
    const context = await browser.newContext({ storageState: "e2e/.auth/samuel.json" });
    const page = await context.newPage();

    await page.goto(localePath("fr", `/events/${eventId}`));
    await page.getByRole("button", { name: "Contacter l'organisateur" }).click();
    await expect(page).toHaveURL(/\/messages\?c=/, { timeout: 20_000 });

    await context.close();
  });
});
