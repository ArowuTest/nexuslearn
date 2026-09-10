# School access workflows and bounded reads — 2026-09-09

## Scope

Continuation after the verified `73a6af1` first-use release. Keep Vercel/Render during the frontend MVP; no infrastructure migration or new narration generation. This batch improves school administration, credential privacy and maintainability. It does not declare every school/admin operation, curriculum variant, SEND setting or human review complete.

## Backend contract and scaling

- `GET /v1/school/config?include_credentials=false` reads the school overview without loading credentials. Missing/true preserves the legacy response for rollout. Invalid or malformed query strings return 400 before any overview or credential read; a malformed flag must not silently select the credential-inclusive default.
- `GET /v1/school/classes/{classID}/credentials?limit=12&cursor=...` is read-only and supports verified school administrators and teachers. Default page size is 12, maximum 50. The response contains `class_id`, `student_credentials`, `limit`, `has_more` and `next_cursor`.
- The opaque versioned cursor binds school URN, class UUID and immutable last student UUID. It is a position, not an authorisation grant or frozen roster snapshot. Every request checks the current class scope. Ordering is independent of names and year-group edits. A bounded SQL membership page (`limit + 1`) precedes credential hydration; the client does not download the school and slice it locally.
- Include class members whose credentials have not been generated. JSON null picture arrays from older login-code-only records are normalized to empty arrays without generating or rotating credentials. Empty pages encode arrays, not null.
- School lookup no longer scans the first 500 schools. PostgreSQL class/group/student scope checks use direct `EXISTS` queries, not whole-portal/credential hydration.
- The two school overview/card read handlers revalidate the current active user, school membership/role and school state. Missing optional repository capabilities fail closed. Foreign or missing classes, unauthorised roles, revoked membership and inactive schools do not return cards. All response paths are private and non-cacheable.
- Existing locked atomic parent/pupil ownership writes are preserved. No schema change or new index is required for this batch. Existing broader roster/overview limits remain; this is not full pagination of every school entity.

## User journey

The authenticated school workspace is ordered into Classes & pupils, Pupil Login Packs, Learning & evidence, and Support & interventions. The selected learner control is above the learning tools, rather than inside the later support editor. Existing handlers, permissions, request fences and forms remain wired.

Login packs require a class choice. Each server page replaces the previous page, clears selections and hides credentials. One card may be disclosed at a time. Printing requires explicit page-bounded pupil selection; ordinary browser printing does not expose an entire school or support notes. Cards are tied to the session that loaded them, and cached cards/print sheets clear on account changes or expiry. Disclosure and printing also recheck that identity when storage changes without a notification. Signing out remains available during pending requests.

Keyboard pagination returns focus to its loaded result or error, with a reachable Retry action. Small card text uses the existing accessible dark text colour. The QR uses the pinned library's row/column ordering and an explicit four-module light border, verified by rasterising the actual rendered SVG and comparing every module to the encoder's expected matrix. This is exact browser-rendering evidence, not a claim about every physical printer or camera.

## Performance and shared game styles

The initial card implementation exceeded the existing aggregate JavaScript budget. Importing the pinned symbol-only QR entry removes unused image/canvas encoder code. Three exact repeated learning-studio style strings are shared in the existing stylesheet across the English, mathematics, science and cross-curricular renderers; interaction, assessment, content and gamification logic are unchanged. Browser-computed style parity covers standard, high-contrast, large-target, reduced-motion, reduced-reading and combined modes, including disabled buttons.

No budget, screenshot baseline or visual tolerance has been relaxed. Final local production build: aggregate JavaScript **1,427,932 / 1,430,000**, maximum route **695,573 / 750,000**, maximum individual JavaScript **222,190 / 250,000**, CSS **71,566 / 120,000**, largest public asset **275,314 / 600,000**. Headroom remains small.

## Validation record

- Reproduced feature-red tests before implementation. A first integrated run used an invalid exact label locator; the actual DOM proved the combobox existed, so the test now uses its accessible role/name. That locator failure is not recorded as a product failure.
- Reproduced actual privacy, contrast, legacy-null compatibility, keyboard focus, idle expiry and malformed-query failures before their fixes. All 26 associated desktop/mobile card checks passed before the final QR/shared-style changes.
- Reproduced rendered QR border failure (33 modules instead of 41) on both viewports and the absent shared-style parity failure before remediation.
- Final source types, lint, four QR-generator boundary tests, production build and unchanged performance gate passed.
- Main independently reran the complete final API/PostgreSQL suite (learning 191.349s, server 67.673s), then vet and build; all passed. Focused school API suite also passed after the malformed-query and null-picture repairs. `CGO_ENABLED=0`: no race-detector claim.
- Broad local browser suite: **388 passed, 12 intentional real-backend-only skips**, 10.0 minutes, zero retries. Only the two named Linux-baseline suites (four viewport cases) were excluded locally; their committed baselines and tolerances remain unchanged for CI.
- A final 320-pixel screenshot exposed the brand wrapping onto two lines. The new one-line assertion failed before moving the brand above the name/QR row. Final types, lint, production build and performance gate passed again, followed by **30 focused browser tests in 33.5s**, zero retries. Before/after captures were inspected together; this final paragraph-layout change was made after the broad run.
- Real-account browser QA against isolated local PostgreSQL: **6 role journeys passed in 36.6s** (Go harness 39.643s), covering family signup/child creation/pupil access, school setup/cards/SEND profile/progress and protected admin navigation on both viewports. **6 canonical-grading journeys passed in 25.2s** (Go harness 27.802s), including repeated acknowledgements without duplicate mastery. No hosted user accounts or production data were changed.
- The first real-role attempt after the workstation restart failed before schema creation because the owned local database was stopped. Restarting that existing loopback test cluster enabled the successful runs above; no application patch or test tolerance change was needed for this environment failure.
- Synthetic screenshots and logs are retained privately under `apps/web/.agent/school-access-2026-09-09/` and adjacent dated logs. The school entry, card disclosure and 320-pixel layout were visually inspected; screenshots supplement, not replace, the interaction and access-control tests.
- The released commit is `b3fe406b2fdec6567c54c16e594bf69d39b95101`. GitHub Platform quality `34370635200`, Content quality `34370635300` and Deployment smoke `34371473031` all completed successfully, rechecked through GitHub on 9 September. The smoke gate verifies the matching served Vercel and Render revision and public/private boundaries.

## Remaining boundaries

At this release, some teaching operations still required raw objective IDs. The subsequent [school curriculum workflow batch](2026-09-10-school-curriculum-workflows.md) replaces those fields for learning priorities, teacher evidence and intervention creation. School/group/learner overview pagination, mobile admin navigation, broader teacher/tutor workflows and shared-device adult-to-pupil handoff remain separate follow-ups. This card-session observer does not claim to retrofit every other cached private workspace.

Audio and curriculum approval counts are not changed here. Technical playback/decoding checks do not constitute human listening, safeguarding, professional SEND or pilot approval. Existing explicit gates remain in force.
