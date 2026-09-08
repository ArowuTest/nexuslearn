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
    if (url.pathname === "/v1/admin/content/activity-directory") {
      const cursor = url.searchParams.get("cursor");
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          activities: [{ id: cursor ? "activity-2" : "activity-1", title: cursor ? "Second activity" : "First activity", status: "draft", world_key: "wonder-garden", objective_id: "objective-1" }],
          ...(cursor ? {} : { next_cursor: "activity-next" }),
        }),
      });
      return;
    }
    if (url.pathname === "/v1/admin/content/question-directory") {
      await route.fulfill({ contentType: "application/json", body: JSON.stringify({ questions: [] }) });
      return;
    }
    if (url.pathname === "/v1/admin/content/objective-directory") {
      await route.fulfill({ contentType: "application/json", body: JSON.stringify({ objectives: [] }) });
      return;
    }
    if (url.pathname === "/v1/admin/content/reward-directory") {
      await route.fulfill({ contentType: "application/json", body: JSON.stringify({ reward_rules: [] }) });
      return;
    }
    if (url.pathname === "/v1/admin/world-directory") {
      const cursor = url.searchParams.get("cursor");
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          worlds: [{ key: cursor ? "world-2" : "world-1", name: cursor ? "Second World" : "First World", year_group: 3, theme: "adventure", enabled: true }],
          ...(cursor ? {} : { next_cursor: "world-next" }),
        }),
      });
      return;
    }
    if (url.pathname === "/v1/admin/feature-flag-directory") {
      const cursor = url.searchParams.get("cursor");
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          feature_flags: [{ key: cursor ? "flag-2" : "flag-1", enabled: !cursor, description: cursor ? "Second flag" : "First flag", config: {} }],
          ...(cursor ? {} : { next_cursor: "flag-next" }),
        }),
      });
      return;
    }
    if (url.pathname === "/v1/admin/learner-directory") {
      const cursor = url.searchParams.get("student_cursor") || url.searchParams.get("credential_cursor");
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          students: [{ external_ref: cursor ? "second-learner" : "private-learner", display_name: cursor ? "Second Learner" : "Private Learner", year_group: 3 }],
          student_credentials: cursor
            ? [{ student_external_ref: "second-learner", display_name: "Second Learner", login_code: "654321", picture_password: [] }]
            : [{ student_external_ref: "private-learner", display_name: "Private Learner", login_code: "123456", picture_password: [] }],
          ...(cursor ? {} : { student_next_cursor: "student-next", credential_next_cursor: "credential-next" }),
        }),
      });
      return;
    }
    if (url.pathname === "/v1/admin/organisation-directory") {
      const cursor = url.searchParams.get("school_cursor") || url.searchParams.get("school_user_cursor") || url.searchParams.get("class_cursor");
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          schools: [{ id: cursor ? "school-2" : "school-1", name: cursor ? "Second School" : "Private School", urn: cursor ? "second-school" : "private-school", status: "active" }],
          school_users: [{ id: cursor ? "user-2" : "user-1", school_urn: cursor ? "second-school" : "private-school", school_name: cursor ? "Second School" : "Private School", email: cursor ? "teacher2@example.test" : "teacher@example.test", display_name: cursor ? "Second Teacher" : "Private Teacher", role: "teacher", login_id: cursor ? "teacher2" : "teacher", status: "active" }],
          classes: [{ id: cursor ? "class-2" : "class-1", school_urn: cursor ? "second-school" : "private-school", school_name: cursor ? "Second School" : "Private School", name: cursor ? "Second Class" : "Private Class", year_group: 3, students: [] }],
          ...(cursor ? {} : { school_next_cursor: "school-next", school_user_next_cursor: "user-next", class_next_cursor: "class-next" }),
        }),
      });
      return;
    }
    if (url.pathname === "/v1/admin/group-directory") {
      const cursor = url.searchParams.get("cursor");
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          groups: [{ id: cursor ? "group-2" : "group-1", class_id: cursor ? "class-2" : "class-1", class_name: cursor ? "Second Class" : "Private Class", name: cursor ? "Second Group" : "Private Group", purpose: "intervention", students: [] }],
          ...(cursor ? {} : { next_cursor: "group-next" }),
        }),
      });
      return;
    }
    if (url.pathname === "/v1/admin/parent-directory") {
      const linkCursor = url.searchParams.get("parent_link_cursor");
      const invitationCursor = url.searchParams.get("parent_invitation_cursor");
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          parent_links: [{ id: linkCursor ? "link-2" : "link-1", parent_email: linkCursor ? "second@example.test" : "parent@example.test", parent_display_name: linkCursor ? "Second Parent" : "Private Parent", student_external_ref: linkCursor ? "second-learner" : "private-learner", student_display_name: linkCursor ? "Second Learner" : "Private Learner", relationship: "parent", status: "active" }],
          parent_invitations: [{ id: invitationCursor ? "invitation-2" : "invitation-1", parent_email: invitationCursor ? "second@example.test" : "parent@example.test", parent_display_name: invitationCursor ? "Second Parent" : "Private Parent", student_external_ref: invitationCursor ? "second-learner" : "private-learner", relationship: "parent", status: "pending" }],
          ...(linkCursor ? {} : { parent_link_next_cursor: "link-next" }),
          ...(invitationCursor ? {} : { parent_invitation_next_cursor: "invitation-next" }),
        }),
      });
      return;
    }
    if (url.pathname === "/v1/admin/access-request-directory") {
      const cursor = url.searchParams.get("cursor");
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          access_requests: [{ id: cursor ? "request-2" : "request-1", request_type: "school", organisation_name: cursor ? "Second School" : "Private School", contact_name: cursor ? "Second Contact" : "Private Contact", contact_email: "contact@example.test", learner_count: 10, year_groups: [3], status: "new", source: "public_site" }],
          ...(cursor ? {} : { next_cursor: "request-next" }),
        }),
      });
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
    "/v1/admin/content/activity-directory?limit=25",
  ]);
  const navigation = page.getByRole("navigation", { name: "Admin sections" });
  await expect(navigation.getByRole("button", { name: "Learners", exact: true })).toHaveCount(0);
  await expect(navigation.getByRole("button", { name: "Reviews", exact: true })).toHaveCount(0);
  await expect(navigation.getByRole("button", { name: "Worlds", exact: true })).toHaveCount(0);
});

test("content editor appends a bounded activity page with an opaque cursor", async ({ page }) => {
  const requests = await openAdminAs(page, "content_editor", "Activities");
  await expect(page.getByText("First activity", { exact: true })).toBeVisible();
  const loadMore = page.getByRole("button", { name: "Load more", exact: true });
  await expect(loadMore).toBeEnabled();
  await loadMore.click();
  await expect(page.getByText("Second activity", { exact: true })).toBeVisible();
  await expect.poll(() => requests.map((url) => `${url.pathname}?${url.searchParams.toString()}`)).toEqual([
    "/v1/admin/content/activity-directory?limit=25",
    "/v1/admin/content/activity-directory?limit=25&cursor=activity-next",
  ]);
  await expect(page.getByRole("button", { name: "All records loaded", exact: true })).toBeDisabled();
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
    "/v1/admin/organisation-directory",
    "/v1/admin/student-credentials",
    "/v1/admin/parent-links",
    "/v1/admin/access-requests",
  ].includes(url.pathname))).toBe(false);
});

test("platform administrator loads one operational section at a time", async ({ page }) => {
  const requests = await openAdminAs(page, "platform_admin", "Learners");
  await expect(page.getByRole("heading", { name: "Learner Profiles" })).toBeVisible();

  await expect.poll(() => requests.map((url) => `${url.pathname}?${url.searchParams.toString()}`)).toEqual([
    "/v1/admin/learner-directory?limit=25",
  ]);
  await page.getByRole("button", { name: "Flags", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Feature Flags" })).toBeVisible();
  await expect.poll(() => requests.map((url) => `${url.pathname}?${url.searchParams.toString()}`)).toEqual([
    "/v1/admin/learner-directory?limit=25",
    "/v1/admin/feature-flag-directory?limit=25",
  ]);
});

test("platform administrator appends a bounded feature flag page", async ({ page }) => {
  const requests = await openAdminAs(page, "platform_admin", "Flags");
  await expect(page.getByText("flag-1", { exact: true })).toBeVisible();
  const loadMore = page.getByRole("button", { name: "Load more", exact: true });
  await expect(loadMore).toBeEnabled();
  await loadMore.click();
  await expect(page.getByText("flag-2", { exact: true })).toBeVisible();
  await expect.poll(() => requests.map((url) => `${url.pathname}?${url.searchParams.toString()}`)).toEqual([
    "/v1/admin/feature-flag-directory?limit=25",
    "/v1/admin/feature-flag-directory?limit=25&cursor=flag-next",
  ]);
  await expect(page.getByRole("button", { name: "All records loaded", exact: true })).toBeDisabled();
});

test("platform administrator appends a bounded world page", async ({ page }) => {
  const requests = await openAdminAs(page, "platform_admin", "Worlds");
  await expect(page.getByText("First World", { exact: true })).toBeVisible();
  const loadMore = page.getByRole("button", { name: "Load more", exact: true });
  await expect(loadMore).toBeEnabled();
  await loadMore.click();
  await expect(page.getByText("Second World", { exact: true })).toBeVisible();
  await expect.poll(() => requests.map((url) => `${url.pathname}?${url.searchParams.toString()}`)).toEqual([
    "/v1/admin/world-directory?limit=25",
    "/v1/admin/world-directory?limit=25&cursor=world-next",
  ]);
  await expect(page.getByRole("button", { name: "All records loaded", exact: true })).toBeDisabled();
});

test("platform administrator appends the next bounded learner page with opaque cursors", async ({ page }) => {
  const requests = await openAdminAs(page, "platform_admin", "Learners");
  const loadMore = page.getByRole("button", { name: "Load more learner records", exact: true });
  await expect(loadMore).toBeEnabled();
  await loadMore.click();
  await expect(page.getByText("Second Learner", { exact: true }).first()).toBeVisible();
  await expect.poll(() => requests.map((url) => `${url.pathname}?${url.searchParams.toString()}`)).toEqual([
    "/v1/admin/learner-directory?limit=25",
    "/v1/admin/learner-directory?limit=25&student_cursor=student-next&credential_cursor=credential-next",
  ]);
  await expect(loadMore).toBeDisabled();
});

test("platform administrator appends independent organisation pages with opaque cursors", async ({ page }) => {
  const requests = await openAdminAs(page, "platform_admin", "Schools");
  await expect(page.getByRole("heading", { name: "Schools and Classes" })).toBeVisible();
  await expect(page.getByText("Private School", { exact: true })).toBeVisible();
  const loadMore = page.getByRole("button", { name: "Load more organisation records", exact: true });
  await expect(loadMore).toBeEnabled();
  await loadMore.click();
  await expect(page.getByText("Second School", { exact: true })).toBeVisible();
  await expect.poll(() => requests.map((url) => `${url.pathname}?${url.searchParams.toString()}`)).toEqual([
    "/v1/admin/organisation-directory?limit=25",
    "/v1/admin/organisation-directory?limit=25&school_cursor=school-next&school_user_cursor=user-next&class_cursor=class-next",
  ]);
  await expect(loadMore).toBeDisabled();
});

test("platform administrator appends the next bounded teaching-group page", async ({ page }) => {
  const requests = await openAdminAs(page, "platform_admin", "Groups");
  await expect(page.getByRole("heading", { name: "Teaching Groups" })).toBeVisible();
  await expect(page.getByText("Private Group", { exact: true })).toBeVisible();
  const loadMore = page.getByRole("button", { name: "Load more groups", exact: true });
  await expect(loadMore).toBeEnabled();
  await loadMore.click();
  await expect(page.getByText("Second Group", { exact: true })).toBeVisible();
  await expect.poll(() => requests.map((url) => `${url.pathname}?${url.searchParams.toString()}`)).toEqual([
    "/v1/admin/group-directory?limit=25",
    "/v1/admin/group-directory?limit=25&cursor=group-next",
  ]);
  await expect(loadMore).toBeDisabled();
});

test("platform administrator appends independent parent relationship pages", async ({ page }) => {
  const requests = await openAdminAs(page, "platform_admin", "Parents");
  await expect(page.getByRole("heading", { name: "Parent Links" })).toBeVisible();
  await expect(page.getByText("Private Parent", { exact: true }).first()).toBeVisible();
  const loadMore = page.getByRole("button", { name: "Load more parent records", exact: true });
  await expect(loadMore).toBeEnabled();
  await loadMore.click();
  await expect(page.getByText("Second Parent", { exact: true }).first()).toBeVisible();
  await expect.poll(() => requests.map((url) => `${url.pathname}?${url.searchParams.toString()}`)).toEqual([
    "/v1/admin/parent-directory?limit=25",
    "/v1/admin/parent-directory?limit=25&parent_link_cursor=link-next&parent_invitation_cursor=invitation-next",
  ]);
  await expect(loadMore).toBeDisabled();
});

test("platform administrator filters and appends bounded access requests", async ({ page }) => {
  const requests = await openAdminAs(page, "platform_admin", "Access");
  await expect(page.getByRole("heading", { name: "Access Requests" })).toBeVisible();
  const loadMore = page.getByRole("button", { name: "Load more access requests", exact: true });
  await expect(loadMore).toBeEnabled();
  await loadMore.click();
  await expect(page.getByText("Second School", { exact: true }).first()).toBeVisible();
  await expect.poll(() => requests.map((url) => `${url.pathname}?${url.searchParams.toString()}`)).toEqual([
    "/v1/admin/access-request-directory?limit=25",
    "/v1/admin/access-request-directory?limit=25&cursor=request-next",
  ]);
  await expect(loadMore).toBeDisabled();
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
