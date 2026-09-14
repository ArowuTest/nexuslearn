import { expect, test, type Page } from "@playwright/test";

const pupil = { external_ref: "ava-y3", display_name: "Ava", year_group: 3 };
const otherPupil = { external_ref: "ben-y5", display_name: "Ben", year_group: 5 };
const savedProfile = {
  student_external_ref: pupil.external_ref, declared_support_needs: [], learning_approaches: ["reduced_motion"],
  celebration_intensity: "quiet", audio_support: true, reading_support: true,
  session_length: "short", sensory_load: "low", attention_support: "chunked", communication_support: "audio_visual",
  processing_support: "extra_time", confidence_support: "gentle", companion_style: "calm", reward_style: "story",
  interests: ["dinosaurs"], notes: "Preserve Ava's existing access settings.",
};

async function settleUI(page: Page) {
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
}

async function holdSupportSave(page: Page) {
  let release!: () => void;
  let settled!: () => void;
  const held = new Promise<void>(resolve => { release = resolve; });
  const finished = new Promise<void>(resolve => { settled = resolve; });
  const bodies: Record<string, unknown>[] = [];
  await page.route("http://api.test/v1/school/students/ava-y3/engagement", async route => {
    if (route.request().method() !== "PUT") return route.fallback();
    const body = route.request().postDataJSON();
    bodies.push(body);
    await held;
    try { await route.fulfill({ json: body }); }
    catch (error) { if (route.request().failure()?.errorText !== "net::ERR_ABORTED") throw error; }
    finally { settled(); }
  });
  return { release, finished, bodies };
}

async function school(page: Page) {
  await page.route("http://api.test/**", route => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith("school-login")) return route.fulfill({ json: { session: { token: "support-fixture", role: "school_admin", expires_at: "2099-01-01T00:00:00Z" } } });
    if (url.pathname === "/v1/school/config") return route.fulfill({ json: {
      school: { urn: "support-school", name: "Support school" }, current_user: { login_id: "teacher", role: "school_admin" },
      classes: [{ id: "oak", name: "Oak", year_group: 3, students: [pupil, otherPupil] }], groups: [],
    } });
    if (url.pathname.endsWith("/engagement")) return route.fulfill({ json: savedProfile });
    return route.fulfill({ json: {} });
  });
  await page.goto("/school-admin");
  await page.getByLabel("School URN", { exact: true }).fill("support-school");
  await page.getByLabel("Login ID", { exact: true }).fill("teacher");
  await page.getByLabel("Temporary password", { exact: true }).fill("local-disposable-password");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.getByLabel("Selected school learner").selectOption(pupil.external_ref);
}

test("a school must load saved pupil support before editing or replacing it", async ({ page }) => {
  await school(page);
  await expect(page.getByRole("button", { name: "Save support profile", exact: true })).toBeDisabled();
  await expect(page.getByRole("textbox", { name: "Operational notes", exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "Load profile", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "Operational notes", exact: true })).toHaveValue(savedProfile.notes);
  await expect(page.getByRole("button", { name: "Save support profile", exact: true })).toBeEnabled();
  await expect(page.getByLabel("Audio support", { exact: true })).toBeChecked();
});

for (const [name, invalid] of [
  ["foreign pupil", { ...savedProfile, student_external_ref: otherPupil.external_ref, notes: "Other pupil private note." }],
  ["incomplete", { student_external_ref: pupil.external_ref }],
  ["unsupported", { ...savedProfile, session_length: "unbounded" }],
] as const) {
  test(`${name} support responses cannot become editable settings`, async ({ page }) => {
    await school(page);
    await page.route("http://api.test/v1/school/students/ava-y3/engagement", route => route.fulfill({ json: invalid }));
    await page.getByRole("button", { name: "Load profile", exact: true }).click();
    await expect(page.getByRole("status")).toContainText("could not be verified");
    await expect(page.getByRole("button", { name: "Save support profile", exact: true })).toBeDisabled();
    await expect(page.getByRole("textbox", { name: "Operational notes", exact: true })).toHaveValue("");
    await expect(page.getByRole("textbox", { name: "Operational notes", exact: true })).toBeDisabled();
    await expect(page.getByText("Other pupil private note.", { exact: true })).toHaveCount(0);
  });
}

test("failed support saves preserve the draft and retry the same pupil and settings", async ({ page }) => {
  await school(page);
  await page.getByRole("button", { name: "Load profile", exact: true }).click();
  const notes = page.getByRole("textbox", { name: "Operational notes", exact: true });
  await expect(notes).toHaveValue(savedProfile.notes);
  await notes.fill("Keep this support draft.");
  const bodies: Record<string, unknown>[] = [];
  await page.route("http://api.test/v1/school/students/ava-y3/engagement", route => {
    bodies.push(route.request().postDataJSON());
    return bodies.length === 1
      ? route.fulfill({ status: 503, json: { error: "Support save temporarily unavailable." } })
      : route.fulfill({ json: bodies[1] });
  });
  await page.getByRole("button", { name: "Save support profile", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText("Support save temporarily unavailable.");
  await expect(notes).toHaveValue("Keep this support draft.");
  await expect(notes).toBeEnabled();
  await page.getByRole("button", { name: "Save support profile", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText("Pupil support profile saved.");
  expect(bodies).toHaveLength(2);
  expect(bodies[1]).toEqual(bodies[0]);
  expect(bodies[1].student_external_ref).toBe(pupil.external_ref);
  expect(bodies[1].audio_support).toBe(true);
});

test("a failed profile reload cannot leave older settings editable", async ({ page }) => {
  await school(page);
  await page.getByRole("button", { name: "Load profile", exact: true }).click();
  const notes = page.getByRole("textbox", { name: "Operational notes", exact: true });
  await expect(notes).toHaveValue(savedProfile.notes);
  await page.route("http://api.test/v1/school/students/ava-y3/engagement", route => route.fulfill({ status: 503, json: { error: "Profile unavailable." } }));
  await page.getByRole("button", { name: "Load profile", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText("Profile unavailable.");
  await expect(notes).toHaveValue(savedProfile.notes);
  await expect(notes).toBeDisabled();
  await expect(page.getByRole("button", { name: "Save support profile", exact: true })).toBeDisabled();
  await page.unroute("http://api.test/v1/school/students/ava-y3/engagement");
  await page.getByRole("button", { name: "Load profile", exact: true }).click();
  await expect(notes).toBeEnabled();
});

test("changing pupils cancels a pending profile read and permits the new pupil's load", async ({ page }) => {
  await school(page);
  let release!: () => void;
  let settled!: () => void;
  const held = new Promise<void>(resolve => { release = resolve; });
  const finished = new Promise<void>(resolve => { settled = resolve; });
  let started = false;
  await page.route("http://api.test/v1/school/students/ava-y3/engagement", async route => {
    started = true; await held;
    try { await route.fulfill({ json: savedProfile }); }
    catch (error) { if (route.request().failure()?.errorText !== "net::ERR_ABORTED") throw error; }
    finally { settled(); }
  });
  await page.route("http://api.test/v1/school/students/ben-y5/engagement", route => route.fulfill({ json: { ...savedProfile, student_external_ref: otherPupil.external_ref, notes: "Ben's own profile." } }));
  try {
    await page.getByRole("button", { name: "Load profile", exact: true }).click();
    await expect.poll(() => started).toBe(true);
    const cancelled = page.waitForEvent("requestfailed", { predicate: request => request.url().endsWith("/ava-y3/engagement") });
    await page.getByLabel("Selected school learner").selectOption(otherPupil.external_ref);
    expect((await cancelled).failure()?.errorText).toBe("net::ERR_ABORTED");
    await page.getByRole("button", { name: "Load profile", exact: true }).click();
    const notes = page.getByRole("textbox", { name: "Operational notes", exact: true });
    await expect(notes).toHaveValue("Ben's own profile.");
    release(); await finished;
    await settleUI(page);
    await expect(notes).toHaveValue("Ben's own profile.");
    await expect(notes).toBeEnabled();
  } finally { release(); }
});

test("pending support saves keep submitted pacing, audio and notes immutable", async ({ page }) => {
  await school(page);
  await page.getByRole("button", { name: "Load profile", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "Operational notes", exact: true })).toHaveValue(savedProfile.notes);
  await page.getByRole("textbox", { name: "Operational notes", exact: true }).fill("Submitted support note.");
  const pending = await holdSupportSave(page);
  try {
    await page.getByRole("button", { name: "Save support profile", exact: true }).click();
    await expect.poll(() => pending.bodies.length).toBe(1);
    await expect(page.getByRole("textbox", { name: "Operational notes", exact: true })).toBeDisabled();
    await expect(page.getByRole("combobox", { name: "Session length", exact: true })).toBeDisabled();
    await expect(page.getByLabel("Audio support", { exact: true })).toBeDisabled();
    await expect(page.getByRole("button", { name: "Sign out", exact: true })).toBeEnabled();
    expect(pending.bodies[0]).toMatchObject({ notes: "Submitted support note.", session_length: "short", audio_support: true });
    pending.release(); await pending.finished;
    await expect(page.getByRole("status")).toHaveText("Pupil support profile saved.");
    await expect(page.getByRole("textbox", { name: "Operational notes", exact: true })).toHaveValue("Submitted support note.");
    await expect(page.getByRole("textbox", { name: "Operational notes", exact: true })).toBeEnabled();
    await expect(page.getByRole("combobox", { name: "Session length", exact: true })).toHaveValue("short");
    await expect(page.getByLabel("Audio support", { exact: true })).toBeChecked();
  } finally { pending.release(); }
});

for (const change of ["pupil", "account"] as const) {
  test(`changing the ${change} cancels a support save without restoring stale settings or success`, async ({ page }) => {
    await school(page);
    await page.getByRole("button", { name: "Load profile", exact: true }).click();
    const notes = page.getByRole("textbox", { name: "Operational notes", exact: true });
    await expect(notes).toHaveValue(savedProfile.notes);
    await notes.fill("Ava's submitted private note.");
    const pending = await holdSupportSave(page);
    await page.route("http://api.test/v1/school/students/ben-y5/engagement", route => route.fulfill({ json: {
      ...savedProfile, student_external_ref: otherPupil.external_ref, notes: "Ben's own profile.", audio_support: false, session_length: "standard",
    } }));
    try {
      await page.getByRole("button", { name: "Save support profile", exact: true }).click();
      await expect.poll(() => pending.bodies.length).toBe(1);
      const cancelled = page.waitForEvent("requestfailed", { predicate: request => request.method() === "PUT" && request.url().endsWith("/ava-y3/engagement") });
      if (change === "pupil") {
        await page.getByLabel("Selected school learner").selectOption(otherPupil.external_ref);
      } else {
        await page.evaluate(() => {
          sessionStorage.setItem("nexuslearn_account_session", "replacement-school-session");
          window.dispatchEvent(new Event("nexuslearn-account-session-changed"));
        });
      }
      expect((await cancelled).failure()?.errorText).toBe("net::ERR_ABORTED");
      if (change === "pupil") {
        await expect(notes).toHaveValue("");
        await expect(notes).toBeDisabled();
        await page.getByRole("button", { name: "Load profile", exact: true }).click();
        await expect(notes).toHaveValue("Ben's own profile.");
        await notes.fill("Ben's newer draft.");
      }
      pending.release(); await pending.finished; await settleUI(page);
      if (change === "pupil") {
        await expect(notes).toHaveValue("Ben's newer draft.");
        await expect(notes).toBeEnabled();
        await expect(page.getByLabel("Audio support", { exact: true })).not.toBeChecked();
        await expect(page.getByRole("combobox", { name: "Session length", exact: true })).toHaveValue("standard");
        await expect(page.getByRole("status")).toHaveText("Pupil support profile loaded.");
      } else {
        await expect(notes).toHaveCount(0);
        await expect(page.getByRole("status")).toContainText("session changed or expired");
        await expect(page.getByLabel("Temporary password", { exact: true })).toHaveValue("");
        await page.getByLabel("Temporary password", { exact: true }).fill("local-disposable-password");
        await expect(page.getByRole("button", { name: "Sign in", exact: true })).toBeEnabled();
      }
      await expect(page.getByRole("status")).not.toContainText("profile saved");
      expect(pending.bodies).toHaveLength(1);
    } finally { pending.release(); }
  });
}

for (const [name, invalid] of [
  ["foreign pupil", { ...savedProfile, student_external_ref: otherPupil.external_ref, notes: "Other pupil private note." }],
  ["incomplete", { student_external_ref: pupil.external_ref }],
] as const) {
  test(`${name} successful save responses cannot replace the draft or announce success`, async ({ page }) => {
    await school(page);
    await page.getByRole("button", { name: "Load profile", exact: true }).click();
    const notes = page.getByRole("textbox", { name: "Operational notes", exact: true });
    await expect(notes).toHaveValue(savedProfile.notes);
    await notes.fill("Keep my verified support draft.");
    await page.getByRole("combobox", { name: "Session length", exact: true }).selectOption("extended");
    await page.getByLabel("Audio support", { exact: true }).uncheck();
    const bodies: Record<string, unknown>[] = [];
    await page.route("http://api.test/v1/school/students/ava-y3/engagement", route => {
      const body = route.request().postDataJSON();
      bodies.push(body);
      return route.fulfill({ json: bodies.length === 1 ? invalid : body });
    });
    await page.getByRole("button", { name: "Save support profile", exact: true }).click();
    await expect(page.getByRole("status")).toContainText("could not be verified");
    await expect(notes).toHaveValue("Keep my verified support draft.");
    await expect(notes).toBeEnabled();
    await expect(page.getByRole("combobox", { name: "Session length", exact: true })).toHaveValue("extended");
    await expect(page.getByLabel("Audio support", { exact: true })).not.toBeChecked();
    await page.getByRole("button", { name: "Save support profile", exact: true }).click();
    await expect(page.getByRole("status")).toHaveText("Pupil support profile saved.");
    expect(bodies).toHaveLength(2);
    expect(bodies[1]).toEqual(bodies[0]);
  });
}
