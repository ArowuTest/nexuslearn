import { expect, test, type Page } from "@playwright/test";

async function rewardFixture(page: Page) {
  await page.route("http://api.test/**", route => route.fulfill({ status: 404, json: { error: "No optional progress fixture" } }));
  await page.route("http://api.test/v1/runtime/flags", route => route.fulfill({ json: { flags: { child_play_enabled: true } } }));
  await page.route("http://api.test/v1/learning/event", route => route.fulfill({ json: {} }));
  await page.route("http://api.test/v1/learning/mission**", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        student_id: "reward-learner",
        activity: {
          id: "act-reward",
          objective_id: "ma-y3-number-recall-3-4-8-tables",
          template_id: "timed-recall",
          world_key: "explorer-islands",
          title: "Collection Expedition",
          prompt: "Find the next learning artefact.",
          difficulty: 2,
          interaction: {},
          feedback: {},
          animation_hooks: {},
          status: "published",
        },
        objective: {
          id: "ma-y3-number-recall-3-4-8-tables",
          year: 3,
          subject: "Mathematics",
          strand: "Number",
          topic: "Multiplication",
          statement: "Recall selected multiplication facts.",
          prerequisites: [],
          misconceptions: [],
          mastery: { expected: 80, secure: 90, retention_days: [1, 3, 7], required_formats: ["timed-recall"] },
          parent_explanation: "Can recall selected multiplication facts.",
          teacher_evidence: "Explains a fact using a known grouping or related fact.",
        },
        world: {
          key: "explorer-islands",
          name: "Explorer Islands",
          year_group: 3,
          theme: "Evidence-led exploration",
          config: { accent: "#55cbd3", companion: "Nixi Explorer", focus: "Collect clues by explaining your thinking." },
          enabled: true,
        },
        world_state: { student_id: "reward-learner", world_key: "explorer-islands", state: { artefacts: [] }, updated_at: "" },
        questions: [{
          id: "q-reward",
          activity_id: "act-reward",
          objective_id: "ma-y3-number-recall-3-4-8-tables",
          format: "timed-recall",
          body: { prompt: "What is 3 × 4?", a: 3, b: 4, input: "number" },
          question_version: "fixture-version",
          response_kind: "number",
          hints: ["Think of three groups of four."],
          explanation: "Three groups of four make twelve.",
          difficulty: 2,
          status: "published",
        }],
        runtime_adaptations: {
          animation_tier: "standard",
          reduced_motion: false,
          celebration_intensity: "balanced",
          session_length: "short",
          question_limit: 1,
          scaffold_level: "standard",
          audio_support: false,
          reading_support: false,
          companion_style: "friendly",
          reward_style: "collecting",
          reasons: [],
        },
      }),
    });
  });

  await page.route("http://api.test/v1/learning/attempt", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        correct: true,
        mastery_gain: 8,
        projected_score: 68,
        projected_band: "Nearly secure",
        next_review_days: 3,
        reward_hook: "island-compass-fragment",
        animation_hook: "compass-shimmer",
        feedback: "Correct. You found the next compass fragment.",
        explanation: "Three groups of four make twelve.",
        evidence_event: "objective_pack_attempt_correct",
        companion_prompt: "Explain how you knew.",
      }),
    });
  });

}

test("mission renders the learner reward style and backend reward moment", async ({ page }, testInfo) => {
  await rewardFixture(page);
  await page.goto("/play/mission?studentId=reward-learner");
  await expect(page.getByTestId("mission-reward-track")).toContainText("Collection route");
  await page.getByTestId("mission-reward-track").scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath("journey-start.png"), animations: "disabled" });
  await page.getByRole("button", { name: "Keyboard answer" }).click();
  await page.getByLabel("Keyboard answer").fill("12");
  await page.getByRole("button", { name: "Submit answer" }).click();
  await expect(page.getByTestId("mission-reward-moment")).toContainText("Compass fragment collected");
  await page.screenshot({ path: testInfo.outputPath("journey-reward.png"), animations: "disabled" });
});

for (const reduce of [false, true]) test(`mission hatch ${reduce ? "honours OS reduced motion" : "keeps normal celebration motion"} with a standard pupil profile`, async ({ page }) => {
  await page.emulateMedia({ reducedMotion: reduce ? "reduce" : "no-preference" });
  await rewardFixture(page);
  await page.goto("/play/mission?studentId=reward-learner");
  await page.getByRole("button", { name: "Keyboard answer" }).click();
  await page.getByLabel("Keyboard answer").fill("12");
  await page.getByRole("button", { name: "Submit answer" }).click();
  await page.getByRole("button", { name: "See my discoveries", exact: true }).click();
  const confetti = page.locator(".pointer-events-none.fixed.inset-0[aria-hidden] > span");
  await expect(confetti).toHaveCount(28);
  await expect(confetti.first()).toHaveCSS("animation-name", reduce ? "none" : "confetti-fall");
  await expect(page.getByRole("link", { name: "Back to my route", exact: true })).toBeVisible();
});
