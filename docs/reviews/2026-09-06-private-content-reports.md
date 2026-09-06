# Generated report access boundary

## Finding and scope

The pupil mission DTO was separated from canonical answer keys in `ea06a13`, but 25 generated operational/review files remained anonymously downloadable under `/content`. The admin report loader also fell back to these files after authenticated API failure. A signed-out visitor could bypass the intended admin report boundary. The audit found report and review metadata; it does not establish that pupil personal data was present in those files.

## Remediation

- Keep only `narration-manifest.json` in `apps/web/public/content`. Learner audio files remain public teaching assets. No audio is generated or newly approved here.
- Move report copies intact to `apps/web/private/content`, outside Next's public directory. Existing local report edits are preserved at their new paths, not included as new review decisions.
- Redirect the 17 report-producing tools to the private destination. The full authoring reports under `packages/content/generated` remain unchanged by this access-boundary decision.
- Serve JSON reports only through the existing allowlisted, authenticated Go admin endpoint, with `Cache-Control: private, no-store`. Do not fall back to old public copies.
- Admin downloads use authenticated requests and JSON files. Listening QA navigates to the existing authenticated Audio workspace, which provides playback and recorded review decisions. Legacy standalone HTML reports remain local operational artifacts; they are no longer public pages.
- Run an output-boundary check after every full content prebuild. Unexpected files in public/content or unexpected narration-item fields fail the build.
- Preserve browser traces and structured results even when retries make CI green. Upload the main browser run before the separate real-backend run can replace its results directory.

## Acceptance evidence

- Initial boundary test failed with all 25 reports listed as public. After relocation it passes and still verifies the audio manifest.
- API access/cache tests and existing allowlisted report tests pass.
- A single independent code reviewer found the alternate narration-report route missing the same no-cache header. A regression test reproduced the gap; both report routes now apply the policy before authentication, including access errors.
- Local desktop/mobile acceptance: 12 admin-navigation/download/public-boundary cases and 34 admin-role/audio-review/critical-journey cases passed (46 total, no retries). The SEND completion journey passed on both devices; this does not establish the earlier CI flake's cause.
- TypeScript, ESLint, Go tests/vet/build, focused final report-handler regressions, full content prebuild and Next production build passed. Local Go execution did not opt into disposable-database tests; the unchanged CI real-database job remains part of hosted acceptance.
- The final production asset gate passed: JavaScript 1,404,568 bytes under the unchanged 1,405,000 ceiling; largest public asset 275,314 bytes. Public-boundary validation passed after all content generators ran.
- Hosted before deployment: legacy report JSON and listening-QA HTML returned 200 without authentication. Post-deployment results and exact commit/workflow identities are retained in FS V2B.
- One initial browser invocation timed out starting its local dev server before any tests ran. Starting the owned server directly and running one browser worker completed all acceptance cases; no assertions or timeouts were relaxed.

## Follow-on: production-browser CI

Hosted run 34040245213 passed but retried two desktop tests. The newly retained artifact (9991554444) now supplies the missing evidence:

- SEND trace: three attempt requests returned 200, followed by a second document request for the same mission at 14:50:03.660 UTC, immediately after the third attempt. The final snapshot had reset to zero discoveries and the teaching step; the trace also records development Fast Refresh.
- Decimal-contract trace: the page failed in Next's `loadManifest` / `app-page.runtime.dev.js` with `Unexpected end of JSON input`, before the learning renderer was available.

CI now builds with the fixture API origin and uses `next start` for both fixture browser tests and the separate real-API/database harness. Ordinary local Playwright retains dev mode; `PLAYWRIGHT_SERVER_MODE=production` opts into a previously built production server and never silently reuses a dev server. The SEND test additionally rejects unexpected document reloads. Screenshot baselines, element waits and functional/accessibility assertions are unchanged. This addresses the observed development-server interference, not every possible future test flake.

The first broad local production run passed 155 cases. Two role tests still required development Strict Mode's duplicate mount reads; they now require exactly one read in production and two in development. A separate local SEND timeout occurred with a correct completed journey in the captured snapshot during observed 100% CPU utilisation; another focused run exceeded the same 30-second total budget. This long three-answer teaching/pause/audio/keyboard journey plus accessibility scan now has a 60-second total test budget. This does not increase individual element waits or bypass the saved-evidence, no-reload or accessibility assertions.

Final focused production acceptance: all four role/SEND desktop/mobile cases passed without retries in 42.4 seconds; the SEND journeys took 11.2 and 9.9 seconds. Combined with the broad run, 158 distinct non-snapshot browser cases passed. This is not a claim that the initial broad run was entirely green. Production test build, lint and unchanged asset gate also passed (1,404,472 JavaScript bytes with the fixture API origin). Hosted Linux visual and real-database acceptance for the follow-up is recorded in FS V2B.

## Limits and follow-on work

This governs the current app deployment, not repository history, downloaded copies or old immutable deployment URLs. It is not a mechanism for retracting already-published artifacts. Generated reports still require educational review; moving files does not approve their claims. Adult immutable grading-evidence reporting, legacy unversioned grading retirement, richer marking policies and human listening/pilot gates remain separate follow-on work.
