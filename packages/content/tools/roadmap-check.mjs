#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const roadmapPath = path.join(repoRoot, "packages/content/roadmaps/y1-y7-core-pack-roadmap.json");
const sourceMapPath = path.join(repoRoot, "packages/content/research/uk-y1-y7-curriculum-source-map.json");
const requiredYears = [1, 2, 3, 4, 5, 6, 7];
const requiredCoreSubjects = ["Mathematics", "English", "Science"];
const allowedStatuses = new Set(["draft", "review", "pilot", "approved", "published", "archived"]);

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});

async function main() {
  const roadmap = await readJSON(roadmapPath);
  const sourceMap = await readJSON(sourceMapPath);
  const sourceIDs = new Set((sourceMap.sources ?? []).map((source) => source.source_id));
  const errors = [];
  const warnings = [];

  requireText(roadmap.version, "version", errors);
  requireText(roadmap.status, "status", errors);
  requireText(roadmap.purpose, "purpose", errors);

  const years = Array.isArray(roadmap.years) ? roadmap.years : [];
  if (years.length === 0) {
    errors.push("years must include Year 1 to Year 7 entries");
  }

  const seenYears = new Set();
  const seenPackIDs = new Set();
  for (const yearEntry of years) {
    const year = yearEntry.year;
    if (!requiredYears.includes(year)) {
      errors.push(`unexpected year entry: ${year}`);
      continue;
    }
    if (seenYears.has(year)) {
      errors.push(`duplicate year entry: Year ${year}`);
    }
    seenYears.add(year);
    requireText(yearEntry.phase, `Year ${year} phase`, errors);

    const packs = Array.isArray(yearEntry.priority_packs) ? yearEntry.priority_packs : [];
    if (packs.length < 3) {
      errors.push(`Year ${year} must have at least three priority packs`);
    }
    const subjects = new Set(packs.map((pack) => pack.subject));
    for (const subject of requiredCoreSubjects) {
      if (!subjects.has(subject)) {
        errors.push(`Year ${year} is missing ${subject} in priority_packs`);
      }
    }
    for (const pack of packs) {
      validatePackRef(pack, year, sourceIDs, seenPackIDs, errors, warnings);
    }
  }

  for (const year of requiredYears) {
    if (!seenYears.has(year)) errors.push(`missing Year ${year}`);
  }

  const totalPacks = years.reduce((total, year) => total + (year.priority_packs?.length ?? 0), 0);
  const pilotPacks = years.flatMap((year) => year.priority_packs ?? []).filter((pack) => pack.target_status === "pilot").length;
  if (pilotPacks < requiredYears.length) {
    warnings.push(`pilot pack count is low (${pilotPacks}/${requiredYears.length})`);
  }

  for (const warning of warnings) console.log(`warning: ${warning}`);
  if (errors.length > 0) {
    for (const error of errors) console.log(`error: ${error}`);
    console.log(`roadmap invalid years=${years.length} packs=${totalPacks} errors=${errors.length} warnings=${warnings.length}`);
    process.exit(1);
  }
  console.log(`roadmap valid years=${years.length} packs=${totalPacks} pilot_packs=${pilotPacks} warnings=${warnings.length}`);
}

function validatePackRef(pack, year, sourceIDs, seenPackIDs, errors, warnings) {
  requireText(pack.pack_id, `Year ${year} pack_id`, errors);
  requireText(pack.subject, `Year ${year} ${pack.pack_id ?? "(unknown)"} subject`, errors);
  requireText(pack.strand, `Year ${year} ${pack.pack_id ?? "(unknown)"} strand`, errors);
  if (!Number.isInteger(pack.priority) || pack.priority < 1) {
    errors.push(`Year ${year} ${pack.pack_id ?? "(unknown)"} priority must be a positive integer`);
  }
  if (!allowedStatuses.has(pack.target_status)) {
    errors.push(`Year ${year} ${pack.pack_id ?? "(unknown)"} target_status is invalid`);
  }
  if (pack.pack_id) {
    if (seenPackIDs.has(pack.pack_id)) errors.push(`duplicate pack_id: ${pack.pack_id}`);
    seenPackIDs.add(pack.pack_id);
    if (!pack.pack_id.includes(`y${year}-`)) {
      warnings.push(`${pack.pack_id} does not include y${year} in its id`);
    }
  }
  if (!Array.isArray(pack.source_ids) || pack.source_ids.length === 0) {
    errors.push(`Year ${year} ${pack.pack_id ?? "(unknown)"} must include source_ids`);
  } else {
    for (const sourceID of pack.source_ids) {
      if (!sourceIDs.has(sourceID)) {
        errors.push(`Year ${year} ${pack.pack_id ?? "(unknown)"} unknown source_id: ${sourceID}`);
      }
    }
  }
}

function requireText(value, label, errors) {
  if (typeof value !== "string" || value.trim() === "") {
    errors.push(`${label} is required`);
  }
}

async function readJSON(file) {
  try {
    return JSON.parse(await readFile(file, "utf8"));
  } catch (error) {
    throw new Error(`Could not read JSON ${file}: ${error.message}`);
  }
}
