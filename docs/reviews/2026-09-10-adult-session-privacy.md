# Adult session and privacy lifecycle - bounded local batch

## Ownership and integration boundary

This batch builds on the uncommitted adult-authentication work at local
`main` / `e469611d9eb3bd96bd7cb35453071de6c9606e51`. The existing
`useAccountAuthentication` implementation and authentication browser suite
were not edited. Parent-owned audio/content/backend/workflow changes and
generated/private-content dirt were not modified. No build, browser server,
provider call, credential read, commit, push, dependency installation or budget
change was performed.

Files changed by this batch:

- `apps/web/src/lib/api.ts`
- `apps/web/src/app/admin/page.tsx`
- `apps/web/src/app/family/page.tsx`
- `apps/web/src/app/school-admin/page.tsx`
- `apps/web/src/components/role-workspaces/useAccountWorkspace.ts` (new)
- `apps/web/tools/adult-auth.test.mjs` (extends existing uncommitted tests)
- `apps/web/tests/e2e/adult-session-privacy.spec.ts` (new)
- This review.

## Root causes and fixes

1. Admin sign-out waited for remote revocation before clearing private UI.
   Admin now clears the complete workspace synchronously; school also finishes
   its local sign-out without awaiting remote revocation. Family keeps its
   immediate local sign-out behavior. Revocation captures only the old token,
   clears local storage first, and has a 15-second abort/deadline. Its late
   completion cannot clear a replacement account or overwrite route messages.
2. Family portal/evidence requests used unbounded fetch and body parsing.
   These reads now accept caller cancellation, race a 15-second deadline
   through body parsing, and fence late results by parent owner. A current
   401/403 clears the local session. Old-owner failures cannot clear a new one.
   This helper is deliberately limited to logout and the two family reads;
   it does not refactor every API request or change authentication transport.
3. Admin/family private data and drafts survived idle replacement/expiry.
   The shared workspace hook observes the existing session notification and
   expiry mechanism, invalidates request owners, and aborts owned reads.
   Central route resets clear account data, child/SEND drafts, invitation
   details, ledgers, reports, credentials and editor drafts. Existing admin
   directory/request counters are retained and invalidated. Initial verified
   sign-in remains owned by the existing authentication hook.
4. Family startup awaited every child's evidence. Supplementary evidence now
   loads in the background with deadlines and owner/load-version fencing;
   the usable portal unlocks independently. Per-child versions prevent an
   older background result replacing a newer explicit evidence refresh.
5. Admin reads, report downloads, report aggregation and asynchronous save
   completion paths reject/suppress stale-owner results. An additional unit
   regression reproduced a continuation starting after unmount; the hook now
   rejects it before invoking the action.

## Executed evidence

Working directory: `apps/web`. On this machine, invoke Node via
`C:/Users/sanus/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe`.

- Red: `node --test tools/adult-auth.test.mjs` -> **9 passed / 10 failed**.
  Failures were genuine: unbounded revoke, both reads' stalled bodies,
  cancellation, already-aborted calls, stale-owner results, and admin UI
  clearing after (rather than before) revoke. The 8 prior auth checks passed.
- Intermediate green: the same command -> **19/19 passed**.
- Additional red: the same command after adding lifecycle checks ->
  **22 passed / 1 failed**, specifically starting an action after unmount.
- Final unit run: the same command -> **23/23 passed**.
- Type check passed (exit 0): `node node_modules/typescript/bin/tsc --noEmit --incremental false`.
- Focused lint passed with zero warnings (exit 0): `node node_modules/eslint/bin/eslint.js src/lib/api.ts src/app/admin/page.tsx src/app/family/page.tsx src/app/school-admin/page.tsx src/components/role-workspaces/useAccountWorkspace.ts tools/adult-auth.test.mjs tests/e2e/adult-session-privacy.spec.ts --max-warnings 0`.
- `git diff --check` on the four tracked owned source files passed.

The transport tests use the real transpiled API with controlled network/timers.
Hook lifecycle tests execute the actual hook with controlled effect lifetimes;
the sign-out ordering check executes the real route handler with controlled UI
setters. These are not substitutes for rendered React/browser evidence.

## Parent integration evidence (10 September 2026)

The new browser file contains **7 scenarios / 14 desktop-mobile cases**:
admin/family idle replacement and expiry, stalled sign-out in both routes,
and supplementary family evidence unlocking plus cancellation on replacement.
The combined production-browser run completed 236 cases: 226 passed and ten
failed. The failures exposed obsolete test assumptions, not retained private
state: six expected a cleared family form to remain mounted, two waited for
a response after the request was correctly aborted, and two reused a school
identity after sign-out correctly cleared it. Assertions now verify the absent
form, blank drafts after same-component re-entry, actual request cancellation,
and explicit re-entry of the school identity. No application behaviour was
weakened. All three corrected suites passed **48/48**, desktop/mobile, one
worker and zero retries. Together these runs cover all 236 cases; this is not
a claim of one green 236-case run. See the batch handover for real-API results.

The production build, TypeScript, focused lint and **41/41** frontend unit and
boundary tests passed. Measured JavaScript initially exceeded the unchanged
1,430,000-byte aggregate budget. Production-browser cache groups now share
duplicated mock-objective guidance and attempt-evidence widgets separately;
they do not alter framework/server/development bundling. Boundary regressions
and the rebuilt performance gate passed: aggregate **1,428,706**, largest
route **700,689 / 750,000**, largest public asset **275,314 / 600,000** bytes.
Budgets, browser retries, assertion deadlines and baselines were not loosened.
Backend
revocation remains best effort if the server is unreachable; local privacy
clearing does not claim that an offline token was remotely revoked. This batch
does not impose deadlines on unrelated admin writes or change backend semantics.
