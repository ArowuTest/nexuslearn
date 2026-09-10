import { expect, test, type Page } from "@playwright/test";

const child = {
  student: { external_ref: "private-child", display_name: "Private child", year_group: 1 },
  credential: { student_external_ref: "private-child", login_code: "TEST12", picture_password: ["star", "book", "sun"] },
  engagement: { declared_support_needs: [], learning_approaches: [] },
};

async function fixture(page: Page, role: string) {
  await page.route("http://api.test/**", route => {
    const path = new URL(route.request().url()).pathname;
    const body = path === "/v1/parent/config" ? { parent: { display_name: "Private parent", login_id: "parent" }, children: [child] }
      : path.endsWith("/evidence") ? { child, mastery: [], summary: {}, progress: null }
      : path.includes("mock-assessments") ? { mock_assessments: [] }
      : path === "/v1/admin/learner-directory" ? { students: [child.student], student_credentials: [child.credential] }
      : path === "/v1/school/config" ? { current_user: { login_id: "adult", role }, school: { urn: "qa-school", name: "Private school" }, classes: [], groups: [] }
      : path.includes("/auth/") ? { parent: { login_id: "parent" }, session: { token: "new-owner", role, expires_at: "2099-01-01T00:00:00Z" } }
      : {};
    return route.fulfill({ json: body });
  });
}

async function seed(page: Page, role: string) {
  await page.addInitScript(role => {
    sessionStorage.setItem("nexuslearn_account_session", "old-owner");
    sessionStorage.setItem("nexuslearn_account_role", role);
    sessionStorage.setItem("nexuslearn_account_session_expires", "2099-01-01T00:00:00Z");
  }, role);
}

async function signInAgainAsParent(page: Page) {
  const form = page.getByRole("form", { name: "Parent sign in" });
  await form.getByLabel("Login ID", { exact: true }).fill("next-parent");
  await form.getByLabel("Password", { exact: true }).fill("local-test-only-password");
  await form.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("navigation", { name: "Family workspace sections" })).toBeVisible();
}

for (const account of [
  { route: "/family", role: "parent", navigation: "Family workspace sections" },
  { route: "/admin?section=learners", role: "platform_admin", navigation: "Admin sections" },
]) {
  for (const change of ["replacement", "expiry"]) {
    test(`${account.role} idle ${change} clears the whole private workspace and its drafts`, async ({ page }) => {
      await page.clock.install();
      await fixture(page, account.role);
      await seed(page, account.role);
      await page.goto(account.route);
      await expect(page.getByRole("navigation", { name: account.navigation })).toBeVisible();
      await expect(page.getByText("Private child", { exact: true }).first()).toBeVisible();
      if (account.role === "parent") {
        await page.getByLabel("Child name", { exact: true }).fill("Private draft");
        await page.getByLabel("Parent notes", { exact: true }).fill("Private SEND note");
      } else {
        await page.getByLabel("Display name", { exact: true }).fill("Private draft");
      }
      await page.evaluate(change => {
        if (change === "replacement") sessionStorage.setItem("nexuslearn_account_session", "replacement-owner");
        else sessionStorage.setItem("nexuslearn_account_session_expires", new Date(Date.now() + 5_000).toISOString());
        window.dispatchEvent(new Event("nexuslearn-account-session-changed"));
      }, change);
      if (change === "expiry") await page.clock.fastForward(5_001);
      await expect(page.getByRole("navigation", { name: account.navigation })).toHaveCount(0);
      await expect(page.getByText("Private child", { exact: true })).toHaveCount(0);
      await expect(page.getByRole("status")).toContainText("changed or expired");
      if (account.role === "parent") {
        await expect(page.getByLabel("Child name", { exact: true })).toHaveCount(0);
        // Re-enter without a reload: hiding the form alone is not sufficient
        // evidence that the prior child's private drafts were discarded.
        await signInAgainAsParent(page);
        await expect(page.getByLabel("Child name", { exact: true })).toHaveValue("");
        await expect(page.getByLabel("Parent notes", { exact: true })).toHaveValue("");
      } else {
        // Re-enter the same component without navigation/reload: hidden drafts
        // must not reappear for the next administrator.
        await page.getByLabel("Login ID", { exact: true }).fill("next-admin");
        await page.getByLabel("Password", { exact: true }).fill("local-test-only-password");
        await page.getByRole("button", { name: "Sign in", exact: true }).click();
        await page.getByRole("navigation", { name: account.navigation }).getByRole("button", { name: "Learners", exact: true }).click();
        await expect(page.getByLabel("Display name", { exact: true })).toHaveValue("");
      }
    });
  }

  test(`${account.role} sign-out clears private UI while revocation is stalled`, async ({ page }) => {
    await fixture(page, account.role);
    await seed(page, account.role);
    await page.goto(account.route);
    await expect(page.getByRole("navigation", { name: account.navigation })).toBeVisible();
    let release!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    await page.route("http://api.test/v1/auth/logout", async route => { await gate; await route.fulfill({ status: 204 }).catch(() => {}); });
    try {
      await page.getByRole("button", { name: "Sign out", exact: true }).click();
      await expect(page.getByRole("navigation", { name: account.navigation })).toHaveCount(0);
      await expect(page.getByText("Private child", { exact: true })).toHaveCount(0);
      await expect(page.getByRole("status")).toHaveText("Signed out securely.");
      expect(await page.evaluate(() => sessionStorage.getItem("nexuslearn_account_session"))).toBeNull();
    } finally { release(); }
  });
}

test("family evidence cannot hold the workspace busy and is aborted on owner replacement", async ({ page }) => {
  await fixture(page, "parent");
  await seed(page, "parent");
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  let started = false;
  await page.route("http://api.test/v1/parent/children/*/evidence", async route => {
    started = true;
    await gate;
    await route.fulfill({ json: { child, mastery: [], summary: {}, progress: null } }).catch(() => {});
  });
  const aborted = page.waitForEvent("requestfailed", { predicate: request => new URL(request.url()).pathname.endsWith("/evidence") });
  try {
    await page.goto("/family");
    await expect.poll(() => started).toBe(true);
    await page.getByLabel("Child name", { exact: true }).fill("Draft child");
    await expect(page.getByRole("button", { name: "Create child profile", exact: true })).toBeEnabled();
    await page.evaluate(() => {
      sessionStorage.setItem("nexuslearn_account_session", "replacement-owner");
      window.dispatchEvent(new Event("nexuslearn-account-session-changed"));
    });
    release();
    expect((await aborted).failure()?.errorText).toBe("net::ERR_ABORTED");
    await expect(page.getByText("Private child", { exact: true })).toHaveCount(0);
    await expect(page.getByLabel("Child name", { exact: true })).toHaveCount(0);
    await signInAgainAsParent(page);
    await expect(page.getByLabel("Child name", { exact: true })).toHaveValue("");
  } finally { release(); }
});
