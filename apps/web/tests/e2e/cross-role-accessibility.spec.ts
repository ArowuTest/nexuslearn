import { expect, test, type Page } from "@playwright/test";
import { accessibleReflow, keyboardFocus } from "./helpers/accessibility";

test.use({ viewport: { width: 320, height: 900 }, contextOptions: { reducedMotion: "reduce" } });

for (const [role, path, field] of [
  ["pupil", "/login", "Pupil ID"],
  ["parent", "/family", "Parent name"],
  ["school", "/school-admin", "School URN"],
  ["admin", "/admin", "Login ID"],
] as const) {
  test(`${role} entry is readable at 320px and keeps a strong keyboard focus indicator`, async ({ page }, info) => {
    await page.goto(path);
    const control = page.getByRole("textbox", { name: field, exact: true });
    await expect(control).toBeEnabled();
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await keyboardFocus(page, control);
    await page.screenshot({ path: info.outputPath(`${role}-keyboard.png`), animations: "disabled" });
    await accessibleReflow(page);
  });

  test(`${role} entry controls remain stationary with reduced motion`, async ({ page }) => {
    await page.goto(path);
    expect(await page.evaluate(() => matchMedia("(prefers-reduced-motion: reduce)").matches)).toBe(true);
    if (role === "pupil") {
      await page.getByLabel("Pupil ID", { exact: true }).fill("access-pupil");
      await page.getByLabel("Login code", { exact: true }).fill("123456");
    } else if (role === "parent" || role === "admin") {
      await page.getByLabel("Login ID", { exact: true }).fill("access-adult");
      await page.getByLabel("Password", { exact: true }).last().fill("local-disposable-password");
    }
    const control = role === "school" ? page.getByRole("link", { name: "Home", exact: true })
      : page.getByRole("button", { name: role === "pupil" ? "Log in" : "Sign in", exact: true });
    await expect(control).toBeEnabled();
    await control.hover();
    await expect(control).toHaveCSS("transform", "none");
    await expect(control).toHaveCSS("transition-duration", "0s");
  });
}

test("family invitation retains one page heading and a subordinate sign-in section", async ({ page }) => {
  await page.goto("/family?invitation=local-accessibility-invitation");
  await expect(page.getByRole("textbox", { name: "Your name", exact: true })).toBeEnabled();
  await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
  await expect(page.getByRole("heading", { level: 1, name: "Join your child's learning workspace" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: "Parent access" })).toBeVisible();
  await accessibleReflow(page);
});

// These are CSS-contract fixtures, not a claim that an API-unavailable public
// world directory loaded. Real role journeys above/below use the actual UI.
async function motionUtility(page: Page, className: string) {
  await page.evaluate(classes => {
    document.querySelector("[data-motion-probe]")?.remove();
    const probe = document.createElement("button");
    probe.dataset.motionProbe = "true";
    probe.className = classes;
    // Isolate the CSS probe from the page's touch-screen stacking contexts.
    Object.assign(probe.style, { position: "fixed", top: "16px", left: "16px", zIndex: "2147483647", width: "180px", minHeight: "48px" });
    probe.textContent = "Motion style probe";
    document.body.append(probe);
  }, className);
  return page.getByRole("button", { name: "Motion style probe", exact: true });
}

for (const preference of ["OS", "pupil profile"] as const) {
  test(`shared motion utilities respect ${preference} reduced motion`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: preference === "OS" ? "reduce" : "no-preference" });
    await page.goto("/login");
    if (preference === "pupil profile") await page.locator("body").evaluate(body => body.classList.add("reduced-motion"));
    for (const classes of ["world-portal tile-press", "anim-pop", "anim-squash", "anim-shake", "btn-pop", "sentence-card"]) {
      const control = await motionUtility(page, classes);
      await expect(control).toHaveCSS("animation-name", "none");
      await control.hover();
      await expect(control).toHaveCSS("transform", "none");
      await expect(control).toHaveCSS("transition-duration", "0s");
      await page.mouse.down();
      try { await expect(control).toHaveCSS("transform", "none"); }
      finally { await page.mouse.up(); }
    }
  });
}

test("normal motion remains available in the shared world and button styles", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/login");
  const portal = await motionUtility(page, "world-portal");
  await expect(portal).toHaveCSS("animation-name", "portal-card-enter");
  const control = await motionUtility(page, "btn-pop");
  await control.hover();
  await expect(control).not.toHaveCSS("transform", "none");
});

const child = { external_ref: "access-pupil", display_name: "Alex", year_group: 3 };
const profile = {
  student_external_ref: child.external_ref, version: 1, declared_support_needs: [], learning_approaches: ["reduced_motion"],
  celebration_intensity: "quiet", audio_support: true, reading_support: true, session_length: "short", sensory_load: "low",
  attention_support: "chunked", communication_support: "audio_visual", processing_support: "extra_time",
  confidence_support: "gentle", companion_style: "calm", reward_style: "story", interests: [], notes: "Keep these supports.",
};

async function school(page: Page) {
  await page.route("http://api.test/**", route => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith("school-login")) return route.fulfill({ json: { session: { token: "accessibility-school", role: "school_admin", expires_at: "2099-01-01T00:00:00Z" } } });
    if (path === "/v1/school/config") return route.fulfill({ json: {
      school: { urn: "access-school", name: "Accessibility school" },
      current_user: { login_id: "teacher", role: "school_admin", school_urn: "access-school" },
      classes: [{ id: "oak", name: "Oak", year_group: 3, student_count: 1 }], students: [child], groups: [],
      directory: { version: 1, counts: { classes: 1, groups: 0, students: 1 }, classes_next_cursor: "", groups_next_cursor: "", students_next_cursor: "" },
    } });
    if (path.endsWith("/engagement")) return route.fulfill({ json: profile });
    return route.fulfill({ json: {} });
  });
  await page.goto("/school-admin");
  await page.getByLabel("School URN", { exact: true }).fill("access-school");
  await page.getByLabel("Login ID", { exact: true }).fill("teacher");
  await page.getByLabel("Temporary password", { exact: true }).fill("local-disposable-password");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("navigation", { name: "School workspace sections" })).toBeVisible();
}

test("school support notes retain visible keyboard focus and fit a narrow workspace", async ({ page }, info) => {
  await school(page);
  await page.getByRole("combobox", { name: "Selected school learner", exact: true }).selectOption(child.external_ref);
  await page.getByRole("button", { name: "Load profile", exact: true }).click();
  const notes = page.getByRole("textbox", { name: "Operational notes", exact: true });
  await expect(notes).toHaveValue(profile.notes);
  await keyboardFocus(page, notes);
  await page.screenshot({ path: info.outputPath("school-support-keyboard.png"), animations: "disabled" });
  await accessibleReflow(page);
});

test("school section links move keyboard navigation into the selected workspace", async ({ page }) => {
  await school(page);
  const navigation = page.getByRole("navigation", { name: "School workspace sections" });
  const link = navigation.getByRole("link", { name: "Support & interventions", exact: true });
  await link.focus();
  await page.keyboard.press("Enter");
  await page.keyboard.press("Tab");
  expect(await page.evaluate(() => Boolean(document.activeElement?.closest("#school-support")))).toBe(true);
});

test("linked family cards and support setup reflow and remain keyboard operable at 320px", async ({ page }, info) => {
  const linked = { student: child, credential: { student_external_ref: child.external_ref, login_code: "123456", picture_password: ["star", "book", "sun"] }, engagement: profile };
  await page.addInitScript(() => {
    sessionStorage.setItem("nexuslearn_account_session", "accessibility-parent");
    sessionStorage.setItem("nexuslearn_account_role", "parent");
    sessionStorage.setItem("nexuslearn_account_session_expires", "2099-01-01T00:00:00Z");
  });
  await page.route("http://api.test/**", route => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/v1/parent/config") return route.fulfill({ json: { parent: { email: "parent@example.test", display_name: "Alex's parent", login_id: "access-parent" }, children: [linked] } });
    if (path.endsWith("/evidence")) return route.fulfill({ json: { child: linked, mastery: [], attempts: [], summary: {}, progress: null } });
    if (path.endsWith("/mock-assessments")) return route.fulfill({ json: { mock_assessments: [] } });
    return route.fulfill({ status: 404, json: { error: `Unhandled ${path}` } });
  });
  await page.goto("/family");
  await expect(page.getByRole("navigation", { name: "Family workspace sections" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
  await expect(page.getByRole("heading", { level: 1, name: "Set up learning around the child." })).toBeVisible();
  const card = page.getByText("Show child login card", { exact: true });
  await keyboardFocus(page, card);
  await page.keyboard.press("Enter");
  await expect(page.getByRole("list", { name: "Picture password sequence" })).toBeVisible();
  await accessibleReflow(page);
  await page.screenshot({ path: info.outputPath("family-card-320.png"), animations: "disabled" });
  const supportLink = page.getByRole("navigation", { name: "Family workspace sections" }).getByRole("link", { name: "Access & SEND" });
  await supportLink.focus();
  await page.keyboard.press("Enter");
  await page.keyboard.press("Tab");
  expect(await page.evaluate(() => Boolean(document.activeElement?.closest("#family-support")))).toBe(true);
  await keyboardFocus(page, page.getByRole("textbox", { name: "Parent notes", exact: true }));
  await page.screenshot({ path: info.outputPath("family-support-320.png"), animations: "disabled" });
  await page.getByRole("link", { name: "View Alex's subject check history", exact: true }).click();
  await expect(page.getByRole("combobox", { name: "Linked child", exact: true })).toHaveValue(child.external_ref);
  await accessibleReflow(page);
  await page.screenshot({ path: info.outputPath("parent-progress-320.png"), animations: "disabled" });
  await page.goto("/family");
  await expect(page.getByRole("navigation", { name: "Family workspace sections" })).toBeVisible();
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
  await expect(page.getByRole("heading", { level: 1, name: "Parent access" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Family workspace sections" })).toHaveCount(0);
  await expect(page.locator("#family-children")).toHaveCount(0);
  await expect(page.locator("#family-support")).toHaveCount(0);
});
