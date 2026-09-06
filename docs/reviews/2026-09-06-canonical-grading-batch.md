# Canonical grading remediation

Baseline: `228293d`. Engineering remediation, not a curriculum/SEND professional approval or a claim of production readiness.

## Delivered behaviour

- The attempt handler no longer grades browser-provided expected values or passes a precomputed result to persistence. `RecordAttempt` owns canonical lookup, grading and evidence writes.
- A new attempt loads its question by primary-key ID, joins its configured objective, requires runtime-approved status, and checks the active live release for both records. A format/objective mismatch cannot manufacture mastery evidence.
- The idempotency lookup remains before content validation. Concurrent matching retries return one recorded outcome. Conflicting requests remain conflicts. A committed retry remains valid after question withdrawal or mock closure. Failed writes roll back mastery, attempts and the request key together.
- The API serves a question-contract version and response kind. Updated clients submit typed numbers, text, sequences or mappings and the served version. Decimal values no longer pass through `parseInt`. Typed evidence without its version is rejected; changed content cannot silently be used to grade an in-flight typed answer.
- JSON object property ordering does not change mapping correctness. Sequence order is preserved; only explicitly supported sorting/control-list contracts treat their lists as unordered. No generic fuzzy matching or numeric tolerance was introduced.
- Rubric-only/moderation-required work cannot be certified by a completion token. It returns an explicit review-needed error rather than fabricated mastery.
- Mock answers record correctness but do not claim mastery gains or world energy that was not awarded. Missing persistence cannot return a successful grade.
- The UI preserves the exact pending request during uncertain saves. Definite rejection offers a route out instead of an endless retry loop. Local malformed structured input remains editable without sending a request.
- Updated clients fail closed if the API has not supplied a question version, so a frontend/API deployment race cannot accidentally send the new payload to the old browser-key grader. They submit only typed learner responses, not legacy expected/given fields.

## Storage and maintainability

Migration `0046` adds `question_grading_versions` and a nullable foreign key from `question_attempts`. Each distinct question contract is stored once and shared across learner attempts, avoiding a full copy of the question body for every answer. Snapshots survive changes to the live question. Historical attempts remain unversioned; no historical provenance is invented.

The focused grading module is separate from reward/progression persistence. Its question query is bounded by ID; it does not enumerate the bank to mark an answer. Database locking keeps the selected question/objective stable while evidence is written. Version insertion and attempt evidence use the same transaction.

## Verification and adversarial review

Tests were introduced before each repair. The original real-PostgreSQL test demonstrated that a forged `99 == 99` browser key earned mastery for a canonical answer of `5`; it now fails to earn correctness/mastery and persists the canonical answer instead.

Coverage includes:

- number/text/sequence/mapping contracts, decimal precision, null typed values, version requirements, normalization without snapshot mutation;
- unavailable/draft content, mismatched objectives/formats, active-release boundaries;
- eight concurrent retries, conflicting replay, withdrawal after commit, late persistence rollback;
- mock membership, replay after closure, no mock mastery claims;
- legacy omitted/null numeric evidence versus an explicit zero, with historical replay hash compatibility;
- HTTP error mapping and database-unavailable failure;
- desktop/mobile browser submission, recovery, existing switch-access and support-evidence regressions.

One independent reviewer examined the grading batch and found the missing-legacy-answer and malformed-local-JSON issues. Both were reproduced with failing tests and repaired. The reviewer was closed afterwards.

The opt-in real browser harness starts an authenticated localhost API over a disposable migrated PostgreSQL schema. Both browser projects load a real mission, submit `1.25`, lose the first acknowledgement after the database commit, then replay the exact request. Database assertions require one attempt and one six-point mastery change per learner. This test is distinct from intercepted API fixture tests.

### Reproduce

From `apps/api`, with a disposable PostgreSQL connection:

```powershell
$env:TEST_DATABASE_URL = 'postgres://test_user@127.0.0.1:15432/postgres?sslmode=disable'
go test ./...
go vet ./...
go build ./...
$env:RUN_BROWSER_GRADING_QA = 'true'
go test ./internal/server -run TestBrowserCanonicalGrading -count=1 -v
```

The browser harness requires the web dependencies and Playwright Chromium installed. It uses port 3109 for the local frontend and creates/drops only its unique schema. The dedicated browser spec skips ordinary fixture-only runs unless launched by the harness; Platform quality runs the harness explicitly against its own PostgreSQL service after the browser fixture suite. No hosted API or real pupil accounts are used.

From `apps/web`:

```text
npx tsc --noEmit
npm run lint
npm run build
npm run quality:performance
npx playwright test tests/e2e/mission-integrity.spec.ts --workers=2
```

## Explicit remaining boundaries

### Local acceptance evidence

- All Go package tests passed with disposable PostgreSQL, followed by `go vet ./...` and `go build ./...`.
- TypeScript, ESLint and the production build passed, including the existing content validators. Validator counts are not new educational approvals.
- Broad nonvisual browser suite: **136 passed, 2 opt-in cases skipped**, in 6.4 minutes. The two opt-in authenticated real-backend cases passed separately, with final database assertions.
- Aggregate JavaScript: **1,404,745 bytes**, below the unchanged 1,405,000-byte ceiling. Largest route JavaScript: 675,277 bytes; CSS: 63,197 bytes; largest public asset: 472,354 bytes.
- Windows Node 22.15.0 hit a Playwright synchronous import-hook incompatibility during broad test discovery. The bundled Node 24.19.0 runner loaded and passed that suite without dependency changes. Linux visual baselines remain unchanged and are verified by the pinned CI image.
- No production/hosted pupil records were seeded. The owned local PostgreSQL server was stopped and the single reviewer closed after verification.

### Work still open

1. The public question DTO still contains `expected_answer` because renderers depend on it. This batch removes **answer-key trust**, not **answer-key visibility**. Safe model/choice metadata and full renderer contract migration are the next engineering batch.
2. Legacy requests temporarily remain accepted without a question version for rolling compatibility. They are marked from the current canonical question, never from their expected fields. Retire this path after client rollout; it cannot prove which old question revision a legacy client saw.
3. Accepted semantic alternatives, case-sensitive tasks, unit policies, numerical tolerances, rich rubrics and marking of authentic tracing evidence require authored policies and further tests. Exact-match support is not proof of educational adequacy for every authored variant.
4. Snapshot data is durable but the adult report/review UI still needs an explicit provenance view. Existing progress reports have not been redesigned in this batch.
5. Human safeguarding, independent educational review and listening QA remain separate gates. No curriculum promotion or new ElevenLabs recording was performed here.

Deploy the additive migration with the API before enabling the new client contract. A new frontend reaching an old API shows an update/reopen message instead of saving an unsafe answer. The existing documented development deployment uses `AUTO_MIGRATE=true`; hosted migration/application status must be verified, not inferred from a frontend deployment.

`GET /v1/version` advertises `grading_contract: canonical-v1` so deployment checks can distinguish the new grader from the previous API. This describes code capability, not a claim that content or human review gates have passed.
