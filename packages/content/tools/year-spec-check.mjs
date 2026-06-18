#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const specPath = path.join(repoRoot, "packages/content/roadmaps/y1-y7-equal-depth-year-spec.json");
const requiredYears = [1, 2, 3, 4, 5, 6, 7];
const requiredSubjects = ["Mathematics", "English", "Science"];

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});

async function main() {
  const spec = await readJSON(specPath);
  const errors = [];
  requireText(spec.version, "version", errors);
  requireText(spec.status, "status", errors);
  requireText(spec.purpose, "purpose", errors);

  const years = Array.isArray(spec.years) ? spec.years : [];
  const seen = new Set();
  for (const entry of years) {
    if (!requiredYears.includes(entry.year)) {
      errors.push(`unexpected year: ${entry.year}`);
      continue;
    }
    if (seen.has(entry.year)) errors.push(`duplicate Year ${entry.year}`);
    seen.add(entry.year);
    validateYear(entry, errors);
  }
  for (const year of requiredYears) {
    if (!seen.has(year)) errors.push(`missing Year ${year}`);
  }

  if (errors.length > 0) {
    for (const error of errors) console.log(`error: ${error}`);
    console.log(`year-spec invalid years=${years.length} errors=${errors.length}`);
    process.exit(1);
  }
  console.log(`year-spec valid years=${years.length}`);
}

function validateYear(entry, errors) {
  const label = `Year ${entry.year}`;
  requireText(entry.world_key, `${label} world_key`, errors);
  requireText(entry.world_name, `${label} world_name`, errors);
  requireText(entry.learner_need, `${label} learner_need`, errors);
  requireText(entry.companion_role, `${label} companion_role`, errors);
  requireArray(entry.flagship_interactions, `${label} flagship_interactions`, errors, 5);
  requireArray(entry.animation_language, `${label} animation_language`, errors, 5);
  requireArray(entry.inclusion_model, `${label} inclusion_model`, errors, 6);
  requireArray(entry.assessment_evidence, `${label} assessment_evidence`, errors, 5);

  const contract = entry.curriculum_contract ?? {};
  for (const subject of requiredSubjects) {
    requireArray(contract[subject], `${label} ${subject} contract`, errors, 3);
  }

  const expectations = entry.proof_pack_expectations ?? {};
  requireArray(expectations.first_packs, `${label} first_packs`, errors, 3);
  if (!Number.isInteger(expectations.pilot_variant_minimum) || expectations.pilot_variant_minimum < 150) {
    errors.push(`${label} pilot_variant_minimum must be at least 150`);
  }
  if (!Number.isInteger(expectations.mature_variant_target) || expectations.mature_variant_target < 500) {
    errors.push(`${label} mature_variant_target must be at least 500`);
  }
}

function requireText(value, label, errors) {
  if (typeof value !== "string" || value.trim() === "") {
    errors.push(`${label} is required`);
  }
}

function requireArray(value, label, errors, minItems) {
  if (!Array.isArray(value)) {
    errors.push(`${label} must be an array`);
    return;
  }
  if (value.length < minItems) {
    errors.push(`${label} needs at least ${minItems} items`);
  }
}

async function readJSON(file) {
  try {
    return JSON.parse(await readFile(file, "utf8"));
  } catch (error) {
    throw new Error(`Could not read JSON ${file}: ${error.message}`);
  }
}
