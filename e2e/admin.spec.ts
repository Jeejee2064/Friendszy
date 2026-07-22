import { test, expect } from "@playwright/test";
import { localePath } from "./utils/urls";
import { personCard } from "./utils/selectors";
import { seedOpenReport, resetModerationStatus } from "./fixtures/db";
import { ALEX, SOPHIE } from "./fixtures/test-users";

test.use({ storageState: "e2e/.auth/antoine.json" });

test.describe("admin moderation", () => {
  test.beforeAll(async () => {
    // Sophie is a bulk-seeded, non-persona account — safe to suspend/reactivate
    // without affecting any other spec.
    await resetModerationStatus(SOPHIE.id);
    await seedOpenReport(ALEX.id, "profile", SOPHIE.id, "harassment");
  });

  test("triage a profile report: suspend, reactivate, then dismiss", async ({ page }) => {
    await page.goto(localePath("fr", "/admin"));

    const reportCard = personCard(page, SOPHIE.fullName);
    await expect(reportCard).toBeVisible();
    await expect(reportCard.getByText(ALEX.fullName)).toBeVisible();

    // Suspend.
    await reportCard.getByRole("button", { name: "Suspendre" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText("Suspendre ce compte ?")).toBeVisible();
    await dialog.getByRole("button", { name: "Suspendre" }).click();
    await expect(reportCard.getByText("Suspendu")).toBeVisible();
    await expect(reportCard.getByRole("button", { name: "Réactiver" })).toBeVisible();

    // Reactivate — never leave a real account suspended after this test.
    await reportCard.getByRole("button", { name: "Réactiver" }).click();
    await expect(dialog.getByText("Réactiver ce compte ?")).toBeVisible();
    await dialog.getByRole("button", { name: "Réactiver" }).click();
    await expect(reportCard.getByRole("button", { name: "Suspendre" })).toBeVisible();

    // Dismiss so the report doesn't linger in the queue for the next run.
    await reportCard.getByRole("button", { name: "Ignorer" }).click();
    await expect(reportCard).toHaveCount(0);
  });

  test("non-admins are redirected away from /admin", async ({ browser }) => {
    const alexContext = await browser.newContext({ storageState: "e2e/.auth/alex.json" });
    const alexPage = await alexContext.newPage();
    await alexPage.goto(localePath("fr", "/admin"));
    await expect(alexPage).toHaveURL(localePath("fr", "/"));
    await alexContext.close();
  });
});
