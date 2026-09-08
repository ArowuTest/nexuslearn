import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { readFile } from "node:fs/promises";

test.describe.configure({ timeout: 60_000 });

const releaseID = "narration-release-v2-aaaaaaaaaaaaaaaaaaaaaaaa";
const profileHash = "c".repeat(64);

type ProducedAudio = { file: string; text: string; sha256: string; text_sha256: string };

async function openAudioWorkspace(page: Page, recording?: ProducedAudio) {
  let reviewPayload: Record<string, unknown> | null = null;
  let rerecordPayload: Record<string, unknown> | null = null;
  let audioHash = recording?.sha256 ?? "b".repeat(64);
  let textHash = recording?.text_sha256 ?? "a".repeat(64);
  let currentProfileHash = profileHash;
  let audioFile = recording?.file ?? "/audio/narration/alice/y1/blend-together.mp3";
  let voiceSettings: Record<string, number> = recording ? {} : { speed: 0.92 };
  await page.route("http://api.test/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    expect(request.headers().authorization).toBe("Bearer audio-reviewer-session");

    if (url.pathname === "/v1/admin/content/narration-queue") {
      expect(url.searchParams.get("status")).toBe("stale");
      expect(url.searchParams.get("subject")).toBe("English");
      expect(url.searchParams.get("year")).toBe("1");
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          release_id: releaseID,
          catalogue_id: "narration-catalogue-v2-bbbbbbbbbbbbbbbbbbbbbbbb",
          items: [{
            rank: 1,
            asset_id: "narration-v1-dddddddddddddddddddddddd",
            pack_id: "en-y1-phonics-blend-cvc-words",
            year: 1,
            subject: "English",
            kind: "lesson",
            source_id: "blend-together",
            text_preview: recording?.text ?? "Listen, stretch each sound, then blend the word.",
            file: audioFile,
            text_sha256: textHash,
            audio_sha256: audioHash,
            production_profile_sha256: currentProfileHash,
            production_identity_sha256: "d".repeat(64),
            reuse_count: 4,
            reference_count: 7,
            voice_name: "Alice - Clear, Engaging Educator",
            model_id: "eleven_multilingual_v2",
            output_format: "mp3_44100_128",
            voice_settings: voiceSettings,
            status: "stale",
            review: {
              id: "review-old",
              asset_id: "narration-v1-dddddddddddddddddddddddd",
              text_sha256: "e".repeat(64),
              audio_sha256: "f".repeat(64),
              production_profile_sha256: "0".repeat(64),
              decision: "approved",
              reviewer_name: "Previous reviewer",
              criteria: { natural: true, clear: true, pronunciation: true, age_suitable: true },
              created_at: "2026-08-01T10:00:00Z",
              updated_at: "2026-08-01T10:00:00Z",
              stale: true,
            },
            rationale: ["phonics and early-literacy pronunciation must be human-listened"],
          }],
          total: 1,
          counts: { awaiting: 2, approved: 8, rejected: 1, stale: 1 },
          years: [{ year: 1, counts: { awaiting: 2, approved: 8, rejected: 1, stale: 1 }, reviewed: 8, pending: 4 }],
          limit: 20,
          offset: 0,
          next_offset: null,
          served_by: "api",
          provider: "elevenlabs",
          voice_name: "Alice - Clear, Engaging Educator",
          model_id: "eleven_multilingual_v2",
        }),
      });
      return;
    }

    if (url.pathname === "/v1/admin/content/narration-reviews" && request.method() === "POST") {
      reviewPayload = request.postDataJSON();
      await route.fulfill({ contentType: "application/json", body: JSON.stringify({ ...reviewPayload, id: "review-new" }) });
      return;
    }

    if (url.pathname.endsWith("/rerecord-request") && request.method() === "POST") {
      rerecordPayload = request.postDataJSON();
      await route.fulfill({ contentType: "application/json", body: JSON.stringify({ request_id: "rerecord-1", ...rerecordPayload }) });
      return;
    }

    if (url.pathname.startsWith("/v1/admin/content/reports/")) {
      await route.fulfill({ contentType: "application/json", body: "null" });
      return;
    }
    await route.fulfill({ contentType: "application/json", body: JSON.stringify({}) });
  });

  // Install the fake account before hydration and navigate only once. Starting
  // assertions at DOMContentLoaded can race loading the authenticated workspace.
  await page.addInitScript(() => {
    sessionStorage.setItem("nexuslearn_account_session", "audio-reviewer-session");
    sessionStorage.setItem("nexuslearn_account_role", "content_reviewer");
    sessionStorage.setItem("nexuslearn_account_session_expires", "2099-01-01T00:00:00Z");
  });
  await page.goto("/admin?section=audio&audio_status=stale&audio_subject=English&audio_year=1");
  // The authenticated shell precedes the lazy-loaded audio chunk. Match the
  // admin harness's bounded startup wait without weakening workflow assertions.
  await expect(page.getByRole("heading", { name: "Audio listening QA" })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText(recording?.text ?? "Listen, stretch each sound, then blend the word.", { exact: true })).toBeVisible();

  return {
    getReviewPayload: () => reviewPayload,
    getRerecordPayload: () => rerecordPayload,
    replaceRecording: (field: "audio" | "transcript" | "profile" | "url" = "audio") => {
      if (field === "audio") audioHash = "9".repeat(64);
      if (field === "transcript") textHash = "8".repeat(64);
      if (field === "profile") currentProfileHash = "7".repeat(64);
      if (field === "url") audioFile = "/audio/narration/alice/y1/replaced.mp3";
      voiceSettings = {};
    },
  };
}

async function completePlayback(page: Page, seconds = 1) {
  await page.locator("audio").evaluate((audio, duration) => {
    Object.defineProperty(audio, "duration", { configurable: true, value: duration });
    Object.defineProperty(audio, "currentTime", { configurable: true, value: duration });
    audio.dispatchEvent(new Event("canplay", { bubbles: true }));
    audio.dispatchEvent(new Event("loadedmetadata", { bubbles: true }));
    audio.dispatchEvent(new Event("timeupdate", { bubbles: true }));
    audio.dispatchEvent(new Event("ended", { bubbles: true }));
  }, seconds);
}

test("reviewer restores filters, verifies exact audio identity, and requests a governed re-record", async ({ page }) => {
  const captured = await openAudioWorkspace(page);

  await expect(page.getByLabel("Audio decision status")).toHaveValue("stale");
  await expect(page.getByLabel("Audio subject")).toHaveValue("English");
  await expect(page.getByLabel("Audio year")).toHaveValue("1");
  await expect(page.getByRole("alert").filter({ hasText: "previous decision is stale" })).toBeVisible();
  await expect(page.getByText("Listen, stretch each sound, then blend the word.")).toBeVisible();
  await expect(page.getByText("Used by 7 learning references")).toBeVisible();
  await expect(page.getByText("Production speed: 0.92x · listen at 1x for approval")).toBeVisible();

  await page.getByLabel("Reviewer name").fill("A. Audio Reviewer");
  await page.getByLabel("Re-record reason").selectOption("pronunciation");
  await page.getByLabel("Review notes").fill("The final consonant is unclear and needs a slower clean take.");
  await page.getByRole("button", { name: "Reject and request re-record" }).click();

  await expect(page.getByRole("status").filter({ hasText: "Re-record request recorded" })).toBeVisible();
  expect(captured.getReviewPayload()).toMatchObject({
    production_profile_sha256: profileHash,
    decision: "rejected",
    rejection_reasons: ["pronunciation"],
  });
  expect(captured.getRerecordPayload()).toEqual({
    release_id: releaseID,
    reason: "pronunciation",
    notes: "The final consonant is unclear and needs a slower clean take.",
  });

  const accessibility = await new AxeBuilder({ page })
    .include("main")
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(accessibility.violations.filter((item) => item.impact === "critical" || item.impact === "serious")).toEqual([]);
});

test("audio filters stay in the URL and keyboard navigation reaches the dedicated workspace", async ({ page }) => {
  await openAudioWorkspace(page);

  await page.getByLabel("Search audio queue").fill("blend");
  await page.getByRole("button", { name: "Apply audio filters" }).click();
  await expect(page).toHaveURL(/audio_search=blend/);

  const audioNavigation = page.getByRole("navigation", { name: "Admin sections" }).getByRole("button", { name: "Audio", exact: true });
  await expect(audioNavigation).toHaveAttribute("aria-current", "page");
  await audioNavigation.focus();
  await page.keyboard.press("ArrowUp");
  await expect(page.getByRole("button", { name: "Readiness", exact: true })).toBeFocused();
});

test("approval is held until the exact recording completes playback", async ({ page }) => {
  const captured = await openAudioWorkspace(page);

  const criteria = page.locator('fieldset input[type="checkbox"]');
  await expect(criteria).toHaveCount(4);
  for (let index = 0; index < 4; index += 1) await criteria.nth(index).check();
  await page.getByLabel("Reviewer name").fill("A. Audio Reviewer");

  const approve = page.getByRole("button", { name: "Approve listening" });
  await expect(approve).toBeDisabled();
  await page.locator("audio").evaluate((audio) => {
    Object.defineProperty(audio, "duration", { configurable: true, value: 1 });
    Object.defineProperty(audio, "currentTime", { configurable: true, value: 1 });
    audio.dispatchEvent(new Event("canplay", { bubbles: true }));
    audio.dispatchEvent(new Event("timeupdate", { bubbles: true }));
    audio.dispatchEvent(new Event("ended", { bubbles: true }));
  });
  await expect(approve).toBeEnabled();
  await approve.click();

  await expect(page.getByRole("status").filter({ hasText: "approved against the current transcript" })).toBeVisible();
  expect(captured.getReviewPayload()).toMatchObject({
    decision: "approved",
    playback_evidence: { surface: "admin_audio_workspace", completed: true, duration_ms: 1000 },
  });
});

for (const field of ["audio", "transcript", "profile", "url"] as const) {
test(`a replacement recording (${field}) cannot inherit the previous file's listening draft`, async ({ page }) => {
  const captured = await openAudioWorkspace(page);
  await page.getByLabel("Reviewer name").fill("A. Audio Reviewer");
  for (const box of await page.locator('fieldset input[type="checkbox"]').all()) await box.check();
  await completePlayback(page);
  await expect(page.getByRole("button", { name: "Approve listening" })).toBeEnabled();

  captured.replaceRecording(field);
  await page.getByRole("button", { name: "Apply audio filters" }).click();
  await expect(page.getByRole("status").filter({ hasText: "matching audio assets loaded" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Apply audio filters" })).toBeEnabled();
  await page.locator("audio").dispatchEvent("canplay");
  await expect(page.getByRole("button", { name: "Approve listening" })).toBeDisabled();
  await expect(page.getByLabel("Reviewer name")).toHaveValue("");
  await expect(page.locator('fieldset input[type="checkbox"]:checked')).toHaveCount(0);
  expect(captured.getReviewPayload()).toBeNull();
});
}

test("reviewers see a pace screen from the actual player's duration without automatic approval", async ({ page }) => {
  await openAudioWorkspace(page);
  await page.locator("audio").evaluate(audio => {
    Object.defineProperty(audio, "duration", { configurable: true, value: 2 });
    audio.dispatchEvent(new Event("loadedmetadata", { bubbles: true }));
  });
  await expect(page.getByText(/240 words\/min at 1x/)).toBeVisible();
  await expect(page.getByText(/Fast-pace review/)).toBeVisible();
  await expect(page.getByText(/Screening only.*not.*listening approval/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Approve listening" })).toBeDisabled();
  await expect(page.locator('fieldset input[type="checkbox"]:checked')).toHaveCount(0);
  await page.locator("article").filter({ has: page.locator("audio") }).screenshot({ path: test.info().outputPath("pace-review.png"), animations: "disabled" });
});

test("missing production-speed metadata stays explicitly unknown", async ({ page }) => {
  const captured = await openAudioWorkspace(page);
  captured.replaceRecording();
  await page.getByRole("button", { name: "Apply audio filters" }).click();
  await expect(page.getByText(/Production speed: not recorded/)).toBeVisible();
  await expect(page.getByText(/Production speed: 0.92x/)).toHaveCount(0);
});

test("a real produced MP3 plays to its native end without granting suitability approval", async ({ page }) => {
  const manifest = JSON.parse(await readFile("../../packages/content/audio/narration-manifest.json", "utf8")) as { items: ProducedAudio[] };
  const recording = manifest.items.find(item => item.file === "/audio/narration/alice/en-y1-listening-comprehension/vocabulary/listen.mp3");
  expect(recording).toBeDefined();
  const captured = await openAudioWorkspace(page, recording!);
  const audio = page.locator("audio");
  await expect(page.getByRole("button", { name: "Approve listening" })).toBeDisabled();
  await audio.click();
  await audio.evaluate(element => (element as HTMLAudioElement).play());
  await expect(page.getByRole("status").filter({ hasText: "Played through" })).toBeVisible({ timeout: 30_000 });
  expect(await audio.evaluate(element => {
    const player = element as HTMLAudioElement;
    return { ended: player.ended, rate: player.playbackRate, ready: player.readyState >= 2 };
  })).toEqual({ ended: true, rate: 1, ready: true });
  await expect(page.getByText(/Audio playback failed/)).toHaveCount(0);
  await expect(page.locator('fieldset input[type="checkbox"]:checked')).toHaveCount(0);
  expect(captured.getReviewPayload()).toBeNull();
});
