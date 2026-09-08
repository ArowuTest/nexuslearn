import { expect, test } from "@playwright/test";

test("real canonical decimal grading survives a lost acknowledgement without duplicate mastery", async ({ page }, info) => {
  const api = process.env.GRADING_API_URL;
  test.skip(!api, "Run via the API TestBrowserCanonicalGrading disposable-database harness.");
  const url = new URL(api!);
  expect(["127.0.0.1", "localhost"]).toContain(url.hostname);
  const student = `grading-${info.project.name}`;
  const token = info.project.name === "desktop-chromium" ? process.env.GRADING_TOKEN_DESKTOP! : process.env.GRADING_TOKEN_MOBILE!;
  await page.addInitScript(({ student, token }) => {
    sessionStorage.setItem("nexuslearn_pupil_id", student);
    sessionStorage.setItem("nexuslearn_pupil_session", token);
    sessionStorage.setItem("nexuslearn_pupil_session_expires", new Date(Date.now() + 3_600_000).toISOString());
  }, { student, token });
  const legacy = { student_id: student, objective_id: "grading-browser-objective", question_id: "grading-browser-question", given: 1, expected: 1 };
  const retired = await page.request.post(`${api}/v1/learning/attempt`, {
    headers: { "X-Pupil-Session": token }, data: legacy,
  });
  expect(retired.status()).toBe(409);
  expect((await retired.json()).code).toBe("question_changed");
  const attempts: string[] = [];
  let checkedTypedRequirement = false;
  await page.route("http://api.test/**", async route => {
    const request = route.request();
    const target = request.url().replace("http://api.test", api!);
    const response = await route.fetch({ url: target, headers: { ...request.headers(), "X-Pupil-Session": token } });
    if (request.url().includes("/v1/learning/mission")) {
      const mission = await response.json();
      expect(mission.questions[0]).not.toHaveProperty("expected_answer");
      expect(mission.questions[0]).not.toHaveProperty("explanation");
      expect(mission.questions[0].response_kind).toBe("number");
      if (!checkedTypedRequirement) {
        const missingResponse = await page.request.post(`${api}/v1/learning/attempt`, {
          headers: { "X-Pupil-Session": token },
          data: { ...legacy, question_version: mission.questions[0].question_version },
        });
        expect(missingResponse.status()).toBe(422);
        expect((await missingResponse.json()).code).toBe("answer_not_marked");
        checkedTypedRequirement = true;
      }
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
  expect(checkedTypedRequirement).toBe(true);
  expect(attempts[0]).toBe(attempts[1]);
  expect(JSON.parse(attempts[0]).response).toEqual({ kind: "number", value: 1.25 });
  await page.screenshot({ path: info.outputPath("canonical-decimal-saved.png"), animations: "disabled" });
  // Complete the real mission, then read newly persisted world/progress data
  // through the new pupil route. No learner responses are mocked here.
  await page.getByRole("button", { name: "See my discoveries" }).click();
  await page.getByRole("link", { name: "Back to my route" }).click();
  await expect(page.getByRole("heading", { name: "Ready, QA pupil?" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Your world growth" })).toContainText("1 discovery saved");
  await expect(page.getByRole("region", { name: "Mathematics progress" })).toContainText("Year 3: 0 ideas secure for now · 1 explored");
  // Follow the saved pupil attempt into the real authenticated adult UI. This
  // token belongs only to the disposable schema created by the Go harness.
  await page.evaluate((adminToken) => {
    sessionStorage.setItem("nexuslearn_account_session", adminToken);
    sessionStorage.setItem("nexuslearn_account_role", "platform_admin");
    sessionStorage.setItem("nexuslearn_account_session_expires", new Date(Date.now() + 3_600_000).toISOString());
  }, process.env.GRADING_ADMIN_TOKEN!);
  await page.goto("/admin?section=Progress");
  await page.getByLabel("Learner external ref").fill(student);
  await page.getByRole("button", { name: "Load progress", exact: true }).click();
  const evidence = page.getByRole("region", { name: "Recent learning evidence" });
  await expect(evidence.locator("details")).toHaveCount(1);
  await evidence.locator("summary").click();
  await expect(evidence.getByText("1.25", { exact: true })).toBeVisible();
  await expect(evidence.getByText("number: 1.25", { exact: true })).toBeVisible();
  await expect(evidence).toContainText("canonical-policy-v4");
  await expect(evidence).toContainText("What is 1 + 0.25?");
  await expect(evidence).toContainText(JSON.parse(attempts[0]).question_version);
  await expect(evidence).toContainText("+6 points");
  await page.screenshot({ path: info.outputPath("canonical-adult-evidence.png"), animations: "disabled" });
});

test("real English repair guidance reaches the pupil and survives a repeated acknowledgement", async ({ page }, info) => {
  const api = process.env.GRADING_API_URL;
  test.skip(!api, "Run via the API TestBrowserCanonicalGrading disposable-database harness.");
  expect(["127.0.0.1", "localhost"]).toContain(new URL(api!).hostname);
  const student = `grading-${info.project.name}`;
  const token = info.project.name === "desktop-chromium" ? process.env.GRADING_TOKEN_DESKTOP! : process.env.GRADING_TOKEN_MOBILE!;
  let saved: unknown;
  let payload = "";
  await page.route("http://api.test/**", async route => {
    const request = route.request();
    const response = await route.fetch({ url: request.url().replace("http://api.test", api!), headers: { ...request.headers(), "X-Pupil-Session": token } });
    if (request.url().endsWith("/v1/learning/attempt")) {
      expect(response.status()).toBe(200);
      saved = await response.json();
      payload = request.postData()!;
    }
    await route.fulfill({ response });
  });
  await page.goto(`/play/mission?studentId=${student}&activityId=repair-browser-activity&mode=practice`);
  await page.getByRole("button", { name: "Keyboard answer", exact: true }).click();
  await page.getByLabel("Keyboard answer", { exact: true }).fill("dog");
  await page.getByRole("button", { name: "Submit answer", exact: true }).click();
  await expect(page.getByTestId("mission-reward-moment")).toBeVisible();
  await expect(page.getByTestId("mission-reward-moment")).toContainText("Not yet. Check the sounds one at a time, then blend them together.");
  await expect(page.getByRole("button", { name: "See my discoveries" })).toHaveCount(0);
  expect(saved).toMatchObject({ correct: false, mastery_gain: 0 });
  const replay = await page.request.post(`${api}/v1/learning/attempt`, { headers: { "X-Pupil-Session": token, "Content-Type": "application/json" }, data: payload });
  expect(replay.status()).toBe(200);
  expect(await replay.json()).toEqual(saved);
  await page.screenshot({ path: info.outputPath("canonical-english-repair.png"), animations: "disabled" });
});

test("real authored reading alternative is accepted without exposing private marking policy", async ({ page }, info) => {
  const api = process.env.GRADING_API_URL;
  test.skip(!api, "Run via the API TestBrowserCanonicalGrading disposable-database harness.");
  expect(["127.0.0.1", "localhost"]).toContain(new URL(api!).hostname);
  const student = `grading-${info.project.name}`;
  const token = info.project.name === "desktop-chromium" ? process.env.GRADING_TOKEN_DESKTOP! : process.env.GRADING_TOKEN_MOBILE!;
  let checkedProjection = false;
  let saved: unknown;
  await page.route("http://api.test/**", async route => {
    const request = route.request();
    const response = await route.fetch({ url: request.url().replace("http://api.test", api!), headers: { ...request.headers(), "X-Pupil-Session": token } });
    if (request.url().includes("/v1/learning/mission")) {
      const mission = await response.json();
      const question = mission.questions.find((item: { id: string }) => item.id === "policy-browser-question");
      expect(question.response_kind).toBe("text");
      for (const key of ["expected_answer", "marking_policy", "accepted_values"]) {
        expect(JSON.stringify(question)).not.toContain(key);
      }
      checkedProjection = true;
    }
    if (request.url().endsWith("/v1/learning/attempt")) {
      expect(response.status()).toBe(200);
      saved = await response.json();
    }
    await route.fulfill({ response });
  });
  await page.goto(`/play/mission?studentId=${student}&activityId=policy-browser-activity&mode=practice`);
  await page.getByRole("button", { name: "Keyboard answer", exact: true }).click();
  await page.getByLabel("Keyboard answer", { exact: true }).fill("stopped");
  await page.getByRole("button", { name: "Submit answer", exact: true }).click();
  await expect(page.getByRole("button", { name: "See my discoveries" })).toBeVisible();
  expect(checkedProjection).toBe(true);
  expect(saved).toMatchObject({ correct: true });
  await page.screenshot({ path: info.outputPath("canonical-reading-alternative.png"), animations: "disabled" });
});
