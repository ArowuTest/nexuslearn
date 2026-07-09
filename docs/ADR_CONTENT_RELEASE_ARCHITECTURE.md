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

If validation or any write fails, PostgreSQL rolls back the whole activation.
The previous release remains active.

Applied releases retain their verified pack chunks. A superseded live release
can therefore be reactivated through the same activation endpoint to perform a
transactional rollback; the currently applied release becomes superseded only
after the older snapshot has been restored successfully.

## Operational workflow

Build and verify locally:

```sh
node packages/content/tools/objective-pack.mjs bundle --all \
  --channel review --source-revision <git-sha> --out <release-dir>
node packages/content/tools/content-release.mjs validate <release-dir>
```

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
- Pack chunks contain curriculum content, not learner data.
- Learner progress, SEND adaptations, attempts, mastery and selection remain
  server-side.
- Generated readiness reports are safe deploy artifacts, but the admin
  experience should prefer `/v1/admin/content/reports/{name}` so access,
  whitelisting and future storage changes remain backend-governed. Static
  `/content/*.json` files are a compatibility fallback, not the production
  ownership boundary.

## Consequences

- Developers can author and review content without changing Go source.
- Production has one auditable release identity tied to an exact Git revision.
- Large banks are uploaded in bounded chunks rather than one oversized request.
- A future object-store transport can replace HTTP chunk upload without
  changing the bundle contract or learner API.
- Existing per-item admin editing remains useful for review, but scheduled
  releases are the production source of truth.
