import { expect, test } from "@playwright/test";

test("anonymous users cannot download authoring reports but can resolve learner narration", async ({ request }) => {
  for (const url of [
    "/content/pilot-review-evidence-template.json",
    "/content/flagship-review.json",
    "/content/listening-qa.html",
    "/content/narration-review.html",
    "/private/content/pilot-review-evidence-template.json",
  ]) {
    expect((await request.get(url)).status(), url).toBe(404);
  }
  const audio = await request.get("/content/narration-manifest.json");
  expect(audio.status()).toBe(200);
  const manifest = await audio.json();
  expect(manifest.items.length).toBeGreaterThan(0);
  expect((await request.get(manifest.items[0].file)).status()).toBe(200);
});
