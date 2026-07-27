import { test, expect } from "@playwright/test";
import { localePath } from "./utils/urls";
import { ALEX } from "./fixtures/test-users";

test.use({ storageState: "e2e/.auth/alex.json" });

test.describe("own profile", () => {
  test("edit bio and save", async ({ page }) => {
    await page.goto(localePath("fr", "/profile"));
    // full_name and last_name are separate fields — Prénom only holds the
    // first token, "Nom de famille" holds the rest.
    const [firstName, lastName] = ALEX.fullName.split(" ");
    await expect(page.getByPlaceholder("Prénom")).toHaveValue(firstName);
    await expect(page.getByPlaceholder("Nom de famille")).toHaveValue(lastName);

    const bio = `Bio de test générée par Playwright — ${Date.now()}`;
    const bioField = page.getByPlaceholder("Quelques mots sur toi (optionnel)");
    // .fill() alone has been observed to prepend rather than replace on this
    // <textarea> when it already has content — .clear() first works around it.
    await bioField.clear();
    await bioField.fill(bio);
    await page.getByRole("button", { name: "Enregistrer" }).click();
    await expect(page.getByText("Profil mis à jour.")).toBeVisible();

    // Reload confirms it actually persisted, not just local state.
    await page.reload();
    await expect(page.getByPlaceholder("Quelques mots sur toi (optionnel)")).toHaveValue(bio);
  });

  test("shows required-field validation without saving", async ({ page }) => {
    await page.goto(localePath("fr", "/profile"));
    // The input also has a native `required` attribute, which blocks a truly
    // empty submit before React ever sees it — whitespace-only is what
    // actually reaches this app-level validation message.
    await page.getByPlaceholder("Prénom").fill("   ");
    await page.getByRole("button", { name: "Enregistrer" }).click();
    await expect(page.getByText("Le prénom est requis.")).toBeVisible();

    // Restore the name (first token only — Prénom and Nom de famille are
    // separate fields) so we don't leave Alex's profile incomplete or
    // corrupted for other specs.
    const [firstName] = ALEX.fullName.split(" ");
    await page.getByPlaceholder("Prénom").fill(firstName);
    await page.getByRole("button", { name: "Enregistrer" }).click();
    await expect(page.getByText("Profil mis à jour.")).toBeVisible();
  });
});
