import { expect, test, type Page } from "@playwright/test";

async function openReviewMission(page: Page, switchAccess: boolean, mixed = false) {
  const review = { id: "review-q", question_version: "review-v1", objective_id: "o", response_kind: "review", format: "evidence-link", hints: [], body: { prompt: "Explain the clue." } };
  const number = { id: "number-q", question_version: "number-v1", objective_id: "o", response_kind: "number", format: "number-input", hints: [], body: { prompt: "One plus a quarter?", input: "number" } };
  await page.route("http://api.test/**", route => {
    if (route.request().url().includes("/v1/learning/mission")) return route.fulfill({ json: {
      student_id: "review-pupil", activity: { id: "a", title: "Clue discovery", interaction: {} },
      objective: { id: "o", year: 3, subject: "English" }, world: { key: "explorer-islands", year_group: 3, config: {} },
      runtime_adaptations: { switch_access: switchAccess, animation_tier: "static", reduced_motion: true, celebration_intensity: "quiet", question_limit: 2, scaffold_level: "standard", audio_support: false, reading_support: false, reward_style: "collecting", reasons: [] },
      questions: mixed ? [number, review] : [review],
    }});
    if (route.request().url().endsWith("/v1/learning/attempt")) return route.fulfill({ json: { correct: true, mastery_gain: 6, feedback: "Saved", explanation: "One and a quarter.", projected_score: 6 } });
    return route.fulfill({ status: 404, json: {} });
  });
  await page.goto("/play/mission?studentId=review-pupil&activityId=a");
}

test("switch-only pupils can leave a review boundary using Space", async ({ page }) => {
  await openReviewMission(page, true);
  await expect(page.getByRole("heading", { name: "This question needs a teacher's review" })).toBeVisible();
  // No imperative focus or mouse click: the configured scanner must find it.
  await expect(page.getByRole("link", { name: "Back to worlds" })).toBeFocused();
  await page.keyboard.press("Space");
  await expect(page).toHaveURL(/\/play$/);
});

test("review boundary receives focus after the preceding discovery", async ({ page }) => {
  await openReviewMission(page, false, true);
  await page.getByRole("button", { name: "Keyboard answer", exact: true }).click();
  await page.getByLabel("Keyboard answer", { exact: true }).fill("1.25");
  await page.getByRole("button", { name: "Submit answer", exact: true }).click();
  await page.getByRole("button", { name: "Next discovery" }).click();
  const boundary = page.getByRole("region", { name: "This question needs a teacher's review" });
  await expect(boundary).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Back to worlds" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/play$/);
});
