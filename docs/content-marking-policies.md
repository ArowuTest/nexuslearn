# Authored automatic marking policies

The API is the authority for marking. Optional `expected_answer.marking_policy` is private curriculum data, never part of the pupil question projection. Its semantics are included in the served question version and frozen grading snapshot. New attempts archive the original response and `canonical-policy-v2` correctness-grader revision.

## Version 1

Default marking without a policy retains the existing response contract: trimmed, case-insensitive text; ordered sequences; keyed mappings; numeric equality. Punctuation is not removed. Only `pattern-sort` category lists and `fair-test-plan.keep_same` lists are unordered. A policy does not change the response kind or renderer.

Exact alternatives and case-sensitive spelling/capitalisation:

```json
{
  "value": "London",
  "marking_policy": {
    "version": 1,
    "mode": "exact",
    "case_sensitive": true,
    "accepted_values": ["London, England"]
  }
}
```

The primary answer is always accepted. Each alternative is a complete response of the same kind, not a substring or fuzzy match. `case_sensitive` and `accepted_values` are optional. Case sensitivity applies recursively to text values, not mapping keys; surrounding whitespace is still trimmed. Omit case sensitivity for number responses. Alternatives are limited to 1–32 values and 16 KiB of encoded JSON; the entire policy is also limited to 16 KiB. Existing sequence-tile number/string normalisation remains, except for numeric coordinate plots. Investigation-planner alternatives must have the same cardinality as the primary sequence, matching the game's fixed selection count; incompatible policies require review.

An explicitly authored numerical tolerance:

```json
{
  "value": 0.3,
  "marking_policy": {
    "version": 1,
    "mode": "numeric",
    "absolute_tolerance": 0.1
  }
}
```

This accepts an absolute difference of **at most** 0.1, inclusive. Tolerance must be finite and nonnegative; zero means exact decimal comparison. No tolerance is inferred from the number of decimal places. The learner's original JSON number is compared using rational decimal arithmetic, so `0.40000000000000001` does not round into the accepted boundary. The recorded answer retains that numeric literal. Authored numeric-policy targets and tolerances also preserve their JSON numbers through API decoding, database reads and snapshot reads, without float64 rounding. The legacy non-policy answer shapes remain unchanged. Numeric literals are bounded to 128 characters and scientific exponents from −308 to 308 to prevent excessive arithmetic allocation. This is a bounded decimal contract, not unrestricted arbitrary-precision authoring. Unsupported authored bounds require review; unsupported learner literals are rejected without saving a mark. Policy versions must be the integer literal `1`.

## Existing content annotations

- `accepted_spans` is supported for text responses as a bounded list of exact alternatives to the primary answer. Do not combine it with `marking_policy`; that ambiguity requires review.
- `acceptable_spoken_without_punctuation` is **not** a written-answer exception. Written spelling/punctuation requirements are retained.
- `unit` is not permission to convert units or accept a differently scaled numerical answer. Unit-aware response contracts remain separate work.
- `rubric`, `moderation_required: true`, `accepted_semantic_equivalents`, and tracing retain their review-only boundary even when a marking policy is supplied.
- Unknown versions, modes, fields, malformed values or incompatible response kinds require review, rather than falling back to a guessed mark. Exact mode allows only `version`, `mode`, `case_sensitive`, `accepted_values`; numeric mode allows only `version`, `mode`, `absolute_tolerance`.

## Publishing and verification

Define alternatives from the objective being assessed. Do not add a near-match that removes the very skill the question tests. These rules are an engineering capability, not permission to bulk-approve content or substitute AI review for independent human review.

Validate policies with the API tests and a disposable authenticated pupil mission. The content CLI's general pack validation does not itself implement these marking semantics; a successful generic pack validation alone is insufficient evidence that a policy is markable. The Go catalogue inventory checks authored policy structure alongside the runtime implementation. In the September 7 inventory, 87 packs / 20,210 variants contained no explicit policies, one accepted-span question, 47 oral-punctuation annotations and 336 unit annotations. Those counts are an inventory, not coverage or approval claims.

Content/policy edits invalidate the served version for unsaved answers. A completed identical idempotent retry returns its original stored result before consulting the edited content. Historical attempts retain their original grader labels and are not regraded by this revision.

`GET /v1/version` exposes `marking_policy_contract: authored-v1` for deployment verification. It does not expose private policies or certify curriculum readiness.
