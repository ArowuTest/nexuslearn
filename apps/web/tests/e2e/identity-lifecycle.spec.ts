import { expect, test, type Page } from "@playwright/test";
import { responseSettled } from "./response-settled";

const pupils = [
  { external_ref: "child-a", display_name: "Learner A", year_group: 2 },
  { external_ref: "child-b", display_name: "Learner B", year_group: 3 },
];
const session = { token: "school-lifecycle-fixture", role: "school_admin", expires_at: "2099-01-01T00:00:00Z" };
const profileA = { student_external_ref: "child-a", notes: "Private support for A", interests: ["A interest"], learning_approaches: ["reduced_motion"] };

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
        body = route.request().postDataJSON();
        writes.push(body as Record<string, unknown>);
      } else body = path.includes("/child-a/") ? profileA : { student_external_ref: "child-b", notes: "", interests: [] };
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
    let release!: () => void, arrived!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    const seen = new Promise<void>(resolve => { arrived = resolve; });
    await page.route("http://api.test/v1/school/students/child-a/engagement", async route => {
      if (route.request().method() !== scenario.method) { await route.fallback(); return; }
      arrived();
      await gate;
      await route.fulfill({ json: profileA });
    });
    const response = page.waitForResponse(r => r.url().endsWith("/child-a/engagement") && r.request().method() === scenario.method);
    try {
      await page.getByRole("button", { name: scenario.method === "PUT" ? "Save support profile" : "Load profile", exact: true }).click();
      await seen;
      await learner.selectOption("child-b");
      if (scenario.target === "child-a") await learner.selectOption("child-a");
      release();
      await responseSettled(page, response);
      await expect(page.getByRole("textbox", { name: "Operational notes", exact: true })).toHaveValue("");
      await expect(page.getByLabel("Reduced Motion", { exact: true })).not.toBeChecked();
      const saved = page.waitForResponse(r => r.url().endsWith(`/${scenario.target}/engagement`) && r.request().method() === "PUT");
      await page.getByRole("button", { name: "Save support profile", exact: true }).click();
      await responseSettled(page, saved);
      expect(writes.at(-1)?.student_external_ref).toBe(scenario.target);
      expect(writes.at(-1)?.notes).toBe("");
    } finally { release(); }
  });
}

function pupilResult(ref: string) {
  return { student: pupils.find(item => item.external_ref === ref), session: { token: `fixture-${ref}`, expires_at: "2099-01-01T00:00:00Z" } };
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
