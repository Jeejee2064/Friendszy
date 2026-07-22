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

  test("send, accept, then remove a friend request", async ({ browser }) => {
    const alexContext = await browser.newContext({ storageState: "e2e/.auth/alex.json" });
    const samuelContext = await browser.newContext({ storageState: "e2e/.auth/samuel.json" });
    const alexPage = await alexContext.newPage();
    const samuelPage = await samuelContext.newPage();

    // Alex sends a request from Samuel's public profile.
    await alexPage.goto(localePath("fr", `/profile/${SAMUEL.id}`));
    await alexPage.getByRole("button", { name: /ajouter/i }).click();
    await expect(alexPage.getByText("Demande envoyée")).toBeVisible();

    // Samuel accepts it from "Demandes reçues".
    await samuelPage.goto(localePath("fr", "/friends?tab=requests"));
    const requestCard = personCard(samuelPage, ALEX.fullName);
    await expect(requestCard).toBeVisible();
    await requestCard.getByRole("button", { name: "Accepter" }).click();

    // Both now see each other in "Mes amis".
    await samuelPage.goto(localePath("fr", "/friends"));
    await expect(personCard(samuelPage, ALEX.fullName)).toBeVisible();

    await alexPage.goto(localePath("fr", "/friends"));
    await expect(personCard(alexPage, SAMUEL.fullName)).toBeVisible();

    // Alex removes Samuel as a friend.
    await personCard(alexPage, SAMUEL.fullName).getByTitle("Retirer").click();
    await expect(personCard(alexPage, SAMUEL.fullName)).toHaveCount(0);

    await samuelPage.reload();
    await expect(personCard(samuelPage, ALEX.fullName)).toHaveCount(0);

    await alexContext.close();
    await samuelContext.close();
  });

  test("declining a request blocks the requester from re-sending", async ({ browser }) => {
    const alexContext = await browser.newContext({ storageState: "e2e/.auth/alex.json" });
    const antoineContext = await browser.newContext({ storageState: "e2e/.auth/antoine.json" });
    const alexPage = await alexContext.newPage();
    const antoinePage = await antoineContext.newPage();

    await alexPage.goto(localePath("fr", `/profile/${ANTOINE.id}`));
    await alexPage.getByRole("button", { name: /ajouter/i }).click();
    await expect(alexPage.getByText("Demande envoyée")).toBeVisible();

    await antoinePage.goto(localePath("fr", "/friends?tab=requests"));
    const requestCard = personCard(antoinePage, ALEX.fullName);
    await expect(requestCard).toBeVisible();
    await requestCard.getByRole("button", { name: "Refuser" }).click();
    await expect(requestCard).toHaveCount(0);

    await alexPage.reload();
    await expect(alexPage.getByText("A décliné ta demande")).toBeVisible();

    await alexContext.close();
    await antoineContext.close();
  });
});
