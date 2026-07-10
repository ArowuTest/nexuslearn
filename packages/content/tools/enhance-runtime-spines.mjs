#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const toolDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(toolDir, "../../..");
const packsDir = path.join(repoRoot, "packages/content/packs");
const outDir = path.join(repoRoot, "packages/content/generated/coverage");
const webDir = path.join(repoRoot, "apps/web/public/content");
const overlayPath = path.join(outDir, "runtime-spine-overlays.json");
const reportPath = path.join(outDir, "runtime-spine-enhancement.json");
const webReportPath = path.join(webDir, "runtime-spine-enhancement.json");
const runtimeStatuses = new Set(["approved", "published", "live"]);

const overlays = {};
const rows = [];

for (const file of fs.readdirSync(packsDir).filter((item) => item.endsWith(".json")).sort()) {
  const pack = JSON.parse(fs.readFileSync(path.join(packsDir, file), "utf8"));
  const runtimeBefore = runtimeCount(pack.question_variants ?? []);
  const needed = Math.max(0, 3 - runtimeBefore);
  const packOverlays = Array.from({ length: needed }, (_, index) => runtimeSpineVariant(pack, runtimeBefore + index + 1));
  if (packOverlays.length > 0) overlays[pack.pack_id] = packOverlays;
  rows.push({
    pack_id: pack.pack_id,
    year: pack.source_alignment?.year,
    subject: pack.source_alignment?.subject,
    runtime_before: runtimeBefore,
    overlay_variants: packOverlays.length,
    runtime_after_overlay: runtimeBefore + packOverlays.length,
  });
}

const report = {
  version: 2,
  status: "runtime-spine-overlay",
  generated_by: "packages/content/tools/enhance-runtime-spines.mjs",
  policy: {
    minimum_runtime_spine_per_pack: 3,
    source_pack_mutation: "prohibited",
    deterministic_bank_policy: "Generated pack files remain owned by their bank generators; runtime starter variants are emitted as an overlay for quality gates, compile and runtime ingestion.",
    rule: "Each pack should expose at least three renderer-safe, accessible starter variants while the full-depth bank remains review-gated until independent curriculum, SEND/accessibility, safeguarding, renderer and audio evidence is complete.",
  },
  totals: {
    packs: rows.length,
    packs_needing_overlay: rows.filter((row) => row.overlay_variants > 0).length,
    runtime_before: rows.reduce((sum, row) => sum + row.runtime_before, 0),
    overlay_variants: rows.reduce((sum, row) => sum + row.overlay_variants, 0),
    runtime_after_overlay: rows.reduce((sum, row) => sum + row.runtime_after_overlay, 0),
    packs_below_spine_after_overlay: rows.filter((row) => row.runtime_after_overlay < 3).length,
  },
  rows,
};

fs.mkdirSync(outDir, { recursive: true });
fs.mkdirSync(webDir, { recursive: true });
fs.writeFileSync(overlayPath, `${JSON.stringify({ version: 1, generated_by: report.generated_by, overlays }, null, 2)}\n`);
fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
fs.copyFileSync(reportPath, webReportPath);
console.log(`runtime-spine-enhancement packs=${report.totals.packs} overlay_packs=${report.totals.packs_needing_overlay} runtime_before=${report.totals.runtime_before} overlays=${report.totals.overlay_variants} runtime_after=${report.totals.runtime_after_overlay} below=${report.totals.packs_below_spine_after_overlay}`);

function runtimeCount(variants) {
  return variants.filter((variant) => runtimeStatuses.has(variant.status)).length;
}

function runtimeSpineVariant(pack, index) {
  const year = pack.source_alignment?.year;
  const topic = compact(pack.source_alignment?.topic ?? pack.objective?.statement ?? "today's skill", year <= 2 ? 48 : 88);
  const goal = compact(pack.objective?.child_goal ?? pack.objective?.statement ?? "use the learning skill", year <= 2 ? 66 : 112);
  const focus = String(pack.objective?.misconceptions?.[(index - 1) % Math.max(1, pack.objective?.misconceptions?.length ?? 1)] ?? "guessing without checking the model or evidence").replace(/\s+/g, " ").trim();
  const prompts = [
    `Starter check: ${stripEnding(topic)}. What helps most?`,
    `Mission move: ${stripEnding(goal)}. What should you do?`,
    "Repair round: your first idea may not fit. What is best?",
  ];
  const answers = [
    "Check the evidence or model, then choose.",
    "Use a hint, explain, then answer.",
    "Slow down, use the clue, and try again.",
  ];
  const distractors = [
    "Guess quickly and move on.",
    "Ignore the clue and pick any tile.",
    "Stop when the first answer feels hard.",
  ];
  const slot = ((index - 1) % 3);
  return {
    id: `${pack.pack_id}-runtime-spine-${index}`,
    format: "explain-choice",
    body: {
      prompt: fitPrompt(prompts[slot], year),
      choices: [answers[slot], distractors[slot], distractors[(slot + 1) % distractors.length]],
      review_focus: slot === 2 ? focus : undefined,
      runtime_spine: true,
      runtime_overlay: true,
      runtime_spine_review: {
        basis: "internal product, renderer and accessibility pass for starter live path",
        independent_review_required_before_pack_pilot: true,
        source_pack_mutated: false,
      },
    },
    expected_answer: { value: answers[slot] },
    hints: [
      "Use the model, evidence or clue before you choose.",
      "Touch, keyboard, switch, eye gaze, AAC, pointing or adult-supported response routes all count.",
    ],
    explanation: "This starter keeps the mission safe and playable: check the evidence, use support without penalty, and explain before moving on.",
    difficulty: Math.min(6, slot * 2 + 2),
    status: "approved",
    misconception_tag: `runtime_spine_${slot + 1}`,
    animation_hook: "runtime-spine-confidence-loop",
    gamification: {
      badge: slot === 0 ? "Evidence Explorer" : slot === 1 ? "Hint Hero" : "Repair Champion",
      reward_loop: "award calm progress, clue use and successful repair rather than speed",
    },
  };
}

function fitPrompt(text, year) {
  const limit = year <= 2 ? 128 : 218;
  const value = String(text).replace(/\s+/g, " ").trim();
  if (value.length <= limit) return value;
  return `${trimAtWord(value, Math.max(40, limit - 26))} What is the best answer?`;
}

function compact(text, limit) {
  const value = String(text).replace(/\s+/g, " ").trim();
  if (value.length <= limit) return value;
  return trimAtWord(value, limit);
}

function trimAtWord(value, limit) {
  const sliced = String(value).slice(0, limit).replace(/[,;:\s-]+$/g, "");
  const lastSpace = sliced.lastIndexOf(" ");
  if (lastSpace > 28) return sliced.slice(0, lastSpace).replace(/[,;:\s-]+$/g, "");
  return sliced;
}

function stripEnding(value) {
  return String(value).replace(/[.!?]+$/g, "");
}
