# Canonical grading and trustworthy progression — next repair batch

Status: **partially implemented** in the canonical grading remediation batch. The transaction boundary, typed/versioned response path, durable deduplicated contract snapshots, mock separation and recovery tests are implemented. Public answer-key decoupling, retirement of legacy unversioned requests and richer authored marking policies remain open. See `docs/reviews/2026-09-06-canonical-grading-batch.md` for evidence and limits. Follows G01/G06 in the September game audit and mission integrity/access repair batch.

Follow-on: public mission-question decoupling is implemented with local acceptance evidence in `docs/reviews/2026-09-06-pupil-question-contract.md`; hosted release status is recorded in the FS V2B delivery checkpoint. That scope removes marking keys from mission questions, not all authored learning hints or every public static content artifact. Legacy retirement, richer marking policies and adult provenance remain open.

## Verified pre-remediation boundary

`internal/server/server.go:handleAttempt` decodes browser-supplied `expected` / `expected_text`, calls `learning.ScoreAttempt`, then hands the result to `PostgresRepository.RecordAttempt`. The repository begins an idempotent transaction before applying mastery, mock results and world rewards. Mock membership is checked, but ordinary attempts do not currently load a canonical question for grading. `ListQuestionsForActivity` already restricts mission candidates by runtime status and active release; the grading path must not bypass that governance.

The client sends integers using `parseInt` and serializes many structured answers into text. The full question response also exposes `expected_answer`, which several renderers use to determine response type, models or selections. Removing that field without replacing these dependencies would break games; replacing client comparison alone must not be described as preventing answer-key inspection.

## Implementation order

1. Add adversarial repository/API tests before changing the grading path: forged expected values; unknown question IDs; mismatched objectives/formats; draft or out-of-release content; mock non-members; duplicate attempts; concurrent replay; persistence failure. Use disposable PostgreSQL as well as handler fakes.
2. Keep replay lookup **before** new-content lookup and grading. A byte-identical retry after an answer was committed must return the stored outcome, even after content changes or the mock closes. Conflicting payloads with the same key must remain conflicts. Perform lookup, grading and evidence writes within one transaction; do not reintroduce a read/write race in the handler.
3. Query the canonical question by indexed ID, with objective/release/status validation. Do not list the entire question bank on every attempt. Define explicit errors for unavailable content, stale versions and invalid response shapes; do not silently create objectives or accept a client answer key.
4. Introduce an explicit typed response contract, initially preserving legacy request compatibility. Support finite decimal numbers without truncation, text choices, ordered sequences and keyed mappings. Treat sets as unordered only where the format contract says so. Accepted alternatives, numeric tolerance, units and rubric responses require authored policy rather than generic fuzzy matching. Unsupported evidence must not earn fabricated mastery.
5. Snapshot/version the served question contract and tie attempts to it. Define behaviour for a genuine first submission after content was withdrawn or revised; do not silently score against a different answer. Mock items need the same immutable identity semantics. Store enough identity/evidence for an adult to explain a result later.
6. Separate public rendering fields from the answer key. Replace renderer dependencies on `expected_answer` with safe response-kind, model and choice metadata. Keep legitimate teaching examples distinct from assessment answers. Verify every renderer contract before removing the legacy public field.
7. Make incorrect feedback subject/task-specific. Current scoring language assumes timed arithmetic recall even for literacy/science. Keep scaffold use, processing time, SEND accommodations and evidence confidence separate; do not certify mastery from game completion or compare children with speed leaderboards.
8. Extend browser/API integration tests through saved attempts, subject-specific progression and spaced revision. Verify advancing Mathematics does not depend on English progress, mocks remain separate from mastery, and a lost acknowledgement cannot award twice. Inspect parent/school/admin reports for the same evidence identity and scope boundaries.

## Release evidence

- API unit/integration tests, migrations on disposable PostgreSQL, and concurrent replay/rollback tests.
- Validated response-contract inventory across supported formats, including all authored decimal questions and structured answer shapes.
- Desktop/mobile Playwright through real backend persistence, not only intercepted success responses.
- Stable error recovery, no known answer-key trust bypass, and explicit remaining unsupported formats.
- Human educational, safeguarding and audio-listening gates remain distinct from automated engineering and AI review.

This is intentionally a substantial backend/client contract batch. It must not be reduced to copying client expectations into another field or bulk-marking content approved.
