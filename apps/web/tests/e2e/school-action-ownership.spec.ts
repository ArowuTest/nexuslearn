import { expect, test, type Page } from "@playwright/test";

const schoolOverview = {
  school: { urn: "setup-school", name: "Setup school" },
  current_user: { login_id: "teacher", role: "school_admin", school_urn: "setup-school" },
  classes: [{ id: "oak", name: "Oak", year_group: 3, student_count: 0 }], groups: [], students: [],
  directory: { version: 1, counts: { classes: 1, groups: 0, students: 0 } },
};

async function login(page: Page) {
  await page.getByLabel("School URN", { exact: true }).fill("setup-school");
  await page.getByLabel("Login ID", { exact: true }).fill("teacher");
  await page.getByLabel("Temporary password", { exact: true }).fill("disposable-fixture-password");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByText("Signed in as teacher / School admin", { exact: true })).toBeVisible();
}

async function setup(page: Page, signIn = true) {
  let sequence = 0;
  await page.route("http://api.test/**", route => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith("school-login")) return route.fulfill({ json: { session: { token: `setup-session-${++sequence}`, role: "school_admin", expires_at: "2099-01-01T00:00:00Z" } } });
    if (url.pathname === "/v1/school/config") return route.fulfill({ json: schoolOverview });
    return route.fulfill({ json: {} });
  });
  await page.goto("/school-admin");
  if (signIn) await login(page);
}

async function settleUI(page: Page) {
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
}

async function replaceSession(page: Page, role = "school_admin", token = "replacement-token") {
  await page.evaluate(({ role, token }) => {
    sessionStorage.setItem("nexuslearn_account_session", token);
    sessionStorage.setItem("nexuslearn_account_role", role);
    sessionStorage.setItem("nexuslearn_account_session_expires", "2099-01-01T00:00:00Z");
    window.dispatchEvent(new Event("nexuslearn-account-session-changed"));
  }, { role, token });
}

async function pendingGroup(page: Page, name = "Old group") {
  let release!: () => void;
  let arrived!: () => void;
  let ended!: () => void;
  const held = new Promise<void>(resolve => { release = resolve; });
  const seen = new Promise<void>(resolve => { arrived = resolve; });
  const finished = new Promise<void>(resolve => { ended = resolve; });
  await page.route(`http://api.test/v1/school/groups/${name.toLowerCase().replaceAll(" ", "-")}`, async route => {
    arrived(); await held;
    try { await route.fulfill({ json: { id: "saved-group" } }); }
    catch (error) { if (route.request().failure()?.errorText !== "net::ERR_ABORTED") throw error; }
    finally { ended(); }
  });
  await groupDraft(page, name);
  await page.getByRole("button", { name: "Save group", exact: true }).click();
  await seen;
  return { release, finished };
}

function groupPanel(page: Page) {
  return page.locator("section").filter({ has: page.getByRole("heading", { name: "Teaching Group", exact: true }) }).last();
}

async function groupDraft(page: Page, name: string) {
  const panel = groupPanel(page);
  await panel.getByRole("combobox", { name: "Class", exact: true }).selectOption("oak");
  await panel.getByLabel("Group name", { exact: true }).fill(name);
}

test("an old setup save cannot clear the replacement session's group draft", async ({ page }) => {
  await setup(page);
  const old = await pendingGroup(page);
  try {
    const cancelled = page.waitForEvent("requestfailed", { predicate: request => request.url().endsWith("/groups/old-group") });
    await page.getByRole("button", { name: "Sign out", exact: true }).click();
    expect((await cancelled).failure()?.errorText).toBe("net::ERR_ABORTED");
    await login(page);
    await groupDraft(page, "New owner's draft");
    old.release(); await old.finished;
    await settleUI(page);
    await expect(page.getByLabel("Group name", { exact: true })).toHaveValue("New owner's draft");
    await expect(page.getByRole("status")).toHaveText("School workspace loaded.");
    await expect(page.getByRole("button", { name: "Save group", exact: true })).toBeEnabled();
  } finally { old.release(); }
});

test("an old save cannot unlock a newer owner's pending save", async ({ page }) => {
  await setup(page);
  const old = await pendingGroup(page);
  try {
    await page.getByRole("button", { name: "Sign out", exact: true }).click();
    await login(page);
    const newer = await pendingGroup(page, "New group");
    try {
      old.release(); await old.finished; await settleUI(page);
      await expect(page.getByLabel("Group name", { exact: true })).toHaveValue("New group");
      await expect(page.getByLabel("Group name", { exact: true })).toBeDisabled();
      await expect(page.getByRole("status")).toHaveText("Saving group...");
      await expect(page.getByRole("button", { name: "Save group", exact: true })).toBeDisabled();
      newer.release(); await newer.finished;
      await expect(page.getByRole("status")).toHaveText("School workspace loaded.");
      await expect(page.getByLabel("Group name", { exact: true })).toHaveValue("");
      await expect(page.getByLabel("Group name", { exact: true })).toBeEnabled();
    } finally { newer.release(); }
  } finally { old.release(); }
});

for (const change of ["replacement", "expiry", "navigation"] as const) {
  test(`${change} cancels pending school setup and removes private drafts`, async ({ page }) => {
    await setup(page);
    const old = await pendingGroup(page);
    try {
      const cancelled = page.waitForEvent("requestfailed", { predicate: request => request.url().endsWith("/groups/old-group") });
      if (change === "navigation") await page.getByRole("link", { name: "Home", exact: true }).click();
      else if (change === "replacement") await replaceSession(page);
      else await page.evaluate(() => {
        sessionStorage.setItem("nexuslearn_account_session_expires", "2000-01-01T00:00:00Z");
        window.dispatchEvent(new Event("nexuslearn-account-session-changed"));
      });
      expect((await cancelled).failure()?.errorText).toBe("net::ERR_ABORTED");
      old.release(); await old.finished; await settleUI(page);
      await expect(page.getByLabel("Group name", { exact: true })).toHaveCount(0);
      if (change === "navigation") await expect(page).toHaveURL("/");
      else {
        await expect(page.getByRole("status")).toContainText("session changed or expired");
        await page.getByLabel("Temporary password", { exact: true }).fill("disposable-fixture-password");
        await expect(page.getByRole("button", { name: "Sign in", exact: true })).toBeEnabled();
      }
    } finally { old.release(); }
  });
}

for (const role of ["school_admin", "parent"]) {
  test(`school sign-in may replace a cached ${role} session without cancelling itself`, async ({ page }) => {
    await setup(page, false);
    await replaceSession(page, role, "cached-account");
    await login(page);
    await expect(page.getByRole("status")).toHaveText("School workspace loaded.");
    expect(await page.evaluate(() => sessionStorage.getItem("nexuslearn_account_session"))).toBe("setup-session-1");
    await expect(page.getByLabel("Group name", { exact: true })).toBeEnabled();
  });
}

test("a failed post-login overview unlocks school sign-in and retains the error", async ({ page }) => {
  await setup(page, false);
  await page.route("http://api.test/v1/school/config?**", route => route.fulfill({ status: 503, json: { error: "School directory temporarily unavailable." } }));
  await page.getByLabel("School URN", { exact: true }).fill("setup-school");
  await page.getByLabel("Login ID", { exact: true }).fill("teacher");
  await page.getByLabel("Temporary password", { exact: true }).fill("disposable-fixture-password");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText("School directory temporarily unavailable.");
  await expect(page.getByLabel("Temporary password", { exact: true })).toBeEnabled();
  await expect(page.getByLabel("Group name", { exact: true })).toHaveCount(0);
  await page.unroute("http://api.test/v1/school/config?**");
  await login(page);
  await expect(page.getByRole("status")).toHaveText("School workspace loaded.");
});

test("pending school setup locks the submitted class and pupil fields", async ({ page }) => {
  await setup(page);
  let release!: () => void;
  let arrived!: () => void;
  const held = new Promise<void>(resolve => { release = resolve; });
  const seen = new Promise<void>(resolve => { arrived = resolve; });
  await page.route("http://api.test/v1/school/students/*", async route => {
    arrived(); await held;
    await route.fulfill({ json: { external_ref: "new-pupil" } }).catch(() => {});
  });
  try {
    await page.getByLabel("Enrol in class").selectOption("oak");
    const pupil = page.locator("section").filter({ has: page.getByRole("heading", { name: "Create Pupil", exact: true }) }).last();
    await pupil.getByLabel("Pupil ID", { exact: true }).fill("new-pupil");
    await pupil.getByLabel("Display name", { exact: true }).fill("New pupil");
    await pupil.getByRole("button", { name: "Create pupil", exact: true }).click();
    await seen;
    await expect(page.getByLabel("Enrol in class")).toBeDisabled();
    await expect(pupil.getByLabel("Display name", { exact: true })).toBeDisabled();
    await expect(page.getByRole("button", { name: "Sign out", exact: true })).toBeEnabled();
  } finally { release(); }
});
