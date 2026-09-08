# Admin review context and recording integrity

## Changes

- A direct visit to Releases resolves teacher evidence and mastery context from the backend readiness response, without depending on a previously visited objective-directory page. An unknown objective remains explicitly unmatched.
- Both Readiness objective buttons use the complete editor adapter and canonical navigation. Saving retains prerequisite, misconception, parent explanation, teacher evidence, retention, required-format and non-default mastery values. The legacy button now respects visible-role sections.
- Audio review drafts, player instances, playback errors and duration measurements are keyed by asset ID plus audio, transcript and production-profile hashes and delivery URL. Replacing any one of these does not carry forward the old draft's completion or suitability checks.
- The authenticated player displays browser-reported duration and a script-rate screen, using the same pure function as the offline PCM audit. It does not claim to transcribe or validate the served bytes. Short scripts require direct listening; screening thresholds are product heuristics, not educational or SEND standards.
- Missing historical generation-speed metadata is displayed as unknown. No recordings were regenerated, slowed, human-approved or promoted by this batch.

## Performance decision

The preceding `d1140ae` hosted web gate failed the 1,420,000-byte aggregate JavaScript ceiling. The prior baseline measured 1,419,374 bytes. Compacting review markup and eliminating the duplicate objective adapter reduced unnecessary growth.

The consolidated production build measures **1,424,645 bytes**. The aggregate ceiling is explicitly calibrated to **1,430,000 bytes**, leaving 5,355 bytes of local measured headroom. This is a deliberate budget adjustment, not a claim that the previous ceiling passed. Largest route **694,856 / 750,000**, largest file **222,190 / 250,000**, CSS **63,841 / 120,000**, and public asset **275,314 / 600,000** retain their existing limits. CI rechecks these values in its own environment.

## Verification

- Tests first reproduced both objective-flow failures and the audio draft/pace-visibility failures. The full objective save payload is asserted, not just rendered labels.
- Final focused production-build browser run: **38 passed** across desktop and mobile, including independent audio/transcript/profile/URL replacement, role navigation, rejection, accessibility and an actual produced MP3 reaching its native end. Playback does not check suitability boxes or submit an approval.
- Wider browser run: **238 other tests passed**. Its two new pace-test failures were an incorrect fixture word count, corrected and covered by the focused run. Six database-only cases were skipped there and then **all six passed** in the real Go API/disposable PostgreSQL harness, including replay without duplicate mastery. Windows does not rewrite Linux visual baselines; pinned Linux CI remains the visual acceptance environment.
- Full content-quality/prebuild, production build, TypeScript, scoped ESLint, 17 audio-audit tests and five performance-gate tests were checked. One bounded read-only reviewer found no blocking P1/P2 issues and was closed.
- A cold lazy-loaded audio chunk exposed an over-short test startup wait. The audio harness now matches the other admin harness's bounded 15-second readiness wait; workflow assertions and production timeouts are unchanged.

## Audio audit and remaining limits

The refreshed 2026-09-08 whole-catalogue audit decoded **874/874** real files without inventory or technical-integrity faults. It flags **172** for pace review: Year 1 **69**, Year 2 **54**, Year 3 **12**, Year 4 **13**, Year 5 **8**, Year 6 **11**, Year 7 **5**. Historical generation speed is unrecorded for all 874. These findings do not establish naturalness, pronunciation, suitability or human listening completion.

The native `ended` event remains workflow telemetry, not proof of continuous listening or attention: seeking can reach the end. Named human criteria, byte/transcript/profile binding, safeguarding and child-pilot evidence remain separate gates. Generated/private reports and local browser artefacts are not part of this source commit. Hosted run outcomes are recorded in the FS V2B checkpoint after the push.
