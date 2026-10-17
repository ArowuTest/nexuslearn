import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("large asset inventory lists files and deletes nothing", () => {
  const result = spawnSync(process.execPath, ["ops/list-large-assets.mjs"], { cwd: repo, encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /tracked files over 1 MB/);
  assert.doesNotMatch(result.stdout, /deleted|rewrit/i);
});
