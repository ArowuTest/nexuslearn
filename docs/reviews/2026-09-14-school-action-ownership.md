# School setup action ownership

## Delivered contract

School setup reads and writes now use the shared account-workspace lifetime.
Sign-out, account replacement, expiry and navigation abort their local requests;
late completions cannot clear a replacement account's group or pupil drafts,
replace its status message, or unlock a newer pending operation. Cancelling the
client request does not mean an already submitted server write was rolled back.

The setup fieldset keeps submitted class, pupil, enrolment and teaching-group
values immutable while pending. Sign-out remains available. Authentication has
its own handoff: verified school sign-in may replace a cached school or parent
account without cancelling itself, while external replacement still cancels a
stale login. Failed post-login directory loading clears private data, retains a
useful error and allows another sign-in.

This reuses the existing authentication/workspace helpers; it does not introduce
new session storage, change API authorization or idempotency, broaden school
scope, or change the bounded directory protocol. Existing pupil-specific
request guards remain in place.

## Performance

Production output contained the same workspace helper in family, admin and
school route chunks. An exact-source browser cache group now shares that module.
Server/development splitting, framework groups, visual baselines and all budget
limits are unchanged. Final measured aggregate JavaScript is **1,427,523 /
1,430,000 bytes**, largest route **700,786 / 750,000**, largest chunk **222,190 /
250,000**, total CSS **72,285 / 120,000**, and largest public asset **275,314 /
600,000**. The emitted static-reference and public-content privacy checks pass.

## Evidence and review

Test-first browser reproductions demonstrated the old group completion erasing a
new account's draft and editable fields during pupil creation. A further failing
test caught cached school login cancelling itself in the intermediate candidate.
The new workspace cache-group assertion also failed before the group was added.

- Focused desktop/mobile authentication and ownership browser tests: **60/60**,
  one worker, zero retries.
- Authentication, school-directory and exact-source chunk units: **36/36**.
- Production build, TypeScript, full web lint and unchanged performance gate pass.
- The full Windows production browser run returned **526 passed / 4 failed /
  12 opt-in skips**. Two pre-existing logout tests (both viewport projects)
  waited for responses that the new lifetime correctly aborts. They now require
  `net::ERR_ABORTED`, wait for the held fixture to settle, and retain every
  private-data clearing/no-follow-up-read assertion. No production code changed.
- Both affected suites then returned **45 passed / 1 timeout**. The unrelated
  desktop evidence-pagination case completed its navigation assertions but ran
  out of its existing 30-second budget during accessibility processing; the
  trace includes an 8.1-second evaluation. No definite machine-level cause is
  claimed. The unchanged case subsequently passed **4/4** in two desktop/mobile
  repetitions (3.9-7.1 seconds). No timeout, retry or accessibility check changed.
- All **530 distinct non-visual fixture cases** therefore have passing evidence
  across these runs, not a single clean full local run. Linux visual baselines
  remain unchanged and the complete GitHub run remains a release requirement.
- Real API/PostgreSQL verification passed **6/6 canonical-grading cases and
  6/6 role journeys**, desktop/mobile, one worker, zero retries. This includes
  family signup, school class/pupil/group/card and support-profile operations,
  admin navigation, actual grading, and lost-acknowledgement idempotency. The
  harness used disposable schemas on the existing loopback PostgreSQL fixture;
  its own schemas were removed. Evidence:
  `apps/api/.agent/school-action-real-backend-20260914.log`.
- One independent read-only reviewer found no concrete actionable issues in the
  scoped diff and independently ran the five chunk-boundary checks. The reviewer
  did not independently run the production build or browser suite; those results
  are lead-executed evidence. The reviewer was closed after returning findings;
  the later cancellation-test corrections were lead-reviewed.

Local evidence is under `apps/web/.agent/school-action-*-20260914*`; these logs,
traces, private/generated reports, development credentials and build artefacts
are deliberately excluded from the source commit.

## Release boundary

At commit time, GitHub CI and exact hosted frontend/backend revision checks are
still required. Their subsequent outcomes belong in the FS V2B checkpoint.
No curriculum content, human review/listening decisions, paid audio recordings,
provider configuration or hosting migration was part of this batch.
