import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

async function seedAccountSession(page: Page, role: "parent" | "school_admin") {
  await page.addInitScript((accountRole) => {
    sessionStorage.setItem("nexuslearn_account_session", `${accountRole}-workspace-token`);
    sessionStorage.setItem("nexuslearn_account_role", accountRole);
    sessionStorage.setItem("nexuslearn_account_session_expires", "2099-01-01T00:00:00Z");
  }, role);
}

const linkedChild = (externalRef: string, displayName: string, yearGroup: number) => ({
  student: { external_ref: externalRef, display_name: displayName, year_group: yearGroup },
  credential: { student_external_ref: externalRef, login_code: "123456", picture_password: ["star", "book", "sun"] },
  engagement: {
    student_external_ref: externalRef,
    declared_support_needs: externalRef === "ava-y3" ? ["dyslexia"] : [],
    learning_approaches: ["predictable_routine"],
    celebration_intensity: "balanced",
    audio_support: externalRef === "ava-y3",
    reading_support: externalRef === "ava-y3",
    session_length: "standard",
    sensory_load: "balanced",
    attention_support: "standard",
    communication_support: "standard",
    processing_support: "standard",
    confidence_support: "balanced",
    companion_style: "friendly",
    reward_style: "world_building",
    interests: [],
    notes: "",
  },
});

const parentPortal = {
  parent: { email: "parent@example.test", display_name: "Ava's parent", login_id: "ava-parent" },
  children: [linkedChild("ava-y3", "Ava", 3), linkedChild("ben-y5", "Ben", 5)],
};

test("family workspace mounts only account and invitation controls before authentication", async ({ page }) => {
  await page.goto("/family?invitation=test-invitation");

  await expect(page.getByRole("heading", { name: "Join your child's learning workspace" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Parent access" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Family workspace sections" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Children", exact: true })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Adaptive child profile" })).toHaveCount(0);
  await expect(page.getByText(/SEND\/support needs/)).toHaveCount(0);
  await expect(page.getByRole("status")).toContainText(/invitation found|create or load a family workspace/i);

  const accessibility = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
  expect(accessibility.violations.filter((item) => item.impact === "critical" || item.impact === "serious")).toEqual([]);
});

test("family workspace mounts linked children and SEND controls only after a valid portal loads", async ({ page }) => {
  await page.route("http://api.test/**", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === "/v1/auth/parent-login") {
      await route.fulfill({ contentType: "application/json", body: JSON.stringify({ parent: parentPortal.parent, session: { token: "parent-token", role: "parent", expires_at: "2099-01-01T00:00:00Z" } }) });
      return;
    }
    if (url.pathname === "/v1/parent/config") {
      await route.fulfill({ contentType: "application/json", body: JSON.stringify(parentPortal) });
      return;
    }
    if (/^\/v1\/parent\/children\/[^/]+\/evidence$/.test(url.pathname)) {
      const childRef = url.pathname.split("/")[4];
      await route.fulfill({ contentType: "application/json", body: JSON.stringify({ child: parentPortal.children.find((item) => item.student.external_ref === childRef), mastery: [], attempts: [], summary: {}, progress: null }) });
      return;
    }
    await route.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ error: `Unhandled ${url.pathname}` }) });
  });

  await page.goto("/family");
  await page.getByLabel("Login ID").fill("ava-parent");
  await page.getByLabel("Password").last().fill("temporary-password");
  await page.getByRole("button", { name: "Sign in" }).click();

  const navigation = page.getByRole("navigation", { name: "Family workspace sections" });
  await expect(navigation.getByRole("link", { name: "Children & progress" })).toHaveAttribute("href", "#family-children");
  await expect(page.getByRole("heading", { name: "Children", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Adaptive child profile" })).toBeVisible();
  await expect(page.getByText("Ava", { exact: true })).toBeVisible();
  await expect(page.getByText(/SEND\/support needs/)).toBeVisible();
});

test("parent workspace canonicalises linked-child scope across selection, refresh and browser history", async ({ page }) => {
  const evidenceRequests: string[] = [];
  const mockRequests: string[] = [];
  await seedAccountSession(page, "parent");
  await page.route("http://api.test/**", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === "/v1/parent/config") {
      await route.fulfill({ contentType: "application/json", body: JSON.stringify(parentPortal) });
      return;
    }
    const evidenceMatch = url.pathname.match(/^\/v1\/parent\/children\/([^/]+)\/evidence$/);
    if (evidenceMatch) {
      const childRef = decodeURIComponent(evidenceMatch[1]);
      evidenceRequests.push(childRef);
      await route.fulfill({ contentType: "application/json", body: JSON.stringify({ child: parentPortal.children.find((item) => item.student.external_ref === childRef), mastery: [], attempts: [], summary: {}, progress: null }) });
      return;
    }
    const mockMatch = url.pathname.match(/^\/v1\/parent\/children\/([^/]+)\/mock-assessments$/);
    if (mockMatch) {
      mockRequests.push(`${decodeURIComponent(mockMatch[1])}?${url.searchParams.toString()}`);
      await route.fulfill({ contentType: "application/json", body: JSON.stringify({ mock_assessments: [] }) });
      return;
    }
    await route.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ error: `Unhandled ${url.pathname}` }) });
  });

  await page.goto("/parents?child=outside-family");
  await expect(page).toHaveURL(/\/parents\?child=ava-y3$/);
  await expect(page.getByLabel("Linked child")).toHaveValue("ava-y3");
  await expect.poll(() => evidenceRequests).toContain("ava-y3");
  await expect.poll(() => mockRequests).toContain("ava-y3?limit=20");
  expect(evidenceRequests).not.toContain("outside-family");
  expect(mockRequests.some((request) => request.startsWith("outside-family?"))).toBe(false);

  await page.getByLabel("Linked child").selectOption("ben-y5");
  await expect(page).toHaveURL(/\/parents\?child=ben-y5$/);
  await expect.poll(() => evidenceRequests).toContain("ben-y5");
  await expect.poll(() => mockRequests).toContain("ben-y5?limit=20");

  await page.goBack();
  await expect(page).toHaveURL(/\/parents\?child=ava-y3$/);
  await expect(page.getByLabel("Linked child")).toHaveValue("ava-y3");
  await page.goForward();
  await expect(page).toHaveURL(/\/parents\?child=ben-y5$/);
  await expect(page.getByLabel("Linked child")).toHaveValue("ben-y5");
  await page.reload();
  await expect(page.getByLabel("Linked child")).toHaveValue("ben-y5");

  expect(new Set(evidenceRequests)).toEqual(new Set(["ava-y3", "ben-y5"]));
  expect(new Set(mockRequests)).toEqual(new Set(["ava-y3?limit=20", "ben-y5?limit=20"]));
  const accessibility = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
  expect(accessibility.violations.filter((item) => item.impact === "critical" || item.impact === "serious")).toEqual([]);
});

test("school workspace clears all organisation state on logout and failed account switching", async ({ page }) => {
  const schoolRequests: string[] = [];
  let activeLoginID = "";
  await page.route("http://api.test/**", async (route) => {
    const url = new URL(route.request().url());
    schoolRequests.push(`${route.request().method()} ${url.pathname}${url.search}`);
    if (url.pathname === "/v1/auth/school-login") {
      const body = route.request().postDataJSON() as { login_id: string };
      activeLoginID = body.login_id;
      await route.fulfill({ contentType: "application/json", body: JSON.stringify({ session: { token: "school-workspace-token", role: "school_admin", expires_at: "2099-01-01T00:00:00Z" } }) });
      return;
    }
    if (url.pathname === "/v1/auth/logout") {
      await route.fulfill({ status: 204, body: "" });
      return;
    }
    if (url.pathname === "/v1/school/config") {
      if (activeLoginID === "teacher-two") {
        await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "New school workspace is unavailable." }) });
        return;
      }
      await route.fulfill({ contentType: "application/json", body: JSON.stringify({
        school: { urn: "123456", name: "Nexus Primary", status: "active" },
        current_user: { login_id: "teacher-one", display_name: "Teacher One", role: "school_admin", school_urn: "123456" },
        classes: [{ id: "class-3", name: "Oak Class", year_group: 3, students: [{ external_ref: "ava-y3", display_name: "Ava", year_group: 3 }] }],
        groups: [],
        student_credentials: [{ student_external_ref: "ava-y3", display_name: "Ava", login_code: "654321", picture_password: ["star", "book", "sun"] }],
      }) });
      return;
    }
    if (url.pathname === "/v1/school/assignments") {
      await route.fulfill({ contentType: "application/json", body: JSON.stringify({ assignments: [{ id: "assignment-1", student_external_ref: "ava-y3", student_display_name: "Ava", objective_id: "maths-y3-fractions", title: "Ava fractions priority", priority: 80, status: "active" }] }) });
      return;
    }
    if (url.pathname === "/v1/school/evidence") {
      await route.fulfill({ contentType: "application/json", body: JSON.stringify({ teacher_evidence: [{ id: "evidence-1", student_external_ref: "ava-y3", student_display_name: "Ava", objective_id: "maths-y3-fractions", evidence_type: "observation", outcome: "developing", note: "Ava moderated evidence" }] }) });
      return;
    }
    if (url.pathname === "/v1/school/interventions") {
      await route.fulfill({ contentType: "application/json", body: JSON.stringify({ interventions: [{ id: "intervention-1", student_external_ref: "ava-y3", student_display_name: "Ava", objective_id: "maths-y3-fractions", title: "Ava confidential plan", need: "Fraction language", strategy: "Visual model", priority: 90, status: "active" }] }) });
      return;
    }
    if (url.pathname === "/v1/school/intervention-reviews") {
      await route.fulfill({ contentType: "application/json", body: JSON.stringify({ intervention_reviews: [{ id: "review-1", intervention_id: "intervention-1", student_external_ref: "ava-y3", student_display_name: "Ava", outcome: "monitor", evidence_note: "Private follow-up evidence" }] }) });
      return;
    }
    if (url.pathname === "/v1/school/mock-assessments") {
      await route.fulfill({ contentType: "application/json", body: JSON.stringify({ mock_assessments: [] }) });
      return;
    }
    await route.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ error: `Unhandled ${url.pathname}` }) });
  });

  await page.goto("/school-admin");
  await signInToSchool(page, "teacher-one");
  await expect(page.getByText("Ava confidential plan", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Ava moderated evidence")).toBeVisible();
  await expect(page.getByText("Ava fractions priority")).toBeVisible();

  const selectedLearner = page.getByLabel("Selected school learner");
  await selectedLearner.selectOption("ava-y3");
  await expect.poll(() => schoolRequests).toContain("GET /v1/school/mock-assessments?studentId=ava-y3&limit=20");
  const qr = page.locator('svg[aria-label="QR login code"]').last();
  await expect(qr).toHaveAttribute("data-login-url", /http:\/\/127\.0\.0\.1:\d+\/login\?pupil=ava-y3&code=654321/);

  await selectedLearner.evaluate((select) => {
    const option = document.createElement("option");
    option.value = "outside-school";
    option.textContent = "Outside school";
    select.append(option);
    (select as HTMLSelectElement).value = "outside-school";
    select.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await expect(page.getByText("Choose the selected school learner above before using this teacher evidence tool.")).toBeVisible();
  expect(schoolRequests.some((request) => request.includes("outside-school"))).toBe(false);

  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page.getByRole("navigation", { name: "School workspace sections" })).toHaveCount(0);
  for (const privateText of ["Ava confidential plan", "Ava moderated evidence", "Ava fractions priority", "Private follow-up evidence", "654321"]) {
    await expect(page.getByText(privateText, { exact: false })).toHaveCount(0);
  }
  await expect(page.getByLabel("Selected school learner")).toHaveCount(0);

  await signInToSchool(page, "teacher-one");
  await expect(page.getByText("Ava confidential plan", { exact: true }).first()).toBeVisible();
  await page.getByLabel("Login ID").fill("teacher-two");
  await page.getByLabel("Temporary password").fill("wrong-password");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("status")).toContainText("New school workspace is unavailable.");
  await expect(page.getByRole("navigation", { name: "School workspace sections" })).toHaveCount(0);
  await expect(page.getByText("Ava confidential plan")).toHaveCount(0);
  await expect(page.getByLabel("Selected school learner")).toHaveCount(0);
});

async function signInToSchool(page: Page, loginID: string) {
  await page.getByLabel("School URN").fill("123456");
  await page.getByLabel("Login ID").fill(loginID);
  await page.getByLabel("Temporary password").fill("temporary-password");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByText("Signed in as Teacher One / School admin")).toBeVisible();
}
