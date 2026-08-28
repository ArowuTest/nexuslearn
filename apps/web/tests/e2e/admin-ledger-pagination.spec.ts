import { expect, test, type Page, type Route } from "@playwright/test";

test.describe.configure({ timeout: 60_000 });

type LedgerHandler = (route: Route, url: URL) => Promise<void>;

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

async function openAuthenticatedAdmin(page: Page, handleLedger: LedgerHandler) {
  await page.route("http://api.test/**", async (route) => {
    const url = new URL(route.request().url());
    if (["/v1/admin/audit", "/v1/admin/content/versions", "/v1/admin/content/releases"].includes(url.pathname)) {
      await handleLedger(route, url);
      return;
    }
    if (url.pathname === "/v1/admin/config") {
      await route.fulfill({ contentType: "application/json", body: JSON.stringify({}) });
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
    if (url.pathname === "/v1/admin/content/reviews" || url.pathname.startsWith("/v1/admin/content/reports/")) {
      await route.fulfill({ contentType: "application/json", body: "null" });
      return;
    }
    await route.fulfill({ contentType: "application/json", body: JSON.stringify({}) });
  });

  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.evaluate(() => {
    sessionStorage.setItem("nexuslearn_account_session", "admin-ledger-token");
    sessionStorage.setItem("nexuslearn_account_role", "platform_admin");
    sessionStorage.setItem("nexuslearn_account_session_expires", "2099-01-01T00:00:00Z");
  });
  await page.goto("/admin", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("navigation", { name: "Admin sections" })).toBeVisible({ timeout: 15_000 });
}

test("admin ledgers load by section and append unique older rows to an explicit end state", async ({ page }) => {
  const ledgerRequests: string[] = [];
  await openAuthenticatedAdmin(page, async (route, url) => {
    ledgerRequests.push(url.toString());
    expect(url.searchParams.get("limit")).toBe("25");

    if (url.pathname === "/v1/admin/content/versions") {
      const cursor = url.searchParams.get("cursor");
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify(cursor
          ? {
              content_versions: [
                { id: "version-new", content_key: "activity-main", content_type: "activity", status: "draft", version: 4, created_at: "2026-08-18T10:00:00Z" },
                { id: "version-old", content_key: "question-older", content_type: "question", status: "pilot", version: 2, created_at: "2026-08-17T10:00:00Z" },
              ],
            }
          : {
              content_versions: [
                { id: "version-new", content_key: "activity-main", content_type: "activity", status: "draft", version: 4, created_at: "2026-08-18T10:00:00Z" },
              ],
              next_cursor: "versions-page-2",
            }),
      });
      return;
    }

    if (url.pathname === "/v1/admin/audit") {
      const cursor = url.searchParams.get("cursor");
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify(cursor
          ? {
              audit_logs: [
                { id: "audit-new", action: "content.updated", entity_type: "activity", entity_id: "activity-main", created_at: "2026-08-18T10:00:00Z" },
                { id: "audit-old", action: "content.promoted", entity_type: "question", entity_id: "question-older", created_at: "2026-08-17T10:00:00Z" },
              ],
            }
          : {
              audit_logs: [
                { id: "audit-new", action: "content.updated", entity_type: "activity", entity_id: "activity-main", created_at: "2026-08-18T10:00:00Z" },
              ],
              next_cursor: "audit-page-2",
            }),
      });
      return;
    }

    throw new Error(`Unexpected release request: ${url}`);
  });

  expect(ledgerRequests).toEqual([]);

  await page.getByRole("button", { name: "Audit", exact: true }).click();
  await expect(page.getByText("activity-main", { exact: true })).toBeVisible();
  await expect(page.getByText("content.updated", { exact: true })).toBeVisible();
  expect(ledgerRequests).toHaveLength(2);
  expect(ledgerRequests.every((request) => !new URL(request).searchParams.has("cursor"))).toBe(true);

  await page.getByRole("button", { name: "Load older content snapshots" }).click();
  await expect(page.getByText("question-older", { exact: true })).toBeVisible();
  await expect(page.getByText("activity-main", { exact: true })).toHaveCount(1);
  await expect(page.getByText("All content snapshots are loaded.")).toBeVisible();

  await page.getByRole("button", { name: "Load older audit events" }).click();
  await expect(page.getByText("content.promoted", { exact: true })).toBeVisible();
  await expect(page.getByText("content.updated", { exact: true })).toHaveCount(1);
  await expect(page.getByText("All audit events are loaded.")).toBeVisible();

  expect(ledgerRequests.some((request) => new URL(request).searchParams.get("cursor") === "versions-page-2")).toBe(true);
  expect(ledgerRequests.some((request) => new URL(request).searchParams.get("cursor") === "audit-page-2")).toBe(true);

  await page.getByRole("button", { name: "Worlds", exact: true }).click();
  await page.getByRole("button", { name: "Audit", exact: true }).click();
  await expect(page.getByText("question-older", { exact: true })).not.toBeVisible();
  await expect(page.getByText("content.promoted", { exact: true })).not.toBeVisible();
  expect(ledgerRequests.slice(-2).every((request) => !new URL(request).searchParams.has("cursor"))).toBe(true);
});

test("audit ledgers expose independent empty, error and retry outcomes", async ({ page }) => {
  let versionAttempts = 0;
  await openAuthenticatedAdmin(page, async (route, url) => {
    if (url.pathname === "/v1/admin/audit") {
      await route.fulfill({ contentType: "application/json", body: JSON.stringify({ audit_logs: [] }) });
      return;
    }
    if (url.pathname === "/v1/admin/content/versions") {
      versionAttempts += 1;
      if (versionAttempts === 1) {
        await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "Version ledger unavailable" }) });
        return;
      }
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          content_versions: [
            { id: "version-recovered", content_key: "reward-recovered", content_type: "reward_rule", status: "draft", version: 1, created_at: "2026-08-18T11:00:00Z" },
          ],
        }),
      });
      return;
    }
    throw new Error(`Unexpected release request: ${url}`);
  });

  await page.getByRole("button", { name: "Audit", exact: true }).click();
  await expect(page.getByText("No audit events have been recorded yet.")).toBeVisible();
  await expect(page.getByRole("alert").filter({ hasText: "Version ledger unavailable" })).toBeVisible();

  await page.getByRole("button", { name: "Retry content snapshots" }).click();
  await expect(page.getByText("reward-recovered", { exact: true })).toBeVisible();
  await expect(page.getByText("All content snapshots are loaded.")).toBeVisible();
});

test("release ledger loads in Releases and preserves the first page when continuation fails", async ({ page }) => {
  const releaseRequests: URL[] = [];
  let olderAttempts = 0;
  await openAuthenticatedAdmin(page, async (route, url) => {
    if (url.pathname !== "/v1/admin/content/releases") {
      throw new Error(`Unexpected audit request: ${url}`);
    }
    releaseRequests.push(url);
    const cursor = url.searchParams.get("cursor");
    if (cursor) {
      olderAttempts += 1;
      if (olderAttempts === 1) {
        await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "Release continuation unavailable" }) });
        return;
      }
    }
    const release = (id: string, channel: string, status: string) => ({
      id,
      channel,
      status,
      expected_pack_count: 87,
      expected_objective_count: 87,
      expected_activity_count: 87,
      expected_question_count: 174,
      uploaded_pack_count: 87,
      source_revision: "review-source-v1",
      created_at: "2026-08-18T09:00:00Z",
    });
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(cursor
        ? { content_releases: [release("release-new", "review", "staged"), release("release-old", "pilot", "applied")], live_applied: true }
        : { content_releases: [release("release-new", "review", "staged")], next_cursor: "release-page-2", live_applied: true }),
    });
  });

  expect(releaseRequests).toEqual([]);
  await page.getByRole("button", { name: "Releases", exact: true }).click();
  await expect(page.getByText("review / staged", { exact: true })).toBeVisible();
  await expect(page.getByText("live release applied", { exact: true })).toBeVisible();
  expect(releaseRequests).toHaveLength(1);
  expect(releaseRequests[0].searchParams.get("limit")).toBe("25");
  expect(releaseRequests[0].searchParams.has("cursor")).toBe(false);

  await page.getByRole("button", { name: "Load older releases" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Release continuation unavailable" })).toBeVisible();
  await expect(page.getByText("review / staged", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Retry older releases" }).click();
  await expect(page.getByText("pilot / applied", { exact: true })).toBeVisible();
  await expect(page.getByText("review / staged", { exact: true })).toHaveCount(1);
  await expect(page.getByText("All backend releases are loaded.")).toBeVisible();
});
