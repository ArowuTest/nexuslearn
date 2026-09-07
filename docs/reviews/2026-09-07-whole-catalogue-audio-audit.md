# Whole-catalogue audio integrity and pace audit

## Result and limits

The September 7 audit decoded **all 874 on-disk recordings** (523 lesson and 351 vocabulary clips) through Chromium Web Audio, examining every decoded sample. All files match their recorded audio hashes and script hashes, with no missing/orphaned files or mismatched public/private identities. None triggered decode, MP3-frame, non-finite sample, silent-file, excessive-silence, near-full-scale clipping or long-edge-silence flags.

This is evidence of playable, non-silent audio, **not** transcription, proof of natural speech, pronunciation accuracy, SEND suitability, human listening or permission to release it. All existing files retain their pending-listening status. No recording or review ledger has been changed.

**172 scripts need priority pace review.** Source-script words divided by decoded duration provide a screening estimate; this does not identify words actually spoken. Short vocabulary scripts below eight words are explicitly excluded from pace classification and still require listening. There are no slow-pace flags in this snapshot.

| Year | Decoded files | Scripts with ≥8 words | Median script words/min | Fast-pace review |
| --- | ---: | ---: | ---: | ---: |
| 1 | 120 | 100 | 172.3 | 69 |
| 2 | 122 | 110 | 170.0 | 54 |
| 3 | 124 | 114 | 161.5 | 12 |
| 4 | 127 | 121 | 161.5 | 13 |
| 5 | 117 | 103 | 149.9 | 8 |
| 6 | 145 | 134 | 159.0 | 11 |
| 7 | 119 | 111 | 154.5 | 5 |

The thresholds (Y1 >160, Y2 >170, Y3–7 >190, or <70 words/min) are conservative **product triage heuristics, not educational or clinical standards**. Complexity, pauses, phonics accuracy and individual access needs must inform the listening decision. Even an unflagged recording can need revision.

## Voice and historical speed

The manifests identify ElevenLabs **Alice — Clear, Engaging Educator**, British, `eleven_multilingual_v2`. Current production code requests Y1 lesson speed 0.92 and vocabulary 0.90; Y2–7 lesson 0.94 and vocabulary 0.92. However, all 874 existing manifest entries lack recorded generation-speed settings. Current configuration must not be represented as proof that older files were generated at those speeds. Do not backfill guessed settings.

ElevenLabs supports a generation speed setting, with values below the default slowing speech; its documentation also warns that extreme adjustments can affect quality. A browser's playback-rate comparison is not equivalent to regenerating the voice. See [ElevenLabs pace guidance](https://elevenlabs.io/docs/help-center/product/core-capabilities/text-to-speech/can-i-change-the-pace-of-the-voice).

## Reproduce and listen

From `apps/web`, after installing dependencies and Playwright Chromium:

```sh
npm run quality:audio-audit
```

The command runs regression tests, decodes the complete MP3/WAV/OGG/M4A inventory, checks both manifest directions and writes:

- `packages/content/generated/coverage/narration-full-audit.json`: exact byte/script/manifest hashes, PCM metrics and every per-clip flag.
- `packages/content/generated/coverage/narration-full-audit.html`: local-only, read-only listening workspace. Open it **in place in the repository** so its relative audio links resolve. Do not copy it into `apps/web/public` or deploy it as an anonymous page.

The listening workspace starts with the 172 pace flags, prioritising earlier years and faster scripts. Filter by year, lesson/vocabulary, or search the pack/script. The All recordings lane includes every file; the short-script lane highlights clips for which rate inference is particularly weak. Pages contain at most 25 rows and use a single audio player.

Choose Listen / compare, then play the original recording. The 0.9× control previews a slightly slower version without changing its bytes or pitch intentionally; return to Original 1× before judging the existing production file. Selecting another recording, changing a filter or paging stops old playback. No approval, listening completion or production change is recorded here. This report is a dated snapshot: rerun after changing scripts/files.

Record actual named listening decisions in the authenticated Admin audio QA workspace against the exact asset hashes. If a slower recording is required, regenerate an appropriately selected batch, inspect the new audio, rerun this audit, and obtain new hash-bound listening decisions. Do not approve original files on the strength of slowed comparison playback.

## Automated guardrails

The platform workflow runs this command using its pinned Chromium image and retains both reports as a 14-day CI artifact, not a learner-facing asset. Inventory failures (including duplicate IDs/paths), audio/script hash mismatches, frame corruption, silence and decode faults fail the command. Pace and unrecorded-speed flags do not pretend to be corruption or listening approval.

Regression tests cover PCM shape, quiet signals, stereo content, non-finite values, silence, clipping, pace thresholds and short-script uncertainty; inventory duplication, traversal/unsafe paths, orphan/missing entries and script-hash failure; and a real-MP3 browser journey including script injection safety, comparison playback, pagination and cancellation. No additional runtime dependency or learner bundle code was added.

Local acceptance: 17 audit tests and the separate public-content boundary test passed, together with touched-tool ESLint, the full 874-file decode and the unchanged production asset budget. One bounded read-only reviewer found missing HTML visibility for future integrity failures. A failing browser regression reproduced it; the corrected report now opens an integrity lane, shows an explicit failure summary including missing inventory entries, and displays per-file flags. The reviewer was closed. No human or specialist listening was performed by these tests.

## Remaining G12 work

The audit does **not** close the separate backend/UI safeguards for an explicitly required listening assessment when its clip is unavailable, independent-assessment answer leakage via model/scaffold audio, assistance evidence, or full pronunciation/naturalness/listening review. The existing released-manifest transport checks remain unchanged. Prioritise the Year 1/2 listening queue before any claim that every recording has suitable speed.
