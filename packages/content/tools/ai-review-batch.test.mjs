import test from "node:test";
import assert from "node:assert/strict";
import { buildReviewBatch } from "./ai-review-batch.mjs";

const options = {
  rubricRevision: "curriculum-send-v1",
  sourceSetRevision: "sources-v1",
  reviewerImplementation: "nexuslearn-ai-curriculum-send-review-v1",
  rendererRegistry: {
    formats: { choice: { current_runtime: "choice_ready" } },
  },
};

function fixtureVariant(id, overrides = {}) {
  return {
    id,
    status: "review",
    format: "choice",
    body: {
      prompt: "What is 2 + 2?",
      choices: [3, 4, 5],
      variant_blueprint_id: "addition-choice",
      supported_interaction: "Choose by touch, keyboard, switch or pointing.",
    },
    expected_answer: { value: 4 },
    hints: ["Count on two."],
    explanation: "Two and two make four.",
    ...overrides,
  };
}

function fixturePack(variants) {
  return {
    id: "ma-y3-test",
    version: "1.0.0",
    source_alignment: { year: 3, subject: "Mathematics", programme: "National curriculum" },
    objective: { id: "ma-y3-test", statement: "Add within the expected range." },
    question_variants: variants,
  };
}

test("batch gives every variant a hash, risk tier and both lanes", () => {
  const batch = buildReviewBatch([fixturePack([fixtureVariant("v1")])], options);

  assert.equal(batch.totals.variants, 1);
  assert.match(batch.batch_hash, /^[0-9a-f]{64}$/);
  assert.match(batch.packs[0].variants[0].content_hash, /^[0-9a-f]{64}$/);
  assert.equal(batch.packs[0].variants[0].risk_tier, "tier_1");
  assert.deepEqual(batch.packs[0].required_lanes, ["ai_curriculum_lead", "ai_send_lead"]);
});

test("deterministic Tier 1 families are independent of input ordering", () => {
  const left = buildReviewBatch([
    fixturePack([fixtureVariant("v2", { body: { ...fixtureVariant("v2").body, prompt: "What is 3 + 2?" }, expected_answer: { value: 5 } }), fixtureVariant("v1")]),
  ], options);
  const right = buildReviewBatch([
    fixturePack([fixtureVariant("v1"), fixtureVariant("v2", { body: { ...fixtureVariant("v2").body, prompt: "What is 3 + 2?" }, expected_answer: { value: 5 } })]),
  ], options);

  assert.equal(left.batch_hash, right.batch_hash);
  assert.equal(left.packs[0].variant_families.length, 1);
  assert.deepEqual(left.packs[0].variant_families[0].member_ids, ["v1", "v2"]);
});

test("higher-risk and invalid variants stay direct and expose deterministic findings", () => {
  const variant = fixtureVariant("v-risk", {
    format: "free_text",
    body: { prompt: "Explain your investigation.", safety_review_required: true },
    expected_answer: {},
  });
  const batch = buildReviewBatch([fixturePack([variant])], options);
  const record = batch.packs[0].variants[0];

  assert.equal(record.risk_tier, "tier_3");
  assert.equal(batch.packs[0].variant_families.length, 0);
  assert.deepEqual(batch.packs[0].direct_variant_ids, ["v-risk"]);
  assert.ok(record.findings.some((finding) => finding.code === "missing_expected_answer" && finding.release_blocking));
  assert.ok(record.findings.some((finding) => finding.code === "renderer_not_registered"));
});

test("answer resolution recognises units and equivalent 12/24-hour times", () => {
  const variants = [
    fixtureVariant("unit", { body: { ...fixtureVariant("unit").body, choices: ["90 g", "100 g"] }, expected_answer: { value: 100, unit: "g" } }),
    fixtureVariant("time", { body: { ...fixtureVariant("time").body, choices: ["14:10", "14:20"] }, expected_answer: { value: "2:20 pm" } }),
  ];
  const batch = buildReviewBatch([fixturePack(variants)], options);

  for (const variant of batch.packs[0].variants) {
    assert.notEqual(variant.checks.answer_resolved, false);
    assert.ok(!variant.findings.some((finding) => finding.code === "prompt_answer_mismatch"));
  }
});

test("whole-word and phoneme asset declarations satisfy audio source provenance", () => {
  const variant = fixtureVariant("audio", {
    format: "audio-choice",
    body: {
      ...fixtureVariant("audio").body,
      whole_word_audio_asset_id: "word-map",
      phoneme_audio_asset_ids: ["phoneme-m", "phoneme-a", "phoneme-p"],
      audio_asset_status: "required",
    },
  });
  const batch = buildReviewBatch([fixturePack([variant])], options);

  assert.ok(!batch.packs[0].variants[0].findings.some((finding) => finding.code === "required_narration_missing"));
});
