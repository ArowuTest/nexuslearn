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
  await expect(page.getByRole("heading", { name: /set up learning around the child/i })).toBeVisible();
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
  await expect(page.getByLabel("Login ID")).toBeVisible();
  await expect(page.getByText("First-time platform setup")).toBeVisible();
  await page.getByText("First-time platform setup").click();
  await expect(page.getByText("Temporary bootstrap API key")).toBeVisible();
  await expect(page.getByRole("button", { name: "Sign in" })).toBeDisabled();
  await expect(page.getByRole("heading", { name: "Configured Worlds" })).not.toBeVisible();
  await expect(page.getByRole("navigation", { name: "Admin sections" })).not.toBeVisible();
});

test("content production reports real reviewed-variant depth", async ({ request }) => {
  const queueResponse = await request.get("/content/variant-production-queue.json");
  expect(queueResponse.ok()).toBeTruthy();
  const queue = await queueResponse.json();
  expect(queue.totals.authored_variants).toBeGreaterThan(queue.totals.runtime_variants);
  expect(queue.totals.blocked_from_pilot).toBeGreaterThan(0);
  const queuedPacks = queue.queue.map((item: { pack_id: string }) => item.pack_id);
  expect(queuedPacks).toEqual(expect.arrayContaining([
    "en-y1-phonics-blend-cvc-words",
    "ma-y4-number-multiplication-12x12",
    "sc-y7-particles-states-of-matter",
  ]));
  for (const packId of [
    "ma-y2-measures",
    "sc-y2-materials-suitability",
    "en-y3-grammar-expansion",
    "ma-y3-number-fractions-tenths",
    "en-y5-authorial-choice",
    "sc-y5-earth-space-models",
  ]) {
    const pack = queue.queue.find((item: { pack_id: string }) => item.pack_id === packId);
    expect(pack, `${packId} should remain visible in the production queue`).toBeTruthy();
    expect(pack.authored_variants).toBeGreaterThanOrEqual(pack.pilot_target);
    expect(pack.remaining_authoring).toBe(0);
    expect(pack.remaining_review).toBeGreaterThan(0);
  }
  const phonics = queue.queue.find((item: { pack_id: string }) => item.pack_id === "en-y1-phonics-blend-cvc-words");
  expect(phonics.authored_variants).toBe(300);
  expect(phonics.blockers).toEqual(expect.arrayContaining([
    expect.stringMatching(/SSP mapping/i),
    expect.stringMatching(/produced-audio QA/i),
  ]));

  const qualityResponse = await request.get("/content/variant-quality.json");
  expect(qualityResponse.ok()).toBeTruthy();
  const quality = await qualityResponse.json();
  expect(quality.totals.errors).toBe(0);

  const reviewResponse = await request.get("/content/flagship-review.json");
  expect(reviewResponse.ok()).toBeTruthy();
  const review = await reviewResponse.json();
  expect(review.totals.internal_pass).toBeGreaterThan(500);
  expect(review.totals.runtime_approved_by_this_review).toBe(0);

  const breadthResponse = await request.get("/content/curriculum-area-coverage.json");
  expect(breadthResponse.ok()).toBeTruthy();
  const breadth = await breadthResponse.json();
  expect(breadth.totals.contract_areas).toBe(90);
  expect(breadth.totals.authored_areas).toBe(90);
  expect(breadth.totals.missing_areas).toBe(0);
  expect(breadth.totals.breadth_percent).toBe(100);
  expect(breadth.next_balanced_wave).toHaveLength(0);
  expect(breadth.failures).toEqual([]);
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
                audio_url: "/audio/narration/alice/en-y1-phonics-blend-cvc-words/lesson/cat-worked-example.mp3",
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
  await expect(page.getByRole("region", { name: "Active support plan" })).toContainText("Support plan active");
  await expect(page.getByRole("region", { name: "Active support plan" })).toContainText("Short mission");
  await expect(page.getByRole("region", { name: "Active support plan" })).toContainText("Audio-first");
  await expect(page.getByRole("region", { name: "Active support plan" })).toContainText("Low-sensory profile.");
  await expect(page.getByRole("navigation", { name: "Mission schedule" })).toContainText("Learn");
  await expect(page.getByRole("heading", { name: "Listen as the sounds join together." })).toBeVisible();
  await expect(page.getByText("We are practising: Blend continuously.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Read this aloud" })).toBeVisible();
  await page.getByRole("button", { name: "Read this aloud" }).click();
  expect(await page.evaluate(() => "speechSynthesis" in window ? window.speechSynthesis.speaking : false)).toBe(false);
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
  await expect(page.getByRole("img", { name: "Array showing 1 rows of 1. Product 1." })).toBeVisible();
  const ranges = page.locator('input[type="range"]');
  await ranges.nth(0).fill("7");
  await ranges.nth(1).fill("8");
  await expect(page.getByRole("img", { name: "Array showing 7 rows of 8. Product 56." })).toBeVisible();
  await page.getByRole("button", { name: "Submit answer" }).click();
  await expect(page.getByText("Your wonder seed bloomed!")).toBeVisible();
  await expect(page.getByText("1 of 3 checkpoints complete.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Next checkpoint" })).toHaveAttribute("href", /activityId=act-counting.*mode=diagnostic/);
  expect(submittedConfidence).toEqual([3, 0, 0]);
  expect(submittedResponseModes).toEqual(["interactive", "keyboard", "interactive"]);
  const accessibility = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
  expect(accessibility.violations.filter((item) => item.impact === "critical" || item.impact === "serious")).toEqual([]);
});

test("completed subject check explains objective evidence without changing mastery", async ({ page }) => {
  await page.route("http://api.test/v1/learning/mission**", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        student_id: "sam-y3",
        activity: {
          id: "act-maths-check",
          objective_id: "ma-y3-number-recall-3-4-8-tables",
          template_id: "tap-choice",
          world_key: "explorer-archipelago",
          title: "Maths route check",
          prompt: "Show what you know.",
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
          topic: "Multiplication and division",
          statement: "Recall multiplication and division facts for the 3, 4 and 8 tables.",
          prerequisites: [],
          misconceptions: [],
          mastery: { expected: 80, secure: 90, retention_days: [1, 3, 7, 14], required_formats: ["tap-choice"] },
          parent_explanation: "",
          teacher_evidence: "",
        },
        world: { key: "explorer-archipelago", name: "Explorer Archipelago", year_group: 3, theme: "Discovery", config: {}, enabled: true },
        world_state: { student_id: "sam-y3", world_key: "explorer-archipelago", state: {}, updated_at: "" },
        questions: [{
          id: "q-six",
          activity_id: "act-maths-check",
          objective_id: "ma-y3-number-recall-3-4-8-tables",
          format: "tap-choice",
          body: { prompt: "What is 2 × 3?", choices: [5, 6, 7] },
          expected_answer: { value: 6 },
          hints: [],
          explanation: "Two groups of three make six.",
          difficulty: 1,
          status: "published",
        }],
        runtime_adaptations: { animation_tier: "low", reduced_motion: true, celebration_intensity: "quiet" },
      }),
    });
  });
  await page.route("http://api.test/v1/learning/attempt", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        correct: true,
        mastery_gain: 0,
        projected_score: 0,
        projected_band: "Unknown",
        next_review_days: 0,
        feedback: "Answer saved.",
        explanation: "Mock evidence is kept separate from mastery.",
        evidence_event: "mock_assessment.answer_recorded",
        companion_prompt: "Now look at what to practise next.",
        mock_assessment: {
          id: "mock-1",
          subject: "Mathematics",
          year_group: 3,
          title: "Year 3 maths check",
          status: "completed",
          question_count: 4,
          answered_count: 4,
          correct_count: 3,
          score: 75,
          objective_results: [
            {
              objective_id: "ma-y3-place-value-to-1000",
              year_group: 3,
              strand: "Number",
              topic: "Place value",
              statement: "Recognise the place value of each digit in a three-digit number.",
              question_count: 2,
              answered_count: 2,
              correct_count: 0,
              score: 0,
              status: "review_next",
              guidance: "Review this next with a different explanation and supported practice.",
            },
            {
              objective_id: "ma-y3-number-recall-3-4-8-tables",
              year_group: 3,
              strand: "Number",
              topic: "Multiplication and division",
              statement: "Recall multiplication and division facts for the 3, 4 and 8 tables.",
              question_count: 2,
              answered_count: 2,
              correct_count: 2,
              score: 100,
              status: "secure_for_now",
              guidance: "Secure in this sample for now. Keep it in spaced revision.",
            },
          ],
        },
      }),
    });
  });

  await page.goto("/play/mission?studentId=sam-y3&mockAssessmentId=mock-1");
  await page.getByRole("button", { name: "6" }).click();
  await page.getByRole("button", { name: "Submit answer" }).click();
  await expect(page.getByRole("region", { name: "What this check sampled" })).toContainText("Review next");
  await expect(page.getByRole("region", { name: "What this check sampled" })).toContainText("Place value");
  await expect(page.getByRole("region", { name: "What this check sampled" })).toContainText("Secure for now");
  await expect(page.getByRole("region", { name: "What this check sampled" })).toContainText("sampled evidence, not a limit on progress");
});

test("saved completed check opens its evidence instead of a locked assessment", async ({ page }) => {
  await page.route("http://api.test/v1/students/sam-y3/profile", async (route) => {
    await route.fulfill({ contentType: "application/json", body: JSON.stringify({ external_ref: "sam-y3", display_name: "Sam", year_group: 3 }) });
  });
  await page.route("http://api.test/v1/students/sam-y3/mock-assessments", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        mock_assessments: [{
          id: "mock-complete",
          student_external_ref: "sam-y3",
          created_by_role: "pupil",
          created_by: "sam-y3",
          subject: "Mathematics",
          year_group: 3,
          year_from: 3,
          year_to: 3,
          title: "Year 3 maths check",
          status: "completed",
          question_count: 4,
          answered_count: 4,
          correct_count: 2,
          score: 50,
          duration_minutes: 0,
          include_revision: true,
          include_stretch: false,
          accessibility: {},
          items: [],
          objective_results: [{
            objective_id: "ma-y3-place-value-to-1000",
            year_group: 3,
            strand: "Number",
            topic: "Place value",
            statement: "Recognise the place value of each digit in a three-digit number.",
            question_count: 2,
            answered_count: 2,
            correct_count: 0,
            score: 0,
            status: "review_next",
            guidance: "Review this next with a different explanation and supported practice.",
          }],
        }],
      }),
    });
  });

  await page.goto("/play/mock?studentId=sam-y3");
  await expect(page.getByText("Completed", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Review check" })).toHaveCount(0);
  await page.getByText("See what to practise next", { exact: true }).click();
  await expect(page.getByRole("region", { name: "What this check sampled" })).toContainText("Place value");
  const accessibility = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
  expect(accessibility.violations.filter((item) => item.impact === "critical" || item.impact === "serious")).toEqual([]);
});
