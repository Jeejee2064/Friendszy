import { test, expect } from "@playwright/test";
import { localePath } from "./utils/urls";
import { personCard } from "./utils/selectors";
import { resetRelationship } from "./fixtures/db";
import { ALEX, SAMUEL, ANTOINE } from "./fixtures/test-users";

test.describe("friend requests", () => {
  test.beforeAll(async () => {
    await resetRelationship(ALEX.id, SAMUEL.id);
    await resetRelationship(ALEX.id, ANTOINE.id);
  });

  test("adding a friend is instant and one-directional, then removable", async ({ browser }) => {
    const alexContext = await browser.newContext({ storageState: "e2e/.auth/alex.json" });
    const samuelContext = await browser.newContext({ storageState: "e2e/.auth/samuel.json" });
    const alexPage = await alexContext.newPage();
    const samuelPage = await samuelContext.newPage();

    // Alex adds Samuel from his public profile — no acceptance step, the
    // friendship is created (and shows up) immediately.
    await alexPage.goto(localePath("fr", `/profile/${SAMUEL.id}`));
    await alexPage.getByRole("button", { name: /ajouter/i }).click();
    await expect(alexPage.getByText("Ami", { exact: true })).toBeVisible();

    await alexPage.goto(localePath("fr", "/friends"));
    await expect(personCard(alexPage, SAMUEL.fullName)).toBeVisible();

    // One-directional: Samuel never accepted anything, so Alex doesn't show
    // up in Samuel's own list until Samuel adds him back independently.
    await samuelPage.goto(localePath("fr", "/friends"));
    await expect(personCard(samuelPage, ALEX.fullName)).toHaveCount(0);

    // Alex removes Samuel as a friend.
    await personCard(alexPage, SAMUEL.fullName).getByTitle("Retirer").click();
    await expect(personCard(alexPage, SAMUEL.fullName)).toHaveCount(0);

    await alexContext.close();
    await samuelContext.close();
  });

  test("becoming mutual requires both people to add each other", async ({ browser }) => {
    const alexContext = await browser.newContext({ storageState: "e2e/.auth/alex.json" });
    const antoineContext = await browser.newContext({ storageState: "e2e/.auth/antoine.json" });
    const alexPage = await alexContext.newPage();
    const antoinePage = await antoineContext.newPage();

    await alexPage.goto(localePath("fr", `/profile/${ANTOINE.id}`));
    await alexPage.getByRole("button", { name: /ajouter/i }).click();
    await expect(alexPage.getByText("Ami", { exact: true })).toBeVisible();

    // Antoine still doesn't see Alex yet — only Alex added, not the reverse.
    await antoinePage.goto(localePath("fr", "/friends"));
    await expect(personCard(antoinePage, ALEX.fullName)).toHaveCount(0);

    // Antoine adds Alex back, independently.
    await antoinePage.goto(localePath("fr", `/profile/${ALEX.id}`));
    await antoinePage.getByRole("button", { name: /ajouter/i }).click();
    await expect(antoinePage.getByText("Ami", { exact: true })).toBeVisible();

    // Now both sides see each other.
    await antoinePage.goto(localePath("fr", "/friends"));
    await expect(personCard(antoinePage, ALEX.fullName)).toBeVisible();

    await alexPage.goto(localePath("fr", "/friends"));
    await expect(personCard(alexPage, ANTOINE.fullName)).toBeVisible();

    await alexContext.close();
    await antoineContext.close();
  });
});
