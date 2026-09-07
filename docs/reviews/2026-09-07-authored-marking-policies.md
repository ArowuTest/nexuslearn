# Authored marking policy repair batch

## Delivered scope

The canonical backend now supports private version-1 exact alternatives, optional case sensitivity and explicitly authored absolute numeric tolerances. The preexisting reading `accepted_spans` annotation is supported as exact evidence alternatives. Unknown, malformed or incompatible policy contracts require review before pupil answer controls are offered; direct new submissions fail without saving a mark. Existing rubric, semantic, moderation and tracing boundaries take precedence.

The correctness revision is `canonical-policy-v2`. Question versions include it and the policy. New attempts retain their original response and frozen private question snapshot; completed retries return their stored outcome even after policy edits. Historical evidence is not rewritten. The deployment smoke requires `marking_policy_contract: authored-v1` from the live API, alongside previous repair/evidence contract markers.

See [the authoring contract](../content-marking-policies.md) for supported fields and limits. This is backend marking capability, not a bulk curriculum promotion. The catalogue inventory remains 87 packs / 20,210 variants, with zero explicit new policies and one preexisting accepted-span question. No narration assets, SEND configurations, game reward hooks or approval ledgers are changed.

## Review and regression evidence

Initial tests reproduced missing alternative support, unintended case-insensitive matching and unsupported policies being silently ignored. One bounded read-only reviewer then identified two defects in the candidate implementation:

1. Float conversion could widen authored numeric tolerances or erase tiny negative values. Reproduced with tolerance `0.099999999999999999`, target `0.30000000000000001`, and tolerance `-1e-400`. Policy version, numeric target and tolerance now preserve authored number tokens in a dedicated answer decoder shared by authoring, database and snapshots; bounded rational arithmetic compares them. Legacy non-policy value types remain compatible. A database test verifies exact precision, frozen regrading, changed-version identity and replay after changing tolerance to `0.1`.
2. Investigation-planner alternatives could have a cardinality that its fixed-count renderer cannot submit. Reproduced with a two-card primary answer and a one-card alternative. Such incompatible policies now require review; tests verify both public projection and direct grading reject them.

Other tests cover decimal boundaries and exponent limits, no fuzzy matching, whitespace/case, ordered structured alternatives, malformed policy types/fields, private-field exclusion, exact authored spans, snapshot persistence, invalid-policy rollback and completed replay. Content-release decoding and snapshot round-trip tests retain precise policy numbers. The reviewer was closed after delivering the bounded review.

## Verification

Full Go tests with disposable PostgreSQL, Go vet/build and the production frontend build passed. Touched-file ESLint and the asset budget passed: aggregate JavaScript 1,403,955 / 1,405,000 bytes; largest route 678,196 / 750,000 bytes. The general content validator reported 87 packs, zero errors and 11 existing readiness warnings. That validator is not a semantic marking-policy approval.

Final local browser acceptance: **62** production-build desktop/mobile tests passed in 2.4 minutes (mission integrity, pupil question contracts, adult evidence/accessibility); **6** real PostgreSQL-backed browser tests passed in 26.3 seconds after the precision/cardinality fixes. The real-backend harness covers authored reading-alternative acceptance in addition to decimal lost-acknowledgement replay, adult evidence and English repair on desktop/mobile. It uses a disposable schema, signed pupil sessions and a named disposable adult account, never hosted pupil data. No visual baseline or performance threshold was relaxed. Hosted acceptance results are recorded separately in the final FS V2B checkpoint after deployment verification.

## Still open

- Unit-aware answers, semantic/rubric/reviewer submissions and authentic tracing assessment.
- Objective-specific explanatory feedback, durable cross-session discoveries and reward/mastery-policy provenance.
- All-time evidence reporting beyond the scoped recent-attempt preview.
- Educational effectiveness, independent human SEND/safeguarding review and audio listening/release gates.
- The remaining game/model/accessibility findings in the September audit; this policy batch does not certify every renderer or curriculum variant.
