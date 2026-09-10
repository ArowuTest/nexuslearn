import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const students = [{ external_ref: "ava-y3", display_name: "Ava", year_group: 3 }, { external_ref: "ben-y5", display_name: "Ben", year_group: 5 }];
const catalogue = Array.from({ length: 7 }, (_, y) => ["English", "Mathematics", "Science"].flatMap(subject => Array.from({ length: 14 }, (_, i) => ({
  id: `${subject.toLowerCase()}-y${y + 1}-${String(i + 1).padStart(2, "0")}`, year: y + 1, subject,
  strand: subject === "Mathematics" ? "Fractions" : subject === "English" ? "Reading" : "Living things",
  topic: `Learning focus ${i + 1}`, statement: `${subject} Year ${y + 1}: explain learning focus ${i + 1}.`, teacher_evidence: "Ask the pupil to explain their approach using their usual access supports.",
})))).flat();
const panel = (page: Page, name: string) => page.locator("section").filter({ has: page.getByRole("heading", { name, exact: true }) }).last();
const taskPanel = (page: Page, kind = "assignment") => panel(page, kind === "assignment" ? "Assign Learning Priority" : kind === "evidence" ? "Record Teacher Evidence" : "Create Intervention Plan");

async function school(page: Page) {
  const reads: URL[] = [];
  const writes: Array<{ path: string; body: Record<string, unknown>; key: string }> = [];
  await page.route("http://api.test/**", async route => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith("school-login")) return route.fulfill({ json: { session: { token: "school-learning-fixture", role: "school_admin", expires_at: "2099-01-01T00:00:00Z" } } });
    if (url.pathname === "/v1/school/config") return route.fulfill({ json: { school: { urn: "qa-school", name: "QA school" }, current_user: { login_id: "teacher", role: "school_admin" }, classes: [{ id: "oak", name: "Oak", year_group: 3, students }], groups: [] } });
    if (url.pathname === "/v1/school/curriculum/objectives") {
      reads.push(url);
      expect(route.request().headers().authorization).toBe("Bearer school-learning-fixture");
      const year = Number(url.searchParams.get("year"));
      const subject = url.searchParams.get("subject") || "";
      const query = (url.searchParams.get("q") || "").trim();
      const items = catalogue.filter(item => item.year === year && (!subject || item.subject === subject) && `${item.statement} ${item.topic} ${item.strand}`.toLowerCase().includes(query.toLowerCase()));
      const pageNumber = Number((url.searchParams.get("cursor") || "fixture-page-1").split("-").at(-1));
      const offset = (pageNumber - 1) * 12;
      return route.fulfill({ json: { year, subject, query, limit: 12, release_id: "fixture-release", objectives: items.slice(offset, offset + 12), has_more: items.length > offset + 12, next_cursor: items.length > offset + 12 ? `fixture-page-${pageNumber + 1}` : "" } });
    }
    if (route.request().method() === "POST" && /\/v1\/school\/(assignments|evidence|interventions)$/.test(url.pathname)) {
      const body = route.request().postDataJSON();
      writes.push({ path: url.pathname, body, key: route.request().headers()["idempotency-key"] });
      return route.fulfill({ status: 201, json: { ...body, id: `saved-${writes.length}` } });
    }
    return route.fulfill({ json: {} });
  });
  await page.goto("/school-admin");
  await page.getByLabel("School URN").fill("qa-school");
  await page.getByLabel("Login ID").fill("teacher");
  await page.getByLabel("Temporary password").fill("local-only-password");
  await page.getByLabel("Temporary password").press("Enter");
  await expect(page.getByText("Signed in as teacher / School admin", { exact: true })).toBeVisible();
  return { reads, writes };
}

async function chooseObjective(page: Page, kind = "assignment", year = 3, subject = "Mathematics") {
  const area = taskPanel(page, kind);
  await area.getByRole("button", { name: "Choose objective", exact: true }).click();
  await area.getByRole("combobox", { name: "Curriculum year", exact: true }).selectOption(String(year));
  await area.getByRole("combobox", { name: "Subject", exact: true }).selectOption(subject);
  await area.getByRole("button", { name: "Find objectives", exact: true }).click();
  await area.getByRole("button", { name: `Choose ${subject} Year ${year}: explain learning focus 1.`, exact: true }).click();
}

test("teacher browses bounded curriculum pages and can choose stretch independently by subject", async ({ page }) => {
  const { reads, writes } = await school(page);
  const area = taskPanel(page);
  await expect(area.getByRole("button", { name: "Choose objective", exact: true })).toBeDisabled();
  expect(reads).toHaveLength(0);
  await page.getByLabel("Selected school learner").selectOption("ava-y3");
  await area.getByRole("button", { name: "Choose objective", exact: true }).click();
  await expect(area.getByRole("combobox", { name: "Curriculum year", exact: true })).toHaveValue("3");
  await area.getByRole("combobox", { name: "Curriculum year", exact: true }).selectOption("4");
  await area.getByRole("combobox", { name: "Subject", exact: true }).selectOption("Mathematics");
  await area.getByRole("button", { name: "Find objectives", exact: true }).click();
  await expect(area.getByRole("button", { name: /^Choose Mathematics Year 4:/ })).toHaveCount(12);
  await area.getByRole("button", { name: "Next objectives", exact: true }).click();
  await expect(area.getByRole("button", { name: /^Choose Mathematics Year 4:/ })).toHaveCount(2);
  await expect(area.getByRole("status")).toBeFocused();
  await area.getByRole("button", { name: "Choose Mathematics Year 4: explain learning focus 13.", exact: true }).click();
  await expect(area.getByRole("button", { name: "Change objective", exact: true })).toBeFocused();
  await expect(area.getByText("Mathematics Year 4: explain learning focus 13.", { exact: true })).toBeVisible();
  await area.getByLabel("Teacher note/title").fill("Use the next fractions focus");
  await area.getByRole("button", { name: "Assign learning", exact: true }).click();
  await expect.poll(() => writes.length).toBe(1);
  expect(writes[0].body).toMatchObject({ student_external_ref: "ava-y3", objective_id: "mathematics-y4-13", activity_id: "", title: "Use the next fractions focus" });
  expect(writes[0].key).toBeTruthy();
  await expect(area.getByText("Learning priority saved.", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Selected school learner")).toHaveValue("ava-y3");
  await expect(panel(page, "Generate Subject Mock").getByRole("heading", { name: "Generate Subject Mock" })).toBeVisible();
  expect(reads.every(url => url.searchParams.get("limit") === "12")).toBe(true);
  expect(reads.some(url => url.searchParams.get("cursor") === "fixture-page-2")).toBe(true);
});

test("changing pupils clears all teacher drafts instead of attaching the previous child's notes", async ({ page }) => {
  await school(page);
  await page.getByLabel("Selected school learner").selectOption("ava-y3");
  await taskPanel(page).getByLabel("Teacher note/title").fill("Ava private assignment draft");
  await taskPanel(page, "evidence").getByLabel("Evidence note").fill("Ava private evidence draft");
  await taskPanel(page, "intervention").getByLabel("Identified learning need").fill("Ava private support draft");
  await page.getByLabel("Selected school learner").selectOption("ben-y5");
  await expect(taskPanel(page).getByLabel("Teacher note/title")).toHaveValue("");
  await expect(taskPanel(page, "evidence").getByLabel("Evidence note")).toHaveValue("");
  await expect(taskPanel(page, "intervention").getByLabel("Identified learning need")).toHaveValue("");
  await taskPanel(page).getByRole("button", { name: "Choose objective", exact: true }).click();
  await expect(taskPanel(page).getByRole("combobox", { name: "Curriculum year", exact: true })).toHaveValue("5");
});

test("all teacher task forms save selected curriculum identity and retain the selected pupil", async ({ page }) => {
  const { writes } = await school(page);
  await page.getByLabel("Selected school learner").selectOption("ava-y3");
  await chooseObjective(page, "evidence", 2, "English");
  await taskPanel(page, "evidence").getByLabel("Evidence note").fill("Explained the idea with a visual support.");
  await taskPanel(page, "evidence").getByRole("button", { name: "Save teacher evidence" }).click();
  await expect(taskPanel(page, "evidence").getByText("Teacher evidence saved.", { exact: true })).toBeVisible();
  expect(writes[0].body).toMatchObject({ student_external_ref: "ava-y3", objective_id: "english-y2-01", outcome: "developing", evidence_type: "observation" });
  await chooseObjective(page, "intervention", 3, "Science");
  const support = taskPanel(page, "intervention");
  await support.getByLabel("Plan title").fill("Explain observations");
  await support.getByLabel("Identified learning need").fill("Link observations to evidence");
  await support.getByLabel("Teaching strategy").fill("Model then ask for an explanation using chosen supports");
  await support.getByRole("button", { name: "Create intervention", exact: true }).click();
  await expect(support.getByText("Intervention plan saved.", { exact: true })).toBeVisible();
  expect(writes[1].body).toMatchObject({ student_external_ref: "ava-y3", objective_id: "science-y3-01", status: "active" });
  await expect(page.getByLabel("Selected school learner")).toHaveValue("ava-y3");
  await expect(page.getByLabel("Objective ID", { exact: true })).toHaveCount(0);
});

test("literal curriculum search and empty results never substitute invented objectives", async ({ page }) => {
  const { reads } = await school(page);
  await page.getByLabel("Selected school learner").selectOption("ava-y3");
  const area = taskPanel(page);
  await area.getByRole("button", { name: "Choose objective", exact: true }).click();
  await area.getByLabel("Search objectives", { exact: true }).fill("  50%_read  ");
  await area.getByRole("button", { name: "Find objectives", exact: true }).click();
  await expect(area.getByText("No matching objectives. Try another year, subject or search.", { exact: true })).toBeVisible();
  expect(reads.at(-1)?.searchParams.get("q")).toBe("50%_read");
  await expect(area.getByRole("button", { name: /^Choose .*Year/ })).toHaveCount(0);
  await expect(area.getByRole("button", { name: "Assign learning", exact: true })).toBeDisabled();
});

test("a failed or mismatched catalogue page removes stale choices and can be retried", async ({ page }) => {
  await school(page);
  await page.getByLabel("Selected school learner").selectOption("ava-y3");
  const area = taskPanel(page);
  await area.getByRole("button", { name: "Choose objective", exact: true }).click();
  await expect(area.getByRole("button", { name: /^Choose .*Year/ })).toHaveCount(12);
  await page.route("http://api.test/v1/school/curriculum/objectives?*", route => route.fulfill({ status: 503, json: { error: "Unavailable" } }));
  await area.getByRole("button", { name: "Next objectives", exact: true }).click();
  await expect(area.getByRole("alert")).toContainText("Objectives could not be loaded");
  await expect(area.getByRole("button", { name: /^Choose .*Year/ })).toHaveCount(0);
  await page.unroute("http://api.test/v1/school/curriculum/objectives?*");
  await area.getByRole("button", { name: "Retry objectives", exact: true }).click();
  await expect(area.getByRole("button", { name: /^Choose .*Year/ })).toHaveCount(12);
  await page.route("http://api.test/v1/school/curriculum/objectives?*", route => route.fulfill({ json: { year: 7, subject: "", query: "", limit: 12, release_id: "fixture-release", objectives: [catalogue[0]], has_more: false, next_cursor: "" } }));
  await area.getByRole("button", { name: "Next objectives", exact: true }).click();
  await expect(area.getByRole("alert")).toContainText("Objectives could not be loaded");
  await expect(area.getByRole("button", { name: /^Choose .*Year/ })).toHaveCount(0);
});

test("late catalogue replies cannot repopulate a different pupil's objective picker", async ({ page }) => {
  await school(page);
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  let started = false;
  await page.route("http://api.test/v1/school/curriculum/objectives?*", async route => {
    started = true;
    await gate;
    await route.fulfill({ json: { year: 3, subject: "", query: "", limit: 12, release_id: "fixture-release", objectives: catalogue.filter(item => item.year === 3).slice(0, 12), has_more: false, next_cursor: "" } }).catch(() => {});
  });
  await page.getByLabel("Selected school learner").selectOption("ava-y3");
  await taskPanel(page).getByRole("button", { name: "Choose objective", exact: true }).click();
  await expect.poll(() => started).toBe(true);
  await page.getByLabel("Selected school learner").selectOption("ben-y5");
  release();
  await expect(taskPanel(page).getByRole("button", { name: /^Choose .*Year 3:/ })).toHaveCount(0);
  await expect(taskPanel(page).getByRole("button", { name: "Choose objective", exact: true })).toBeVisible();
});

test("uncertain teacher saves reuse one idempotency key and do not clear the draft", async ({ page }) => {
  await school(page);
  const keys: string[] = [];
  await page.route("http://api.test/v1/school/evidence", async route => {
    if (route.request().method() !== "POST") return route.fulfill({ json: { teacher_evidence: [] } });
    keys.push(route.request().headers()["idempotency-key"]);
    if (keys.length === 1) return route.abort("connectionfailed");
    return route.fulfill({ status: 201, json: { ...route.request().postDataJSON(), id: "one-durable-record" } });
  });
  await page.getByLabel("Selected school learner").selectOption("ava-y3");
  await chooseObjective(page, "evidence");
  const area = taskPanel(page, "evidence");
  await area.getByLabel("Evidence note").fill("Keep this observation on an uncertain response.");
  await area.getByRole("button", { name: "Save teacher evidence", exact: true }).click();
  await expect(area.getByRole("alert")).toContainText("not confirm");
  await expect(area.getByLabel("Evidence note")).toHaveValue("Keep this observation on an uncertain response.");
  await area.getByRole("button", { name: "Save teacher evidence", exact: true }).click();
  await expect(area.getByText("Teacher evidence saved.", { exact: true })).toBeVisible();
  expect(keys).toHaveLength(2);
  expect(keys[0]).toBeTruthy();
  expect(keys[1]).toBe(keys[0]);
});

test("changing the objective clears any advanced activity override", async ({ page }) => {
  await school(page);
  await page.getByLabel("Selected school learner").selectOption("ava-y3");
  await chooseObjective(page);
  const area = taskPanel(page);
  await area.getByText("Advanced activity override", { exact: true }).click();
  await area.getByLabel("Activity ID (optional)").fill("activity-for-the-earlier-objective");
  await area.getByRole("button", { name: "Change objective", exact: true }).click();
  await area.getByRole("combobox", { name: "Curriculum year", exact: true }).selectOption("4");
  await area.getByRole("button", { name: "Find objectives", exact: true }).click();
  await area.getByRole("button", { name: "Choose Mathematics Year 4: explain learning focus 1.", exact: true }).click();
  await expect(area.getByLabel("Activity ID (optional)")).toHaveValue("");
});

test("a pending teacher save locks pupil choice and a late reply after logout stays discarded", async ({ page }) => {
  await school(page);
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  let started = false;
  await page.route("http://api.test/v1/school/evidence", async route => {
    if (route.request().method() !== "POST") return route.fulfill({ json: { teacher_evidence: [] } });
    started = true;
    await gate;
    await route.fulfill({ status: 201, json: { id: "late-record" } }).catch(() => {});
  });
  await page.getByLabel("Selected school learner").selectOption("ava-y3");
  await chooseObjective(page, "evidence");
  await taskPanel(page, "evidence").getByLabel("Evidence note").fill("One pupil's pending observation");
  await taskPanel(page, "evidence").getByRole("button", { name: "Save teacher evidence" }).click();
  await expect.poll(() => started).toBe(true);
  await expect(page.getByLabel("Selected school learner")).toBeDisabled();
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  release();
  await expect(page.getByRole("navigation", { name: "School workspace sections" })).toHaveCount(0);
  await expect(page.getByLabel("Evidence note")).toHaveCount(0);
  await expect(page.getByRole("status")).toHaveText("Signed out securely.");
});

test("a stalled catalogue request times out without leaving old choices and safely retries", async ({ page }) => {
  await page.clock.install();
  await school(page);
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  let started = false;
  await page.route("http://api.test/v1/school/curriculum/objectives?*", async route => { started = true; await gate; await route.abort().catch(() => {}); });
  await page.getByLabel("Selected school learner").selectOption("ava-y3");
  await taskPanel(page).getByRole("button", { name: "Choose objective", exact: true }).click();
  await expect.poll(() => started).toBe(true);
  await page.clock.fastForward(15_001);
  await expect(taskPanel(page).getByRole("alert")).toContainText("Objectives could not be loaded");
  release();
  await page.unroute("http://api.test/v1/school/curriculum/objectives?*");
  await taskPanel(page).getByRole("button", { name: "Retry objectives", exact: true }).click();
  await expect(taskPanel(page).getByRole("button", { name: /^Choose .*Year/ })).toHaveCount(12);
});

test("a stalled teacher save unlocks the draft and retries with the same request identity", async ({ page }) => {
  await page.clock.install();
  await school(page);
  const keys: string[] = [];
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route("http://api.test/v1/school/evidence", async route => {
    if (route.request().method() !== "POST") return route.fallback();
    keys.push(route.request().headers()["idempotency-key"]);
    if (keys.length === 1) { await gate; return route.abort().catch(() => {}); }
    return route.fulfill({ status: 201, json: { ...route.request().postDataJSON(), id: "recovered-save" } });
  });
  await page.getByLabel("Selected school learner").selectOption("ava-y3");
  await chooseObjective(page, "evidence");
  const area = taskPanel(page, "evidence");
  await area.getByLabel("Evidence note").fill("Keep this observation while the connection stalls.");
  await area.getByRole("button", { name: "Save teacher evidence", exact: true }).click();
  await expect.poll(() => keys.length).toBe(1);
  await page.clock.fastForward(15_001);
  try {
    await expect(area.getByRole("alert")).toContainText("not confirm");
    await expect(page.getByLabel("Selected school learner")).toBeEnabled();
    await expect(area.getByLabel("Evidence note")).toHaveValue("Keep this observation while the connection stalls.");
  } finally { release(); }
  await area.getByRole("button", { name: "Save teacher evidence", exact: true }).click();
  await expect(area.getByText("Teacher evidence saved.", { exact: true })).toBeVisible();
  expect(keys).toHaveLength(2);
  expect(keys[0]).toBeTruthy();
  expect(keys[1]).toBe(keys[0]);
});

test("a confirmed teacher save remains visible when refreshing its list fails", async ({ page }) => {
  const { writes } = await school(page);
  await page.getByLabel("Selected school learner").selectOption("ava-y3");
  await chooseObjective(page, "evidence");
  const area = taskPanel(page, "evidence");
  await area.getByLabel("Evidence note").fill("This record was successfully saved.");
  await taskPanel(page).getByLabel("Teacher note/title").fill("Preserve the other task's draft.");
  await page.route("http://api.test/v1/school/evidence?*", route => route.request().method() === "GET"
    ? route.fulfill({ status: 503, json: { error: "Temporarily unavailable" } }) : route.fallback());
  await area.getByRole("button", { name: "Save teacher evidence", exact: true }).click();
  await expect(area.getByRole("alert")).toContainText("Teacher evidence saved.");
  await expect(area.getByRole("alert")).toContainText("could not be refreshed");
  await expect(page.getByLabel("Selected school learner")).toHaveValue("ava-y3");
  await expect(taskPanel(page).getByLabel("Teacher note/title")).toHaveValue("Preserve the other task's draft.");
  await expect(area.getByLabel("Evidence note")).toHaveValue("");
  expect(writes.filter(item => item.path === "/v1/school/evidence")).toHaveLength(1);
  await page.unroute("http://api.test/v1/school/evidence?*");
  await area.getByRole("button", { name: "Refresh saved records", exact: true }).click();
  await expect(area.getByText("Teacher evidence saved.", { exact: true })).toBeVisible();
  await expect(area.getByRole("button", { name: "Refresh saved records", exact: true })).toHaveCount(0);
  expect(writes.filter(item => item.path === "/v1/school/evidence")).toHaveLength(1);
});

test("a denied post-save refresh clears the private school workspace", async ({ page }) => {
  await school(page);
  await page.getByLabel("Selected school learner").selectOption("ava-y3");
  await chooseObjective(page, "evidence");
  const area = taskPanel(page, "evidence");
  await area.getByLabel("Evidence note").fill("Only visible to the authorised school.");
  await page.route("http://api.test/v1/school/evidence?*", route => route.request().method() === "GET"
    ? route.fulfill({ status: 403, json: { error: "School access revoked" } }) : route.fallback());
  await area.getByRole("button", { name: "Save teacher evidence", exact: true }).click();
  await expect(page.getByRole("navigation", { name: "School workspace sections" })).toHaveCount(0);
  await expect(page.getByLabel("Evidence note")).toHaveCount(0);
  await expect(page.getByRole("form", { name: "School sign in", exact: true })).toBeVisible();
});

test("objective controls reflow at 320 pixels and remain accessible", async ({ page }, info) => {
  await page.setViewportSize({ width: 320, height: 900 });
  await school(page);
  await page.getByLabel("Selected school learner").selectOption("ava-y3");
  const area = taskPanel(page);
  await area.getByRole("button", { name: "Choose objective", exact: true }).click();
  await expect(area.getByRole("button", { name: /^Choose .*Year/ })).toHaveCount(12);
  await area.getByLabel("Search objectives", { exact: true }).scrollIntoViewIfNeeded();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  const result = await new AxeBuilder({ page }).include("#school-learning").withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
  expect(result.violations.filter(item => item.impact === "critical" || item.impact === "serious")).toEqual([]);
  await page.screenshot({ path: info.outputPath("teacher-objectives-320.png"), scale: "css", animations: "disabled" });
});
