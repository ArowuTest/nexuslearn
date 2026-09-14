import { expect, type Page } from "@playwright/test";

export async function openAdminNavigation(page: Page) {
  await expect(page.getByRole("button", { name: "Sign out", exact: true })).toBeVisible({ timeout: 15_000 });
  const toggle = page.getByRole("button", { name: /^Sections:/ });
  if (await toggle.isVisible() && await toggle.getAttribute("aria-expanded") === "false") await toggle.click();
  const navigation = page.getByRole("navigation", { name: "Admin sections" });
  await expect(navigation).toBeVisible();
  return navigation;
}

export async function selectAdminSection(page: Page, section: string) {
  const navigation = await openAdminNavigation(page);
  await navigation.getByRole("button", { name: section, exact: true }).click();
}
