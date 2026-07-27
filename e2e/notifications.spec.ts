import { test, expect } from "@playwright/test";
import { localePath } from "./utils/urls";
import { resetRelationship } from "./fixtures/db";
import { ALEX, CAMILLE } from "./fixtures/test-users";

test.describe("notifications", () => {
  test.beforeAll(async () => {
    await resetRelationship(ALEX.id, CAMILLE.id);
  });

  test("adding a friend notifies the person who was added", async ({ browser }) => {
    const alexContext = await browser.newContext({ storageState: "e2e/.auth/alex.json" });
    const camilleContext = await browser.newContext({ storageState: "e2e/.auth/camille.json" });
    const alexPage = await alexContext.newPage();
    const camillePage = await camilleContext.newPage();

    // Friend-adding is instant and one-directional — Alex adding Camille
    // notifies Camille directly, there's no separate acceptance step.
    await alexPage.goto(localePath("fr", `/profile/${CAMILLE.id}`));
    await alexPage.getByRole("button", { name: /ajouter/i }).click();
    await expect(alexPage.getByText("Ami", { exact: true })).toBeVisible();

    await camillePage.goto(localePath("fr", "/notifications"));
    const notification = camillePage.getByText(`${ALEX.fullName} t'a ajouté comme ami`);
    await expect(notification).toBeVisible({ timeout: 10_000 });

    await camillePage.getByRole("button", { name: "Tout marquer comme lu" }).click();
    await expect(camillePage.getByRole("button", { name: "Tout marquer comme lu" })).toHaveCount(0);

    await alexContext.close();
    await camilleContext.close();
  });
});
