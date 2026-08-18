import { test, expect } from "@playwright/test";
import { localePath } from "./utils/urls";
import { ALEX } from "./fixtures/test-users";
import { setHasSeenNavTour, supabaseAdmin } from "./fixtures/db";

// `has_seen_nav_tour = false` is exactly the state a freshly-onboarded
// account is in — forcing it on an already-onboarded fixture is the
// pragmatic way to simulate "just finished onboarding" without spinning up
// a throwaway signup, consistent with how the other specs manipulate DB
// state directly (setProfileAvatar, resetModerationStatus, ...).
test.describe("nav tour", () => {
  test.use({ storageState: "e2e/.auth/alex.json" });

  test.beforeEach(async () => {
    await setHasSeenNavTour(ALEX.id, false);
  });

  // Restore the shared fixture account no matter how the test ends —
  // it's reused by dashboard.spec.ts, settings.spec.ts, etc., none of
  // which expect to see the tour.
  test.afterEach(async () => {
    await setHasSeenNavTour(ALEX.id, true);
  });

  test("shows a welcome screen before the icon-by-icon steps", async ({ page }) => {
    await page.goto(localePath("fr", "/"));

    const dialog = page.getByRole("dialog", { name: "Visite guidée de la navigation" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText("Bienvenue sur Friendszy !")).toBeVisible();
    // Not pointing at any icon yet.
    await expect(dialog.getByText(/Étape \d \/ \d/)).toHaveCount(0);

    await dialog.getByRole("button", { name: "Découvrir" }).click();
    await expect(dialog).toContainText("Étape 1 / 6");
  });

  test("walks through every real nav item once, in order, then never reappears", async ({
    page,
  }) => {
    await page.goto(localePath("fr", "/"));

    const dialog = page.getByRole("dialog", { name: "Visite guidée de la navigation" });
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "Découvrir" }).click();

    // Mirrors NAV_ITEMS in sidebar-nav.tsx (ALEX isn't an admin, so no
    // "admin" step) — the tour's own sequencing is asserted against this,
    // not re-derived from the DOM, so this list is the test's source of
    // truth for what "in order" means here.
    const steps = [
      { title: "Accueil", body: "fil d'accueil" },
      { title: "Rechercher", body: "nouvelles personnes" },
      { title: "Messages", body: "conversations" },
      { title: "Mes amis", body: "demandes d'amitié" },
      { title: "Groupes", body: "groupes autour" },
      { title: "Découvrir", body: "partenaires et événements" },
    ];

    for (const [i, step] of steps.entries()) {
      await expect(dialog).toContainText(`Étape ${i + 1} / ${steps.length}`);
      await expect(dialog.getByText(step.title, { exact: true })).toBeVisible();
      await expect(dialog).toContainText(step.body);
      if (i < steps.length - 1) {
        await dialog.getByRole("button", { name: "Suivant" }).click();
      }
    }

    // Last step swaps "Suivant" for "Terminer", which ends the tour for good.
    await dialog.getByRole("button", { name: "Terminer" }).click();
    await expect(dialog).toHaveCount(0);

    await expect
      .poll(async () => {
        const { data } = await supabaseAdmin
          .from("profiles")
          .select("has_seen_nav_tour")
          .eq("id", ALEX.id)
          .single();
        return data?.has_seen_nav_tour;
      })
      .toBe(true);

    await page.reload();
    await expect(
      page.getByRole("dialog", { name: "Visite guidée de la navigation" })
    ).toHaveCount(0);
  });

  test('"Passer" ends the tour immediately, from the welcome screen or mid-tour, and it never comes back', async ({
    page,
  }) => {
    await page.goto(localePath("fr", "/"));
    const dialog = page.getByRole("dialog", { name: "Visite guidée de la navigation" });
    await expect(dialog).toBeVisible();

    // "Passer" must work right on the welcome screen too, not just once
    // icon steps have started.
    await dialog.getByRole("button", { name: "Passer" }).click();
    await expect(dialog).toHaveCount(0);

    await expect
      .poll(async () => {
        const { data } = await supabaseAdmin
          .from("profiles")
          .select("has_seen_nav_tour")
          .eq("id", ALEX.id)
          .single();
        return data?.has_seen_nav_tour;
      })
      .toBe(true);

    await page.reload();
    await expect(
      page.getByRole("dialog", { name: "Visite guidée de la navigation" })
    ).toHaveCount(0);
  });

  test('"Passer" also works mid-tour, after the welcome screen', async ({ page }) => {
    await page.goto(localePath("fr", "/"));
    const dialog = page.getByRole("dialog", { name: "Visite guidée de la navigation" });
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "Découvrir" }).click();

    // Advance a couple of steps first — "Passer" must work mid-tour, not
    // just on the first bubble.
    await dialog.getByRole("button", { name: "Suivant" }).click();
    await dialog.getByRole("button", { name: "Suivant" }).click();
    await dialog.getByRole("button", { name: "Passer" }).click();
    await expect(dialog).toHaveCount(0);

    await expect
      .poll(async () => {
        const { data } = await supabaseAdmin
          .from("profiles")
          .select("has_seen_nav_tour")
          .eq("id", ALEX.id)
          .single();
        return data?.has_seen_nav_tour;
      })
      .toBe(true);

    await page.reload();
    await expect(
      page.getByRole("dialog", { name: "Visite guidée de la navigation" })
    ).toHaveCount(0);
  });

  test("an account that has already seen it never sees it again on a fresh visit", async ({
    page,
  }) => {
    await setHasSeenNavTour(ALEX.id, true);
    await page.goto(localePath("fr", "/"));
    await expect(
      page.getByRole("dialog", { name: "Visite guidée de la navigation" })
    ).toHaveCount(0);
  });
});
