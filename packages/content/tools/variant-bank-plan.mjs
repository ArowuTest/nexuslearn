#!/usr/bin/env node
import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const packRoot = path.join(repoRoot, "packages/content/packs");
const minimumTargets = {
  pilot: 150,
  release: 300,
  mature: 500,
};

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});

async function main() {
  const files = await findPackFiles(packRoot);
  const errors = [];
  const summaries = [];
  for (const file of files) {
    const pack = await readJSON(file);
    const targets = pack.practice?.variant_targets ?? {};
    const blueprints = Array.isArray(pack.variant_blueprints) ? pack.variant_blueprints : [];
    const planned = blueprints.reduce((total, item) => total + (Number.isInteger(item.count) ? item.count : 0), 0);
    const formats = new Set(blueprints.map((item) => item.format));
    const requiredFormats = pack.objective?.mastery?.required_formats ?? [];

    for (const [name, minimum] of Object.entries(minimumTargets)) {
      if (!Number.isInteger(targets[name]) || targets[name] < minimum) {
        errors.push(`${pack.pack_id} ${name} target must be at least ${minimum}`);
      }
    }
    if (Number.isInteger(targets.mature) && planned < targets.mature) {
      errors.push(`${pack.pack_id} blueprint plan is below mature target (${planned}/${targets.mature})`);
    }
    for (const format of requiredFormats) {
      if (!formats.has(format)) {
        errors.push(`${pack.pack_id} blueprint plan missing required format ${format}`);
      }
    }
    summaries.push({
      pack_id: pack.pack_id,
      year: pack.source_alignment?.year,
      subject: pack.source_alignment?.subject,
      sample_variants: pack.question_variants?.length ?? 0,
      pilot: targets.pilot ?? 0,
      release: targets.release ?? 0,
      mature: targets.mature ?? 0,
      deep: targets.deep ?? 0,
      planned,
      blueprint_count: blueprints.length,
    });
  }

  for (const item of summaries.sort((a, b) => a.year - b.year || a.pack_id.localeCompare(b.pack_id))) {
    console.log(`${item.pack_id} year=${item.year} subject=${item.subject} sample=${item.sample_variants} pilot=${item.pilot} release=${item.release} mature=${item.mature} deep=${item.deep} planned=${item.planned} blueprints=${item.blueprint_count}`);
  }
  if (errors.length > 0) {
    for (const error of errors) console.log(`error: ${error}`);
    console.log(`variant-plan invalid packs=${summaries.length} errors=${errors.length}`);
    process.exit(1);
  }
  const totalPlanned = summaries.reduce((total, item) => total + item.planned, 0);
  console.log(`variant-plan valid packs=${summaries.length} planned_variants=${totalPlanned}`);
}

async function findPackFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await findPackFiles(fullPath));
    } else if (entry.name.endsWith(".pack.json") || entry.name.endsWith(".pack.sample.json")) {
      const info = await stat(fullPath);
      if (info.isFile()) files.push(fullPath);
    }
  }
  return files;
}

async function readJSON(file) {
  try {
    return JSON.parse(await readFile(file, "utf8"));
  } catch (error) {
    throw new Error(`Could not read JSON ${file}: ${error.message}`);
  }
}
