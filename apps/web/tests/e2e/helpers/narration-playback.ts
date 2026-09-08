import type { Page } from "@playwright/test";

// Synthetic native telemetry for workflow/payload assertions only. The separate
// real-MP3 journey verifies actual playback; neither creates human approval.
export async function simulateCompletedNarrationPlayback(page: Page, seconds = 1) {
  await page.locator("audio").evaluate((audio, duration) => {
    Object.defineProperty(audio, "duration", { configurable: true, value: duration });
    Object.defineProperty(audio, "currentTime", { configurable: true, value: duration });
    Object.defineProperty(audio, "played", { configurable: true, value: { length: 1, start: () => 0, end: () => duration } });
    audio.dispatchEvent(new Event("canplay", { bubbles: true }));
    audio.dispatchEvent(new Event("loadedmetadata", { bubbles: true }));
    audio.dispatchEvent(new Event("timeupdate", { bubbles: true }));
    audio.dispatchEvent(new Event("ended", { bubbles: true }));
  }, seconds);
}
