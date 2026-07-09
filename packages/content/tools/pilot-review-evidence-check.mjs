#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const evidencePath = path.join(repoRoot, "packages/content/generated/coverage/pilot-review-evidence-template.json");
const batchPath = path.join(repoRoot, "packages/content/generated/coverage/pilot-review-batch.json");

const evidence = JSON.parse(await readFile(evidencePath, "utf8"));
const batch = JSON.parse(await readFile(batchPath, "utf8"));
const errors = [];
const warnings = [];
const allowedDecisions = new Set(evidence.decision_values ?? []);
const batchPackIDs = new Set((batch.packs ?? []).map((pack) => pack.pack_id));

if (evidence.source_batch_id !== batch.batch_id) {
  errors.push(`source_batch_id ${evidence.source_batch_id} does not match pilot batch ${batch.batch_id}`);
}
if (!Array.isArray(evidence.records) || evidence.records.length !== batchPackIDs.size) {
  errors.push(`expected ${batchPackIDs.size} evidence records but found ${evidence.records?.length ?? 0}`);
}

for (const record of evidence.records ?? []) {
  const label = record.pack_id ?? "unknown-pack";
  if (!batchPackIDs.has(record.pack_id)) errors.push(`${label}: record is not part of the current pilot batch`);
  if (!allowedDecisions.has(record.decision)) errors.push(`${label}: decision ${record.decision} is not in decision_values`);
  if (!record.promotion_guard?.includes("Do not promote")) errors.push(`${label}: promotion guard is missing or too weak`);
  if (!Array.isArray(record.lane_evidence) || record.lane_evidence.length === 0) {
    errors.push(`${label}: lane_evidence is required`);
    continue;
  }
  const requiredLanes = record.lane_evidence.filter((lane) => lane.required_status === "required");
  if (requiredLanes.length === 0) errors.push(`${label}: at least one required review lane is expected`);
  const approvedRequiredLanes = requiredLanes.filter((lane) => lane.approval === "approved");
  const allRequiredApproved = requiredLanes.length > 0 && approvedRequiredLanes.length === requiredLanes.length;
  const wantsPromotion = record.decision === "promote_first_pass_to_runtime_after_evidence" || record.review_state === "approved";
  if (wantsPromotion && !allRequiredApproved) errors.push(`${label}: promotion decision requires every required lane to be approved`);
  if (wantsPromotion) {
    requireText(record.reviewer_summary?.curriculum_reviewer, `${label}: curriculum reviewer`);
    requireText(record.reviewer_summary?.teacher_reviewer, `${label}: teacher reviewer`);
    requireText(record.reviewer_summary?.send_accessibility_reviewer, `${label}: SEND/accessibility reviewer`);
    requireText(record.reviewer_summary?.safeguarding_reviewer, `${label}: safeguarding reviewer`);
    requireText(record.reviewer_summary?.review_date, `${label}: review date`);
    if ((record.sample_plan?.candidate_ids_reviewed?.length ?? 0) < (record.sample_plan?.minimum_candidates_to_review ?? 0)) {
      errors.push(`${label}: promotion requires at least ${record.sample_plan?.minimum_candidates_to_review ?? 0} reviewed candidate ids`);
    }
  }
  for (const lane of record.lane_evidence) {
    if (lane.approval === "approved") {
      requireText(lane.reviewer, `${label}/${lane.lane_id}: lane reviewer`);
      requireText(lane.evidence_notes, `${label}/${lane.lane_id}: evidence notes`);
      if ((lane.approved_candidate_ids?.length ?? 0) === 0) errors.push(`${label}/${lane.lane_id}: approved lane requires approved candidate ids`);
    } else if (lane.required_status === "required" && lane.approval === "pending") {
      warnings.push(`${label}/${lane.lane_id}: required lane still pending`);
    }
  }
}

if (errors.length > 0) {
  console.error(`pilot-review-evidence-check failed errors=${errors.length} warnings=${warnings.length}`);
  for (const error of errors.slice(0, 80)) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`pilot-review-evidence-check records=${evidence.records?.length ?? 0} pending_required_lanes=${warnings.length} errors=0`);

function requireText(value, label) {
  if (typeof value !== "string" || value.trim() === "") errors.push(`${label} is required`);
}
