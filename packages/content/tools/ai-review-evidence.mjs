#!/usr/bin/env node
import { readFile, readdir, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const toolPath = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(toolPath), "../../..");
const batchPath = path.join(repoRoot, "packages/content/generated/coverage/ai-review-batch.json");
const rubricPath = path.join(repoRoot, "packages/content/review/rubrics/v1.json");
const sourceRegistryPath = path.join(repoRoot, "packages/content/review/source-registry.v1.json");
const decisionRoot = path.join(repoRoot, "packages/content/review/decisions");
const outputPath = path.join(repoRoot, "packages/content/generated/coverage/ai-review-evidence.json");
const publicSummaryPath = path.join(repoRoot, "apps/web/public/content/ai-review-summary.json");
const lanes = ["ai_curriculum_lead", "ai_send_lead"];
const terminalStatuses = new Set(["approved", "approved_with_observation", "revision_required", "escalation_required"]);
const resultStatuses = new Set(["met", "partially_met", "not_met", "not_applicable"]);
const prohibitedClaims = ["teacher approved", "send specialist approved", "human reviewed", "safeguarding approved"];

export function validateDecision(decision, { rubric, sourceRegistry }) {
  if (!decision || typeof decision !== "object" || Array.isArray(decision)) throw new Error("decision must be an object");
  for (const [name, value] of Object.entries({
    content_id: decision.content_id,
    content_type: decision.content_type,
    content_revision: decision.content_revision,
    content_hash: decision.content_hash,
    pack_id: decision.pack_id,
    subject: decision.subject,
    lane_id: decision.lane_id,
    status: decision.status,
    risk_tier: decision.risk_tier,
    evidence_notes: decision.evidence_notes,
  })) {
    if (typeof value !== "string" || !value.trim()) throw new Error(`${name} is required`);
  }
  if (!/^[0-9a-f]{64}$/.test(decision.content_hash)) throw new Error("content_hash must be a lowercase SHA-256 value");
  if (!["pack", "variant", "variant_family"].includes(decision.content_type)) throw new Error(`unsupported content type ${decision.content_type}`);
  if (!Number.isInteger(decision.year_group) || decision.year_group < 1 || decision.year_group > 7) throw new Error("year_group must be between 1 and 7");
  if (!lanes.includes(decision.lane_id)) throw new Error(`unsupported AI review lane ${decision.lane_id}`);
  if (!terminalStatuses.has(decision.status)) throw new Error(`unsupported review status ${decision.status}`);
  if (!["tier_1", "tier_2", "tier_3"].includes(decision.risk_tier)) throw new Error(`unsupported risk tier ${decision.risk_tier}`);
  if (typeof decision.confidence !== "number" || decision.confidence < 0 || decision.confidence > 1) throw new Error("confidence must be between 0 and 1");
  const lowerNotes = decision.evidence_notes.toLowerCase();
  if (prohibitedClaims.some((claim) => lowerNotes.includes(claim))) throw new Error("AI evidence contains a prohibited human approval claim");

  const rubricLane = rubric.lanes.find((lane) => lane.id === decision.lane_id);
  if (!rubricLane) throw new Error(`rubric does not define ${decision.lane_id}`);
  const expectedCriteria = new Set(rubricLane.criteria.map((criterion) => criterion.id));
  const criterionResults = decision.criterion_results;
  if (!criterionResults || typeof criterionResults !== "object" || Array.isArray(criterionResults)) throw new Error("criterion_results must be an object");
  for (const criterionID of expectedCriteria) {
    const result = criterionResults[criterionID];
    if (!result || !resultStatuses.has(result.result) || typeof result.evidence !== "string" || !result.evidence.trim()) {
      throw new Error(`decision lacks a complete result for criterion ${criterionID}`);
    }
  }
  const unexpectedCriteria = Object.keys(criterionResults).filter((criterionID) => !expectedCriteria.has(criterionID));
  if (unexpectedCriteria.length) throw new Error(`decision contains criteria outside lane ${decision.lane_id}: ${unexpectedCriteria.join(", ")}`);

  const knownSources = new Set(sourceRegistry.sources.map((source) => source.id));
  if (!Array.isArray(decision.source_ids) || decision.source_ids.length === 0 || decision.source_ids.some((sourceID) => !knownSources.has(sourceID))) {
    throw new Error("decision must cite known source IDs");
  }
  if (!Array.isArray(decision.findings)) throw new Error("findings must be an array");
  for (const finding of decision.findings) validateFinding(finding);
  if (["approved", "approved_with_observation"].includes(decision.status) && decision.findings.some((finding) => ["blocking", "escalation"].includes(finding.severity))) {
    throw new Error("an approved decision cannot contain blocking or escalation findings");
  }
  return decision;
}

function validateFinding(finding) {
  if (!finding || typeof finding !== "object") throw new Error("finding must be an object");
  for (const field of ["criterion_id", "finding_code", "rationale"]) {
    if (typeof finding[field] !== "string" || !finding[field].trim()) throw new Error(`finding ${field} is required`);
  }
  if (!["observation", "blocking", "escalation"].includes(finding.severity)) throw new Error(`unsupported finding severity ${finding.severity}`);
  if (!Array.isArray(finding.affected_fields) || !Array.isArray(finding.required_revisions)) throw new Error("finding fields and revisions must be arrays");
  if (finding.severity !== "observation" && finding.required_revisions.length === 0) throw new Error("blocking findings require a revision action");
}

export function reconcileEvidence(batch, decisionInput, { rubric, sourceRegistry }) {
  if (batch.rubric_revision !== rubric.rubric_revision) throw new Error("batch rubric revision does not match the loaded rubric");
  if (batch.source_set_revision !== sourceRegistry.source_set_revision) throw new Error("batch source-set revision does not match the loaded source registry");
  const decisions = normaliseDecisions(decisionInput);
  const reviewUnits = collectReviewUnits(batch);
  const decisionIndex = new Map();
  for (const decision of decisions) {
    validateDecision(decision, { rubric, sourceRegistry });
    const key = `${decision.content_id}\u0000${decision.lane_id}`;
    if (decisionIndex.has(key)) throw new Error(`duplicate decision for ${decision.content_id} ${decision.lane_id}`);
    decisionIndex.set(key, decision);
  }

  const totals = {
    packs: batch.packs.length,
    variants: batch.packs.reduce((sum, pack) => sum + pack.variants.length, 0),
    review_units: reviewUnits.length,
    expected_lane_decisions: reviewUnits.length * lanes.length,
    current_lane_decisions: 0,
    missing_lane_decisions: 0,
    stale_decisions: 0,
    revision_required: 0,
    escalation_required: 0,
    unacknowledged_blocking_findings: 0,
    covered_variants: 0,
  };
  const evidence = [];
  const coveredVariants = new Set();
  const issues = [];
  for (const unit of reviewUnits) {
    let completeUnit = true;
    for (const laneID of lanes) {
      const decision = decisionIndex.get(`${unit.content_id}\u0000${laneID}`);
      if (!decision) {
        totals.missing_lane_decisions++;
        completeUnit = false;
        issues.push({ code: "missing_lane_decision", content_id: unit.content_id, lane_id: laneID });
        continue;
      }
      if (decision.content_hash !== unit.content_hash || decision.content_type !== unit.content_type || decision.risk_tier !== unit.risk_tier) {
        totals.stale_decisions++;
        completeUnit = false;
        issues.push({ code: "stale_decision", content_id: unit.content_id, lane_id: laneID });
        continue;
      }
      validateReviewedVariants(unit, decision);
      totals.current_lane_decisions++;
      if (decision.status === "revision_required") {
        totals.revision_required++;
        completeUnit = false;
      }
      if (decision.status === "escalation_required") {
        totals.escalation_required++;
        completeUnit = false;
      }
      const deterministicBlockers = unit.findings.filter((finding) => finding.release_blocking);
      if (deterministicBlockers.length && ["approved", "approved_with_observation"].includes(decision.status)) {
        totals.unacknowledged_blocking_findings += deterministicBlockers.length;
        completeUnit = false;
        issues.push({ code: "unacknowledged_deterministic_blocker", content_id: unit.content_id, lane_id: laneID });
      }
      evidence.push({
        ...decision,
        rubric_revision: batch.rubric_revision,
        source_set_revision: batch.source_set_revision,
        reviewer_implementation: batch.reviewer_implementation,
        batch_hash: batch.batch_hash,
      });
    }
    if (completeUnit) for (const variantID of unit.covered_variant_ids) coveredVariants.add(variantID);
  }
  totals.covered_variants = coveredVariants.size;
  const controlledPilotAllowed = totals.current_lane_decisions === totals.expected_lane_decisions &&
    totals.missing_lane_decisions === 0 && totals.stale_decisions === 0 &&
    totals.revision_required === 0 && totals.escalation_required === 0 &&
    totals.unacknowledged_blocking_findings === 0 && totals.covered_variants === totals.variants;
  return {
    schema_version: 1,
    batch_id: batch.batch_id,
    batch_hash: batch.batch_hash,
    rubric_revision: batch.rubric_revision,
    source_set_revision: batch.source_set_revision,
    reviewer_implementation: batch.reviewer_implementation,
    controlled_pilot_allowed: controlledPilotAllowed,
    totals,
    issues,
    evidence,
  };
}

function normaliseDecisions(input) {
  if (Array.isArray(input)) return input;
  if (!input) return [];
  const cohorts = Array.isArray(input.cohorts) ? input.cohorts : [input];
  return cohorts.flatMap((cohort) => (cohort.decisions ?? []).map((decision) => ({
    ...decision,
    reviewer_implementation: decision.reviewer_implementation ?? cohort.reviewer_implementation,
    model_identifier: decision.model_identifier ?? cohort.model_identifier,
    decision_batch_hash: cohort.batch_hash,
  })));
}

function collectReviewUnits(batch) {
  const units = [];
  const globallyCoveredVariants = new Set();
  for (const pack of batch.packs) {
    const variants = new Map(pack.variants.map((variant) => [variant.id, variant]));
    units.push(withPackContext(pack, pack.pack_review, []));
    for (const family of pack.variant_families) {
      for (const variantID of family.member_ids) {
        const scopedVariantID = `${pack.pack_id}\u0000${variantID}`;
        const variant = variants.get(variantID);
        if (!variant) throw new Error(`family ${family.content_id} refers to missing variant ${variantID}`);
        if (variant.risk_tier !== "tier_1") throw new Error(`${variantID} requires a direct semantic decision because it is ${variant.risk_tier}`);
        if (globallyCoveredVariants.has(scopedVariantID)) throw new Error(`variant ${variantID} appears in more than one review unit`);
        globallyCoveredVariants.add(scopedVariantID);
      }
      units.push(withPackContext(pack, family, family.member_ids));
    }
    for (const variantID of pack.direct_variant_ids) {
      const scopedVariantID = `${pack.pack_id}\u0000${variantID}`;
      const variant = variants.get(variantID);
      if (!variant) throw new Error(`direct review refers to missing variant ${variantID}`);
      if (globallyCoveredVariants.has(scopedVariantID)) throw new Error(`variant ${variantID} appears in more than one review unit`);
      globallyCoveredVariants.add(scopedVariantID);
      units.push(withPackContext(pack, variant, [variantID]));
    }
    for (const variantID of variants.keys()) {
      if (!globallyCoveredVariants.has(`${pack.pack_id}\u0000${variantID}`)) throw new Error(`variant ${variantID} has no family or direct semantic decision route`);
    }
  }
  return units;
}

function withPackContext(pack, unit, coveredVariantIDs) {
  return {
    ...unit,
    content_revision: unit.content_revision ?? pack.content_revision,
    pack_id: pack.pack_id,
    year_group: pack.year_group,
    subject: pack.subject,
    findings: unit.findings ?? [],
    covered_variant_ids: coveredVariantIDs,
  };
}

function validateReviewedVariants(unit, decision) {
  const reviewed = new Set(decision.reviewed_variant_ids ?? []);
  if (unit.content_type === "pack") return;
  if (unit.content_type === "variant") {
    if (!reviewed.has(unit.content_id)) throw new Error(`direct semantic decision ${unit.content_id} must record its reviewed variant ID`);
    return;
  }
  for (const boundaryID of unit.boundary_case_ids ?? []) {
    if (!reviewed.has(boundaryID)) throw new Error(`family decision ${unit.content_id} does not record boundary case ${boundaryID}`);
  }
}

async function main() {
  const [batch, rubric, sourceRegistry, cohorts] = await Promise.all([
    readJSON(batchPath), readJSON(rubricPath), readJSON(sourceRegistryPath), loadDecisionCohorts(),
  ]);
  const year = Number(argument("--year") ?? 0);
  const selectedBatch = year ? { ...batch, packs: batch.packs.filter((pack) => pack.year_group === year) } : batch;
  const selectedCohorts = year ? cohorts.filter((cohort) => cohort.year_group === year) : cohorts;
  const report = reconcileEvidence(selectedBatch, { cohorts: selectedCohorts }, { rubric, sourceRegistry });
  await mkdir(path.dirname(outputPath), { recursive: true });
  await mkdir(path.dirname(publicSummaryPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  const summary = { ...report, evidence: undefined };
  await writeFile(publicSummaryPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
  console.log(`ai-review-evidence units=${report.totals.review_units} decisions=${report.totals.current_lane_decisions}/${report.totals.expected_lane_decisions} missing=${report.totals.missing_lane_decisions} stale=${report.totals.stale_decisions} covered=${report.totals.covered_variants}/${report.totals.variants} pilot=${report.controlled_pilot_allowed}`);
  if (process.argv.includes("--strict") && !report.controlled_pilot_allowed) process.exitCode = 1;
}

async function loadDecisionCohorts() {
  let files = [];
  try {
    files = (await readdir(decisionRoot)).filter((file) => /^y[1-7]\.ai-review\.json$/.test(file)).sort();
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  return Promise.all(files.map((file) => readJSON(path.join(decisionRoot, file))));
}

async function readJSON(file) {
  return JSON.parse(await readFile(file, "utf8"));
}

function argument(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(toolPath)) {
  await main();
}
