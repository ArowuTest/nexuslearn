# NexusLearn Wave 3: Audio Release Operations Design

Status: Approved for implementation on 2026-08-29

## Outcome

Build one backend-governed audio release system that can catalogue, produce,
review and release every eligible Year 1-7 lesson, vocabulary and question
variant recording without exposing provider credentials or weakening human
listening and safeguarding gates.

## Product principles

- Audio is an access route, not a shortcut around curriculum entitlement.
- A non-audio route remains complete and equivalent for every learner.
- Natural speech, pronunciation, pacing and age suitability require human
  listening evidence tied to the exact transcript and audio bytes.
- Pure phonemes and SSP-sensitive utterances require specialist production and
  review; generic text-to-speech must not silently generate them.
- SEND settings may alter pacing, replay and presentation, but never change the
  meaning of the prompt or the evidence expected from the learner.
- Production credentials live only in protected runtime secrets.

## Current state and problem

The existing narration manifest governs 874 technically valid lesson and
vocabulary files. The API exposes a paginated listening queue and stores
idempotent, immutable human decisions tied to transcript and MP3 hashes.

The earlier singular-field audit found 5,352 audio-reference occurrences across
5,309 reference IDs. The deterministic compiler also enumerates plural whole-
word and phoneme fields: the complete current inventory is 7,161 occurrences,
5,496 reference IDs and 4,458 exact transcript/profile production assets. This
avoids 1,791 duplicate recordings. Twenty-two canonical pure-phoneme references
remain specialist-required and no reference lacks recoverable spoken text.
More importantly, an unresolved reference does not carry a deterministic
identity that production, review and runtime can all verify.

## Architecture

### 1. Deterministic authoring catalogue

An offline compiler reads all objective packs and emits a deterministic
catalogue. Every eligible reference binding records:

- reference ID and every source occurrence;
- pack, year, subject, variant and field location;
- exact spoken text and its SHA-256 hash;
- transcript source, such as an authored narration script or prompt fallback;
- production profile: provider, voice, model and voice settings;
- canonical production asset ID derived from the production-profile hash.

The catalogue is sorted and contains no timestamps in its identity-bearing
payload. Reordering pack files or object properties cannot change its release
identity. One reference ID resolving to multiple transcripts is a hard error.

### 2. Canonical production identity and deduplication

The canonical production key is SHA-256 over canonical JSON containing:

1. catalogue schema version;
2. transcript SHA-256;
3. provider identifier;
4. voice identifier;
5. model identifier;
6. exact voice settings and output format.

References with the same key share one produced audio file and one human
listening decision. Different pacing, voice, model, output format or transcript
creates a different production identity and invalidates reuse.

When one reference ID is deliberately shared across year groups, its canonical
recording uses the slowest required configured pace. This preserves one exact
runtime binding while meeting the most supportive pacing requirement.

### 3. Versioned production manifest

The private manifest binds canonical production asset IDs to transcript hash,
audio hash, provider, voice, model, settings, licence/provenance metadata and
file path. A public runtime projection includes only identifiers, safe playback
paths, release status and accessibility metadata. Neither manifest contains a
provider key.

The manifest release ID is content-derived. Partial production may update a
review manifest, but a live release must bind every required reference to an
exact technically valid and listening-approved production identity.

### 4. Backend operations and review

The API owns paginated, filterable operational queues. It accepts idempotent
production imports and immutable listening decisions. A decision is current
only when its transcript SHA-256, audio SHA-256 and production-profile hash
match the active manifest. Any mismatch marks the decision stale.

Regeneration creates a new production identity or audio hash. It never mutates
historical evidence. Batch actions are bounded and return per-item outcomes;
they do not use one unbounded transaction or query.

### 5. Admin workflow

Authorised platform administrators and content reviewers can:

- filter by year, subject, pack, kind, status and search text;
- play the exact candidate recording beside its transcript;
- see speed, voice, model, hashes, reuse count and source occurrences;
- approve naturalness, clarity, pronunciation and age suitability;
- reject with structured reasons and notes;
- request re-recording without erasing the rejected evidence;
- inspect progress by year and subject in bounded pages.

The interface labels automated technical checks separately from human
listening approval and never represents AI review as independent professional
approval.

### 6. Release gate

Live activation fails closed when any required reference is missing, stale,
technically invalid, not listening-approved, or governed by an unsupported
licence. Pure phoneme exclusions are visible blockers until specialist assets
and approvals are supplied. Review and pilot channels may carry incomplete
inventories, but cannot become learner-live by implication.

## Data boundaries

- Objective packs remain version-controlled authoring source.
- The deterministic catalogue and release manifests are generated release
  artefacts with schema validation.
- PostgreSQL is operational truth for review decisions, audit events and active
  release state.
- The learner runtime receives only safe released asset mappings needed for its
  selected mission.
- Provider secrets are never stored in packs, manifests, browser bundles,
  checkpoints, logs or review evidence.

## Failure behaviour

- Conflicting reference text: compilation fails with both source locations.
- Missing transcript: reference is reported as unresolved and cannot release.
- Pure phoneme: reference is classified specialist-required and excluded from
  generic generation.
- Missing or invalid MP3: no produced manifest entry is created.
- Changed transcript/profile/audio: prior listening decision becomes stale.
- Duplicate idempotency key with different payload: API rejects the request.
- Partial batch failure: successful immutable items remain auditable; failed
  items retain actionable errors and are safe to retry.

## Acceptance criteria

1. Repeated compilation of unchanged packs produces the same catalogue ID.
2. All eligible references have one deterministic binding or an explicit
   specialist/unresolved blocker.
3. Duplicate transcript/profile combinations share one production asset.
4. Conflicting use of a reference ID fails compilation.
5. No credentials appear in generated artefacts or API responses.
6. Listening approval is stale after transcript, profile or audio change.
7. Runtime resolution exposes only exact released identities.
8. Queue endpoints remain bounded and role-scoped.
9. Year, subject, pack, status and search filters work in the admin UI.
10. Content, Go, TypeScript, build, performance and Playwright gates remain
    green before a live integration claim.
