#!/usr/bin/env node
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const outDir = path.join(repoRoot, "packages/content/generated/coverage");
const webDir = path.join(repoRoot, "apps/web/public/content");
const queuePath = path.join(outDir, "variant-production-queue.json");

const queueReport = JSON.parse(await readFile(queuePath, "utf8"));
const nextBatch = new Set(queueReport.next_balanced_batch ?? []);
const queueItems = queueReport.queue ?? [];
const batchPacks = queueItems
  .filter((item) => nextBatch.has(item.pack_id))
  .sort((a, b) => (a.year ?? 0) - (b.year ?? 0) || a.rank - b.rank);

const packs = batchPacks.map((item) => buildPackReview(item));
const report = {
  version: 1,
  status: "pilot-review-batch-required",
  generated_by: "packages/content/tools/pilot-review-batch.mjs",
  source_report: "variant-production-queue.json",
  batch_id: `phase3-balanced-${packs.map((pack) => `y${pack.year}`).join("-")}`,
  generated_at: new Date().toISOString(),
  totals: {
    packs: packs.length,
    review_candidates: packs.reduce((sum, pack) => sum + pack.review_candidates, 0),
    recommended_first_pass: packs.reduce((sum, pack) => sum + pack.recommended_first_pass, 0),
    runtime_variants: packs.reduce((sum, pack) => sum + pack.runtime_variants, 0),
    runtime_spine_overlay_variants: packs.reduce((sum, pack) => sum + pack.runtime_spine_overlay_variants, 0),
    playable_runtime_variants: packs.reduce((sum, pack) => sum + pack.playable_runtime_variants, 0),
    pilot_target: packs.reduce((sum, pack) => sum + pack.pilot_target, 0),
    release_blockers: packs.reduce((sum, pack) => sum + pack.blockers.length, 0),
    audio_qa_required: packs.filter((pack) => pack.audio_qa_required).length,
  },
  decision_policy: {
    promote: "Only after curriculum, independent teacher, SEND/accessibility, safeguarding, renderer and pilot-calibration evidence pass for the reviewed batch.",
    revise: "Use when the item is curriculum-aligned but needs wording, distractor, feedback, SEND, asset or renderer refinement before child runtime.",
    hold: "Use when required SSP/audio, safeguarding, renderer/accessibility or independent-review evidence is missing.",
  },
  operator_guidance: [
    "Start with the recommended first-pass sample instead of promoting thousands of candidates at once.",
    "Review evidence must be attached per pack and per lane, not inferred from authored volume.",
    "Runtime-spine overlays are playable scaffolds for renderer and SEND walkthroughs, not a substitute for source-pack production approval.",
    "Produced ElevenLabs narration can pass technical checks only after human listening approval for child clarity, pace and warmth.",
    "No browser or robotic TTS fallback is acceptable for learner-facing release.",
  ],
  packs,
};

await mkdir(outDir, { recursive: true });
await mkdir(webDir, { recursive: true });
const jsonPath = path.join(outDir, "pilot-review-batch.json");
const htmlPath = path.join(outDir, "pilot-review-batch.html");
await writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
await writeFile(htmlPath, renderHTML(report), "utf8");
await copyFile(jsonPath, path.join(webDir, "pilot-review-batch.json"));
console.log(`pilot-review-batch packs=${report.totals.packs} first_pass=${report.totals.recommended_first_pass} blockers=${report.totals.release_blockers} audio_qa_required=${report.totals.audio_qa_required}`);

function buildPackReview(item) {
  const audioRequired = item.blockers.some((blocker) => /audio|ssp/i.test(blocker)) || item.pack_id.includes("phonics");
  const rendererRequired = item.blockers.some((blocker) => /renderer|accessibility acceptance/i.test(blocker));
  const firstPass = recommendedFirstPass(item, audioRequired);
  return {
    pack_id: item.pack_id,
    year: item.year,
    subject: item.subject,
    queue_rank: item.rank,
    runtime_variants: item.runtime_variants,
    runtime_spine_overlay_variants: item.runtime_spine_overlay_variants ?? 0,
    playable_runtime_variants: item.playable_runtime_variants ?? item.runtime_variants,
    review_candidates: item.review_candidates,
    pilot_target: item.pilot_target,
    recommended_first_pass: firstPass,
    audio_qa_required: audioRequired,
    renderer_acceptance_required: rendererRequired,
    first_action: item.next_action,
    blockers: item.blockers,
    lanes: reviewLanes(item, { audioRequired, rendererRequired }),
    evidence_required: [
      "reviewer name, role and date",
      "representative candidate ids reviewed",
      "decision counts: promote, revise, hold",
      "SEND/accessibility notes, including reduced load and alternative response checks",
      "pilot calibration notes before runtime approval",
    ],
    decision_outputs: [
      "promote_first_pass_to_runtime_after_evidence",
      "revise_candidates_and_requeue",
      "hold_for_audio_or_renderer_assets",
      "hold_for_curriculum_or_safeguarding_review",
    ],
  };
}

function recommendedFirstPass(item, audioRequired) {
  if (item.review_candidates <= 0) return 0;
  if (audioRequired) return Math.min(20, item.review_candidates);
  return Math.min(30, item.review_candidates);
}

function reviewLanes(item, { audioRequired, rendererRequired }) {
  const lanes = [
    lane("curriculum_accuracy", "required", "Check objective fit, prerequisite assumptions, misconceptions, explanations, progression and answer validity."),
    lane("independent_teacher_review", "required", "Confirm age fit, clarity, classroom usefulness, cognitive demand and misconception feedback."),
    lane("send_accessibility", "required", "Check reading load, response alternatives, sensory load, hinting, pacing, dyslexia-friendly wording and keyboard/screen-reader support."),
    lane("safeguarding", "required", "Check child-safe wording, no harmful incentives, no sensitive profiling, and no unsuitable examples."),
    lane("pilot_calibration", "required", "Record decision thresholds, error patterns and whether the first pass is safe to expose to a controlled pilot."),
  ];
  lanes.push(lane("renderer_accessibility_acceptance", rendererRequired ? "required" : "sample", rendererRequired
    ? "Verify the advanced interaction renderer is accessible before any child runtime promotion."
    : "Spot-check the runtime renderer even where formats are already common."));
  lanes.push(lane("produced_audio_listening", audioRequired ? "required" : "conditional", audioRequired
    ? "Listen to produced narration for warmth, pace, pronunciation and child clarity before runtime release."
    : "Required when a candidate references produced audio or lesson narration."));
  if (item.year <= 2) {
    lanes.push(lane("early_years_scaffold", "required", "Confirm instruction length, chunking, manipulatives, audio prompts and confidence-building feedback are age-appropriate."));
  }
  return lanes;
}

function lane(id, status, description) {
  return { id, status, description };
}

function renderHTML(report) {
  const rows = report.packs.map((pack) => `<tr><td><code>${escapeHTML(pack.pack_id)}</code><br>Y${pack.year} ${escapeHTML(pack.subject)}</td><td>${pack.recommended_first_pass}/${pack.review_candidates}</td><td>${pack.runtime_variants}/${pack.pilot_target}<br><small>${pack.playable_runtime_variants} playable with overlay</small></td><td>${pack.runtime_spine_overlay_variants}</td><td>${pack.lanes.map((lane) => `<div><strong>${escapeHTML(lane.id)}</strong>: ${escapeHTML(lane.status)}</div>`).join("")}</td><td>${pack.blockers.map((blocker) => `<div>${escapeHTML(blocker)}</div>`).join("")}</td><td>${escapeHTML(pack.first_action)}</td></tr>`).join("");
  return `<!doctype html><html lang="en-GB"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>NexusLearn pilot review batch</title><style>body{font-family:Inter,system-ui,sans-serif;margin:32px;color:#17233f;background:#fbfaf6}table{width:100%;border-collapse:collapse;background:white}th,td{padding:11px;border:1px solid #ddd;text-align:left;vertical-align:top}th{background:#17233f;color:white}code{font-size:12px}.note{max-width:880px;line-height:1.55}.policy{max-width:980px;line-height:1.55;background:#fff4d6;border:1px solid #f0cc72;padding:14px;border-radius:14px}small{color:#52607a}</style></head><body><h1>Pilot Review Batch</h1><p class="note">This is the operator batch for converting authored variants into safe runtime-approved learning. It is intentionally evidence-led: no variant is pilot-ready until every required review lane is complete.</p><p class="policy"><strong>Runtime-spine caution:</strong> overlay variants keep every pack playable for renderer, SEND and product walkthroughs. They are not counted as production-approved curriculum until the review lanes pass.</p><p><strong>Recommended first pass:</strong> ${report.totals.recommended_first_pass}. <strong>Audio QA required:</strong> ${report.totals.audio_qa_required} packs. <strong>Overlay variants in batch:</strong> ${report.totals.runtime_spine_overlay_variants}.</p><table><thead><tr><th>Pack</th><th>First-pass review</th><th>Runtime / pilot</th><th>Overlay</th><th>Review lanes</th><th>Blockers</th><th>First action</th></tr></thead><tbody>${rows}</tbody></table></body></html>`;
}

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
}
