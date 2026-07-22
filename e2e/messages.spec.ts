import { test, expect } from "@playwright/test";
import { localePath } from "./utils/urls";
import { ensureFriendship } from "./fixtures/db";
import { SAMUEL, CAMILLE } from "./fixtures/test-users";

test.describe("messaging", () => {
  test.beforeAll(async () => {
    await ensureFriendship(SAMUEL.id, CAMILLE.id);
  });

  test("send a message, see it live, and get a read receipt", async ({ browser }) => {
    const samuelContext = await browser.newContext({ storageState: "e2e/.auth/samuel.json" });
    const camilleContext = await browser.newContext({ storageState: "e2e/.auth/camille.json" });
    const samuelPage = await samuelContext.newPage();
    const camillePage = await camilleContext.newPage();

    // Samuel starts a conversation from Camille's profile and sends a first message.
    await samuelPage.goto(localePath("fr", `/profile/${CAMILLE.id}`));
    await samuelPage.getByRole("button", { name: /message/i }).click();
    await expect(samuelPage).toHaveURL(/\/messages\?c=/);

    await samuelPage.getByPlaceholder("Écris un message...").fill("Salut !");
    await samuelPage.getByRole("button", { name: "Envoyer" }).click();
    await expect(samuelPage.getByText("Salut !")).toBeVisible();

    // Camille opens her conversation list fresh — the new conversation shows
    // up with an unread badge (the list itself isn't realtime, only an open
    // thread is).
    await camillePage.goto(localePath("fr", "/messages"));
    const conversationRow = camillePage.getByRole("link", { name: /Samuel Test7/ });
    await expect(conversationRow).toBeVisible();
    await conversationRow.click();
    await expect(camillePage.getByText("Salut !")).toBeVisible();

    // Samuel's open thread should pick up the read receipt live (Realtime
    // UPDATE on messages.read_at), no reload.
    await expect(samuelPage.getByText("Lu", { exact: true })).toBeVisible({ timeout: 10_000 });

    // With both threads open, a second message from Samuel should appear on
    // Camille's side live (Realtime INSERT), no reload.
    await samuelPage.getByPlaceholder("Écris un message...").fill("Ça va ?");
    await samuelPage.getByRole("button", { name: "Envoyer" }).click();
    await expect(camillePage.getByText("Ça va ?")).toBeVisible({ timeout: 10_000 });

    await samuelContext.close();
    await camilleContext.close();
  });
});
