import { expect, test, type Page, type Route } from "@playwright/test";
import { responseSettled } from "./response-settled";

const pupils = [
  { external_ref: "child-a", display_name: "Learner A", year_group: 2 },
  { external_ref: "child-b", display_name: "Learner B", year_group: 3 },
];
const session = { token: "school-lifecycle-fixture", role: "school_admin", expires_at: "2099-01-01T00:00:00Z" };
// Saved-profile fixtures must contain the complete backend contract. Missing
// fields are deliberately rejected rather than replaced with writable defaults.
const profileB = {
  student_external_ref: "child-b", version: 17, declared_support_needs: [], learning_approaches: [],
  celebration_intensity: "quiet", audio_support: true, reading_support: true,
  session_length: "short", sensory_load: "low", attention_support: "chunked",
  communication_support: "audio_visual", processing_support: "extra_time",
  confidence_support: "gentle", companion_style: "calm", reward_style: "story",
  notes: "Private support for B", interests: ["B interest"],
};
const profileA = { ...profileB, student_external_ref: "child-a", notes: "Private support for A", interests: ["A interest"], learning_approaches: ["reduced_motion"] };

async function schoolFixture(page: Page) {
  const writes: Record<string, unknown>[] = [];
  await page.route("http://api.test/**", async route => {
    const path = new URL(route.request().url()).pathname;
    let body: unknown = {};
    if (path === "/v1/auth/school-login") body = { session };
    else if (path === "/v1/school/config") body = {
      school: { urn: "school-fixture", name: "Local test school", status: "active" },
      current_user: { login_id: "teacher", role: "school_admin", school_urn: "school-fixture" },
      classes: [{ id: "11111111-1111-1111-1111-111111111111", name: "Oak", year_group: 2, students: pupils }],
      groups: [], student_credentials: [],
    };
    else if (path.endsWith("/engagement")) {
      if (route.request().method() === "PUT") {
        const submitted = route.request().postDataJSON();
        writes.push(submitted);
        const version = submitted.version + 6;
        body = { ...submitted, version, save_result: { applied_version: version, changed: true, replayed: false } };
      } else body = path.includes("/child-a/") ? profileA : profileB;
    }
    await route.fulfill({ json: body });
  });
  await page.goto("/school-admin");
  await page.getByLabel("School URN", { exact: true }).fill("school-fixture");
  await page.getByLabel("Login ID", { exact: true }).fill("teacher");
  await page.getByLabel("Temporary password", { exact: true }).fill("test-only-password");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("navigation", { name: "School workspace sections" })).toBeVisible();
  return writes;
}

for (const scenario of [
  { method: "GET", target: "child-b" },
  { method: "GET", target: "child-a" },
  { method: "PUT", target: "child-b" },
]) {
  test(`school ignores late ${scenario.method} support for A after selection changes to ${scenario.target}`, async ({ page }) => {
    const writes = await schoolFixture(page);
    const learner = page.getByRole("combobox", { name: "Selected school learner", exact: true });
    await learner.selectOption("child-a");
    if (scenario.method === "PUT") {
      await page.getByRole("button", { name: "Load profile", exact: true }).click();
      await expect(page.getByRole("textbox", { name: "Operational notes", exact: true })).toHaveValue(profileA.notes);
    }
    let release!: () => void, arrived!: () => void, settled!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    const seen = new Promise<void>(resolve => { arrived = resolve; });
    const finished = new Promise<void>(resolve => { settled = resolve; });
    const heldPath = "http://api.test/v1/school/students/child-a/engagement";
    const holdProfile = async (route: Route) => {
      if (route.request().method() !== scenario.method) { await route.fallback(); return; }
      arrived();
      await gate;
      try { await route.fulfill({ json: scenario.method === "GET" ? profileA : { ...profileA, version: 23, save_result: { applied_version: 23, changed: true, replayed: false } } }); }
      catch (error) { if (route.request().failure()?.errorText !== "net::ERR_ABORTED") throw error; }
      finally { settled(); }
    };
    await page.route(heldPath, holdProfile);
    try {
      await page.getByRole("button", { name: scenario.method === "PUT" ? "Save support profile" : "Load profile", exact: true }).click();
      await seen;
      const cancelled = page.waitForEvent("requestfailed", { predicate: request => request.url().endsWith("/child-a/engagement") && request.method() === scenario.method });
      await learner.selectOption("child-b");
      expect((await cancelled).failure()?.errorText).toBe("net::ERR_ABORTED");
      if (scenario.target === "child-a") await learner.selectOption("child-a");
      release(); await finished;
      await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
      await page.unroute(heldPath, holdProfile);
      const notes = page.getByRole("textbox", { name: "Operational notes", exact: true });
      const save = page.getByRole("button", { name: "Save support profile", exact: true });
      await expect(notes).toHaveValue("");
      await expect(notes).toBeDisabled();
      await expect(page.getByLabel("Reduced Motion", { exact: true })).not.toBeChecked();
      await expect(save).toBeDisabled();
      expect(writes).toHaveLength(0);

      // Returning to A is still a fresh selection: verify its saved profile
      // again before any new write, just as when changing to another pupil.
      const current = scenario.target === "child-a" ? profileA : profileB;
      await page.getByRole("button", { name: "Load profile", exact: true }).click();
      await expect(notes).toHaveValue(current.notes);
      await expect(notes).toBeEnabled();
      await notes.fill(`${scenario.target} verified draft`);
      const saved = page.waitForResponse(r => r.url().endsWith(`/${scenario.target}/engagement`) && r.request().method() === "PUT");
      await save.click();
      await responseSettled(page, saved);
      expect(writes).toHaveLength(1);
      expect(writes[0]).toMatchObject({ ...current, notes: `${scenario.target} verified draft` });
    } finally { release(); }
  });
}

function pupilResult(ref: string) {
  return { student: pupils.find(item => item.external_ref === ref), session: { token: `fixture-${ref}`, expires_at: "2099-01-01T00:00:00Z" } };
}

for (const change of ["pupil", "account", "sign-out"] as const) {
  test(`support conflict comparison cancellation clears draft, comparison and retry key on ${change} change`, async ({ page }) => {
    await schoolFixture(page);
    const learner = page.getByRole("combobox", { name: "Selected school learner", exact: true });
    await learner.selectOption("child-a");
    await page.getByRole("button", { name: "Load profile", exact: true }).click();
    const notes = page.getByRole("textbox", { name: "Operational notes", exact: true });
    await expect(notes).toHaveValue(profileA.notes);
    await notes.fill("Private conflicting draft A");
    let release!: () => void, arrived!: () => void, settled!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    const seen = new Promise<void>(resolve => { arrived = resolve; });
    const finished = new Promise<void>(resolve => { settled = resolve; });
    const path = "http://api.test/v1/school/students/child-a/engagement";
    const keys: string[] = [];
    const held = async (route: Route) => {
      if (route.request().method() === "PUT") {
        keys.push(route.request().headers()["idempotency-key"]);
        return route.fulfill({ status: 409, json: { code: "support_profile_conflict", error: "Changed", previously_saved: false, current_profile: { ...profileA, version: 29, notes: "Private comparison A" } } });
      }
      arrived(); await gate;
      try { await route.fulfill({ json: { ...profileA, version: 31, notes: "Late private comparison A" } }); }
      catch (error) { if (route.request().failure()?.errorText !== "net::ERR_ABORTED") throw error; }
      finally { settled(); }
    };
    await page.route(path, held);
    try {
      await page.getByRole("button", { name: "Save support profile", exact: true }).click();
      const review = page.getByRole("region", { name: "Review changed support settings" });
      await expect(review).toContainText("Private comparison A");
      await page.getByRole("button", { name: "Refresh saved settings for comparison", exact: true }).click();
      await seen;
      const cancelled = page.waitForEvent("requestfailed", { predicate: request => request.method() === "GET" && request.url() === path });
      if (change === "pupil") await learner.selectOption("child-b");
      else if (change === "sign-out") await page.getByRole("button", { name: "Sign out", exact: true }).click();
      else await page.evaluate(() => {
        sessionStorage.setItem("nexuslearn_account_session", "replacement-school-owner");
        window.dispatchEvent(new Event("nexuslearn-account-session-changed"));
      });
      expect((await cancelled).failure()?.errorText).toBe("net::ERR_ABORTED");
      release(); await finished;
      await page.unroute(path, held);
      await expect(review).toHaveCount(0);
      await expect(page.getByText("Private comparison A", { exact: true })).toHaveCount(0);
      await expect(page.getByText("Late private comparison A", { exact: true })).toHaveCount(0);
      if (change !== "pupil") {
        await expect(notes).toHaveCount(0);
        await page.getByLabel("School URN", { exact: true }).fill("school-fixture");
        await page.getByLabel("Login ID", { exact: true }).fill("teacher");
        await page.getByLabel("Temporary password", { exact: true }).fill("test-only-password");
        await page.getByRole("button", { name: "Sign in", exact: true }).click();
      }
      await learner.selectOption("child-a");
      await expect(notes).toHaveValue("");
      await expect(page.getByRole("button", { name: "Save support profile", exact: true })).toBeDisabled();
      await page.getByRole("button", { name: "Load profile", exact: true }).click();
      await expect(notes).toHaveValue(profileA.notes);
      await notes.fill("Private conflicting draft A");
      const saving = page.waitForRequest(request => request.url() === path && request.method() === "PUT");
      await page.getByRole("button", { name: "Save support profile", exact: true }).click();
      const newSave = await saving;
      expect(newSave.headers()["idempotency-key"]).not.toBe(keys[0]);
      expect(newSave.postDataJSON().version).toBe(17);
      await expect(page.getByRole("status")).toHaveText("Pupil support profile saved.");
      const storage = await page.evaluate(() => JSON.stringify({ local: { ...localStorage }, session: { ...sessionStorage } }));
      expect(storage).not.toContain("Private conflicting");
      expect(storage).not.toContain("Private comparison");
    } finally { release(); }
  });
}
async function pupilFixture(page: Page) {
  await page.route("http://api.test/v1/auth/pupil-login", route => route.fulfill({ json: pupilResult(route.request().postDataJSON().student_external_ref) }));
  await page.goto("/login?pupil=child-a&code=AAAA");
}
async function loggedInA(page: Page) {
  await pupilFixture(page);
  await page.getByRole("button", { name: "Star", exact: true }).click();
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await expect(page.getByRole("link", { name: "See my route", exact: true })).toBeVisible();
  expect(await page.evaluate(() => sessionStorage.getItem("nexuslearn_pupil_id"))).toBe("child-a");
}

for (const field of ["id", "code", "picture", "clear"]) {
  test(`changing a pupil card's ${field} invalidates the previous child session`, async ({ page }) => {
    await loggedInA(page);
    if (field === "id") await page.getByLabel("Pupil ID", { exact: true }).fill("child-b");
    else if (field === "code") await page.getByLabel("Login code", { exact: true }).fill("BBBB");
    else await page.getByRole("button", { name: field === "clear" ? "Clear" : "Book", exact: true }).click();
    await expect(page.getByRole("link", { name: "See my route", exact: true })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Log in", exact: true })).toBeEnabled();
    expect(await page.evaluate(() => sessionStorage.getItem("nexuslearn_pupil_id"))).toBeNull();
  });
}

test("an old pupil login response cannot replace a more recent card login", async ({ page }) => {
  await pupilFixture(page);
  let release!: () => void, arrived!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  const seen = new Promise<void>(resolve => { arrived = resolve; });
  await page.route("http://api.test/v1/auth/pupil-login", async route => {
    const ref = route.request().postDataJSON().student_external_ref;
    if (ref === "child-a") { arrived(); await gate; }
    await route.fulfill({ json: pupilResult(ref) });
  });
  const oldResponse = page.waitForResponse(r => r.url().endsWith("/pupil-login") && r.request().postDataJSON().student_external_ref === "child-a");
  try {
    await page.getByRole("button", { name: "Log in", exact: true }).click();
    await seen;
    await page.getByLabel("Pupil ID", { exact: true }).fill("child-b");
    await page.getByLabel("Login code", { exact: true }).fill("BBBB");
    await expect(page.getByRole("button", { name: "Log in", exact: true })).toBeEnabled();
    await page.getByRole("button", { name: "Log in", exact: true }).click();
    await expect(page.getByText("Welcome Learner B. Your learning route is ready.", { exact: true })).toBeVisible();
    release();
    await responseSettled(page, oldResponse);
    expect(await page.evaluate(() => sessionStorage.getItem("nexuslearn_pupil_id"))).toBe("child-b");
    await expect(page.getByText("Welcome Learner B. Your learning route is ready.", { exact: true })).toBeVisible();
  } finally { release(); }
});

test("leaving pupil login invalidates a pending authentication completion", async ({ page }) => {
  await pupilFixture(page);
  let release!: () => void, arrived!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  const seen = new Promise<void>(resolve => { arrived = resolve; });
  await page.route("http://api.test/v1/auth/pupil-login", async route => {
    arrived(); await gate; await route.fulfill({ json: pupilResult("child-a") });
  });
  const response = page.waitForResponse(r => r.url().endsWith("/pupil-login"));
  try {
    await page.getByRole("button", { name: "Log in", exact: true }).click();
    await seen;
    await page.getByRole("link", { name: "Play worlds", exact: true }).click();
    await expect(page).toHaveURL(/\/play$/);
    release();
    await responseSettled(page, response);
    expect(await page.evaluate(() => sessionStorage.getItem("nexuslearn_pupil_id"))).toBeNull();
  } finally { release(); }
});

test("a new QR card URL resets the visible identity and old session", async ({ page }) => {
  await loggedInA(page);
  await page.evaluate(() => history.pushState(null, "", "/login?pupil=child-b&code=BBBB"));
  await expect(page.getByLabel("Pupil ID", { exact: true })).toHaveValue("child-b");
  await expect(page.getByLabel("Login code", { exact: true })).toHaveValue("BBBB");
  await expect(page.getByRole("link", { name: "See my route", exact: true })).toHaveCount(0);
  expect(await page.evaluate(() => sessionStorage.getItem("nexuslearn_pupil_id"))).toBeNull();
});
