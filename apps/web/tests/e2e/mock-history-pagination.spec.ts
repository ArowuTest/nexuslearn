import { expect, test } from "@playwright/test";

const mockAssessment = (id: string, title: string) => ({
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
