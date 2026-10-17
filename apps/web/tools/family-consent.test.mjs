import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("the family page shows the same consent sentence the API stores", async () => {
  const page = await readFile(new URL("../src/app/family/page.tsx", import.meta.url), "utf8");
  const api = await readFile(new URL("../../api/internal/learning/privacy.go", import.meta.url), "utf8");
  const match = api.match(/FamilyLearningConsentStatement = "([^"]+)"/);
  assert.ok(match, "API consent sentence missing");
  assert.match(page, new RegExp(match[1].replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(page, /consent:\s*true/);
});
