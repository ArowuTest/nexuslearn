#!/usr/bin/env node
import { mkdir, readFile, readdir, stat, writeFile, copyFile } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const packRoot = path.join(repoRoot, "packages/content/packs");
const overlayPath = path.join(repoRoot, "packages/content/generated/coverage/runtime-spine-overlays.json");
const outDir = path.resolve(argValue("--out") ?? path.join(repoRoot, "packages/content/generated/coverage"));
const webDir = path.join(repoRoot, "apps/web/public/content");
const runtimeStatuses = new Set(["approved", "published", "live"]);
const runtimeSpineOverlays = readRuntimeSpineOverlays();

const packs = [];
const errors = [];
const warnings = [];
for (const file of await findPackFiles(packRoot)) {
  const pack = JSON.parse(await readFile(file, "utf8"));
  const result = inspectPack(pack);
  packs.push(result);
  errors.push(...result.errors.map((message) => `${pack.pack_id}: ${message}`));
  warnings.push(...result.warnings.map((message) => `${pack.pack_id}: ${message}`));
}

const report = {
  version: 1,
  status: "phase-3-variant-quality",
  generated_by: "packages/content/tools/variant-quality.mjs",
  totals: {
    packs: packs.length,
    variants: packs.reduce((sum, pack) => sum + pack.total_variants, 0),
    runtime_variants: packs.reduce((sum, pack) => sum + pack.runtime_variants, 0),
    review_candidates: packs.reduce((sum, pack) => sum + pack.review_candidates, 0),
    review_readability_calibrations: packs.reduce((sum, pack) => sum + pack.review_readability_calibrations, 0),
    errors: errors.length,
    warnings: warnings.length,
  },
  errors,
  warnings,
  packs: packs.sort((a, b) => a.year - b.year || a.pack_id.localeCompare(b.pack_id)),
};

await mkdir(outDir, { recursive: true });
await mkdir(webDir, { recursive: true });
const jsonPath = path.join(outDir, "variant-quality.json");
const htmlPath = path.join(outDir, "variant-quality.html");
await writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
await writeFile(htmlPath, renderHTML(report), "utf8");
await copyFile(jsonPath, path.join(webDir, "variant-quality.json"));
console.log(`variant-quality packs=${report.totals.packs} variants=${report.totals.variants} runtime=${report.totals.runtime_variants} review=${report.totals.review_candidates} errors=${errors.length} warnings=${warnings.length}`);
if (errors.length > 0) {
  for (const error of errors) console.error(`error: ${error}`);
  process.exit(1);
}

function inspectPack(pack) {
  const variants = [...(Array.isArray(pack.question_variants) ? pack.question_variants : []), ...(runtimeSpineOverlays[pack.pack_id] ?? [])];
  const ids = new Set();
  const signatures = new Set();
  const errors = [];
  const warnings = [];
  const reviewReadabilityCalibrations = [];
  const formats = {};
  const statuses = {};
  const misconceptions = {};
  for (const variant of variants) {
    if (ids.has(variant.id)) errors.push(`duplicate variant id ${variant.id}`);
    ids.add(variant.id);
    const signature = variantSignature(variant);
    if (signatures.has(signature)) errors.push(`duplicate prompt/answer/format signature ${variant.id}`);
    signatures.add(signature);
    formats[variant.format] = (formats[variant.format] ?? 0) + 1;
    statuses[variant.status] = (statuses[variant.status] ?? 0) + 1;
    if (variant.misconception_tag) misconceptions[variant.misconception_tag] = (misconceptions[variant.misconception_tag] ?? 0) + 1;
    validateArithmetic(variant, errors);
    validatePhonics(variant, errors);
    validateParticleScience(pack, variant, errors);
    if (variant.status === "review" && variant.body?.review_batch && !variant.body?.variant_blueprint_id && !variant.body?.review_provenance) {
      errors.push(`${variant.id} has review provenance but no variant_blueprint_id or curated provenance`);
    }
    if ((variant.hints ?? []).some((hint, index, hints) => hints.indexOf(hint) !== index)) {
      errors.push(`${variant.id} repeats an identical hint`);
    }
    if (String(variant.body?.prompt ?? "").length > (pack.source_alignment?.year <= 2 ? 130 : 220)) {
      if (runtimeStatuses.has(variant.status)) {
        warnings.push(`${variant.id} runtime prompt may be too long for Year ${pack.source_alignment?.year}`);
      } else {
        reviewReadabilityCalibrations.push(`${variant.id} review prompt should be chunked or shortened before promotion`);
      }
    }
  }
  const requiredFormats = pack.objective?.mastery?.required_formats ?? [];
  for (const format of requiredFormats) {
    if (!formats[format]) errors.push(`required format ${format} has no authored variant`);
  }
  const reviewCandidates = variants.filter((variant) => variant.status === "review" && variant.body?.review_batch).length;
  const runtimeVariants = variants.filter((variant) => runtimeStatuses.has(variant.status)).length;
  if (reviewCandidates > 0 && runtimeVariants < 3) warnings.push("review bank exists but fewer than three runtime variants protect the live path");
  return {
    pack_id: pack.pack_id,
    year: pack.source_alignment?.year,
    subject: pack.source_alignment?.subject,
    total_variants: variants.length,
    runtime_variants: runtimeVariants,
    review_candidates: reviewCandidates,
    review_readability_calibrations: reviewReadabilityCalibrations.length,
    pilot_target: pack.practice?.variant_targets?.pilot ?? 150,
    formats,
    statuses,
    misconceptions,
    errors,
    warnings,
    review_readability_calibrations_detail: reviewReadabilityCalibrations,
  };
}

function readRuntimeSpineOverlays() {
  if (!existsSync(overlayPath)) return {};
  return JSON.parse(readFileSync(overlayPath, "utf8")).overlays ?? {};
}

function validateArithmetic(variant, errors) {
  const expected = Number(variant.expected_answer?.value);
  if (!Number.isFinite(expected)) return;
  if (["timed-recall", "array-build"].includes(variant.format)) {
    const a = Number(variant.body?.a);
    const b = Number(variant.body?.b);
    if (Number.isFinite(a) && Number.isFinite(b) && a * b !== expected) {
      errors.push(`${variant.id} expected ${expected} but ${a} x ${b} is ${a * b}`);
    }
  }
  if (variant.format === "division-match") {
    const dividend = Number(variant.body?.dividend);
    const groups = Number(variant.body?.groups);
    if (Number.isFinite(dividend) && Number.isFinite(groups) && groups !== 0 && dividend / groups !== expected) {
      errors.push(`${variant.id} expected ${expected} but ${dividend} / ${groups} is ${dividend / groups}`);
    }
  }
}

function validatePhonics(variant, errors) {
  if (!["audio_blend", "tap-choice", "word-build"].includes(variant.format)) return;
  const expected = variant.expected_answer?.value;
  const sounds = Array.isArray(variant.body?.sounds) ? variant.body.sounds.map(String) : [];
  if (sounds.length === 3) {
    const word = sounds.join("");
    const expectedWord = Array.isArray(expected) ? expected.join("") : String(expected ?? "");
    if (word !== expectedWord) errors.push(`${variant.id} sounds ${sounds.join("-")} do not build expected answer ${expectedWord}`);
    if (!Array.isArray(variant.body?.phoneme_ids) || variant.body.phoneme_ids.length !== sounds.length) {
      errors.push(`${variant.id} requires one phoneme_id per grapheme`);
    }
    if (!variant.body?.gpc_progression_stage) errors.push(`${variant.id} requires gpc_progression_stage`);
    if (variant.body?.ssp_programme_mapping !== "required_before_pilot") errors.push(`${variant.id} must require SSP programme mapping before pilot`);
    if (variant.body?.audio_asset_status !== "required") errors.push(`${variant.id} must declare produced phoneme audio as required`);
    if (!Array.isArray(variant.body?.audio_asset_ids) || variant.body.audio_asset_ids.length < sounds.length + 1) {
      errors.push(`${variant.id} requires phoneme and whole-word audio asset IDs`);
    }
    const promptWords = String(variant.body?.prompt ?? "").toLowerCase().match(/[a-z]+/g) ?? [];
    if (variant.format === "word-build" && promptWords.includes(expectedWord.toLowerCase())) {
      errors.push(`${variant.id} prompt reveals the expected word`);
    }
  }
  if (["audio_blend", "tap-choice"].includes(variant.format)) {
    const choices = Array.isArray(variant.body?.choices) ? variant.body.choices.map(String) : [];
    if (!choices.includes(String(expected ?? ""))) errors.push(`${variant.id} choices do not include the expected word`);
  }
  if (variant.format === "word-build" && Array.isArray(expected)) {
    const tiles = Array.isArray(variant.body?.tiles) ? variant.body.tiles.map(String) : [];
    const remaining = [...tiles];
    for (const letter of expected.map(String)) {
      const index = remaining.indexOf(letter);
      if (index < 0) errors.push(`${variant.id} tiles cannot build expected letter ${letter}`);
      else remaining.splice(index, 1);
    }
  }
}

function validateParticleScience(pack, variant, errors) {
  if (pack.pack_id !== "sc-y7-particles-states-of-matter") return;
  if (!["particle-simulation", "model-sort", "explain-choice"].includes(variant.format)) return;
  if (variant.body?.review_batch && variant.body?.particle_count_invariant !== true) {
    errors.push(`${variant.id} must explicitly preserve particle count`);
  }
  if (variant.body?.review_batch && variant.body?.particle_size_invariant !== true) {
    errors.push(`${variant.id} must explicitly preserve particle size`);
  }
  if (["particle-simulation", "explain-choice"].includes(variant.format)) {
    const choices = Array.isArray(variant.body?.choices) ? variant.body.choices.map(String) : [];
    if (!choices.includes(String(variant.expected_answer?.value ?? ""))) errors.push(`${variant.id} choices do not include the scientific expected answer`);
  }
  if (variant.format === "model-sort" && variant.body?.correct_state) {
    const expectedByState = {
      solid: "model_with_close_fixed_particles",
      liquid: "model_with_close_sliding_particles",
      gas: "model_with_far_apart_random_particles",
    };
    if (expectedByState[variant.body.correct_state] !== variant.expected_answer?.value) {
      errors.push(`${variant.id} model answer does not match correct_state ${variant.body.correct_state}`);
    }
  }
}

function variantSignature(variant) {
  return [
    variant.format,
    String(variant.body?.prompt ?? "").trim().toLowerCase().replace(/\s+/g, " "),
    stableStringify(variant.expected_answer ?? {}),
  ].join("|");
}

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function renderHTML(report) {
  const rows = report.packs.map((pack) => `<tr><td><code>${escapeHTML(pack.pack_id)}</code></td><td>Y${pack.year} ${escapeHTML(pack.subject)}</td><td>${pack.total_variants}</td><td>${pack.runtime_variants}</td><td>${pack.review_candidates}</td><td>${pack.pilot_target}</td><td>${Object.entries(pack.formats).map(([key, value]) => `${escapeHTML(key)} ${value}`).join("<br>")}</td><td>${pack.errors.length}</td></tr>`).join("");
  return `<!doctype html><html lang="en-GB"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>NexusLearn variant quality</title><style>body{font-family:Inter,system-ui,sans-serif;margin:32px;color:#17233f;background:#f8fbff}table{width:100%;border-collapse:collapse;background:white}th,td{padding:10px;border:1px solid #dbe7f2;text-align:left;vertical-align:top}th{background:#17233f;color:white}code{font-size:12px}</style></head><body><h1>Variant Quality</h1><p>${report.totals.variants} authored variants; ${report.totals.runtime_variants} runtime approved; ${report.totals.review_candidates} candidates awaiting review.</p><table><thead><tr><th>Pack</th><th>Coverage</th><th>Authored</th><th>Runtime</th><th>Review</th><th>Pilot target</th><th>Formats</th><th>Errors</th></tr></thead><tbody>${rows}</tbody></table></body></html>`;
}

async function findPackFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...await findPackFiles(full));
    else if (entry.name.endsWith(".pack.json") || entry.name.endsWith(".pack.sample.json")) {
      if ((await stat(full)).isFile()) files.push(full);
    }
  }
  return files;
}

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
}

function argValue(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}
