import { expect, test, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";

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

const reviewReadinessItem = {
  objective_id: "ma-y4-times-tables",
  year: 4,
  subject: "Mathematics",
  strand: "Number",
  topic: "Multiplication",
  statement: "Recall multiplication facts up to 12 x 12.",
  parent_explanation: "Practise facts in short bursts.",
  teacher_evidence: "Accurate recall across formats.",
  prerequisites: ["equal groups"],
  misconceptions: ["commutativity confusion"],
  expected_mastery: 82,
  secure_mastery: 94,
  retention_days: [1, 3, 7],
  required_formats: ["timed-recall", "multiple_choice"],
  status: "pilot",
  score: 80,
  activity_count: 1,
  published_activity_count: 1,
  question_count: 3,
  published_question_count: 3,
  format_count: 2,
  formats: ["multiple_choice"],
  missing: [],
  warnings: [],
};

async function stubReviewReadiness(page: Page) {
  await page.route("http://api.test/v1/admin/content/readiness", route => route.fulfill({
    contentType: "application/json",
    body: JSON.stringify({
      ...emptyReadiness,
      totals: { ...emptyReadiness.totals, objectives: 1 },
      items: [reviewReadinessItem],
    }),
  }));
}

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
    if (url.pathname === "/v1/admin/content/objective-directory") {
      await route.fulfill({ contentType: "application/json", body: JSON.stringify({ objectives: [] }) });
      return;
    }
    if (url.pathname === "/v1/admin/content/readiness") {
      await route.fulfill({ contentType: "application/json", body: JSON.stringify(emptyReadiness) });
      return;
    }
    if (url.pathname === "/v1/admin/content/releases/preflight") {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          release_id: "nexuslearn-live-test",
          manifest_sha256: "a".repeat(64),
          evidence_ready: false,
          ai: { current_ai_curriculum_lead: 0, current_ai_send_lead: 0, missing_lane_count: 2, stale_count: 0 },
          checks: [
            { code: "ai_review", passed: false, message: "current approval from both AI review lanes" },
            { code: "safeguarding", passed: false, message: "independent human safeguarding approval" },
            { code: "audio_release", passed: false, message: "the exact technically valid audio release and catalogue" },
            { code: "audio_listening", passed: false, message: "human listening approval for every required audio asset" },
            { code: "child_pilot", passed: false, message: "recorded real-child pilot evidence" },
          ],
        }),
      });
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

test("readiness puts teacher evidence and SEND review context beside the decision surface", async ({ page }) => {
  await openAuthenticatedAdmin(page);
  await page.route("http://api.test/v1/curriculum/objectives", route => route.fulfill({
    contentType: "application/json",
    body: JSON.stringify({ objectives: [] }),
  }));
  await page.route("http://api.test/v1/admin/content/readiness", route => route.fulfill({
    contentType: "application/json",
    body: JSON.stringify({
      ...emptyReadiness,
      totals: { ...emptyReadiness.totals, objectives: 1 },
      items: [{
        objective_id: "ma-y4-times-tables",
        year: 4,
        subject: "Mathematics",
        strand: "Number",
        topic: "Multiplication",
        statement: "Recall multiplication facts up to 12 x 12.",
        parent_explanation: "Practise facts in short bursts.",
        teacher_evidence: "Accurate recall across formats.",
        prerequisites: ["equal groups"],
        misconceptions: ["commutativity confusion"],
        expected_mastery: 80,
        secure_mastery: 90,
        retention_days: [1, 3, 7],
        required_formats: ["timed-recall", "multiple_choice"],
        status: "pilot",
        score: 80,
        activity_count: 1,
        published_activity_count: 1,
        question_count: 3,
        published_question_count: 3,
        format_count: 2,
        formats: ["timed-recall", "multiple_choice"],
        missing: [],
        warnings: [],
      }],
    }),
  }));

  await page.getByRole("button", { name: "Readiness", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Curriculum Content Readiness" })).toBeVisible();
  await expect(page.getByRole("complementary", { name: "Review context for ma-y4-times-tables" })).toBeVisible();
  await expect(page.getByText("Accurate recall across formats.", { exact: true })).toBeVisible();
  await expect(page.getByText(/Expected 80% · secure 90%/)).toBeVisible();
  await expect(page.getByText(/keyboard-operable equivalent response route/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Open learner progress" })).toBeVisible();
  await page.getByRole("button", { name: "Open learner progress" }).click();
  await expect(page.getByRole("heading", { name: "Learner progress lookup" })).toBeVisible();
});

for (const button of ["Open objective", "Open objective record"]) {
  test(`readiness ${button} preserves the complete objective when saving`, async ({ page }) => {
    await openAuthenticatedAdmin(page);
    await stubReviewReadiness(page);
    await page.route(`http://api.test/v1/admin/curriculum/objectives/${reviewReadinessItem.objective_id}`, route => route.fulfill({
      contentType: "application/json", body: "{}",
    }));
    await page.getByRole("button", { name: "Readiness", exact: true }).click();
    await page.getByRole("button", { name: button, exact: true }).click();
    await expect(page.getByRole("heading", { name: "Objective Editor" })).toBeVisible();
    await expect(page.getByLabel("Teacher evidence", { exact: true })).toHaveValue(reviewReadinessItem.teacher_evidence);
    await expect(page).toHaveURL(/section=objectives/);
    await expect(page.getByLabel("Parent explanation", { exact: true })).toHaveValue(reviewReadinessItem.parent_explanation);
    const saved = page.waitForRequest(request => request.method() === "PUT" && request.url().endsWith(`/curriculum/objectives/${reviewReadinessItem.objective_id}`));
    await page.getByRole("button", { name: "Save", exact: true }).click();
    expect((await saved).postDataJSON()).toEqual({
      id: reviewReadinessItem.objective_id,
      year: reviewReadinessItem.year,
      subject: reviewReadinessItem.subject,
      strand: reviewReadinessItem.strand,
      topic: reviewReadinessItem.topic,
      statement: reviewReadinessItem.statement,
      parent_explanation: reviewReadinessItem.parent_explanation,
      teacher_evidence: reviewReadinessItem.teacher_evidence,
      prerequisites: reviewReadinessItem.prerequisites,
      misconceptions: reviewReadinessItem.misconceptions,
      mastery: {
        expected: reviewReadinessItem.expected_mastery,
        secure: reviewReadinessItem.secure_mastery,
        retention_days: reviewReadinessItem.retention_days,
        required_formats: reviewReadinessItem.required_formats,
      },
    });
  });
}

test("a direct release review resolves objective context without visiting the objective directory", async ({ page }) => {
  await openAuthenticatedAdmin(page);
  await stubReviewReadiness(page);
  let directoryRequests = 0;
  page.on("request", request => {
    if (request.url().includes("/objective-directory")) directoryRequests++;
  });
  await page.route("http://api.test/v1/admin/content/reports/pilot-review-batch", route => route.fulfill({
    contentType: "application/json",
    body: JSON.stringify({
      status: "human_review_pending", batch_id: "review-context-test", operator_guidance: [], decision_policy: {},
      totals: { packs: 2, review_candidates: 2, recommended_first_pass: 2, runtime_variants: 0, pilot_target: 2, release_blockers: 2, audio_qa_required: 0 },
      packs: [reviewReadinessItem.objective_id, "unknown-objective"].map(pack_id => ({
        pack_id, year: 4, subject: "Mathematics", queue_rank: 1, runtime_variants: 0, review_candidates: 1, pilot_target: 1,
        recommended_first_pass: 1, audio_qa_required: false, renderer_acceptance_required: false,
        first_action: "Review teacher evidence.", blockers: [], lanes: [], evidence_required: [], decision_outputs: [],
      })),
    }),
  }));
  await page.goto("/admin?section=releases", { waitUntil: "domcontentloaded" });
  const context = page.getByRole("complementary", { name: `Review context for ${reviewReadinessItem.objective_id}` });
  await expect(context.getByText(reviewReadinessItem.teacher_evidence, { exact: true })).toBeVisible();
  await expect(context.getByText(/Expected 82% · secure 94%/)).toBeVisible();
  const unmatched = page.getByRole("complementary", { name: "Review context for unknown-objective" });
  await expect(unmatched.getByText(/No live objective matched/)).toBeVisible();
  await expect(unmatched.getByRole("button", { name: "Open objective record" })).toHaveCount(0);
  expect(directoryRequests).toBe(0);
  await context.getByRole("button", { name: "Open objective record" }).click();
  await expect(page.getByLabel("Teacher evidence", { exact: true })).toHaveValue(reviewReadinessItem.teacher_evidence);
  await expect(page).toHaveURL(/section=objectives/);
});

test("release workspace runs a read-only backend preflight and shows every blocker", async ({ page }) => {
  await openAuthenticatedAdmin(page);
  await page.getByRole("button", { name: "Releases", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Live release preflight" })).toBeVisible();
  await page.getByLabel("Live release manifest JSON").fill(JSON.stringify({ channel: "live", id: "nexuslearn-live-test", manifest_sha256: "a".repeat(64) }));
  await page.getByRole("button", { name: "Run read-only preflight" }).click();
  await expect(page.getByText("Evidence blocked", { exact: true })).toBeVisible();
  const checks = page.getByRole("list", { name: "Release evidence checks" });
  for (const code of ["ai review", "safeguarding", "audio release", "audio listening", "child pilot"]) {
    await expect(checks.getByText(code, { exact: true })).toBeVisible();
  }
});

test("admin downloads reports with authentication and fails closed when the report API rejects access", async ({ page }) => {
  await openAuthenticatedAdmin(page);
  await page.route("http://api.test/v1/admin/content/reports/**", async route => {
    if (route.request().headers().authorization !== "Bearer admin-information-architecture-token") {
      return route.fulfill({ status: 401, json: { error: "Sign in required" } });
    }
    const name = new URL(route.request().url()).pathname.split("/").at(-1);
    const report = JSON.parse(await readFile(`private/content/${name}.json`, "utf8"));
    await route.fulfill({ json: report });
  });
  await page.getByRole("navigation", { name: "Admin sections" }).getByRole("button", { name: "Readiness", exact: true }).click();
  const button = page.getByRole("button", { name: "Download depth report" });
  await expect(button).toBeVisible();
  const downloaded = page.waitForEvent("download");
  await button.click();
  const file = await downloaded;
  expect(file.suggestedFilename()).toBe("pack-depth-readiness.json");
  const saved = JSON.parse(await readFile((await file.path())!, "utf8"));
  expect(saved.totals.packs).toBe(87);

  await page.route("http://api.test/v1/admin/content/reports/pack-depth-readiness", route =>
    route.fulfill({ status: 401, json: { error: "Session expired" } }));
  const publicRequests: string[] = [];
  page.on("request", request => { if (new URL(request.url()).pathname.startsWith("/content/")) publicRequests.push(request.url()); });
  await button.click();
  await expect(page.getByText("Report download unavailable. Check your admin session and try again.")).toBeVisible();
  expect(publicRequests).toEqual([]);
});
