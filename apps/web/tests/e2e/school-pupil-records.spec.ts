import { expect, test, type Page, type Request } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { responseSettled } from "./response-settled";

const students = [{ external_ref: "ava-y3", display_name: "Ava", year_group: 3 }, { external_ref: "ben-y5", display_name: "Ben", year_group: 5 }];
const listKeys: Record<string, string> = { assignments: "assignments", evidence: "teacher_evidence", interventions: "interventions", "intervention-reviews": "intervention_reviews" };
const panel = (page: Page, title: string) => page.locator("section").filter({ has: page.getByRole("heading", { name: title, exact: true }) }).last();
const reviewPanel = (page: Page) => panel(page, "Review Intervention Evidence");
const lists = /http:\/\/api\.test\/v1\/school\/(assignments|evidence|interventions|intervention-reviews)(\?.*)?$/;
function records(kind: string, studentId = "") {
  return students.filter(s => !studentId || s.external_ref === studentId).map(s => ({
    id: `${kind}-${s.external_ref}`, student_external_ref: s.external_ref, student_display_name: s.display_name,
    intervention_id: `interventions-${s.external_ref}`, objective_id: "maths-place-value", status: "active", priority: 70,
    title: `${s.display_name} ${kind} only`, need: `${s.display_name} learning need`, strategy: "Model, practise, explain",
    evidence_type: "observation", outcome: "monitor", note: `${s.display_name} evidence only`, evidence_note: `${s.display_name} reassessment only`,
  }));
}
async function school(page: Page) {
  const reads: URL[] = [];
  const writes: Array<{ path: string; key: string; body: unknown }> = [];
  await page.route("http://api.test/**", async route => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith("school-login")) return route.fulfill({ json: { session: { token: "school-records-fixture", role: "school_admin", expires_at: "2099-01-01T00:00:00Z" } } });
    if (url.pathname === "/v1/school/config") return route.fulfill({ json: { school: { urn: "qa-school", name: "QA school" }, current_user: { login_id: "teacher", role: "school_admin" }, classes: [{ id: "oak", name: "Oak", year_group: 3, students }], groups: [] } });
    const kind = url.pathname.split("/").at(-1)!;
    if (route.request().method() === "GET" && listKeys[kind]) {
      reads.push(url);
      return route.fulfill({ json: { [listKeys[kind]]: records(kind, url.searchParams.get("studentId") || "") } });
    }
    if (route.request().method() === "POST" && url.pathname.endsWith("/reviews")) {
      writes.push({ path: url.pathname, key: route.request().headers()["idempotency-key"], body: route.request().postDataJSON() });
      return route.fulfill({ status: 201, json: { id: "saved-review", intervention_id: url.pathname.split("/").at(-2) } });
    }
    return route.fulfill({ json: {} });
  });
  await page.goto("/school-admin");
  await page.getByLabel("School URN").fill("qa-school");
  await page.getByLabel("Login ID").fill("teacher");
  await page.getByLabel("Temporary password").fill("local-fixture-only");
  await expect(page.getByRole("button", { name: "Sign in", exact: true })).toBeEnabled();
  const signedIn = page.waitForResponse(response => new URL(response.url()).pathname === "/v1/auth/school-login" && response.request().method() === "POST");
  const loaded = page.waitForResponse(response => new URL(response.url()).pathname === "/v1/school/config");
  await page.getByLabel("Temporary password").press("Enter");
  expect((await signedIn).status()).toBe(200);
  await responseSettled(page, loaded);
  expect((await loaded).status()).toBe(200);
  await expect(page.getByText("Signed in as teacher / School admin", { exact: true })).toBeVisible();
  return { reads, writes };
}
async function draftReview(page: Page) {
  await page.getByLabel("Selected school learner").selectOption("ava-y3");
  await panel(page, "Active Interventions").getByRole("button", { name: "Review evidence", exact: true }).first().click();
  await reviewPanel(page).getByLabel("Review outcome").selectOption("complete");
  await reviewPanel(page).getByLabel("Reassessment evidence").fill("Ava can explain the method with her chosen access supports.");
}

test("school records are fetched only for the selected pupil and reassessment drafts never cross pupils", async ({ page }) => {
  const { reads } = await school(page);
  expect(reads).toHaveLength(0);
  await draftReview(page);
  await expect(panel(page, "Moderated Teacher Evidence")).toContainText("Ava evidence only");
  await expect(panel(page, "Intervention Reassessment History")).toContainText("Ava reassessment only");
  await expect(panel(page, "Active Learning Assignments")).not.toContainText("Ben assignments only");
  await page.getByLabel("Selected school learner").selectOption("ben-y5");
  await expect(reviewPanel(page).getByLabel("Reassessment evidence")).toHaveValue("");
  await expect(reviewPanel(page).getByRole("combobox", { name: "Intervention", exact: true })).toHaveValue("");
  await expect(reviewPanel(page).getByRole("button", { name: "Save reassessment" })).toBeDisabled();
  await expect(panel(page, "Active Learning Assignments")).toContainText("Ben assignments only");
  await expect(panel(page, "Moderated Teacher Evidence")).not.toContainText("Ava evidence only");
  await expect(panel(page, "Intervention Reassessment History")).not.toContainText("Ava reassessment only");
  await expect.poll(() => reads.length).toBe(8);
  expect(reads.every(url => students.some(s => s.external_ref === url.searchParams.get("studentId")))).toBe(true);
});

test("late pupil records cannot overwrite the newly selected child's records", async ({ page }) => {
  await school(page);
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  let started = 0;
  let finished = 0;
  const cancelled = new Set<Request>();
  page.on("requestfailed", request => {
    const url = new URL(request.url());
    if (lists.test(url.href) && url.searchParams.get("studentId") === "ava-y3") cancelled.add(request);
  });
  await page.route(lists, async route => {
    const url = new URL(route.request().url());
    if (url.searchParams.get("studentId") !== "ava-y3") return route.fallback();
    started++;
    await gate;
    const kind = url.pathname.split("/").at(-1)!;
    try {
      await route.fulfill({ json: { [listKeys[kind]]: records(kind, "ava-y3") } });
    } catch {
      // Fulfilment of a known cancelled request may be rejected by Playwright.
      expect(route.request().failure()?.errorText).toContain("ERR_ABORTED");
    } finally { finished++; }
  });
  await page.getByLabel("Selected school learner").selectOption("ava-y3");
  try {
    await expect.poll(() => started).toBe(4);
    await page.getByLabel("Selected school learner").selectOption("ben-y5");
    await expect.poll(() => cancelled.size).toBe(4);
    for (const request of cancelled) expect(request.failure()?.errorText).toContain("ERR_ABORTED");
    await expect(panel(page, "Moderated Teacher Evidence")).toContainText("Ben evidence only");
  } finally { release(); }
  await expect.poll(() => finished).toBe(4);
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  await expect(panel(page, "Active Learning Assignments")).toContainText("Ben assignments only");
  await expect(panel(page, "Active Learning Assignments")).not.toContainText("Ava assignments only");
  await expect(panel(page, "Moderated Teacher Evidence")).not.toContainText("Ava evidence only");
  await expect(panel(page, "Active Interventions")).toContainText("Ben interventions only");
  await expect(panel(page, "Active Interventions")).not.toContainText("Ava interventions only");
  await expect(panel(page, "Intervention Reassessment History")).toContainText("Ben reassessment only");
  await expect(panel(page, "Intervention Reassessment History")).not.toContainText("Ava reassessment only");
  await expect(reviewPanel(page).getByRole("option", { name: /Ava:/ })).toHaveCount(0);
});

test("uncertain reassessment saves retain one request key and the pupil's draft", async ({ page }) => {
  await school(page);
  const keys: string[] = [];
  await page.route("http://api.test/v1/school/interventions/*/reviews", route => {
    keys.push(route.request().headers()["idempotency-key"]);
    return keys.length === 1 ? route.abort("connectionfailed") : route.fulfill({ status: 201, json: { id: "one-review" } });
  });
  await draftReview(page);
  await reviewPanel(page).getByRole("button", { name: "Save reassessment" }).click();
  await expect(reviewPanel(page).getByRole("alert")).toContainText("not confirm");
  await expect(reviewPanel(page).getByLabel("Reassessment evidence")).toHaveValue("Ava can explain the method with her chosen access supports.");
  await reviewPanel(page).getByRole("button", { name: "Save reassessment" }).click();
  await expect(reviewPanel(page).getByText("Intervention reassessment saved.", { exact: true })).toBeVisible();
  expect(keys).toHaveLength(2);
  expect(keys[0]).toBeTruthy();
  expect(keys[1]).toBe(keys[0]);
  await expect(page.getByLabel("Selected school learner")).toHaveValue("ava-y3");
});

test("confirmed reassessment survives refresh failure and retries reads without repeating the save", async ({ page }) => {
  const { writes } = await school(page);
  await draftReview(page);
  await page.getByLabel("Teacher note/title").fill("Keep the assignment draft");
  await page.route(lists, route => route.request().method() === "GET" ? route.fulfill({ status: 503, json: { error: "Unavailable" } }) : route.fallback());
  await reviewPanel(page).getByRole("button", { name: "Save reassessment" }).click();
  await expect(reviewPanel(page).getByRole("alert")).toContainText("Intervention reassessment saved.");
  await expect(reviewPanel(page).getByLabel("Reassessment evidence")).toHaveValue("");
  await expect(page.getByLabel("Teacher note/title")).toHaveValue("Keep the assignment draft");
  await page.unroute(lists);
  await reviewPanel(page).getByRole("button", { name: "Refresh saved records" }).click();
  await expect(reviewPanel(page).getByText("Intervention reassessment saved.", { exact: true })).toBeVisible();
  expect(writes).toHaveLength(1);
});

test("pending reassessment locks pupil choice and logout discards its late completion", async ({ page }) => {
  const { reads } = await school(page);
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  let started = false;
  await page.route("http://api.test/v1/school/interventions/*/reviews", async route => {
    started = true; await gate;
    await route.fulfill({ status: 201, json: { id: "late-review" } });
  });
  await draftReview(page);
  const completed = page.waitForResponse(response => response.url().endsWith("/interventions/interventions-ava-y3/reviews") && response.request().method() === "POST");
  await reviewPanel(page).getByRole("button", { name: "Save reassessment" }).click();
  let readsAtLogout = 0;
  try {
    await expect.poll(() => started).toBe(true);
    await expect(page.getByLabel("Selected school learner")).toBeDisabled();
    await page.getByRole("button", { name: "Sign out", exact: true }).click();
    readsAtLogout = reads.length;
  } finally { release(); }
  await responseSettled(page, completed);
  expect(reads.length).toBe(readsAtLogout);
  await expect(page.getByRole("navigation", { name: "School workspace sections" })).toHaveCount(0);
  await expect(page.getByLabel("Reassessment evidence")).toHaveCount(0);
  await expect(page.getByRole("status")).toHaveText("Signed out securely.");
});

test("a mismatched pupil response fails closed and a GET-only retry restores the correct records", async ({ page }) => {
  const { writes } = await school(page);
  await page.route("http://api.test/v1/school/evidence?*", route => route.fulfill({ json: { teacher_evidence: records("evidence", "ben-y5") } }));
  await page.getByLabel("Selected school learner").selectOption("ava-y3");
  const area = panel(page, "Moderated Teacher Evidence");
  await expect(area.getByRole("alert")).toContainText("could not be loaded");
  await expect(area).not.toContainText("Ben evidence only");
  await expect(panel(page, "Active Learning Assignments")).toContainText("Ava assignments only");
  await page.getByLabel("Evidence note", { exact: true }).fill("Keep this new observation");
  await page.unroute("http://api.test/v1/school/evidence?*");
  await area.getByRole("button", { name: "Retry pupil records" }).click();
  await expect(area).toContainText("Ava evidence only");
  await expect(page.getByRole("textbox", { name: "Evidence note", exact: true })).toHaveValue("Keep this new observation");
  expect(writes).toHaveLength(0);
});

test("changing the intervention clears the prior plan's reassessment notes", async ({ page }) => {
  await school(page);
  await page.route("http://api.test/v1/school/interventions?*", route => route.fulfill({ json: { interventions: [records("interventions", "ava-y3")[0], { ...records("interventions", "ava-y3")[0], id: "another-plan", title: "Another plan" }] } }));
  await draftReview(page);
  await reviewPanel(page).getByRole("combobox", { name: "Intervention", exact: true }).selectOption("another-plan");
  await expect(reviewPanel(page).getByLabel("Reassessment evidence")).toHaveValue("");
  await expect(reviewPanel(page).getByRole("button", { name: "Save reassessment" })).toBeDisabled();
});

test("a changed school session clears loaded private records and drafts without another request", async ({ page }) => {
  await school(page);
  await draftReview(page);
  await expect(panel(page, "Moderated Teacher Evidence")).toContainText("Ava evidence only");
  await page.evaluate(() => {
    sessionStorage.setItem("nexuslearn_account_session", "another-school-token");
    window.dispatchEvent(new Event("nexuslearn-account-session-changed"));
  });
  await expect(page.getByRole("navigation", { name: "School workspace sections" })).toHaveCount(0);
  await expect(page.getByText("Ava evidence only")).toHaveCount(0);
  await expect(page.getByLabel("Reassessment evidence")).toHaveCount(0);
});

test("pupil evidence beyond the first twelve records remains reachable with keyboard pagination", async ({ page }, info) => {
  await page.setViewportSize({ width: 320, height: 900 });
  await school(page);
  await page.route("http://api.test/v1/school/evidence?*", route => route.fulfill({ json: { teacher_evidence: Array.from({ length: 25 }, (_, index) => ({ ...records("evidence", "ava-y3")[0], id: `evidence-${index}`, note: `Observation number ${index + 1} for Ava.` })) } }));
  await page.getByLabel("Selected school learner").selectOption("ava-y3");
  const area = panel(page, "Moderated Teacher Evidence");
  await expect(area).toContainText("Observation number 12 for Ava.");
  await expect(area).not.toContainText("Observation number 13 for Ava.");
  await area.getByRole("button", { name: "Next records" }).focus();
  await page.keyboard.press("Enter");
  await expect(area).toContainText("Observation number 13 for Ava.");
  await expect(area.getByRole("status")).toBeFocused();
  await area.getByRole("button", { name: "Next records" }).click();
  await expect(area).toContainText("Observation number 25 for Ava.");
  await expect(area.getByRole("button", { name: "Next records" })).toBeDisabled();
  await area.getByRole("button", { name: "Previous records" }).click();
  await expect(area).toContainText("Observation number 13 for Ava.");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  const audit = await new AxeBuilder({ page }).include("#school-learning").include("#school-support").withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
  expect(audit.violations.filter(item => item.impact === "critical" || item.impact === "serious")).toEqual([]);
  await area.getByRole("status").scrollIntoViewIfNeeded();
  await page.screenshot({ path: info.outputPath("pupil-records-320.png"), scale: "css", animations: "disabled" });
});
