# Exact deployment identity and listening-coverage integrity

## Scope and reproduced failures

This batch follows main `06a6341` and addresses two evidence gaps, not curriculum
expansion or a claim of complete production readiness.

1. The deployed API version reported static contracts but no Git revision.
   The smoke workflow accepted an older backend with matching contracts.
   API regression tests reproduced the missing identity. Porting the existing
   smoke conditions into a testable validator reproduced ten failing identity
   and bounded-polling assertions before adding the exact-revision gate.
2. The admin audio player set completion on any `ended` event. A Playwright
   regression with only the last second of a ten-second recording played
   reproduced the enabled approval button. A new review could also inherit a
   prior named review's completion.

## Implementation

- `/v1/version` reports validated Git identity, source and state without caching.
  Embedded Go VCS metadata takes precedence; Render's default checkout SHA is
  explicitly labelled as a platform-reported fallback. Dirty, conflicting,
  malformed or incomplete metadata fails deployment verification.
- A dependency-free Node smoke validator retains health, contracts and access
  boundaries, uses bounded parallel requests without following redirects, and
  requires the exact successful main push SHA. An overtaken run cannot pass
  against another commit. It does not trigger deployments or use credentials.
- The reviewer player checks native played-range coverage at original speed.
  Overlap cannot double count, a skipped gap cannot be hidden, and altered-speed
  QA resets the playback evidence. Production-speed metadata is still distinct
  from player speed. Pupil/SEND controls are unchanged.
- `played-ranges-v1` evidence is stored in the existing JSONB record and validated
  again at both the API and repository boundary. Legacy records are readable;
  new workspace approvals require the stronger evidence. A new review needs
  fresh playback rather than inheriting completion from history.

## Validation record

Final local verification:

- Full content prebuild, Next production build, TypeScript and scoped ESLint pass.
- 46 desktop/mobile admin and audio Playwright journeys pass, including actual
  MP3 playback from zero, skipped coverage, changed speed, fresh historical
  review context, consecutive decisions, and audio/transcript/profile/URL changes.
- 35 smoke/audio regression tests pass (13 deployment and 22 audio checks).
- All 874 existing MP3s decode; no inventory, corruption, silent/nonfinite,
  clipping or duplicate-file fault is flagged. The 172 pace flags and 874
  unknown historical speed settings remain explicitly unresolved.
- Fresh uncached `go test -work ./... -count=1` passes with disposable PostgreSQL
  16 (learning 39.698s); `go vet`, `go build`, Go formatting and diff checks pass.
- Five asset-budget tests pass. Aggregate JS 1,425,770 / 1,430,000; maximum route
  694,856 / 750,000; largest JS 222,190; CSS 63,841; public asset 275,314 bytes.
  No budget or visual snapshot threshold was relaxed for this batch.

The bounded independent review found native ranges surviving a successful
decision while the same media element remained mounted. Its new regression
failed before the fix. A per-recording playback-run key now remounts the player
after every successful saved decision, even if the subsequent re-record request
needs a retry. Media errors no longer create blank drafts that mask a later
server review update.

The real-file diagnostic also showed the test itself clicking the native seek
bar: only 1.710857s through 4.388571s had played. The new guard correctly rejected
this. The test now obtains its user gesture outside the player and starts at
zero; the coverage allowance was not changed. Native telemetry is retained with
the browser evidence.

A PC/tool restart interrupted one verification run and stopped the disposable
database. Those interrupted/connection-refused results were not counted as
passes; the database recovered and the final suites above were rerun. Hosted
checks and exact deployed revision are recorded in the delivery checkpoint
after push. No generated/private reports belong in the commit.

## Limits and remaining work

Playback telemetry is user-controlled and cannot establish that anyone paid
attention, heard sound, or judged pronunciation correctly. Automated fixtures
exercise state and payload contracts; a separate real existing MP3 case checks
actual native browser playback. Neither is a named human listening approval.

The existing 874 files still require recorded human listening decisions. The
172 pace-screen flags remain review prompts, not automatic failures or automatic
regeneration instructions. This batch creates no new audio or approval records
outside isolated tests, uses no paid speech service, and changes no curriculum
release or safeguarding gate.

## Technical references

- [Render default environment variables](https://render.com/docs/environment-variables)
  documents the default deployment SHA at build time and runtime.
- [Go runtime/debug](https://pkg.go.dev/runtime/debug#ReadBuildInfo)
  documents binary build settings, including VCS metadata.
- [GitHub workflow events](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#workflow_run)
  explains why the workflow-run source SHA must not be confused with the default
  branch SHA used to execute a following workflow.
