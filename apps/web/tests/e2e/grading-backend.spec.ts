import { expect, test } from "@playwright/test";

test("real canonical decimal grading survives a lost acknowledgement without duplicate mastery", async ({ page }, info) => {
  const api = process.env.GRADING_API_URL;
  test.skip(!api, "Run via the API TestBrowserCanonicalGrading disposable-database harness.");
  const url = new URL(api!);
  expect(["127.0.0.1", "localhost"]).toContain(url.hostname);
  const student = `grading-${info.project.name}`;
  const token = info.project.name === "desktop-chromium" ? process.env.GRADING_TOKEN_DESKTOP! : process.env.GRADING_TOKEN_MOBILE!;
  const attempts: string[] = [];
  await page.route("http://api.test/**", async route => {
    const request = route.request();
    const target = request.url().replace("http://api.test", api!);
    const response = await route.fetch({ url: target, headers: { ...request.headers(), "X-Pupil-Session": token } });
    if (request.url().includes("/v1/learning/mission")) {
      const mission = await response.json();
      expect(mission.questions[0]).not.toHaveProperty("expected_answer");
      expect(mission.questions[0]).not.toHaveProperty("explanation");
      expect(mission.questions[0].response_kind).toBe("number");
    }
    if (request.url().endsWith("/v1/learning/attempt")) {
      attempts.push(request.postData()!);
      expect(response.status()).toBe(200);
      expect((await response.json()).correct).toBe(true);
      // The first write committed, but its acknowledgement never reaches the UI.
      if (attempts.length === 1) return route.abort("failed");
    }
    await route.fulfill({ response });
  });
  await page.goto(`/play/mission?studentId=${student}&activityId=grading-browser-activity&mode=practice`);
  await expect(page.getByRole("region", { name: "Mission question" })).toBeVisible();
  await page.getByRole("button", { name: "Keyboard answer", exact: true }).click();
  await page.getByLabel("Keyboard answer", { exact: true }).fill("1.25");
  await page.getByRole("button", { name: "Submit answer", exact: true }).click();
  await expect(page.getByRole("button", { name: "Retry saving answer" })).toBeVisible();
  await expect(page.getByLabel("Keyboard answer", { exact: true })).toHaveValue("1.25");
  await page.getByRole("button", { name: "Retry saving answer" }).click();
  await expect(page.getByRole("button", { name: "See my discoveries" })).toBeVisible();
  expect(attempts).toHaveLength(2);
  expect(attempts[0]).toBe(attempts[1]);
  expect(JSON.parse(attempts[0]).response).toEqual({ kind: "number", value: 1.25 });
  await page.screenshot({ path: info.outputPath("canonical-decimal-saved.png"), animations: "disabled" });
});
