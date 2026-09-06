import { expect, test, type Page } from "@playwright/test";

type Fixture = { format: string; body: Record<string, unknown>; expected: string | number; hints?: string[]; switchAccess?: boolean; responseKind?: string; version?: string | null };
async function mission(page: Page, fixture: Fixture) {
  await page.route("http://api.test/**", async route => {
    // Unconfigured reports are unavailable, not malformed successful reports.
    if (!route.request().url().includes("/v1/learning/mission")) return route.fulfill({ status: route.request().method() === "GET" ? 404 : 200, json: {} });
    return route.fulfill({ json: {
      student_id: "integrity-learner",
      activity: { id: "integrity-activity", objective_id: "integrity-objective", title: "Discovery trail", prompt: "Explore the next idea.", interaction: {}, feedback: {}, animation_hooks: {}, status: "published" },
      objective: { id: "integrity-objective", year: 3, subject: "Mathematics", strand: "Number", topic: "Learning", statement: "Explore a learning model.", prerequisites: [], misconceptions: [], mastery: { expected: 80, secure: 90, retention_days: [1, 7, 30], required_formats: [fixture.format] }, parent_explanation: "", teacher_evidence: "" },
      world: { key: "explorer-islands", name: "Explorer Islands", year_group: 3, config: { accent: "#55cbd3", companion: "Nixi" }, enabled: true },
      world_state: { student_id: "integrity-learner", world_key: "explorer-islands", state: { artefacts: [] } },
      questions: [{ id: "integrity-question", question_version: fixture.version === null ? undefined : "version-1", response_kind: fixture.responseKind, objective_id: "integrity-objective", activity_id: "integrity-activity", format: fixture.format, body: fixture.body, expected_answer: { value: fixture.expected }, hints: fixture.hints ?? [], explanation: "Look at the evidence.", status: "published" }],
      runtime_adaptations: { animation_tier: "static", reduced_motion: true, celebration_intensity: "quiet", question_limit: 1, scaffold_level: "standard", audio_support: false, reading_support: false, reward_style: "collecting", switch_access: fixture.switchAccess ?? false, reasons: [] },
    } });
  });
}
const numberFixture: Fixture = { format: "timed-recall", body: { prompt: "What is three groups of four?", input: "number" }, expected: 12, hints: ["Draw three equal groups.", "Place four counters in each group."] };
const result = (correct = true) => ({ correct, mastery_gain: correct ? 8 : 0, projected_score: 60, projected_band: "Developing", next_review_days: 3, reward_hook: "compass-fragment", feedback: correct ? "Your discovery is saved." : "Look again at the groups.", explanation: "Three groups of four make twelve." });
async function open(page: Page) {
  await page.goto("/play/mission?studentId=integrity-learner");
  await expect(page.getByRole("region", { name: "Mission question" })).toBeVisible();
}
async function typeNumber(page: Page, value: string) {
  await page.getByRole("button", { name: "Keyboard answer", exact: true }).click();
  await page.getByLabel("Keyboard answer", { exact: true }).fill(value);
}

test("decimal answers send typed learner evidence and version, never an answer key", async ({ page }) => {
  await mission(page, { ...numberFixture, expected: 1.25, responseKind: "number" });
  let sent: Record<string, unknown> | undefined;
  await page.route("http://api.test/v1/learning/attempt", async route => { sent = route.request().postDataJSON(); await route.fulfill({ json: result() }); });
  await open(page);
  await typeNumber(page, "1.25");
  await page.getByRole("button", { name: "Submit answer", exact: true }).click();
  await expect(page.getByRole("button", { name: "See my discoveries" })).toBeVisible();
  expect(sent?.response).toEqual({ kind: "number", value: 1.25 });
  expect(sent?.question_version).toBe("version-1");
  expect(sent).not.toHaveProperty("expected");
  expect(sent).not.toHaveProperty("expected_text");
});

test("a stale question offers recovery without pretending a save is still pending", async ({ page }) => {
  await mission(page, numberFixture);
  let calls = 0;
  await page.route("http://api.test/v1/learning/attempt", async route => { calls++; await route.fulfill({ status: 409, json: { code: "question_changed", error: "question changed; reload the mission before answering" } }); });
  await open(page);
  await typeNumber(page, "12");
  await page.getByRole("button", { name: "Submit answer", exact: true }).click();
  await expect(page.getByRole("alert", { name: "Answer saving" })).toContainText("question changed");
  await expect(page.getByRole("button", { name: "Retry saving answer" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Choose another mission" })).toBeVisible();
  await expect(page.getByRole("button", { name: "See my discoveries" })).toHaveCount(0);
  expect(calls).toBe(1);
});

test("a malformed local structured answer stays editable and never starts a save", async ({ page }) => {
  await mission(page, { format: "sound-box-build", responseKind: "sequence", body: { prompt: "Build dog.", sounds: ["d", "o", "g"], tiles: ["d", "o", "g"], sound_boxes: 3 }, expected: '["d","o","g"]' });
  let calls = 0;
  await page.route("http://api.test/v1/learning/attempt", async route => { calls++; await route.fulfill({ json: result() }); });
  await open(page);
  await typeNumber(page, "dog");
  await page.getByRole("button", { name: "Submit answer", exact: true }).click();
  await expect(page.getByLabel("Keyboard answer", { exact: true })).toBeEnabled();
  await expect(page.getByRole("button", { name: "Retry saving answer" })).toHaveCount(0);
  expect(calls).toBe(0);
  for (const invalid of ["null", "[]", "{}"] ) {
    await page.getByLabel("Keyboard answer", { exact: true }).fill(invalid);
    await page.getByRole("button", { name: "Submit answer", exact: true }).click();
    await expect(page.getByLabel("Keyboard answer", { exact: true })).toBeEnabled();
    expect(calls).toBe(0);
  }
  await page.getByLabel("Keyboard answer", { exact: true }).fill('["d","o","g"]');
  await page.getByRole("button", { name: "Submit answer", exact: true }).click();
  await expect(page.getByRole("button", { name: "See my discoveries" })).toBeVisible();
  expect(calls).toBe(1);
});

test("a client never submits to an older unversioned grading API", async ({ page }) => {
  await mission(page, { ...numberFixture, version: null });
  let calls = 0;
  await page.route("http://api.test/v1/learning/attempt", async route => { calls++; await route.fulfill({ json: result() }); });
  await open(page);
  await typeNumber(page, "12");
  await page.getByRole("button", { name: "Submit answer", exact: true }).click();
  await expect(page.getByRole("alert", { name: "Answer saving" })).toContainText("updated");
  expect(calls).toBe(0);
});

test("sound-box construction reaches submission without changing response mode", async ({ page }) => {
  await mission(page, { format: "sound-box-build", body: { prompt: "Build dog.", sounds: ["d", "o", "g"], tiles: ["g", "d", "o"], sound_boxes: 3 }, expected: '["d","o","g"]' });
  let sent: Record<string, unknown> | undefined;
  await page.route("http://api.test/v1/learning/attempt", async route => { sent = route.request().postDataJSON(); await route.fulfill({ json: result() }); });
  await open(page);
  const builder = page.getByRole("region", { name: "Sound box builder" });
  await expect(page.getByRole("button", { name: "Submit answer", exact: true })).toBeDisabled();
  for (const letter of ["d", "o"]) await builder.getByRole("button", { name: letter, exact: true }).click();
  await expect(page.getByRole("button", { name: "Submit answer", exact: true })).toBeDisabled();
  await builder.getByRole("button", { name: "g", exact: true }).click();
  await builder.getByRole("button", { name: "Use these boxes" }).click();
  await page.getByRole("button", { name: "Submit answer", exact: true }).click();
  await expect(page.getByRole("button", { name: "See my discoveries" })).toBeVisible();
  expect(sent?.response).toEqual({ kind: "text", value: '["d","o","g"]' });
});

test("noun-phrase construction can send the built phrase", async ({ page }) => {
  await mission(page, { format: "noun-phrase-builder", body: { prompt: "Build a phrase.", tiles: ["the", "small", "dog"] }, expected: "the small dog" });
  let sent: Record<string, unknown> | undefined;
  await page.route("http://api.test/v1/learning/attempt", async route => { sent = route.request().postDataJSON(); await route.fulfill({ json: result() }); });
  await open(page);
  const builder = page.getByRole("region", { name: "Noun phrase builder" });
  for (const word of ["the", "small", "dog"]) await builder.getByRole("button", { name: word, exact: true }).click();
  await page.getByRole("button", { name: "Submit answer", exact: true }).click();
  await expect(page.getByRole("button", { name: "See my discoveries" })).toBeVisible();
  expect(sent?.response).toEqual({ kind: "text", value: "the small dog" });
});

test("authored hints open progressively and actual support is recorded", async ({ page }) => {
  await mission(page, numberFixture);
  let sent: Record<string, unknown> | undefined;
  await page.route("http://api.test/v1/learning/attempt", async route => { sent = route.request().postDataJSON(); await route.fulfill({ json: result() }); });
  await open(page);
  await expect(page.getByText("Draw three equal groups.", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Show a hint", exact: true }).click();
  await expect(page.getByText("Draw three equal groups.", { exact: true })).toBeVisible();
  await expect(page.getByText("Place four counters in each group.", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Show next hint", exact: true }).click();
  await expect(page.getByText("Place four counters in each group.", { exact: true })).toBeVisible();
  await page.getByRole("region", { name: "Mission question" }).screenshot({ path: test.info().outputPath("authored-hints.png"), animations: "disabled" });
  await typeNumber(page, "12");
  await page.getByRole("button", { name: "Submit answer", exact: true }).click();
  await expect(page.getByRole("button", { name: "See my discoveries" })).toBeVisible();
  expect(sent?.hint_used).toBe(true);
});

test("an incorrect answer alone does not claim hint use on retry", async ({ page }) => {
  await mission(page, numberFixture);
  const attempts: Record<string, unknown>[] = [];
  await page.route("http://api.test/v1/learning/attempt", async route => { attempts.push(route.request().postDataJSON()); await route.fulfill({ json: result(attempts.length > 1) }); });
  await open(page);
  await typeNumber(page, "11");
  await page.getByRole("button", { name: "Submit answer", exact: true }).click();
  await expect(page.getByTestId("mission-reward-moment")).toBeVisible();
  await page.getByLabel("Keyboard answer", { exact: true }).fill("12");
  await page.getByRole("button", { name: "Submit answer", exact: true }).click();
  await expect(page.getByRole("button", { name: "See my discoveries" })).toBeVisible();
  expect(attempts.map(attempt => attempt.hint_used)).toEqual([false, false]);
});

test("uncertain save keeps the answer and retries exactly the same request", async ({ page }) => {
  await mission(page, numberFixture);
  const attempts: string[] = [];
  await page.route("http://api.test/v1/learning/attempt", async route => {
    attempts.push(route.request().postData()!);
    await route.fulfill(attempts.length === 1 ? { status: 503, json: { error: "uncertain save" } } : { json: result() });
  });
  await open(page);
  await typeNumber(page, "12");
  await page.getByRole("button", { name: "Submit answer", exact: true }).click();
  await expect(page.getByRole("alert", { name: "Answer saving" })).toContainText("could not confirm");
  await expect(page.getByLabel("Keyboard answer", { exact: true })).toHaveValue("12");
  await expect(page.getByLabel("Keyboard answer", { exact: true })).toBeDisabled();
  await page.getByRole("region", { name: "Mission question" }).screenshot({ path: test.info().outputPath("retained-answer.png"), animations: "disabled" });
  await page.getByRole("button", { name: "Sure", exact: true }).click();
  await page.getByRole("button", { name: "Retry saving answer", exact: true }).click();
  await expect(page.getByRole("button", { name: "See my discoveries" })).toBeVisible();
  expect(attempts).toHaveLength(2);
  expect(attempts[1]).toBe(attempts[0]);
});

test("switch scanning can continue from saved feedback using Space", async ({ page }) => {
  await mission(page, { ...numberFixture, switchAccess: true });
  await page.route("http://api.test/v1/learning/attempt", route => route.fulfill({ json: result() }));
  await open(page);
  await typeNumber(page, "12");
  await page.getByRole("button", { name: "Submit answer", exact: true }).click();
  const next = page.getByRole("button", { name: "See my discoveries" });
  await expect(next).toBeVisible();
  await expect(next).toBeFocused();
  await page.keyboard.press("Space");
  await expect(next).toHaveCount(0);
  await expect(page.getByText("XP earned", { exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "Switch access", exact: true })).toHaveAttribute("aria-pressed", "false");
});

test("switch activation never substitutes a new control when the highlighted hint disappears", async ({ page }) => {
  await mission(page, { ...numberFixture, hints: ["Draw three groups."] });
  await open(page);
  await typeNumber(page, "12");
  const time = new Date("2026-09-06T12:00:00Z");
  await page.clock.install({ time });
  await page.clock.pauseAt(new Date(time.getTime() + 1000));
  await page.getByRole("button", { name: "Switch access", exact: true }).click();
  await expect(page.getByRole("button", { name: "Show a hint", exact: true })).toBeFocused();
  await page.keyboard.press("Space");
  await expect(page.getByText("Draw three groups.", { exact: true })).toBeVisible();
  // The timer is paused: activation must not use a stale array index to click
  // Activity controls (which would switch mode and discard the typed answer).
  await page.keyboard.press("Space");
  await expect(page.getByLabel("Keyboard answer", { exact: true })).toHaveValue("12");
});

test("specialist keyboard responses retain one validated submission path", async ({ page }) => {
  await mission(page, { format: "sentence-editor", body: { prompt: "Choose a clear sentence.", choices: ["The dog runs.", "The dog run."] }, expected: "The dog runs." });
  let sent: Record<string, unknown> | undefined;
  await page.route("http://api.test/v1/learning/attempt", async route => { sent = route.request().postDataJSON(); await route.fulfill({ json: result() }); });
  await open(page);
  await page.getByRole("button", { name: "Keyboard answer", exact: true }).click();
  await expect(page.getByRole("button", { name: /^Submit/ })).toHaveCount(1);
  await expect(page.getByRole("button", { name: "Submit grammar answer" })).toBeDisabled();
  await page.getByRole("group", { name: "Grammar edit choices" }).getByRole("button", { name: /The dog runs\./ }).click();
  await page.getByRole("button", { name: "Submit grammar answer" }).click();
  await expect(page.getByRole("button", { name: "See my discoveries" })).toBeVisible();
  expect(sent?.response).toEqual({ kind: "text", value: "The dog runs." });
});

test("support toggles record one event per pupil action", async ({ page }) => {
  await mission(page, numberFixture);
  const events: Record<string, unknown>[] = [];
  await page.route("http://api.test/v1/learning/event", async route => {
    events.push(route.request().postDataJSON());
    await route.fulfill({ json: {} });
  });
  await open(page);
  const focus = page.getByRole("button", { name: "Focus", exact: true });
  await focus.click();
  await expect(focus).toHaveAttribute("aria-pressed", "true");
  await focus.click();
  await expect(focus).toHaveAttribute("aria-pressed", "false");
  await expect.poll(() => events.filter(event => event.event_type === "support_changed")).toHaveLength(2);
});

test("switch scanning stays inside the pause dialog", async ({ page }) => {
  await mission(page, { ...numberFixture, switchAccess: true });
  await open(page);
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Take a quiet pause" });
  await expect(dialog.getByRole("button", { name: "Continue mission" })).toBeFocused();
  await page.keyboard.press("Space");
  await expect(dialog).toHaveCount(0);
  await expect(page.getByText("Draw three equal groups.", { exact: true })).toHaveCount(0);
});
