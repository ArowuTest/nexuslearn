import { expect, test, type Page } from "@playwright/test";

const pupil = { external_ref: "ava-y3", display_name: "Ava", year_group: 3 };
const otherPupil = { external_ref: "ben-y5", display_name: "Ben", year_group: 5 };
const savedProfile = {
  student_external_ref: pupil.external_ref, version: 17, declared_support_needs: [], learning_approaches: ["reduced_motion"],
  celebration_intensity: "quiet", audio_support: true, reading_support: true,
  session_length: "short", sensory_load: "low", attention_support: "chunked", communication_support: "audio_visual",
  processing_support: "extra_time", confidence_support: "gentle", companion_style: "calm", reward_style: "story",
  interests: ["dinosaurs"], notes: "Preserve Ava's existing access settings.",
};

function acknowledged(body: Record<string, unknown>, replayed = false) {
  const version = Number(body.version) + 6;
  return { ...body, version, save_result: { applied_version: version, changed: true, replayed } };
}

const conflict = (version = 29, previously_saved = false) => ({
  code: "support_profile_conflict", error: "Settings changed elsewhere.", previously_saved,
  current_profile: { ...savedProfile, version, notes: "Latest saved note.", interests: ["trains"], session_length: "extended" },
});

async function settleUI(page: Page) {
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
}

test("conflicts retain every draft field, refresh only comparison, and require a separate save after keyboard review", async ({ page }) => {
  await school(page);
  await page.getByRole("button", { name: "Load profile", exact: true }).click();
  const notes = page.getByRole("textbox", { name: "Operational notes", exact: true });
  await expect(notes).toHaveValue(savedProfile.notes);
  await notes.fill("My retained draft");
  await page.getByLabel("Interests (comma separated)").fill("space,  dinosaurs");
  await page.getByLabel("Audio support", { exact: true }).uncheck();
  const writes: { body: Record<string, unknown>; key: string }[] = [];
  await page.route("http://api.test/v1/school/students/ava-y3/engagement", route => {
    if (route.request().method() === "GET") return route.fulfill({ json: { ...conflict(35).current_profile, notes: "Refreshed saved note." } });
    const body = route.request().postDataJSON();
    writes.push({ body, key: route.request().headers()["idempotency-key"] });
    return writes.length < 3 ? route.fulfill({ status: 409, json: conflict(writes.length === 1 ? 29 : 42) }) : route.fulfill({ json: acknowledged(body) });
  });
  const save = page.getByRole("button", { name: "Save support profile", exact: true });
  const review = page.getByRole("region", { name: "Review changed support settings" });
  await save.click();
  await expect(review).toBeVisible();
  await expect(review).toBeFocused();
  await expect(save).toBeDisabled();
  await expect(notes).toHaveValue("My retained draft");
  await expect(review).toContainText("Operational notes");
  await expect(review).toContainText("Latest saved note.");
  await expect(review).toContainText("space, dinosaurs");
  await expect(review).toContainText("Audio support");
  await page.getByRole("button", { name: "Refresh saved settings for comparison", exact: true }).click();
  await expect(review).toContainText("Refreshed saved note.");
  await expect(notes).toHaveValue("My retained draft");
  await expect(page.getByLabel("Interests (comma separated)")).toHaveValue("space,  dinosaurs");
  const rebase = page.getByRole("button", { name: "Review my draft against these settings", exact: true });
  await rebase.focus(); await page.keyboard.press("Enter");
  await expect(review).toHaveCount(0);
  await expect(save).toBeFocused();
  expect(writes).toHaveLength(1);
  await save.click();
  await expect(review).toBeVisible();
  expect(writes[1].body.version).toBe(35);
  expect(writes[1].key).not.toBe(writes[0].key);
  await expect(notes).toHaveValue("My retained draft");
  await rebase.click();
  expect(writes).toHaveLength(2);
  await save.click();
  await expect(page.getByRole("status")).toHaveText("Pupil support profile saved.");
  expect(writes[2].body).toMatchObject({ version: 42, notes: "My retained draft", interests: ["space", "dinosaurs"], audio_support: false });
  expect(writes[2].body.save_result).toBeUndefined();
  expect(writes[2].body.updated_at).toBeUndefined();
});

test("loading after a conflict review preserves the rebased draft until confirmed discard", async ({ page }) => {
  await school(page);
  await page.getByRole("button", { name: "Load profile", exact: true }).click();
  const notes = page.getByRole("textbox", { name: "Operational notes", exact: true });
  await expect(notes).toHaveValue(savedProfile.notes);
  await notes.fill("Do not discard this reviewed draft");
  await page.getByLabel("Interests (comma separated)").fill("space,  trains");
  let writes = 0;
  await page.route("http://api.test/v1/school/students/ava-y3/engagement", route => {
    if (route.request().method() === "GET") return route.fulfill({ json: conflict(35).current_profile });
    writes++; return route.fulfill({ status: 409, json: conflict() });
  });
  const save = page.getByRole("button", { name: "Save support profile", exact: true });
  const review = page.getByRole("region", { name: "Review changed support settings" });
  await save.click();
  await page.getByRole("button", { name: "Review my draft against these settings", exact: true }).click();
  await expect(review).toHaveCount(0);
  await page.getByRole("button", { name: "Load profile", exact: true }).click();
  await expect(review).toBeVisible();
  await expect(review).toContainText("Comparing saved version 35");
  await expect(notes).toHaveValue("Do not discard this reviewed draft");
  await expect(page.getByLabel("Interests (comma separated)")).toHaveValue("space,  trains");
  await expect(page.getByRole("status")).toContainText("Your draft is kept");
  await expect(save).toBeDisabled();
  await page.getByRole("button", { name: "Use saved settings", exact: true }).click();
  await expect(notes).toHaveValue("Do not discard this reviewed draft");
  await page.getByRole("button", { name: "Confirm use saved settings", exact: true }).click();
  await expect(notes).toHaveValue("Latest saved note.");
  expect(writes).toBe(1);
});

test("reloading an uncertain save retains the exact retry payload and key after same-version review", async ({ page }) => {
  await school(page);
  await page.getByRole("button", { name: "Load profile", exact: true }).click();
  const notes = page.getByRole("textbox", { name: "Operational notes", exact: true });
  await expect(notes).toHaveValue(savedProfile.notes);
  await notes.fill("Keep the uncertain attempt");
  const writes: { body: Record<string, unknown>; key: string }[] = [];
  await page.route("http://api.test/v1/school/students/ava-y3/engagement", route => {
    if (route.request().method() === "GET") return route.fulfill({ json: savedProfile });
    const body = route.request().postDataJSON();
    writes.push({ body, key: route.request().headers()["idempotency-key"] });
    return writes.length === 1 ? route.abort("failed") : route.fulfill({ json: acknowledged(body, true) });
  });
  const save = page.getByRole("button", { name: "Save support profile", exact: true });
  await save.click();
  await expect(notes).toBeEnabled();
  await page.getByRole("button", { name: "Load profile", exact: true }).click();
  await expect(page.getByRole("region", { name: "Review changed support settings" })).toBeVisible();
  await expect(notes).toHaveValue("Keep the uncertain attempt");
  await expect(save).toBeDisabled();
  await page.getByRole("button", { name: "Review my draft against these settings", exact: true }).click();
  expect(writes).toHaveLength(1);
  await save.click();
  await expect(page.getByRole("status")).toContainText("save confirmed");
  expect(writes).toHaveLength(2);
  expect(writes[1]).toEqual(writes[0]);
});

test("Use saved settings needs visible confirmation and never writes automatically", async ({ page }) => {
  await school(page);
  await page.getByRole("button", { name: "Load profile", exact: true }).click();
  const notes = page.getByRole("textbox", { name: "Operational notes", exact: true });
  await expect(notes).toHaveValue(savedProfile.notes);
  await notes.fill("Keep until confirmed");
  let writes = 0;
  await page.route("http://api.test/v1/school/students/ava-y3/engagement", route => {
    writes++; return route.fulfill({ status: 409, json: conflict() });
  });
  await page.getByRole("button", { name: "Save support profile", exact: true }).click();
  await page.getByRole("button", { name: "Use saved settings", exact: true }).click();
  const confirm = page.getByRole("button", { name: "Confirm use saved settings", exact: true });
  await expect(confirm).toBeVisible();
  await expect(confirm).toBeFocused();
  await expect(notes).toHaveValue("Keep until confirmed");
  await page.getByRole("button", { name: "Keep my draft", exact: true }).click();
  await expect(confirm).toHaveCount(0);
  await page.getByRole("button", { name: "Use saved settings", exact: true }).click();
  await confirm.press("Enter");
  await expect(notes).toHaveValue("Latest saved note.");
  await expect(page.getByLabel("Interests (comma separated)")).toHaveValue("trains");
  await expect(page.getByRole("region", { name: "Review changed support settings" })).toHaveCount(0);
  expect(writes).toBe(1);
});

for (const [name, body, status] of [
  ["foreign conflict", { ...conflict(), error: "FOREIGN PRIVATE", current_profile: { ...savedProfile, student_external_ref: "ben-y5", notes: "FOREIGN PRIVATE" } }, 409],
  ["malformed conflict", { ...conflict(), current_profile: { ...savedProfile, version: null } }, 409],
  ["key collision", { code: "idempotency_key_conflict", error: "FOREIGN PRIVATE", current_profile: conflict().current_profile }, 409],
  ["version required", { code: "support_version_required", error: "Refresh required" }, 428],
] as const) {
  test(`${name} keeps the draft and requires a safe comparison refresh`, async ({ page }) => {
    await school(page);
    await page.getByRole("button", { name: "Load profile", exact: true }).click();
    const notes = page.getByRole("textbox", { name: "Operational notes", exact: true });
    await expect(notes).toHaveValue(savedProfile.notes);
    await notes.fill("Retained local draft");
    await page.route("http://api.test/v1/school/students/ava-y3/engagement", route => route.request().method() === "PUT"
      ? route.fulfill({ status, json: body }) : route.fulfill({ json: conflict(39).current_profile }));
    await page.getByRole("button", { name: "Save support profile", exact: true }).click();
    const review = page.getByRole("region", { name: "Review changed support settings" });
    await expect(review).toBeVisible();
    await expect(notes).toHaveValue("Retained local draft");
    await expect(page.getByRole("button", { name: "Save support profile", exact: true })).toBeDisabled();
    await expect(page.getByText("FOREIGN PRIVATE")).toHaveCount(0);
    const rebase = page.getByRole("button", { name: "Review my draft against these settings", exact: true });
    await expect(rebase).toBeDisabled();
    await page.getByRole("button", { name: "Refresh saved settings for comparison", exact: true }).click();
    await expect(review).toContainText("Latest saved note.");
    await expect(notes).toHaveValue("Retained local draft");
    await rebase.click();
    await expect(notes).toBeEnabled();
    await expect(page.getByRole("button", { name: "Save support profile", exact: true })).toBeEnabled();
  });
}

test("a rejected retry key can recover after reviewing the same saved version", async ({ page }) => {
  await school(page);
  await page.getByRole("button", { name: "Load profile", exact: true }).click();
  const notes = page.getByRole("textbox", { name: "Operational notes", exact: true });
  await expect(notes).toHaveValue(savedProfile.notes);
  await notes.fill("Keep the rejected draft");
  const keys: string[] = [];
  await page.route("http://api.test/v1/school/students/ava-y3/engagement", route => {
    if (route.request().method() === "GET") return route.fulfill({ json: savedProfile });
    keys.push(route.request().headers()["idempotency-key"]);
    return keys.length === 1
      ? route.fulfill({ status: 409, json: { code: "idempotency_key_conflict", error: "Key rejected" } })
      : route.fulfill({ json: acknowledged(route.request().postDataJSON()) });
  });
  const save = page.getByRole("button", { name: "Save support profile", exact: true });
  await save.click();
  await page.getByRole("button", { name: "Refresh saved settings for comparison", exact: true }).click();
  await expect(page.getByRole("region", { name: "Review changed support settings" })).toContainText("Comparing saved version 17");
  await expect(notes).toHaveValue("Keep the rejected draft");
  await page.getByRole("button", { name: "Review my draft against these settings", exact: true }).click();
  await save.click();
  await expect(page.getByRole("status")).toHaveText("Pupil support profile saved.");
  expect(keys).toHaveLength(2);
  expect(keys[1]).not.toBe(keys[0]);
});

test("an uncertain save superseded elsewhere is not announced as current success", async ({ page }) => {
  await school(page);
  await page.getByRole("button", { name: "Load profile", exact: true }).click();
  const notes = page.getByRole("textbox", { name: "Operational notes", exact: true });
  await expect(notes).toHaveValue(savedProfile.notes);
  await notes.fill("Uncertain original draft");
  const keys: string[] = [];
  await page.route("http://api.test/v1/school/students/ava-y3/engagement", route => {
    keys.push(route.request().headers()["idempotency-key"]);
    return keys.length === 1 ? route.abort("failed") : route.fulfill({ status: 409, json: conflict(49, true) });
  });
  const save = page.getByRole("button", { name: "Save support profile", exact: true });
  await save.click();
  await expect(notes).toBeEnabled();
  await save.click();
  await expect(page.getByRole("status")).toContainText("earlier save succeeded");
  await expect(page.getByRole("region", { name: "Review changed support settings" })).toContainText("newer settings");
  await expect(notes).toHaveValue("Uncertain original draft");
  expect(keys[1]).toBe(keys[0]);
  await expect(save).toBeDisabled();
});

test("editing an uncertain payload creates a fresh logical retry key", async ({ page }) => {
  await school(page);
  await page.getByRole("button", { name: "Load profile", exact: true }).click();
  const notes = page.getByRole("textbox", { name: "Operational notes", exact: true });
  await expect(notes).toHaveValue(savedProfile.notes);
  const keys: string[] = [];
  await page.route("http://api.test/v1/school/students/ava-y3/engagement", route => {
    keys.push(route.request().headers()["idempotency-key"]);
    return route.fulfill({ status: 503, json: {} });
  });
  const save = page.getByRole("button", { name: "Save support profile", exact: true });
  await save.click(); await expect(notes).toBeEnabled();
  await notes.fill("Changed after uncertainty");
  await save.click(); await expect(notes).toBeEnabled();
  expect(keys).toHaveLength(2);
  expect(keys[1]).not.toBe(keys[0]);
});

test("mobile review wraps long private values without horizontal overflow", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await school(page);
  await page.getByRole("button", { name: "Load profile", exact: true }).click();
  const notes = page.getByRole("textbox", { name: "Operational notes", exact: true });
  await expect(notes).toHaveValue(savedProfile.notes);
  await notes.fill("longdraft".repeat(50));
  await page.route("http://api.test/v1/school/students/ava-y3/engagement", route => route.fulfill({ status: 409, json: conflict() }));
  await page.getByRole("button", { name: "Save support profile", exact: true }).click();
  const review = page.getByRole("region", { name: "Review changed support settings" });
  await expect(review).toBeVisible();
  expect(await review.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.getByRole("button", { name: "Review my draft against these settings", exact: true }).press("Enter");
  await expect(notes).toHaveValue("longdraft".repeat(50));
});

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
    try { await route.fulfill({ json: acknowledged(body) }); }
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
    if (url.pathname.endsWith("/engagement")) return route.fulfill({ json: route.request().method() === "PUT" ? acknowledged(route.request().postDataJSON()) : savedProfile });
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
  ["versionless", { ...savedProfile, version: undefined }],
  ["unsafe version", { ...savedProfile, version: Number.MAX_SAFE_INTEGER + 1 }],
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
  const keys: string[] = [];
  await page.route("http://api.test/v1/school/students/ava-y3/engagement", route => {
    bodies.push(route.request().postDataJSON());
    keys.push(route.request().headers()["idempotency-key"]);
    return bodies.length === 1
      ? route.fulfill({ status: 503, json: { error: "Support save temporarily unavailable." } })
      : route.fulfill({ json: acknowledged(bodies[1], true) });
  });
  await page.getByRole("button", { name: "Save support profile", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("draft is kept");
  await expect(notes).toHaveValue("Keep this support draft.");
  await expect(notes).toBeEnabled();
  await page.getByRole("button", { name: "Save support profile", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("save confirmed");
  expect(bodies).toHaveLength(2);
  expect(bodies[1]).toEqual(bodies[0]);
  expect(bodies[1].student_external_ref).toBe(pupil.external_ref);
  expect(bodies[1].audio_support).toBe(true);
  expect(bodies[1].version).toBe(17);
  expect(keys[0]).toMatch(/^[a-f0-9-]{36}$/);
  expect(keys[1]).toBe(keys[0]);
});

test("a failed profile reload cannot leave older settings editable", async ({ page }) => {
  await school(page);
  await page.getByRole("button", { name: "Load profile", exact: true }).click();
  const notes = page.getByRole("textbox", { name: "Operational notes", exact: true });
  await expect(notes).toHaveValue(savedProfile.notes);
  await page.route("http://api.test/v1/school/students/ava-y3/engagement", route => route.fulfill({ status: 503, json: { error: "Profile unavailable." } }));
  await page.getByRole("button", { name: "Load profile", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("could not be loaded");
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
  ["echoed without receipt", savedProfile],
  ["contradictory receipt", { ...savedProfile, save_result: { applied_version: 17, changed: true, replayed: false } }],
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
      return route.fulfill({ json: bodies.length === 1 ? invalid : acknowledged(body) });
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
