import { expect, type Page, type Response } from "@playwright/test";

// A fulfilled route is not yet a consumed response. Drain the network body and
// let React commit before asserting that a late completion did not restore data.
export async function responseSettled(page: Page, response: Promise<Response>) {
  expect(await (await response).finished()).toBeNull();
  await page.evaluate(() => new Promise<void>(resolve => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  }));
}
