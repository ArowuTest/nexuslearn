import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { childSafetyReport } from "../../../packages/content/tools/child-safety-report.mjs";

test("the review summary matches the catalogue a child can and cannot hear", async () => {
  const committed = JSON.parse(await readFile(new URL("../public/review/safety-summary.json", import.meta.url), "utf8"));
  const fresh = await childSafetyReport();
  assert.deepEqual(committed.narration, fresh.narration);
  assert.deepEqual(committed.variants, fresh.variants);
  assert.equal(fresh.narration.servable, 0);
  assert.equal(fresh.narration.blocked, 874);
  assert.equal(fresh.variants.servable_status, 62);
  assert.equal(fresh.variants.blocked, 20148);
  assert.equal(JSON.stringify(committed).includes("/audio/"), false);
  assert.equal(JSON.stringify(fresh).includes("\"file\""), false);
});
