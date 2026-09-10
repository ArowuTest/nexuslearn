import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import QRCode from "qrcode";
import { responseSettled } from "./response-settled";

const pupils = Array.from({ length: 14 }, (_, i) => ({ external_ref: `oak-${String(i + 1).padStart(2, "0")}`, display_name: `Oak pupil ${i + 1}`, year_group: 3 }));
const classes = [{ id: "oak", name: "Oak Class", year_group: 3, students: pupils }, { id: "willow", name: "Willow Class", year_group: 4, students: [{ external_ref: "willow-01", display_name: "Willow pupil", year_group: 4 }] }];
const credential = (pupil: typeof pupils[number]) => ({ student_external_ref: pupil.external_ref, display_name: pupil.display_name, login_code: pupil.external_ref === "oak-14" ? "" : `CARD-${pupil.external_ref}`, picture_password: pupil.external_ref === "oak-14" ? [] : ["star", "book", "sun"], qr_secret_hash: "" });
const pageData = (classID: string, cursor = "") => ({ class_id: classID, student_credentials: (classID === "willow" ? classes[1].students : cursor ? pupils.slice(12) : pupils.slice(0, 12)).map(credential), limit: 12, has_more: classID === "oak" && !cursor, next_cursor: classID === "oak" && !cursor ? "oak-page-2" : "" });

async function school(page: Page, expiresAt = "2099-01-01T00:00:00Z") {
  const cardReads: URL[] = [];
  const configReads: URL[] = [];
  await page.route("http://api.test/**", async route => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith("school-login")) return route.fulfill({ json: { session: { token: "school-card-fixture", role: "school_admin", expires_at: expiresAt } } });
    if (url.pathname === "/v1/school/config") {
      configReads.push(url);
      return route.fulfill({ json: { school: { urn: "qa-school", name: "QA school" }, current_user: { login_id: "teacher", role: "school_admin" }, classes, groups: [], student_credentials: [credential(classes[1].students[0])] } });
    }
    const match = url.pathname.match(/^\/v1\/school\/classes\/([^/]+)\/credentials$/);
    if (match) {
      cardReads.push(url);
      expect(route.request().headers().authorization).toBe("Bearer school-card-fixture");
      return route.fulfill({ json: pageData(match[1], url.searchParams.get("cursor") ?? "") });
    }
    return route.fulfill({ json: {} });
  });
  await page.goto("/school-admin");
  await page.getByLabel("School URN").fill("qa-school");
  await page.getByLabel("Login ID").fill("teacher");
  await page.getByLabel("Temporary password").fill("local-test-password");
  await page.getByLabel("Temporary password").press("Enter");
  await expect(page.getByText("Signed in as teacher / School admin", { exact: true })).toBeVisible();
  return { cardReads, configReads };
}

const cards = (page: Page) => page.getByRole("region", { name: "Pupil Login Packs", exact: true });
async function choose(page: Page, id = "oak") {
  await page.getByRole("combobox", { name: "Login card class", exact: true }).selectOption(id);
  await expect(cards(page).getByRole("status")).toContainText("Page 1");
}

test("school opens a lightweight workspace without publishing an entire school's cards", async ({ page }) => {
  const { cardReads, configReads } = await school(page);
  expect(configReads[0].searchParams.get("include_credentials")).toBe("false");
  expect(cardReads).toHaveLength(0);
  await expect(page.getByRole("form", { name: "School sign in" })).toHaveCount(0);
  await expect(page.getByText("CARD-willow-01", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("img", { name: "QR login code" })).toHaveCount(0);
  await expect(page.getByLabel("Login card class")).toHaveValue("");
  const headings = await page.getByRole("heading", { level: 2 }).allTextContents();
  expect(headings.indexOf("Create Class")).toBeLessThan(headings.indexOf("Create Pupil"));
  expect(headings.indexOf("Pupil Login Packs")).toBeLessThan(headings.indexOf("Learner Progress Snapshot"));
  expect(headings.indexOf("Learner Progress Snapshot")).toBeLessThan(headings.indexOf("SENCO Pupil Support Profile"));
});

test("class cards use bounded server pages, private disclosure and explicit print selection", async ({ page }) => {
  const { cardReads } = await school(page);
  await choose(page);
  expect(cardReads[0].pathname).toBe("/v1/school/classes/oak/credentials");
  expect(cardReads[0].searchParams.get("limit")).toBe("12");
  await expect(cards(page).getByRole("checkbox")).toHaveCount(12);
  await expect(cards(page).getByText("Willow pupil", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("img", { name: "QR login code" })).toHaveCount(0);
  await cards(page).getByRole("button", { name: "Show login card for Oak pupil 1", exact: true }).click();
  await expect(cards(page).getByText("CARD-oak-01", { exact: true })).toBeVisible();
  await expect(page.getByRole("img", { name: "QR login code" })).toHaveCount(1);
  await expect(cards(page).getByRole("button", { name: "Print selected cards (0)" })).toBeDisabled();
  await cards(page).getByRole("checkbox", { name: "Print Oak pupil 1 (oak-01)", exact: true }).check();
  await page.evaluate(() => { window.print = () => {}; });
  await cards(page).getByRole("button", { name: "Print selected cards (1)" }).click();
  await expect(page.locator(".print-card-sheet article")).toHaveCount(1);
  await expect(page.locator(".print-card-sheet")).toContainText("CARD-oak-01");
  await expect(page.locator(".print-card-sheet")).not.toContainText("CARD-oak-02");
  await page.emulateMedia({ media: "print" });
  await expect(page.locator(".print-card-sheet article")).toBeVisible();
  await expect(cards(page)).toBeHidden();
  await page.evaluate(() => window.dispatchEvent(new Event("afterprint")));
  await expect(page.locator(".print-card-sheet article")).toHaveCount(0);
});

test("paging replaces cards and clears print choices rather than accumulating pupil secrets", async ({ page }) => {
  const { cardReads } = await school(page);
  await choose(page);
  await cards(page).getByRole("button", { name: "Select this page" }).click();
  await expect(cards(page).getByRole("button", { name: "Print selected cards (12)" })).toBeEnabled();
  await cards(page).getByRole("button", { name: "Next page", exact: true }).click();
  await expect(cards(page).getByRole("status")).toContainText("Page 2");
  expect(cardReads[1].searchParams.get("cursor")).toBe("oak-page-2");
  await expect(cards(page).getByRole("checkbox")).toHaveCount(2);
  await expect(cards(page).getByRole("checkbox", { name: "Print Oak pupil 14 (oak-14)", exact: true })).toBeDisabled();
  await expect(cards(page).getByRole("button", { name: "Print selected cards (0)" })).toBeDisabled();
  await expect(cards(page).getByText("Not generated", { exact: true })).toBeVisible();
  await cards(page).getByRole("button", { name: "Previous page", exact: true }).click();
  await expect(cards(page).getByRole("status")).toContainText("Page 1");
  expect(cardReads[2].searchParams.has("cursor")).toBe(false);
  await expect(cards(page).getByRole("checkbox", { checked: true })).toHaveCount(0);
});

test("a late class response cannot replace the newly selected class", async ({ page }) => {
  await school(page);
  let release!: () => void;
  const pending = new Promise<void>(resolve => { release = resolve; });
  await page.route("http://api.test/v1/school/classes/oak/credentials?*", async route => { await pending; await route.fulfill({ json: pageData("oak") }); });
  const response = page.waitForResponse(r => r.url().includes("/classes/oak/credentials"));
  try {
    await page.getByLabel("Login card class").selectOption("oak");
    await choose(page, "willow");
    release();
    await responseSettled(page, response);
    await expect(cards(page).getByRole("checkbox")).toHaveCount(1);
    await expect(cards(page).getByRole("button", { name: "Show login card for Willow pupil" })).toBeVisible();
    await expect(cards(page).getByText("Oak pupil 1", { exact: true })).toHaveCount(0);
  } finally { release(); }
});

test("a failed or mismatched card page removes stale cards and offers a safe retry", async ({ page }) => {
  await school(page);
  await choose(page);
  await cards(page).getByRole("button", { name: "Select this page" }).click();
  await page.route("http://api.test/v1/school/classes/oak/credentials?*", route => route.fulfill({ json: pageData("willow") }));
  await cards(page).getByRole("button", { name: "Next page", exact: true }).click();
  await expect(cards(page).getByRole("alert")).toContainText("could not be loaded");
  await expect(cards(page).getByRole("checkbox")).toHaveCount(0);
  await expect(page.locator(".print-card-sheet article")).toHaveCount(0);
  await expect(cards(page).getByRole("button", { name: "Retry card page" })).toBeEnabled();
  await page.unroute("http://api.test/v1/school/classes/oak/credentials?*");
  await cards(page).getByRole("button", { name: "Retry card page" }).click();
  await expect(cards(page).getByRole("status")).toContainText("Page 2");
});

test("sign-out during a card request clears the workspace and ignores its late private response", async ({ page }) => {
  await school(page);
  let release!: () => void;
  const pending = new Promise<void>(resolve => { release = resolve; });
  await page.route("http://api.test/v1/school/classes/oak/credentials?*", async route => { await pending; await route.fulfill({ json: pageData("oak") }); });
  const response = page.waitForResponse(r => r.url().includes("/classes/oak/credentials"));
  try {
    await page.getByLabel("Login card class").selectOption("oak");
    await page.getByRole("button", { name: "Sign out", exact: true }).click();
    release();
    await responseSettled(page, response);
    await expect(cards(page)).toHaveCount(0);
    await expect(page.getByText("CARD-oak-01", { exact: true })).toHaveCount(0);
    await expect(page.getByRole("form", { name: "School sign in" })).toBeVisible();
  } finally { release(); }
});

test("class-card controls are readable and keyboard reachable at 320 pixels", async ({ page }, info) => {
  await page.setViewportSize({ width: 320, height: 780 });
  await school(page);
  await choose(page);
  const show = cards(page).getByRole("button", { name: "Show login card for Oak pupil 1", exact: true });
  await show.focus();
  await page.keyboard.press("Enter");
  await expect(cards(page).getByRole("button", { name: "Hide login card for Oak pupil 1", exact: true })).toHaveAttribute("aria-expanded", "true");
  await expect(cards(page).getByRole("img", { name: "Star", exact: true })).toBeVisible();
  const brandLines = await cards(page).getByText("NexusLearn", { exact: true }).evaluate(element => element.getBoundingClientRect().height / parseFloat(getComputedStyle(element).lineHeight));
  expect(brandLines).toBe(1);
  await cards(page).scrollIntoViewIfNeeded();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  const audit = await new AxeBuilder({ page }).include("#school-access").withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
  expect(audit.violations.filter(v => v.impact === "critical" || v.impact === "serious")).toEqual([]);
  await page.screenshot({ path: info.outputPath("school-class-cards-320.png"), scale: "css", animations: "disabled" });
});

test("a changed school session cannot print cards loaded under the earlier session", async ({ page }) => {
  await school(page);
  await choose(page);
  await cards(page).getByRole("button", { name: "Select this page" }).click();
  await page.route("http://api.test/v1/school/classes/oak/credentials?*", route => route.fulfill({ status: 403, json: { error: "Class is outside this school" } }));
  await page.evaluate(() => {
    sessionStorage.setItem("nexuslearn_account_session", "other-school-token");
    window.print = () => { document.body.dataset.unexpectedPrint = "true"; };
  });
  await cards(page).getByRole("button", { name: "Print selected cards (12)" }).click();
  await expect(cards(page).getByRole("alert")).toContainText("school session changed");
  await expect(cards(page).getByRole("checkbox")).toHaveCount(0);
  await expect(page.locator(".print-card-sheet article")).toHaveCount(0);
  await expect(page.locator("body")).not.toHaveAttribute("data-unexpected-print", "true");
});

test("rendered login QR preserves row order and a four-module quiet border", async ({ page }) => {
  await school(page);
  await choose(page);
  await cards(page).getByRole("button", { name: "Show login card for Oak pupil 1", exact: true }).click();
  const qr = cards(page).getByRole("img", { name: "QR login code", exact: true });
  const value = await qr.getAttribute("data-login-url");
  expect(value).toBeTruthy();
  const expected = QRCode.create(value!, { errorCorrectionLevel: "M" }).modules;
  const raster = await qr.evaluate(async element => {
    const clone = element.cloneNode(true) as SVGSVGElement;
    const size = clone.viewBox.baseVal.width;
    clone.setAttribute("width", String(size));
    clone.setAttribute("height", String(size));
    const bitmap = new Image();
    bitmap.src = `data:image/svg+xml;base64,${btoa(new XMLSerializer().serializeToString(clone))}`;
    await bitmap.decode();
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = size;
    const context = canvas.getContext("2d")!;
    context.fillStyle = "white";
    context.fillRect(0, 0, size, size);
    context.drawImage(bitmap, 0, 0, size, size);
    const data = context.getImageData(0, 0, size, size).data;
    return { size, rows: Array.from({ length: size }, (_, y) => Array.from({ length: size }, (_, x) => data[(y * size + x) * 4] < 128 ? "1" : "0").join("")) };
  });
  expect(raster.size).toBe(expected.size + 8);
  const rows = Array.from({ length: expected.size + 8 }, (_, y) => Array.from({ length: expected.size + 8 }, (_, x) => x >= 4 && y >= 4 && x < expected.size + 4 && y < expected.size + 4 && expected.get(y - 4, x - 4) ? "1" : "0").join(""));
  expect(raster.rows).toEqual(rows);
});

test("legacy login-code-only cards remain usable without accepting malformed pictures", async ({ page }) => {
  await school(page);
  await page.route("http://api.test/v1/school/classes/oak/credentials?*", route => {
    const data = pageData("oak");
    const { picture_password: _pictures, ...codeOnly } = data.student_credentials[1];
    return route.fulfill({ json: { ...data, student_credentials: [{ ...data.student_credentials[0], picture_password: null }, codeOnly] } });
  });
  await choose(page);
  await expect(cards(page).getByRole("checkbox")).toHaveCount(2);
  await cards(page).getByRole("button", { name: "Show login card for Oak pupil 1", exact: true }).click();
  await expect(cards(page).getByText("CARD-oak-01", { exact: true })).toBeVisible();
  await expect(cards(page).getByText("Use the login code shown above.", { exact: true })).toBeVisible();
  await page.route("http://api.test/v1/school/classes/willow/credentials?*", route => route.fulfill({ json: { ...pageData("willow"), student_credentials: [{ ...credential(classes[1].students[0]), picture_password: "not-an-array" }] } }));
  await page.getByRole("combobox", { name: "Login card class", exact: true }).selectOption("willow");
  await expect(cards(page).getByRole("alert")).toContainText("could not be loaded");
  await expect(cards(page).getByRole("checkbox")).toHaveCount(0);
});

test("keyboard pagination returns focus to the new page result including errors", async ({ page }) => {
  await school(page);
  await choose(page);
  await cards(page).getByRole("button", { name: "Next page", exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect(cards(page).getByRole("status")).toContainText("Page 2");
  await expect(cards(page).getByRole("status")).toBeFocused();
  await page.route("http://api.test/v1/school/classes/oak/credentials?*", route => route.fulfill({ status: 503, json: { error: "Try later" } }));
  await cards(page).getByRole("button", { name: "Previous page", exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect(cards(page).getByRole("alert")).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(cards(page).getByRole("button", { name: "Retry card page" })).toBeFocused();
});

test("session changes remove already expanded cards without another click", async ({ page }) => {
  await school(page);
  await choose(page);
  await cards(page).getByRole("button", { name: "Show login card for Oak pupil 1", exact: true }).click();
  await expect(cards(page).getByText("CARD-oak-01", { exact: true })).toBeVisible();
  await page.evaluate(() => {
    sessionStorage.setItem("nexuslearn_account_session", "other-school-token");
    window.dispatchEvent(new Event("nexuslearn-account-session-changed"));
  });
  await expect(cards(page).getByText("CARD-oak-01", { exact: true })).toHaveCount(0);
  await expect(cards(page).getByRole("checkbox")).toHaveCount(0);
  await expect(cards(page)).toHaveCount(0);
  await expect(page.locator(".print-card-sheet article")).toHaveCount(0);
  await expect(page.getByRole("navigation", { name: "School workspace sections" })).toHaveCount(0);
  await expect(page.getByRole("form", { name: "School sign in" })).toBeVisible();
  await expect(page.getByRole("status")).toContainText("Your school session changed or expired. Sign in again to continue.");
});

test("session expiry clears private cards even when the workspace is idle", async ({ page }) => {
  await page.clock.install({ time: new Date("2026-09-09T12:00:00Z") });
  await school(page, "2026-09-09T12:05:00Z");
  await choose(page);
  await cards(page).getByRole("button", { name: "Show login card for Oak pupil 1", exact: true }).click();
  await expect(cards(page).getByText("CARD-oak-01", { exact: true })).toBeVisible();
  await page.clock.fastForward(300_001);
  await expect(cards(page).getByText("CARD-oak-01", { exact: true })).toHaveCount(0);
  await expect(cards(page).getByRole("checkbox")).toHaveCount(0);
  await expect(cards(page)).toHaveCount(0);
  await expect(page.locator(".print-card-sheet article")).toHaveCount(0);
  await expect(page.getByRole("navigation", { name: "School workspace sections" })).toHaveCount(0);
  await expect(page.getByRole("form", { name: "School sign in" })).toBeVisible();
  await expect(page.getByRole("status")).toContainText("Your school session changed or expired. Sign in again to continue.");
});

test("disclosure rechecks the loading session even without a storage notification", async ({ page }) => {
  await school(page);
  await choose(page);
  await page.evaluate(() => sessionStorage.setItem("nexuslearn_account_session", "other-school-token"));
  await cards(page).getByRole("button", { name: "Show login card for Oak pupil 1", exact: true }).click();
  await expect(cards(page).getByText("CARD-oak-01", { exact: true })).toHaveCount(0);
  await expect(cards(page).getByRole("alert")).toContainText("school session changed");
});
