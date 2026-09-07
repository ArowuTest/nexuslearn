# Original submitted answers and grader provenance

## Scope

New canonical attempts preserve the submitted typed envelope before normalization, alongside the existing normalized answer, frozen question version and saved result. `canonical-exact-v1` identifies the correctness matching/normalization algorithm; it does not claim to version configurable rewards, mastery policy or human educational approval.

The shared adult evidence panel shows submitted response, normalized recorded answer and grader revision in parent/family, school/tutor and platform-admin reports. Existing exact learner-scope checks, private/no-store responses and latest-10 bounds remain. No evidence is added to pupil progress projections. Mocks archive the same fields transactionally but remain outside ordinary learning evidence/mastery; a mock-specific provenance UI is not delivered here.

## Data and compatibility

- Migration 0047 adds nullable `submitted_response` (PostgreSQL JSON) and `grader_revision` with a paired-evidence constraint. No historical response or grader is inferred. Historical report fields explicitly say unavailable.
- JSON rather than JSONB retains numeric tokens such as `1.2500`, string casing/spacing and structured order. `submitted_value_json` gives adult clients a JSON literal string so JavaScript number parsing cannot erase displayed precision. This is the submitted API value, not keystrokes, a raw HTTP transcript or a speech recording. JSON structural whitespace/escaping may be compacted by serialization.
- Capture, contract snapshot, attempt, mastery/mock effects and idempotency acknowledgement share the existing transaction. Identical acknowledged retries return before content checks or new archive validation. No request JSON fields/tags/hash algorithm changed. This is application write-once evidence, not a tamper-proof ledger against privileged database changes.
- Grader revision is part of the served question-version hash. Unsaved pre-deployment question contracts must reload through the existing question-changed response; completed retries keep their stored outcome. No historical regrading occurs.
- New archived envelopes are capped at 65,536 bytes in both the repository and database. Whole HTTP attempt requests are bounded at 1 MiB, including unknown fields/trailing padding, and must be one JSON document. Over-limit HTTP requests receive 413 before repository access; oversized new typed envelopes receive 422 without evidence writes. Historical acknowledgements remain replayable within the HTTP transport bound; pre-existing oversized bodies are not exempt from that bound.
- Migration is additive for an older API, which can continue writing null provenance during rollout. Deploy migration before the new API. Do not roll down a used production archive: down removes these columns and their collected evidence. The round-trip test only uses a disposable schema.

## Verification

- Test-first red/green: all four original-response integration cases initially failed for missing archived input; parent browser check initially failed for missing submitted-response UI. Request-size/trailing-document tests also reproduced the prior unchecked path before remediation.
- Disposable PostgreSQL tests cover text spacing/case, numeric lexemes, sequence order, mapping values, normalized marking, withdrawal/replay, no duplicate rows, oversized rejection, migration down/up/reapply and absent historical provenance. Existing concurrent replay, late rollback and mock isolation tests remain; mocks now explicitly assert archived original input/revision.
- Role tests verify adult output/private cache and prohibit anonymous, unlinked, case-only ID and pupil evidence access. No live credentials or learner mutations are used.
- Full Go tests with PostgreSQL, vet/build; production Next.js build, TypeScript and touched-file ESLint.
- 30 production-build Playwright checks passed on desktop/mobile: all four adult workspaces with axe, delayed-report learner isolation, pupil-safe question contracts and switch/keyboard review boundaries. Two additional authenticated real API/PostgreSQL browser checks passed through decimal submission, lost acknowledgement/retry and admin provenance display.
- Local performance budget: aggregate JavaScript 1,403,934 / 1,405,000 bytes; largest route 678,196 / 750,000; largest public asset 275,314 / 600,000. Repeated evidence markup was consolidated; no budgets or visual thresholds raised.
- One bounded read-only adversarial review found no actionable issues in the archive/report implementation. Subsequent request bounds and deployment marker were additionally checked by local regression tests. Hosted release evidence is recorded separately in the FS V2B checkpoint after push; this document alone is not proof of deployment.

## Next substantial work

1. Subject/task-appropriate incorrect feedback and explicit authored marking policy (alternatives, units, tolerance), preserving fail-closed review gates.
2. Full-history, paginated adult evidence with retention/export controls and reward/mastery-policy provenance.
3. Authentic tracing/review submission and reviewer workflow rather than accepting a completion token as mastery.
4. Remaining broader game/product audit remediation, followed by distinct human educational, safeguarding and listening review. No curriculum approvals or ElevenLabs assets changed in this batch.
