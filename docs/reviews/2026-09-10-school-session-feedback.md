# School session feedback and CI correction

## Confirmed failure

GitHub Platform quality run 34437905622 on main `0cf246e` passed the API job,
but the web fixture suite reported 434 passed, four failed and 12 skipped.
All four failures were the desktop/mobile session-change and idle-expiry
cases in `school-access-cards.spec.ts`. The private-card removal assertions
passed; the subsequent expectation for an alert inside the card panel failed.
Real-backend browser jobs after that step did not run in this failed workflow.

The earlier pupil-scoped workspace change deliberately unmounts the entire
school workspace when its session changes. That removes the old card-local
alert as well. The surviving page-level status incorrectly continued to say
"School workspace loaded." The correction must preserve the whole-workspace
privacy reset and give the user a clear sign-in-again instruction.

## Correction and regression contract

- On an established school session changing or expiring, reset the private
  workspace and update the existing live status with a sign-in-again message.
- Initial sign-in is not misreported as an expired workspace.
- Both viewport tests require the card panel, print articles and private
  navigation to be absent, the sign-in form to be visible, and the new status
  to be present. This replaces only the obsolete card-local alert expectation.
- The no-storage-notification disclosure guard remains separately covered;
  it still uses its local alert while its panel is mounted.
- No assertion timeout, retry policy, screenshot baseline or performance
  budget is relaxed.

## Evidence

The strengthened four tests were run against the old production build and all
four failed on the expected stale status, after passing the privacy checks.
Local red evidence is in `apps/web/.agent/session-feedback-20260910/red` and
the adjacent `session-feedback-red-20260910.log`.

The deployed frontend and backend were independently verified at the exact
`0cf246ec13966bc3afdccf12e0869718856c7392` revision with the deployment smoke
script. Hosted availability does not turn the failed GitHub gate into a pass.

Full content/prebuild, production compilation/TypeScript and focused ESLint
passed. The five budget regressions passed; aggregate JavaScript is
1,429,203 / 1,430,000 bytes, maximum route 695,758 / 750,000, maximum chunk
222,190 / 250,000, CSS 72,202 / 120,000 and public asset 275,314 / 600,000.

The first 66-test affected-school/identity run passed 64 tests, including all
school-card and pupil-record cases. Two desktop identity cases stopped at
the initial `page.goto` before sign-in. Their traces show the document at 200
but the initial CSS/JavaScript requests unfinished at the unchanged 30-second
test deadline; the visible snapshot contains the signed-out form. The same
two startup failures recurred in an unchanged repeat. Both sets of failure
artifacts are retained. This is not a fully green local browser run, and no
timeout, test exclusion or retry was used to conceal it. The Linux GitHub
suite is required to confirm the full release, including those identity cases.

Remote validation of the correction is pending its commit and push.

## Separate next batch

The untracked adult-authentication tests are not part of this correction.
Six genuine browser failures were reproduced: school, parent and platform
sign-ins lack a bounded request deadline and accept a successful response
with a mismatched account role. Shared transport tests additionally specify
unpublished validated sessions, expiry validation, body deadlines and caller
cancellation. These are TDD evidence, not claims of implemented fixes.

This batch does not change curriculum, narration, pupil progression or human
review approvals.
