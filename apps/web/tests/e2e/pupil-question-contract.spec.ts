import { expect, test, type Page } from "@playwright/test";

async function openQuestion(page: Page, question: Record<string, unknown>) {
  let sent: Record<string, unknown> | undefined;
  await page.route("http://api.test/**", route => {
    if (route.request().url().includes("/v1/learning/mission")) return route.fulfill({ json: {
      student_id: "public-learner", activity: { id: "a", title: "Number discovery", interaction: {} },
      objective: { id: "o", year: 3, subject: "Mathematics" }, world: { key: "explorer-islands", year_group: 3, config: {} },
      questions: [{ id: "q", question_version: "v1", objective_id: "o", hints: [], ...question }],
    }});
    if (route.request().url().endsWith("/v1/learning/attempt")) {
      sent = route.request().postDataJSON();
      return route.fulfill({ json: { correct: true, mastery_gain: 6, feedback: "Saved", explanation: "One whole and one quarter.", projected_score: 6 } });
    }
    return route.fulfill({ status: 404, json: {} });
  });
  await page.goto("/play/mission?studentId=public-learner&activityId=a");
  await expect(page.getByRole("region", { name: "Mission question" })).toBeVisible();
  return () => sent;
}

test("a mission renders and sends a decimal without receiving an answer key", async ({ page }) => {
  const sent = await openQuestion(page, { response_kind: "number", format: "number-input", body: { prompt: "What is 1 + 0.25?", input: "number" } });
  await page.getByRole("button", { name: "Keyboard answer", exact: true }).click();
  await page.getByLabel("Keyboard answer", { exact: true }).fill("1.25");
  await page.getByRole("button", { name: "Submit answer", exact: true }).click();
  await expect(page.getByRole("button", { name: "See my discoveries" })).toBeVisible();
  expect(sent()?.response).toEqual({ kind: "number", value: 1.25 });
  expect(sent()).not.toHaveProperty("expected");
  expect(sent()).not.toHaveProperty("expected_text");
});

test("evidence controls preserve the learner's phrase without substituting a hidden key", async ({ page }) => {
  const sent = await openQuestion(page, { response_kind: "text", format: "evidence-highlight", body: {
    prompt: "Choose the clue that suggests uncertainty.", extract: "Ava stopped, read the sign, then reached for the handle.",
    selectable_spans: ["Ava stopped, read the sign", "reached for the handle"],
  }});
  await page.getByRole("button", { name: /1\.\s*Ava stopped, read the sign/ }).click();
  await page.getByRole("button", { name: "Submit answer", exact: true }).click();
  await expect(page.getByRole("button", { name: "See my discoveries" })).toBeVisible();
  expect(sent()?.response).toEqual({ kind: "text", value: "Ava stopped, read the sign" });
});

test("a pupil can select an exact evidence span inside a longer sentence", async ({ page }, info) => {
  const sent = await openQuestion(page, { response_kind: "text", format: "evidence-highlight", body: {
    prompt: "Find the words that show repeated checking.", extract: "Leena checked the tide chart for the third time.",
    chunks: ["Leena checked the tide chart for the third time.", "She carried her bag."],
  }});
  await page.getByLabel("First word of evidence").selectOption("1");
  await page.getByLabel("Last word of evidence").selectOption("8");
  await page.getByRole("button", { name: "Use selected words" }).click();
  await page.getByRole("region", { name: "Evidence finder" }).screenshot({ path: info.outputPath("evidence-phrase-controls.png"), animations: "disabled" });
  await page.getByRole("button", { name: "Submit answer", exact: true }).click();
  await expect(page.getByRole("button", { name: "See my discoveries" })).toBeVisible();
  expect(sent()?.response).toEqual({ kind: "text", value: "checked the tide chart for the third time" });
});

test("circuit models send the authored choice rather than a hardcoded completion key", async ({ page }) => {
  const sent = await openQuestion(page, { response_kind: "text", format: "circuit-builder", body: {
    prompt: "Choose the complete circuit.", components: ["cell", "lamp", "wire"],
    choices: ["one wire ending at the output", "closed_complete_loop"],
  }});
  await page.getByRole("button", { name: "closed complete loop", exact: true }).click();
  await page.getByRole("button", { name: "Submit answer", exact: true }).click();
  await expect(page.getByRole("button", { name: "See my discoveries" })).toBeVisible();
  expect(sent()?.response).toEqual({ kind: "text", value: "closed_complete_loop" });
});

test("planner uses public selection count and sends selected cards as a sequence", async ({ page }) => {
  const sent = await openQuestion(page, { response_kind: "sequence", selection_count: 2, format: "investigation-planner", body: {
    prompt: "Choose two useful planning steps.", planner_cards: ["change height", "change everything", "measure distance"],
  }});
  const send = page.getByRole("button", { name: "Submit fact family" });
  await expect(send).toBeDisabled();
  await page.getByRole("button", { name: "Fact 1change height" }).click();
  await expect(send).toBeDisabled();
  await page.getByRole("button", { name: "Fact 3measure distance" }).click();
  await send.click();
  await expect(page.getByRole("button", { name: "See my discoveries" })).toBeVisible();
  expect(sent()?.response).toEqual({ kind: "sequence", value: ["change height", "measure distance"] });
});

test("single-choice investigation plans remain answerable without planner cards", async ({ page }) => {
  const sent = await openQuestion(page, { response_kind: "text", format: "investigation-planner", body: {
    prompt: "Choose the fair plan.", choices: ["change height only", "change everything"],
  }});
  await page.getByRole("button", { name: "Fact 1change height only" }).click();
  await page.getByRole("button", { name: "Submit fact family" }).click();
  await expect(page.getByRole("button", { name: "See my discoveries" })).toBeVisible();
  expect(sent()?.response).toEqual({ kind: "text", value: "change height only" });
});

test("a one-card planner retains its sequence response contract", async ({ page }) => {
  const sent = await openQuestion(page, { response_kind: "sequence", selection_count: 1, format: "investigation-planner", body: {
    prompt: "Select one useful next step.", planner_cards: ["measure distance", "change everything"],
  }});
  await page.getByRole("button", { name: "Fact 1measure distance" }).click();
  await page.getByRole("button", { name: "Submit fact family" }).click();
  await expect(page.getByRole("button", { name: "See my discoveries" })).toBeVisible();
  expect(sent()?.response).toEqual({ kind: "sequence", value: ["measure distance"] });
});
