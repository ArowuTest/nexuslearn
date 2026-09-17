# Version-checked support saves implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Prevent stale or retried adult requests from replacing newer pupil support, without losing the adult's draft.

**Architecture:** A database-owned, non-reused version and transactional actor-scoped writer protect both standalone support endpoints. The existing retry ledger stores minimal receipts. Family setup only initialises missing support; the school editor separates base, draft and conflicting saved settings.

**Tech Stack:** Go, pgx v5, PostgreSQL 16, Next.js/React/TypeScript, Node test runner and Playwright.

**Spec:** `docs/superpowers/specs/2026-09-14-support-profile-concurrency-design.md` (user approved).

## Global constraints

- Work on the existing main checkout with explicit user consent; preserve unrelated dirty/private/generated files.
- One substantial tested commit/push, not a documentation-only or per-task push.
- One focused UI implementer in parallel with the lead's backend work; one integrated adversarial review. No recursive delegation.
- No secrets, paid provider calls, live pupil mutations or invented independent/human approval.
- Versions are positive safe integers allocated by a non-cycling sequence; zero means no stored support for an authorised pupil. Never use timestamps for comparison or assume consecutive versions.
- A conflicting save changes nothing. Same-key retries must not mutate support twice. Newer saved settings require deliberate review, never silent merge/overwrite.
- Preserve budgets: aggregate JS 1,430,000; route JS 750,000; max chunk 250,000; CSS 120,000; public asset 600,000 bytes.
- Test database: dedicated PG16 on 127.0.0.1:15432; tests create/drop their own schemas. Never touch the unrelated 5432 instance.
- Node runtime: `C:/Users/sanus/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin`; Go: `C:/Go/bin`, `CGO_ENABLED=0`, `GOMAXPROCS=2`, `-p 2`.

## Task 1: Versioned storage and atomic support writer (lead)

**Files:** create `apps/api/migrations/0060_student_engagement_versions.up.sql` and `.down.sql`, `apps/api/internal/learning/student_engagement.go`, `student_engagement_integration_test.go`; modify `curriculum.go`, `configuration.go`, `repository.go`, `parent_child.go`, `parent_child_integration_test.go` in that same package.

**Interfaces:**

```go
type EngagementActor struct { ID, Kind, SchoolURN string } // Kind: parent or school; server-owned
type EngagementSave struct {
    Profile StudentEngagementProfile
    ExpectedVersion int64
    IdempotencyKey string
}
type EngagementSaveReceipt struct {
    AppliedVersion int64 `json:"applied_version"`
    Changed bool `json:"changed"`
    Replayed bool `json:"replayed"`
}
type SavedStudentEngagement struct {
    StudentEngagementProfile
    SaveResult EngagementSaveReceipt `json:"save_result"`
}
type EngagementConflict struct {
    CurrentProfile StudentEngagementProfile
    PreviouslySaved bool
}
type StudentEngagementRepository interface {
    ReadStudentEngagement(context.Context, EngagementActor, string) (StudentEngagementProfile, error)
    SaveStudentEngagement(context.Context, EngagementActor, EngagementSave) (SavedStudentEngagement, error)
}
```

`StudentEngagementProfile.Version int64` is JSON `version`. `EngagementConflict` implements error; `ErrEngagementForbidden` and `ErrEngagementVersionRequired` provide explicit boundaries. `PrepareEngagementSave` validates complete decoded settings, normalises strings/arrays and rejects invalid version/key; it never takes actor identity from JSON.

- [x] RED: add existing-method parent setup regression, asserting a second setup with different support preserves the first profile and timestamp. Add a migration regression asserting the version column exists before querying it. Run `go test -p 2 ./internal/learning -run 'Test(ParentChildSetupPreservesSupport|StudentEngagementVersionMigration)Postgres' -count=1 -v` and retain actual failures.

```go
first, err := repo.UpsertParentChild(ctx, parentID, child, StudentEngagementProfile{SensoryLoad:"low", Notes:"Keep this support"})
if err != nil { t.Fatal(err) }
second, err := repo.UpsertParentChild(ctx, parentID, child, StudentEngagementProfile{SensoryLoad:"high", Notes:"Stale setup"})
if err != nil { t.Fatal(err) }
if !reflect.DeepEqual(first.Engagement, second.Engagement) { t.Fatal("setup replaced established support") }
```

- [x] GREEN: add sequence/column migration; keep runtime and parent portal reads version-aware. Convert `saveParentChildSupport` to `INSERT ... ON CONFLICT DO NOTHING`, then return the stored profile. Existing identity/credential writes stay atomic. Adjust old rollback regression to target an actual initial support insertion, not a now-prohibited update.

```sql
CREATE SEQUENCE student_engagement_version_seq AS bigint MAXVALUE 9007199254740991 NO CYCLE;
ALTER TABLE student_engagement_profiles ADD COLUMN version bigint NOT NULL DEFAULT nextval('student_engagement_version_seq');
ALTER SEQUENCE student_engagement_version_seq OWNED BY student_engagement_profiles.version;
```

- [x] RED: declare the narrow interface/types; test capability presence plus real competing connections, stale expected versions, no-change saves, duplicate keys, changed-key payloads, actor/child scope, revoked links and superseded replay. Assert final rows, ledger metadata and audit counts. A missing capability is an explicit failing assertion before the writer is implemented.
- [x] GREEN: implement actor/scope locking, pupil row locking, version comparison/predicate, private receipt hashing/replay, atomic minimal audit and receipt. Return current authorised profile on conflict; omit private notes from ledger/audit. Remove unconditional `UpsertStudentEngagement` and migrate test seeding to direct disposable fixture SQL.

```go
var conflict *EngagementConflict
if !errors.As(err, &conflict) { t.Fatalf("expected stale-save conflict, got %v", err) }
if conflict.CurrentProfile.Notes != "newer support" { t.Fatal("stale request changed newer support") }
// Identical replay: current profile and applied_version stay stable; audit count stays one.
```

- [x] Verify rollback on injected audit/receipt errors; simultaneous first saves; delete/recreate version non-reuse; revocation wait/recheck and account status. Run all learning tests against disposable schemas, not only new cases.

## Task 2: Complete, scoped HTTP contract (lead)

**Files:** create `apps/api/internal/server/student_engagement.go`, `student_engagement_test.go`; modify `server.go`, `server_test.go`, plus affected parent handler tests if needed.

**Interfaces:** consumes Task 1 types. `decodeEngagementSave(w,r,externalRef) (learning.EngagementSave,error)` requires explicit JSON version and all editable fields (including false flags and empty arrays), rejects duplicate keys/null/trailing documents, and uses the already permitted `Idempotency-Key` header. `writeEngagementError` maps forbidden/428/400/409 and never logs profile payloads. Success remains a flat profile plus `save_result`.

- [x] RED: existing authenticated school PUT without version currently returns 200; assert 428/code before replacing handler. Add complete-payload, duplicate-version, invalid key, foreign route identity, and scoped capability tests.

```go
if res.Code != http.StatusPreconditionRequired { t.Fatalf("unversioned save status=%d", res.Code) }
if res.Header().Get("Cache-Control") != "private, no-store" { t.Fatal("support response can be cached") }
```

- [x] GREEN: delegate school GET/PUT and parent PUT to scoped capability with immutable authenticated IDs. Fail 503 when the capability is absent, never fall back to old upsert. Validate a bounded 64KiB request body. Make profile failures use the shared stable codes and no-store; restore tests with honest complete fixtures/receipts.
- [x] Verify route-auth scope, malformed/partial payload, revoked access, parent/school parity, absent-pupil denial, invalid session and no pupil/admin permission expansion. Run full server tests.

## Task 3: School draft/conflict/retry UI (one focused implementer)

**Files:** modify `apps/web/src/components/role-workspaces/schoolSupportProfile.ts`, `apps/web/src/app/school-admin/page.tsx`, `apps/web/tools/school-support-profile.test.mjs`, `apps/web/tests/e2e/school-support-profile.spec.ts`, `identity-lifecycle.spec.ts`; create small support-specific state/transport/review units alongside `schoolSupportProfile.ts` as necessary. Do not edit backend files, family page, shared api.ts, workflows, budgets or design/plan docs.

**Transport contract:** GET profile includes required safe integer `version`. PUT flat complete profile includes base version and stable `Idempotency-Key`. Success is flat profile plus `save_result:{applied_version:number,changed:boolean,replayed:boolean}`; changed requires newer version, unchanged equal base, applied version equals returned profile version. 409 `support_profile_conflict` includes `current_profile` and `previously_saved:boolean`; 409 `idempotency_key_conflict` has no trusted current profile. 428 `support_version_required` requires fresh compatible load. All server values are untrusted until verified.

- [x] RED: add unit tests refusing versionless/unsafe loaded profiles and echoed/unacknowledged saves, preserving the key only for the same logical payload, and retaining the draft independently of a validated latest profile. Run `node --test tools/school-support-profile.test.mjs` before changing validation.

```js
assert.throws(() => verify({ ...valid(), version: undefined }, "ava"), /could not be verified/);
assert.throws(() => verify({ ...valid(), version: Number.MAX_SAFE_INTEGER + 1 }, "ava"), /could not be verified/);
```

- [x] GREEN: implement validated profile/receipt/conflict handling, fresh-key-on-edited-attempt and same-key uncertain retry. Maintain current fieldset freeze, aborts, account lifetime and selected-pupil ownership. Retain all draft fields on conflict and malformed conflict. Do not persist sensitive draft state.
- [x] RED/GREEN browser: explicit labelled comparison, retained notes/interests, deliberate review/rebase with separate save, confirmed discard, successive conflicts, uncertain save later superseded, refresh-comparison without losing draft, malformed/foreign payload privacy, account/pupil cancellation. Update existing fake responses with valid versions/receipts, not bypasses.

```ts
await page.getByRole("button", { name: "Save support profile", exact:true }).click();
await expect(page.getByLabel("Operational notes", { exact:true })).toHaveValue("My retained draft");
await expect(page.getByRole("button", { name: "Save support profile", exact:true })).toBeDisabled();
await expect(page.getByRole("region", { name:"Review changed support settings" })).toBeVisible();
```

- [x] Verify desktop/mobile/keyboard flows and cancelled late responses. Run focused units/lint/TypeScript. Coordinate browser execution with lead; do not run competing builds/servers. Report exact red/green evidence, changed paths and any unfinished checks; no commit/push or nested agents.

## Task 4: Integrated regressions, review and release (lead)

**Files:** modify `apps/web/src/lib/api.ts` only to expose read version metadata without requiring it in initial setup; `apps/web/tests/e2e/roles-backend.spec.ts` for real conflict/retry and family support preservation; `apps/api/internal/server/role_journeys_browser_test.go` if the existing fixture harness requires it; `.github/workflows/platform-quality.yml` only if adding new unit files to its explicit test list; create `docs/reviews/2026-09-14-support-profile-concurrency.md`.

- [x] Reconcile API/TS receipt types and remove all stale unversioned fixtures. Self-review complete spec coverage, authorisation and lock ordering; one independent review of this meaningful integrated batch, not one per minor edit.
- [x] Run `go test -p 2 ./...` with dedicated test DSN, then web units, TypeScript, lint, production build and unchanged performance budget. If JS grows, extract/lazy-load adult-only support code rather than increasing limits.
- [x] Run focused new Playwright cases, complete fixture/visual matrix, real canonical and role harnesses sequentially. Assert persisted runtime support, not only fixture/UI rendering. Preserve failed runs and record corrections honestly.
- [ ] Verify only reviewed paths are staged, `git diff --cached --check`, no credentials/private reports, then commit/push main under standing user authority. Verify exact SHA GitHub platform/content checks and hosted API/frontend versions; manual Render action only if still necessary.
- [ ] Record final evidence, remaining independent human/pilot gates and durable FS V2B checkpoint. Do not equate batch completion with whole-product or clinical approval.

## Execution ledger and rulings

- User approved the written contract and implementation. No further design approval is needed for this batch.
- Tasks 1/2 share Go interfaces: lead implements sequentially. Task 3 consumes only the fixed HTTP contract and has a disjoint web write set. Task 4 integrates both after local green checks.
- Ruling: use one parallel UI implementer and one integrated reviewer, not a new agent for every subtask; this follows the user's credit and meaningful-batch preference.
- Ruling: reuse the current main worktree and no mini commits; explicitly requested by the user. Preserve all pre-existing dirty content.
- Ruling: full PUT decoding is capped at 64KiB to bound duplicate-field/shape validation; no support payloads are added to logs or checkpoints.
- All four tasks cover the approved spec. Header/status codes, receipts, version bounds and script paths are consistent. The baseline passed previously but did not cover stale writes; RED evidence remains mandatory.

### Backend checkpoint (2026-09-14)

- Initial RED proved actual setup overwrite and missing server versions; initial migration/family GREEN then passed.
- Scoped writer RED proved missing capability; subsequent real PG tests passed. Added concurrent parent/school revocation, actor/school status checks, ledger/audit privacy, same-key race, superseded replay, no-change saves, receipt/audit rollback, setup-after-newer-save and actual migration backfill/down/up checks.
- Initial handler RED included incomplete portal/session fixtures as well as unversioned status 200. Corrected fixture school scope and subtest reporting, without relaxing authentication; focused assertions passed.
- Windows Go temporary executable deletion intermittently failed after successful tests. `go test -work -p 2 ./... -count=1 -timeout=15m` retained build artifacts and completed with exit 0: learning 236.211s, server 100.749s, database/narration JSON and command packages green. Log: `apps/api/.agent/support-version-api-full-20260914.log` (private/untracked).
- Tasks 1/2 implementations are locally verified. Task 3 agent and Task 4 integrated browser/build/review/release are still in progress. No commit or push yet.

### Historical host-blocked checkpoint (2026-09-14)

Tasks 1-3 are implemented and verified locally. Task 4 has full API/PostgreSQL, 75 boundary unit tests, TypeScript, lint, production build and unchanged budgets green; 82 focused desktop/mobile browser tests pass. Integrated review plus a bounded follow-up produced two concrete findings, both reproduced and fixed. All agents are closed. Necessary size remediations preserve admin markup and lazy renderer behaviour; aggregate JS is 1,429,051 bytes.

Do not mark the full browser or release steps complete. Broader local Linux verification hit a synthetic audio fixture race (corrected), two still-unresolved timeout results, then disk exhaustion. C: filled to about 10 MB; only this project's regenerable compiler cache was removed, recovering about 1.5 GB. Docker remained unresponsive and available RAM was about 592 MiB. Its task-owned test container shutdown is unconfirmed. The delivery evidence document has exact resources, commands, logs and the 31-path staging boundary. No commit/push has occurred; preserve all unrelated dirty files. Resume after host recovery, complete the remaining gates, then push one tested batch to main and verify deployment.

### Latest continuation checkpoint (2026-09-17)

The historical host blocker above is resolved. Full pinned-Linux browser/visual matrix: 608 passed, 12 real-backend-only cases skipped, zero failures/retries. Both separate real PostgreSQL browser harnesses then passed 6/6, including retained support, deliberate conflict resolution and pupil adaptation. Fresh full API, web lint, 75 boundary tests, 16 deployment-identity tests and unchanged budgets passed. Real conflict screenshots were visually checked on desktop/mobile. No application changes were needed during this resumed validation.

All local implementation gates are complete; proceed with the explicitly reviewed 31-path batch push to main and verify exact-source GitHub/API/frontend outcomes. Those remote gates are not presumed successful here. Record the actual release result in the FS V2B checkpoint without creating a documentation-only mini-push. Preserve unrelated generated/private files and all evidence.
