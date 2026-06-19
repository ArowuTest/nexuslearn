import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

type RendererQuestion = {
  id: string;
  format: string;
  prompt: string;
  body: Record<string, unknown>;
  expected: string;
};

async function routeMission(page: Page, question: RendererQuestion) {
  await page.route("http://api.test/v1/learning/mission**", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        student_id: "renderer-learner",
        activity: {
          id: "renderer-activity",
          objective_id: "renderer-objective",
          template_id: question.format,
          world_key: "future-forge",
          title: "Renderer acceptance mission",
          prompt: question.prompt,
          difficulty: 3,
          interaction: {},
          feedback: {},
          animation_hooks: {},
          status: "published",
        },
        objective: {
          id: "renderer-objective",
          year: 7,
          subject: "Science",
          strand: "Models",
          topic: "Representations",
          statement: "Use and explain a learning model.",
          prerequisites: [],
          misconceptions: [],
          mastery: { expected: 80, secure: 90, retention_days: [1, 7, 30], required_formats: [question.format] },
          parent_explanation: "",
          teacher_evidence: "",
        },
        world: {
          key: "future-forge",
          name: "Future Forge",
          year_group: 7,
          theme: "Model and explain",
          config: { accent: "#7fe7d7", companion: "Nixi Core" },
          enabled: true,
        },
        world_state: { student_id: "renderer-learner", world_key: "future-forge", state: { artefacts: [] }, updated_at: "" },
        questions: [{
          id: question.id,
          activity_id: "renderer-activity",
          objective_id: "renderer-objective",
          format: question.format,
          body: { prompt: question.prompt, ...question.body },
          expected_answer: { value: question.expected },
          hints: ["Inspect the model carefully."],
          explanation: "The model provides evidence for the answer.",
          difficulty: 3,
          status: "published",
        }],
        runtime_adaptations: {
          animation_tier: "low",
          reduced_motion: true,
          celebration_intensity: "quiet",
          session_length: "short",
          question_limit: 3,
          scaffold_level: "chunked",
          audio_support: false,
          reading_support: true,
          companion_style: "calm",
          reward_style: "world_building",
          reasons: ["Renderer acceptance profile."],
        },
      }),
    });
  });
}

async function expectNoSeriousAxeViolations(page: Page) {
  const accessibility = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(accessibility.violations.filter((item) => item.impact === "critical" || item.impact === "serious")).toEqual([]);
}

test("particle renderer exposes model meaning and keyboard energy control", async ({ page }) => {
  await routeMission(page, {
    id: "particle-question",
    format: "particle-simulation",
    prompt: "Increase the energy until the particles behave like a gas.",
    body: {
      choices: ["solid", "liquid", "gas"],
    },
    expected: "gas",
  });
  await page.goto("/play/mission?studentId=renderer-learner");

  await expect(page.getByRole("group", { name: "Particle model comparison" })).toBeVisible();
  for (const state of ["solid", "liquid", "gas"]) {
    await expect(page.getByRole("img", { name: `${state} particle model` })).toBeVisible();
  }
  const energy = page.getByRole("slider", { name: "Particle energy" });
  await energy.focus();
  await page.keyboard.press("End");
  await expect(page.getByText(/model now behaves like a gas/i)).toBeVisible();
  await expectNoSeriousAxeViolations(page);
});

test("sentence renderer exposes named cards and keyboard selection", async ({ page }) => {
  await routeMission(page, {
    id: "sentence-question",
    format: "sentence-sort",
    prompt: "Which sentence belongs in the opening paragraph?",
    body: {
      choices: [
        "The storm arrived before the boats returned.",
        "Later, the harbour became calm again.",
        "This detail belongs in the conclusion.",
      ],
    },
    expected: "The storm arrived before the boats returned.",
  });
  await page.goto("/play/mission?studentId=renderer-learner");

  const cards = page.getByRole("group", { name: "Sentence and paragraph cards" });
  await expect(cards).toBeVisible();
  const firstCard = page.getByRole("button", { name: /The storm arrived before the boats returned/i });
  await firstCard.focus();
  await page.keyboard.press("Enter");
  await expect(firstCard).toHaveClass(/sentence-card-selected/);
  await expect(page.getByRole("button", { name: "Submit answer" })).toBeEnabled();
  await expectNoSeriousAxeViolations(page);
});
