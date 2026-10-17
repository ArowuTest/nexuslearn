import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { yearGroupLabel } from "../src/lib/year-labels.mjs";

const catalogue = JSON.parse(await readFile(fileURLToPath(new URL("../../../packages/content/curriculum/regions.json", import.meta.url)), "utf8"));

test("england stays the default year wording", () => {
  assert.equal(catalogue.default_region, "england");
  assert.equal(yearGroupLabel(1), "Year 1");
  assert.equal(yearGroupLabel(7, "england"), "Year 7");
  assert.equal(yearGroupLabel(0), "Year not set");
});

test("screen labels match the shared region catalogue", () => {
  for (const region of ["england", "nigeria"]) {
    for (let year = 1; year <= 7; year += 1) {
      assert.equal(yearGroupLabel(year, region), catalogue.regions[region].labels[String(year)]);
    }
  }
});
