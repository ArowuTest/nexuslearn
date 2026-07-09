#!/usr/bin/env node
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const outDir = path.join(repoRoot, "packages/content/generated/coverage");
const webDir = path.join(repoRoot, "apps/web/public/content");
const batchPath = path.join(outDir, "pilot-review-batch.json");

const batch = JSON.parse(await readFile(batchPath, "utf8"));
const template = {
  version: 1,
  status: "evidence-template-pending-human-review",
  generated_by: "packages/content/tools/pilot-review-evidence-template.mjs",
  generated_at: new Date().toISOString(),
  source_batch_id: batch.batch_id,
  source_report: "pilot-review-batch.json",
  instructions: [
    "Complete one evidence record per pack before promoting any reviewed variants to child runtime.",
    "Do not mark a lane approved from authored volume alone; attach reviewer, date, sample ids and notes.",
    "Produced audio must be technically valid and human-listened for clarity, pace, warmth and pronunciation before approval.",
    "If a required lane is not approved, keep the pack in review and use revise or hold as the decision.",
  ],
  decision_values: ["promote_first_pass_to_runtime_after_evidence", "revise_candidates_and_requeue", "hold_for_audio_or_renderer_assets", "hold_for_curriculum_or_safeguarding_review"],
  records: batch.packs.map((pack) => ({
    pack_id: pack.pack_id,
    year: pack.year,
    subject: pack.subject,
    source_queue_rank: pack.queue_rank,
    recommended_first_pass: pack.recommended_first_pass,
    review_candidate_count: pack.review_candidates,
    runtime_variants_before_review: pack.runtime_variants,
    pilot_target: pack.pilot_target,
    review_state: "pending",
    decision: "hold_for_curriculum_or_safeguarding_review",
    reviewer_summary: {
      curriculum_reviewer: "",
      teacher_reviewer: "",
      send_accessibility_reviewer: "",
      safeguarding_reviewer: "",
      audio_reviewer: pack.audio_qa_required ? "" : "not required unless item references produced audio",
      renderer_reviewer: pack.renderer_acceptance_required ? "" : "sample check",
      review_date: "",
    },
    sample_plan: {
      candidate_ids_reviewed: [],
      minimum_candidates_to_review: pack.recommended_first_pass,
      include_difficulty_bands: ["intro", "developing", "expected", "secure", "stretch", "retrieval"],
      include_send_modes: ["reduced_load", "reading_support", "audio_first", "low_sensory", "keyboard_or_switch_access"],
      include_misconception_routes: true,
    },
    lane_evidence: pack.lanes.map((lane) => ({
      lane_id: lane.id,
      required_status: lane.status,
      approval: "pending",
      reviewer: "",
      evidence_notes: "",
      revision_actions: [],
      approved_candidate_ids: [],
      held_candidate_ids: [],
    })),
    blockers_at_generation: pack.blockers,
    first_action: pack.first_action,
    promotion_guard: "Do not promote until every required lane is approved and the decision is promote_first_pass_to_runtime_after_evidence.",
  })),
};

await mkdir(outDir, { recursive: true });
await mkdir(webDir, { recursive: true });
const jsonPath = path.join(outDir, "pilot-review-evidence-template.json");
const htmlPath = path.join(outDir, "pilot-review-evidence-template.html");
await writeFile(jsonPath, `${JSON.stringify(template, null, 2)}\n`, "utf8");
await writeFile(htmlPath, renderHTML(template), "utf8");
await copyFile(jsonPath, path.join(webDir, "pilot-review-evidence-template.json"));
await copyFile(htmlPath, path.join(webDir, "pilot-review-evidence-template.html"));
console.log(`pilot-review-evidence-template records=${template.records.length} lanes=${template.records.reduce((sum, record) => sum + record.lane_evidence.length, 0)} first_pass=${template.records.reduce((sum, record) => sum + record.recommended_first_pass, 0)}`);

function renderHTML(template) {
  const cards = template.records.map((record) => {
    const lanes = record.lane_evidence.map((lane) => `<tr><td>${escapeHTML(lane.lane_id)}</td><td>${escapeHTML(lane.required_status)}</td><td>pending</td><td class="blank">Reviewer / evidence notes</td></tr>`).join("");
    const blockers = record.blockers_at_generation.map((blocker) => `<li>${escapeHTML(blocker)}</li>`).join("");
    return `<section class="card"><h2>${escapeHTML(record.pack_id)}</h2><p><strong>Y${record.year} ${escapeHTML(record.subject)}</strong> · first-pass minimum ${record.recommended_first_pass}/${record.review_candidate_count} · runtime ${record.runtime_variants_before_review}/${record.pilot_target}</p><p class="guard">${escapeHTML(record.promotion_guard)}</p><h3>Review lanes</h3><table><thead><tr><th>Lane</th><th>Required status</th><th>Approval</th><th>Evidence</th></tr></thead><tbody>${lanes}</tbody></table><h3>Current blockers</h3><ul>${blockers}</ul><h3>Decision</h3><p class="blank">promote / revise / hold, with candidate ids and reviewer signatures</p></section>`;
  }).join("");
  return `<!doctype html><html lang="en-GB"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>NexusLearn pilot review evidence template</title><style>body{font-family:Inter,system-ui,sans-serif;margin:32px;color:#17233f;background:#fbfaf6}.intro,.card{background:white;border:1px solid #e3dfd3;padding:20px;margin-bottom:18px;box-shadow:0 10px 24px rgba(23,35,63,.06)}table{width:100%;border-collapse:collapse;margin-top:10px}th,td{padding:10px;border:1px solid #ddd;text-align:left;vertical-align:top}th{background:#17233f;color:white}.guard{background:#fff4d5;padding:10px;border-left:4px solid #ffbf45}.blank{color:#6f6a7a;background:#f8f6ef}li{margin:6px 0}</style></head><body><main><section class="intro"><h1>Pilot Review Evidence Template</h1><p>This printable/operator template records the human evidence required before any balanced-batch variants are promoted into child runtime. Generated from <code>${escapeHTML(template.source_batch_id)}</code>.</p><ol>${template.instructions.map((item) => `<li>${escapeHTML(item)}</li>`).join("")}</ol></section>${cards}</main></body></html>`;
}

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
}
