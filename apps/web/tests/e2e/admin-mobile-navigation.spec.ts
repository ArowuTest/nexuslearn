import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

async function admin(page: Page, role = "platform_admin", section = "overview") {
  await page.addInitScript((accountRole) => {
    sessionStorage.setItem("nexuslearn_account_session", "navigation-fixture");
    sessionStorage.setItem("nexuslearn_account_role", accountRole);
    sessionStorage.setItem("nexuslearn_account_session_expires", "2099-01-01T00:00:00Z");
  }, role);
  await page.route("http://api.test/**", route => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/v1/admin/content/readiness") return route.fulfill({ json: {
      generated_at: "2026-09-14T12:00:00Z", items: [],
      totals: { objectives: 0, ready: 0, pilot: 0, draft: 0, blocked: 0, published_activities: 0, published_questions: 0, formats: 0, subjects: [] },
    } });
    if (path === "/v1/admin/ai-reviews/summary") return route.fulfill({ json: {
      packs: 0, variants: 0, current_ai_curriculum_lead: 0, current_ai_send_lead: 0,
      stale: 0, revision_required: 0, escalation_required: 0, blocking_findings: 0,
      escalation_findings: 0, controlled_pilot_allowed: false,
    } });
    if (path === "/v1/admin/content/reviews" || path.startsWith("/v1/admin/content/reports/")) return route.fulfill({ json: null });
    return route.fulfill({ json: {
    worlds: [], schools: [], school_users: [], students: [], classes: [], groups: [],
    student_credentials: [], parent_links: [], access_requests: [], activities: [],
    questions: [], reward_rules: [], feature_flags: [], objectives: [], audit_logs: [],
    content_versions: [], content_releases: [], items: [],
    } });
  });
  await page.goto(`/admin?section=${section}`);
  await expect(page.getByRole("button", { name: "Sign out", exact: true })).toBeVisible();
}

test("compact admin menu reveals the workspace first and transfers keyboard focus after selection", async ({ page }, info) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await admin(page);
  const toggle = page.getByRole("button", { name: /^Sections:/ });
  const nav = page.getByRole("navigation", { name: "Admin sections" });
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await expect(nav).not.toBeVisible();
  const overview = page.getByRole("region", { name: "Overview workspace", exact: true });
  expect((await overview.boundingBox())!.y).toBeLessThan(800);
  await toggle.focus();
  await page.keyboard.press("Enter");
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  await expect(nav).toBeVisible();
  await page.keyboard.press("Tab");
  await expect(nav.getByRole("button", { name: "Overview", exact: true })).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await expect(nav.getByRole("button", { name: "Access", exact: true })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("region", { name: "Access workspace", exact: true })).toBeFocused();
  await expect(nav).not.toBeVisible();
  await expect(toggle).toHaveAccessibleName("Sections: Access");
  await expect(page).toHaveURL(/section=access/);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: info.outputPath("admin-compact-320.png"), animations: "disabled", scale: "css" });
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
  expect(results.violations.filter(item => item.impact === "critical" || item.impact === "serious")).toEqual([]);
});

test("Escape closes the compact menu without changing section and restores the toggle focus", async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 900 });
  await admin(page);
  const toggle = page.getByRole("button", { name: /^Sections:/ });
  await toggle.click();
  const nav = page.getByRole("navigation", { name: "Admin sections" });
  await nav.getByRole("button", { name: "Overview", exact: true }).focus();
  await page.keyboard.press("End");
  await expect(nav.getByRole("button", { name: "Audit", exact: true })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(toggle).toBeFocused();
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await expect(page).toHaveURL(/section=overview/);
  await toggle.click();
  await nav.getByRole("button", { name: "Overview", exact: true }).click();
  await expect(page.getByRole("region", { name: "Overview workspace", exact: true })).toBeFocused();
  await expect(nav).not.toBeVisible();
});

test("desktop keeps its sidebar and resizing does not strand keyboard focus in a hidden menu", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await admin(page);
  const toggle = page.getByRole("button", { name: /^Sections:/ });
  const nav = page.getByRole("navigation", { name: "Admin sections" });
  await expect(toggle).not.toBeVisible();
  await expect(nav).toBeVisible();
  const schools = nav.getByRole("button", { name: "Schools", exact: true });
  await schools.click();
  await expect(schools).toBeFocused();
  await expect(schools).toHaveAttribute("aria-current", "page");
  await page.setViewportSize({ width: 320, height: 800 });
  await expect(toggle).toBeVisible();
  await expect(toggle).toBeFocused();
  await expect(nav).not.toBeVisible();
  await toggle.click();
  await page.setViewportSize({ width: 1280, height: 900 });
  await expect(nav).toBeVisible();
  await expect(toggle).not.toBeVisible();
  await expect(schools).toBeFocused();
  await page.setViewportSize({ width: 320, height: 800 });
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await expect(toggle).toBeFocused();
  await toggle.click();
  await nav.getByRole("button", { name: "Audit", exact: true }).focus();
  await page.setViewportSize({ width: 1280, height: 900 });
  await expect(nav.getByRole("button", { name: "Audit", exact: true })).toBeFocused();
});

test("deferred section focus cannot return to a workspace after account invalidation", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.clock.install({ time: new Date("2026-09-14T12:00:00Z") });
  await admin(page);
  await page.getByRole("button", { name: /^Sections:/ }).click();
  await page.clock.pauseAt(new Date("2026-09-14T12:01:00Z"));
  await page.evaluate(() => {
    const schools = [...document.querySelectorAll<HTMLButtonElement>("#admin-navigation button")].find(button => button.textContent === "Schools");
    if (!schools) throw new Error("Schools navigation is missing");
    schools.click();
    sessionStorage.removeItem("nexuslearn_account_session");
    window.dispatchEvent(new Event("nexuslearn-account-session-changed"));
  });
  const login = page.getByLabel("Login ID", { exact: true });
  await expect(login).toBeVisible();
  await login.focus();
  await page.clock.runFor(34);
  await expect(login).toBeFocused();
  await expect(page.getByRole("navigation", { name: "Admin sections", includeHidden: true })).toHaveCount(0);
  await expect(page.getByRole("region", { name: "Schools workspace", exact: true, includeHidden: true })).toHaveCount(0);
});

for (const [role, section, expected] of [
  ["content_editor", "activities", ["Overview", "Objectives", "Activities", "Questions"]],
  ["content_reviewer", "releases", ["Reviews", "Readiness", "Audio", "Releases"]],
] as const) {
  test(`compact menu preserves the ${role} section boundary`, async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 800 });
    await admin(page, role, section);
    const toggle = page.getByRole("button", { name: /^Sections:/ });
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await toggle.click();
    const nav = page.getByRole("navigation", { name: "Admin sections" });
    await expect(nav.getByRole("button")).toHaveText([...expected]);
    await page.getByRole("button", { name: "Sign out", exact: true }).click();
    await expect(page.getByRole("navigation", { name: "Admin sections", includeHidden: true })).toHaveCount(0);
    await expect(toggle).toHaveCount(0);
  });
}
