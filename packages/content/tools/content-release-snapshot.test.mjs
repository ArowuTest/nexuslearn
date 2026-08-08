import assert from "node:assert/strict";
import test from "node:test";
import { reconcileReviewGate } from "./content-release-snapshot.mjs";

const source = {
  controlled_pilot_allowed: true,
  rubric_revision: "rubric-v1",
  source_set_revision: "sources-v1",
  reviewer_implementation: "reviewer-v1",
  packs: 87,
  variants: 20210,
  review_units: 6614,
};

const backend = {
  available: true,
  controlled_pilot_allowed: true,
  rubric_revision: "rubric-v1",
  source_set_revision: "sources-v1",
  reviewer_implementation: "reviewer-v1",
  packs: 87,
  variants: 20210,
  current_ai_curriculum_lead: 6614,
  current_ai_send_lead: 6614,
  stale: 0,
  revision_required: 0,
  escalation_required: 0,
  blocking_findings: 0,
  escalation_findings: 0,
};

test("promotion remains false when backend state is unavailable", () => {
  const result = reconcileReviewGate(source, { available: false });
  assert.equal(result.promotion_allowed, false);
  assert.match(result.reason, /unavailable/);
});

test("promotion requires matching revisions and complete dual-lane coverage", () => {
  assert.equal(reconcileReviewGate(source, backend).promotion_allowed, true);
  assert.equal(reconcileReviewGate(source, { ...backend, reviewer_implementation: "reviewer-v2" }).promotion_allowed, false);
  assert.equal(reconcileReviewGate(source, { ...backend, current_ai_send_lead: 6613 }).promotion_allowed, false);
});
