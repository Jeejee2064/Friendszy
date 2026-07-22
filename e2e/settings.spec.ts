import { test, expect } from "@playwright/test";
import { localePath } from "./utils/urls";

test.use({ storageState: "e2e/.auth/alex.json" });

test.describe("settings", () => {
  test("downloads a data export", async ({ page }) => {
    await page.goto(localePath("fr", "/settings"));
    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "Télécharger mes données" }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/^friendszy-donnees-.*\.json$/);
  });

  test("delete-account confirmation requires the exact word, and can be cancelled", async ({
    page,
  }) => {
    // We deliberately never click through to an actual deletion here — these
    // are shared, hand-curated test accounts, not throwaway fixtures.
    await page.goto(localePath("fr", "/settings"));
    await page.getByRole("button", { name: "Supprimer mon compte" }).click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    const confirmButton = dialog.getByRole("button", { name: "Supprimer définitivement" });

    await expect(confirmButton).toBeDisabled();
    await dialog.getByPlaceholder("SUPPRIMER").fill("nope");
    await expect(confirmButton).toBeDisabled();
    await dialog.getByPlaceholder("SUPPRIMER").fill("SUPPRIMER");
    await expect(confirmButton).toBeEnabled();

    await dialog.getByRole("button", { name: "Annuler" }).click();
    await expect(dialog).toHaveCount(0);
  });
});
