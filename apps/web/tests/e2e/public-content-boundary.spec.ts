import { expect, test } from "@playwright/test";

test("anonymous users cannot download authoring reports or unapproved narration", async ({ request, baseURL }) => {
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
  const file = manifest.items[0].file as string;
  expect((await request.get(file)).status(), "unapproved narration stays hidden").toBe(404);
  expect((await request.get(`/%61${file.slice(2)}`)).status(), "encoded audio prefix").toBe(404);
  expect((await request.get(file.replace("/audio/", "/audio%2F"))).status(), "encoded slash").toBe(404);
  expect((await request.get(file.replace("/audio/", "/Audio/"))).status(), "case variant").toBe(404);
  // A leading "//" is a protocol-relative URL, so pin it to this server.
  expect((await request.get(`${baseURL}/${file}`)).status(), "double slash").toBe(404);
  expect((await request.get(file.replace("/audio/", "/audio//"))).status(), "embedded double slash").toBe(404);
  const summary = await request.get("/review/safety-summary.json");
  expect(summary.status()).toBe(200);
  expect(await summary.text()).not.toContain("/audio/narration/");
});

test("the review page runs and lists packs", async ({ page }) => {
  const response = await page.goto("/review");
  expect(response?.status()).toBe(200);
  await expect(page.getByRole("heading", { name: "Review one pack" })).toBeVisible();
  await expect(page.locator("#pack option").first()).toBeAttached();
});
