# ADR: Backend-controlled curriculum releases

Status: Accepted

## Decision

NexusLearn uses a hybrid content architecture:

1. Rich objective packs remain version-controlled content-as-code under
   `packages/content/packs`.
2. CI validates packs and compiles a deterministic, immutable release bundle.
3. Each pack is uploaded as an independently hashed chunk to the Go API.
4. The API verifies the signed manifest, chunk identities, counts and channel
   rules before activation.
5. PostgreSQL activates the complete release in one transaction.
6. Learner clients receive only the small mission selected for that learner;
   they never download the full curriculum bank.

This separates authoring from delivery without creating two manually maintained
curricula.

## Why

The earlier pack publisher issued one HTTP request for every objective,
activity, question and reward rule. A failure halfway through a large release
could leave production with mixed versions. It also made a curriculum release
difficult to identify, audit and reproduce.

Keeping all curriculum logic in frontend bundles would expose large question
banks, increase download size, weaken release control and make adaptive
selection dependent on the browser. Hard-coding authored content in Go would
make curriculum work slow and create an unnecessary deployment dependency.

## Release contract

A bundle contains:

- `manifest.json`: release ID, channel, source revision, aggregate counts and a
  SHA-256 descriptor list;
- `packs/<pack-id>.json`: one compiled objective-pack payload with its own
  SHA-256 digest and declared item counts.

Release IDs are content-derived. Rebuilding unchanged packs produces the same
identity. Uploads are idempotent.

Supported channels are:

- `review`: staged for internal inspection and never activated into the learner
  catalogue;
- `pilot`: staged for pilot-readiness inspection; cohort-specific catalogue
  routing is a future extension, so it cannot replace the active catalogue;
- `live`: requires runtime-visible activities and at least three
  runtime-approved questions per pack, then may be activated after human gates.

## Activation and failure behaviour

Chunks are staged without changing learner-visible content. Live activation locks
the release, verifies every expected pack and aggregate count, validates channel
rules, then upserts objectives, activities, questions and reward rules in one
database transaction. For complete snapshots, content owned by an older
release is archived only inside that successful transaction.

The same transaction fails closed unless its release metadata names one exact
imported narration release and catalogue. The API verifies their
content-derived IDs and SHA-256 digests, supported provider-terms licence,
complete asset count, zero unresolved or specialist-required references, and
every required asset's transcript, audio, production-identity and
production-profile hashes. It then joins the latest append-only listening
decision for those assets in bounded set queries. A changed transcript, audio
file, voice profile, manifest, catalogue or licence invalidates the prior
evidence; an asset ID on its own is never sufficient for activation.

If validation or any write fails, PostgreSQL rolls back the whole activation.
The previous release remains active.

Applied releases retain their verified pack chunks. A superseded live release
can therefore be reactivated through the same activation endpoint to perform a
transactional rollback; the currently applied release becomes superseded only
after the older snapshot has been restored successfully.

## Runtime truth and observability

Learner-facing repository reads are release-scoped. Before the first live
release is applied, the original database seed remains the safe legacy
catalogue. Once a live release is applied, objectives, adaptive activities,
learner questions, warm-ups and generated mock-assessment items are restricted
to that release ID. Superseded seed or release rows remain available for
rollback and audit, but cannot leak into the learner runtime.

The public `GET /v1/curriculum/release-status` endpoint exposes only the safe
runtime summary: whether the learner catalogue is the legacy seed or a live
release, the runtime objective count, and non-sensitive applied-release counts.
It does not expose staged payloads, review decisions or learner data. The
authenticated admin release ledger remains the operational source for staged
pack uploads and activation history.

## Operational workflow

Build and verify locally:

```sh
node packages/content/tools/objective-pack.mjs bundle --all \
  --channel review --source-revision <git-sha> --out <release-dir>
node packages/content/tools/content-release.mjs validate <release-dir>
```

For a live bundle, operators can inspect the authoritative release gates before
staging it:

```sh
node packages/content/tools/content-release.mjs preflight <live-release-dir> \
  --api <api-url> --token <admin-session>
```

This is a read-only, administrator-only check. PostgreSQL evaluates the exact
manifest in one repeatable-read transaction and returns stable blockers for
current AI review, safeguarding, audio release, audio listening and child pilot
evidence. It does not stage, upload or activate a release, and activation
rechecks the same ledgers after upload.

The review bundle is the immutable input to AI and human release review. After
those reviews and the exact audio release are current, build the live bundle
with a private, versioned evidence document:

```sh
node packages/content/tools/objective-pack.mjs bundle --all \
  --channel live --source-revision <git-sha> \
  --release-evidence <private-release-evidence.json> --out <live-release-dir>
node packages/content/tools/content-release.mjs validate <live-release-dir>
```

The evidence document uses schema `nexuslearn.content-release-evidence.v1` and
contains only immutable IDs and hashes: one AI review identity for every pack
payload, the human review-batch identity, the signed audio release/catalogue,
its supported licence and every required audio asset identity. Live bundle
creation fails when the file is absent, partial, stale, duplicated or bound to
a different pack/audio hash. Review and pilot bundles may omit evidence; if it
is supplied, the same validation applies. Offline `content-release validate`
repeats the check before any network request, and the API repeats it against
the authoritative database during activation.

Stage without activation:

```sh
node packages/content/tools/content-release.mjs publish <release-dir> \
  --api <api-url> --token <admin-session>
```

Activate only after review:

```sh
node packages/content/tools/content-release.mjs publish <release-dir> \
  --api <api-url> --token <admin-session> --activate
```

The manual GitHub workflow uses protected environments and serialises releases
per channel. Live activation must require repository-environment approval.

## Security and privacy

- The release API is administrator-only.
- Credentials are supplied through protected secrets and are never included in
  bundles or logs.
- Release-evidence documents reject credential-, token-, secret-, password- and
  transcript-shaped fields. They contain review identities, not review notes or
  the narration script bank.
- Pack chunks contain curriculum content, not learner data.
- Learner progress, SEND adaptations, attempts, mastery and selection remain
  server-side.
- Generated readiness reports are safe deploy artifacts, but the admin
  experience should prefer `/v1/admin/content/reports/{name}` so access,
  whitelisting and future storage changes remain backend-governed. Static
  `/content/*.json` files are a compatibility fallback, not the production
  ownership boundary.
- The public narration projection contains only approved reference-to-file
  aliases. Transcript banks, private manifest provenance, reviewer evidence and
  operational credentials never enter the pupil runtime contract.

## Consequences

- Developers can author and review content without changing Go source.
- Production has one auditable release identity tied to an exact Git revision.
- Large banks are uploaded in bounded chunks rather than one oversized request.
- A future object-store transport can replace HTTP chunk upload without
  changing the bundle contract or learner API.
- Existing per-item admin editing remains useful for review, but scheduled
  releases are the production source of truth.
