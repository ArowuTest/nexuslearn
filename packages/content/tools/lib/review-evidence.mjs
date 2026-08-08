import { createHash } from "node:crypto";

const governedStatuses = new Set([
  "not_reviewed",
  "in_review",
  "approved",
  "approved_with_observation",
  "revision_required",
  "escalation_required",
  "stale",
  "superseded",
]);

const openAnswerFormats = new Set([
  "free_text",
  "long_text",
  "spoken_response",
  "constructed_response",
]);

const materialIdentityFields = [
  "content_hash",
  "rubric_revision",
  "source_set_revision",
  "reviewer_implementation",
];

export function canonicalContent(value) {
  if (Array.isArray(value)) {
    return `[${value.map(canonicalContent).join(",")}]`;
  }
  if (value !== null && typeof value === "object") {
    const fields = Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalContent(value[key])}`);
    return `{${fields.join(",")}}`;
  }
  const encoded = JSON.stringify(value);
  if (encoded === undefined) {
    throw new TypeError("content contains a value that cannot be represented as JSON");
  }
  return encoded;
}

export function sha256Content(value) {
  return createHash("sha256").update(canonicalContent(value)).digest("hex");
}

export function validateReviewStatus(status) {
  return governedStatuses.has(status);
}

export function isReviewCurrent(review, identity) {
  return materialIdentityFields.every((field) => review?.[field] === identity?.[field]);
}

export function calculateRiskTier(input = {}) {
  let score = 0;
  if (openAnswerFormats.has(String(input.format ?? "").toLowerCase())) score += 2;
  if (input.sendAdaptation) score += 2;
  if (input.safetySensitive) score += 3;
  if (input.generatorNovel) score += 2;
  if (input.narrationDependent) score += 1;
  if (input.priorFailure) score += 2;
  if (score >= 6) return "tier_3";
  if (score >= 3) return "tier_2";
  return "tier_1";
}
