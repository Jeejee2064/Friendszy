import { test as setup, expect } from "@playwright/test";
import { localePath } from "./utils/urls";
import { ALEX, SAMUEL, CAMILLE, ANTOINE, TEST_PASSWORD } from "./fixtures/test-users";

const personas = [
  { ...ALEX, storageFile: "e2e/.auth/alex.json" },
  { ...SAMUEL, storageFile: "e2e/.auth/samuel.json" },
  { ...CAMILLE, storageFile: "e2e/.auth/camille.json" },
  { ...ANTOINE, storageFile: "e2e/.auth/antoine.json" },
];

for (const persona of personas) {
  setup(`authenticate as ${persona.fullName}`, async ({ page }) => {
    await page.goto(localePath("fr", "/login"));
    await page.getByLabel("Courriel").fill(persona.email);
    // exact: true — getByLabel's default substring match also catches the
    // show/hide toggle button, whose aria-label ("Afficher le mot de
    // passe") contains "Mot de passe" too.
    await page.getByLabel("Mot de passe", { exact: true }).fill(TEST_PASSWORD);
    await page.getByRole("button", { name: /se connecter/i }).click();
    await expect(page).toHaveURL(localePath("fr", "/"), { timeout: 40_000 });
    await page.context().storageState({ path: persona.storageFile });
  });
}
