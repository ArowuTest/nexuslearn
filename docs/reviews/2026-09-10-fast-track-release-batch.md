# Authentication, privacy and canonical-audio integration batch

## Scope and authorization

The user approved pushing the pending school-session correction `e469611`
and this combined batch to `ArowuTest/nexuslearn` main. The outgoing source
preserves generated private reports, local evidence and credentials outside
the commit. The three-subject Years 1-7 MVP and separate human listening,
safeguarding and pilot acceptance gates are unchanged.

This batch consolidates:

- Consistent owned adult sign-in, bounded responses, session validation,
  cancellation and failed-login recovery across parent, school and admin.
- Whole-workspace private-data clearing on expiry, replacement and sign-out;
  family startup no longer waits for every child's supplementary evidence.
- Shared production-browser widgets to meet the existing Chromebook budget.
- Canonical deduplicated variant-audio production, recoverable paid-response
  publication, immutable URL history and explicit operator rights confirmation.
- Actual Node-producer to Go-import hash compatibility, blocked specialist
  placeholders, legacy/v2 listening inventory and accurate shared-pack filters.

Detailed reviews:
`2026-09-10-adult-authentication.md`, `2026-09-10-adult-session-privacy.md`,
and `2026-09-10-canonical-variant-production.md`.

## Executed local evidence

- Full Go suite passed with disposable local PostgreSQL. After final server
  filter changes the server and narration serialization packages passed again.
  CGO was disabled; these are not race-detector results.
- The final actual-producer/HTTP-import contract passed after durable-history
  changes, followed by **6/6** real API/PostgreSQL desktop/mobile role journeys
  (family-to-pupil, school management and admin), zero retries, one worker.
  Evidence: `apps/api/.agent/fast-track-integration-serial-20260910.log`.
- Earlier role verification passed 5/6: the mobile family link remained on the
  family page, with no login request and outstanding local image responses in
  the trace. The unchanged serial run passed all six. This does not establish
  a definitive cause or erase the earlier intermittent failure; CI remains
  required, with no timeout or retry changes.
- Offline content tools **80/80** passed, including bounded provider failures,
  recoverable publication, immutable audio history and malformed-history
  rejection: `.agent/audio-content-tools-serial-final-20260910.log`.
  An earlier concurrent run passed 79/80; both deadline tests passed unchanged
  in two subsequent serial runs. See the canonical-audio review.
- Frontend unit/boundary checks **41/41**, TypeScript and focused lint passed.
- Production build and unchanged performance gate passed: aggregate JS
  **1,428,706 / 1,430,000**, largest route **700,689 / 750,000**, largest public
  asset **275,314 / 600,000** bytes. No visual baselines or limits were relaxed.
- Combined fixture browser run: **226 passed / 10 failed** out of 236.
  Corrected obsolete privacy assumptions in three test files, then those
  suites passed **48/48** desktop/mobile without retries. Across these runs,
  all 236 unique cases have passing coverage; not one green 236-case run.
  See `apps/web/.agent/fast-track-browser-20260910.log` and
  `apps/web/.agent/fast-track-browser-corrected-20260910.log`.
- One purposeful worker implemented the privacy slice, then independently
  reviewed audio publication. Its two immutable-URL findings were reproduced
  and fixed, including the successive-batch missing-file bypass. It is closed.

## Release boundary and next work

At this document's commit time, remote CI and exact hosted revision checks are
pending. Local checks do not establish a successful GitHub/Vercel/Render release.
The FS V2B checkpoint records subsequent commit, CI and deployment outcomes.

No new real provider recordings or human listening approvals were produced.
Production still requires a protected provider key, selected character/credit
budget and rights confirmation; real decoding/listening and pace decisions;
specialist speech handling; exact manifest import and release activation after
independent content, safeguarding and pilot gates. Retain both the v2 inventory
and immutable asset history. Do not cancel the provider subscription based on
this tooling verification or silently mark AI review as human acceptance.
