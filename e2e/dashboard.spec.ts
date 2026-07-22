import { test, expect } from "@playwright/test";
import { localePath } from "./utils/urls";
import { ALEX } from "./fixtures/test-users";

test.use({ storageState: "e2e/.auth/alex.json" });

test.describe("dashboard", () => {
  test("shows a personalized welcome, stats, and quick access", async ({ page }) => {
    await page.goto(localePath("fr", "/"));

    // Dashboard's "firstName" var actually holds the full profiles.full_name value.
    await expect(page.getByText(`Bon retour, ${ALEX.fullName} !`)).toBeVisible();

    // Stat values are dynamic (depend on whatever other specs left behind),
    // so we only assert the labels render, not exact counts.
    await expect(page.getByText("Amis", { exact: true })).toBeVisible();
    await expect(page.getByText("Nouveaux messages")).toBeVisible();
    await expect(page.getByText("Mes intérêts")).toBeVisible();

    await expect(page.getByRole("link", { name: /Trouver des amis/ })).toHaveAttribute(
      "href",
      "/search"
    );
    await expect(page.getByRole("link", { name: /Mes messages/ })).toHaveAttribute(
      "href",
      "/messages"
    );
    await expect(page.getByRole("link", { name: /Cercle d'amis/ })).toHaveAttribute(
      "href",
      "/friends"
    );
    // "Mon profil" also exists as a sidebar nav link, so disambiguate via
    // the quick-access card's subtitle.
    await expect(page.getByRole("link", { name: /Modifier ma fiche/ })).toHaveAttribute(
      "href",
      "/profile"
    );
  });
});
