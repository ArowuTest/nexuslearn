import { expect, test, type Page } from "@playwright/test";

test.describe.configure({ timeout: 60_000 });

const emptyReadiness = {
  generated_at: "2026-08-18T09:00:00Z",
  totals: {
    objectives: 0,
    ready: 0,
    pilot: 0,
    draft: 0,
    blocked: 0,
    published_activities: 0,
    published_questions: 0,
    formats: 0,
    subjects: [],
  },
  items: [],
};

async function stubAdminAPI(page: Page) {
  await page.route("http://api.test/**", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === "/v1/admin/config") {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          worlds: [{ key: "wonder-garden", name: "Wonder Garden", year_group: 1, theme: "garden", enabled: true }],
          students: [],
          schools: [],
          school_users: [],
          classes: [],
          student_credentials: [],
          groups: [],
          parent_links: [],
          access_requests: [],
          activities: [],
          questions: [],
          reward_rules: [],
          feature_flags: [],
        }),
      });
      return;
    }
    if (url.pathname === "/v1/curriculum/objectives") {
      await route.fulfill({ contentType: "application/json", body: JSON.stringify({ objectives: [] }) });
      return;
    }
    if (url.pathname === "/v1/admin/content/readiness") {
      await route.fulfill({ contentType: "application/json", body: JSON.stringify(emptyReadiness) });
      return;
    }
    if (url.pathname === "/v1/admin/parent-invitations") {
      await route.fulfill({ contentType: "application/json", body: JSON.stringify({ parent_invitations: [] }) });
      return;
    }
    if (url.pathname === "/v1/admin/content/narration-queue") {
      await route.fulfill({ contentType: "application/json", body: JSON.stringify({ items: [], total: 0, counts: {}, limit: 20, offset: 0, next_offset: null }) });
      return;
    }
    if (url.pathname === "/v1/admin/content/reviews" || url.pathname.startsWith("/v1/admin/content/reports/")) {
      await route.fulfill({ contentType: "application/json", body: "null" });
      return;
    }
    if (["/v1/admin/audit", "/v1/admin/content/versions", "/v1/admin/content/releases"].includes(url.pathname)) {
      const collection = url.pathname.endsWith("audit")
        ? { audit_logs: [] }
        : url.pathname.endsWith("versions")
          ? { content_versions: [] }
          : { content_releases: [], live_applied: false };
      await route.fulfill({ contentType: "application/json", body: JSON.stringify(collection) });
      return;
    }
    await route.fulfill({ contentType: "application/json", body: JSON.stringify({}) });
  });
}

async function openAuthenticatedAdmin(page: Page) {
  await stubAdminAPI(page);
  await page.addInitScript(() => {
    sessionStorage.setItem("nexuslearn_account_session", "admin-information-architecture-token");
    sessionStorage.setItem("nexuslearn_account_role", "platform_admin");
    sessionStorage.setItem("nexuslearn_account_session_expires", "2099-01-01T00:00:00Z");
  });
  await page.goto("/admin", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("navigation", { name: "Admin sections" })).toBeVisible({ timeout: 15_000 });
}

test("unauthenticated admin is only the sign-in and bootstrap migration surface", async ({ page }) => {
  await page.goto("/admin", { waitUntil: "domcontentloaded" });

  await expect(page.getByRole("heading", { name: "Admin sign in" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Admin sections" })).toHaveCount(0);
  await expect(page.getByText("Wonder Garden", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Configuration control room", { exact: true })).toHaveCount(0);
  await expect(page.getByText("First-time platform setup", { exact: true })).toBeVisible();
});

test("authenticated admin exposes the eight organised menu groups", async ({ page }) => {
  await openAuthenticatedAdmin(page);

  const navigation = page.getByRole("navigation", { name: "Admin sections" });
  for (const group of [
    "Overview",
    "Organisations",
    "Learners & Progress",
    "Curriculum & Review",
    "Audio & Assets",
    "Releases",
    "Engagement",
    "System & Audit",
  ]) {
    await expect(navigation.getByRole("heading", { name: group, exact: true })).toBeVisible();
  }

  await expect(navigation.getByRole("button", { name: "Overview", exact: true })).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("heading", { name: "Platform overview" })).toBeVisible();
});

test("admin menu supports roving keyboard navigation and representative section switching", async ({ page }) => {
  await openAuthenticatedAdmin(page);

  const navigation = page.getByRole("navigation", { name: "Admin sections" });
  const overview = navigation.getByRole("button", { name: "Overview", exact: true });
  await overview.focus();
  await page.keyboard.press("ArrowDown");
  await expect(navigation.getByRole("button", { name: "Access", exact: true })).toBeFocused();
  await page.keyboard.press("End");
  await expect(navigation.getByRole("button", { name: "Audit", exact: true })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: "Content Version Snapshots" })).toBeVisible();

  await navigation.getByRole("button", { name: "Worlds", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Configured Worlds" })).toBeVisible();
  await navigation.getByRole("button", { name: "Objectives", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Curriculum Objectives" })).toBeVisible();
});
