import { test, expect } from "@playwright/test";
import { localePath } from "./utils/urls";
import { personCard } from "./utils/selectors";
import { resetRelationship } from "./fixtures/db";
import { ALEX, CAMILLE } from "./fixtures/test-users";

test.describe("notifications", () => {
  test.beforeAll(async () => {
    await resetRelationship(ALEX.id, CAMILLE.id);
  });

  test("a friend-request acceptance shows up as a notification for the requester", async ({
    browser,
  }) => {
    const alexContext = await browser.newContext({ storageState: "e2e/.auth/alex.json" });
    const camilleContext = await browser.newContext({ storageState: "e2e/.auth/camille.json" });
    const alexPage = await alexContext.newPage();
    const camillePage = await camilleContext.newPage();

    await alexPage.goto(localePath("fr", `/profile/${CAMILLE.id}`));
    await alexPage.getByRole("button", { name: /ajouter/i }).click();
    await expect(alexPage.getByText("Demande envoyée")).toBeVisible();

    await camillePage.goto(localePath("fr", "/friends?tab=requests"));
    const requestCard = personCard(camillePage, ALEX.fullName);
    await expect(requestCard).toBeVisible();
    await requestCard.getByRole("button", { name: "Accepter" }).click();

    await alexPage.goto(localePath("fr", "/notifications"));
    const notification = alexPage.getByText(`${CAMILLE.fullName} a accepté ta demande d'ami`);
    await expect(notification).toBeVisible({ timeout: 10_000 });

    await alexPage.getByRole("button", { name: "Tout marquer comme lu" }).click();
    await expect(alexPage.getByRole("button", { name: "Tout marquer comme lu" })).toHaveCount(0);

    await alexContext.close();
    await camilleContext.close();
  });
});
