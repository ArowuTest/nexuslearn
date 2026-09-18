import { expect, type Locator, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

export async function keyboardFocus(page: Page, control: Locator, colour = "rgb(23, 35, 63)", width = 4, spread = 8) {
  await control.focus();
  await page.keyboard.press("Shift+Tab");
  await page.keyboard.press("Tab");
  await expect(control).toBeFocused();
  await expect(control).toHaveCSS("outline-style", "solid");
  await expect(control).toHaveCSS("outline-color", colour);
  await expect(control).toHaveCSS("outline-offset", "3px");
  const backing = colour === "rgb(0, 255, 255)" ? "rgb(0, 0, 0)" : "rgb(255, 255, 255)";
  await expect(control).toHaveCSS("box-shadow", `${backing} 0px 0px 0px ${spread}px`);
  await expect(control).toHaveCSS("outline-width", `${width}px`);
}

export async function accessibleReflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), "no page-level horizontal scroll").toBe(true);
  const result = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
  const failures = result.violations.filter(item => item.impact === "critical" || item.impact === "serious");
  expect(failures.map(({ id, nodes }) => ({ id, nodes: nodes.map(({ target, failureSummary }) => ({ target, failureSummary })) }))).toEqual([]);
}
