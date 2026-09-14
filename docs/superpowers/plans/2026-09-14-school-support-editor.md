# Safe school support-profile editing

Follow-on local batch after the school action ownership release `46d2149`.
Two browser regressions reproduce saving default settings before reading the
pupil's existing profile, and editable notes/pacing/audio during a pending save.

Keep the current explicit Load profile workflow, pupil choice and access/pacing
semantics. Require a verified, same-pupil backend profile before editing/saving;
reject incomplete or unsupported responses instead of substituting defaults.
Keep all fields immutable while loading/saving, retain failed-save drafts and
allow retry. Clear verification and cancel the request when the pupil changes.
Do not change curriculum entitlement, diagnose SEND, fabricate human approval,
alter provider settings, or claim cross-adult optimistic concurrency is solved.

1. Record browser RED and pure response-boundary RED.
2. Extract shared support field definitions/validation; wire verified edit state.
3. Cover successful/rejected/failed loads, pending saves, pupil/account changes.
4. Build/type/lint/budget and real-school browser verification; review the batch.
5. Keep this work local until a substantial tested batch is ready for main.

## Approved responsive-admin integration

The user subsequently approved replacing the expanded mobile/tablet admin
sidebar with a labelled Sections disclosure. This is the existing website's
responsive layout, not a native app. Keep the desktop sidebar and all role
permissions unchanged; close after selection and focus the selected workspace.
Cover keyboard dismissal, narrow-screen accessibility, both resize directions,
account invalidation, and role-filtered navigation before release.

The combined build's measured JavaScript overrun required sharing existing
family/school support definitions and duplicated picture-login rendering.
Preserve explicit family defaults, labels/order, strict saved-profile validation
and production-browser-only chunk boundaries; do not raise asset budgets.

Final integration evidence is recorded in
`docs/reviews/2026-09-14-school-support-editor.md`. Local checks do not replace
Linux visual, actual-backend or exact hosted-revision verification.
