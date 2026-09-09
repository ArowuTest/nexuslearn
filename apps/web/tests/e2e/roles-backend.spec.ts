import { expect, test, type Page, type TestInfo } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { responseSettled } from "./response-settled";

const api = process.env.ROLE_API_URL;
test.skip(!api, "Requires the disposable PostgreSQL role browser harness.");
test.beforeEach(async ({ page }) => {
  expect(["localhost", "127.0.0.1"]).toContain(new URL(api!).hostname);
  await page.route("http://api.test/**", async route => {
    const response = await route.fetch({ url: route.request().url().replace("http://api.test", api!) });
    await route.fulfill({ response });
  });
});

async function capture(page: Page, info: TestInfo, name: string) {
  await page.screenshot({ path: info.outputPath(`${name}.png`), scale: "css", animations: "disabled" });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
}

async function schoolChange(page: Page, button: string) {
  const mutation = page.waitForResponse(r => r.url().includes("/v1/school/") && ["PUT", "POST"].includes(r.request().method()));
  const portal = page.waitForResponse(r => r.url().endsWith("/v1/school/config") && r.request().method() === "GET");
  await page.getByRole("button", { name: button, exact: true }).click();
  expect((await mutation).status()).toBe(200);
  expect((await portal).status()).toBe(200);
  await expect(page.getByRole("status")).toHaveText("School workspace loaded.");
  return (await mutation).json();
}

test("real family signup opens an empty workspace ready for its first child", async ({ page }, info) => {
  test.setTimeout(90_000);
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto("/family");
  await page.getByLabel("Parent name").fill("QA Parent");
  await page.getByLabel("Email", { exact: true }).fill(`parent-${info.project.name}@example.test`);
  await page.getByLabel("Password", { exact: true }).first().fill("local-disposable-password-only");
  const portalLoaded = page.waitForResponse(response => response.url().endsWith("/v1/parent/config"));
  await page.getByRole("button", { name: "Create account" }).click();
  expect((await portalLoaded).status()).toBe(200);
  await expect(page.getByRole("heading", { name: "Children", exact: true })).toBeVisible();
  await capture(page, info, "01-empty-family");
  const childId = `home-${info.project.name}`;
  await page.getByLabel("Child ID", { exact: true }).fill(childId);
  await page.getByLabel("Child name", { exact: true }).fill("QA explorer");
  await page.getByRole("button", { name: "Reduced motion", exact: true }).click();
  await page.getByRole("button", { name: "Read aloud", exact: true }).click();
  const created = page.waitForResponse(response => response.url().endsWith(`/v1/parent/children/${childId}`) && response.request().method() === "PUT");
  await page.getByRole("button", { name: "Create child profile" }).click();
  const childResponse = await created;
  expect(childResponse.status()).toBe(200);
  const saved = await childResponse.json();
  expect(saved.engagement.learning_approaches).toContain("reduced_motion");
  expect(saved.engagement.learning_approaches).toContain("audio_read_aloud");
  await expect(page.getByText("QA explorer", { exact: true }).first()).toBeVisible();
  await page.getByText("Show child login card", { exact: true }).click();
  const card = page.getByRole("list", { name: "Picture password sequence" });
  expect(await card.getByRole("img").count()).toBe(saved.credential.picture_password.length);
  await card.scrollIntoViewIfNeeded();
  await capture(page, info, "02-family-card");
  await page.getByRole("link", { name: "Open child login", exact: true }).click();
  await expect(page.getByLabel("Pupil ID", { exact: true })).toHaveValue(childId);
  for (const value of saved.credential.picture_password as string[]) {
    const name = value.replace(/\b\w/g, letter => letter.toUpperCase());
    const button = page.getByRole("button", { name, exact: true });
    await expect(button.getByRole("img", { name, exact: true })).toBeVisible();
    await button.click();
  }
  await capture(page, info, "03-pupil-pictures");
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await page.getByRole("link", { name: "See my route", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Ready, QA explorer?", exact: true })).toBeVisible();
  await expect(page.getByText("Calm movement", { exact: true })).toBeVisible();
  await capture(page, info, "04-pupil-today");
  const accessibility = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
  expect(accessibility.violations.filter(item => item.impact === "critical" || item.impact === "serious")).toEqual([]);
  expect(errors).toEqual([]);
});

test("real school creates a class, pupil, teaching group and usable login card", async ({ page }, info) => {
  test.setTimeout(90_000);
  await page.goto("/school-admin");
  await page.getByLabel("School URN", { exact: true }).fill("qa-school");
  await page.getByLabel("Login ID", { exact: true }).fill("qa-teacher");
  await page.getByLabel("Temporary password", { exact: true }).fill("local-disposable-password-only");
  const schoolLoaded = page.waitForResponse(response => response.url().endsWith("/v1/school/config"));
  await page.getByLabel("Temporary password", { exact: true }).press("Enter");
  expect((await schoolLoaded).status()).toBe(200);
  await expect(page.getByText("Signed in as qa-teacher / School admin", { exact: true })).toBeVisible();
  await capture(page, info, "05-school-entry");
  const panel = (name: string) => page.locator("section").filter({ has: page.getByRole("heading", { name, exact: true }) }).last();
  const className = `Oak ${info.project.name}`;
  await panel("Create Class").getByLabel("Class name").fill(className);
  await schoolChange(page, "Save class");
  await expect(page.getByText(className, { exact: true }).first()).toBeVisible();
  const pupilId = `school-${info.project.name}`;
  await panel("Create Pupil").getByLabel("Pupil ID").fill(pupilId);
  await panel("Create Pupil").getByLabel("Display name").fill("QA school explorer");
  const enrolled = await schoolChange(page, "Create pupil");
  expect(enrolled.external_ref).toBe(pupilId);
  await expect(page.getByLabel("Selected school learner").locator(`option[value="${pupilId}"]`)).toHaveCount(1);
  await panel("Class Access").getByRole("combobox", { name: "Class", exact: true }).selectOption({ label: `${className} (Year 1)` });
  await panel("Class Access").getByLabel("Pupil ID").fill(pupilId);
  await schoolChange(page, "Add pupil");
  await schoolChange(page, "Generate logins");
  await expect(page.getByRole("heading", { name: "QA school explorer", exact: true }).first()).toBeVisible();
  await panel("Pupil Login Packs").scrollIntoViewIfNeeded();
  await capture(page, info, "06-school-login-card");
  const groupName = `Reading ${info.project.name}`;
  await panel("Teaching Group").getByRole("combobox", { name: "Class", exact: true }).selectOption({ label: `${className} (Year 1)` });
  await panel("Teaching Group").getByLabel("Group name").fill(groupName);
  const group = await schoolChange(page, "Save group");
  expect(group.name).toBe(groupName);
  await page.getByLabel("Selected school learner").selectOption(pupilId);
  const profileLoaded = page.waitForResponse(r => r.url().endsWith(`/${pupilId}/engagement`) && r.request().method() === "GET");
  await page.getByRole("button", { name: "Load profile", exact: true }).click();
  expect((await profileLoaded).status()).toBe(200);
  await responseSettled(page, profileLoaded);
  await expect(page.getByRole("button", { name: "Save support profile", exact: true })).toBeEnabled();
  await page.getByLabel("Reduced Motion", { exact: true }).check();
  const profileSaved = page.waitForResponse(r => r.url().endsWith(`/${pupilId}/engagement`) && r.request().method() === "PUT");
  await page.getByRole("button", { name: "Save support profile", exact: true }).click();
  expect((await profileSaved).status()).toBe(200);
  expect((await (await profileSaved).json()).learning_approaches).toContain("reduced_motion");
  await responseSettled(page, profileSaved);
  await expect(page.getByRole("status")).toContainText("saved");
  const progressResponse = page.waitForResponse(response => response.url().endsWith(`/v1/school/students/${pupilId}/progress`));
  await page.getByRole("button", { name: "Load progress", exact: true }).click();
  const response = await progressResponse;
  expect(response.status()).toBe(200);
  const progress = await response.json();
  expect(progress.student_id).toBe(pupilId);
  await expect(panel("Learner Progress Snapshot").getByText(progress.summary, { exact: true })).toBeVisible();
  await expect(page.getByRole("status")).toHaveText("Learner progress loaded.");
  await panel("Learner Progress Snapshot").scrollIntoViewIfNeeded();
  await capture(page, info, "06-school-progress");
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page.getByRole("navigation", { name: "School workspace sections" })).toHaveCount(0);
});

test("real admin signs in and navigates protected operational sections", async ({ page }, info) => {
  test.setTimeout(90_000);
  await page.goto("/admin");
  await page.getByLabel("Login ID", { exact: true }).fill("qa-admin");
  await page.getByLabel("Password", { exact: true }).fill("local-disposable-password-only");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  const nav = page.getByRole("navigation", { name: "Admin sections" });
  await expect(nav).toBeVisible();
  await capture(page, info, "07-admin-overview");
  await nav.getByRole("button", { name: "Schools", exact: true }).click();
  await expect(page.getByText("Local QA school", { exact: true }).first()).toBeVisible();
  await nav.getByRole("button", { name: "Learners", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Learners workspace loaded");
  await capture(page, info, "08-admin-learners");
  const accessibility = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
  expect(accessibility.violations.filter(item => item.impact === "critical" || item.impact === "serious")).toEqual([]);
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(nav).toHaveCount(0);
});
