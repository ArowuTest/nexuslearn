import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("public entry keeps learning behind structured access", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("main")).toBeVisible();
  await expect(page.getByText(/children do not need email accounts/i)).toBeVisible();
  await expect(page.locator("body")).not.toContainText("undefined");
  const accessibility = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
  expect(accessibility.violations.filter((item) => item.impact === "critical" || item.impact === "serious")).toEqual([]);
});

test("family workspace exposes secure signup, invitation and support controls", async ({ page }) => {
  await page.goto("/family?invitation=test-invitation");
  await expect(page.getByRole("heading", { name: /join your child's learning workspace/i })).toBeVisible();
  await expect(page.getByLabel("Your name")).toBeVisible();
  await expect(page.getByText("SEND/support needs")).toBeVisible();
  await expect(page.getByRole("button", { name: "Accept invitation" })).toBeDisabled();
});

test("school workspace requests one-time credentials and supports child-safe access", async ({ page }) => {
  await page.goto("/school-admin");
  await expect(page.getByRole("heading", { name: /classes, groups and pupil access/i })).toBeVisible();
  await expect(page.getByLabel("School URN")).toBeVisible();
  await expect(page.getByRole("button", { name: "Sign in" })).toBeDisabled();
  await expect(page.getByText(/picture passwords/i)).toBeVisible();
});

test("admin console prefers named accounts and retains explicit bootstrap migration", async ({ page }) => {
  await page.goto("/admin");
  await expect(page.getByRole("heading", { name: /configuration control room/i })).toBeVisible();
  await expect(page.getByLabel("Platform login ID")).toBeVisible();
  await expect(page.getByText("Temporary bootstrap API key")).toBeVisible();
  await expect(page.getByRole("button", { name: "Sign in" })).toBeDisabled();
});

test("content production reports real reviewed-variant depth", async ({ request }) => {
  const queueResponse = await request.get("/content/variant-production-queue.json");
  expect(queueResponse.ok()).toBeTruthy();
  const queue = await queueResponse.json();
  expect(queue.totals.authored_variants).toBeGreaterThan(queue.totals.runtime_variants);
  const topFlagships = queue.queue.slice(0, 3).map((item: { pack_id: string }) => item.pack_id);
  expect(topFlagships).toEqual(expect.arrayContaining([
    "en-y1-phonics-blend-cvc-words",
    "ma-y4-number-multiplication-12x12",
    "sc-y7-particles-states-of-matter",
  ]));
  const phonics = queue.queue.find((item: { pack_id: string }) => item.pack_id === "en-y1-phonics-blend-cvc-words");
  expect(phonics.authored_variants).toBe(300);

  const qualityResponse = await request.get("/content/variant-quality.json");
  expect(qualityResponse.ok()).toBeTruthy();
  const quality = await qualityResponse.json();
  expect(quality.totals.errors).toBe(0);

  const reviewResponse = await request.get("/content/flagship-review.json");
  expect(reviewResponse.ok()).toBeTruthy();
  const review = await reviewResponse.json();
  expect(review.totals.internal_pass).toBeGreaterThan(500);
  expect(review.totals.runtime_approved_by_this_review).toBe(0);
});

test("pupil login remains email-free and card-led", async ({ page }) => {
  await page.goto("/login?pupil=ava-y1&code=AVA-1234");
  await expect(page.getByRole("heading", { name: /open your learning card/i })).toBeVisible();
  await expect(page.getByLabel("Pupil ID")).toHaveValue("ava-y1");
  await expect(page.getByLabel("Login code")).toHaveValue("AVA-1234");
  await expect(page.getByText(/without needing an email account/i)).toBeVisible();
});

test("SEND-aware mission teaches before practice and records child confidence", async ({ page }) => {
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
          interaction: {
            teaching_sequence: [
              {
                step_id: "model",
                kind: "worked_example",
                child_prompt: "Listen as the sounds join together.",
                learning_purpose: "Blend continuously.",
                audio_script: "c, a, t. Cat.",
                visual_model: "Three sound seeds join into one word.",
              },
            ],
          },
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
          mastery: { expected: 80, secure: 90, retention_days: [1, 3, 7, 14], required_formats: ["audio_blend"] },
          parent_explanation: "",
          teacher_evidence: "",
        },
        world: {
          key: "wonder-garden",
          name: "Wonder Garden",
          year_group: 1,
          theme: "Gentle discovery",
          config: { accent: "#8be28f", companion: "Nixi Sprout" },
          enabled: true,
        },
        world_state: { student_id: "ava-y1", world_key: "wonder-garden", state: { artefacts: ["first-bloom"] }, updated_at: "" },
        questions: [
          {
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
          },
          {
            id: "q-map",
            activity_id: "act-phonics",
            objective_id: "en-y1-phonics-blend-cvc-words",
            format: "word-build",
            body: { prompt: "Build the word map.", sounds: ["m", "a", "p"], tiles: ["m", "s", "a", "o", "p", "t"] },
            expected_answer: { value: ["m", "a", "p"] },
            hints: ["Start with m."],
            explanation: "m-a-p builds map.",
            difficulty: 2,
            status: "published",
          },
          {
            id: "q-array",
            activity_id: "act-phonics",
            objective_id: "en-y1-phonics-blend-cvc-words",
            format: "array-build",
            body: { prompt: "Build 7 rows of 8.", a: 7, b: 8 },
            expected_answer: { value: 56 },
            hints: ["Use equal rows."],
            explanation: "7 rows of 8 make 56.",
            difficulty: 3,
            status: "published",
          },
        ],
        runtime_adaptations: {
          animation_tier: "low",
          reduced_motion: true,
          celebration_intensity: "quiet",
          session_length: "short",
          question_limit: 5,
          scaffold_level: "step_by_step",
          audio_support: true,
          reading_support: true,
          companion_style: "calm",
          reward_style: "world_building",
          reasons: ["Low-sensory profile."],
        },
      }),
    });
  });

  let savedLessonStep = false;
  await page.route("http://api.test/v1/learning/lesson-step", async (route) => {
    const body = route.request().postDataJSON();
    savedLessonStep = body.step_id === "model" && body.status === "completed" && body.support_used.includes("audio_support");
    await route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({ ...body, id: "lesson-step-attempt" }),
    });
  });

  const submittedConfidence: number[] = [];
  const submittedResponseModes: string[] = [];
  await page.route("http://api.test/v1/learning/attempt", async (route) => {
    const body = route.request().postDataJSON();
    submittedConfidence.push(body.confidence);
    submittedResponseModes.push(body.response_mode);
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        correct: true,
        mastery_gain: 6,
        projected_score: 6,
        projected_band: "Unknown",
        next_review_days: 1,
        feedback: "Careful listening!",
        explanation: "First evidence saved.",
        companion_prompt: "Teach it back.",
      }),
    });
  });
  await page.route("http://api.test/v1/students/ava-y1/baseline", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        id: "baseline-1",
        student_id: "ava-y1",
        year_group: 1,
        status: "in_progress",
        created_by: "adaptive-engine",
        started_at: "2026-06-19T08:00:00Z",
        current_objective_id: "ma-y1-number-counting-within-100",
        completed_items: 1,
        total_items: 3,
        items: [
          { objective_id: "en-y1-phonics-blend-cvc-words", position: 1, status: "completed", attempt_count: 3, correct_count: 3, response_formats: ["audio_blend", "word-build"] },
          { objective_id: "ma-y1-number-counting-within-100", position: 2, status: "planned", attempt_count: 0, correct_count: 0, response_formats: [] },
          { objective_id: "sc-y1-plants-identify-common", position: 3, status: "planned", attempt_count: 0, correct_count: 0, response_formats: [] },
        ],
      }),
    });
  });
  await page.route("http://api.test/v1/learning/next**", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        student_id: "ava-y1",
        objective_id: "ma-y1-number-counting-within-100",
        activity_id: "act-counting",
        world_key: "wonder-garden",
        world: "Wonder Garden",
        realm: "Year 1 Wonder Garden",
        interaction: "number-path",
        difficulty: 1,
        scaffold: false,
        review: false,
        prerequisite_probe: false,
        assessment_mode: "diagnostic",
        reward_hook: "world-growth",
        animation_hook: "portal-open",
        explanation: "Selected from the learner's structured baseline diagnostic.",
        companion_prompt: "Let's find your next starting point.",
        recommended_actions: [],
        runtime_adaptations: {},
      }),
    });
  });

  await page.goto("/play/mission?studentId=ava-y1");
  await expect(page.getByText("Calm mode")).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Mission schedule" })).toContainText("Learn");
  await expect(page.getByRole("heading", { name: "Listen as the sounds join together." })).toBeVisible();
  await expect(page.getByText("We are practising: Blend continuously.")).toBeVisible();
  await page.getByRole("button", { name: "Pause" }).click();
  await expect(page.getByRole("dialog", { name: "Take a quiet pause" })).toBeVisible();
  await page.getByRole("button", { name: "Continue mission" }).click();
  await page.getByRole("button", { name: "Start practice" }).click();
  expect(savedLessonStep).toBe(true);
  await page.getByRole("button", { name: "cat" }).click();
  await page.getByRole("button", { name: "Think so" }).click();
  await page.getByRole("button", { name: "Submit answer" }).click();
  await expect(page.getByText("Build the word map.", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Keyboard answer" }).focus();
  await page.keyboard.press("Enter");
  await page.getByLabel("Keyboard answer").focus();
  await page.keyboard.type("map");
  await page.getByRole("button", { name: "Submit answer" }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByText("Build 7 rows of 8.", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Activity controls" }).focus();
  await page.keyboard.press("Enter");
  const ranges = page.locator('input[type="range"]');
  await ranges.nth(0).fill("7");
  await ranges.nth(1).fill("8");
  await page.getByRole("button", { name: "Submit answer" }).click();
  await expect(page.getByText("Your wonder seed bloomed!")).toBeVisible();
  await expect(page.getByText("1 of 3 checkpoints complete.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Next checkpoint" })).toHaveAttribute("href", /activityId=act-counting.*mode=diagnostic/);
  expect(submittedConfidence).toEqual([3, 0, 0]);
  expect(submittedResponseModes).toEqual(["interactive", "keyboard", "interactive"]);
  const accessibility = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
  expect(accessibility.violations.filter((item) => item.impact === "critical" || item.impact === "serious")).toEqual([]);
});
