import { expect, test, type Page } from "@playwright/test";
import type { ParentMockAssessmentHistoryEntry } from "../../src/lib/api";

const mockAssessment = (id: string, title: string, overrides: Record<string, unknown> = {}) => ({
  id,
  student_external_ref: "ava-y3",
  created_by_role: "pupil",
  created_by: "ava-y3",
  subject: "Mathematics",
  year_group: 3,
  year_from: 3,
  year_to: 3,
  title,
  status: "completed",
  question_count: 10,
  duration_minutes: 15,
  include_revision: true,
  include_stretch: false,
  accessibility: {},
  answered_count: 10,
  correct_count: 8,
  score: 80,
  objective_results: [],
  items: [],
  created_at: "2026-08-18T10:00:00Z",
  ...overrides,
});

const parentMockAssessment = (
  id: string,
  title: string,
  overrides: Partial<ParentMockAssessmentHistoryEntry> = {},
): ParentMockAssessmentHistoryEntry => ({
  id,
  subject: "Mathematics",
  year_group: 3,
  title,
  status: "completed",
  question_count: 10,
  answered_count: 10,
  correct_count: 8,
  score: 80,
  objective_results: [],
  created_at: "2026-08-18T10:00:00Z",
  ...overrides,
});

async function seedAccountSession(page: Page, role: "parent" | "school_admin") {
  await page.addInitScript((accountRole) => {
    sessionStorage.setItem("nexuslearn_account_session", `${accountRole}-history-token`);
    sessionStorage.setItem("nexuslearn_account_role", accountRole);
    sessionStorage.setItem("nexuslearn_account_session_expires", "2099-01-01T00:00:00Z");
  }, role);
}

const linkedChild = (externalRef: string, displayName: string, yearGroup: number) => ({
  student: { external_ref: externalRef, display_name: displayName, year_group: yearGroup },
  credential: { student_external_ref: externalRef, login_code: "123456", picture_password: ["star", "book", "sun"] },
  engagement: {
    student_external_ref: externalRef,
    declared_support_needs: [],
    learning_approaches: [],
    celebration_intensity: "balanced",
    audio_support: false,
    reading_support: false,
    session_length: "standard",
    sensory_load: "balanced",
    attention_support: "standard",
    communication_support: "standard",
    processing_support: "standard",
    confidence_support: "balanced",
    companion_style: "friendly",
    reward_style: "world_building",
    interests: [],
    notes: "",
  },
});

test("pupil can load older subject checks without replacing current history", async ({ page }) => {
  await page.addInitScript(() => {
    sessionStorage.setItem("nexuslearn_pupil_session", "test-session");
    sessionStorage.setItem("nexuslearn_pupil_id", "ava-y3");
    sessionStorage.setItem("nexuslearn_pupil_session_expires", "2099-01-01T00:00:00Z");
  });
  await page.route("http://api.test/v1/students/ava-y3/profile", async (route) => {
    await route.fulfill({ contentType: "application/json", body: JSON.stringify({ external_ref: "ava-y3", year_group: 3 }) });
  });
  const requestedCursors: string[] = [];
  await page.route("http://api.test/v1/students/ava-y3/mock-assessments**", async (route) => {
    const cursor = new URL(route.request().url()).searchParams.get("cursor") ?? "";
    requestedCursors.push(cursor);
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(cursor
        ? { mock_assessments: [mockAssessment("mock-older", "Earlier number check")] }
        : { mock_assessments: [mockAssessment("mock-latest", "Latest number check")], next_cursor: "older-page" }),
    });
  });

  await page.goto("/play/mock?studentId=ava-y3");
  await expect(page.getByText("Latest number check")).toBeVisible();
  await page.getByRole("button", { name: "Load older checks" }).click();
  await expect(page.getByText("Earlier number check")).toBeVisible();
  await expect(page.getByText("Latest number check")).toBeVisible();
  expect(requestedCursors).toEqual(["", "older-page"]);
  await expect(page.getByRole("button", { name: "Load older checks" })).not.toBeVisible();
});

test("parent history uses the linked-child endpoint, resets filters and deduplicates older checks", async ({ page }) => {
  await seedAccountSession(page, "parent");
  await page.route("http://api.test/v1/parent/config", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        parent: { email: "parent@example.test", display_name: "Ava's parent", login_id: "ava-parent" },
        children: [linkedChild("ava-y3", "Ava", 3), linkedChild("ben-y5", "Ben", 5)],
      }),
    });
  });

  const requests: Array<{ path: string; authorization: string; subject: string; status: string; cursor: string }> = [];
  await page.route("http://api.test/v1/parent/children/**/mock-assessments**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    requests.push({
      path: url.pathname,
      authorization: request.headers().authorization ?? "",
      subject: url.searchParams.get("subject") ?? "",
      status: url.searchParams.get("status") ?? "",
      cursor: url.searchParams.get("cursor") ?? "",
    });

    if (url.pathname.includes("ben-y5")) {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({ mock_assessments: [parentMockAssessment("ben-latest", "Ben science check", { year_group: 5 })] }),
      });
      return;
    }

    const filtered = url.searchParams.get("subject") === "Science" && url.searchParams.get("status") === "completed";
    if (!filtered) {
      await route.fulfill({ contentType: "application/json", body: JSON.stringify({ mock_assessments: [] }) });
      return;
    }

    const body = url.searchParams.get("cursor")
      ? {
          mock_assessments: [
            parentMockAssessment("ava-shared", "Ava shared science check", { subject: "Science" }),
            parentMockAssessment("ava-older", "Ava older science check", { subject: "Science" }),
          ],
        }
      : {
          mock_assessments: [
            parentMockAssessment("ava-latest", "Ava latest science check", { subject: "Science" }),
            parentMockAssessment("ava-shared", "Ava shared science check", { subject: "Science" }),
          ],
          next_cursor: "ava-older-page",
        };
    await route.fulfill({ contentType: "application/json", body: JSON.stringify(body) });
  });

  await page.goto("/parents");
  await expect(page.getByRole("heading", { name: "Subject check history" })).toBeVisible();
  await page.getByLabel("History subject").selectOption("Science");
  await page.getByLabel("History status").selectOption("completed");
  await expect(page.getByText("Ava latest science check")).toBeVisible();
  await page.getByRole("button", { name: "Load older checks" }).click();

  await expect(page.getByText("Ava older science check")).toBeVisible();
  await expect(page.getByText("Ava latest science check")).toBeVisible();
  await expect(page.getByText("Ava shared science check")).toHaveCount(1);
  await expect(page.getByText("You have reached the end of this history.")).toBeVisible();
  await expect(page.getByText(/does not change adaptive mastery/i).first()).toBeVisible();

  await page.getByLabel("Linked child").selectOption("ben-y5");
  await expect(page.getByText("Ben science check")).toBeVisible();
  await expect(page.getByText("Ava latest science check")).not.toBeVisible();

  expect(requests).toContainEqual({
    path: "/v1/parent/children/ava-y3/mock-assessments",
    authorization: "Bearer parent-history-token",
    subject: "Science",
    status: "completed",
    cursor: "ava-older-page",
  });
  expect(requests).toContainEqual({
    path: "/v1/parent/children/ben-y5/mock-assessments",
    authorization: "Bearer parent-history-token",
    subject: "Science",
    status: "completed",
    cursor: "",
  });
});

test("parent history announces loading, unavailable and empty states", async ({ page }) => {
  await seedAccountSession(page, "parent");
  let releaseLinkedChildren = () => {};
  const linkedChildrenPaused = new Promise<void>((resolve) => { releaseLinkedChildren = resolve; });
  await page.route("http://api.test/v1/parent/config", async (route) => {
    await linkedChildrenPaused;
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        parent: { email: "parent@example.test", display_name: "Ava's parent", login_id: "ava-parent" },
        children: [linkedChild("ava-y3", "Ava", 3)],
      }),
    });
  });

  let releaseFirstRequest = () => {};
  const firstRequestPaused = new Promise<void>((resolve) => { releaseFirstRequest = resolve; });
  let requestCount = 0;
  await page.route("http://api.test/v1/parent/children/ava-y3/mock-assessments**", async (route) => {
    requestCount += 1;
    if (requestCount === 1) {
      await firstRequestPaused;
      await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "History service is unavailable." }) });
      return;
    }
    await route.fulfill({ contentType: "application/json", body: JSON.stringify({ mock_assessments: [] }) });
  });

  await page.goto("/parents");
  await expect(page.getByRole("status")).toHaveText("Loading linked-child history...");
  releaseLinkedChildren();
  await expect(page.getByText("Loading subject check history...")).toBeVisible();
  releaseFirstRequest();
  await expect(page.getByText("History service is unavailable.")).toBeVisible();
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(page.getByText("No subject checks match this learner and these filters yet.")).toBeVisible();
});

test("parent history accepts only linked child context from the family journey", async ({ page }) => {
  await seedAccountSession(page, "parent");
  await page.route("http://api.test/v1/parent/config", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        parent: { email: "parent@example.test", display_name: "Ava's parent", login_id: "ava-parent" },
        children: [linkedChild("ava-y3", "Ava", 3), linkedChild("ben-y5", "Ben", 5)],
      }),
    });
  });
  const requestedChildren: string[] = [];
  await page.route("http://api.test/v1/parent/children/**/mock-assessments**", async (route) => {
    const url = new URL(route.request().url());
    const childRef = url.pathname.split("/").at(-2) ?? "";
    requestedChildren.push(childRef);
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        mock_assessments: [parentMockAssessment(`${childRef}-history`, `${childRef} linked history`)],
      }),
    });
  });

  await page.goto("/parents?child=ben-y5");
  await expect(page.getByLabel("Linked child")).toHaveValue("ben-y5");
  await expect(page.getByText("ben-y5 linked history")).toBeVisible();
  expect(requestedChildren).toEqual(["ben-y5"]);

  requestedChildren.length = 0;
  await page.goto("/parents?child=unlinked-child");
  await expect(page.getByLabel("Linked child")).toHaveValue("ava-y3");
  await expect(page.getByText("ava-y3 linked history")).toBeVisible();
  expect(requestedChildren).toEqual(["ava-y3"]);
  expect(requestedChildren).not.toContain("unlinked-child");
});

test("signed-in parent opens one linked child's history from the family card", async ({ page }) => {
  const historyRequests: string[] = [];
  await page.route("http://api.test/**", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === "/v1/auth/parent-login") {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          parent: { email: "parent@example.test", display_name: "Ava's parent", login_id: "ava-parent" },
          session: { token: "parent-family-token", role: "parent", expires_at: "2099-01-01T00:00:00Z" },
        }),
      });
      return;
    }
    if (url.pathname === "/v1/parent/config") {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          parent: { email: "parent@example.test", display_name: "Ava's parent", login_id: "ava-parent" },
          children: [linkedChild("ava-y3", "Ava", 3), linkedChild("ben-y5", "Ben", 5)],
        }),
      });
      return;
    }
    if (url.pathname.endsWith("/evidence")) {
      await route.fulfill({ contentType: "application/json", body: JSON.stringify({ mastery: [] }) });
      return;
    }
    if (url.pathname.endsWith("/mock-assessments")) {
      historyRequests.push(url.pathname);
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          mock_assessments: [parentMockAssessment("ava-family-history", "Ava family history")],
        }),
      });
      return;
    }
    await route.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ error: `Unhandled ${url.pathname}` }) });
  });

  await page.goto("/family");
  await page.getByLabel("Login ID").fill("ava-parent");
  await page.getByLabel("Password").nth(1).fill("parent-password");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByText("Family workspace loaded.")).toBeVisible();

  await page.getByRole("link", { name: "View Ava's subject check history" }).click();
  await expect(page).toHaveURL(/\/parents\?child=ava-y3$/);
  await expect(page.getByLabel("Linked child")).toHaveValue("ava-y3");
  await expect(page.getByText("Ava family history")).toBeVisible();
  expect(historyRequests).toEqual(["/v1/parent/children/ava-y3/mock-assessments"]);
});

test("school history uses the selected school learner and role-scoped endpoint", async ({ page }) => {
  const historyRequests: Array<{ path: string; authorization: string; studentId: string }> = [];
  await page.route("http://api.test/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.pathname === "/v1/auth/school-login") {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          session: { token: "school-history-token", role: "school_admin", expires_at: "2099-01-01T00:00:00Z" },
        }),
      });
      return;
    }
    if (url.pathname === "/v1/school/config") {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          current_user: { login_id: "teacher-one", display_name: "Teacher One", role: "school_admin", school_urn: "123456" },
          classes: [{ id: "class-1", name: "Class One", year_group: 3, students: [
            { external_ref: "ava-y3", display_name: "Ava", year_group: 3 },
            { external_ref: "ben-y5", display_name: "Ben", year_group: 5 },
          ] }],
          groups: [],
          student_credentials: [],
        }),
      });
      return;
    }
    if (url.pathname === "/v1/school/mock-assessments") {
      const studentId = url.searchParams.get("studentId") ?? "";
      historyRequests.push({
        path: url.pathname,
        authorization: request.headers().authorization ?? "",
        studentId,
      });
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          mock_assessments: [mockAssessment(`${studentId}-history`, `${studentId} subject check`, { student_external_ref: studentId })],
        }),
      });
      return;
    }
    const emptyCollections: Record<string, string> = {
      "/v1/school/assignments": "assignments",
      "/v1/school/evidence": "teacher_evidence",
      "/v1/school/interventions": "interventions",
      "/v1/school/intervention-reviews": "intervention_reviews",
    };
    const collection = emptyCollections[url.pathname];
    if (collection) {
      await route.fulfill({ contentType: "application/json", body: JSON.stringify({ [collection]: [] }) });
      return;
    }
    await route.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ error: `Unhandled ${url.pathname}` }) });
  });

  await page.goto("/school-admin");
  await page.getByLabel("School URN").fill("123456");
  await page.getByLabel("Login ID").fill("teacher-one");
  await page.getByLabel("Temporary password").fill("temporary-password");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByText(/Signed in as Teacher One/)).toBeVisible();

  const pupilSelect = page.locator('select:has(option[value="ava-y3"])');
  await pupilSelect.selectOption("ava-y3");
  await expect(page.getByText("ava-y3 subject check")).toBeVisible();
  await pupilSelect.selectOption("ben-y5");
  await expect(page.getByText("ben-y5 subject check")).toBeVisible();
  await expect(page.getByText("ava-y3 subject check")).not.toBeVisible();

  expect(historyRequests).toEqual([
    { path: "/v1/school/mock-assessments", authorization: "Bearer school-history-token", studentId: "ava-y3" },
    { path: "/v1/school/mock-assessments", authorization: "Bearer school-history-token", studentId: "ben-y5" },
  ]);
});
