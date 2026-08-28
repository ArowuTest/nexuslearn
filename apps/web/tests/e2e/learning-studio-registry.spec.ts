import { expect, test, type Page } from "@playwright/test";

type Subject = "English" | "Mathematics" | "Science";

type StudioFixture = {
  id: string;
  subject: Subject;
  format: string;
  prompt: string;
  body: Record<string, unknown>;
  expected: string | number;
};

async function routeStudioMission(page: Page, fixture: StudioFixture) {
  await page.route("http://api.test/v1/learning/mission**", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        student_id: "studio-registry-learner",
        activity: {
          id: "studio-registry-activity",
          objective_id: "studio-registry-objective",
          template_id: fixture.format,
          world_key: "future-forge",
          title: "Learning Studio registry mission",
          prompt: fixture.prompt,
          difficulty: 3,
          interaction: {},
          feedback: {},
          animation_hooks: {},
          status: "published",
        },
        objective: {
          id: "studio-registry-objective",
          year: 5,
          subject: fixture.subject,
          strand: "Registry acceptance",
          topic: "Renderer dispatch",
          statement: "Use the appropriate accessible learning representation.",
          prerequisites: [],
          misconceptions: [],
          mastery: { expected: 80, secure: 90, retention_days: [1, 7, 30], required_formats: [fixture.format] },
          parent_explanation: "",
          teacher_evidence: "",
        },
        world: {
          key: "future-forge",
          name: "Future Forge",
          year_group: 5,
          theme: "Renderer dispatch",
          config: { accent: "#7fe7d7", companion: "Nixi Core" },
          enabled: true,
        },
        world_state: { student_id: "studio-registry-learner", world_key: "future-forge", state: { artefacts: [] }, updated_at: "" },
        questions: [{
          id: fixture.id,
          activity_id: "studio-registry-activity",
          objective_id: "studio-registry-objective",
          format: fixture.format,
          body: { prompt: fixture.prompt, ...fixture.body },
          expected_answer: { value: fixture.expected },
          hints: ["Use the representation and take your time."],
          explanation: "The representation supports the same learning goal.",
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
          reasons: ["Registry acceptance profile."],
        },
      }),
    });
  });
}

test("dispatches an English format to the literacy renderer with keyboard-operable tiles", async ({ page }) => {
  await routeStudioMission(page, {
    id: "registry-literacy",
    subject: "English",
    format: "word-build",
    prompt: "Build the word map.",
    body: { tiles: ["m", "a", "p"] },
    expected: "map",
  });

  await page.goto("/play/mission?studentId=studio-registry-learner");
  const builder = page.getByRole("group", { name: "Word building tiles" });
  await expect(builder).toBeVisible();
  for (const letter of ["m", "a", "p"]) {
    const tile = builder.getByRole("button", { name: letter, exact: true });
    await tile.focus();
    await page.keyboard.press("Enter");
  }
  await expect(page.getByRole("button", { name: "Submit answer" })).toBeEnabled();
});

test("does not mount the science compatibility renderer for a registered literacy sort", async ({ page }) => {
  await routeStudioMission(page, {
    id: "registry-literacy-sort",
    subject: "English",
    format: "sentence-sort",
    prompt: "Choose the sentence that belongs first.",
    body: {
      choices: ["First, collect the evidence.", "Finally, explain the conclusion."],
      cards: ["First, collect the evidence.", "Finally, explain the conclusion."],
      categories: ["opening", "conclusion"],
    },
    expected: "First, collect the evidence.",
  });

  await page.goto("/play/mission?studentId=studio-registry-learner");
  await expect(page.getByRole("group", { name: "Sentence and paragraph cards" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Argument role map" })).toHaveCount(0);
});

test("dispatches shared curriculum formats to their implemented cross-curricular renderer", async ({ page }) => {
  await routeStudioMission(page, {
    id: "registry-shared-balance",
    subject: "Mathematics",
    format: "balance-equation",
    prompt: "Keep both sides balanced.",
    body: { known_fact: "7 + 3 = 10", choices: ["17 + 3 = 20", "17 + 3 = 10"] },
    expected: "17 + 3 = 20",
  });

  await page.goto("/play/mission?studentId=studio-registry-learner");
  await expect(page.getByRole("region", { name: "Balance and transfer" })).toBeVisible();
  await expect(page.getByRole("group", { name: "Structured choices" })).toBeVisible();
});

test("dispatches a Mathematics format to the maths renderer", async ({ page }) => {
  await routeStudioMission(page, {
    id: "registry-mathematics",
    subject: "Mathematics",
    format: "array-build",
    prompt: "Build three rows of four.",
    body: { a: 3, b: 4, input: "number" },
    expected: 12,
  });

  await page.goto("/play/mission?studentId=studio-registry-learner");
  await expect(page.getByRole("img", { name: "Array showing 1 rows of 1. Product 1." })).toBeVisible();
  await expect(page.getByRole("slider")).toHaveCount(2);
});

test("dispatches a Science format to the simulation renderer", async ({ page }) => {
  await routeStudioMission(page, {
    id: "registry-science",
    subject: "Science",
    format: "particle-simulation",
    prompt: "Increase the energy until the model behaves like a gas.",
    body: { choices: ["solid", "liquid", "gas"] },
    expected: "gas",
  });

  await page.goto("/play/mission?studentId=studio-registry-learner");
  await expect(page.getByRole("group", { name: "Particle model comparison" })).toBeVisible();
  await expect(page.getByRole("slider", { name: "Particle energy" })).toBeVisible();
});

test("preserves generic choice fallback for an unregistered choice format", async ({ page }) => {
  await routeStudioMission(page, {
    id: "registry-choice-fallback",
    subject: "Science",
    format: "future-choice-preview",
    prompt: "Choose the observation supported by the evidence.",
    body: { choices: ["first observation", "second observation"] },
    expected: "first observation",
  });

  await page.goto("/play/mission?studentId=studio-registry-learner");
  const answer = page.getByRole("button", { name: "first observation", exact: true });
  await answer.focus();
  await page.keyboard.press("Enter");
  await expect(answer).toHaveClass(/ring-4/);
  await expect(page.getByRole("button", { name: "Submit answer" })).toBeEnabled();
});

test("fails safely for a preview-only format and keeps the keyboard fallback available", async ({ page }) => {
  await routeStudioMission(page, {
    id: "registry-preview-fallback",
    subject: "English",
    format: "short-response",
    prompt: "Explain the clue in one sentence.",
    body: {},
    expected: "The clue shows the character is worried.",
  });

  await page.goto("/play/mission?studentId=studio-registry-learner");
  await expect(page.getByRole("status", { name: "Activity format status" })).toContainText(/activity format is not available yet/i);

  const keyboardMode = page.getByRole("button", { name: "Keyboard answer" });
  await keyboardMode.focus();
  await page.keyboard.press("Enter");
  const answer = page.getByLabel("Keyboard answer");
  await answer.fill("The clue shows the character is worried.");
  await expect(page.getByRole("button", { name: "Submit answer" })).toBeEnabled();
});
