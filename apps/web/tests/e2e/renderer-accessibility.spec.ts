import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

type RendererQuestion = {
  id: string;
  format: string;
  prompt: string;
  body: Record<string, unknown>;
  expected: string | number;
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

test("array renderer exposes its model and keyboard range controls", async ({ page }) => {
  await routeMission(page, {
    id: "array-question",
    format: "array-build",
    prompt: "Build three rows of four.",
    body: { a: 3, b: 4, input: "number" },
    expected: 12,
  });
  await page.goto("/play/mission?studentId=renderer-learner");

  const sliders = page.getByRole("slider");
  await sliders.nth(0).focus();
  await page.keyboard.press("Home");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  await sliders.nth(1).focus();
  await page.keyboard.press("Home");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("img", { name: "Array showing 3 rows of 4. Product 12." })).toBeVisible();
  await expect(page.getByRole("button", { name: "Submit answer" })).toBeEnabled();
  await expectNoSeriousAxeViolations(page);
});

test("audio blend renderer exposes named replay controls to the keyboard", async ({ page }) => {
  const audioData = "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=";
  await routeMission(page, {
    id: "audio-question",
    format: "audio_blend",
    prompt: "Blend c-a-t.",
    body: {
      sounds: ["c", "a", "t"],
      choices: ["cat", "cap", "cot"],
      audio_assets: {
        "phoneme-c": audioData,
        "phoneme-a": audioData,
        "phoneme-t": audioData,
      },
      prompt_audio_url: audioData,
    },
    expected: "cat",
  });
  await page.goto("/play/mission?studentId=renderer-learner");

  await expect(page.getByRole("group", { name: "Sound blending controls" })).toBeVisible();
  const sound = page.getByRole("button", { name: "Hear c", exact: true });
  await sound.focus();
  await page.keyboard.press("Enter");
  const wholePrompt = page.getByRole("button", { name: "Hear the whole prompt" });
  await wholePrompt.focus();
  await page.keyboard.press("Enter");
  expect(await page.evaluate(() => "speechSynthesis" in window ? window.speechSynthesis.speaking : false)).toBe(false);
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

test("trace renderer exposes its path and keyboard completion alternative", async ({ page }) => {
  await routeMission(page, {
    id: "trace-question",
    format: "trace-path",
    prompt: "Trace the lowercase letter c.",
    body: {
      letter: "c",
      response: "trace",
    },
    expected: "trace-path-complete",
  });
  await page.goto("/play/mission?studentId=renderer-learner");

  await expect(page.getByRole("img", { name: "Trace the lowercase letter c" })).toBeVisible();
  const keyboardCompletion = page.getByRole("button", { name: "Complete with keyboard" });
  await keyboardCompletion.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("button", { name: "Send trace" })).toBeEnabled();
  await expectNoSeriousAxeViolations(page);
});

test("word builder exposes named tiles and keyboard construction", async ({ page }) => {
  await routeMission(page, {
    id: "word-question",
    format: "word-build",
    prompt: "Build the word map.",
    body: {
      tiles: ["m", "s", "a", "o", "p", "t"],
      sounds: ["m", "a", "p"],
    },
    expected: "map",
  });
  await page.goto("/play/mission?studentId=renderer-learner");

  await expect(page.getByRole("group", { name: "Word building tiles" })).toBeVisible();
  for (const letter of ["m", "a", "p"]) {
    const tile = page.getByRole("button", { name: letter, exact: true });
    await tile.focus();
    await page.keyboard.press("Enter");
  }
  await expect(page.getByText("m", { exact: true }).last()).toBeVisible();
  await expect(page.getByText("a", { exact: true }).last()).toBeVisible();
  await expect(page.getByText("p", { exact: true }).last()).toBeVisible();
  await expect(page.getByRole("button", { name: "Submit answer" })).toBeEnabled();
  await expectNoSeriousAxeViolations(page);
});

test("numeric renderer supports keyboard keypad entry", async ({ page }) => {
  await routeMission(page, {
    id: "numeric-question",
    format: "timed-recall",
    prompt: "What is 7 × 8?",
    body: {
      a: 7,
      b: 8,
      input: "number",
    },
    expected: 56,
  });
  await page.goto("/play/mission?studentId=renderer-learner");

  for (const digit of ["5", "6"]) {
    const key = page.getByRole("button", { name: digit, exact: true });
    await key.focus();
    await page.keyboard.press("Enter");
  }
  await expect(page.getByText("7 × 8 = 56", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Submit answer" })).toBeEnabled();
  await expectNoSeriousAxeViolations(page);
});

test("choice renderer exposes named group and keyboard selection", async ({ page }) => {
  await routeMission(page, {
    id: "choice-question",
    format: "multiple_choice",
    prompt: "Which material is transparent?",
    body: {
      choices: ["clear glass", "brick", "wood"],
    },
    expected: "clear glass",
  });
  await page.goto("/play/mission?studentId=renderer-learner");

  await expect(page.getByRole("group", { name: "Answer choices" })).toBeVisible();
  const answer = page.getByRole("button", { name: "clear glass", exact: true });
  await answer.focus();
  await page.keyboard.press("Enter");
  await expect(answer).toHaveClass(/ring-4/);
  await expect(page.getByRole("button", { name: "Submit answer" })).toBeEnabled();
  await expectNoSeriousAxeViolations(page);
});

test("mission controls expose a visible keyboard focus ring and high contrast mode", async ({ page }) => {
  await routeMission(page, {
    id: "focus-question",
    format: "multiple_choice",
    prompt: "Choose the first option.",
    body: { choices: ["first", "second", "third"] },
    expected: "first",
  });
  await page.goto("/play/mission?studentId=renderer-learner");

  const contrast = page.getByRole("button", { name: "Contrast" });
  await contrast.focus();
  const focusStyle = await contrast.evaluate((element) => {
    const style = getComputedStyle(element);
    return { outlineStyle: style.outlineStyle, outlineWidth: style.outlineWidth };
  });
  expect(focusStyle.outlineStyle).not.toBe("none");
  expect(Number.parseInt(focusStyle.outlineWidth, 10)).toBeGreaterThanOrEqual(4);
  await page.keyboard.press("Enter");
  await expect(page.locator("main")).toHaveClass(/high-contrast/);
  await expect(contrast).toHaveAttribute("aria-pressed", "true");
  await expectNoSeriousAxeViolations(page);
});

test("simple text mode removes secondary reading without hiding the task", async ({ page }) => {
  await routeMission(page, {
    id: "simple-text-question",
    format: "multiple_choice",
    prompt: "Choose the first option.",
    body: { choices: ["first", "second", "third"] },
    expected: "first",
  });
  await page.goto("/play/mission?studentId=renderer-learner");

  await expect(page.getByText("Model and explain", { exact: true })).toBeVisible();
  await expect(page.getByText("Why this question?")).toBeVisible();
  const simpleText = page.getByRole("button", { name: "Simple text" });
  await simpleText.focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("main")).toHaveClass(/reading-reduced/);
  await expect(page.getByText("Model and explain", { exact: true })).toBeHidden();
  await expect(page.getByText("Why this question?")).toBeHidden();
  await expect(page.getByText("Choose the first option.", { exact: true })).toBeVisible();
  await expect(page.getByRole("group", { name: "Answer choices" })).toBeVisible();
  await expectNoSeriousAxeViolations(page);
});

test("visual guide presents icon-supported task steps", async ({ page }) => {
  await routeMission(page, {
    id: "visual-guide-question",
    format: "word-build",
    prompt: "Build cat.",
    body: { tiles: ["c", "a", "t"] },
    expected: "cat",
  });
  await page.goto("/play/mission?studentId=renderer-learner");

  const visualGuide = page.getByRole("button", { name: "Visual guide" });
  await visualGuide.focus();
  await page.keyboard.press("Enter");
  await expect(visualGuide).toHaveAttribute("aria-pressed", "true");
  const steps = page.getByRole("group", { name: "Visual task steps" });
  await expect(steps).toBeVisible();
  await expect(steps.getByText("Look", { exact: true })).toBeVisible();
  await expect(steps.getByText("Build", { exact: true })).toBeVisible();
  await expect(steps.getByText("Send", { exact: true })).toBeVisible();
  await expect(page.getByRole("group", { name: "Word building tiles" })).toBeVisible();
  await expectNoSeriousAxeViolations(page);
});

test("switch access scans task controls and selects with one key", async ({ page }) => {
  await routeMission(page, {
    id: "switch-access-question",
    format: "multiple_choice",
    prompt: "Choose the second option.",
    body: { choices: ["first", "second", "third"] },
    expected: "second",
  });
  await page.goto("/play/mission?studentId=renderer-learner");

  const switchAccess = page.getByRole("button", { name: "Switch access" });
  await switchAccess.click();
  await expect(switchAccess).toHaveAttribute("aria-pressed", "true");
  await expect
    .poll(
      () => page.evaluate(() => document.activeElement?.textContent?.trim()),
      { timeout: 10_000 },
    )
    .toBe("second");
  await page.keyboard.press("Space");
  await expect(page.getByRole("button", { name: "second", exact: true })).toHaveClass(/ring-4/);
  await expect(page.getByRole("button", { name: "Submit answer" })).toBeEnabled();
  await page.keyboard.press("Escape");
  await expect(switchAccess).toHaveAttribute("aria-pressed", "false");
  await expectNoSeriousAxeViolations(page);
});
