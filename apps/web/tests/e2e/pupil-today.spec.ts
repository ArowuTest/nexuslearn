import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

async function routeFixture(page: Page, options: { year?: number; mode?: string; session?: boolean; expiry?: string; denied?: boolean; progressUnavailable?: boolean; paused?: boolean; flagsUnavailable?: boolean; standard?: boolean } = {}) {
  const year = options.year ?? 3;
  const requests: string[] = [];
  if (options.session !== false) await page.addInitScript(({ expiry }) => {
    sessionStorage.setItem("nexuslearn_pupil_id", "ava");
    sessionStorage.setItem("nexuslearn_pupil_session", "pupil-test-token");
    sessionStorage.setItem("nexuslearn_pupil_session_expires", expiry);
  }, { expiry: options.expiry ?? "2099-01-01T00:00:00Z" });
  await page.route("**/api.test/**", async route => {
    const url = new URL(route.request().url());
    requests.push(url.pathname + url.search);
    if (url.pathname === "/v1/runtime/flags") {
      await route.fulfill({ status: options.flagsUnavailable ? 503 : 200, json: { flags: { child_play_enabled: !options.paused } } });
      return;
    }
    expect(route.request().headers()["x-pupil-session"]).toBe("pupil-test-token");
    expect(route.request().method()).toBe("GET");
    if (options.denied) { await route.fulfill({ status: 401, json: { error: "expired" } }); return; }
    const subject = (name: string, working = year) => ({ subject: name, current_year: year, working_year: working, stretch_year: working, stretch_allowed: working > year, sampled_objectives: 2, secure_objectives: 1, objective_count: 4, years: [{ year, sampled_objectives: 2, secure_objectives: 1 }, ...(working > year ? [{ year: working, sampled_objectives: 0, secure_objectives: 0 }] : [])], strengths: [], practice: [] });
    const responses: Record<string, unknown> = {
      "/v1/students/ava/profile": { student_id: "ava", display_name: "Ava", year_group: year, active_world_key: "wonder", active_world: "Wonder Garden", companion_name: "Nixi" },
      "/v1/learning/next": { student_id: "ava", activity_id: "next-step", objective_id: "maths-next", assessment_mode: options.mode ?? "review", review: (options.mode ?? "review") === "review", world_key: "wonder", world: "Wonder Garden", realm: "Pattern workshop", explanation: "Return to an earlier idea before the next challenge.", recommended_actions: [], runtime_adaptations: { reduced_motion: true, animation_tier: "static", high_contrast: true, simple_text: true, audio_support: true, visual_guide: true, session_length: "short", reward_style: "world_building" } },
      "/v1/students/ava/progress": { student_id: "ava", year_group: year, subjects: [subject("English"), subject("Mathematics", Math.min(7, year + 1)), subject("Science")], strengths: [], practice: [] },
      "/v1/students/ava/world": { student_id: "ava", world_key: "wonder", state: { artefacts: ["wonder-seed", "compass-fragment"] } },
    };
    if (options.standard) (responses["/v1/learning/next"] as { runtime_adaptations: unknown }).runtime_adaptations = { reduced_motion: false, animation_tier: "full", celebration_intensity: "standard", high_contrast: false };
    if (url.pathname.endsWith("/progress") && options.progressUnavailable) { await route.fulfill({ status: 503, json: {} }); return; }
    expect(Object.hasOwn(responses, url.pathname), `unexpected API request: ${url.pathname}`).toBe(true);
    await route.fulfill({ json: responses[url.pathname] ?? {} });
  });
  return requests;
}

test("today uses the signed-in pupil, real review selection and independent subject progression", async ({ page }) => {
  const requests = await routeFixture(page);
  await page.goto("/play/today?studentId=someone-else");
  await expect(page.getByRole("heading", { name: "Ready, Ava?" })).toBeVisible();
  await expect(page.getByRole("list", { name: "Today's learning route" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Start warm-up", exact: true })).toHaveAttribute("href", "/play/mission?studentId=ava&activityId=next-step&mode=review");
  await expect(page.getByRole("region", { name: "Mathematics progress" })).toContainText("Ready to explore Year 4");
  await expect(page.getByRole("region", { name: "Mathematics progress" })).toContainText("Year 3: 1 idea secure for now · 2 explored");
  await expect(page.getByRole("region", { name: "English progress" })).toContainText("Exploring Year 3");
  await expect(page.getByRole("region", { name: "Your world growth" })).toContainText("2 discoveries");
  await expect(page.getByRole("link", { name: "Audio & learning tools" })).toHaveAttribute("href", /#mission-support$/);
  expect(requests.some(path => path.includes("someone-else"))).toBe(false);
  expect(requests.length).toBe(5);
});

test("growth reads the selected world explicitly and never labels another world's discoveries as its own", async ({ page }) => {
  await routeFixture(page);
  await page.route("**/v1/students/ava/world**", route => {
    const selected = new URL(route.request().url()).searchParams.get("worldKey") === "wonder";
    return route.fulfill({ json: { student_id: "ava", world_key: selected ? "wonder" : "inventor-wilds", state: { artefacts: selected ? ["wonder-seed"] : ["wrong-world", "wrong-machine"] } } });
  });
  await page.goto("/play/today");
  await expect(page.getByRole("region", { name: "Your world growth" })).toContainText("1 discovery saved");
  await page.getByText("Open my discoveries", { exact: true }).click();
  await expect(page.getByRole("region", { name: "Your world growth" })).not.toContainText("wrong");
});

test("the selected lesson preview explains what to learn before opening the mission", async ({ page }) => {
  await routeFixture(page);
  await page.route("**/v1/learning/next**", route => route.fulfill({ json: { student_id: "ava", activity_id: "next-step", activity_title: "Build equal groups", learning_focus: "Use arrays to show a multiplication fact.", subject: "Mathematics", world_key: "wonder", assessment_mode: "teach", realm: "World label, not the lesson" } }));
  await page.goto("/play/today");
  await expect(page.getByRole("heading", { name: "Build equal groups", exact: true })).toBeVisible();
  await expect(page.getByText("Use arrays to show a multiplication fact.", { exact: true })).toBeVisible();
});

test("a stalled optional progress endpoint does not discard a valid mission", async ({ page }) => {
  await routeFixture(page, { mode: "teach" });
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route("**/v1/students/ava/progress", async route => { await gate; await route.abort().catch(() => {}); });
  try {
    await page.goto("/play/today");
    await expect(page.getByRole("link", { name: "Start mission", exact: true })).toBeVisible();
    await expect(page.getByText("Your subject progress is unavailable right now.", { exact: true })).toBeVisible();
  } finally { release(); }
});

test("a confirmed new world starts empty while an unavailable world never invents a reset", async ({ page }) => {
  await routeFixture(page);
  let unavailable = false;
  await page.route("**/v1/students/ava/world**", route => route.fulfill({ status: unavailable ? 503 : 200, json: { student_id: "ava", world_key: "wonder", state: {} } }));
  await page.goto("/play/today");
  await expect(page.getByRole("region", { name: "Your world growth" })).toContainText("0 discoveries saved");
  unavailable = true;
  await page.getByRole("button", { name: "Refresh my route" }).click();
  await expect(page.getByRole("region", { name: "Your world growth" })).toContainText("Nothing has been reset.");
  await expect(page.getByRole("region", { name: "Your world growth" })).not.toContainText("0 discoveries");
});

test("pupil explanations do not render staff-authored intervention notes", async ({ page }) => {
  await routeFixture(page);
  await page.route("**/v1/learning/next**", route => route.fulfill({ json: { student_id: "ava", activity_id: "next-step", world_key: "wonder", assessment_mode: "practice", explanation: "CONFIDENTIAL-STAFF-NOTE: sensitive family and SEND context" } }));
  await page.goto("/play/today");
  await page.getByText("Why this step?", { exact: true }).click();
  await expect(page.locator("body")).not.toContainText("CONFIDENTIAL-STAFF-NOTE");
});

test("the primary action has a contrasting visible keyboard focus ring", async ({ page }) => {
  await routeFixture(page);
  await page.goto("/play/today");
  const start = page.getByRole("link", { name: "Start warm-up", exact: true });
  await start.focus();
  await expect(start).toHaveCSS("outline-color", "rgb(23, 35, 63)");
  await expect(start).toHaveCSS("outline-width", "3px");
});

test("standard presentation stays readable with discoveries and explanations expanded", async ({ page }, testInfo) => {
  await routeFixture(page, { standard: true, mode: "teach" });
  await page.goto("/play/today");
  await expect(page.getByRole("heading", { name: "Ready, Ava?" })).toBeVisible();
  await expect(page.getByTestId("pupil-today")).not.toHaveClass(/high-contrast/);
  await page.getByText("Why this step?", { exact: true }).click();
  await page.getByText("Open my discoveries", { exact: true }).click();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("pupil-standard.png"), fullPage: true, scale: "css" });
});

for (const expiry of ["2000-01-01T00:00:00Z", "not-a-date"]) test(`expired or malformed session requires a card (${expiry})`, async ({ page }) => {
  const requests = await routeFixture(page, { expiry });
  await page.goto("/play/today?studentId=ava");
  await expect(page.getByRole("link", { name: "Use my access card" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Ready, Ava?" })).toHaveCount(0);
  expect(requests).toEqual([]);
});

test("anonymous entry never loads private learner data", async ({ page }) => {
  const requests = await routeFixture(page, { session: false });
  await page.goto("/play/today?studentId=ava");
  await expect(page.getByRole("link", { name: "Use my access card" })).toBeVisible();
  expect(requests).toEqual([]);
});

test("a rejected session clears private state and stored pupil access", async ({ page }) => {
  await routeFixture(page, { denied: true });
  await page.goto("/play/today");
  await expect(page.getByRole("link", { name: "Use my access card" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Ready, Ava?" })).toHaveCount(0);
  expect(await page.evaluate(() => sessionStorage.getItem("nexuslearn_pupil_session"))).toBeNull();
});

test("optional progress failure does not invent scores or block the selected mission", async ({ page }) => {
  await routeFixture(page, { mode: "teach", progressUnavailable: true });
  await page.goto("/play/today");
  await expect(page.getByRole("link", { name: "Start mission", exact: true })).toBeVisible();
  await expect(page.getByText("Your subject progress is unavailable right now.", { exact: true })).toBeVisible();
  await expect(page.getByRole("region", { name: "Mathematics progress" })).toHaveCount(0);
  await expect(page.getByText("Review returns when an earlier idea is due.", { exact: true })).toBeVisible();
});

for (const options of [{ paused: true }, { flagsUnavailable: true }]) test(`entry fails closed when access settings are ${options.paused ? "paused" : "unavailable"}`, async ({ page }) => {
  const requests = await routeFixture(page, options);
  await page.goto("/play/today");
  await expect(page.getByRole("heading", { name: options.paused ? "Your world is taking a short break" : "We couldn't open your route" })).toBeVisible();
  await expect(page.getByRole("link", { name: /Start (mission|warm-up)/ })).toHaveCount(0);
  expect(requests).toEqual(["/v1/runtime/flags"]);
});

test("switching cards removes the pupil view immediately", async ({ page }) => {
  await routeFixture(page);
  await page.goto("/play/today");
  await expect(page.getByRole("heading", { name: "Ready, Ava?" })).toBeVisible();
  await page.getByRole("button", { name: "Use a different card" }).click();
  await expect(page.getByRole("heading", { name: "Ready, Ava?" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Use my access card" })).toBeVisible();
  expect(await page.evaluate(() => sessionStorage.getItem("nexuslearn_pupil_id"))).toBeNull();
});

test("a failed attempt to use another card removes the previous pupil session", async ({ page }) => {
  await routeFixture(page);
  await page.route("**/v1/auth/pupil-login", route => route.fulfill({ status: 401, json: { error: "Please check your card." } }));
  await page.goto("/login?pupil=other-pupil&code=WRONG");
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await expect(page.getByText("Please check your card.", { exact: true })).toBeVisible();
  expect(await page.evaluate(() => sessionStorage.getItem("nexuslearn_pupil_session"))).toBeNull();
});

test("successful card entry opens the personal route without carrying login secrets or a forced world", async ({ page }) => {
  await routeFixture(page, { session: false });
  await page.route("**/v1/auth/pupil-login", route => route.fulfill({ json: { student: { external_ref: "ava", display_name: "Ava" }, session: { token: "pupil-test-token", expires_at: "2099-01-01T00:00:00Z" } } }));
  await page.goto("/login?pupil=ava&code=CARD-123&world=arbitrary");
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await expect(page.getByRole("link", { name: "See my route" })).toHaveAttribute("href", "/play/today");
  await page.getByRole("link", { name: "See my route" }).click();
  await expect(page.getByRole("heading", { name: "Ready, Ava?" })).toBeVisible();
  expect(new URL(page.url()).search).toBe("");
});

test("a card switch during a delayed refresh cannot restore the previous pupil", async ({ page }) => {
  await routeFixture(page);
  await page.goto("/play/today");
  await expect(page.getByRole("heading", { name: "Ready, Ava?" })).toBeVisible();
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route("**/v1/students/ava/profile", async route => { await gate; await route.fulfill({ json: { student_id: "ava", display_name: "Ava", year_group: 3 } }).catch(() => {}); });
  await page.getByRole("button", { name: "Refresh my route" }).click();
  await expect(page.getByRole("heading", { name: "Opening your learning route" })).toBeVisible();
  await page.getByRole("button", { name: "Use a different card" }).click();
  release();
  await expect(page.getByRole("link", { name: "Use my access card" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Ready, Ava?" })).toHaveCount(0);
});

test("a finished mission returns to freshly loaded saved world growth", async ({ page }) => {
  await routeFixture(page);
  let saved = false;
  await page.route("**/v1/learning/event", route => route.fulfill({ json: {} }));
  await page.route("**/v1/students/ava/baseline", route => route.fulfill({ status: 404, json: {} }));
  await page.route("**/v1/students/ava/world**", route => route.fulfill({ json: { student_id: "ava", world_key: "wonder", state: { artefacts: saved ? ["seed", "compass", "new-discovery"] : ["seed", "compass"] } } }));
  await page.route("**/v1/learning/mission**", route => route.fulfill({ json: {
    student_id: "ava", activity: { id: "next-step", title: "Pattern workshop", objective_id: "maths-next", interaction: {}, feedback: {}, animation_hooks: {} },
    objective: { id: "maths-next", year: 3, subject: "Mathematics", topic: "Multiplication", statement: "Recall a multiplication fact.", prerequisites: [], misconceptions: [], mastery: { retention_days: [1, 3, 7], required_formats: ["timed-recall"] } },
    world: { key: "wonder", name: "Wonder Garden", year_group: 3, config: {}, enabled: true }, world_state: { state: { artefacts: ["seed", "compass"] } },
    questions: [{ id: "q-route", objective_id: "maths-next", question_version: "route-v1", response_kind: "number", format: "timed-recall", body: { prompt: "What is 3 × 4?", a: 3, b: 4, input: "number" }, hints: [] }],
    runtime_adaptations: { animation_tier: "static", reduced_motion: true, celebration_intensity: "quiet", reward_style: "collecting", reasons: [] },
  } }));
  await page.route("**/v1/learning/attempt", async route => {
    expect(route.request().headers()["x-pupil-session"]).toBe("pupil-test-token");
    saved = true;
    await route.fulfill({ json: { correct: true, mastery_gain: 8, projected_score: 68, projected_band: "Nearly secure", next_review_days: 3, reward_hook: "island-compass-fragment", explanation: "Three groups of four make twelve." } });
  });
  await page.goto("/play/today");
  await expect(page.getByRole("region", { name: "Your world growth" })).toContainText("2 discoveries");
  await page.getByRole("link", { name: "Start warm-up", exact: true }).click();
  await page.getByRole("button", { name: "Keyboard answer" }).click();
  await page.getByLabel("Keyboard answer").fill("12");
  await page.getByRole("button", { name: "Submit answer" }).click();
  await page.getByRole("button", { name: "See my discoveries" }).click();
  await page.getByRole("link", { name: "Back to my route" }).click();
  await expect(page.getByRole("region", { name: "Your world growth" })).toContainText("3 discoveries");
  await page.getByText("Open my discoveries", { exact: true }).click();
  await expect(page.getByRole("region", { name: "Your world growth" })).toContainText("new discovery");
});

test("small screens retain a keyboard path to the primary action", async ({ page }) => {
  await routeFixture(page);
  await page.setViewportSize({ width: 320, height: 680 });
  await page.goto("/play/today");
  const start = page.getByRole("link", { name: "Start warm-up", exact: true });
  await expect(start).toBeVisible();
  for (let index = 0; index < 10; index++) {
    await page.keyboard.press("Tab");
    if (await start.evaluate(element => element === document.activeElement)) break;
  }
  await expect(start).toBeFocused();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

for (const year of [1, 2, 3, 4, 5, 6, 7]) test(`Year ${year} route keeps calm, readable, keyboard-accessible support and saved growth`, async ({ page }, testInfo) => {
  await routeFixture(page, { year, mode: "teach" });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/play/today");
  await expect(page.getByRole("heading", { name: "Ready, Ava?" })).toBeVisible();
  await expect(page.getByTestId("pupil-today")).toHaveClass(/reduced-motion/);
  await expect(page.getByTestId("pupil-today")).toHaveClass(/high-contrast/);
  await expect(page.getByText("Short steps", { exact: true })).toBeVisible();
  const start = page.getByRole("link", { name: "Start mission", exact: true });
  await start.focus();
  await expect(start).toBeFocused();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  if ([1, 7].includes(year)) {
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await page.screenshot({ path: testInfo.outputPath(`pupil-year-${year}.png`), fullPage: true, scale: "css" });
  }
});
