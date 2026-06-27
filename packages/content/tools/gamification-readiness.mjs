#!/usr/bin/env node
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const packsDir = path.join(repoRoot, "packages/content/packs");
const requiredAnimationStates = [
  "intro",
  "concept",
  "thinking",
  "hint",
  "repair",
  "success",
  "mastery",
  "world_growth",
  "reduced_motion_fallback",
];
const requiredAdaptiveSupports = [
  "low_sensory",
  "reduced_motion",
  "audio_first",
  "reading_support",
  "attention_support",
  "processing_support",
  "confidence_support",
  "eal_support",
];
const unsafeRewardPattern = /\b(?:leaderboard|loot\s*box|speed\s*bonus|daily\s*penalty|streak\s*penalty)\b/i;

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});

async function main() {
  const files = (await readdir(packsDir)).filter((file) => file.endsWith(".json")).sort();
  const packs = await Promise.all(files.map(async (file) => ({
    file,
    data: JSON.parse(await readFile(path.join(packsDir, file), "utf8")),
  })));
  const errors = [];
  const warnings = [];
  const years = new Map();

  for (const { file, data: pack } of packs) {
    const label = pack.pack_id || file;
    const year = Number(pack.source_alignment?.year);
    const teaching = asArray(pack.teaching_sequence);
    const manipulatives = asArray(pack.manipulatives);
    const formats = asArray(pack.practice?.formats);
    const blueprints = asArray(pack.variant_blueprints);
    const questions = asArray(pack.question_variants);

    if (!Number.isInteger(year) || year < 1 || year > 7) errors.push(`${label}: valid Year 1-7 source alignment is required`);
    if (teaching.length < 6) errors.push(`${label}: needs at least 6 teach-practise-repair stages`);
    if (formats.length < 3) errors.push(`${label}: needs at least 3 practice formats`);
    if (blueprints.length < 5) errors.push(`${label}: needs at least 5 variant blueprints`);

    const minimumManipulatives = year === 7 ? 2 : 1;
    if (manipulatives.length < minimumManipulatives) {
      errors.push(`${label}: Year ${year} needs at least ${minimumManipulatives} meaningful manipulatives`);
    } else if (year < 7 && manipulatives.length < 2) {
      warnings.push(`${label}: add a second distinct manipulative in the next depth pass`);
    }

    const ids = new Set();
    for (const manipulative of manipulatives) {
      requireText(manipulative.id, `${label}: manipulative id`, errors);
      requireText(manipulative.type, `${label}: manipulative ${manipulative.id || "unknown"} type`, errors);
      requireText(manipulative.purpose, `${label}: manipulative ${manipulative.id || "unknown"} purpose`, errors);
      requireText(manipulative.interaction_notes, `${label}: manipulative ${manipulative.id || "unknown"} interaction notes`, errors);
      requireText(manipulative.accessibility_notes, `${label}: manipulative ${manipulative.id || "unknown"} accessibility notes`, errors);
      if (ids.has(manipulative.id)) errors.push(`${label}: duplicate manipulative id ${manipulative.id}`);
      ids.add(manipulative.id);
    }

    for (const state of requiredAnimationStates) {
      requireText(pack.animation_plan?.[state], `${label}: animation ${state}`, errors);
    }
    for (const support of requiredAdaptiveSupports) {
      requireText(pack.adaptive_support?.[support], `${label}: adaptive support ${support}`, errors);
    }
    for (const question of questions) {
      requireText(question.animation_hook, `${label}: question ${question.id || "unknown"} animation hook`, errors);
    }

    const rewardLanguage = [pack.animation_plan?.success, pack.animation_plan?.mastery, pack.animation_plan?.world_growth]
      .filter(Boolean)
      .join(" ");
    if (unsafeRewardPattern.test(rewardLanguage)) {
      errors.push(`${label}: reward plan uses unsafe pressure or chance-based language`);
    }

    const summary = years.get(year) ?? { packs: 0, manipulatives: 0, formats: 0, blueprints: 0 };
    summary.packs += 1;
    summary.manipulatives += manipulatives.length;
    summary.formats += formats.length;
    summary.blueprints += blueprints.length;
    years.set(year, summary);
  }

  for (const [year, summary] of [...years.entries()].sort(([left], [right]) => left - right)) {
    console.log(
      `gamification Year ${year} packs=${summary.packs} manipulatives=${summary.manipulatives} formats=${summary.formats} blueprints=${summary.blueprints}`,
    );
  }
  for (const warning of warnings) console.log(`warning: ${warning}`);
  if (errors.length > 0) {
    for (const error of errors) console.log(`error: ${error}`);
    console.log(`gamification-readiness invalid packs=${packs.length} errors=${errors.length} warnings=${warnings.length}`);
    process.exit(1);
  }
  console.log(`gamification-readiness valid packs=${packs.length} errors=0 warnings=${warnings.length}`);
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function requireText(value, label, errors) {
  if (typeof value !== "string" || value.trim() === "") errors.push(`${label} is required`);
}
