# Authored audio transport and cancellation repair

## G12 subset implemented

- The backend pupil projection maps `whole_word_audio_asset_id` to the existing canonical `whole_audio_asset_id` when no canonical reference is set. Positionally aligned `phoneme_audio_asset_ids` map to `audio_assets` using only already-public `sounds`. Mismatched arrays are not guessed, unrelated map keys stay private and the canonical question is not mutated.
- The sound-blending whole-prompt control uses the same narration-field resolver as the mission's question control. Manifest IDs still require technical validation and a released/listening-approved status. No assets are promoted by resolving aliases.
- Produced narration has one active player. Replaying a question or selecting a phoneme stops the previous clip. Muting stops active narration and synthesized UI tones, not just future playback.
- Question/lesson transitions, feedback completion, pause and mission unmount cancel obsolete narration. Exit links stop it at navigation intent, including while destination server data is pending.
- A pending `play()` cancelled by replay, mute or navigation does not create false transport-failure feedback/telemetry. A real playback rejection retains the existing failure route.

This changes transport and references, not the ElevenLabs voice, speed, files, provider credentials or listening approvals. The short synthesized UI chimes remain distinct from produced speech; no browser speech synthesis fallback is introduced.

## Reproduction and review

The initial Go projection regression returned no whole-word reference and an empty audio map for authored segmenting aliases. The initial production-build browser test left two narration instances playing after replay. Both are regression-tested.

The first navigation run exposed a slow `/play` server-component transition. A deterministic test then held the destination response and reproduced narration continuing after Exit was clicked. Stopping only on unmount was insufficient; navigation intent now cancels immediately. This was a product fix, not a widened timeout or snapshot change.

One bounded read-only audio reviewer returned no actionable findings in the core alias/lifecycle patch and was closed. The later navigation-intent edge case was diagnosed and tested by the parent agent.

## Acceptance and remaining boundaries

Local acceptance: full Go tests with disposable PostgreSQL, Go vet/build, production web build, TypeScript, touched-file ESLint and deployment-smoke YAML validation passed. **66** focused production-build desktop/mobile browser tests passed in 2.4 minutes, including audio lifecycle, gamification, mission integrity, question contracts and switch review-boundary access. A further **2** desktop/mobile tests passed in 27.9 seconds using a real existing 102,862-byte MP3 through Chromium's native decoder and the mission's Hear question / Mute controls. Aggregate JavaScript is **1,404,412 / 1,405,000 bytes**, with thresholds and visual baselines unchanged; remaining bundle headroom is narrow.

Controlled audio objects verify playback/stop/cancellation races and released-manifest resolution. The real-file test verifies technical decoding/playback of one generated Alice Year 1 listening warm-up clip, not educational pronunciation, pace or listening approval. Its direct URL is injected only into a disposable test mission; no production manifest entry is promoted. The local manifest has **zero** technical-pass entries with a released/listening-approved status at this checkpoint, so aliases alone do not make pending clips available to pupils. Go tests protect projection privacy and immutable canonical snapshots. Final real-backend and hosted acceptance identifiers are recorded in FS V2B after verification.

The final authenticated real-API/PostgreSQL browser harness also passed **6 tests in 30.8 seconds**, retaining decimal replay, adult evidence, English repair and accepted-reading-alternative behaviour after the audio changes.

Still open within G12: required-listening assessment gating when a clip is unavailable, ensuring scaffold phonemes/models do not leak independent-assessment answers, recording the appropriate assistance evidence, broader per-asset transport QA, and independent listening review. Existing direct-URL integration support is unchanged. The production-readiness decision in the game audit is not reversed by this repair.
