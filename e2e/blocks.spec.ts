import { test, expect } from "@playwright/test";
import { localePath } from "./utils/urls";
import { personCard } from "./utils/selectors";
import { ensureFriendship } from "./fixtures/db";
import { ANTOINE, CAMILLE } from "./fixtures/test-users";

test.describe("blocking", () => {
  test.beforeAll(async () => {
    await ensureFriendship(ANTOINE.id, CAMILLE.id);
  });

  test("block, live-sync a conversation closed, then unblock", async ({ browser }) => {
    const antoineContext = await browser.newContext({ storageState: "e2e/.auth/antoine.json" });
    const camilleContext = await browser.newContext({ storageState: "e2e/.auth/camille.json" });
    const antoinePage = await antoineContext.newPage();
    const camillePage = await camilleContext.newPage();

    // Open a conversation between them first, so both have it open when the
    // block happens (needed to exercise the live block-sync poll).
    await antoinePage.goto(localePath("fr", `/profile/${CAMILLE.id}`));
    await antoinePage.getByRole("button", { name: /message/i }).click();
    await expect(antoinePage).toHaveURL(/\/messages\?c=/);
    const conversationUrl = antoinePage.url();

    await camillePage.goto(conversationUrl);
    await expect(camillePage.getByPlaceholder("Écris un message...")).toBeVisible();

    // Antoine blocks Camille from her profile page.
    await antoinePage.goto(localePath("fr", `/profile/${CAMILLE.id}`));
    await antoinePage.getByTitle("Bloquer").click();
    const dialog = antoinePage.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "Bloquer" }).click();
    await expect(antoinePage).toHaveURL(localePath("fr", "/friends"));
    await expect(personCard(antoinePage, "Camille Test8")).toHaveCount(0);

    // Camille's still-open conversation pane polls is_blocked_between every
    // 8s and should close itself once it detects the block.
    await expect(camillePage.getByText("Cette conversation n'est plus disponible.")).toBeVisible({
      timeout: 15_000,
    });
    await expect(camillePage).toHaveURL(localePath("fr", "/messages"));

    // Unblocking brings the (still-accepted) friendship back into view.
    await antoinePage.goto(localePath("fr", "/friends?tab=blocked"));
    const blockedRow = personCard(antoinePage, "Camille Test8");
    await expect(blockedRow).toBeVisible();
    await blockedRow.getByRole("button", { name: "Débloquer" }).click();
    await expect(blockedRow).toHaveCount(0);

    await antoinePage.goto(localePath("fr", "/friends"));
    await expect(personCard(antoinePage, "Camille Test8")).toBeVisible();

    await antoineContext.close();
    await camilleContext.close();
  });
});
