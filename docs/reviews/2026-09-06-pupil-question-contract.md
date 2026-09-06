# Pupil question contract remediation

Base: `7efbd1d`. This batch continues the canonical grading plan; it does not approve curriculum or human/SEND/audio review gates.

## Scope and contract

- Keep the complete `QuestionConfig` for authenticated authoring, canonical grading and immutable snapshots. Project a separate, explicit `PupilQuestionConfig` only at the mission HTTP boundary, after normal/mock selection and access checks.
- Send question identity/version, response kind, task selection count, approved rendering fields and intentionally available hints. Do not send `expected_answer`, pre-answer explanation, accepted spans, correct-state annotations, private author metadata or nested answer/marking fields.
- Admit new rendering fields explicitly. Preserve source texts, graphs, models, produced-audio references and accessible input controls. Incorrect worked examples (`shown_answer`, `shown_steps`) are deliberate task stimuli, not hidden answer keys.
- Remove browser answer-key parsing and comparison dependencies. Numbers use the served response kind; sequences/maps serialize the learner's response. Particle choices describe all three models consistently, without consulting the correct choice. Evidence selectors submit what the learner selected rather than substituting a secret phrase.
- Exact-span controls let learners select the first and last words in a source using keyboard/touch/switch-compatible dropdowns, then inspect/edit the resulting phrase. They trim surrounding quote/end punctuation, not semantic words, and never consult the canonical answer. Single-choice investigation plans use their authored choices; circuit choices preserve authored values rather than a universal completion token.
- Tracing cannot certify mastery from either a completion token or a single letter. Keep it on the review-required path until genuine tracing evidence and an approved marking policy are supported.

## Verification plan

1. Red/green HTTP test: the baseline leaked answer, explanation and body annotations, while the new projection retains audio/stimulus data without mutating canonical records.
2. Red/green browser test: the baseline could not render a decimal question without its answer; the new contract renders and submits on desktop/mobile.
3. Literal contract cases for planner selection shape, nested annotation removal, worked-example preservation and immutable author data.
4. Browser regressions for exact evidence selection, single/multiple selection planners and existing renderers/SEND controls. Update mission fixtures to omit answer keys.
5. Run the real authenticated API/PostgreSQL browser harness with explicit response leak assertions and exact retry/one-award database assertions.
6. Type/lint/build/performance checks, Go tests, independent bounded review, then hosted pinned Linux visual and deployment verification. No blanket rebaselining or increased thresholds.

## Boundaries still requiring work

- Hints are intentionally shipped as learning support, not claimed to be inaccessible to browser inspection. Authored prompt/model/source text can itself reveal clues; technical projection is not pedagogical approval.
- Existing static public content/review artifacts need a separate distribution-boundary audit; this batch concerns the authenticated mission response, not a claim of whole-site assessment secrecy.
- Semantic evidence alternatives and richer rubric/case/unit/tolerance policies are not invented by the UI. Replacing a selected phrase with a secret canonical answer is not an acceptable substitute for authored server-side marking rules.
- The circuit interaction remains a simple open/closed-loop model, not a complete circuit simulation or proof of deep understanding.
- The new API contract deliberately does not retain a query switch that exposes private keys to older clients. Old open browser tabs must reload during deployment. The grading version continues to bind each new submission to its canonical question.

Acceptance results will be recorded in the FS V2B delivery checkpoint after verification.

## Local acceptance

- Go tests with disposable PostgreSQL, vet and build passed after the final backend changes.
- Sequential browser batches passed: 78 cases and 86 cases, with 12 overlapping cases (152 distinct desktop/mobile cases). This includes the routes that timed out during the interrupted resource-constrained run. Pinned Linux visual baselines remain unchanged and require hosted CI verification.
- The separate authenticated real-API/PostgreSQL harness passed both browser projects, asserting that mission JSON omits the answer and explanation, decimal submission is marked by the server, and a lost acknowledgement/retry leaves exactly one attempt and one mastery award.
- TypeScript, ESLint and full production build passed. Existing content validators passed with their existing readiness warnings; this is not a content approval/promotion.
- JavaScript total: 1,404,430 bytes, below the unchanged 1,405,000-byte budget and 315 bytes smaller than the previous local batch. CSS: 63,197 bytes; largest public asset: 472,354 bytes.
- Mobile visual inspection identified a clipped single-line evidence preview; it now uses a wrapping editable text area.
- The single reviewer is closed and the owned local PostgreSQL server is stopped. Existing generated report changes remain unstaged.

## Independent review repairs

One read-only reviewer found nested author metadata bypassing the initial filter, an authored circuit-value mismatch, and a need to select exact evidence inside sentence chunks. New regressions reproduced the missing nested-field boundary and missing interactive controls. Nested records now use explicit admitted field names; phoneme audio maps admit only the sound keys rendered by the audio controls. Circuit questions render authored choices, and evidence tasks offer explicit phrase selection. The reviewer was closed after delivering findings.

Local wide browser testing initially timed out on unchanged admin/family routes during memory pressure (about 1.7 GB free on a 16 GB PC). That run was stopped only within its verified owned process tree. It is not recorded as a pass. Verification was changed to sequential runs; no timeouts, visual tolerances or performance thresholds were increased. Windows antivirus/file locking also blocked deletion of Go's temporary executable after tests passed; `go test -work` retains the diagnostic work directory and preserves the actual test exit status without changing security settings.

`GET /v1/version` advertises `pupil_question_contract: render-v1` to verify that the backend projection, not only the frontend, has deployed.
