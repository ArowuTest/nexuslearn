import { expect, test } from "@playwright/test";

test("public entry keeps learning behind structured access", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("main")).toBeVisible();
  await expect(page.getByText(/children do not need email accounts/i)).toBeVisible();
  await expect(page.locator("body")).not.toContainText("undefined");
});

test("family workspace exposes secure signup, invitation and support controls", async ({ page }) => {
  await page.goto("/family?invitation=test-invitation");
  await expect(page.getByRole("heading", { name: /join your child's learning workspace/i })).toBeVisible();
  await expect(page.getByLabel("Your name")).toBeVisible();
  await expect(page.getByText("SEND/support needs")).toBeVisible();
  await expect(page.getByRole("button", { name: "Accept invitation" })).toBeDisabled();
});

test("school workspace requests one-time credentials and supports child-safe access", async ({ page }) => {
  await page.goto("/school-admin");
  await expect(page.getByRole("heading", { name: /classes, groups and pupil access/i })).toBeVisible();
  await expect(page.getByLabel("School URN")).toBeVisible();
  await expect(page.getByRole("button", { name: "Sign in" })).toBeDisabled();
  await expect(page.getByText(/picture passwords/i)).toBeVisible();
});

test("admin console prefers named accounts and retains explicit bootstrap migration", async ({ page }) => {
  await page.goto("/admin");
  await expect(page.getByRole("heading", { name: /configuration control room/i })).toBeVisible();
  await expect(page.getByLabel("Platform login ID")).toBeVisible();
  await expect(page.getByText("Temporary bootstrap API key")).toBeVisible();
  await expect(page.getByRole("button", { name: "Sign in" })).toBeDisabled();
});

test("pupil login remains email-free and card-led", async ({ page }) => {
  await page.goto("/login?pupil=ava-y1&code=AVA-1234");
  await expect(page.getByRole("heading", { name: /open your learning card/i })).toBeVisible();
  await expect(page.getByLabel("Pupil ID")).toHaveValue("ava-y1");
  await expect(page.getByLabel("Login code")).toHaveValue("AVA-1234");
  await expect(page.getByText(/without needing an email account/i)).toBeVisible();
});
