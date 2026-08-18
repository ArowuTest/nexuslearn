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

test("family workspace explains its journey with keyboard-reachable local navigation", async ({ page }) => {
  await page.goto("/family?invitation=test-invitation");

  const navigation = page.getByRole("navigation", { name: "Family workspace sections" });
  await expect(navigation).toBeVisible();
  await expect(navigation.getByRole("link", { name: "Account" })).toHaveAttribute("href", "#family-account");
  await expect(navigation.getByRole("link", { name: "Children & progress" })).toHaveAttribute("href", "#family-children");
  await expect(navigation.getByRole("link", { name: "Access & SEND" })).toHaveAttribute("href", "#family-support");
  await navigation.getByRole("link", { name: "Access & SEND" }).focus();
  await expect(navigation.getByRole("link", { name: "Access & SEND" })).toBeFocused();
  await expect(page.getByRole("status")).toContainText(/invitation found|create or load a family workspace/i);

  const accessibility = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
  expect(accessibility.violations.filter((item) => item.impact === "critical" || item.impact === "serious")).toEqual([]);
});

test("parent workspace keeps an unlinked URL child outside the selected learning picture", async ({ page }) => {
  await seedAccountSession(page, "parent");
  await page.route("http://api.test/v1/parent/config", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        parent: { email: "parent@example.test", display_name: "Ava's parent", login_id: "ava-parent" },
        children: [linkedChild("ava-y3", "Ava", 3), linkedChild("ben-y5", "Ben", 5)],
      }),
    });
  });
  await page.route("http://api.test/v1/parent/children/**/mock-assessments**", async (route) => {
    await route.fulfill({ contentType: "application/json", body: JSON.stringify({ mock_assessments: [] }) });
  });

  await page.goto("/parents?child=outside-family");

  const navigation = page.getByRole("navigation", { name: "Parent workspace sections" });
  await expect(navigation.getByRole("link", { name: "Learning picture" })).toHaveAttribute("href", "#parent-progress");
  await expect(navigation.getByRole("link", { name: "Strengths & practice" })).toHaveAttribute("href", "#parent-priorities");
  await expect(navigation.getByRole("link", { name: "Subject checks" })).toHaveAttribute("href", "#parent-mocks");
  await expect(page.getByLabel("Linked child")).toHaveValue("ava-y3");
  await expect(page.getByText("outside-family")).toHaveCount(0);
  await expect(page.getByText(/sampled evidence/i).first()).toBeVisible();

  const accessibility = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
  expect(accessibility.violations.filter((item) => item.impact === "critical" || item.impact === "serious")).toEqual([]);
});

test("school workspace organises setup, learning and support around school-scoped pupils", async ({ page }) => {
  const selectedHistoryLearners: string[] = [];
  await page.route("http://api.test/**", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === "/v1/auth/school-login") {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({ session: { token: "school-workspace-token", role: "school_admin", expires_at: "2099-01-01T00:00:00Z" } }),
      });
      return;
    }
    if (url.pathname === "/v1/school/config") {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          school: { urn: "123456", name: "Nexus Primary", status: "active" },
          current_user: { login_id: "teacher-one", display_name: "Teacher One", role: "school_admin", school_urn: "123456" },
          classes: [{ id: "class-3", name: "Oak Class", year_group: 3, students: [
            { external_ref: "ava-y3", display_name: "Ava", year_group: 3 },
            { external_ref: "ben-y3", display_name: "Ben", year_group: 3 },
          ] }],
          groups: [],
          student_credentials: [],
        }),
      });
      return;
    }
    if (url.pathname === "/v1/school/mock-assessments") {
      selectedHistoryLearners.push(url.searchParams.get("studentId") ?? "");
      await route.fulfill({ contentType: "application/json", body: JSON.stringify({ mock_assessments: [] }) });
      return;
    }
    const emptyCollections: Record<string, string> = {
      "/v1/school/assignments": "assignments",
      "/v1/school/evidence": "teacher_evidence",
      "/v1/school/interventions": "interventions",
      "/v1/school/intervention-reviews": "intervention_reviews",
    };
    if (emptyCollections[url.pathname]) {
      await route.fulfill({ contentType: "application/json", body: JSON.stringify({ [emptyCollections[url.pathname]]: [] }) });
      return;
    }
    await route.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ error: `Unhandled ${url.pathname}` }) });
  });

  await page.goto("/school-admin");
  await page.getByLabel("School URN").fill("123456");
  await page.getByLabel("Login ID").fill("teacher-one");
  await page.getByLabel("Temporary password").fill("temporary-password");
  await page.getByRole("button", { name: "Sign in" }).click();

  const navigation = page.getByRole("navigation", { name: "School workspace sections" });
  await expect(navigation.getByRole("link", { name: "Setup & access" })).toHaveAttribute("href", "#school-setup");
  await expect(navigation.getByRole("link", { name: "Groups & pupils" })).toHaveAttribute("href", "#school-people");
  await expect(navigation.getByRole("link", { name: "Learning & evidence" })).toHaveAttribute("href", "#school-learning");
  await expect(navigation.getByRole("link", { name: "Support & interventions" })).toHaveAttribute("href", "#school-support");

  const scopedSelect = page.getByLabel("Selected school learner");
  await expect(scopedSelect.locator("option")).toHaveCount(3);
  await expect(page.locator('select:has(option[value="ava-y3"])')).toHaveCount(1);
  await scopedSelect.selectOption("ava-y3");
  for (const purpose of ["assignment", "mock", "teacher evidence", "intervention"]) {
    await expect(page.getByText(`Selected school learner for ${purpose}: Ava / Year 3`, { exact: true })).toBeVisible();
  }
  await expect.poll(() => selectedHistoryLearners).toContain("ava-y3");
  await expect(page.getByText("outside-school")).toHaveCount(0);
  await navigation.getByRole("link", { name: "Learning & evidence" }).focus();
  await expect(navigation.getByRole("link", { name: "Learning & evidence" })).toBeFocused();

  const accessibility = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
  expect(accessibility.violations.filter((item) => item.impact === "critical" || item.impact === "serious")).toEqual([]);
});
