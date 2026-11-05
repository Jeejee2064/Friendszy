import { test, expect } from "@playwright/test";
import { localePath } from "./utils/urls";

test.use({ storageState: "e2e/.auth/alex.json" });

test("« Partenaire de… » ouvre automatiquement la liste des intérêts", async ({ page }) => {
  await page.goto(localePath("fr", "/profile"));

  const lookingFor = page.getByRole("button", { name: /Choisir une ou plusieurs options|Partenaire de/ }).first();
  await lookingFor.scrollIntoViewIfNeeded();
  await lookingFor.click();

  const option = page.getByRole("option", { name: "Partenaire de…" });
  // Si déjà coché sur le profil de test, on le décoche d'abord pour tester l'ajout.
  if ((await option.getAttribute("aria-selected")) === "true") {
    await option.click();
  }
  await option.click();

  // La liste des intérêts est ouverte (champ de recherche visible, focus inclus)…
  const search = page.getByPlaceholder("Rechercher un intérêt…");
  await expect(search).toBeVisible();
  await expect(search).toBeFocused();
  // …et la première liste s'est refermée.
  await expect(page.getByRole("option", { name: "Partenaire de…" })).toHaveCount(0);

  // Pas d'enregistrement : on ne modifie pas le profil de test.
});
