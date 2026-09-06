import { test } from "node:test";
import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";

test("the deployed content directory contains only the learner audio manifest", async () => {
  const root = new URL("../public/content/", import.meta.url);
  assert.deepEqual((await readdir(root)).sort(), ["narration-manifest.json"], "Internal reports must not be anonymously downloadable");
  const manifest = JSON.parse(await readFile(new URL("narration-manifest.json", root), "utf8"));
  assert.ok(manifest.items.length > 0, "Keep learner audio available");
  for (const item of manifest.items) {
    assert.ok(item.id && item.file.startsWith("/audio/"));
    assert.deepEqual(Object.keys(item).filter(key => !["id", "pack_id", "kind", "source_id", "file", "production_status", "technical_pass", "year", "pacing_profile", "speed"].includes(key)), [], "Do not publish private narration review metadata");
  }
});
