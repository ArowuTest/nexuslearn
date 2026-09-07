import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { chromium } from "@playwright/test";
import { renderAudioAuditReport } from "./audio-audit-report.mjs";

test("listening comparison plays real MP3, resets speed, paginates and stops obsolete audio", async () => {
  const manifest = JSON.parse(fs.readFileSync(new URL("../../../packages/content/audio/narration-manifest.json", import.meta.url)));
  const source = manifest.items[0];
  const bytes = fs.readFileSync(new URL("../public" + source.file, import.meta.url));
  const items = Array.from({ length: 30 }, (_, i) => ({ ...source, id: `sample-${i}`, year: i < 26 ? 1 : 2, pace: { wpm: 200, status: "pace_review_fast" }, flags: ["pace_review_fast"] }));
  items[0].text = "</script><script>window.injection=true</script>";
  const html = renderAudioAuditReport({ total_files: items.length, generated_at: "test", inventory_issues: [], items });
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.route("**/*", route => {
      const url = new URL(route.request().url());
      if (url.hostname !== "audio-audit.test") return route.abort();
      if (url.pathname.endsWith(".mp3")) return route.fulfill({ contentType: "audio/mpeg", body: bytes });
      return route.fulfill({ contentType: "text/html", body: html });
    });
    await page.goto("http://audio-audit.test/packages/content/generated/coverage/audit.html");
    assert.equal(await page.locator("#count").textContent(), "30 matching recordings");
    assert.equal(await page.locator("#rows article").count(), 25);
    await page.getByRole("button", { name: "Listen to sample-0", exact: true }).click();
    assert.equal(await page.locator("#script").textContent(), items[0].text);
    assert.equal(await page.evaluate(() => window.injection), undefined);
    await page.waitForFunction(() => document.getElementById("player").readyState >= 2);
    assert.ok(await page.locator("#player").evaluate(audio => audio.duration > 0));
    await page.locator("#player").evaluate(audio => audio.play());
    assert.equal(await page.locator("#player").evaluate(audio => audio.paused), false);
    await page.getByRole("button", { name: "Slower comparison 0.9×" }).click();
    assert.equal(await page.locator("#player").evaluate(audio => audio.playbackRate), 0.9);
    assert.match(await page.locator("#rate").textContent(), /Production file is unchanged/);
    await page.getByRole("button", { name: "Original 1×" }).click();
    assert.equal(await page.locator("#player").evaluate(audio => audio.playbackRate), 1);
    await page.locator("#player").evaluate(audio => audio.play());
    await page.getByRole("button", { name: "Next", exact: true }).click();
    assert.equal(await page.locator("#player").evaluate(audio => audio.paused && !audio.getAttribute("src")), true);
    assert.equal(await page.locator("#rows article").count(), 5);
    await page.getByLabel("Year", { exact: true }).selectOption("2");
    assert.equal(await page.locator("#count").textContent(), "4 matching recordings");
    await page.getByLabel("Search pack or script").fill("not-a-script");
    assert.equal(await page.locator("#count").textContent(), "0 matching recordings");
    assert.equal(await page.locator("#next").isDisabled(), true);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test("failed audits open the integrity lane and show faults independent of pace", async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.setContent(renderAudioAuditReport({ total_files: 2, inventory_issues: [{ code: "missing_file", id: "missing-clip" }], items: [
      { id: "silent-clip", year: 1, flags: ["silent_audio"], pace: { status: "within_screening_range_not_approval" } },
      { id: "wrong-hash", year: 2, flags: ["audio_hash_mismatch"], pace: { status: "short_script_listen" } },
    ] }));
    assert.equal(await page.locator("#lane").inputValue(), "integrity");
    assert.match(await page.locator("#integrity-summary").textContent(), /2 recordings with integrity faults/);
    assert.match(await page.locator("#integrity-summary").textContent(), /missing-clip/);
    assert.match(await page.locator("#rows").textContent(), /silent_audio/);
    assert.match(await page.locator("#rows").textContent(), /audio_hash_mismatch/);
  } finally { await browser.close(); }
});
