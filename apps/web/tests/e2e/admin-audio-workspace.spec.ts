import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test.describe.configure({ timeout: 60_000 });

const releaseID = "narration-release-v2-aaaaaaaaaaaaaaaaaaaaaaaa";
const profileHash = "c".repeat(64);

async function openAudioWorkspace(page: Page) {
  let reviewPayload: Record<string, unknown> | null = null;
  let rerecordPayload: Record<string, unknown> | null = null;
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
            text_preview: "Listen, stretch each sound, then blend the word.",
            file: "/audio/narration/alice/y1/blend-together.mp3",
            text_sha256: "a".repeat(64),
            audio_sha256: "b".repeat(64),
            production_profile_sha256: profileHash,
            production_identity_sha256: "d".repeat(64),
            reuse_count: 4,
            reference_count: 7,
            voice_name: "Alice - Clear, Engaging Educator",
            model_id: "eleven_multilingual_v2",
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

  await page.goto("/admin", { waitUntil: "domcontentloaded" });
  await page.evaluate(() => {
    sessionStorage.setItem("nexuslearn_account_session", "audio-reviewer-session");
    sessionStorage.setItem("nexuslearn_account_role", "content_reviewer");
    sessionStorage.setItem("nexuslearn_account_session_expires", "2099-01-01T00:00:00Z");
  });
  await page.goto("/admin?section=audio&audio_status=stale&audio_subject=English&audio_year=1", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Audio listening QA" })).toBeVisible();

  return {
    getReviewPayload: () => reviewPayload,
    getRerecordPayload: () => rerecordPayload,
  };
}

test("reviewer restores filters, verifies exact audio identity, and requests a governed re-record", async ({ page }) => {
  const captured = await openAudioWorkspace(page);

  await expect(page.getByLabel("Audio decision status")).toHaveValue("stale");
  await expect(page.getByLabel("Audio subject")).toHaveValue("English");
  await expect(page.getByLabel("Audio year")).toHaveValue("1");
  await expect(page.getByRole("alert").filter({ hasText: "previous decision is stale" })).toBeVisible();
  await expect(page.getByText("Listen, stretch each sound, then blend the word.")).toBeVisible();
  await expect(page.getByText("Used by 7 learning references")).toBeVisible();

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
