import { expect, test, type Page } from "@playwright/test";
import { responseSettled } from "./response-settled";

const session = { token: "local-fixture-parent", role: "parent", expires_at: "2099-01-01T00:00:00Z" };
const parent = { email: "parent@example.test", login_id: "parent", display_name: "QA parent" };
const child = { student: { external_ref: "qa-child", display_name: "QA child", year_group: 1 }, credential: { student_external_ref: "qa-child", login_code: "TEST12", picture_password: ["star", "book", "sun"] }, engagement: { declared_support_needs: [], learning_approaches: [] } };

async function fixture(page: Page, children: unknown = [child]) {
  await page.route("http://api.test/**", async route => {
    const p = new URL(route.request().url()).pathname;
    const body = p === "/v1/parent/config" ? { parent, children }
      : p.endsWith("/evidence") ? { child, mastery: [], summary: {}, progress: null }
      : p.includes("mock-assessments") ? { mock_assessments: [] }
      : { parent, session };
    await route.fulfill({ json: body });
  });
}

async function login(page: Page) {
  await page.goto("/family");
  await page.getByLabel("Login ID", { exact: true }).fill("parent");
  await page.getByLabel("Password", { exact: true }).last().fill("disposable-password");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
}

test("new family tolerates an empty legacy children response", async ({ page }) => {
  await fixture(page, null);
  await login(page);
  await expect(page.getByRole("heading", { name: "Children", exact: true })).toBeVisible();
  await expect(page.getByLabel("Child name")).toBeVisible();
});

test("family sign-out removes private data before an unresponsive server replies", async ({ page }) => {
  await fixture(page);
  await login(page);
  await expect(page.getByText("QA child", { exact: true })).toBeVisible();
  let release!: () => void;
  const pending = new Promise<void>(resolve => { release = resolve; });
  await page.route("http://api.test/v1/auth/logout", async route => { await pending; await route.fulfill({ status: 204 }); });
  try {
    await page.getByRole("button", { name: "Sign out", exact: true }).click();
    await expect(page.getByText("QA child", { exact: true })).toHaveCount(0);
    await expect(page.getByRole("navigation", { name: "Family workspace sections" })).toHaveCount(0);
  } finally { release(); }
});

test("SEND choices expose their selected state and family cards show the picture sequence", async ({ page }) => {
  await fixture(page);
  await login(page);
  const reducedMotion = page.getByRole("button", { name: "Reduced motion", exact: true });
  await expect(reducedMotion).toHaveAttribute("aria-pressed", "false");
  await reducedMotion.click();
  await expect(reducedMotion).toHaveAttribute("aria-pressed", "true");
  await page.getByText("Show child login card", { exact: true }).click();
  await expect(page.getByRole("img", { name: "Star", exact: true })).toBeVisible();
  await expect(page.getByRole("img", { name: "Book", exact: true })).toBeVisible();
});

test("invited parents can add a child without re-entering the accepted password", async ({ page }) => {
  await fixture(page, []);
  await page.goto("/family?invitation=local-test-invitation");
  await page.getByLabel("Your name").fill("Invited parent");
  await page.getByLabel("Choose password").fill("local-test-password");
  await page.getByRole("button", { name: "Accept invitation" }).click();
  await page.getByLabel("Child name").fill("QA child");
  await expect(page.getByRole("button", { name: "Create child profile" })).toBeEnabled();
});

test("parent sign-in submits from the keyboard", async ({ page }) => {
  await fixture(page, []);
  await page.goto("/family");
  await page.getByLabel("Login ID", { exact: true }).fill("parent");
  const password = page.getByLabel("Password", { exact: true }).last();
  await password.fill("local-test-password");
  await password.press("Enter");
  await expect(page.getByRole("navigation", { name: "Family workspace sections" })).toBeVisible();
});

test("pupil password choices contain actual matching pictures", async ({ page }) => {
  await page.goto("/login");
  for (const name of ["Star", "Book", "Sun", "Tree", "Rocket", "Moon", "Shell", "Key"]) {
    const button = page.getByRole("button", { name, exact: true });
    await expect(button.getByRole("img", { name, exact: true })).toBeVisible();
  }
});

test("school login submits with Enter and all navigation choices fit a narrow screen", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 780 });
  await page.route("http://api.test/**", async route => {
    const p = new URL(route.request().url()).pathname;
    const body = p.endsWith("school-login") ? { session: { ...session, role: "school_admin" } }
      : p.endsWith("/config") ? { school: { urn: "qa-school", name: "QA school" }, current_user: { login_id: "teacher", display_name: "QA teacher", role: "school_admin" }, classes: [], groups: [], student_credentials: [] } : {};
    await route.fulfill({ json: body });
  });
  await page.goto("/school-admin");
  await page.getByLabel("School URN").fill("qa-school");
  await page.getByLabel("Login ID").fill("teacher");
  const password = page.getByLabel("Temporary password");
  await password.fill("local-test-password");
  await password.press("Enter");
  const nav = page.getByRole("navigation", { name: "School workspace sections" });
  await expect(nav).toBeVisible();
  expect(await nav.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
});

test("signing out during evidence loading prevents the late response restoring child details", async ({ page }) => {
  await fixture(page);
  await login(page);
  await expect(page.getByRole("button", { name: "Load evidence", exact: true })).toBeEnabled();
  let release!: () => void;
  const pending = new Promise<void>(resolve => { release = resolve; });
  await page.route("http://api.test/v1/parent/children/qa-child/evidence", async route => { await pending; await route.fulfill({ json: { child, mastery: [], summary: {}, progress: null } }); });
  const response = page.waitForResponse(r => r.url().endsWith("/qa-child/evidence"));
  try {
    await page.getByRole("button", { name: "Load evidence", exact: true }).click();
    await page.getByRole("button", { name: "Sign out", exact: true }).click();
    release();
    await responseSettled(page, response);
    await expect(page.getByText("QA child", { exact: true })).toHaveCount(0);
    await expect(page.getByRole("status")).toHaveText("Signed out securely.");
  } finally { release(); }
});

test("retrying a child save reuses its ID and late completion cannot reopen a signed-out family", async ({ page }) => {
  await fixture(page, []);
  await login(page);
  const ids: string[] = [];
  let release!: () => void;
  const pending = new Promise<void>(resolve => { release = resolve; });
  await page.route("http://api.test/v1/parent/children/*", async route => {
    ids.push(new URL(route.request().url()).pathname);
    if (ids.length === 1) { await route.fulfill({ status: 503, json: { error: "Try again" } }); return; }
    await pending;
    await route.fulfill({ json: child });
  });
  await page.getByLabel("Child name", { exact: true }).fill("QA retry child");
  const save = page.getByRole("button", { name: "Create child profile" });
  await save.click();
  await expect(page.getByRole("status")).toHaveText("Try again");
  const response = page.waitForResponse(r => r.request().method() === "PUT" && r.url().includes("/v1/parent/children/") && r.status() === 200);
  await save.click();
  try {
    await expect.poll(() => ids.length).toBe(2);
    expect(ids[0]).toBe(ids[1]);
    await page.getByRole("button", { name: "Sign out", exact: true }).click();
    release();
    await responseSettled(page, response);
    await expect(page.getByRole("status")).toHaveText("Signed out securely.");
    await expect(page.getByRole("navigation", { name: "Family workspace sections" })).toHaveCount(0);
  } finally { release(); }
});

test("a returning parent resumes only a server-verified workspace and can sign out", async ({ page }) => {
  await fixture(page);
  await login(page);
  await expect(page.getByText("QA child", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText("QA child", { exact: true })).toBeVisible();
  await expect(page.getByRole("status")).toHaveText("Family workspace loaded.");
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page.getByText("QA child", { exact: true })).toHaveCount(0);
});

test("a single child's evidence uses available desktop space instead of an empty three-column grid", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await fixture(page);
  await login(page);
  const card = page.locator("#family-children article").first();
  await expect(card).toBeVisible();
  expect((await card.boundingBox())!.width).toBeGreaterThan(500);
});

test("long child login codes remain inside the private card on a narrow screen", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 850 });
  const code = `HOME-${"A".repeat(26)}`;
  await fixture(page, [{ ...child, credential: { ...child.credential, login_code: code } }]);
  await login(page);
  const card = page.locator("#family-children article").first();
  await expect(card).toBeVisible();
  await expect(card.getByText(code, { exact: true })).toHaveCount(0);
  await card.getByText("Show child login card", { exact: true }).click();
  await expect(card.getByText(`Login code: ${code}`, { exact: true })).toBeVisible();
  expect(await card.locator("details").evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
});
