import test from "node:test";
import assert from "node:assert/strict";
import { authorReviewCohort, buildEvidenceArtifact, reconcileEvidence, validateDecision } from "./ai-review-evidence.mjs";

const lanes = ["ai_curriculum_lead", "ai_send_lead"];
const rubric = {
  rubric_revision: "curriculum-send-v1",
  lanes: [
    { id: lanes[0], criteria: [{ id: "curriculum_alignment" }] },
    { id: lanes[1], criteria: [{ id: "instruction_clarity" }] },
  ],
};
const sourceRegistry = {
  source_set_revision: "sources-v1",
  sources: [{ id: "source-1" }],
};
const fixtureBatch = {
  schema_version: 1,
  batch_hash: "a".repeat(64),
  rubric_revision: "curriculum-send-v1",
  source_set_revision: "sources-v1",
  reviewer_implementation: "nexuslearn-ai-curriculum-send-review-v1",
  packs: [{
    pack_id: "ma-y3-test",
    year_group: 3,
    subject: "Mathematics",
    content_revision: "1.0.0",
    required_lanes: lanes,
    pack_review: { content_id: "ma-y3-test", content_type: "pack", content_hash: "b".repeat(64), risk_tier: "tier_1", findings: [] },
    variants: [
      { id: "v1", content_id: "v1", content_type: "variant", content_hash: "c".repeat(64), risk_tier: "tier_1", findings: [] },
      { id: "v2", content_id: "v2", content_type: "variant", content_hash: "d".repeat(64), risk_tier: "tier_2", findings: [] },
    ],
    variant_families: [{
      content_id: "ma-y3-test::family::one",
      content_type: "variant_family",
      content_hash: "e".repeat(64),
      risk_tier: "tier_1",
      member_ids: ["v1"],
      boundary_case_ids: ["v1"],
    }],
    direct_variant_ids: ["v2"],
  }],
};

function decision(unit, laneID, criterionID, reviewedIDs = []) {
  return {
    content_id: unit.content_id,
    content_type: unit.content_type,
    content_revision: "1.0.0",
    content_hash: unit.content_hash,
    pack_id: "ma-y3-test",
    year_group: 3,
    subject: "Mathematics",
    lane_id: laneID,
    status: "approved",
    risk_tier: unit.risk_tier,
    criterion_results: { [criterionID]: { result: "met", evidence: "The cited source and material evidence satisfy this criterion." } },
    source_ids: ["source-1"],
    confidence: 0.93,
    evidence_notes: "AI review found the cited evidence aligned and complete.",
    findings: [],
    reviewed_variant_ids: reviewedIDs,
  };
}

function completeDecisions() {
  const pack = fixtureBatch.packs[0];
  const units = [pack.pack_review, pack.variant_families[0], pack.variants[1]];
  return units.flatMap((unit) => lanes.map((laneID) => decision(
    unit,
    laneID,
    laneID === lanes[0] ? "curriculum_alignment" : "instruction_clarity",
    unit.content_type === "variant_family" ? ["v1"] : unit.content_type === "variant" ? ["v2"] : [],
  )));
}

test("every batch review unit has both AI lane decisions", () => {
  const result = reconcileEvidence(fixtureBatch, completeDecisions(), { rubric, sourceRegistry });
  assert.equal(result.totals.missing_lane_decisions, 0);
  assert.equal(result.totals.stale_decisions, 0);
  assert.equal(result.totals.covered_variants, 2);
  assert.equal(result.production_release_allowed, false);
  assert.equal(result.remaining_external_gates.produced_audio_listening, "required");
});

test("missing and stale lane decisions are never converted into approval", () => {
  const decisions = completeDecisions();
  decisions.pop();
  decisions[0].content_hash = "f".repeat(64);
  const result = reconcileEvidence(fixtureBatch, decisions, { rubric, sourceRegistry });

  assert.equal(result.totals.missing_lane_decisions, 1);
  assert.equal(result.totals.stale_decisions, 1);
  assert.equal(result.controlled_pilot_allowed, false);
});

test("family decisions cannot cover Tier 2 or Tier 3 variants", () => {
  const invalidBatch = structuredClone(fixtureBatch);
  invalidBatch.packs[0].variant_families[0].member_ids.push("v2");
  assert.throws(
    () => reconcileEvidence(invalidBatch, completeDecisions(), { rubric, sourceRegistry }),
    /direct semantic decision/,
  );
});

test("AI notes cannot claim human approval", () => {
  const valid = completeDecisions()[0];
  assert.throws(
    () => validateDecision({ ...valid, evidence_notes: "SEND specialist approved this item" }, { rubric, sourceRegistry }),
    /human approval claim/,
  );
});

test("the production object-shaped rubric is accepted", () => {
  const objectRubric = {
    ...rubric,
    lanes: Object.fromEntries(rubric.lanes.map((lane) => [lane.id, { criteria: lane.criteria }])),
  };
  assert.doesNotThrow(() => validateDecision(completeDecisions()[0], { rubric: objectRubric, sourceRegistry }));
});

test("authored cohorts emit complete dual-lane decisions without hiding blockers", () => {
  const cohort = authorReviewCohort(fixtureBatch, { rubric, sourceRegistry, yearGroup: 3, modelIdentifier: "gpt-5" });
  assert.equal(cohort.decisions.length, 6);
  for (const item of cohort.decisions) validateDecision(item, { rubric, sourceRegistry });

  const blockedBatch = structuredClone(fixtureBatch);
  blockedBatch.packs[0].variants[1].findings = [{
    code: "missing_expected_answer",
    criterion_id: "curriculum_alignment",
    severity: "blocking",
    release_blocking: true,
    affected_fields: ["expected_answer"],
    rationale: "Expected answer is missing.",
  }];
  const blocked = authorReviewCohort(blockedBatch, { rubric, sourceRegistry, yearGroup: 3, modelIdentifier: "gpt-5" });
  const blockedDecisions = blocked.decisions.filter((item) => item.content_id === "v2");
  assert.equal(blockedDecisions.length, 2);
  assert.ok(blockedDecisions.every((item) => item.status === "revision_required"));
});

test("generated reconciliation stores a compact index rather than duplicating decisions", () => {
  const report = reconcileEvidence(fixtureBatch, completeDecisions(), { rubric, sourceRegistry });
  const artifact = buildEvidenceArtifact(report);

  assert.equal("evidence" in artifact, false);
  assert.equal(artifact.evidence_index.length, report.evidence.length);
  assert.deepEqual(Object.keys(artifact.evidence_index[0]).sort(), ["content_hash", "content_id", "lane_id", "risk_tier", "status"]);
});
