import { expect, test } from "@playwright/test";

test("public entry keeps learning behind structured access", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("main")).toBeVisible();
  await expect(page.getByText(/children do not need email accounts/i)).toBeVisible();
  await expect(page.locator("body")).not.toContainText("undefined");
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

  let submittedConfidence: number | undefined;
  await page.route("http://api.test/v1/learning/attempt", async (route) => {
    const body = route.request().postDataJSON();
    submittedConfidence = body.confidence;
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

  await page.goto("/play/mission?studentId=ava-y1");
  await expect(page.getByText("Calm mode")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Listen as the sounds join together." })).toBeVisible();
  await expect(page.getByText("We are practising: Blend continuously.")).toBeVisible();
  await page.getByRole("button", { name: "Start practice" }).click();
  await page.getByRole("button", { name: "cat" }).click();
  await page.getByRole("button", { name: "Think so" }).click();
  await page.getByRole("button", { name: "Submit answer" }).click();
  await expect(page.getByText("Your wonder seed bloomed!")).toBeVisible();
  expect(submittedConfidence).toBe(3);
});
