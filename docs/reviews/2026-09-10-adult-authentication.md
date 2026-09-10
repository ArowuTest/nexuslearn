# Adult authentication lifecycle hardening

## Scope

School/teacher, parent, platform administrator, content editor and content
reviewer sign-in. Parent registration and invitation acceptance use the same
session-validation and mounted-caller boundary. No backend role entitlement,
curriculum approval, narration asset or human review status is changed.

## Confirmed defects and implementation

- Login requests could remain pending indefinitely. A shared transport now
  enforces a 15-second deadline through response-body reading and distinguishes
  timeout from caller cancellation. Requests do not carry an old bearer token.
- A successful HTTP response could store a pupil role in an adult workspace,
  or accept a malformed/expired session. Validate non-empty token, the route's
  permitted roles and a parseable future expiry before returning the session.
- A late login could overwrite a replacement account. A mounted-owner hook
  owns the sole session commit, cancels on owner change/unmount, checks identity
  again immediately before commit and prevents parallel credential requests.
  Transport and parent helpers no longer store sessions implicitly.
- Credentials were editable during submission. The submitted fields are now
  disabled until completion. They are also disabled in server-rendered HTML
  until React can handle input, so early typing cannot be lost during hydration.
- Independent review found a storage exception could leave the hook busy.
  Session setup is now within cleanup-protected code. A separate reproduced
  subscription failure leaked five listeners; partial setup now cleans up.
- The parent cancellation fixture formerly used invalid parent metadata.
  It now supplies a valid envelope and requires an actual aborted request,
  not merely an unchanged token. Navigation cancellation has explicit coverage.

## Performance and maintainability

The first auth build passed compilation/types but exceeded the unchanged
1,430,000-byte aggregate JavaScript ceiling by 1,816 bytes. The build contained
three copies of the new hook, one in each adult route. An exact-source,
production-browser-only shared chunk replaces duplication, with regression
tests for Windows/POSIX paths and exclusion of server layers/unrelated files.
The identical admin sign-in/sign-out directory reset is extracted once; its
request-version invalidation and cursor resets are preserved.

A second measured build was still 602 bytes over budget. Inspection found the
workspace navigation/status module emitted in both a shared chunk and the family
route. Its exact production-browser module is now shared as well. Final measured
JavaScript is **1,428,886 / 1,430,000 bytes**; maximum route **696,686 / 750,000**,
maximum chunk **222,190 / 250,000**, CSS **72,229 / 120,000**, and largest public
asset **275,314 / 600,000**. All five performance-gate regressions passed.

## Evidence and outstanding validation

- Original desktop red suite: six real failures, one deadline and wrong-role
  case for each of the three workspaces.
- Additional lifecycle red run: eight intended failures (invalid expiry,
  stale session overwrite, mutable credentials) and one admin fixture setup
  failure before its invalid-expiry assertion. Do not count the latter as proof.
- Review red run: storage retry stayed locked and all three server HTML forms
  accepted input before hydration. A focused subscription test also reproduced
  five leaked listeners after failed initialization.
- Eight transport/subscription regressions plus shared-chunk, pupil-session,
  deployment-version and QR boundary checks: 25/25 passed after the repairs.
- Final production build/TypeScript, focused ESLint and the private/public
  content-boundary test passed.
- Final adult-role fixture suite: **96/96 passed in 3.3 minutes**, desktop and
  mobile with zero retries, covering admin menus/role-scoped data access as well
  as every new authentication regression. Unmount tests explicitly require an
  aborted request during client-side navigation; replacement tests require a
  valid late response and aborted transport.
- Real API/PostgreSQL role journeys: **6/6 passed in 1.5 minutes**; the Go harness
  passed in 105.734s. This includes parent registration/first-child creation,
  school enrolment/teaching groups/login cards and durable evidence/reassessment
  retry IDs, plus protected platform administration, on both viewports. The
  harness owns and removes its disposable schema. CGO was disabled; this is not
  race-detector evidence.
- Final school-card/pupil-record/identity suite: **66/66 passed in 3.5 minutes**,
  desktop/mobile with one local worker and zero retries, including the two
  identity cases that stalled at initial asset loading in the earlier parallel
  runs. Those earlier failures remain recorded in the school-session review;
  this passing run does not retrospectively turn them green. CI worker settings
  and assertion deadlines are unchanged.
- Total final browser evidence: 162 fixture checks plus six real-API journeys.
  Remote release verification remains blocked on push approval. The full
  GitHub fixture/visual matrix has not run against this local batch; targeted
  greens do not replace that release gate.

Evidence is retained under `apps/web/.agent/adult-auth-2026-09-10` and the
adjacent `adult-auth-*-20260910.log` files. No retry/timeout or budget is loosened.

The earlier `e469611` school-session correction is committed locally but its
GitHub push was rejected by the safety reviewer pending fresh user approval,
even after verifying the existing GitHub remote and exact three-file payload.
The authentication batch is locally verified and remains uncommitted, keeping
the outgoing branch limited to the exact three-file commit for which approval
was requested. After permission is received: push that correction, verify its
GitHub and hosted identities, then commit/release this larger auth batch with
its own full CI checks. Do not silently broaden approval for the first payload.

### Subsequent batch authorization and integration

The user explicitly approved pushing the school-session correction and the
combined authentication/privacy/audio-tooling batch to `ArowuTest/nexuslearn`
main. This supersedes the earlier blocked-push status above; it is not an
authorization to publish credentials, generated private reports or approvals.
The expanded batch's current evidence and release status are recorded in
`2026-09-10-fast-track-release-batch.md` and the FS V2B checkpoint.

At the earlier handover, no reviewer or browser harness remained running. Exact tested-source blob hashes
are saved in the FS V2B checkpoint for safe continuation without guessing which
uncommitted source was validated. Existing generated reports, next-env changes,
local evidence and credential files are excluded from the source batch.
