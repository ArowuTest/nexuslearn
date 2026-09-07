# Required-listening assessment gate

## Defect and change

An explicitly required recording could be unavailable while the same question remained automatically markable. Public manifest filtering stopped unapproved playback but did not protect canonical marking. Browser regressions also reproduced a direct submission window while playback was pending.

The backend now treats `audio_required` and `audio_asset_status` values `required` / `required_before_pilot` as required listening. Optional narration does not block a visual task. Required prompt references are resolved in one query per bounded question batch, not separate network/database calls per clip.

Readiness requires the question's applied live content release, matching audio-release/catalogue digests and licence, complete production inventory, technically passing released assets, the exact asset hashes in content-release evidence, matching reference identities, and the latest named listening-review record with approved criteria and matching hashes. A later rejection supersedes an older approval. An authored URL or readiness flag is not approval. Unknown, missing, stale and partial bindings remain unmarkable.

The same resolver runs when serving ordinary and mock questions and when marking a submitted attempt. Completed idempotent replay runs first, so a later audio revocation does not alter a previously saved answer. Exact audio and review identities are included in private grading snapshots and question-version hashes. The grader revision is `canonical-policy-v3`; in-flight older question versions need reloading. Pupil projection publishes only the approved primary playback URL and normalised required marker, not private review evidence.

Migration `0048_required_listening_review_lookup` indexes latest decisions by asset and descending creation time/ID. This supports the runtime query's latest-before-hash-check semantics without repeatedly sorting an asset's full review history.

## Pupil playback boundary

- Missing required evidence or transport shows **Listening recording unavailable**, with an accessible Back to worlds route. The question is not marked and previously saved answers remain intact.
- Answer controls and submission remain disabled until the current required recording completes. Pending, failed or cancelled playback cannot unlock an answer.
- Completion is scoped to the pupil, question/version and recording URL. It does not carry over to a different pupil or changed question.
- Shared player outcomes cover both the question playback control and renderer playback. A late error from an obsolete/cancelled player cannot close the current question or unlock it.
- A known transport failure closes the question even if the recording previously completed. Optional narration keeps its existing visual route.

This browser completion check is a UI integrity safeguard, not a server-verifiable claim that a child attended to or understood audio. The server independently verifies release approval; it does not trust a client `audio_ready` flag or perform a remote media download on each answer. Device playback failure and production listening approval are different checks.

## Verification and review

The initial backend regression showed required listening being projected as a normal text answer. PostgreSQL tests cover missing approval, exact approval, private/public projection, frozen snapshots, revocation, replay and rollback, plus stale hashes, unapproved assets, technical failure, unresolved/stale references, release-digest mismatch and incomplete binding.

One bounded read-only reviewer identified submission before delayed playback failure. A separate browser regression reproduced enabled answer controls before playback; the full-completion gate addresses that finding. The reviewer was closed. Browser coverage includes desktop/mobile accessible exits, failed playback from both controls, pending playback, completion, obsolete errors, late errors, optional audio lifecycle and existing marking/recovery routes.

Deployment smoke checks require `required_listening_contract: ledger-v1` from the running API, in addition to the existing contracts. Final local and hosted results are recorded in FS V2B after verification.

Local acceptance evidence:

- Full Go tests with disposable PostgreSQL, `go vet ./...` and `go build ./...` passed. Windows test-binary cleanup contention was avoided with `go test -work`; failing assertions were not suppressed.
- Production build, TypeScript, scoped ESLint and asset-budget checks passed. Aggregate JavaScript is 1,404,864 bytes against the unchanged 1,405,000-byte ceiling; further growth needs real reduction, not a budget increase.
- 62 desktop/mobile mission, recovery, switch-access and transport tests passed with retries disabled. After adding obsolete-completion and required-mute cancellation coverage, all 16 focused required-listening cases also passed with retries disabled.
- Six authenticated browser/API/PostgreSQL journeys passed, including saved evidence, lost-acknowledgement replay and authored reading alternatives. All 48 migrations applied to the disposable database schema.
- Initial new browser assertions incorrectly used `toBeDisabled` on the fieldset group. Acceptance now checks the actual answer button's disabled state, and its enabled state only after current playback completes.

## Remaining boundaries

No real recording, generation setting, curriculum approval or listening-review status changed. The 874-file technical audit and 172 pace-review flags remain as previously reported. Naturalness, pronunciation, child/SEND listening suitability and the necessary listening decisions are still outstanding. Answer leakage via scaffold/phoneme models and the associated assistance-evidence policy remain separate G12 work. This gate does not claim those are complete or substitute a visual spelling task for an unavailable listening assessment.
