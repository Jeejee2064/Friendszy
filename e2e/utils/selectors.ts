import type { Page } from "@playwright/test";

/**
 * PersonCard (src/components/social/person-card.tsx) has no data-testid,
 * so we scope interactions to its outer wrapper via the person's name.
 */
export function personCard(page: Page, name: string) {
  return page.locator(".rounded-2xl.border.border-border.bg-card.p-4").filter({ hasText: name });
}

/**
 * GroupCard (src/components/groups/group-card.tsx) has no data-testid either,
 * and happens to share PersonCard's exact wrapper classes — same scoping.
 */
export function groupCard(page: Page, name: string) {
  return page.locator(".rounded-2xl.border.border-border.bg-card.p-4").filter({ hasText: name });
}
