import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { responseSettled } from "./response-settled";

const first = { external_ref: "pupil-first", display_name: "First Pupil", year_group: 3 };
const later = { external_ref: "pupil-later", display_name: "Later Pupil", year_group: 4 };
const oak = { id: "oak", name: "Oak", year_group: 3, student_count: 25 };
const willow = { id: "willow", name: "Willow", year_group: 4, student_count: 28 };
const group = { id: "fluency", class_id: "oak", name: "Reading fluency", purpose: "fluency", student_count: 6 };
const overview = () => ({
  school: { urn: "directory-school", name: "Directory school" },
  current_user: { login_id: "teacher", role: "school_admin", school_urn: "directory-school" },
  classes: [oak], groups: [group], students: [first],
  directory: { version: 1, counts: { classes: 43, groups: 81, students: 1204 }, classes_next_cursor: "classes-two", groups_next_cursor: "groups-two", students_next_cursor: "students-two" },
});
const pupilReport = (ref: string) => ({ student_id: ref, year_group: 4, working_year: 4, stretch_year: 0, stretch_allowed: false, summary: `Evidence belongs to ${ref}`, subjects: [], strengths: [], practice: [], mock_assessments: [], attempt_evidence: [] });
const directoryPage = (kind: string, items: unknown[], next = "") => ({ school_urn: "directory-school", kind, items, next_cursor: next });
const controls = (page: Page, kind: string) => page.getByRole("search", { name: `${kind} directory`, exact: true });

async function holdGroupClass(page: Page) {
  let release!: () => void;
  let arrived!: () => void;
  const held = new Promise<void>(resolve => { release = resolve; });
  const seen = new Promise<void>(resolve => { arrived = resolve; });
  await page.route("http://api.test/v1/school/directory?*", async route => {
    const url = new URL(route.request().url());
    if (url.searchParams.get("kind") === "groups") return route.fulfill({ json: directoryPage("groups", [{ ...group, id: "future", name: "Later reading", class_id: "willow" }]) });
    if (url.searchParams.get("ref") === "willow") { arrived(); await held; return route.fulfill({ json: directoryPage("classes", [willow]) }).catch(() => {}); }
    return route.fallback();
  });
  await controls(page, "Groups").getByRole("button", { name: "Next page" }).click();
  await page.getByRole("button", { name: /Later reading/ }).click();
  await seen;
  return release;
}

test("review regression: a newly saved off-page class remains visibly selected", async ({ page }) => {
  await school(page);
  await page.route("http://api.test/v1/school/classes/*", route => route.fulfill({ json: willow }));
  await page.getByLabel("Class name", { exact: true }).fill("Willow");
  await page.getByRole("button", { name: "Save class", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText("School workspace loaded.");
  await expect(page.getByLabel("Enrol in class")).toHaveValue("willow");
  await expect(page.getByLabel("Enrol in class")).toContainText("Willow (Year 4)");
  await expect(page.getByLabel("Login card class")).toContainText("Willow (Year 4)");
});

test("review regression: typing group details does not cancel its parent-class lookup", async ({ page }) => {
  await school(page);
  const release = await holdGroupClass(page);
  try {
    await page.getByLabel("Group name", { exact: true }).fill("Updated reading");
    release();
    await expect(page.getByRole("button", { name: "Save group", exact: true })).toBeEnabled();
    await expect(page.getByLabel("Group name", { exact: true })).toHaveValue("Updated reading");
    await expect(page.getByLabel("Group ID", { exact: true })).toHaveValue("future");
  } finally { release(); }
});

test("review regression: a class lookup preserves newer enrolment and card pins", async ({ page }) => {
  await school(page);
  const release = await holdGroupClass(page);
  try {
    await page.getByLabel("Enrol in class").selectOption("oak");
    await page.getByLabel("Login card class").selectOption("oak");
    await controls(page, "Classes").getByRole("button", { name: "Next page" }).click();
    await expect(page.getByLabel("Enrol in class")).toHaveValue("oak");
    const found = page.waitForResponse(response => response.url().includes("ref=willow"));
    release();
    await responseSettled(page, found);
    await expect(page.getByLabel("Enrol in class")).toHaveValue("oak");
    await expect(page.getByLabel("Login card class")).toHaveValue("oak");
  } finally { release(); }
});

async function school(page: Page, classYear = 3) {
  const reads: URL[] = [];
  const configReads: URL[] = [];
  let pupilPresent = true;
  await page.route("http://api.test/**", async route => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith("school-login")) return route.fulfill({ json: { session: { token: "directory-session", role: "school_admin", expires_at: "2099-01-01T00:00:00Z" } } });
    if (url.pathname === "/v1/school/config") { configReads.push(url); return route.fulfill({ json: { ...overview(), classes: [{ ...oak, year_group: classYear }] } }); }
    if (url.pathname === "/v1/school/directory") {
      reads.push(url);
      expect(route.request().headers().authorization).toBe("Bearer directory-session");
      const kind = url.searchParams.get("kind")!;
      const ref = url.searchParams.get("ref");
      const search = url.searchParams.get("search");
      const next = url.searchParams.has("cursor");
      const items = ref ? pupilPresent && ref === later.external_ref ? [later] : []
        : search === "missing" ? [] : kind === "classes" ? [next || search ? willow : oak]
          : kind === "groups" ? [{ ...group, id: next ? "challenge" : "fluency", name: next ? "Maths challenge" : "Reading fluency" }]
            : [next || search ? later : first];
      return route.fulfill({ json: directoryPage(kind, items, next || search || ref ? "" : `${kind}-two`) });
    }
    if (url.pathname.endsWith("/progress")) return route.fulfill({ json: pupilReport(url.pathname.split("/").at(-2)!) });
    if (url.pathname.includes("/credentials")) return route.fulfill({ json: { class_id: url.pathname.split("/").at(-2), student_credentials: [], limit: 12, has_more: false, next_cursor: "" } });
    return route.fulfill({ json: { assignments: [], teacher_evidence: [], interventions: [], intervention_reviews: [], mock_assessments: [] } });
  });
  await page.goto("/school-admin");
  await page.getByLabel("School URN").fill("directory-school");
  await page.getByLabel("Login ID").fill("teacher");
  await page.getByLabel("Temporary password").fill("fixture-password");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByText("Signed in as teacher / School admin", { exact: true })).toBeVisible();
  return { reads, configReads, removePupil() { pupilPresent = false; } };
}

test("legacy classes with no recorded year remain manageable without inventing a year", async ({ page }) => {
  await school(page, 0);
  await expect(page.getByLabel("Enrol in class")).toContainText("Oak (Year not set)");
  await expect(page.getByLabel("Login card class")).toContainText("Oak (Year not set)");
  await page.getByLabel("Login card class").selectOption("oak");
  await expect(page.getByLabel("Login card class")).toHaveValue("oak");
});

test("bounded school overview shows true totals and later directory pages", async ({ page }) => {
  const { reads, configReads } = await school(page);
  expect(configReads[0].searchParams.get("view")).toBe("directory");
  await expect(page.getByText("1204", { exact: true })).toBeVisible();
  await expect(page.getByText("43", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Selected school learner")).toContainText("First Pupil");
  await controls(page, "Pupils").getByRole("button", { name: "Next page" }).click();
  await expect(page.getByLabel("Selected school learner")).toContainText("Later Pupil");
  await expect(page.getByLabel("Selected school learner")).not.toContainText("First Pupil");
  await controls(page, "Classes").getByRole("button", { name: "Next page" }).click();
  await expect(page.getByLabel("Enrol in class")).toContainText("Willow");
  await expect(page.getByLabel("Login card class")).toContainText("Willow");
  await controls(page, "Groups").getByRole("button", { name: "Next page" }).click();
  await expect(page.getByRole("button", { name: /Maths challenge/ })).toBeVisible();
  expect(reads.filter(url => !url.searchParams.has("ref")).every(url => url.searchParams.get("limit") === "20")).toBe(true);
});

test("search and paging preserve selected pupil evidence and selected login class", async ({ page }) => {
  await school(page);
  await page.getByLabel("Login card class").selectOption("oak");
  await controls(page, "Classes").getByRole("button", { name: "Next page" }).click();
  await expect(page.getByLabel("Login card class")).toHaveValue("oak");
  await page.getByLabel("Selected school learner").selectOption(first.external_ref);
  await page.getByRole("button", { name: "Load progress", exact: true }).click();
  await expect(page.getByText(`Evidence belongs to ${first.external_ref}`, { exact: true })).toBeVisible();
  await controls(page, "Pupils").getByRole("textbox").fill("Later");
  await controls(page, "Pupils").getByRole("button", { name: "Search", exact: true }).click();
  await expect(page.getByLabel("Selected school learner")).toContainText("Later Pupil");
  await expect(page.getByLabel("Selected school learner")).toHaveValue(first.external_ref);
  await expect(page.getByText(`Evidence belongs to ${first.external_ref}`, { exact: true })).toBeVisible();
  await page.getByLabel("Selected school learner").selectOption(later.external_ref);
  await expect(page.getByText(`Evidence belongs to ${first.external_ref}`, { exact: true })).toHaveCount(0);
});

test("a replaced search aborts the old page and cannot restore its results", async ({ page }) => {
  await school(page);
  let release!: () => void;
  let arrived!: () => void;
  const held = new Promise<void>(resolve => { release = resolve; });
  const seen = new Promise<void>(resolve => { arrived = resolve; });
  await page.route("http://api.test/v1/school/directory?*", async route => {
    const url = new URL(route.request().url());
    if (url.searchParams.get("search") !== "old") return route.fallback();
    arrived(); await held;
    await route.fulfill({ json: directoryPage("students", [{ ...first, display_name: "Obsolete Pupil" }]) }).catch(() => {});
  });
  const pupils = controls(page, "Pupils");
  const cancelled = page.waitForEvent("requestfailed", req => req.url().includes("search=old"));
  try {
    await pupils.getByRole("textbox").fill("old");
    await pupils.getByRole("button", { name: "Search", exact: true }).click();
    await seen;
    await pupils.getByRole("textbox").fill("Later");
    await pupils.getByRole("button", { name: "Search", exact: true }).click();
    await cancelled;
    await expect(page.getByLabel("Selected school learner")).toContainText("Later Pupil");
  } finally { release(); }
  await expect(page.getByLabel("Selected school learner")).not.toContainText("Obsolete Pupil");
});

test("refresh revalidates an off-page selected pupil and clears it if access is gone", async ({ page }) => {
  const h = await school(page);
  await controls(page, "Pupils").getByRole("button", { name: "Next page" }).click();
  await page.getByLabel("Selected school learner").selectOption(later.external_ref);
  await page.getByRole("button", { name: "Load progress", exact: true }).click();
  await page.getByLabel("Class name", { exact: true }).fill("New class");
  await page.getByRole("button", { name: "Save class", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText("School workspace loaded.");
  await expect(page.getByLabel("Selected school learner")).toHaveValue(later.external_ref);
  expect(h.reads.some(url => url.searchParams.get("ref") === later.external_ref)).toBe(true);
  h.removePupil();
  await page.getByLabel("Class name", { exact: true }).fill("Another class");
  await page.getByRole("button", { name: "Save class", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText("School workspace loaded.");
  await expect(page.getByLabel("Selected school learner")).toHaveValue("");
  await expect(page.getByText(`Evidence belongs to ${later.external_ref}`, { exact: true })).toHaveCount(0);
});

test("failed directory reads can retry, empty searches stay honest, and sign-out clears late reads", async ({ page }) => {
  await school(page);
  const pupils = controls(page, "Pupils");
  let fail = true;
  await page.route("http://api.test/v1/school/directory?*", route => fail ? route.fulfill({ status: 503, json: { error: "Directory temporarily unavailable" } }) : route.fallback());
  await pupils.getByRole("button", { name: "Next page" }).click();
  await expect(pupils).toContainText("Directory temporarily unavailable");
  fail = false;
  await pupils.getByRole("button", { name: "Retry", exact: true }).click();
  await expect(page.getByLabel("Selected school learner")).toContainText("Later Pupil");
  await pupils.getByRole("textbox").fill("missing");
  await pupils.getByRole("button", { name: "Search", exact: true }).click();
  await expect(pupils).toContainText("No matching results");
  await expect(page.getByText("1204", { exact: true })).toBeVisible();
  let release!: () => void;
  let arrived!: () => void;
  const held = new Promise<void>(resolve => { release = resolve; });
  const seen = new Promise<void>(resolve => { arrived = resolve; });
  await page.route("http://api.test/v1/school/directory?*", async route => { arrived(); await held; await route.fulfill({ json: directoryPage("students", [later]) }).catch(() => {}); });
  const cancelled = page.waitForEvent("requestfailed", req => req.url().includes("search=Later"));
  try {
    await pupils.getByRole("textbox").fill("Later");
    await pupils.getByRole("button", { name: "Search", exact: true }).click();
    await seen;
    await page.getByRole("button", { name: "Sign out", exact: true }).click();
    await cancelled;
  } finally { release(); }
  await expect(page.getByRole("form", { name: "School sign in" })).toBeVisible();
  await expect(page.getByLabel("Selected school learner")).toHaveCount(0);
  await expect(page.getByText("Later Pupil", { exact: true })).toHaveCount(0);
});

test("foreign directory response is rejected and narrow controls remain accessible", async ({ page }) => {
  await school(page);
  await page.route("http://api.test/v1/school/directory?*", route => route.fulfill({ json: { ...directoryPage("students", [later]), school_urn: "another-school" } }));
  await controls(page, "Pupils").getByRole("button", { name: "Next page" }).click();
  await expect(controls(page, "Pupils")).toContainText("could not be verified");
  await expect(page.getByLabel("Selected school learner")).not.toContainText("Later Pupil");
  await page.setViewportSize({ width: 320, height: 900 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  const result = await new AxeBuilder({ page }).include('form[role="search"]').withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
  expect(result.violations.filter(v => v.impact === "serious" || v.impact === "critical")).toEqual([]);
});

test("a late group class lookup cannot replace the newly chosen teaching group", async ({ page }) => {
  await school(page);
  let release!: () => void;
  let arrived!: () => void;
  const held = new Promise<void>(resolve => { release = resolve; });
  const seen = new Promise<void>(resolve => { arrived = resolve; });
  await page.route("http://api.test/v1/school/directory?*", async route => {
    const url = new URL(route.request().url());
    if (url.searchParams.get("kind") === "groups") return route.fulfill({ json: directoryPage("groups", [{ ...group, id: "future", name: "Later reading", class_id: "willow" }, group]) });
    if (url.searchParams.get("ref") === "willow") { arrived(); await held; return route.fulfill({ json: directoryPage("classes", [willow]) }).catch(() => {}); }
    return route.fallback();
  });
  await controls(page, "Groups").getByRole("button", { name: "Next page" }).click();
  const cancelled = page.waitForEvent("requestfailed", req => req.url().includes("ref=willow"));
  try {
    await page.getByRole("button", { name: /Later reading/ }).click();
    await seen;
    await page.getByRole("button", { name: /Reading fluency/ }).click();
    await cancelled;
    await expect(page.getByLabel("Group ID", { exact: true })).toHaveValue("fluency");
    release();
    await expect(page.getByLabel("Group ID", { exact: true })).toHaveValue("fluency");
  } finally { release(); }
});
