import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const rubricURL = new URL("../../review/rubrics/v1.json", import.meta.url);
const sourcesURL = new URL("../../review/source-registry.v1.json", import.meta.url);

async function readJSON(url) {
  return JSON.parse(await readFile(url, "utf8"));
}

test("review rubric has two explicit AI lanes with unique sourced criteria", async () => {
  const [rubric, registry] = await Promise.all([readJSON(rubricURL), readJSON(sourcesURL)]);
  const sourceIDs = new Set(registry.sources.map((source) => source.source_id));

  assert.equal(rubric.rubric_revision, "curriculum-send-v1");
  assert.deepEqual(Object.keys(rubric.lanes).sort(), ["ai_curriculum_lead", "ai_send_lead"]);
  const criteria = Object.values(rubric.lanes).flatMap((lane) => lane.criteria);
  assert.equal(new Set(criteria.map((criterion) => criterion.id)).size, criteria.length);
  assert.ok(criteria.length >= 30);
  for (const criterion of criteria) {
    assert.ok(criterion.source_ids.length > 0, `${criterion.id} needs a source`);
    assert.ok(
      criterion.source_ids.every((sourceID) => sourceIDs.has(sourceID)),
      `${criterion.id} has an unknown source`,
    );
    assert.equal(typeof criterion.release_blocking, "boolean");
  }
});

test("source registry records current direct sources without human approval claims", async () => {
  const registry = await readJSON(sourcesURL);

  assert.equal(registry.source_set_revision, "sources-v1");
  assert.equal(registry.last_checked, "2026-08-08");
  assert.ok(registry.sources.length >= 10);
  for (const source of registry.sources) {
    assert.match(source.url, /^https:\/\//);
    assert.equal(source.status, "active");
    assert.ok(source.criterion_ids.length > 0);
  }
  assert.doesNotMatch(JSON.stringify(registry), /teacher approved|SEND specialist approved/i);
});
