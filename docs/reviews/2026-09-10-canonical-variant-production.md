# Canonical variant audio: production and import integration

## Implemented scope

The existing backend manifest importer was implemented, but the producer still
unconditionally rejected non-dry-run variant batches. The producer now writes a
separate `packages/content/audio/narration-manifest-v2.json` review inventory.
The legacy lesson/vocabulary manifest and its public projection are untouched.
No actual recordings, provider calls or human listening approvals were made in
this implementation batch.

- A real variant batch requires explicit `--only variants`, a `--limit` from 1
  to 500, and `--licence provider_terms`. The licence argument is the operator's
  confirmation of applicable usage rights, not automated legal verification.
- Identical transcript/profile aliases share one recording. The current
  slowest-required year pacing rule remains in force: Year 1 uses 0.92 for
  variant narration. Pure phonemes remain specialist-required and are never
  submitted to generic speech generation.
- Verified earlier assets survive later filtered batches. Reuse refreshes
  catalogue aliases without paying for the same speech again. Newly constructed
  variant entries do not inherit historical listening assertions.
- Canonical URLs are immutable. `--force` cannot replace an existing variant
  recording; corrupt, missing or orphaned historical bytes require restoration
  or a deliberately changed transcript/profile identity. These checks run
  before any provider call, and destinations are rechecked before publication.
  A bounded, hash-checked `narration-asset-history.json` retains URL reservations
  across filtered catalogues and missing files; it is published transactionally
  with the v2 manifest. It must be retained with the inventory, not cleaned away.
- Variant MP3s and their manifest use the existing staged-response, locking and
  recoverable publication transaction. Failed publication retains paid response
  evidence; retry can resume without another provider request. This is not a
  claim of simultaneous multi-file visibility or power-loss durability.
- Import bounds remain 5,000 assets, 10,000 reference IDs and a 32 MiB HTTP body.
  Current inventory: 4,458 production identities, 5,496 references, 7,161 source
  occurrences, 1,791 avoided duplicate recordings, 22 specialist references,
  zero unresolved transcripts. A complete placeholder-metadata size estimate
  was 11,656,849 bytes; it was not a generated audio manifest.
- The backend review inventory loads a valid v2 companion beside the historical
  manifest. Existing lesson/vocabulary reviews remain available. Invalid
  companion identities fail closed instead of silently disappearing.
- Shared recordings can be filtered by every actual year/subject/pack binding;
  combinations must belong to the same pack, not an invented cross-product.
  Each asset counts once per applicable year, with one shared review identity.

## Integration defects corrected

The new regression runs the actual Node producer with a local synthetic MPEG
transport and sends its output through the Go HTTP import handler. It first
failed because Go's HTML escaping changed the canonical hash for mathematical
symbols such as `<` and `&`. Serialization now matches the producer for these
characters and Unicode line/paragraph separators, preserving literal backslash
sequences. This serializer is for hashing, not HTML embedding.

The same test then exposed specialist placeholder references with empty hashes,
which PostgreSQL rejects. The v2 manifest now binds these explicitly blocked
references to the SHA-256 of an empty transcript. It does not invent a transcript,
recording, production identity or approval.

A further regression exposed a queue-filter gap: shared audio was visible only
under its first pack. The queue now returns explicit curriculum bindings and
describes the matched pack in filtered rows, retaining a single asset/review.

The independent adversarial review found that forced regeneration could replace
audio at an older release's URL. Three regressions reproduced forced, corrupt
and orphaned canonical overwrites. Such requests now fail before another paid
call. Supporting alternate takes under an unchanged transcript/profile needs
an explicit audio-versioned-path design; it is not silently enabled here.
The follow-up review also reproduced a two-batch bypass after a missing,
unselected asset left the active manifest. Durable history now preserves that
reservation even when the current review inventory omits the missing file.

## Operator path

1. Preview a deliberate batch, for example:
   `node packages/content/tools/produce-narration.mjs --only variants --year 1 --limit 10 --dry-run`.
   The verified preview selected 10 identities / 787 characters with no writes
   and no provider calls.
2. Confirm the transcript selection, provider rights, credit budget and pace.
   Supply `ELEVENLABS_API_KEY` only through the protected process environment.
   Run the selected batch with `--licence provider_terms` instead of `--dry-run`.
3. Decode/audit the resulting real audio; deploy its exact files and private
   companion manifest. The admin listening queue then includes its variants
   alongside existing lesson and vocabulary recordings.
4. Import that exact v2 JSON through the authenticated platform-admin endpoint
   `POST /v1/admin/audio/manifests/import`, with the release ID as its idempotency
   key. Import is an explicit operation, not an automatic producer network side
   effect and not release activation.
5. Complete exact-identity human listening reviews and the separate content,
   safeguarding and pilot release gates. The producer does not publish approved
   learner mappings or mark a review batch live.

## Verification and remaining work

Final offline content-tool suite: **80/80**, with one test worker. This includes
forced/corrupt/orphaned destinations, reservations across successive filtered
batches, and rejecting a malformed existing history document. An earlier
concurrent run passed 79/80: the stalled-body subprocess was killed before
emitting its deadline error. Both bounded-deadline tests then passed unchanged
in two serial executions; the earlier failure remains recorded, not erased.
Focused Go narration/audio server,
repository and migration checks passed, including real PostgreSQL transactional
and idempotency tests. A full API and combined frontend release check is recorded
with the batch handover. Synthetic frames are never listening-quality evidence.

Real variant generation, specialist speech, listening of all 874 historical
recordings plus new recordings, targeted pace decisions, live import and exact
release activation remain. The provider subscription should not be cancelled on
the basis of these tooling checks.
