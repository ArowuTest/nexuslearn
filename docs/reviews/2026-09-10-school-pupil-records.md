# Pupil-scoped school records and reassessment reliability

## Scope and release boundary

This batch follows main `e539dfacfaad4327ca84fe5a7f91500403f06759`, whose content,
platform and deployment-smoke workflows passed. That preceding release was
verified on both Vercel and Render. This document does not claim that the new
uncommitted batch has been deployed; final acceptance is recorded below.

The school page previously described a single selected pupil while eagerly
loading school-wide assignments, teacher evidence, interventions and reviews.
An intervention-review draft could survive changing the pupil. Unlike the other
teacher task forms, reassessment also issued a new idempotency key on every
retry and reloaded the entire workspace after a confirmed save.

## Changes

- Fetch the four saved-record lists only after pupil selection, using the
  existing backend `studentId` filter. Each list has its own request version,
  loading/error state and retry; a failure does not clear unrelated drafts.
- Cancel obsolete reads and fence responses by pupil-selection epoch, request
  version and account identity. Reject a response containing another pupil's
  records. Remove all private workspace state on session replacement or expiry.
- Key reassessment drafts by pupil and explicit intervention selection. Changing
  the intervention clears its notes. Require the chosen intervention to belong
  to the selected pupil and lock pupil switching during a pending save.
- Share the mutation lifecycle between learning priorities, teacher evidence,
  intervention plans and reassessment. An unchanged uncertain save reuses its
  request key. A confirmed save resets only its form; a failed follow-up read
  retains confirmation and exposes a GET-only retry.
- Display the bounded saved-record response in accessible 12-record pages,
  rather than silently discarding evidence and reviews after the first 12.
  Pagination supports keyboard activation and moves focus to the updated count.
  This is presentation pagination, not a new server-side historical cursor.
- Revalidate live PostgreSQL school membership on each of the four GET endpoints. Mark
  success and error responses `private, no-store`. Reject duplicate, blank or
  malformed pupil filters instead of treating them as school-wide requests.
  An omitted filter remains supported for authenticated school-wide consumers.

Backend school identity comes from the authenticated session, not a supplied
school parameter. PostgreSQL filters by school and pupil before applying the
existing cap: 200 teacher-evidence records, 500 assignments, 500 plans and 500
reassessments. The UI explicitly discloses a reached cap. Complete historical
cursor pagination and large school/class/pupil directories remain follow-ups.

## Validation history

- Initial browser red run reproduced four expected workflow defects. A fifth
  scenario stopped at sign-in before reaching its assertion; that is not counted
  as evidence of the pupil-record defect.
- First production run: 64/76 passed. Added session-replacement and missing
  pagination tests failed on both viewports as expected. Other failures exposed
  fixture assumptions about eager pupil loading or text-based exact labels;
  those were corrected to explicit selection and semantic role locators.
- Second production run: all 18 new pupil-record checks passed, including the
  320-pixel keyboard and serious/critical accessibility checks. The broader run
  was 61/76, with navigation/sign-in failures while the separate real-backend
  browser harness was also running. That harness was 5/6; both school scenarios,
  including a dropped reassessment acknowledgement and identical durable replay
  ID, passed. The family mobile navigation check failed. These mixed runs are
  retained, not described as clean acceptance or proof of resource contention.
- The agent's backend red tests reproduced invalid-filter broadening, revoked
  membership reads and missing private-cache headers. The fixed focused groups
  passed with PostgreSQL. Full server and learning suites passed in 91.124s and
  192.898s respectively, followed by vet and formatting checks. CGO was disabled;
  this is not race-detector evidence.
- Backend validation uses the disposable local
  `school_records_20260910_backend` database on port 15432. An older test database
  had pgcrypto in a historical temporary schema; it was not changed or cleaned.
- Full content/prebuild and public-content checks passed. Production builds,
  focused lint and TypeScript passed before the final shared-hook refactor.
  The first complete UI bundle exceeded the unchanged 1,430,000-byte aggregate
  JavaScript budget by 17 bytes. Shared mutation logic replaces duplication;
  no budget, screenshot baseline, timeout or CI parallelism was loosened.

## Final acceptance

- Final shared-hook production build, lint and TypeScript passed. Aggregate
  JavaScript is **1,429,106 / 1,430,000 bytes**, largest route **695,758 / 750,000**,
  largest chunk **222,190 / 250,000**, CSS **72,202 / 120,000**, and largest public
  asset **275,314 / 600,000**. All five budget regressions and 17 client/public
  boundary tests passed.
- Fresh final school/identity run: **76/76 passed in 3.0 minutes**, desktop and
  mobile, zero retries. Includes uncertain saves, stalled requests, confirmed
  writes followed by failed/denied reads, pupil and intervention switching,
  session invalidation, mismatched response rejection and bounded pagination.
  The 320-pixel learning/support scan found no serious or critical violations;
  the fresh record-pagination screenshot was visually inspected.
- Final static adversarial review of the shared save hook, both consumers,
  page request fences and pagination found no actionable source issues.
  The reviewer identified a real test-synchronization gap: two negative checks
  could run before obsolete requests completed. The strengthened tests now
  observe every cancelled pupil read, drain the late POST response, allow the
  client commit, check all four lists and rule out a post-logout refresh.
- First repeated strengthened run was 11/12: the remaining case stopped at
  sign-in before its assertion. Its trace contained no completed login response
  before the UI timeout. The fixture now explicitly awaits login/config network
  responses and rendering, within the unchanged overall test timeout. Final
  complete pupil-record suite repeated twice per viewport: **36/36 passed in
  1.8 minutes**, zero retries. Focused lint/types passed after the test changes.
- Final non-overlapping real-PostgreSQL role run: **6/6 passed in 2.7 minutes**,
  including identical durable IDs after deliberately losing the first evidence
  and reassessment acknowledgements, plus family/pupil and admin workflows.
  Subsequent API vet and build passed. No browser harness is left running.
- GitHub/hosted exact-revision verification follows the commit. Generated
  reports and local test evidence are not included in the source commit.

No curriculum variant, teaching entitlement, automatic progression policy,
gamification reward policy or audio recording is changed in this batch.
Technical tests and AI code review do not constitute human listening, independent
SEND/teacher approval, safeguarding sign-off or a child pilot.
