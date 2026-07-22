import { test, expect } from "@playwright/test";
import { localePath } from "./utils/urls";
import { resetRelationship, setProfileInterests } from "./fixtures/db";
import { ALEX, CAMILLE } from "./fixtures/test-users";

test.use({ storageState: "e2e/.auth/alex.json" });

test.describe("search", () => {
  test.beforeAll(async () => {
    await resetRelationship(ALEX.id, CAMILLE.id);
    await setProfileInterests(CAMILLE.id, ["Badminton"]);
  });

  test("find someone by name", async ({ page }) => {
    await page.goto(localePath("fr", "/search"));
    await page.getByRole("button", { name: "Par nom" }).click();
    await page.getByPlaceholder("Prénom").fill("Camille");
    await expect(page.getByText(CAMILLE.fullName)).toBeVisible({ timeout: 10_000 });
  });

  test("find someone via city + interest (Trouver des amis)", async ({ page }) => {
    await page.goto(localePath("fr", "/search"));

    // City step: type + pick a real autocomplete suggestion.
    await page.getByPlaceholder("Ex : Montréal, QC").fill("Lav");
    await page.getByRole("button", { name: "Laval" }).click();
    await page.getByRole("button", { name: "Suivant" }).click();

    // Interests step: open the picker, search, select the fixed interest.
    // The picker renders both a desktop dropdown and a CSS-hidden mobile
    // panel at once; .first() is the desktop (visible) one at our viewport.
    await page.getByRole("button", { name: "Rechercher un intérêt..." }).click();
    await page.getByPlaceholder("Rechercher un intérêt...").first().fill("Badminton");
    await page.getByRole("button", { name: /Badminton/ }).first().click();

    // Close the interest dropdown (outside click) so it doesn't overlap the
    // buttons below before launching the search.
    await page.getByText(/Jusqu'à \d+ centres d'intérêt/).first().click();
    await page.getByRole("button", { name: "Lancer la recherche" }).click();
    await expect(page.getByText(CAMILLE.fullName)).toBeVisible({ timeout: 10_000 });

    // Light coverage of the filters modal.
    await page.getByRole("button", { name: /Filtres/ }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.getByText("Tranche d'âge")).toBeVisible();
    await expect(page.getByText("Genre", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Voir les résultats" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });
});
