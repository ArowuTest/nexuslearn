import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const student = { external_ref: "evidence-child", display_name: "Evidence Pupil", year_group: 3 };
const peer = { external_ref: "other-child", display_name: "Other Pupil", year_group: 4 };
const child = { student, credential: { student_external_ref: student.external_ref, login_code: "123456", picture_password: [] }, engagement: {
  student_external_ref: student.external_ref, declared_support_needs: [], learning_approaches: [], interests: [],
  celebration_intensity: "balanced", audio_support: true, reading_support: true, session_length: "standard",
  sensory_load: "balanced", attention_support: "standard", communication_support: "standard", processing_support: "standard",
  confidence_support: "balanced", companion_style: "friendly", reward_style: "world_building", notes: "",
} };
const report = {
  student_id: student.external_ref, year_group: 3, working_year: 3, stretch_year: 0, stretch_allowed: false,
  summary: "Subjects progress independently.", subjects: [], strengths: [], practice: [], mock_assessments: [],
  attempt_evidence: [
    { id: "attempt-one", objective_id: "ma-decimals", question_id: "decimal-one", question_version: "a".repeat(64), question_prompt: "What is 1.5 + 1?", format: "number-input", recorded_answer: "2.5", response_mode: "keyboard", correct: true, hint_used: true, mastery_delta: 4, explanation: "Saved marking feedback.", attempted_at: "2026-09-06T10:00:00Z" },
    { id: "attempt-old", objective_id: "ma-decimals", question_id: "decimal-old", format: "number-input", recorded_answer: "4", response_mode: "standard", correct: false, hint_used: false, mastery_delta: -2, explanation: "Earlier recorded feedback.", attempted_at: "2026-08-01T10:00:00Z" },
  ],
};

for (const workspace of ["parents", "family", "school-admin", "admin"]) {
  test(`${workspace} explains frozen grading evidence without claiming mastery`, async ({ page }, testInfo) => {
    const role = workspace === "admin" ? "platform_admin" : workspace === "school-admin" ? "school_admin" : "parent";
    await page.addInitScript((role) => {
      sessionStorage.setItem("nexuslearn_account_session", "evidence-token");
      sessionStorage.setItem("nexuslearn_account_role", role);
      sessionStorage.setItem("nexuslearn_account_session_expires", "2099-01-01T00:00:00Z");
    }, role);
    await page.route("http://api.test/**", async (route) => {
      const path = new URL(route.request().url()).pathname;
      let body: unknown = {};
      if (path.startsWith("/v1/auth/") && path.endsWith("-login")) body = { parent: { login_id: "test-parent", display_name: "Parent" }, session: { token: "evidence-token", role, expires_at: "2099-01-01T00:00:00Z" } };
      else if (path === "/v1/parent/config") body = { parent: { login_id: "test-parent", display_name: "Parent" }, children: [child] };
      else if (path.endsWith("/evidence") && path.startsWith("/v1/parent/")) body = { child, mastery: [], attempts: [], summary: {}, progress: report };
      else if (path.endsWith("/progress")) body = report;
      else if (path === "/v1/admin/config") body = { students: [student, peer], schools: [], classes: [], parent_links: [] };
      else if (path === "/v1/school/config") body = { school: { urn: "123456", name: "Test School", status: "active" }, current_user: { login_id: "teacher", display_name: "Teacher", role: "school_admin", school_urn: "123456" }, classes: [{ id: "class-3", name: "Test class", year_group: 3, students: [student, peer] }], groups: [], student_credentials: [], users: [] };
      else if (path.endsWith("/mock-assessments")) body = { mock_assessments: [] };
      else if (path.endsWith("/assignments")) body = { assignments: [] };
      else if (path.endsWith("/interventions")) body = { interventions: [] };
      else if (path.endsWith("/evidence")) body = { evidence: [] };
      await route.fulfill({ contentType: "application/json", body: JSON.stringify(body) });
    });
    await page.goto(workspace === "admin" ? "/admin?section=Progress" : `/${workspace}`);
    if (workspace === "family") {
      await page.getByLabel("Login ID").fill("test-parent");
      await page.getByLabel("Password").last().fill("test-password");
      await page.getByRole("button", { name: "Sign in", exact: true }).click();
    }
    if (workspace === "admin") {
      await page.getByLabel("Learner external ref").fill(student.external_ref);
      await page.getByRole("button", { name: "Load progress", exact: true }).click();
    }
    if (workspace === "school-admin") {
      await page.getByLabel("School URN").fill("123456");
      await page.getByLabel("Login ID").fill("teacher");
      await page.getByLabel("Temporary password").fill("test-password");
      await page.getByRole("button", { name: "Sign in", exact: true }).click();
      await page.getByLabel("Selected school learner").selectOption(student.external_ref);
      await page.getByRole("button", { name: "Load progress", exact: true }).click();
    }
    const evidence = page.getByRole("region", { name: "Recent learning evidence" });
    await expect(evidence).toBeVisible();
    await expect(evidence).toContainText("not a mastery judgement");
    const first = evidence.locator("details").first();
    await first.locator("summary").focus();
    await page.keyboard.press("Enter");
    await expect(first.getByText("2.5", { exact: true })).toBeVisible();
    await expect(first).toContainText("Hint used");
    await expect(first).toContainText("+4");
    await expect(first).toContainText("a".repeat(64));
    await expect(first).toContainText("keyboard");
    const historical = evidence.locator("details").nth(1);
    await historical.locator("summary").click();
    await expect(historical).toContainText("Historical record: question version unavailable");
    await expect(historical).toContainText("-2");
    const accessibility = await new AxeBuilder({ page }).include('[aria-label="Recent learning evidence"]').withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
    expect(accessibility.violations).toEqual([]);
    await evidence.screenshot({ path: testInfo.outputPath("adult-evidence.png"), animations: "disabled" });
    if (workspace === "admin" || workspace === "school-admin") {
      // A late response must not put one child's answers under another name.
      let release!: () => void;
      let arrived!: () => void;
      const gate = new Promise<void>((resolve) => { release = resolve; });
      const requestSeen = new Promise<void>((resolve) => { arrived = resolve; });
      await page.route(`http://api.test/v1/${workspace === "admin" ? "admin" : "school"}/students/${student.external_ref}/progress`, async (route) => {
        arrived();
        await gate;
        await route.fulfill({ contentType: "application/json", body: JSON.stringify(report) });
      });
      try {
        await page.getByRole("button", { name: "Load progress", exact: true }).click();
        await requestSeen;
        if (workspace === "admin") await page.getByLabel("Learner external ref").fill(peer.external_ref);
        else await page.getByLabel("Selected school learner").selectOption(peer.external_ref);
      } finally { release(); }
      await expect(page.getByRole("button", { name: "Load progress", exact: true })).toBeEnabled();
      await expect(evidence).toHaveCount(0);
    }
  });
}
