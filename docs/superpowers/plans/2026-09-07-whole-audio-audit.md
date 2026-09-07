# Whole-catalogue audio audit implementation plan

**Goal:** Verify every existing generated clip by decoding real PCM, bind results to file/script hashes, and produce an honest year/pack listening-pace queue without fabricating approval.

**Architecture:** A local Playwright/Chromium audit decodes each MP3 with Web Audio. Pure tested PCM/pace functions classify technical faults and review flags. Reports remain outside public assets. Existing generation and listening ledgers are read-only.

**Spec:** User request to check all generated audio is real and has suitable listening speed; G12 audio integrity follow-on.

- [x] Test PCM analysis with silence, audible samples, clipping and malformed samples; test pace triage and short-script uncertainty.
- [x] Audit all on-disk audio, not merely the public manifest; reconcile private/public manifests, byte/script hashes, duplicate content and missing/orphaned files.
- [x] Decode all bytes in Chromium and measure duration, RMS/peak, silence windows, start/end silence and script words per minute. Retain thresholds as product screening heuristics, not SEND or educational standards.
- [x] Produce a private JSON audit and human-readable summary with year/kind ranges and exact clips to review. Do not mark naturalness, pronunciation, human listening or release approved.
- [ ] Continue required-listening safeguards using the findings; test before changing grading/UI behavior. Preserve canonical backend authority and existing private/public boundaries.
- [ ] Verify scoped changes before main push, check hosted CI, save FS V2B checkpoint.

Constraints: keep existing files/credentials/private generated work intact. No paid regeneration or new provider is required for the audit. No voice cloning, speed metadata backfill or blanket slowdown. Real-time listening judgment must remain explicitly distinct from PCM decoding and script-rate inference.

Local verification: 17 audit tests, including real-MP3 playback and failed-integrity-report browser journeys, plus the public-content boundary test passed. All 874 recordings decoded; no inventory/integrity faults; 172 fast-pace screening flags. ESLint and existing production asset budget passed. The generated local HTML also resolved the actual on-disk MP3 in Chromium, with no page errors or mobile horizontal overflow. One bounded read-only reviewer identified missing integrity-failure visibility in the HTML; this was reproduced, fixed and regression-tested, then the reviewer was closed. This is a completed audit batch, not completion of the separate G12 required-listening assessment gate.
