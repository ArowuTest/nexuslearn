import { expect, test } from "@playwright/test";

test("flagship mission visual states remain stable", async ({ page }) => {
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
  await expect(page.getByText("Blend c-a-t.", { exact: true })).toBeVisible();
  await page.addStyleTag({
    content: "*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}",
  });
  await expect(page).toHaveScreenshot("mission-standard.png", {
    animations: "disabled",
    fullPage: true,
    maxDiffPixelRatio: 0.04,
  });

  await page.getByRole("button", { name: "Calm" }).click();
  await expect(page.locator("main")).toHaveClass(/reduced-motion/);
  await expect(page).toHaveScreenshot("mission-calm.png", {
    animations: "disabled",
    fullPage: true,
    maxDiffPixelRatio: 0.04,
  });
});
