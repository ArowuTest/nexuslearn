import { expect, test, type Page } from "@playwright/test";
import { responseSettled } from "./response-settled";

const accounts = [
  { name: "school", page: "/school-admin", path: "/v1/auth/school-login", passwordLabel: "Temporary password", role: "school_admin" },
  { name: "parent", page: "/family", path: "/v1/auth/parent-login", passwordLabel: "Password", role: "parent" },
  { name: "admin", page: "/admin", path: "/v1/auth/admin-login", passwordLabel: "Password", role: "platform_admin" },
];

async function prepare(page: Page, account: typeof accounts[number]) {
  await page.route("http://api.test/**", async route => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/v1/school/config") return route.fulfill({ json: { current_user: { login_id: "qa-adult", role: "school_admin" }, school: { urn: "qa-school", name: "QA school" }, classes: [], groups: [] } });
    if (path === "/v1/parent/config") return route.fulfill({ json: { parent: { id: "qa-parent", display_name: "QA parent", login_id: "qa-adult" }, children: [] } });
    return route.fulfill({ json: {} });
  });
  await page.goto(account.page, { waitUntil: "domcontentloaded" });
  if (account.name === "school") await page.getByLabel("School URN", { exact: true }).fill("qa-school");
  await page.getByLabel("Login ID", { exact: true }).fill("qa-adult");
  const form = page.locator("form").filter({ has: page.getByRole("textbox", { name: "Login ID", exact: true }) });
  await form.getByLabel(account.passwordLabel, { exact: true }).fill("local-test-only-password");
  await expect(page.getByRole("button", { name: "Sign in", exact: true })).toBeEnabled();
}

for (const account of accounts) {
  test(`${account.name} sign-in times out and unlocks without losing the login details`, async ({ page }) => {
    await page.clock.install();
    await prepare(page, account);
    let release!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    let started = false;
    await page.route(`http://api.test${account.path}`, async route => { started = true; await gate; await route.abort().catch(() => {}); });
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    try {
      await expect.poll(() => started).toBe(true);
      await page.clock.fastForward(15_001);
      await expect(page.getByRole("status")).toContainText("timed out");
      await expect(page.getByRole("button", { name: "Sign in", exact: true })).toBeEnabled();
      await expect(page.getByRole("textbox", { name: "Login ID", exact: true })).toHaveValue("qa-adult");
      expect(await page.evaluate(() => sessionStorage.getItem("nexuslearn_account_session"))).toBeNull();
    } finally { release(); }
  });

  test(`${account.name} sign-in rejects a successful response with the wrong account role`, async ({ page }) => {
    await prepare(page, account);
    await page.route(`http://api.test${account.path}`, route => route.fulfill({ json: { parent: { id: "qa-parent" }, session: { token: "wrong-role-token", role: "pupil", expires_at: "2099-01-01T00:00:00Z" } } }));
    const response = page.waitForResponse(res => new URL(res.url()).pathname === account.path);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await responseSettled(page, response);
    expect(await page.evaluate(() => sessionStorage.getItem("nexuslearn_account_session"))).toBeNull();
    await expect(page.getByRole("status")).toContainText("could not be verified");
    await expect(page.getByRole("button", { name: "Sign in", exact: true })).toBeEnabled();
  });

  test(`${account.name} sign-in rejects an invalid session expiry`, async ({ page }) => {
    await prepare(page, account);
    await page.route(`http://api.test${account.path}`, route => route.fulfill({ json: { session: { token: "bad-expiry", role: account.role, expires_at: "invalid" } } }));
    const response = page.waitForResponse(res => new URL(res.url()).pathname === account.path);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await responseSettled(page, response);
    expect(await page.evaluate(() => sessionStorage.getItem("nexuslearn_account_session"))).toBeNull();
    await expect(page.getByRole("status")).toContainText("could not be verified");
  });

  test(`${account.name} a late login cannot overwrite a replacement session`, async ({ page }) => {
    await prepare(page, account);
    let release!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    let started = false;
    await page.route(`http://api.test${account.path}`, async route => {
      started = true;
      await gate;
      await route.fulfill({ json: { parent: { id: "old-parent", login_id: "old-parent" }, session: { token: "old-token", role: account.role, expires_at: "2099-01-01T00:00:00Z" } } }).catch(error => {
        if (route.request().failure()?.errorText !== "net::ERR_ABORTED") throw error;
      });
    });
    const completed = Promise.race([
      page.waitForEvent("requestfinished", { predicate: request => new URL(request.url()).pathname === account.path }),
      page.waitForEvent("requestfailed", { predicate: request => new URL(request.url()).pathname === account.path }),
    ]);
    try {
      await page.getByRole("button", { name: "Sign in", exact: true }).click();
      await expect.poll(() => started).toBe(true);
      await page.evaluate(role => {
        sessionStorage.setItem("nexuslearn_account_session", "replacement-token");
        sessionStorage.setItem("nexuslearn_account_role", role);
        sessionStorage.setItem("nexuslearn_account_session_expires", "2099-01-01T00:00:00Z");
        window.dispatchEvent(new Event("nexuslearn-account-session-changed"));
      }, account.role);
      release();
      const completedRequest = await completed;
      expect(completedRequest.failure()?.errorText).toBe("net::ERR_ABORTED");
      await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
      expect(await page.evaluate(() => sessionStorage.getItem("nexuslearn_account_session"))).toBe("replacement-token");
      await expect(page.getByRole("button", { name: "Sign in", exact: true })).toBeEnabled();
    } finally { release(); }
  });

  test(`${account.name} pending sign-in keeps one immutable credential submission`, async ({ page }) => {
    await prepare(page, account);
    let release!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    let requests = 0;
    await page.route(`http://api.test${account.path}`, async route => { requests++; await gate; await route.abort().catch(() => {}); });
    try {
      await page.getByRole("button", { name: "Sign in", exact: true }).click();
      await expect.poll(() => requests).toBe(1);
      await expect(page.getByRole("textbox", { name: "Login ID", exact: true })).toBeDisabled();
      const form = page.locator("form").filter({ has: page.getByRole("textbox", { name: "Login ID", exact: true }) });
      await form.evaluate(node => (node as HTMLFormElement).requestSubmit());
      await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => resolve())));
      expect(requests).toBe(1);
    } finally { release(); }
  });
}

test("a temporary storage failure does not permanently lock administrator sign-in", async ({ page }) => {
  const account = accounts[2];
  await prepare(page, account);
  let requests = 0;
  await page.route(`http://api.test${account.path}`, route => {
    requests++;
    return route.fulfill({ json: { session: { token: "recovered-admin", role: account.role, expires_at: "2099-01-01T00:00:00Z" } } });
  });
  await page.evaluate(() => {
    const original = Storage.prototype.getItem;
    let fail = true;
    Storage.prototype.getItem = function (key) {
      if (key === "nexuslearn_account_session" && fail) { fail = false; throw new DOMException("Storage temporarily unavailable", "SecurityError"); }
      return original.call(this, key);
    };
  });
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Storage temporarily unavailable");
  expect(requests).toBe(0);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect.poll(() => requests).toBe(1);
  await expect.poll(() => page.evaluate(() => sessionStorage.getItem("nexuslearn_account_session"))).toBe("recovered-admin");
});

for (const account of accounts) {
  test(`${account.name} server-rendered credentials wait for hydration`, async ({ request }) => {
    const response = await request.get(account.page);
    expect(response.ok()).toBe(true);
    expect(await response.text()).toMatch(/<fieldset[^>]*disabled/);
  });
}

for (const account of accounts.slice(0, 2)) {
  test(`${account.name} leaving the sign-in page cancels the pending login`, async ({ page }) => {
    await prepare(page, account);
    let release!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    let started = false;
    await page.route(`http://api.test${account.path}`, async route => {
      started = true;
      await gate;
      await route.fulfill({ json: { parent: { login_id: "old-parent" }, session: { token: "late-token", role: account.role, expires_at: "2099-01-01T00:00:00Z" } } }).catch(error => {
        if (route.request().failure()?.errorText !== "net::ERR_ABORTED") throw error;
      });
    });
    try {
      await page.getByRole("button", { name: "Sign in", exact: true }).click();
      await expect.poll(() => started).toBe(true);
      const cancelled = page.waitForEvent("requestfailed", { predicate: request => new URL(request.url()).pathname === account.path });
      await page.getByRole("link", { name: account.name === "school" ? "Home" : "NexusLearn", exact: true }).click();
      expect((await cancelled).failure()?.errorText).toBe("net::ERR_ABORTED");
      await expect(page).toHaveURL("/");
      release();
      expect(await page.evaluate(() => sessionStorage.getItem("nexuslearn_account_session"))).toBeNull();
    } finally { release(); }
  });
}
