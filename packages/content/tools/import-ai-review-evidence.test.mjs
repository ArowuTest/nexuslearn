import assert from "node:assert/strict";
import test from "node:test";
import {
  evidenceIdempotencyKey,
  importEvidence,
  verifyBatchIdentity,
} from "./import-ai-review-evidence.mjs";

const unit = {
  content_id: "en-y3-reading-v1",
  content_type: "variant",
  content_revision: "1.0.0",
  content_hash: "a".repeat(64),
  pack_id: "en-y3-reading",
  year_group: 3,
  subject: "English",
  risk_tier: "tier_2",
  reviewed_variant_ids: ["en-y3-reading-v1"],
};

const evidence = {
  ...unit,
  lane_id: "ai_curriculum_lead",
  status: "approved",
  rubric_revision: "curriculum-send-v1",
  source_set_revision: "sources-v1",
  reviewer_implementation: "reviewer-v1",
  model_identifier: "gpt-5",
  confidence: 0.95,
  criterion_results: { alignment: { result: "met", evidence: "Checked." } },
  source_ids: ["govuk-english"],
  evidence_notes: "AI curriculum evidence.",
  findings: [],
};

const batch = {
  schema_version: 1,
  rubric_revision: "curriculum-send-v1",
  source_set_revision: "sources-v1",
  reviewer_implementation: "reviewer-v1",
  totals: { packs: 1, variants: 1, review_units: 1 },
  packs: [{
    pack_id: "en-y3-reading",
    year_group: 3,
    subject: "English",
    content_revision: "1.0.0",
    pack_review: { ...unit, content_id: "en-y3-reading", content_type: "pack" },
    variant_families: [],
    direct_variant_ids: ["en-y3-reading-v1"],
    variants: [unit],
  }],
};

test("import key is stable for one immutable review identity", () => {
  assert.equal(evidenceIdempotencyKey(evidence), evidenceIdempotencyKey({ ...evidence }));
  assert.match(evidenceIdempotencyKey(evidence), /^[0-9a-f]{64}$/);
});

test("import refuses evidence absent from the current review batch", async () => {
  const stale = { ...evidence, content_id: "removed-unit" };
  await assert.rejects(
    () => importEvidence({ report: { evidence: [stale] }, batch, api: { save: () => assert.fail("must not write") } }),
    /stale review unit removed-unit/,
  );
});

test("import is deterministic and carries stable idempotency keys", async () => {
  const writes = [];
  const result = await importEvidence({
    report: { evidence: [{ ...evidence, lane_id: "ai_send_lead" }, evidence] },
    batch,
    api: { save: async (payload, key) => writes.push({ payload, key }) },
  });
  assert.equal(result.imported, 2);
  assert.deepEqual(writes.map((item) => item.payload.lane_id), ["ai_curriculum_lead", "ai_send_lead"]);
  assert.deepEqual(writes.map((item) => item.key), writes.map((item) => evidenceIdempotencyKey(item.payload)));
});

test("batch identity verification rejects a material hash mismatch", () => {
  assert.throws(() => verifyBatchIdentity({ ...batch, batch_hash: "0".repeat(64) }), /batch hash/);
});
