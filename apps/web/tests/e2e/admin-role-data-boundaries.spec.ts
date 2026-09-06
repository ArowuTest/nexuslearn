import { expect, test, type Page } from "@playwright/test";

test.describe.configure({ timeout: 60_000 });

type AdminRole = "platform_admin" | "content_editor" | "content_reviewer";

async function openAdminAs(page: Page, role: AdminRole, section: string) {
  const requests: URL[] = [];
  await page.route("http://api.test/**", async (route) => {
    const url = new URL(route.request().url());
    requests.push(url);
    if (url.pathname === "/v1/admin/config") {
      const selected = url.searchParams.get("section");
      const body = selected === "learners"
        ? { students: [{ external_ref: "private-learner", display_name: "Private Learner", year_group: 3 }], student_credentials: [] }
        : selected === "activities"
          ? { activities: [] }
          : selected === "questions"
            ? { questions: [] }
            : {};
      await route.fulfill({ contentType: "application/json", body: JSON.stringify(body) });
      return;
    }
    if (url.pathname === "/v1/admin/content/readiness") {
      await route.fulfill({ contentType: "application/json", body: JSON.stringify({ totals: { ready: 0, pilot: 0, draft: 0, blocked: 0 }, items: [] }) });
      return;
    }
    if (url.pathname === "/v1/admin/content/narration-queue") {
      await route.fulfill({ contentType: "application/json", body: JSON.stringify({ items: [], total: 0, counts: { awaiting: 0, approved: 0, rejected: 0, stale: 0 }, years: [], limit: 20, offset: 0, next_offset: null }) });
      return;
    }
    if (url.pathname.startsWith("/v1/admin/content/reports/") || url.pathname === "/v1/admin/content/reviews") {
      await route.fulfill({ contentType: "application/json", body: "null" });
      return;
    }
    if (url.pathname === "/v1/admin/content/releases") {
      await route.fulfill({ contentType: "application/json", body: JSON.stringify({ content_releases: [], live_applied: false }) });
      return;
    }
    if (url.pathname === "/v1/admin/ai-reviews") {
      await route.fulfill({ contentType: "application/json", body: JSON.stringify({ items: [] }) });
      return;
    }
    if (url.pathname === "/v1/admin/ai-reviews/summary") {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          packs: 0,
          variants: 0,
          current_ai_curriculum_lead: 0,
          current_ai_send_lead: 0,
          stale: 0,
          revision_required: 0,
          escalation_required: 0,
          blocking_findings: 0,
          escalation_findings: 0,
          controlled_pilot_allowed: false,
        }),
      });
      return;
    }
    await route.fulfill({ contentType: "application/json", body: JSON.stringify({}) });
  });
  await page.addInitScript((accountRole) => {
    sessionStorage.setItem("nexuslearn_account_session", `admin-role-${accountRole}`);
    sessionStorage.setItem("nexuslearn_account_role", accountRole);
    sessionStorage.setItem("nexuslearn_account_session_expires", "2099-01-01T00:00:00Z");
  }, role);
  await page.goto(`/admin?section=${section}`, { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("navigation", { name: "Admin sections" })).toBeVisible({ timeout: 15_000 });
  return requests;
}

test("content editor loads only the selected curriculum-authoring section", async ({ page }) => {
  const requests = await openAdminAs(page, "content_editor", "Activities");
  await expect(page.getByRole("heading", { name: "Configured Activities" })).toBeVisible();

  await expect.poll(() => requests.map((url) => `${url.pathname}?${url.searchParams.toString()}`)).toEqual([
    "/v1/admin/config?section=activities",
  ]);
  const navigation = page.getByRole("navigation", { name: "Admin sections" });
  await expect(navigation.getByRole("button", { name: "Learners", exact: true })).toHaveCount(0);
  await expect(navigation.getByRole("button", { name: "Reviews", exact: true })).toHaveCount(0);
  await expect(navigation.getByRole("button", { name: "Worlds", exact: true })).toHaveCount(0);
});

test("content reviewer enters review without configuration or personal-data requests", async ({ page }) => {
  const requests = await openAdminAs(page, "content_reviewer", "Reviews");
  await expect(page.getByRole("heading", { name: "Curriculum and SEND review" })).toBeVisible();

  await expect.poll(() => [...new Set(requests.map((url) => url.pathname))].sort()).toEqual([
    "/v1/admin/ai-reviews",
    "/v1/admin/ai-reviews/summary",
  ]);
  // React Strict Mode replays mount effects only in development. Production
  // must make one read per resource, without adding any personal-data request.
  const mountReads = process.env.PLAYWRIGHT_SERVER_MODE === "production" ? 1 : 2;
  expect(requests.filter((url) => url.pathname === "/v1/admin/ai-reviews")).toHaveLength(mountReads);
  expect(requests.filter((url) => url.pathname === "/v1/admin/ai-reviews/summary")).toHaveLength(mountReads);
  expect(requests.some((url) => [
    "/v1/admin/config",
    "/v1/admin/students",
    "/v1/admin/schools",
    "/v1/admin/student-credentials",
    "/v1/admin/parent-links",
    "/v1/admin/access-requests",
  ].includes(url.pathname))).toBe(false);
});

test("platform administrator loads one operational section at a time", async ({ page }) => {
  const requests = await openAdminAs(page, "platform_admin", "Learners");
  await expect(page.getByRole("heading", { name: "Learner Profiles" })).toBeVisible();

  await expect.poll(() => requests.map((url) => `${url.pathname}?${url.searchParams.toString()}`)).toEqual([
    "/v1/admin/config?section=learners",
  ]);
  await page.getByRole("button", { name: "Flags", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Feature Flags" })).toBeVisible();
  await expect.poll(() => requests.map((url) => `${url.pathname}?${url.searchParams.toString()}`)).toEqual([
    "/v1/admin/config?section=learners",
    "/v1/admin/config?section=flags",
  ]);
});

test("readiness and release workspaces load only their own report families", async ({ page }) => {
  const readinessRequests = await openAdminAs(page, "platform_admin", "Readiness");
  await expect.poll(() => [...new Set(readinessRequests.map((url) => url.pathname))].sort()).toEqual([
    "/v1/admin/content/readiness",
    "/v1/admin/content/reports/asset-production-readiness",
    "/v1/admin/content/reports/curriculum-area-coverage",
    "/v1/admin/content/reports/flagship-review",
    "/v1/admin/content/reports/interaction-renderer-readiness",
    "/v1/admin/content/reports/narration-readiness",
    "/v1/admin/content/reports/pack-depth-readiness",
  ]);

  const audioPage = await page.context().newPage();
  const audioRequests = await openAdminAs(audioPage, "platform_admin", "Audio");
  await expect.poll(() => [...new Set(audioRequests.map((url) => url.pathname))].sort()).toEqual([
    "/v1/admin/content/narration-queue",
    "/v1/admin/content/reports/narration-readiness",
  ]);

  const releasePage = await page.context().newPage();
  const releaseRequests = await openAdminAs(releasePage, "platform_admin", "Releases");
  await expect.poll(() => [...new Set(releaseRequests.map((url) => url.pathname))].sort()).toEqual([
    "/v1/admin/content/readiness",
    "/v1/admin/content/releases",
    "/v1/admin/content/reports/content-release-snapshot",
    "/v1/admin/content/reports/pilot-review-batch",
    "/v1/admin/content/reports/pilot-review-evidence-check",
    "/v1/admin/content/reports/pilot-review-evidence-template",
    "/v1/admin/content/reports/runtime-spine-enhancement",
    "/v1/admin/content/reports/variant-production-queue",
    "/v1/admin/content/reviews",
  ]);
});

test("admin logout clears private state even when the logout request fails", async ({ page }) => {
  await openAdminAs(page, "platform_admin", "Learners");
  await expect(page.getByText("Private Learner", { exact: true })).toBeVisible();
  await page.route("http://api.test/v1/auth/logout", (route) => route.abort("connectionfailed"));
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page.getByRole("navigation", { name: "Admin sections" })).toHaveCount(0);
  await expect(page.getByText("Private Learner", { exact: true })).toHaveCount(0);
  expect(await page.evaluate(() => sessionStorage.getItem("nexuslearn_account_session"))).toBeNull();
});
