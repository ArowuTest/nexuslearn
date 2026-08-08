import assert from "node:assert/strict";
import test from "node:test";

import {
  calculateRiskTier,
  canonicalContent,
  isReviewCurrent,
  sha256Content,
  validateReviewStatus,
} from "./review-evidence.mjs";

test("canonical content and hash are independent of object key order", () => {
  const first = { b: 2, a: { d: 4, c: 3 } };
  const second = { a: { c: 3, d: 4 }, b: 2 };

  assert.equal(canonicalContent(first), canonicalContent(second));
  assert.equal(sha256Content(first), sha256Content(second));
  assert.match(sha256Content(first), /^[0-9a-f]{64}$/);
});

test("material identity changes make a review stale", () => {
  const review = {
    content_hash: "a".repeat(64),
    rubric_revision: "curriculum-send-v1",
    source_set_revision: "sources-v1",
    reviewer_implementation: "nexuslearn-ai-curriculum-send-review-v1",
  };

  assert.equal(isReviewCurrent(review, review), true);
  assert.equal(
    isReviewCurrent(review, { ...review, source_set_revision: "sources-v2" }),
    false,
  );
});

test("risk rises for open answers, SEND transformations and safety context", () => {
  assert.equal(
    calculateRiskTier({
      format: "choice",
      sendAdaptation: false,
      safetySensitive: false,
      generatorNovel: false,
    }),
    "tier_1",
  );
  assert.equal(
    calculateRiskTier({
      format: "free_text",
      sendAdaptation: true,
      safetySensitive: false,
      generatorNovel: false,
    }),
    "tier_2",
  );
  assert.equal(
    calculateRiskTier({
      format: "free_text",
      sendAdaptation: true,
      safetySensitive: true,
      generatorNovel: true,
    }),
    "tier_3",
  );
});

test("only governed review statuses are accepted", () => {
  assert.equal(validateReviewStatus("approved_with_observation"), true);
  assert.equal(validateReviewStatus("revision_required"), true);
  assert.equal(validateReviewStatus("teacher_approved"), false);
});
