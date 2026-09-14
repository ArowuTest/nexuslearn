# School SEND editor and responsive admin integration

## Delivered contract

Selecting a pupil no longer makes blank/default support settings writable.
The school must first load that pupil's complete backend profile. Editing and
saving require a verified identity, every required field, supported choices
and correctly typed flags/arrays. Unknown response metadata is discarded, not
forwarded into a later save. The extracted choices are checked against the
actual Go validation contract.

Pacing, audio, reading support, sensory controls, interests and notes are locked
while a save is pending. A failed save or unverifiable acknowledgement preserves
the submitted draft and permits retry; it never announces a verified save.
Failed reloads leave the previous values visible but not editable until a new
load succeeds. Changing pupil clears verification and aborts the old request.
Account expiry/replacement and sign-out retain the shared workspace lifetime.

This changes the editor's safety, not a pupil's curriculum entitlement or the
meaning of evidence. It does not diagnose SEND, approve content/listening,
create recordings or change provider settings. Cancelling a browser request
does not roll back a write that the server may already have committed.
Cross-adult optimistic concurrency remains a separate concern.

## Responsive admin web contract

The user approved a compact mobile/tablet Sections menu for the existing web
application, not a native mobile app. Below 1024 pixels, the labelled disclosure
starts collapsed. Choosing a permitted section closes it and focuses that
section's labelled workspace. Escape returns focus to the toggle without
changing section. The desktop grouped sidebar and its keyboard navigation stay
available; resizing restores focus when a focused control becomes hidden.

The menu uses the existing role-filtered section list. Sign-out/account expiry
still unmount the private workspace. A deferred focus callback cannot focus a
replacement account. Browser fixtures now open the real disclosure rather than
using forced clicks or weakening hidden/private-content assertions.

One pre-existing Access Requests empty-state hint failed the serious WCAG
contrast check at 4.42:1. It now uses the existing accessible text colour.

## Shared code and performance

Family and school support options/default values share one module. The family's
friendly labels, option order and explicit predictable-routine/worked-example
defaults are preserved; the school retains its access-first order. Each new
default profile receives fresh arrays. Saved school responses still require
every field and never receive invented defaults from this shared factory.

Measured duplicate picture-login and support-option code is shared through
exact-module, production-browser-only chunk rules. Next's framework/library
groups, default thresholds and server/development behaviour are unchanged.
The first combined build exceeded the existing aggregate limit by 738 bytes;
the refactor removed that overrun without increasing a budget.

## Final integrated verification

- Production build, TypeScript and full web lint passed.
- All **57** CI-listed web boundary unit checks passed, including six support
  helper checks and exact-source shared-chunk regressions. Five independent
  performance-gate regression tests also passed.
- The unchanged budget passed at **1,429,787 / 1,430,000** aggregate JavaScript
  bytes, largest route **702,463 / 750,000**, largest chunk **222,191 / 250,000**,
  CSS **72,420 / 120,000**, largest public asset **275,314 / 600,000**. Aggregate
  headroom is only **213 bytes**; further source changes require remeasurement.
- Focused responsive-admin browsers passed **12/12**, one worker, zero retries,
  covering 320-pixel reduced-motion/keyboard/axe behaviour, tablet dismissal,
  resize focus in both directions, account invalidation with a held animation
  frame, and the exact content-editor/reviewer menu boundaries.
- The initial nonvisual desktop/mobile run was stopped after **457 passed,
  13 failed and 9 skipped** results. It is not a successful complete matrix.
  After fixture correction, the affected audio/admin/identity/support suites
  passed **84/84**, one worker, zero retries. The exact remaining-case serial
  pass then passed **86/86**, also with zero retries. Reconciliation against
  the Playwright test inventory found **566 unique nonvisual cases with passing
  coverage, zero missing and zero unrecognised cases across the runs**. This is
  composed local coverage, not one green 566-case run. The complete unchanged
  Linux matrix, including four visual cases, remains a required CI gate.
- Final integrated real API/PostgreSQL canonical grading passed **6/6**, followed
  by **6/6** real family-to-pupil, school-management and authenticated-admin
  journeys, each with one worker and zero retries. The school journey verifies
  persisted support-profile GET/PUT. These ran against disposable local schemas
  and the final production browser build; no hosted accounts were seeded.
- Final test-only corrections passed focused lint after the full lint run.
  The actual-backend desktop/mobile admin overview and mobile learner-workspace
  screenshots were visually inspected; narrow controls remained contained and
  the mobile overview exposes the compact menu before its workspace content.
- No visual baselines, tolerances, timeouts, retries or release gates were relaxed.

## Regression and review history

- Two browser RED reproductions demonstrated saving displayed defaults before
  loading the pupil's settings and editable notes/pacing/audio during a pending
  save. A response-boundary unit RED preceded the validator implementation.
- Expanded support-profile and pupil-record browsers passed **34/34**, on
  desktop/mobile with zero retries. The prior support/action smoke passed
  **22/22** before the expanded cases were added.
- Actual API/PostgreSQL role journeys passed **6/6**, one worker, zero retries.
  They include persisted school support-profile GET/PUT alongside family and
  admin first-use flows. This is real-backend evidence, not only intercepted
  fixtures. This follow-on did not independently rerun canonical grading;
  that was still a complete CI gate at that earlier checkpoint.
- One read-only reviewer found no confirmed implementation defect and ran the
  five helper checks independently. The reviewer identified missing held-PUT
  settlement evidence and was closed. Lead-added tests cover success settlement,
  pupil/account replacement, rejected foreign/incomplete acknowledgements and
  same-draft retries. The first combined run passed **40/42**; both failures
  incorrectly expected password-free sign-in after account replacement. Source
  and captured state confirmed intentional password clearing. The tests now
  require re-entering the password; no product code was changed for this.
- Subsequent local combined runs passed **39/42** and **40/42** with navigation
  or browser-cleanup timeouts. Recorded traces showed unusually slow local
  navigation/cleanup. Those runs are retained as failures, not labelled clean
  passes; assertions and timeouts were not changed to hide them.
- The initial responsive-admin run reproduced real resize-focus and contrast
  defects. Tracking deliberate focus before CSS hides a control fixed resize
  recovery; the text-colour change fixed contrast. Two later reviewer-role
  failures were invalid report fixtures, corrected to the established unavailable
  response contract, not product-side bypasses.
- The full run also exposed three older school identity scenarios (both
  browsers) that assumed partial profiles, no request cancellation and saving
  before a fresh read. Fixtures now contain the complete backend contract;
  assertions require an actual aborted request, locked cleared controls, no
  unintended write, and a verified fresh read before saving the selected pupil's
  settings. Other interrupted-run failures included navigation/media timeouts;
  they are retained in local traces and their exact cause is not asserted.
- A bounded read-only admin review and final integration recheck found no
  concrete remaining defects. Follow-up coverage includes reverse resize focus
  and deferred-frame account invalidation. The reviewer was closed; no review
  agent remains running.

Evidence logs include `apps/web/.agent/support-admin-*-20260914.log`,
`apps/web/.agent/admin-mobile-final-20260914.log`, and the earlier
`apps/web/.agent/school-support-*20260914.log` and
`apps/api/.agent/school-support-real-roles-20260914.log`. Local/private evidence,
generated reports, credentials and build artefacts are excluded from the commit.
Final real-backend evidence is in
`apps/api/.agent/support-admin-real-grading-20260914.log` and
`apps/api/.agent/support-admin-real-roles-20260914.log`; the exact nonvisual
inventory reconciliation is `apps/web/.agent/support-admin-coverage-final-20260914.json`.

## Release boundary

The base release `46d21493f345cf1fbabb7e1710b2f466f6266b7d` is verified on both
Render and Vercel after the user's manual API deployment. Platform quality and
Content quality passed. The initial deployment smoke correctly failed while
Render served the older revision; the failed job alone was rerun after the
deployment, and attempt 2 of run `34872036028` passed.

This integrated follow-on is a separate local candidate until committed,
checked by CI and verified on both hosted surfaces. Source changes are not
described as already deployed merely because the base release is live.
