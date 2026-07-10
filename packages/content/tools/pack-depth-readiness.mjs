#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const packsDir = path.join(repoRoot, "packages/content/packs");
const coverageDir = path.join(repoRoot, "packages/content/generated/coverage");
const publicDir = path.join(repoRoot, "apps/web/public/content");

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
const floors = {
  teaching_stages: 6,
  manipulatives: 2,
  practice_formats: 3,
  variant_blueprints: 5,
  authored_variants: 180,
  pilot_target: 180,
  release_target: 420,
  mature_target: 1100,
  deep_target: 1700,
};

const packFiles = fs.readdirSync(packsDir).filter((file) => file.endsWith(".json")).sort();
const packs = packFiles.map((file) => ({ file, data: readJSON(path.join(packsDir, file)) }));
const failures = [];
const warnings = [];

const packSummaries = packs.map(({ file, data }) => {
  const label = data.pack_id ?? file;
  const year = Number(data.source_alignment?.year);
  const subject = data.source_alignment?.subject ?? "Unknown";
  const teachingStages = asArray(data.teaching_sequence).length;
  const manipulatives = asArray(data.manipulatives).length;
  const manipulativeTypes = new Set(asArray(data.manipulatives).map((item) => item.type).filter(Boolean)).size;
  const practiceFormats = asArray(data.practice?.formats).length;
  const variantBlueprints = asArray(data.variant_blueprints).length;
  const authoredVariants = asArray(data.question_variants).length;
  const targets = data.practice?.variant_targets ?? {};
  const animationComplete = requiredAnimationStates.filter((state) => hasText(data.animation_plan?.[state])).length;
  const adaptiveComplete = requiredAdaptiveSupports.filter((support) => hasText(data.adaptive_support?.[support])).length;
  const serialisedPack = JSON.stringify(data);
  const audioEquivalent = hasText(data.accessibility?.audio_equivalent)
    || hasText(data.send_support?.audio_equivalent)
    || /speech and handwriting are optional|aac|adult-scribed|text equivalent|audio[-_ ]first|partner-reading|read-aloud|read aloud/i.test(serialisedPack);
  const reducedMotion = hasText(data.animation_plan?.reduced_motion_fallback) || hasText(data.adaptive_support?.reduced_motion);
  const noTimerPenalty = /no timer|never timed|no punitive|no penalty|never lose earned progress|remove timers|without losing|allow revision|allow repeated reading|no precision drag/i.test(serialisedPack);
  const packFailures = [];
  const packWarnings = [];

  requireFloor(teachingStages, floors.teaching_stages, `${label}: teaching stages`, packFailures);
  requireFloor(manipulatives, floors.manipulatives, `${label}: manipulatives`, packFailures);
  requireFloor(manipulativeTypes, floors.manipulatives, `${label}: distinct manipulative interaction types`, packFailures);
  requireFloor(practiceFormats, floors.practice_formats, `${label}: practice formats`, packFailures);
  requireFloor(variantBlueprints, floors.variant_blueprints, `${label}: variant blueprints`, packFailures);
  requireFloor(authoredVariants, floors.authored_variants, `${label}: authored variants`, packFailures);
  requireFloor(Number(targets.pilot ?? 0), floors.pilot_target, `${label}: pilot variant target`, packFailures);
  requireFloor(Number(targets.release ?? 0), floors.release_target, `${label}: release variant target`, packFailures);
  requireFloor(Number(targets.mature ?? 0), floors.mature_target, `${label}: mature variant target`, packFailures);
  requireFloor(Number(targets.deep ?? 0), floors.deep_target, `${label}: deep variant target`, packFailures);
  requireFloor(animationComplete, requiredAnimationStates.length, `${label}: animation states`, packFailures);
  requireFloor(adaptiveComplete, requiredAdaptiveSupports.length, `${label}: adaptive/SEND supports`, packFailures);

  if (!audioEquivalent) packWarnings.push(`${label}: explicit audio-equivalent accessibility statement was not found`);
  if (!reducedMotion) packFailures.push(`${label}: reduced-motion route is required`);
  if (!noTimerPenalty) packWarnings.push(`${label}: no-timer/no-penalty language should be explicit for anxious or SEND learners`);
  failures.push(...packFailures);
  warnings.push(...packWarnings);

  const depthScore = scorePack({
    teachingStages,
    manipulatives,
    manipulativeTypes,
    practiceFormats,
    variantBlueprints,
    authoredVariants,
    targets,
    animationComplete,
    adaptiveComplete,
    audioEquivalent,
    reducedMotion,
    noTimerPenalty,
  });

  return {
    pack_id: label,
    file,
    year,
    subject,
    topic: data.source_alignment?.topic ?? "",
    status: packFailures.length ? "blocked" : packWarnings.length ? "needs_attention" : "depth_ready",
    depth_score: depthScore,
    teaching_stages: teachingStages,
    manipulatives,
    manipulative_types: manipulativeTypes,
    practice_formats: practiceFormats,
    variant_blueprints: variantBlueprints,
    authored_variants: authoredVariants,
    variant_targets: {
      pilot: Number(targets.pilot ?? 0),
      release: Number(targets.release ?? 0),
      mature: Number(targets.mature ?? 0),
      deep: Number(targets.deep ?? 0),
    },
    animation_states: `${animationComplete}/${requiredAnimationStates.length}`,
    adaptive_supports: `${adaptiveComplete}/${requiredAdaptiveSupports.length}`,
    audio_equivalent: audioEquivalent,
    reduced_motion: reducedMotion,
    no_timer_or_penalty: noTimerPenalty,
    warnings: packWarnings,
    failures: packFailures,
  };
});

const years = groupByYearAndSubject(packSummaries);
const totals = {
  packs: packSummaries.length,
  depth_ready_packs: packSummaries.filter((pack) => pack.status === "depth_ready").length,
  needs_attention_packs: packSummaries.filter((pack) => pack.status === "needs_attention").length,
  blocked_packs: packSummaries.filter((pack) => pack.status === "blocked").length,
  authored_variants: sum(packSummaries, "authored_variants"),
  pilot_target: sumTargets(packSummaries, "pilot"),
  release_target: sumTargets(packSummaries, "release"),
  mature_target: sumTargets(packSummaries, "mature"),
  deep_target: sumTargets(packSummaries, "deep"),
  min_authored_variants: min(packSummaries, "authored_variants"),
  min_pilot_target: Math.min(...packSummaries.map((pack) => pack.variant_targets.pilot)),
  min_release_target: Math.min(...packSummaries.map((pack) => pack.variant_targets.release)),
  min_mature_target: Math.min(...packSummaries.map((pack) => pack.variant_targets.mature)),
  min_deep_target: Math.min(...packSummaries.map((pack) => pack.variant_targets.deep)),
  average_depth_score: Math.round(sum(packSummaries, "depth_score") / Math.max(1, packSummaries.length)),
  failures: failures.length,
  warnings: warnings.length,
};

const report = {
  version: 1,
  status: failures.length ? "blocked_depth_gaps" : warnings.length ? "depth_ready_with_attention_items" : "depth_ready",
  generated_by: "packages/content/tools/pack-depth-readiness.mjs",
  policy: {
    floor_meaning: "180 variants is the pilot seed floor, not the mature depth target.",
    floors,
    required_animation_states: requiredAnimationStates,
    required_adaptive_supports: requiredAdaptiveSupports,
    promotion_note: "Runtime promotion still requires curriculum, teacher, SEND/accessibility, safeguarding, audio and pilot evidence gates.",
  },
  totals,
  years,
  attention_queue: packSummaries
    .filter((pack) => pack.status !== "depth_ready")
    .sort((a, b) => a.depth_score - b.depth_score || compareText(a.pack_id, b.pack_id))
    .slice(0, 30),
  packs: packSummaries,
  failures,
  warnings,
};

fs.mkdirSync(coverageDir, { recursive: true });
fs.mkdirSync(publicDir, { recursive: true });
const json = `${JSON.stringify(report, null, 2)}\n`;
const html = renderHTML(report);
fs.writeFileSync(path.join(coverageDir, "pack-depth-readiness.json"), json);
fs.writeFileSync(path.join(publicDir, "pack-depth-readiness.json"), json);
fs.writeFileSync(path.join(coverageDir, "pack-depth-readiness.html"), html);
fs.writeFileSync(path.join(publicDir, "pack-depth-readiness.html"), html);

console.log(`pack-depth-readiness packs=${totals.packs} ready=${totals.depth_ready_packs} attention=${totals.needs_attention_packs} blocked=${totals.blocked_packs} variants=${totals.authored_variants}`);
console.log(`pack-depth-readiness targets pilot=${totals.pilot_target} release=${totals.release_target} mature=${totals.mature_target} deep=${totals.deep_target} min_pilot=${totals.min_pilot_target}`);
if (failures.length) {
  for (const failure of failures) console.error(`depth failure ${failure}`);
  process.exit(1);
}

function scorePack(pack) {
  let score = 0;
  score += Math.min(15, Math.round((pack.teachingStages / floors.teaching_stages) * 15));
  score += Math.min(10, Math.round((pack.manipulatives / floors.manipulatives) * 10));
  score += Math.min(10, Math.round((pack.manipulativeTypes / floors.manipulatives) * 10));
  score += Math.min(10, Math.round((pack.practiceFormats / floors.practice_formats) * 10));
  score += Math.min(10, Math.round((pack.variantBlueprints / floors.variant_blueprints) * 10));
  score += Math.min(15, Math.round((pack.authoredVariants / floors.authored_variants) * 15));
  score += Math.min(10, Math.round((Number(pack.targets?.mature ?? 0) / floors.mature_target) * 10));
  score += Math.min(10, Math.round((pack.animationComplete / requiredAnimationStates.length) * 10));
  score += Math.min(8, Math.round((pack.adaptiveComplete / requiredAdaptiveSupports.length) * 8));
  if (pack.audioEquivalent) score += 1;
  if (pack.reducedMotion) score += 1;
  if (pack.noTimerPenalty) score += 1;
  return Math.min(100, score);
}

function groupByYearAndSubject(packs) {
  const map = new Map();
  for (const pack of packs) {
    const key = `${pack.year}|${pack.subject}`;
    const row = map.get(key) ?? {
      year: pack.year,
      subject: pack.subject,
      packs: 0,
      authored_variants: 0,
      pilot_target: 0,
      release_target: 0,
      mature_target: 0,
      deep_target: 0,
      min_depth_score: 100,
      average_depth_score: 0,
    };
    row.packs += 1;
    row.authored_variants += pack.authored_variants;
    row.pilot_target += pack.variant_targets.pilot;
    row.release_target += pack.variant_targets.release;
    row.mature_target += pack.variant_targets.mature;
    row.deep_target += pack.variant_targets.deep;
    row.min_depth_score = Math.min(row.min_depth_score, pack.depth_score);
    row.average_depth_score += pack.depth_score;
    map.set(key, row);
  }
  return Array.from(map.values())
    .map((row) => ({ ...row, average_depth_score: Math.round(row.average_depth_score / Math.max(1, row.packs)) }))
    .sort((a, b) => Number(a.year) - Number(b.year) || compareText(a.subject, b.subject));
}

function requireFloor(value, floor, label, errors) {
  if (value < floor) errors.push(`${label} ${value} is below required floor ${floor}`);
}

function renderHTML(summary) {
  const cards = [
    [summary.totals.packs, "packs"],
    [summary.totals.authored_variants, "authored variants"],
    [summary.totals.pilot_target, "pilot seed target"],
    [summary.totals.mature_target, "mature depth target"],
    [summary.totals.deep_target, "deep mastery target"],
    [summary.totals.average_depth_score, "average depth score"],
  ].map(([value, label]) => `<div class="card"><strong>${value}</strong><span>${escapeHTML(label)}</span></div>`).join("");
  const yearRows = summary.years.map((year) => `<tr><td>Year ${year.year}</td><td>${escapeHTML(year.subject)}</td><td>${year.packs}</td><td>${year.authored_variants}</td><td>${year.pilot_target}</td><td>${year.mature_target}</td><td>${year.deep_target}</td><td>${year.min_depth_score}</td><td>${year.average_depth_score}</td></tr>`).join("");
  const queueRows = (summary.attention_queue.length ? summary.attention_queue : summary.packs.slice(0, 20)).map((pack) => `<tr><td><code>${escapeHTML(pack.pack_id)}</code><br>Y${escapeHTML(pack.year)} ${escapeHTML(pack.subject)}</td><td>${escapeHTML(pack.status)}</td><td>${pack.depth_score}</td><td>${pack.authored_variants}</td><td>${pack.variant_targets.pilot}/${pack.variant_targets.release}/${pack.variant_targets.mature}/${pack.variant_targets.deep}</td><td>${escapeHTML([...pack.failures, ...pack.warnings].join("; ") || "No depth gaps found")}</td></tr>`).join("");
  return `<!doctype html><html lang="en-GB"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>NexusLearn pack depth readiness</title><style>body{font-family:Inter,system-ui,sans-serif;margin:0;background:#f7fbff;color:#17233f}main{max-width:1200px;margin:auto;padding:32px}.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:12px}.card{background:white;border:1px solid #dbe4ef;padding:16px}.card strong,.card span{display:block}.card strong{font-size:28px}.truth{margin:18px 0;padding:16px;background:#fff4d5;border-left:4px solid #ffbf45}table{width:100%;border-collapse:collapse;background:white;margin-top:16px}th,td{padding:10px;border:1px solid #dbe4ef;text-align:left;vertical-align:top}th{background:#17233f;color:white}code{overflow-wrap:anywhere}</style></head><body><main><h1>Pack Depth Readiness</h1><p class="truth"><strong>180 is treated as a pilot seed floor, not the full product depth.</strong> Mature and deep targets remain visible so curriculum scale is not confused with first-pass pilot volume.</p><div class="cards">${cards}</div><h2>Year/subject depth</h2><table><thead><tr><th>Year</th><th>Subject</th><th>Packs</th><th>Authored</th><th>Pilot</th><th>Mature</th><th>Deep</th><th>Min score</th><th>Avg score</th></tr></thead><tbody>${yearRows}</tbody></table><h2>${summary.attention_queue.length ? "Attention queue" : "Sample ready packs"}</h2><table><thead><tr><th>Pack</th><th>Status</th><th>Score</th><th>Authored variants</th><th>Pilot/release/mature/deep</th><th>Notes</th></tr></thead><tbody>${queueRows}</tbody></table></main></body></html>\n`;
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function readJSON(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function hasText(value) {
  return typeof value === "string" && value.trim() !== "";
}

function sum(items, key) {
  return items.reduce((total, item) => total + Number(item[key] ?? 0), 0);
}

function sumTargets(items, key) {
  return items.reduce((total, item) => total + Number(item.variant_targets?.[key] ?? 0), 0);
}

function min(items, key) {
  return Math.min(...items.map((item) => Number(item[key] ?? 0)));
}

function compareText(left, right) {
  const a = String(left);
  const b = String(right);
  return a < b ? -1 : a > b ? 1 : 0;
}

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
}
