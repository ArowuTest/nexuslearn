import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

async function mission(page: Page, { year = 1, supports = true, scanning = false, lesson = false, audio = false, requiredAudio = false } = {}) {
  await page.route("http://api.test/**", route => route.fulfill({ status: route.request().method() === "GET" ? 404 : 200, json: {} }));
  await page.route("http://api.test/v1/learning/mission**", route => route.fulfill({ json: {
    student_id: "task-first-learner",
    activity: { id: "task-first", objective_id: "task-objective", title: `Year ${year} discovery`, status: "published", interaction: lesson ? { teaching_sequence: [{ step_id: "model", kind: "worked_example", child_prompt: "Look at three equal groups.", visual_model: "Each group holds four counters." }] } : {} },
    objective: { id: "task-objective", year, subject: "Mathematics", topic: "Equal groups", prerequisites: [], misconceptions: [], mastery: { expected: 80, secure: 90, retention_days: [1, 7], required_formats: ["multiple_choice"] } },
    world: { key: "task-world", name: "Discovery world", year_group: year, config: { accent: "#55cbd3", companion: "Nixi", focus: "Explore one idea at your own pace." }, enabled: true },
    world_state: { student_id: "task-first-learner", world_key: "task-world", state: { artefacts: ["first-discovery"] } },
    questions: [{ id: "task-question", question_version: "task-v1", objective_id: "task-objective", activity_id: "task-first", format: "multiple_choice", response_kind: "text", body: { prompt: "Which answer shows three groups of four?", choices: ["8", "12", "16"], ...(audio ? { audio_url: "/qa-narration.mp3" } : {}), ...(requiredAudio ? { audio_required: true } : {}) }, hints: ["Count four three times."], status: "published" }],
    runtime_adaptations: { animation_tier: supports ? "static" : "standard", reduced_motion: supports, high_contrast: supports, large_targets: supports, switch_access: scanning, audio_support: supports, reading_support: supports, session_length: supports ? "short" : "standard", scaffold_level: supports ? "step_by_step" : "standard", reward_style: "collecting", reasons: supports ? ["Keep each task clear and predictable."] : [] },
  } }));
}

const supportToggle = (page: Page) => page.getByRole("button", { name: "Support & audio", exact: true });
const supportPanel = (page: Page) => page.getByRole("region", { name: "Support & audio", exact: true });

for (const year of [1, 4, 7]) test(`Year ${year} puts the task before the game journal without switching off saved support`, async ({ page }, info) => {
  await mission(page, { year });
  await page.goto("/play/mission?studentId=task-first-learner");
  const question = page.getByRole("region", { name: "Mission question" });
  const journal = page.getByRole("region", { name: "Your learning journey" });
  const prompt = question.getByText("Which answer shows three groups of four?", { exact: true });
  await expect(prompt).toBeVisible();
  const box = await prompt.boundingBox();
  expect(box!.y).toBeLessThan(page.viewportSize()!.height - 80);
  expect(await question.evaluate((element) => Boolean(element.compareDocumentPosition(document.querySelector('[aria-label="Your learning journey"]')!) & Node.DOCUMENT_POSITION_FOLLOWING))).toBe(true);
  if (info.project.name === "mobile-chromium") expect((await question.boundingBox())!.y).toBeLessThan((await journal.boundingBox())!.y);
  await expect(page.getByRole("link", { name: "Exit", exact: true })).toHaveCount(1);
  await expect(supportToggle(page)).toHaveAttribute("aria-expanded", "false");
  await expect(supportPanel(page)).toBeHidden();
  await expect(page.locator("main")).toHaveClass(/reduced-motion/);
  await expect(page.locator("main")).toHaveClass(/high-contrast/);
  await expect(page.locator("main")).toHaveClass(/large-targets/);
  await expect(page.getByRole("button", { name: "Pause", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Mute sounds", exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
});

test("the support disclosure preserves answers, returns keyboard focus and records only intentional changes", async ({ page }) => {
  await mission(page);
  const events: Array<{ event_type: string }> = [];
  await page.route("http://api.test/v1/learning/event", route => { events.push(route.request().postDataJSON()); return route.fulfill({ json: {} }); });
  let answer: { response?: { value: string } } | undefined;
  await page.route("http://api.test/v1/learning/attempt", route => {
    answer = route.request().postDataJSON();
    return route.fulfill({ json: { correct: true, mastery_gain: 8, projected_band: "Developing", feedback: "Your discovery is saved.", explanation: "Three groups of four make twelve." } });
  });
  await page.goto("/play/mission?studentId=task-first-learner");
  await page.getByRole("button", { name: "12", exact: true }).click();
  const toggle = supportToggle(page);
  await toggle.focus();
  await page.keyboard.press("Enter");
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  await expect(supportPanel(page).getByRole("button", { name: "Close support", exact: true })).toBeFocused();
  await expect(supportPanel(page)).toContainText("A recording is not ready for this step.");
  expect(events.filter(event => event.event_type === "support_changed")).toEqual([]);
  await page.getByRole("button", { name: "Contrast", exact: true }).click();
  await expect(page.locator("main")).not.toHaveClass(/high-contrast/);
  await page.keyboard.press("Escape");
  await expect(toggle).toBeFocused();
  await expect(supportPanel(page)).toBeHidden();
  await expect(page.getByRole("button", { name: "12", exact: true })).toHaveClass(/ring-4/);
  await expect.poll(() => events.filter(event => event.event_type === "support_changed").length).toBe(1);
  await page.getByRole("button", { name: "Submit answer", exact: true }).click();
  await expect(page.getByRole("button", { name: "See my discoveries" })).toBeVisible();
  expect(answer?.response?.value).toBe("12");
});

test("support is usable without a preset and narrow header controls do not overlap", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 900 });
  await mission(page, { supports: false });
  await page.goto("/play/mission?studentId=task-first-learner");
  await supportToggle(page).click();
  const panel = supportPanel(page);
  await expect(panel.getByRole("button", { name: "Calm", exact: true })).toBeVisible();
  await panel.getByRole("button", { name: "Calm", exact: true }).click();
  await expect(page.locator("main")).toHaveClass(/reduced-motion/);
  const result = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
  expect(result.violations).toEqual([]);
  await panel.getByRole("button", { name: "Close support", exact: true }).click();
  await expect(supportToggle(page)).toBeFocused();
  const home = await page.getByRole("link", { name: "NexusLearn home", exact: true }).boundingBox();
  const exit = await page.getByRole("link", { name: "Exit", exact: true }).boundingBox();
  expect(home!.x + home!.width).toBeLessThanOrEqual(exit!.x + 1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
});

test("a support deep link opens the real panel and audio shortcut returns to its mounted player", async ({ page }) => {
  await mission(page, { audio: true });
  await page.goto("/play/mission?studentId=task-first-learner#mission-support");
  await expect(supportToggle(page)).toHaveAttribute("aria-expanded", "true");
  await expect(supportPanel(page)).toBeVisible();
  const shortcut = page.getByRole("link", { name: "Jump to audio replay", exact: true });
  await shortcut.focus();
  await page.keyboard.press("Enter");
  await expect(supportPanel(page)).toBeHidden();
  await expect(page.getByRole("button", { name: "Hear question", exact: true })).toBeFocused();
});

test("recorded audio remains discoverable without a saved support preset", async ({ page }) => {
  await mission(page, { supports: false, audio: true });
  await page.goto("/play/mission?studentId=task-first-learner");
  await supportToggle(page).click();
  await page.getByRole("link", { name: "Jump to audio replay", exact: true }).click();
  await expect(supportPanel(page)).toBeHidden();
  await expect(page.getByRole("button", { name: "Hear question", exact: true })).toBeFocused();
});

test("switch scanning can enter support and resume the task without losing its configured mode", async ({ page }) => {
  await mission(page, { scanning: true });
  await page.goto("/play/mission?studentId=task-first-learner");
  await expect(page.getByRole("button", { name: "Show a hint", exact: true })).toBeFocused();
  await supportToggle(page).click();
  await expect(supportPanel(page).getByRole("button", { name: "Close support", exact: true })).toBeFocused();
  await page.keyboard.press("Space");
  await expect(supportPanel(page)).toBeHidden();
  await expect(page.getByRole("button", { name: "Show a hint", exact: true })).toBeFocused();
  await supportToggle(page).click();
  await expect(page.getByRole("button", { name: "Switch access", exact: true })).toHaveAttribute("aria-pressed", "true");
  await page.keyboard.press("Escape");
  await expect(supportPanel(page)).toBeHidden();
  await expect(page.getByRole("button", { name: "Show a hint", exact: true })).toBeFocused();
});

test("an audio shortcut transfers switch focus and Space activation together", async ({ page }) => {
  await page.addInitScript(() => {
    const clips: { paused: boolean; src: string }[] = [];
    Object.assign(window, { __qaClips: clips });
    window.Audio = class {
      paused = true;
      preload = "";
      onended = null;
      onerror = null;
      constructor(public src = "") { clips.push(this); }
      play() { this.paused = false; return Promise.resolve(); }
      pause() { this.paused = true; }
      removeAttribute() {}
      load() {}
    } as unknown as typeof Audio;
  });
  const time = new Date("2026-09-23T12:00:00Z");
  await page.clock.install({ time });
  await page.clock.pauseAt(time);
  await mission(page, { scanning: true, audio: true });
  await page.goto("/play/mission?studentId=task-first-learner");
  await expect(page.getByRole("button", { name: "Show a hint", exact: true })).toBeFocused();
  await supportToggle(page).click();
  await page.getByRole("link", { name: "Jump to audio replay", exact: true }).click();
  await page.clock.runFor(20); // Flush the ordinary focus frame without advancing the scan.
  await expect(page.getByRole("button", { name: "Hear question", exact: true })).toBeFocused();
  await page.keyboard.press("Space");
  await expect.poll(() => page.evaluate(() => (window as unknown as { __qaClips: { paused: boolean }[] }).__qaClips.filter(clip => !clip.paused).length)).toBe(1);
  await expect(page.getByText("Count four three times.", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("dialog", { name: "Take a quiet pause" })).toHaveCount(0);
});

test("switch scanning includes the essential controls after the task and can open support", async ({ page }) => {
  await mission(page);
  await page.goto("/play/mission?studentId=task-first-learner");
  await supportToggle(page).click();
  const time = new Date("2026-09-23T12:00:00Z");
  await page.clock.install({ time });
  await page.clock.pauseAt(new Date(time.getTime() + 1000));
  await page.getByRole("button", { name: "Switch access", exact: true }).click();
  const visited = new Set<string>();
  for (let i = 0; i < 24; i += 1) {
    const label = await page.evaluate(() => document.activeElement?.getAttribute("aria-label") || document.activeElement?.textContent?.trim() || "");
    visited.add(label);
    await expect(page.locator(":focus")).toBeInViewport();
    if (label === "Support & audio") break;
    await page.clock.runFor(1200);
  }
  for (const label of ["Show a hint", "Exit", "Pause", "Mute sounds", "Support & audio"]) expect(visited.has(label), label).toBe(true);
  await page.keyboard.press("Space");
  await expect(supportPanel(page).getByRole("button", { name: "Close support", exact: true })).toBeFocused();
});

test("switch users reach required listening before the locked answer controls", async ({ page }) => {
  const time = new Date("2026-09-23T12:00:00Z");
  await page.clock.install({ time });
  await page.clock.pauseAt(time);
  await mission(page, { scanning: true, audio: true, requiredAudio: true });
  await page.goto("/play/mission?studentId=task-first-learner");
  await expect(page.getByRole("button", { name: "12", exact: true })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Hear question", exact: true })).toBeFocused();
});

test("the first teaching step precedes the game journal too", async ({ page }) => {
  await mission(page, { lesson: true });
  await page.goto("/play/mission?studentId=task-first-learner");
  const heading = page.getByRole("heading", { name: "Look at three equal groups.", exact: true });
  await expect(heading).toBeVisible();
  expect((await heading.boundingBox())!.y).toBeLessThan(page.viewportSize()!.height - 80);
  expect(await heading.evaluate(element => Boolean(element.compareDocumentPosition(document.querySelector('[aria-label="Your learning journey"]')!) & Node.DOCUMENT_POSITION_FOLLOWING))).toBe(true);
  await page.getByRole("button", { name: "Start practice", exact: true }).click();
  await expect(page.getByRole("region", { name: "Mission question" })).toBeVisible();
});
