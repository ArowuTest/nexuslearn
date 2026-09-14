# School setup action ownership

Continue authorised school workflow/authentication hardening. Directory release
c81c50d passed GitHub Content, Platform and Deployment smoke; both hosted
identities were independently reverified on 14 September.

Each setup save belongs to the school account/workspace that submitted it.
Sign-out, expiry, replacement or navigation must cancel local continuations
and prevent old handlers changing a new owner's drafts, messages or busy state.
Cancellation does not imply a submitted server write was rolled back. Submitted
setup fields remain fixed while pending. First sign-in must not self-cancel.

Reuse the shared account-workspace helper. Preserve server authorisation,
idempotency, directory paging and pupil request fences. No provider/credential,
curriculum approval or hosting changes; preserve unrelated dirty reports.

1. Reproduce stale setup completion and editable pending fields in the browser.
2. Bind reads/writes and UI completion to owner; remove duplicate lifecycle code.
3. Lock submitted setup fields; retain sign-in, expiry and error recovery.
4. Test desktop/mobile, existing directory/card/teacher flows and real roles.
5. Review a substantive diff, verify build/lint/type/budgets; one main batch.

GitHub and exact hosted identities remain release gates after pushing.

## Executed checkpoint

Implementation, focused browser regressions, build/type/lint/budget checks,
independent scoped review and real API/PostgreSQL role/grading journeys are
complete. The full local run exposed two old tests awaiting now-cancelled
responses; both were strengthened to require cancellation. An unrelated local
accessibility timeout and its unchanged passing repetitions are documented in
`docs/reviews/2026-09-14-school-action-ownership.md` rather than hidden as a clean
full local run. Commit/push and complete GitHub/hosted revision verification are
the remaining release steps; record their outcome in FS V2B.
