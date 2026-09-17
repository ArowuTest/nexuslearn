# Version-checked pupil support saves

Date: 2026-09-14
Base: main, `7409b16fa468eed01216ba71c0b72710875e7562`
Status: written contract approved by the user on 2026-09-14 ("go ahead and implement"). Implementation and its evidence are tracked in the matching plan; this design alone does not claim completion.

## Outcome and boundaries

Two authorised adults must be able to open the same pupil support profile without the later save silently overwriting settings changed since that adult loaded the page. A lost save response must be safely retryable. The browser retains a conflicting draft and asks the adult to review the newer settings before attempting another save.

This is one backend-and-school-UI delivery batch, not a curriculum expansion, a new parent editor, a platform-admin permission expansion, or a clinical approval workflow. Existing learner adaptations, audio, gamification preferences, school membership rules and separate subject progression remain intact. No live pupil records, historical audit records, provider credentials or paid audio generation are changed during development.

## Verified current paths

| Path | Current behaviour | Required change |
| --- | --- | --- |
| School `GET/PUT /v1/school/students/{externalRef}/engagement` | UI verifies the loaded pupil/profile; the repository still overwrites all support fields unconditionally | Return and enforce a server version, scoped transactional authorisation, stable save retry and explicit conflict recovery |
| Parent `PUT /v1/parent/children/{externalRef}/engagement` | Uses the same unconditional repository writer; existing ownership helper loads the family portal | Apply the same save contract with targeted, active-parent-link authorisation |
| Parent `PUT /v1/parent/children/{externalRef}` | Atomic child/credential transaction also overwrites existing support through `saveParentChildSupport` | Initialise support only when absent; return existing support unchanged on setup retry or identity update |
| Parent portal | Returns support for linked children | Include the saved version, or zero for an authorised child without a persisted profile |
| Learner runtime | Reads the saved support profile to derive adaptations | Preserve settings and behaviour; version metadata must not expose private fields to pupils |

There is no separate platform-admin support-profile editor or direct support write route in the inspected source. The second `UpsertStudentEngagement` handler is the parent handler, not an admin handler. Do not build or claim an admin editor in this batch.

Source authority: `apps/api/internal/learning/configuration.go`, `parent_child.go`, `curriculum.go`, `repository.go`; `apps/api/internal/server/server.go`; `apps/web/src/app/school-admin/page.tsx`, `src/app/family/page.tsx`, `src/components/role-workspaces/schoolSupportProfile.ts` and `src/lib/api.ts`.

## Chosen approach

Use optimistic concurrency: the API compares the loaded version with the current stored version in the save transaction. A mismatch returns an explicit conflict and changes nothing. Temporary edit locks were considered and rejected because adults should not be prevented from reading or drafting while another person has a page open. Automatic field merging is excluded because combinations of SEND settings can be interdependent.

### 1. Version and API contract

- Add a non-null database-owned `version` to persisted support profiles. Zero represents an existing, authorised pupil with no persisted support profile; it is not permission to overwrite an existing row.
- Allocate positive versions from a dedicated PostgreSQL bigint sequence, bounded by JavaScript's maximum safe integer and configured without cycling. Existing rows receive versions during migration. Every actual support mutation receives a fresh version; gaps are expected. Versions are not `updated_at`, and clients must not assume consecutive values.
- Database-wide non-reuse also prevents an old draft becoming valid again if a pupil/profile is deleted and recreated with the same external reference. Never reset this sequence in application operations.
- Authorised reads return the complete profile and version. A missing, negative, fractional, unsafe or otherwise malformed version is never accepted as a loaded editable profile. Timestamps remain display metadata only.
- Both standalone support PUT routes require a complete support profile with its loaded `version`, and an `Idempotency-Key` header. The path pupil and authenticated actor override any client-provided identity metadata. A new profile is saved with loaded version zero.
- Decode required booleans, arrays and scalar choices explicitly rather than silently defaulting omitted saved settings. Reject null, malformed, unsupported, duplicate version fields and trailing JSON documents. Normalise notes/interests consistently before hashing, writing and responding. Existing first-time child setup keeps its documented initial defaults.
- Missing version returns HTTP 428, code `support_version_required`; malformed/incomplete profile or invalid key returns 400. A valid but stale version returns 409, code `support_profile_conflict`, with the freshly authorised complete `current_profile` and `previously_saved` flag. Inaccessible or absent pupils produce the same 403 denial without profile/version/existence details.
- A successful save or replay returns the complete current profile with its server-owned version and a `save_result` receipt containing `applied_version`, `changed` and `replayed`. The applied version must equal the returned current profile version. A changed save acknowledges a version newer than the submitted base; an explicitly unchanged save acknowledges that same base version. An echoed request without a valid receipt is not a verified save. Receipt metadata is never included in the next editable profile payload.
- Support reads, writes and conflicts use `Cache-Control: private, no-store`. Do not persist drafts or conflict payloads to browser storage, generic telemetry, URLs or log messages.

### 2. One authorised transaction and writer

- Replace the unscoped public upsert with a narrow support repository capability receiving the verified actor ID, actor kind, school scope when applicable, route pupil, expected version, validated profile and retry key. A repository without this capability fails closed; no fallback to the former unconditional upsert.
- Check current account status and ownership inside the same transaction as the write and replay lookup. A valid session alone is not sufficient after account, parent-link or school-membership revocation.
- Parents require an active parent account and active parent-child link. Invited, paused or revoked links cannot edit support. School callers require an active eligible school account, its current membership in the specified active/trial school, and pupil membership in that school. Preserve the existing teacher/school-admin support-edit roles; do not grant content-review roles access.
- Lock the actor/scope rows, then the pupil and the required ownership rows, consistently with existing child-creation transactions. Use bounded indexed queries by immutable IDs rather than materialising a full family/school portal to authorise a support save. Hold the necessary ownership locks through commit, including replay and conflict reads.
- Serialise writes for the pupil with a row lock. Compare the current support version (or absence/zero) inside that transaction and retain a version predicate on the actual update. Competing first-time creations cannot both replace each other.
- Commit the profile mutation, new version, retry receipt and audit event atomically. Validation failure, conflict, denied access, cancellation before commit, or database/audit failure leaves none of those partially persisted.
- Keep the runtime read helper available internally. School editor reads must use scoped authorisation; a no-row default must not turn an unknown or inaccessible pupil into an editable profile.

### 3. Safe retries without another copy of private notes

- Reuse the existing `request_idempotency` ledger helpers under a dedicated support-save scope and verified actor identity. Include route pupil, expected version and the normalised editable profile in the request hash. Bound keys to 128 printable ASCII characters; the web editor uses `crypto.randomUUID()`.
- Check authorisation before reading any retry receipt. The same key with different content, version or pupil returns 409 `idempotency_key_conflict`; it is not a new save. Different authenticated adults cannot replay each other's receipts.
- Persist only a minimal receipt containing pupil identity, applied version and whether that operation changed the profile. Do not copy support notes, declared needs, interests or credentials into the ledger response payload or general audit payload.
- The same key and request replay the existing outcome without another support update, version change or audit event. If that applied version is still current, return the current profile as successful acknowledgement.
- If a later edit superseded the original successful request, return `support_profile_conflict` with `previously_saved: true` and the current authorised profile. The old retry must not resurrect its original settings, and the browser must not label the older result as the latest saved state.
- An exact no-change request at the current version records a retry receipt but does not create another support revision or update audit event. An absent profile saved for the first time still creates the initial persisted profile.
- Audit actual support changes with the authenticated actor, pupil reference, prior/new versions and operation metadata only. Leave existing historical audit retention/remediation outside this batch.

### 4. Family child-setup compatibility

- Child setup remains atomic for identity, ownership, credentials and initial support. A new child can still be created with the selected support choices and generated login credentials.
- Change `saveParentChildSupport` to insert only if support is absent, then read the stored profile. A retried setup or update of an already linked child's name/year never replaces that child's established support settings, timestamp or version.
- This is an intentional separation: child setup initialises support; the dedicated version-checked parent engagement endpoint edits existing support. Return the actual stored profile, not an echo of ignored setup defaults.
- Preserve the current stable generated child reference, ownership checks and credential non-rotation on retry. Do not claim whole child-identity updates are newly idempotent or version-checked; the guarantee in this batch concerns the support profile.
- Existing support is authoritative even when later setup input differs. The family UI currently presents this form as new-child setup, not an edit-existing-support form; keep that distinction explicit in copy and API documentation.

### 5. School conflict and retry experience

- Retain the existing verified-load gate, immutable in-flight fields, abort handling and account/pupil request ownership. Move support-specific transport/state into small testable units instead of further expanding the already large school page.
- Keep the loaded base profile, editable draft, pending save payload/key and (when needed) current conflicting profile separate. Ordinary failures retain the draft. Retrying the same uncertain payload retains its key; changing the payload creates a new logical attempt/key. A stale base still cannot overwrite a successful unknown save.
- On conflict, retain the entire draft, including notes and interests. Show a labelled, keyboard-accessible review panel explaining that settings changed elsewhere. Present saved-versus-draft values with human-readable labels; include all differing fields, and do not turn diagnoses/support labels into gamified rewards.
- Offer two deliberate actions: `Use saved settings` discards the conflicting draft only after a visible confirmation step; `Review my draft against these settings` retains it, explicitly rebases it onto the displayed saved version, and enables a separate save. Neither action writes automatically. No automatic merge, auto-resubmit or force-save option.
- Disable save until a valid current profile has been reviewed. If the server conflict body is malformed, from another pupil, or lacks a trustworthy version, do not display its private fields or trust it as a base. Keep the local draft and offer a safe fresh read for review, not a blind reload that erases it.
- While reviewing a conflict, loading current settings refreshes only the comparison copy, not the draft. Another intervening edit causes another conflict on save, even after deliberate rebase.
- If an old uncertain save succeeded but was later superseded, say so clearly. Preserve the draft and offer the same review workflow, rather than announcing generic success.
- Pupil change, sign-out, account replacement or lost access clears base, draft, conflict data, pending keys and request ownership. Late responses cannot restore another pupil's or account's information.
- Keep the responsive admin Sections menu, mobile layouts, motion settings and learner experiences unchanged. The conflict UI must fit narrow screens without horizontal overflow and announce its status accessibly.

## Verification and delivery acceptance

Use test-driven implementation and retain observed red/green evidence. Run against disposable PostgreSQL 16 schemas only; do not use hosted pupil data or mutate the unrelated default local database.

1. Migration tests: existing support preserved and versioned; missing profiles remain missing; new versions are positive, safe and not reused on delete/recreate; no sequence cycling or timestamps-as-version logic.
2. Repository integration: school and parent save races, simultaneous first creation, stale same-second edits, partial-input rejection, no-change behaviour, same-key concurrent retries, changed-payload/key conflict, lost acknowledgement, superseded replay, actor/pupil scope and revoked access. Assert final settings, version, ledger and audit counts, not only HTTP success.
3. Transaction boundaries: failures in profile/audit/receipt operations roll back; revocation and membership changes are tested with independent connections and coordinated locks. Access is checked before returning current settings or replay data.
4. Family integration: initial selected support persists; same-reference retry and child identity update preserve newer support and credentials; unrelated/inactive parent links stay denied; initial-support failure remains atomic.
5. Handler tests: route/authenticated identity authority; required version/key and complete payload; status/code mappings; parent and school consistency; private/no-store; malformed/null/duplicate metadata; no unscoped fallback. Verify no new admin or pupil support-write access.
6. Browser/unit tests: stale save retains the draft; comparison/rebase and discard confirmation; retry-key stability and reset on edited payload; superseded replay; successive conflicts; invalid/foreign conflict bodies; pending request cancellation and account/pupil switching. Cover desktop and mobile, keyboard focus, status announcements and draft privacy.
7. Real backend browser journeys: school load/save/conflict and family creation/retry with the migrated Go/PostgreSQL backend; confirm saved support still drives the established learner adaptation behaviour.
8. Integration gates: Go suites, TypeScript, lint, production build, relevant unit/boundary checks, complete browser/visual gates and unchanged performance budgets. Current aggregate JavaScript headroom is tight: 522 bytes on the verified Linux build and 213 bytes locally. Reduce duplication or lazy-load adult-only support code as needed; do not raise budgets or weaken visual/access assertions.
9. Perform one meaningful adversarial review of the integrated batch, remediate findings, explicitly stage only reviewed source/tests/docs, and push main as one tested batch. No documentation-only mini-push and no secret/private/generated report staging.
10. Verify exact-source GitHub checks and deployed API/frontend revisions. Hosted deployment can need the existing manual Render action; do not imply that a Git push proves deployment success.

## Rollout and recovery

- Ship the version-enforcing backend/migration before enabling the new editor against it. Older open browser clients without versions receive a refresh-required failure rather than an unsafe write. New UI rejects versionless API reads while Render/Vercel revisions differ.
- Verify deployment order through the actual hosted revisions and the versioned response contract; do not weaken the contract for mixed-version convenience. Brief edit unavailability is preferable to silently reverting support.
- The additive migration supports forward deployment. Rolling back to the old unconditional writer is not an acceptable operational recovery after version enforcement; use a forward fix or temporarily disable support writes. Migration-down testing is local only and not an instruction to reset live profile versions.
- Local validation proves the tested software behaviour, not clinical effectiveness, human listening approval or whole-product readiness. Keep the remaining independent review/pilot gates separate.

## Self-review

Reviewed against the actual write inventory rather than the older checkpoint's assumptions: the parent engagement endpoint exists, family setup currently does overwrite support, and there is no direct platform-admin support editor to modify. The design keeps one support-write contract, explicit retry outcomes, insert-only setup semantics and no silent draft loss. The implementation plan must refine the exact file/test sequence after this contract is approved; no remaining product choice is deferred to implementation.

## Observed baseline before implementation

On 2026-09-14, the existing `TestParentChildRepositoryPostgres`, `TestSchoolStudentEngagementRequiresSchoolPupilScope` and `TestSchoolStudentEngagementPutUsesScopedPathPupil` passed from this base source with uncached execution. The repository test exercised migrations 0001-0059 and transactional ownership/credential cases against the dedicated local PostgreSQL 16 test database. Private execution log: `apps/api/.agent/support-version-baseline-20260914.log` (not for committing).

These are baseline passes, not evidence that the proposed concurrency behaviour is implemented. The current parent retry test checks credentials/identity, not preservation of later support edits; the school handler test uses a fake unversioned upsert. New failing regressions must establish those gaps before implementation.
