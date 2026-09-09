# Four-role first-use audit and remediation — 2026-09-09

## Scope and evidence boundary

Continuation of the frontend MVP on Vercel/Render; no Railway migration. The Product Design audit workflow used fresh browser captures and real disposable local accounts, not old screenshots as current evidence. The in-app browser failed the Windows sandbox helper, so the user-authorized Playwright fallback was used. Named parent, school administrator, pupil and platform administrator sessions remained separate; the fixtures run the real Go HTTP API against an isolated PostgreSQL schema and remove that schema afterward.

This is a first-use/lifecycle audit, not a claim that every curriculum item, entire admin CRUD surface, all gamification or human SEND/listening/pilot review is complete.

## Findings reproduced before fixes

| Step | Evidence | Finding | Remediation |
| --- | --- | --- | --- |
| 1 Parent signup | local capture 03-parent; real browser regression failed on both viewports | Empty Go children slice encoded null; family render dereferenced it | API emits an empty array; web tolerates the older response during rollout |
| 2 Family sign-out | delayed-revocation browser test | Child data stayed mounted until logout replied; sign-out disabled while evidence pending | Immediate private state/token clearing, request-generation guards, sign-out available during work |
| 3 Invitation | first-use browser test | Accepted invite cleared password but child creation still required it | Child creation depends on verified portal/session, not retained plaintext password |
| 4 Re-entry/retry | first-use browser tests | Page refresh lost the workspace; uncertain create retry allocated a second child ID | Server-verified saved-session re-entry; one ID retained in the draft; ignore stale save completions |
| 5 SEND setup | selection-state browser test | Selected choices were conveyed by color alone | Named groups, aria-pressed state and larger targets |
| 6 Picture access | capture 09-pupil; picture regression | Child had to read eight words, while parent had no visible password sequence | Shared locally hosted Lucide symbols on pupil choices, selected sequence and private family/school cards |
| 7 Desktop family evidence | fresh after-capture and width test | One child occupied only 258px with two empty grid columns | Cards adapt to actual count and available width |
| 8 School access/navigation | capture 06-school; keyboard/320px test | Enter did not submit sign-in; last menu choice clipped offscreen | Semantic form; wrapping navigation, nonsticky on narrow screens |
| 9 Parent ownership | live source trace, dedicated security tests | Parent upsert could mutate an unrelated existing ID before ownership checking and used separate writes | Critical blocker: atomic, ownership-scoped repository operation with replay/concurrency/rollback tests |
| 10 School enrollment | real school journey returned class-outside-school 403 | UI accepted a class ID that the backend ignored; pupil creation and first enrollment were separate | Select returned class IDs by class name/year; require a class when creating a pupil; atomic first enrollment |
| 11 School ownership | real authenticated PostgreSQL reproduction | School upsert/assignment could mutate or attach a family or other-school pupil | Separate atomic school repository capability; only create new or update already exclusively school-owned learners |
| 12 Completion feedback | browser assertions failed after successful loads | Restored family and loaded school progress still said Loading | Only the current verified request may announce the loaded state |
| 13 Card previews | fresh mobile capture and narrow-card regression; real school journey | Long family code clipped outside its badge; school picture cards existed only in print view | Keep family codes in the private disclosure and wrap them; reuse the existing school picture/QR card on screen |
| 14 School support lifecycle | adversarial source review and captured Learner B selection with Learner A's private notes | Late load/save could populate another learner's support editor | Shared load/save operation fenced by a request generation invalidated on selection/reset; save also checks profile identity |
| 15 Pupil card lifecycle | adversarial review and controlled browser failures | Editing a card or changing its URL retained the old child; late login could authenticate after navigation | Card edits, URL changes and unmount invalidate old completions/session; only the latest card can establish identity |

## Captures

Initial numbered captures and DOM snapshots: `apps/web/.agent/role-audit-2026-09-09/` (synthetic local accounts only). Final successful post-fix captures are preserved under `after-final/` (18 desktop/mobile images), separately from earlier `after/` evidence. Repeatable CI captures are produced by `tests/e2e/roles-backend.spec.ts` and retained as `browser-role-evidence` independently of grading/browser fixture evidence.

Earlier real runs passed parent-to-pupil Today and admin navigation on both viewports. Continuing the school walkthrough then exposed the class-ID and ownership gaps above. The final real-role run passed all six journeys using the atomic school backend, selected persisted class IDs, verified progress-response content and newly generated picture credentials. Local progress totals come from isolated starter fixtures, not a claim about hosted curriculum coverage.

## Ownership and API contract

- Parent child PUT uses the immutable parent ID from the verified session, not an email/login ID from the request. An active parent may create a new reference or update an actively linked child, never claim an unrelated existing reference. Identity, link, credentials, support and actor audit commit together. Existing credentials survive retries and updates; new credentials use cryptographic randomness. The credential response is private and non-cacheable.
- School pupil PUT now requires `class_id`, selected from the verified school portal. Actor, current school membership/role, school state and target class are checked under database locks. A new learner and its first class membership commit together. Existing learners must already belong exclusively to that school. Additional class assignments cannot confer first ownership of an unassigned/foreign pupil. Explicit platform-administrator linking remains available for legitimate imports/transfers.
- Unique external-reference constraints arbitrate concurrent claims. Conflict handling does not mutate the winning learner before ownership is checked. Revocation, concurrent claims, replay and injected write failures are covered by database regressions. Failed optional repository capabilities return 503 rather than using the unsafe general upsert.
- This is a coordinated API/UI change: school clients must send the persisted class UUID. Do not loosen ownership checks to support the old unsafely unassigned-create workflow. Verify both deployed commit identities before calling the rollout complete.

## Validation status during implementation

- Red first: initial six first-use regressions, school keyboard, pending-evidence sign-out, saved-session re-entry, stable retry ID, desktop card width; real empty parent signup failed on both viewports.
- Initial targeted types/lint and production builds passed. One two-worker local run had three mobile loading timeouts; the same eight first-use mobile tests passed unchanged with one worker. Broad and authoritative CI checks remain required, not waived by a successful retry.
- First SVG implementation added an unnecessary Next image runtime and exceeded the aggregate JavaScript cap. Static local SVG rendering removes that dependency; no threshold increase is authorized.
- Backend ownership implementation is complete. Main independently ran all Go tests against disposable PostgreSQL (learning 89.391s, server 37.861s), plus vet, build and formatting. Worker separately passed the focused ownership/security suites three times and a full Go run. Go race instrumentation remains unverified; database concurrency regressions are not described as a race-detector run.
- Full initial nonvisual run: 334 passed, 12 intentional real-backend-only skips, 2 obsolete family sign-in assertions failed because the pre-seeded session now correctly restores. Those assertions now verify restored identity; the family evidence and restoration rerun passed. Separate red school-status regression reproduced and was fixed. Final nonvisual suite: 358 passed in 10.7 minutes, zero retries, 12 intentional real-backend-only skips (all 12 passed in the separate real suites); final failed-test list empty.
- Final-source UI build, full lint and unchanged performance gate passed locally: aggregate JavaScript 1,429,538 bytes against 1,430,000; route maximum 694,965; largest public asset 275,314. Headroom is small and must not be enlarged by simply increasing the cap.
- All 62 targeted desktop/mobile lifecycle, first-use, evidence and role-workspace tests passed. Late-response tests wait for completed response bodies and React frames before checking that private state stays cleared. The school textarea locator uses its accessible role/name; the earlier captured state independently showed B selected with A's notes.
- All 28 deployment identity, pupil-session, client-chunk and public-content-boundary checks passed. Final real-backend browser suites passed independently: six role journeys (38.1s browser time) and six canonical grading journeys (28.9s). Linux visual CI and exact deployed revisions remain required before release completion; local Windows verification excludes only the two Linux-baseline visual test names, without changing baselines or tolerances.
- Audio audit: all 874 stored files decoded; no inventory or signal-integrity failures; 22 audit/playback-coverage regressions passed. 172 pace-review flags and 874 unknown original generation-speed records remain. This is technical evidence, not a human listening approval.

## Still to review and refine

School/tutor task organisation remains form-heavy and requires raw objective IDs in some flows. Final captures also show school-wide unpaginated login cards (including other classes) and long empty desktop columns around progress. Next batch should make selection discoverable and organise setup, learning, support and review into clearer task-focused sections with class-scoped card paging and explicit print selection. Mobile admin has a long navigation-before-content sequence. Shared-browser adult-to-pupil handoff policy, deeper school/group assignment, observation/intervention, parent evidence and all-year mission flows require additional fresh walkthroughs. None of those are silently marked complete by this first-use batch.

No audio has been regenerated or newly approved by a human here. Picture-password symbols are static licensed assets, not audio changes. Existing recorded narration and explicit human listening/safeguarding/pilot gates remain in force.
