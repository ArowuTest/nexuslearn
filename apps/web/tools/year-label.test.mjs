import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { CURRICULUM_REGIONS, curriculumRegion, yearLabel, yearRangeLabel } from "../src/lib/year-label.ts";

test("year labels match the shared region map and keep England as the default", async () => {
  const canonical = JSON.parse(await readFile(new URL("../../../packages/content/regions/year-groups.json", import.meta.url), "utf8"));
  assert.equal(canonical.default, "england");
  for (const region of ["england", "nigeria"]) {
    assert.equal(CURRICULUM_REGIONS[region].range, canonical.regions[region].range);
    for (const [year, label] of Object.entries(canonical.regions[region].groups)) {
      assert.equal(yearLabel(Number(year), region), label);
    }
  }
  assert.equal(yearLabel(0), "Year not set");
  assert.equal(yearRangeLabel("england"), "Years 1-7");
  assert.equal(yearRangeLabel("nigeria"), "Primary 1-6 and JSS 1");
  const previousPublic = process.env.NEXT_PUBLIC_CURRICULUM_REGION;
  const previousRegion = process.env.CURRICULUM_REGION;
  delete process.env.NEXT_PUBLIC_CURRICULUM_REGION;
  delete process.env.CURRICULUM_REGION;
  try {
    assert.equal(curriculumRegion(), "england");
    process.env.CURRICULUM_REGION = "nigeria";
    assert.equal(curriculumRegion(), "nigeria");
  } finally {
    if (previousPublic === undefined) delete process.env.NEXT_PUBLIC_CURRICULUM_REGION;
    else process.env.NEXT_PUBLIC_CURRICULUM_REGION = previousPublic;
    if (previousRegion === undefined) delete process.env.CURRICULUM_REGION;
    else process.env.CURRICULUM_REGION = previousRegion;
  }
});
