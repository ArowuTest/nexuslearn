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
      questions: [{ id: "integrity-question", question_version: fixture.version === null ? undefined : "version-1", response_kind: fixture.responseKind ?? (typeof fixture.expected === "number" ? "number" : "text"), objective_id: "integrity-objective", activity_id: "integrity-activity", format: fixture.format, body: fixture.body, hints: fixture.hints ?? [], status: "published" }],
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

async function audioHarness(page: Page, pending = false) {
  await page.addInitScript((pending) => {
    const clips: { paused: boolean; src: string }[] = [];
    Object.assign(window, { __qaClips: clips });
    window.Audio = class {
      paused = true;
      preload = "";
      onended = null;
      onerror = null;
      constructor(public src = "") { clips.push(this); }
      play() {
        this.paused = false;
        return pending ? new Promise<void>(resolve => Object.assign(window, { __resolveAudio: resolve })) : Promise.resolve();
      }
      pause() { this.paused = true; }
      removeAttribute() {}
      load() {}
    } as unknown as typeof Audio;
  }, pending);
}

test("required listening without a ready recording offers an unmarked accessible exit", async ({ page }) => {
  await mission(page, { ...numberFixture, switchAccess: true, responseKind: "review", body: { ...numberFixture.body, audio_required: true, audio_asset_id: "pending-listening" } });
  await page.goto("/play/mission?studentId=integrity-learner");
  await expect(page.getByRole("heading", { name: "Listening recording unavailable" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Submit answer" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Back to worlds" })).toBeFocused();
  await page.keyboard.press("Space");
  await expect(page).toHaveURL(/\/play$/);
});

test("missing required transport cannot silently become a visual assessment", async ({ page }) => {
  await mission(page, { ...numberFixture, body: { ...numberFixture.body, audio_required: true } });
  await page.goto("/play/mission?studentId=integrity-learner");
  await expect(page.getByRole("heading", { name: "Listening recording unavailable" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Submit answer" })).toHaveCount(0);
});

for (const control of ["Hear question", "Hear the whole prompt"]) {
 test(`failed required audio via ${control} closes answer controls without a score`, async ({ page }) => {
  await page.addInitScript((control) => {
    let plays=0;
    window.Audio = class {
      preload="";onended:(()=>void)|null=null;onerror=null;
      play(){
        if(control==="Hear the whole prompt" && plays++===0){Object.assign(window,{finishRequired:()=>this.onended?.()});return Promise.resolve();}
        return Promise.reject(new Error("test transport failure"));
      }
      pause(){}removeAttribute(){}load(){}
    } as unknown as typeof Audio;
  }, control);
  await mission(page, { ...numberFixture, body: { ...numberFixture.body, audio_required: true, audio_url: "/qa-required.mp3", whole_audio_asset_id: "/qa-required.mp3", sounds:["c"] } });
  const attempts: string[]=[];
  page.on("request",request=>{if(request.url().endsWith("/v1/learning/attempt"))attempts.push(request.postData()??"");});
  await open(page);
  if(control==="Hear the whole prompt"){
    await page.getByRole("button",{name:"Hear question",exact:true}).click();
    await page.evaluate(()=>{(window as unknown as {finishRequired:()=>void}).finishRequired();});
  }
  await page.getByRole("button", { name: control, exact:true }).click();
  await expect(page.getByRole("heading", { name: "Listening recording unavailable" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Submit answer" })).toHaveCount(0);
  expect(attempts).toEqual([]);
 });
}
const activeAudio = (page: Page) => page.evaluate(() => (window as unknown as { __qaClips: { paused: boolean }[] }).__qaClips.filter(clip => !clip.paused).length);

test("ready required narration allows marking and obsolete audio errors do not block it", async ({ page }) => {
  await audioHarness(page);
  await mission(page, { ...numberFixture, body: { ...numberFixture.body, audio_required: true, audio_url: "/qa-required.mp3" } });
  await page.route("http://api.test/v1/learning/attempt",route=>route.fulfill({json:result()}));
  await open(page);
  await page.getByRole("button",{name:"Hear question",exact:true}).click();
  await page.getByRole("button",{name:"Hear question",exact:true}).click();
  await page.evaluate(()=>{ (window as unknown as {__qaClips:{onerror:()=>void}[]}).__qaClips[0].onerror(); });
  await page.evaluate(()=>{ (window as unknown as {__qaClips:{onended:()=>void}[]}).__qaClips[0].onended(); });
  await expect(page.getByRole("region",{name:"Mission question"})).toBeVisible();
  await expect(page.getByRole("button",{name:"Keyboard answer",exact:true})).toBeDisabled();
  await page.evaluate(()=>{ (window as unknown as {__qaClips:{onended:()=>void}[]}).__qaClips[1].onended(); });
  await expect(page.getByRole("button",{name:"Keyboard answer",exact:true})).toBeEnabled();
  await typeNumber(page,"12");
  await page.getByRole("button",{name:"Submit answer",exact:true}).click();
  await expect(page.getByRole("button",{name:"See my discoveries"})).toBeVisible();
});

test("a required recording that errors after playback starts closes marking", async ({ page }) => {
  await audioHarness(page);
  await mission(page, { ...numberFixture, body: { ...numberFixture.body, audio_required: true, audio_url: "/qa-required.mp3" } });
  await open(page);
  await page.getByRole("button",{name:"Hear question",exact:true}).click();
  await expect.poll(()=>activeAudio(page)).toBe(1);
  await page.evaluate(()=>{ (window as unknown as {__qaClips:{onerror:()=>void}[]}).__qaClips[0].onerror(); });
  await expect(page.getByRole("region",{name:"Listening recording unavailable"})).toBeFocused();
  await expect(page.getByRole("button",{name:"Submit answer"})).toHaveCount(0);
});

test("produced narration replaces prior clips and stops on mute, pause and question completion", async ({ page }) => {
  await audioHarness(page);
  await mission(page, { ...numberFixture, body: { ...numberFixture.body, whole_audio_asset_id: "/qa-whole.mp3", sounds: ["a"], audio_assets: { a: "/qa-a.mp3" } } });
  await page.route("http://api.test/v1/learning/attempt", route => route.fulfill({ json: result() }));
  await open(page);
  const active = () => activeAudio(page);
  await page.getByRole("button", { name: "Hear question", exact: true }).click();
  await expect.poll(active).toBe(1);
  await page.getByRole("button", { name: "Hear question", exact: true }).click();
  await expect.poll(active).toBe(1);
  await page.getByRole("button", { name: "Mute sounds", exact: true }).click();
  await expect.poll(active).toBe(0);
  await page.getByRole("button", { name: "Unmute sounds", exact: true }).click();
  await page.getByRole("button", { name: "Hear question", exact: true }).click();
  await expect.poll(active).toBe(1);
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await expect.poll(active).toBe(0);
  await page.getByRole("button", { name: "Continue mission", exact: true }).click();
  await page.getByRole("button", { name: "Hear question", exact: true }).click();
  await typeNumber(page, "12");
  await page.getByRole("button", { name: "Submit answer", exact: true }).click();
  await expect(page.getByRole("button", { name: "See my discoveries" })).toBeVisible();
  await expect.poll(active).toBe(0);
});

test("released whole-word and phoneme clips share playback while unapproved clips remain unavailable", async ({ page }) => {
  await audioHarness(page);
  let releaseDestination!: () => void;
  const destinationPending = new Promise<void>(resolve => { releaseDestination = resolve; });
  await page.route(/\/play\?_rsc=/, async route => {
    await destinationPending;
    await route.continue().catch(() => {});
  });
  await page.route("**/content/narration-manifest.json", route => route.fulfill({ json: { items: [
    { id: "word-cat", file: "/qa-cat.mp3", technical_pass: true, production_status: "released" },
    { id: "phoneme-c", file: "/qa-c.mp3", technical_pass: true, production_status: "human_listening_approved" },
    { id: "phoneme-a", file: "/qa-a.mp3", technical_pass: true, production_status: "review" },
  ] } }));
  await mission(page, { ...numberFixture, body: { ...numberFixture.body, sounds: ["c", "a"], whole_audio_asset_id: "word-cat", audio_assets: { c: "phoneme-c", a: "phoneme-a" } } });
  await open(page);
  await expect(page.getByRole("button", { name: "a studio audio unavailable", exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "Hear the whole prompt", exact: true }).click();
  await expect.poll(() => activeAudio(page)).toBe(1);
  await page.getByRole("button", { name: "Hear c", exact: true }).click();
  await expect.poll(() => activeAudio(page)).toBe(1);
  expect(await page.evaluate(() => (window as unknown as { __qaClips: { src: string }[] }).__qaClips.map(clip => clip.src))).toEqual(["/qa-cat.mp3", "/qa-c.mp3"]);
  await page.locator('a[href="/play"]').first().click();
  // Stop at navigation intent, even if the destination's server data is slow.
  try {
    await expect.poll(() => activeAudio(page)).toBe(0);
  } finally {
    releaseDestination();
  }
});

test("muting required playback cannot unlock answers through a late completion", async ({ page }) => {
  await audioHarness(page, true);
  await mission(page, { ...numberFixture, body: { ...numberFixture.body, audio_required: true, audio_url: "/qa-required.mp3" } });
  await open(page);
  await page.getByRole("button", { name: "Hear question", exact: true }).click();
  await expect.poll(() => activeAudio(page)).toBe(1);
  await page.getByRole("button", { name: "Mute sounds", exact: true }).click();
  await page.evaluate(() => {
    const harness = window as unknown as { __resolveAudio: () => void; __qaClips: { onended: () => void }[] };
    harness.__resolveAudio();
    harness.__qaClips[0].onended();
  });
  await expect(page.getByRole("region", { name: "Mission question" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Keyboard answer", exact: true })).toBeDisabled();
});

test("muting a pending narration play cancels it without recording a transport failure", async ({ page }) => {
  await audioHarness(page, true);
  await mission(page, { ...numberFixture, body: { ...numberFixture.body, prompt_audio_url: "/qa-pending.mp3" } });
  const failed: string[] = [];
  page.on("request", request => { if (request.postData()?.includes('"audio_playback_failed"')) failed.push(request.postData()!); });
  await open(page);
  await page.getByRole("button", { name: "Hear question", exact: true }).click();
  await expect.poll(() => activeAudio(page)).toBe(1);
  await page.getByRole("button", { name: "Mute sounds", exact: true }).click();
  await expect.poll(() => activeAudio(page)).toBe(0);
  await page.evaluate(() => (window as unknown as { __resolveAudio: () => void }).__resolveAudio());
  await expect(page.getByText("Sound is muted. Turn sound on to hear the studio narration.", { exact: true })).toHaveCount(0);
  expect(failed).toEqual([]);
});

test("an existing generated MP3 decodes through the mission player and mute stops it", async ({ page }) => {
  // Technical playback in a disposable fixture is not listening approval or a
  // production manifest promotion. No Audio mock: Chromium decodes the file.
  await page.addInitScript(() => {
    const NativeAudio = window.Audio;
    window.Audio = class extends NativeAudio {
      constructor(src?: string) {
        super(src);
        Object.assign(window, { __qaRealAudio: this });
      }
    };
  });
  await mission(page, { ...numberFixture, body: { ...numberFixture.body, prompt_audio_url: "/audio/narration/alice/en-y1-listening-comprehension/lesson/ready-to-listen-warm-up.mp3" } });
  await open(page);
  await page.getByRole("button", { name: "Hear question", exact: true }).click();
  await expect.poll(() => page.evaluate(() => {
    const audio = (window as unknown as { __qaRealAudio?: HTMLAudioElement }).__qaRealAudio;
    return Boolean(audio && !audio.error && audio.readyState >= 2 && Number.isFinite(audio.duration) && audio.currentTime > 0);
  })).toBe(true);
  await page.getByRole("button", { name: "Mute sounds", exact: true }).click();
  await expect.poll(() => page.evaluate(() => (window as unknown as { __qaRealAudio: HTMLAudioElement }).__qaRealAudio.paused)).toBe(true);
});

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

test("attempts preserve answer help separately from access support context", async ({ page }) => {
  await audioHarness(page);
  await mission(page, {
    ...numberFixture,
    format: "audio-blend",
    body: { ...numberFixture.body, sounds: ["c"], audio_assets: { c: "/qa-c.mp3" }, prompt_audio_url: "/qa-prompt.mp3" },
  });
  let sent: Record<string, unknown> | undefined;
  await page.route("http://api.test/v1/learning/attempt", async route => { sent = route.request().postDataJSON(); await route.fulfill({ json: result() }); });
  await open(page);
  await page.getByRole("button", { name: "Calm", exact: true }).click();
  await page.getByRole("button", { name: "Hear question", exact: true }).click();
  await page.getByRole("button", { name: "Hear c", exact: true }).click();
  await page.getByRole("button", { name: "Show a hint", exact: true }).click();
  await typeNumber(page, "12");
  await page.getByRole("button", { name: "Submit answer", exact: true }).click();
  await expect(page.getByRole("button", { name: "See my discoveries" })).toBeVisible();
  expect(sent?.assistance_used).toEqual(expect.arrayContaining(["audio_replay"]));
  expect(sent?.hint_used).toBe(true);
  expect(sent?.response_mode).toBe("keyboard");
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

test("an oversized request is rejected without trapping the pupil in an uncertain retry", async ({ page }) => {
  await mission(page, numberFixture);
  await page.route("http://api.test/v1/learning/attempt", route => route.fulfill({ status: 413, json: { error: "answer request is too large" } }));
  await open(page);
  await typeNumber(page, "12");
  await page.getByRole("button", { name: "Submit answer", exact: true }).click();
  await expect(page.getByRole("alert", { name: "Answer saving" })).toContainText("answer request is too large");
  await expect(page.getByRole("button", { name: "Retry saving answer" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Choose another mission" })).toBeVisible();
});

test("a proxy rejection with HTML still offers a safe exit", async ({ page }) => {
  await mission(page, numberFixture);
  await page.route("http://api.test/v1/learning/attempt", route => route.fulfill({ status: 413, contentType: "text/html", body: "<h1>Request too large</h1>" }));
  await open(page);
  await typeNumber(page, "12");
  await page.getByRole("button", { name: "Submit answer", exact: true }).click();
  await expect(page.getByRole("alert", { name: "Answer saving" })).toContainText("This answer could not be marked");
  await expect(page.getByRole("button", { name: "Retry saving answer" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Choose another mission" })).toBeVisible();
});

test("a definitive rejection with a null JSON body still offers a safe exit", async ({ page }) => {
  await mission(page, numberFixture);
  await page.route("http://api.test/v1/learning/attempt", route => route.fulfill({ status: 413, contentType: "application/json", body: "null" }));
  await open(page);
  await typeNumber(page, "12");
  await page.getByRole("button", { name: "Submit answer", exact: true }).click();
  await expect(page.getByRole("alert", { name: "Answer saving" })).toContainText("This answer could not be marked");
  await expect(page.getByRole("button", { name: "Retry saving answer" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Choose another mission" })).toBeVisible();
});

test("an incorrect answer shows saved task guidance without completing the mission", async ({ page }) => {
  await mission(page, { format: "word-build", body: { prompt: "Build the word cat.", letters: ["c", "a", "t"] }, expected: "cat" });
  const guidance = "Not yet. Check the sounds one at a time, then blend them together.";
  await page.route("http://api.test/v1/learning/attempt", route => route.fulfill({ json: { ...result(false), feedback: guidance } }));
  await open(page);
  await typeNumber(page, "dog");
  await page.getByRole("button", { name: "Submit answer", exact: true }).click();
  await expect(page.getByTestId("mission-reward-moment")).toBeVisible();
  await expect(page.getByTestId("mission-reward-moment")).toContainText(guidance);
  await expect(page.getByRole("button", { name: "See my discoveries" })).toHaveCount(0);
  await expect(page.getByLabel("Keyboard answer", { exact: true })).toBeEnabled();
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
