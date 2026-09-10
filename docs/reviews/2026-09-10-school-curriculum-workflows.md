# School curriculum selection and reliable teacher tasks

## Delivered scope

This batch builds on `b3fe406` and replaces raw objective-ID entry in school learning priorities, teacher evidence and intervention plans with a shared curriculum chooser. Teachers browse English, Mathematics and Science in Years 1–7, read the objective and its evidence cue, and select the exact backend identity. Choosing a different curriculum year does not change the pupil's enrolled year or access supports. It supports subject-specific stretch and revision; it does not itself change automatic mastery/promotion policy.

The chooser defaults to the selected pupil's year, supports literal text search and loads 12 objectives per server page. Changing the pupil discards all three task drafts and outstanding catalogue responses. Changing the objective clears any advanced activity override. The pupil remains selected after a confirmed save. Keyboard focus returns to results after pagination and to the chooser after selection; small-screen coverage includes 320-pixel layout and accessibility scans.

## Backend and request safety

- `GET /v1/school/curriculum/objectives` revalidates current school membership and returns only seven objective summary fields. Every response is private and non-cacheable. Unsupported repository capability fails closed.
- Year, subject, literal search, limit and cursor are validated before reading the catalogue. Cursors bind school, filters, release and immutable objective position. Duplicate, unknown, malformed or missing cursor fields are rejected; the cursor never grants access.
- A read-only repeatable-read transaction pins the active release selection and bounded `limit + 1` SQL query to the same snapshot. A release change rejects an old cursor. The reserved legacy identifier cannot impersonate a real release. Existing no-live-release compatibility is preserved.
- Each logical teacher save retains its idempotency key when a response is uncertain. The real-backend browser scenario deliberately drops an acknowledgement after the API has saved teacher evidence, retries, and requires a single durable record with the same ID.
- School API requests have a 15-second deadline through body parsing. A stalled or malformed success response cannot confirm a save. An uncertain save keeps its draft and unlocks the controls. Logout/account changes fence late task responses.
- A confirmed save refreshes only the affected list. A transient read failure clears that stale list, retains the confirmation and other task drafts, and offers **Refresh saved records**, which performs no POST. A denied refresh still removes private school UI.

## Build and review

Exact browser-only shared chunks remove repeated mock-builder, progress-snapshot and dinosaur components while preserving Next's framework/server groups. Unrelated widgets remain separate chunks. No performance budget, visual baseline or screenshot tolerance was changed.

Current production build: aggregate JavaScript **1,423,611 / 1,430,000**, largest route **695,758 / 750,000**, largest JavaScript chunk **222,190 / 250,000**, CSS **72,031 / 120,000**, largest public asset **275,314 / 600,000**.

One independent read-only reviewer found no actionable issues in the scoped auth/isolation, pagination, idempotency, async recovery and chunk boundaries. The reviewer did not run validation; execution evidence is recorded below.

## Validation evidence

- Full API/PostgreSQL test suite passed: learning 122.377s and server 32.903s, followed by successful vet and build. Backend source was unchanged during the subsequent frontend recovery work. CGO was disabled; this is not race-detector evidence.
- Full content/prebuild gate, production build, TypeScript, lint and 32 boundary regressions passed. FS V2B also captured a structured passing three-test chunk check.
- Two targeted browser regressions first reproduced stalled-save lockup and loss of confirmation/drafts after a failed post-save refresh. Both then passed on desktop and mobile, along with a revoked-access refresh boundary and a GET-only retry check.
- Initial integrated school/card/workspace run: 65 passed, one existing mobile re-login case timed out awaiting sign-in. The captured state remained at Signing in; the available network trace did not record a completed second login. Ten isolated repetitions of that exact scenario subsequently passed, five per viewport, without changing its timeout or assertions. The first failure remains recorded, not reclassified as a clean run.
- Real-account role integration: **6 passed in 1.8 minutes** (Go harness 125.032s), including the teacher tasks, persisted idempotent evidence retry, intervention reassessment, family/pupil entry and protected admin navigation. An initial run failed at an incorrect exact-label intervention selector; the recorded DOM confirmed the combobox existed, and using its observed role/name fixed the harness without a product change.
- Grading integration: the diagnostic run passed **6/6 in 38.3 seconds** (Go harness 42.140s), including durable decimal grading, discovery/progress retrieval, English feedback, and accepted reading alternatives without private marking-policy disclosure. Two preceding runs each passed five cases but failed return-to-route, once per viewport. The API returned valid runtime flags promptly but the intercepted browser request did not complete; the precise cause remains unproven. Only request-failure diagnostics were added, with no timeout/assertion changes. All attempts remain recorded. Broad regression and Linux hosted checks are the additional release evidence required before calling this accepted.

## Audio and remaining work

Final local broad browser regression: **416 passed, 12 intentionally skipped in 9.4 minutes**, two workers and zero retries. The skipped cases are the separately executed real-backend suites above. Only the two Linux-baseline visual scenarios were excluded from this Windows run; their unchanged baselines remain required in CI. Both desktop and mobile passed the complete teacher-task recovery and curriculum selection scenarios. The 320-pixel chooser screenshot was also visually inspected for readable controls and contained layout.

GitHub and exact-SHA hosted deployment checks for this source batch remain pending at commit time.

The refreshed whole-catalogue audit decoded **874/874** files with no inventory or technical-integrity faults; its 22 regression tests passed. Script-duration screening flags **172** recordings for pace review: Years 1–7 respectively **69, 54, 12, 13, 8, 11, 5**. Historical generation-speed metadata is absent for all 874. This batch does not regenerate, slow or approve recordings. Technical decoding is not listening evidence or a pronunciation/suitability assessment.

School/group/pupil overview pagination, broader tutor operations, mobile admin navigation and shared-device handoff remain separate frontend follow-ups. Curriculum expansion and independent listening, safeguarding and real-child pilot gates remain open. Generated/private reports, credentials and local test evidence are excluded from the source commit.
