# Support-profile concurrency delivery evidence

Base commit: `7409b16fa468eed01216ba71c0b72710875e7562`.
Status: implementation and all local integrated gates passed on 2026-09-17 after host recovery. Ready for the approved batch push to main; exact-source GitHub and hosted verification remain pending at this source checkpoint.
Authority: approved `docs/superpowers/specs/2026-09-14-support-profile-concurrency-design.md` and matching implementation plan.

## Backend changes verified locally

- Migration 0060 gives existing and newly stored support a sequence-backed, non-reused safe-integer version. Authorised missing profiles return version zero. Timestamps remain display metadata.
- School support GET/PUT and parent support PUT use a focused, actor-scoped repository capability. The unconditional public upsert was removed; unsupported repositories fail closed.
- Saves require every editable field, a valid loaded version and a stable retry key. Null/partial/duplicate/trailing JSON and oversized bodies are rejected. Response/error contracts are private and not cacheable.
- Account, school and pupil membership are rechecked under transaction locks. Stale edits return current authorised settings without changing them. Actual save, minimal audit and retry receipt commit together.
- Same-request retries do not duplicate updates/audit. A successful request superseded by a later edit returns an actionable conflict, not its old profile as supposedly current.
- Family child setup only initialises missing support. Replayed setup and identity edits return established support unchanged, including newer standalone saves and generated credentials.
- New ledger/audit payloads contain operation/identity/version metadata, not support notes or declared needs. This does not retroactively purge historical audit data.

## Observed tests

- Initial regression run failed specifically with `setup replaced established support` and `support profiles lack a server-owned version`. The migration/family implementation then passed these and the existing parent transaction suite.
- The scoped-writer regression initially failed because that capability was absent; the school unversioned request initially returned 200 instead of 428.
- The first broader HTTP run also exposed incomplete test portal/session scope and a parent/subtest assertion mismatch. Those test fixtures were corrected; authentication and ownership checks were not relaxed. Do not present that initial run as a clean all-behaviour RED run.
- Focused PostgreSQL save regressions passed. Additional tests cover independent-connection parent/school revocation, simultaneous first creation, stale writes, duplicate requests, changed-key payloads, no-change acknowledgements, superseded replay, status revocation, audit/receipt rollback, setup preservation, parent portal versions, non-reused versions and actual migration backfill/down/up.
- Complete uncached API gate passed with exit 0: `go test -work -p 2 ./... -count=1 -timeout=15m`. Learning package: 236.211s; server: 100.749s; database/narration JSON and command packages also passed. Private log: `apps/api/.agent/support-version-api-full-20260914.log`.
- `-work` retains the Go build workspace. Without it, Windows repeatedly reported a locked temporary `server.test.exe` during cleanup after focused assertions passed, producing exit 1. Those earlier commands are not labelled successful exits.

## School editor and integration review

- Required safe versions, complete same-pupil profiles, save receipts and conflict payloads are validated before they can update the editor. Transport cancellation and account/pupil ownership reject late results. Drafts and retry payloads remain in memory only.
- The labelled comparison covers every differing setting. Discard requires confirmation; review/rebase keeps the draft and requires a separate save. Same-payload uncertain retries keep their key, while edited or newly based attempts use a new logical key.
- The UI implementer observed 11 profile/state failures, two transport failures and one initial-read gate failure before implementing the contract. Focused green evidence followed. The lead also reproduced and fixed a zero-version save-receipt acceptance edge case.
- One independent integrated reviewer identified a reload path that could replace a rebased or uncertain draft. Three new unit regressions reproduced that gap, then passed after fixing both loading and loaded transitions. Ordinary dirty drafts and raw interests are protected even when no conflict panel was previously open. An unchanged-version review retains the exact uncertain retry key. Support-state suite: 21/21 passed; two real browser regressions added.
- Other than that concrete finding, the initial review found no additional blocking issues in the scoped backend/UI delta. It was a static review, not an independent execution of the reported tests.
- Bounded follow-up verified all 67 summary mappings and found no concrete lazy-loading/markup issues. It identified a same-version key-collision recovery loop introduced by retaining uncertain keys. A new regression reproduced the rejected key being reused; conflicts now invalidate rejected attempts while ordinary uncertain retries still retain their key. The updated support suite passed 22/22. Neither review was a human or clinical approval.

## Production build and unchanged budgets

- The first production build compiled but failed the aggregate gate: 1,437,756 bytes against 1,430,000. A temporary private module audit found duplicated lazy-loader runtime; no pupil renderer logic or curriculum was removed.
- Consolidated loading onto React lazy/Suspense. Admin loaders keep explicit server-excluded hydration and the same status fallback; the studio retains per-family lazy loading and its existing null fallback. A server-render regression confirms private admin modules are not imported.
- The intermediate aggregate was still 1,431,909. Replaced 67 repeated admin summary cards with an explicit data list and the same Info markup, and factored four identical style strings into constants. Exact server-rendered markup, ordering, escaping, empty values and zero values pass regression checks. The temporary stats hook was removed; Next configuration and all budgets are unchanged.
- Final production build and TypeScript passed with exit 0, including the rejected-key correction. Measurements: aggregate JS 1,429,051; largest initial route 696,595; largest chunk 222,191; CSS 72,601; largest public asset 275,314. The aggregate is 736 bytes below the prior Windows release measurement, not merely below the cap.
- Full web lint passed, followed by passing lint for the support correction/rendering files. The exact CI-listed boundary suite passed 75/75. The later audio-fixture-only lint process crashed with Windows exit code `-1073740791` during host exhaustion and must be rerun; it is not a passing lint result. Private release logs retain the outputs.
- Initial `npm run build` included the full unchanged content prebuild gate. Subsequent production rebuilds revalidated changed UI/TypeScript directly with `next build --webpack`; content sources were unchanged. GitHub will rerun the complete prebuild on the final commit.

## Remaining batch gates

The first focused browser run was stopped after repeated failures in new `getByLabel` locators for a textarea with populated text content. Its accessibility snapshot showed the correct textbox name and saved value; the existing role-based locators passed. New tests were corrected to use the same exact textbox role/name, without changing UI behaviour or weakening value/access assertions. Failed run evidence is retained privately. The fresh focused desktop/mobile run passed **82/82**, without retries, in 4.8 minutes. Private log: `apps/web/.agent/support-version-focused-browser-final-20260914.log`.

The complete fixture/visual matrix and real-backend journeys are not yet green. The real-role spec includes family setup replay after a newer save, a persisted school conflict, superseded retry and deliberate rebase with a separate save.

Complete browser/visual regression, explicit main staging/push and exact hosted revision verification must finish before release is claimed.

No credential/provider operations, live pupil data changes, paid generation, clinical sign-off or human listening approval took place. Batch completion will not establish those separate product/pilot gates.

## Host blocker and exact continuation boundary

- The cached local CI image matches the workflow digest: `mcr.microsoft.com/playwright@sha256:57b65fdc9ceabe0ef613124c7bbe2babcf9362c4d85e382fe3b03604e84b428a`. Its existing NexusLearn dependency volume was verified: Next 16.2.9, React 19.2.7, Playwright 1.61.0, TypeScript 5.9.3. Runs used `--network none`, two workers and zero retries.
- Binding Windows dependencies timed out during server startup. A subsequent cached-dependency run encountered three failures before stopping: an audio fixture race plus two further timeouts in family evidence/privacy tests. Those two timeouts still need rerun/investigation; they are not declared resolved product defects.
- The audio workflow fixture used a nonexistent sample MP3 path. A late real 404 cleared simulated listening evidence. Synthetic workflow cases now receive a valid deterministic silent WAV; the separate actual ElevenLabs MP3 journey does not install this route. The corrected seek-coverage case passed in the subsequent run; production audio assets and playback code were not modified.
- A new empty task-owned Docker volume, `nexuslearn-support-qa-build-20260914`, contains a copy of the current generated `.next` build, excluding compiler cache. The later full matrix discovered 620 tests but did **not** complete: PowerShell `Tee-Object` reported disk full while writing `.agent/support-version-linux-release-browser-20260914.log`. Its wrapper returned 0 despite the logging failure. This is **not** a passing gate; future runners must make pipeline/logging errors terminating and require an explicit complete test summary.
- C: was measured at only 10,133,504 free bytes. Removed only the verified, non-linked, regenerable `apps/web/.next/cache` directory. Source, compiled production output, evidence and unrelated files were preserved. Free space recovered to 1,498,542,080 bytes; available RAM was still only 606,272 KiB of 16,442,872 KiB.
- Docker stop/status requests became unresponsive. The pending CLI requests were cancelled; shutdown of the task-owned `nexuslearn-support-qa-fast-20260914` container is **unconfirmed**. Do not restart Docker/WSL or remove other projects' containers/images without user authority. Only the newly created QA build volume may be cleaned up as task-owned output once no process uses it; the pre-existing `nexuslearn-linux-node-modules` and `nexuslearn-linux-next` volumes must be preserved.
- FS V2B checkpoint saves failed with internal errors during resource exhaustion. After cache cleanup, the checkpoint succeeded at 2026-09-14 21:33:50 UTC. Use that checkpoint together with this document and the implementation plan; the later audio-fixture lint crash is recorded here.
- After host recovery: rerun audio-fixture lint and the complete browser/visual matrix with reliable logging; investigate any remaining failures; run `TestBrowserCanonicalGrading` and `TestBrowserRoleJourneys` sequentially against disposable PG16 schemas on port 15432 using `CGO_ENABLED=0`, `GOMAXPROCS=2`, `go test -work -p 2`, `RUN_BROWSER_GRADING_QA=true`, `RUN_BROWSER_ROLE_QA=true`, and production frontend mode. Inspect the real-role conflict screenshots, then finish explicit staging, commit/push main and exact GitHub/API/web revision verification.
- No staged files or commit were created. The intended batch is 31 source/test/documentation paths; exclude pre-existing generated/private reports, `next-env.d.ts`, `tsconfig.tsbuildinfo` and all `.agent` directories. Local and remote main were both verified as the base `7409b16` before this blocker.

## Recovery and resumed validation, 2026-09-17

- Disk space recovered to 54.5 GB and Docker responded normally. No task test container was still running. Other projects' containers and volumes were not changed.
- The former Linux dependency volume was empty. The first resumed browser command failed before discovering tests, not in application assertions. Restored exact lockfile dependencies with `npm ci --ignore-scripts --no-audit --no-fund` into the new task-owned `nexuslearn-support-qa-deps-20260917` volume. Repository dependencies were not modified.
- Retained host and Linux QA production builds have the same build ID, `udJ9cM1K0iTX8yUnU6Pnp`. The full browser matrix uses the pinned CI image, two workers, no retries, no network, and a 2 GB memory cap. Evidence: `apps/web/.agent/support-resume-linux-browser-ready-20260917.log` and its matching result directory.
- Fresh full web lint, all 75 CI boundary unit tests, and the unchanged performance budget passed with exit 0. Aggregate JS remains 1,429,051 bytes. The later audio-fixture lint is now covered by this passing full lint run.
- Restarted only the saved disposable PostgreSQL 16 cluster on loopback port 15432. It completed automatic crash recovery; no unrelated database was touched.
- Local and GitHub main still match `7409b16`. A filename-only credential-pattern scan of all 31 intended paths found no matches. Staging remains empty until the integrated gates finish.

### Completed local release gates

- The complete pinned-Linux fixture/visual run passed **608 tests**, with zero failures and zero retries, in 23.1 minutes. Its 12 skipped cases require the separate real-backend harnesses below. Both desktop/mobile flagship and released-renderer visual baselines passed unchanged. The earlier family privacy/evidence timeouts passed on both devices without assertion or timeout changes.
- A fresh complete API suite passed with exit 0 against disposable PostgreSQL: learning 113.052s, server 46.331s, database and narration JSON also passed. Log: `apps/api/.agent/support-resume-api-full-20260917.log`. Go formatting was clean.
- Real canonical grading browser harness: **6/6 passed**, no retries, 38.7 seconds. The intentionally rejected and interrupted HTTP requests exercise failure/retry behaviour; the complete harness exited 0. Log: `apps/api/.agent/support-resume-canonical-20260917.log`; retained browser output: `apps/web/.agent/support-resume-canonical-results-20260917`.
- Real family/pupil/school/admin browser harness: **6/6 passed**, no retries, 1.3 minutes, exit 0. It exercised migration 0060, family setup replay preserving newer support and credentials, same-key replay, school stale/superseded saves, retained draft, deliberate rebase and separate save, and the real pupil's calm-movement adaptation. Log: `apps/api/.agent/support-resume-roles-20260917.log`.
- Inspected the real-backend desktop/mobile `06-school-support-conflict.png` screenshots: saved-versus-draft notes and both explicit actions are readable; mobile buttons and text wrap without horizontal overflow. Screenshots are synthetic test evidence, not pupil records or human SEND approval.
- All **16 deployment-identity smoke regressions** passed. The 75 boundary tests, full lint and budget passes above are fresh; the production build/TypeScript evidence and verified retained build are from 2026-09-14. GitHub must still build and validate the exact pushed source.
- No live account changes, provider spending, new audio production, human listening approval or clinical approval occurred. Remote release outcome is recorded separately in the FS V2B checkpoint after the actual push; this pre-push source document does not predict it.
