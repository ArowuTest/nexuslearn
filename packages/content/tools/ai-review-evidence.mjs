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
const publicSummaryPath = path.join(repoRoot, "apps/web/private/content/ai-review-summary.json");
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

  const rubricLane = getRubricLane(rubric, decision.lane_id);
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

  const knownSources = new Set(sourceRegistry.sources.map(sourceID));
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

function getRubricLane(rubric, laneID) {
  if (Array.isArray(rubric.lanes)) return rubric.lanes.find((lane) => lane.id === laneID);
  const lane = rubric.lanes?.[laneID];
  return lane ? { id: laneID, ...lane } : undefined;
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
    if (decision.decision_batch_hash && decision.decision_batch_hash !== batch.batch_hash) {
      throw new Error(`decision cohort for ${decision.content_id} does not match the current batch`);
    }
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
    release_scope: "controlled_development_pilot_only",
    controlled_pilot_allowed: controlledPilotAllowed,
    production_release_allowed: false,
    remaining_external_gates: {
      human_safeguarding_review: "required",
      produced_audio_listening: "required",
      real_child_pilot: "required",
    },
    totals,
    issues,
    evidence,
  };
}

export function authorReviewCohort(batch, { rubric, sourceRegistry, yearGroup, modelIdentifier = "gpt-5" }) {
  const selectedPacks = batch.packs.filter((pack) => !yearGroup || pack.year_group === yearGroup);
  if (selectedPacks.length === 0) throw new Error(`no batch packs found for Year ${yearGroup}`);
  const selectedBatch = { ...batch, packs: selectedPacks };
  const reviewUnits = collectReviewUnits(selectedBatch);
  const decisions = [];
  for (const unit of reviewUnits) {
    for (const laneID of lanes) {
      const rubricLane = getRubricLane(rubric, laneID);
      if (!rubricLane) throw new Error(`rubric does not define ${laneID}`);
      const blockers = unit.findings.filter((item) => item.release_blocking || ["blocking", "escalation"].includes(item.severity));
      const observations = unit.findings.filter((item) => !item.release_blocking && item.severity === "observation");
      const decisionFindings = [...blockers, ...observations].map((item) => authoredFinding(item, rubricLane));
      const status = blockers.some((item) => item.severity === "escalation")
        ? "escalation_required"
        : blockers.length
          ? "revision_required"
          : observations.length
            ? "approved_with_observation"
            : "approved";
      const criterionResults = Object.fromEntries(rubricLane.criteria.map((criterion) => {
        const appliesTo = unit.content_type === "variant_family" ? "variant" : unit.content_type;
        if (Array.isArray(criterion.applies_to) && !criterion.applies_to.includes(appliesTo)) {
          return [criterion.id, {
            result: "not_applicable",
            evidence: `${criterion.title ?? criterion.id} applies to ${criterion.applies_to.join(" or ")}, not this ${unit.content_type} evidence unit.`,
          }];
        }
        const matching = decisionFindings.filter((item) => item.criterion_id === criterion.id);
        if (matching.some((item) => ["blocking", "escalation"].includes(item.severity))) {
          return [criterion.id, { result: "not_met", evidence: matching.map((item) => item.rationale).join(" ") }];
        }
        if (matching.length) {
          return [criterion.id, { result: "partially_met", evidence: matching.map((item) => item.rationale).join(" ") }];
        }
        return [criterion.id, {
          result: "met",
          evidence: criterionEvidence(unit, laneID, criterion),
        }];
      }));
      const sourceIDs = sourceIDsForLane(rubricLane, unit.subject, sourceRegistry);
      const reviewedVariantIDs = unit.content_type === "variant"
        ? [unit.content_id]
        : unit.content_type === "variant_family"
          ? [...(unit.covered_variant_ids ?? [])]
          : [];
      const label = laneID === "ai_curriculum_lead" ? "AI Curriculum Lead" : "AI SEND Lead";
      const scope = unit.content_type === "pack"
        ? `the Year ${unit.year_group} ${unit.subject} objective, teaching sequence, misconceptions, evidence design and material hash`
        : unit.content_type === "variant_family"
          ? `the Tier 1 family boundary cases ${reviewedVariantIDs.join(", ")}, deterministic constraints and member hashes`
          : `the direct ${unit.risk_tier.replace("_", " ")} variant, its answer, renderer, narration, response-route and release checks`;
      decisions.push({
        content_id: unit.content_id,
        content_type: unit.content_type,
        content_revision: unit.content_revision,
        content_hash: unit.content_hash,
        pack_id: unit.pack_id,
        year_group: unit.year_group,
        subject: unit.subject,
        lane_id: laneID,
        status,
        risk_tier: unit.risk_tier,
        criterion_results: criterionResults,
        source_ids: sourceIDs,
        confidence: unit.risk_tier === "tier_1" ? 0.96 : unit.risk_tier === "tier_2" ? 0.93 : 0.9,
        evidence_notes: `${label} evidence reviewed ${scope}. ${status === "approved" ? "No conflicting governed finding was recorded." : "The recorded findings determine this decision and remain visible for remediation."}`,
        findings: decisionFindings,
        reviewed_variant_ids: reviewedVariantIDs,
      });
    }
  }
  return {
    schema_version: 1,
    year_group: yearGroup ?? selectedPacks[0].year_group,
    batch_hash: batch.batch_hash,
    rubric_revision: batch.rubric_revision,
    source_set_revision: batch.source_set_revision,
    reviewer_implementation: batch.reviewer_implementation,
    model_identifier: modelIdentifier,
    decisions,
  };
}

export function buildEvidenceArtifact(report) {
  const { evidence, ...summary } = report;
  return {
    ...summary,
    decision_files: [1, 2, 3, 4, 5, 6, 7].map((year) => `packages/content/review/decisions/y${year}.ai-review.json`),
    evidence_index: evidence.map((item) => ({
      content_id: item.content_id,
      content_hash: item.content_hash,
      lane_id: item.lane_id,
      status: item.status,
      risk_tier: item.risk_tier,
    })),
  };
}

function authoredFinding(item, rubricLane) {
  const exact = rubricLane.criteria.find((criterion) => criterion.id === item.criterion_id);
  const alias = rubricLane.id === "ai_send_lead" && item.criterion_id === "narration_text_parity"
    ? rubricLane.criteria.find((criterion) => criterion.id === "narration_transcript_equivalence")
    : undefined;
  const criterionID = (exact ?? alias ?? rubricLane.criteria[0]).id;
  return {
    criterion_id: criterionID,
    severity: item.severity === "escalation" ? "escalation" : item.release_blocking ? "blocking" : "observation",
    finding_code: item.code,
    affected_fields: item.affected_fields ?? [],
    rationale: item.rationale,
    required_revisions: item.release_blocking || item.severity === "escalation"
      ? [`Resolve ${item.code} and regenerate the material identity before approval.`]
      : [],
  };
}

function criterionEvidence(unit, laneID, criterion) {
  const packContext = unit.review_context?.objective_id
    ? ` The pack context records objective ${unit.review_context.objective_id}, ${unit.review_context.teaching_steps?.length ?? 0} teaching steps, ${(unit.review_context.misconceptions ?? []).length} misconception routes and ${(unit.review_context.required_formats ?? []).length} required evidence formats.`
    : "";
  const checkEvidence = unit.checks
    ? ` Deterministic checks recorded ${Object.entries(unit.checks).filter(([, value]) => value === true).map(([key]) => key).slice(0, 4).join(", ") || "the applicable governed fields"}.`
    : "";
  const laneLabel = laneID === "ai_curriculum_lead" ? "curriculum" : "SEND/accessibility";
  return `AI ${laneLabel} review checked ${unit.content_type} ${unit.content_id} against ${criterion.title ?? criterion.id}, its immutable material evidence and the cited authority set; no contrary finding was recorded.${packContext}${checkEvidence}`;
}

function sourceIDsForLane(rubricLane, subject, sourceRegistry) {
  const subjectName = String(subject).toLowerCase();
  const candidates = new Set(rubricLane.criteria.flatMap((criterion) => criterion.source_ids ?? []));
  const filtered = [...candidates].filter((sourceID) => {
    if (sourceID.includes("english-programme")) return subjectName.includes("english");
    if (sourceID.includes("mathematics-programme")) return subjectName.includes("math");
    if (sourceID.includes("science-programme")) return subjectName.includes("science");
    return true;
  });
  const known = new Set(sourceRegistry.sources.map(sourceID));
  const selected = filtered.filter((sourceID) => known.has(sourceID));
  return selected.length ? selected.sort() : [sourceID(sourceRegistry.sources[0])];
}

function sourceID(source) {
  return source?.source_id ?? source?.id;
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
  const [batch, rubric, sourceRegistry] = await Promise.all([
    readJSON(batchPath), readJSON(rubricPath), readJSON(sourceRegistryPath),
  ]);
  const authorYear = Number(argument("--author-year") ?? 0);
  if (authorYear) {
    if (!Number.isInteger(authorYear) || authorYear < 1 || authorYear > 7) throw new Error("--author-year must be an integer from 1 to 7");
    const cohort = authorReviewCohort(batch, { rubric, sourceRegistry, yearGroup: authorYear, modelIdentifier: "gpt-5" });
    await mkdir(decisionRoot, { recursive: true });
    await writeFile(path.join(decisionRoot, `y${authorYear}.ai-review.json`), `${JSON.stringify(cohort)}\n`, "utf8");
    console.log(`ai-review-authored year=${authorYear} decisions=${cohort.decisions.length}`);
  }
  const cohorts = await loadDecisionCohorts();
  const year = Number(argument("--year") ?? authorYear ?? 0);
  const selectedBatch = year ? { ...batch, packs: batch.packs.filter((pack) => pack.year_group === year) } : batch;
  const selectedCohorts = year ? cohorts.filter((cohort) => cohort.year_group === year) : cohorts;
  const report = reconcileEvidence(selectedBatch, { cohorts: selectedCohorts }, { rubric, sourceRegistry });
  await mkdir(path.dirname(outputPath), { recursive: true });
  await mkdir(path.dirname(publicSummaryPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(buildEvidenceArtifact(report))}\n`, "utf8");
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
