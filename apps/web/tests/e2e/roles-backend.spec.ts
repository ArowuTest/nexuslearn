import { expect, test, type Page, type Response, type TestInfo } from "@playwright/test";
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

async function boundedSchoolOverview(response: Response) {
  expect(response.status()).toBe(200);
  expect(new URL(response.url()).searchParams.get("view")).toBe("directory");
  expect(response.headers()["cache-control"]).toContain("no-store");
  const data = await response.json();
  expect(data.directory.version).toBe(1);
  expect(data.current_user.school_urn).toBe(data.school.urn);
  expect(data).not.toHaveProperty("users");
  expect(data).not.toHaveProperty("student_credentials");
  for (const kind of ["classes", "groups", "students"]) {
    expect(data[kind].length).toBeLessThanOrEqual(20);
    expect(data.directory.counts[kind]).toBeGreaterThanOrEqual(data[kind].length);
    for (const item of data[kind]) expect(item).not.toHaveProperty("students");
  }
}

async function schoolChange(page: Page, button: string) {
  const mutation = page.waitForResponse(r => r.url().includes("/v1/school/") && ["PUT", "POST"].includes(r.request().method()));
  const portal = page.waitForResponse(r => new URL(r.url()).pathname === "/v1/school/config" && r.request().method() === "GET");
  await page.getByRole("button", { name: button, exact: true }).click();
  expect((await mutation).status()).toBe(200);
  await boundedSchoolOverview(await portal);
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
  const schoolLoaded = page.waitForResponse(response => new URL(response.url()).pathname === "/v1/school/config");
  await page.getByLabel("Temporary password", { exact: true }).press("Enter");
  await boundedSchoolOverview(await schoolLoaded);
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
  await page.getByRole("combobox", { name: "Login card class", exact: true }).selectOption({ label: `${className} (Year 1)` });
  await page.getByRole("button", { name: "Show login card for QA school explorer", exact: true }).click();
  await expect(page.getByRole("heading", { name: "QA school explorer", exact: true }).first()).toBeVisible();
  await panel("Pupil Login Packs").scrollIntoViewIfNeeded();
  await capture(page, info, "06-school-login-card");
  const groupName = `Reading ${info.project.name}`;
  await panel("Teaching Group").getByRole("combobox", { name: "Class", exact: true }).selectOption({ label: `${className} (Year 1)` });
  await panel("Teaching Group").getByLabel("Group name").fill(groupName);
  const group = await schoolChange(page, "Save group");
  expect(group.name).toBe(groupName);
  const pupilDirectory = page.getByRole("search", { name: "Pupils directory" });
  await pupilDirectory.getByLabel("Search pupils").fill(pupilId);
  const searched = page.waitForResponse(response => new URL(response.url()).pathname === "/v1/school/directory" && new URL(response.url()).searchParams.get("search") === pupilId);
  await pupilDirectory.getByLabel("Search pupils").press("Enter");
  const found = await searched;
  expect(found.status()).toBe(200);
  expect(await found.json()).toMatchObject({ school_urn: "qa-school", kind: "students", items: [{ external_ref: pupilId, display_name: "QA school explorer" }] });
  await expect(pupilDirectory).toContainText("1 results");
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
  async function objectiveFor(area: ReturnType<typeof panel>, year: number, subject: string) {
    await area.getByRole("button", { name: "Choose objective", exact: true }).click();
    await area.getByRole("combobox", { name: "Curriculum year", exact: true }).selectOption(String(year));
    await area.getByRole("combobox", { name: "Subject", exact: true }).selectOption(subject);
    const read = page.waitForResponse(response => {
      const url = new URL(response.url());
      return url.pathname === "/v1/school/curriculum/objectives" && url.searchParams.get("year") === String(year) && url.searchParams.get("subject") === subject;
    });
    await area.getByRole("button", { name: "Find objectives", exact: true }).click();
    const response = await read;
    expect(response.status()).toBe(200);
    const catalog = await response.json();
    expect(catalog.objectives.length).toBeGreaterThan(0);
    const first = catalog.objectives[0];
    await area.getByRole("button", { name: `Choose ${first.statement}`, exact: true }).click();
    return first.id as string;
  }
  const priorityArea = panel("Assign Learning Priority");
  const priorityObjective = await objectiveFor(priorityArea, 2, "Mathematics");
  await priorityArea.getByLabel("Teacher note/title").fill(`Next maths step ${info.project.name}`);
  const assigned = page.waitForResponse(response => response.url().endsWith("/v1/school/assignments") && response.request().method() === "POST");
  await priorityArea.getByRole("button", { name: "Assign learning", exact: true }).click();
  expect((await assigned).status()).toBe(201);
  expect(await (await assigned).json()).toMatchObject({ student_external_ref: pupilId, objective_id: priorityObjective });
  await expect(priorityArea.getByText("Learning priority saved.", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Selected school learner")).toHaveValue(pupilId);

  const evidenceArea = panel("Record Teacher Evidence");
  const evidenceObjective = await objectiveFor(evidenceArea, 1, "English");
  const evidenceNote = `Explained the idea with visual supports ${info.project.name}`;
  const durableEvidenceIDs: string[] = [];
  const evidenceKeys: string[] = [];
  await page.route("http://api.test/v1/school/evidence", async route => {
    if (route.request().method() !== "POST") return route.fallback();
    const response = await route.fetch({ url: `${api}/v1/school/evidence` });
    expect(response.status()).toBe(201);
    durableEvidenceIDs.push((await response.json()).id);
    evidenceKeys.push(route.request().headers()["idempotency-key"]);
    if (durableEvidenceIDs.length === 1) return route.abort("connectionfailed");
    return route.fulfill({ response });
  });
  await evidenceArea.getByLabel("Evidence note").fill(evidenceNote);
  await evidenceArea.getByRole("button", { name: "Save teacher evidence", exact: true }).click();
  await expect(evidenceArea.getByRole("alert")).toContainText("not confirm");
  await expect(evidenceArea.getByLabel("Evidence note")).toHaveValue(evidenceNote);
  const evidenceList = page.waitForResponse(response => new URL(response.url()).pathname === "/v1/school/evidence" && new URL(response.url()).searchParams.get("studentId") === pupilId && response.request().method() === "GET");
  await evidenceArea.getByRole("button", { name: "Save teacher evidence", exact: true }).click();
  await expect(evidenceArea.getByText("Teacher evidence saved.", { exact: true })).toBeVisible();
  const savedEvidence = (await (await evidenceList).json()).teacher_evidence.filter((item: { student_external_ref: string; note: string }) => item.student_external_ref === pupilId && item.note === evidenceNote);
  expect(savedEvidence).toHaveLength(1);
  expect(savedEvidence[0].objective_id).toBe(evidenceObjective);
  expect(durableEvidenceIDs).toHaveLength(2);
  expect(durableEvidenceIDs[0]).toBe(durableEvidenceIDs[1]);
  expect(evidenceKeys[0]).toBeTruthy();
  expect(evidenceKeys[1]).toBe(evidenceKeys[0]);

  const interventionArea = panel("Create Intervention Plan");
  const interventionObjective = await objectiveFor(interventionArea, 1, "English");
  const planTitle = `Supported explanation ${info.project.name}`;
  await interventionArea.getByLabel("Plan title").fill(planTitle);
  await interventionArea.getByLabel("Identified learning need").fill("Explain the sequence with evidence");
  await interventionArea.getByLabel("Teaching strategy").fill("Model the first step, then use the pupil's chosen supports");
  const interventionSaved = page.waitForResponse(response => response.url().endsWith("/v1/school/interventions") && response.request().method() === "POST");
  await interventionArea.getByRole("button", { name: "Create intervention", exact: true }).click();
  const interventionResponse = await interventionSaved;
  expect(interventionResponse.status()).toBe(201);
  const intervention = await interventionResponse.json();
  expect(intervention).toMatchObject({ student_external_ref: pupilId, objective_id: interventionObjective, title: planTitle });
  await expect(interventionArea.getByText("Intervention plan saved.", { exact: true })).toBeVisible();
  const reviewArea = panel("Review Intervention Evidence");
  const reviewIDs: string[] = [];
  const reviewKeys: string[] = [];
  await page.route(`http://api.test/v1/school/interventions/${intervention.id}/reviews`, async route => {
    const response = await route.fetch({ url: `${api}/v1/school/interventions/${intervention.id}/reviews` });
    expect(response.status()).toBe(201);
    reviewIDs.push((await response.json()).id);
    reviewKeys.push(route.request().headers()["idempotency-key"]);
    if (reviewIDs.length === 1) return route.abort("connectionfailed");
    return route.fulfill({ response });
  });
  await reviewArea.getByRole("combobox", { name: "Intervention", exact: true }).selectOption(intervention.id);
  await reviewArea.getByLabel("Reassessment evidence").fill("The pupil explained another example with their chosen supports.");
  await reviewArea.getByLabel("Next review date").fill(new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 16));
  await reviewArea.getByRole("button", { name: "Save reassessment", exact: true }).click();
  await expect(reviewArea.getByRole("alert")).toContainText("not confirm");
  const reassessed = page.waitForResponse(response => response.url().endsWith(`/v1/school/interventions/${intervention.id}/reviews`) && response.request().method() === "POST");
  await reviewArea.getByRole("button", { name: "Save reassessment", exact: true }).click();
  expect((await reassessed).status()).toBe(201);
  await expect(reviewArea.getByText("Intervention reassessment saved.", { exact: true })).toBeVisible();
  expect(reviewIDs).toHaveLength(2);
  expect(reviewIDs[0]).toBe(reviewIDs[1]);
  expect(reviewKeys[0]).toBeTruthy();
  expect(reviewKeys[1]).toBe(reviewKeys[0]);
  await priorityArea.scrollIntoViewIfNeeded();
  await capture(page, info, "09-school-teaching-workflow");
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
