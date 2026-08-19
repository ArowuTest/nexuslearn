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
        ? { students: [], student_credentials: [] }
        : selected === "activities"
          ? { activities: [] }
          : selected === "questions"
            ? { questions: [] }
            : {};
      await route.fulfill({ contentType: "application/json", body: JSON.stringify(body) });
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
  expect(requests.filter((url) => url.pathname === "/v1/admin/ai-reviews")).toHaveLength(2);
  expect(requests.filter((url) => url.pathname === "/v1/admin/ai-reviews/summary")).toHaveLength(2);
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
