import { expect, test } from "@playwright/test";
import path from "node:path";
import { alignVisualBounds } from "./helpers/visual-bounds";

const visualStabilityStylePath = path.join(process.cwd(), "tests", "e2e", "visual-stability.css");

test("flagship mission visual states remain stable", async ({ page }, testInfo) => {
  const isMobile = testInfo.project.name === "mobile-chromium";
  const crossPlatformPixelRatio = isMobile ? 0.17 : 0.05;
  await page.route("http://api.test/v1/learning/mission**", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        student_id: "ava-y1",
        activity: {
          id: "act-phonics",
          objective_id: "en-y1-phonics-blend-cvc-words",
          template_id: "audio-blend",
          world_key: "wonder-garden",
          title: "Sound Sprout Blend",
          prompt: "Blend the sounds to grow the word.",
          difficulty: 1,
          interaction: {},
          feedback: {},
          animation_hooks: {},
          status: "published",
        },
        objective: {
          id: "en-y1-phonics-blend-cvc-words",
          year: 1,
          subject: "English",
          strand: "Phonics",
          topic: "Blending",
          statement: "Blend sounds in simple CVC words.",
          prerequisites: [],
          misconceptions: [],
          mastery: { expected: 80, secure: 90, retention_days: [1, 3, 7], required_formats: ["audio_blend"] },
          parent_explanation: "",
          teacher_evidence: "",
        },
        world: {
          key: "wonder-garden",
          name: "Wonder Garden",
          year_group: 1,
          theme: "Gentle discovery",
          config: { accent: "#8be28f", companion: "Nixi Sprout", focus: "Listen, blend and grow a word." },
          enabled: true,
        },
        world_state: { student_id: "ava-y1", world_key: "wonder-garden", state: { artefacts: ["first-bloom"] }, updated_at: "" },
        questions: [{
          id: "q-cat",
          activity_id: "act-phonics",
          objective_id: "en-y1-phonics-blend-cvc-words",
          format: "audio_blend",
          body: { prompt: "Blend c-a-t.", sounds: ["c", "a", "t"], choices: ["cat", "cap", "cot"] },
          expected_answer: { value: "cat" },
          hints: ["Sweep the sounds together."],
          explanation: "c-a-t blends to cat.",
          difficulty: 1,
          status: "published",
        }],
        runtime_adaptations: {
          animation_tier: "standard",
          reduced_motion: false,
          celebration_intensity: "balanced",
          session_length: "short",
          question_limit: 3,
          scaffold_level: "chunked",
          audio_support: true,
          reading_support: true,
          companion_style: "calm",
          reward_style: "world_building",
          reasons: ["Short, predictable mission."],
        },
      }),
    });
  });

  await page.goto("/play/mission?studentId=ava-y1");
  await expect(page.locator('[role="region"][aria-label="Mission question"] .leading-tight')).toHaveText("Blend c-a-t.");
  await expect(page).toHaveScreenshot("mission-standard.png", {
    animations: "disabled",
    fullPage: false,
    maxDiffPixelRatio: crossPlatformPixelRatio,
    stylePath: visualStabilityStylePath,
    threshold: 0.35,
  });

  await page.getByRole("button", { name: "Calm" }).click();
  await expect(page.locator("main")).toHaveClass(/reduced-motion/);
  await expect(page).toHaveScreenshot("mission-calm.png", {
    animations: "disabled",
    fullPage: false,
    maxDiffPixelRatio: crossPlatformPixelRatio,
    stylePath: visualStabilityStylePath,
    threshold: 0.35,
  });

  await page.getByRole("button", { name: "Contrast" }).click();
  await expect(page.locator("main")).toHaveClass(/high-contrast/);
  await expect(page).toHaveScreenshot("mission-high-contrast.png", {
    animations: "disabled",
    fullPage: false,
    maxDiffPixelRatio: crossPlatformPixelRatio,
    stylePath: visualStabilityStylePath,
    threshold: 0.35,
  });
});

const releasedRendererContracts = [
  {
    slug: "choice-or-numeric",
    question: {
      id: "q-array",
      activity_id: "act-contract",
      objective_id: "ma-y3-number-recall-3-4-8-tables",
      format: "array-build",
      body: { prompt: "Build an array for 3 × 4.", a: 3, b: 4 },
      expected_answer: { value: 12 },
      hints: ["Set the rows, then the number in each row."],
      explanation: "Three rows of four make twelve.",
      difficulty: 2,
      status: "published",
    },
  },
  {
    slug: "model-sort",
    question: {
      id: "q-model",
      activity_id: "act-contract",
      objective_id: "sc-y4-states-of-matter",
      format: "model-sort",
      body: { prompt: "Which model shows a liquid?", choices: ["A", "B", "C"] },
      expected_answer: { value: "particles close together and able to slide like a liquid" },
      hints: ["Look for particles that stay close but can move past each other."],
      explanation: "Liquid particles remain close and can slide past one another.",
      difficulty: 2,
      status: "published",
    },
  },
  {
    slug: "numeric",
    question: {
      id: "q-numeric",
      activity_id: "act-contract",
      objective_id: "ma-y3-number-recall-3-4-8-tables",
      format: "timed-recall",
      body: { prompt: "What is 3 × 4?", a: 3, b: 4, input: "number" },
      expected_answer: { value: 12 },
      hints: ["Think of three groups of four."],
      explanation: "Three groups of four equal twelve.",
      difficulty: 2,
      status: "published",
    },
  },
  {
    slug: "trace",
    question: {
      id: "q-trace",
      activity_id: "act-contract",
      objective_id: "en-y1-phonics-form-lowercase-letters",
      format: "trace-path",
      body: { prompt: "Trace the lowercase letter c.", letter: "c" },
      expected_answer: { value: "c" },
      hints: ["Start at the dot and follow the curve."],
      explanation: "The letter c begins at the top and curves around.",
      difficulty: 1,
      status: "published",
    },
  },
] as const;

test("every released renderer contract keeps standard and high-contrast visual baselines", async ({ page }, testInfo) => {
  test.setTimeout(60_000);
  const isMobile = testInfo.project.name === "mobile-chromium";
  const crossPlatformPixelRatio = isMobile ? 0.17 : 0.05;
  let activeContract: (typeof releasedRendererContracts)[number] = releasedRendererContracts[0];

  await page.route("http://api.test/v1/learning/mission**", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(releasedRendererMission(activeContract.question)),
    });
  });

  for (const contract of releasedRendererContracts) {
    activeContract = contract;
    await page.goto(`/play/mission?studentId=visual-${contract.slug}`, { waitUntil: "domcontentloaded" });
    await page.addStyleTag({ path: visualStabilityStylePath });
    const visiblePrompt = contract.question.body.prompt.replace("What is ", "").replace("?", "");
    await expect(page.locator("main")).toContainText(visiblePrompt, { timeout: 20_000 });
    const interaction = page.getByRole("region", { name: "Mission question" });
    await interaction.scrollIntoViewIfNeeded();
    await alignVisualBounds(interaction);
    // Capture the entire interaction: cropping to an old height can conceal
    // displaced answer controls and submit buttons after a layout regression.
    await expect(interaction).toHaveScreenshot(`mission-${contract.slug}-standard.png`, {
      animations: "disabled",
      scale: "css",
      maxDiffPixelRatio: crossPlatformPixelRatio,
      threshold: 0.35,
    });

    await page.getByRole("button", { name: "Contrast" }).click();
    await expect(page.locator("main")).toHaveClass(/high-contrast/);
    await interaction.scrollIntoViewIfNeeded();
    await alignVisualBounds(interaction);
    await expect(interaction).toHaveScreenshot(`mission-${contract.slug}-high-contrast.png`, {
      animations: "disabled",
      scale: "css",
      maxDiffPixelRatio: crossPlatformPixelRatio,
      threshold: 0.35,
    });
  }
});

function releasedRendererMission(question: (typeof releasedRendererContracts)[number]["question"]) {
  return {
    student_id: "renderer-visual-learner",
    activity: {
      id: "act-contract",
      objective_id: question.objective_id,
      template_id: "released-contract",
      world_key: "explorer-islands",
      title: "Renderer Contract Expedition",
      prompt: "Show the learning clearly in every access mode.",
      difficulty: question.difficulty,
      interaction: {},
      feedback: {},
      animation_hooks: {},
      status: "published",
    },
    objective: {
      id: question.objective_id,
      year: question.objective_id.includes("-y1-") ? 1 : question.objective_id.includes("-y3-") ? 3 : 4,
      subject: question.objective_id.startsWith("en-") ? "English" : question.objective_id.startsWith("ma-") ? "Mathematics" : "Science",
      strand: "Released renderer contract",
      topic: "Accessible interaction",
      statement: "Use the released interaction contract accurately.",
      prerequisites: [],
      misconceptions: [],
      mastery: { expected: 80, secure: 90, retention_days: [1, 3, 7], required_formats: [question.format] },
      parent_explanation: "",
      teacher_evidence: "",
    },
    world: {
      key: "explorer-islands",
      name: "Explorer Islands",
      year_group: 3,
      theme: "Evidence-led exploration",
      config: { accent: "#55cbd3", companion: "Nixi Explorer", focus: "Make the model clear and usable." },
      enabled: true,
    },
    world_state: { student_id: "renderer-visual-learner", world_key: "explorer-islands", state: { artefacts: ["renderer-compass"] }, updated_at: "" },
    questions: [question],
    runtime_adaptations: {
      animation_tier: "standard",
      reduced_motion: false,
      celebration_intensity: "balanced",
      session_length: "short",
      question_limit: 1,
      scaffold_level: "chunked",
      audio_support: true,
      reading_support: true,
      companion_style: "calm",
      reward_style: "world_building",
      reasons: ["Released contract visual verification."],
    },
  };
}
