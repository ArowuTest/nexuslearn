# Narration production safety and recovery

## Scope and evidence

This is production-tool remediation, not new curriculum, generated speech or listening approval. Existing Alice/ElevenLabs narration and the Year 1 pacing policy are unchanged. All **874** existing recordings still need honest generation-metadata and listening treatment; **172** pace-screen flags remain triage, not automatic failure or approval.

The offline regressions first reproduced invented historical settings, JSON key order causing unnecessary paid generation, filtered batches dropping unrelated recordings, automatic retries of billable POSTs, stale review/generation metadata inherited by replacement audio, partially replaced public files after provider failure, and incomplete publication after a file-write failure/process exit. The final suite contains **19 producer regressions** and **70 content-tool tests**. The test provider is a local in-process transport double; its synthetic MPEG frames prove format/transaction handling, not intelligible speech. No real provider calls or audio changes occurred.

One independent reviewer identified the selected-reuse overlay issue after the initial metadata fixes. It was reproduced and corrected: reuse now replaces the object from historical metadata plus new technical checks, preserving absent profile/name fields rather than filling them from current policy. A second bounded review found that a missing publication journal could trigger unsafe backup cleanup. The process-exit regression reproduced it; missing or invalid state now stops recovery and retains all backups for investigation. Both reviewers were closed after their scoped reviews.

## Behaviour

- Unknown selected generation settings block real production before any provider call unless the operator explicitly selects a replacement batch with `--force`. A dry-run reports `unknown_settings` and makes no writes. Historical speed is never inferred from today's defaults.
- Matching recorded settings are compared canonically, so JSON property order cannot trigger a paid request. Unselected, hash-verified recordings retain their own recorded settings and review metadata even if they differ from current policy.
- A newly recorded file carries only current request metadata, measured technical checks and a new generation timestamp. Previous listening/reviewer assertions are not copied onto it.
- One provider POST has a 90-second deadline through its response body. HTTP errors, rate limits, network uncertainty and invalid MP3 responses are not automatically retried. Raw provider error bodies are not logged. A lost response can still have been charged: inspect provider usage before deciding to retry it.
- Each completed response is staged privately under `.agent/narration-production/assets`, bound to the exact transcript/voice/model/settings/output/path identity. Resume rechecks the bytes, digest, request identity and generation timestamp. Incomplete or corrupt evidence fails closed; it is not silently overwritten with another paid response.
- No public files change during provider work. After the complete selected batch is ready, a bounded publication journal backs up all affected audio and both manifests/review pages. Ordinary write failures restore the previous inventory. An interrupted, uncommitted publication is recovered before subsequent production; a dry-run refuses an inventory awaiting recovery.
- A filesystem lock prevents competing producer processes. A terminated process can leave a stale lock intentionally: verify that its recorded owner is no longer running and inspect the journal before removing only that owned lock. Do not delete staged responses or publication backups to bypass an error.
- Atomic file replacement and process-interruption recovery are tested. This is not an assertion of simultaneous multi-file visibility to live readers or power-loss durability/fsync. Produce in the development workspace, inspect the completed batch, run the gates and then deploy it.

## Operator sequence

1. Run `node packages/content/tools/produce-narration.mjs --dry-run --year 1 --limit 1` (or a deliberately selected pack/year/kind/limit). The verified repository preview selected one 91-character lesson and reported `planned=1 unknown_settings=1`, with zero generation.
2. Inspect the scripts and requested pace. Set the provider key only in the process environment, never a command argument, source file, manifest, journal or review note. Keep variant generation closed until its backend manifest-import gate is ready.
3. For a deliberately chosen historical replacement, use the same filters with `--force`. The flag permits replacing unknown settings; it is not a listening approval. If a provider request fails, inspect billing/usage before explicitly rerunning. Verified prior responses resume without another provider call.
4. If publication fails, preserve its journal and staged responses. Recover on the next normal invocation after resolving the filesystem problem. For a terminated process, first inspect/remove only its stale lock after confirming no producer remains. Corrupt recovery evidence requires investigation, not blind deletion.
5. Run content validation, complete MP3 decoding/hash checks and the admin listening-review workflow. Review pronunciation, naturalness, age suitability and speed against the exact new audio identity. Confirm that unrelated inventory is retained and human approvals remain pending before committing.

## Remaining audio/product gates

The 172 pace flags still need targeted listening and appropriate re-recording decisions. Historical metadata cannot be reconstructed by this code change. Specialist phonemes, governed variant narration production/import, independent safeguarding review and real-child pilot evidence remain separate release gates. Do not cancel the provider subscription on the basis of this tooling batch alone.
