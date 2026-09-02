# Wave 3 Audio Release Operations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver deterministic, deduplicated and backend-governed production, review and release operations for every eligible NexusLearn narration reference.

**Architecture:** Compile authored pack references into a canonical catalogue, produce immutable audio identities from transcript and production-profile hashes, and import those identities into bounded backend review and release operations. Keep the learner manifest minimal and fail closed unless the exact produced identity has current technical and human listening evidence.

**Tech Stack:** Node.js ES modules and `node:test`, Go 1.24 HTTP/PostgreSQL API, Next.js 16/React 19/TypeScript, Playwright, SHA-256 content identities.

**Spec:** `docs/superpowers/specs/2026-08-29-wave-3-audio-release-operations-design.md`

## Global Constraints

- Human listening, safeguarding and real-child pilot gates remain independent and fail closed.
- Pure phonemes and SSP-sensitive speech require specialist production and review.
- Provider credentials must never enter source, generated artefacts, browser responses or FS V2B memory.
- Work in substantial local chunks and stage only exact intended files.
- Every production behaviour change follows a witnessed red-green-refactor cycle.
- Queue reads and batch writes are bounded, role-scoped and idempotent.
- Non-audio and reduced-sensory routes remain complete equivalents.

---

### Task 1: Deterministic variant-audio catalogue

**Files:**
- Create: `packages/content/tools/lib/variant-audio-catalog.mjs`
- Create: `packages/content/tools/lib/variant-audio-catalog.test.mjs`
- Create: `packages/content/tools/variant-audio-catalog.mjs`
- Modify: `apps/web/package.json`

**Interfaces:**
- Produces: `buildVariantAudioCatalog(packs, productionProfile)` returning `{version, catalogue_id, totals, assets, references, blockers}`.
- Produces: `extractVariantAudioReferences(pack)` returning normalised source bindings.
- Produces: `canonicalJSONStringify(value)` and `productionIdentity(input)` for stable identities.
- Consumes: objective-pack `question_variants` and the existing narration fallback rules.

- [x] **Step 1: Write failing deterministic-identity tests**

Cover stable output under reordered input, transcript/profile deduplication,
conflicting reference IDs, source occurrence aggregation, specialist phoneme
classification and absence of secret-shaped fields.

- [x] **Step 2: Run the focused test and witness RED**

Run: `node --test packages/content/tools/lib/variant-audio-catalog.test.mjs`

Expected: FAIL because `variant-audio-catalog.mjs` does not exist.

- [x] **Step 3: Implement the minimal pure compiler**

Use SHA-256 over recursively key-sorted JSON. Keep filesystem and environment
access outside the library. Return deterministically sorted arrays and throw a
descriptive conflict error containing both source locations.

- [x] **Step 4: Run the focused test and witness GREEN**

Run: `node --test packages/content/tools/lib/variant-audio-catalog.test.mjs`

Expected: all catalogue tests pass.

- [x] **Step 5: Add the filesystem CLI and content-gate command**

The CLI reads all pack JSON, builds with the explicit checked-in production
profile, writes only when `--write` is supplied, and otherwise compiles and
validates without mutating the workspace. Add
`quality:variant-audio-catalog` and invoke it from `quality:content`.

- [x] **Step 6: Verify the real inventory**

Run: `node packages/content/tools/variant-audio-catalog.mjs --summary`

Expected: every non-empty reference is bound or explicitly blocked; totals and
deduplication are printed without generating audio or needing credentials.

### Task 2: Manifest v2 and canonical production reuse

**Files:**
- Modify: `packages/content/tools/produce-narration.mjs`
- Create: `packages/content/tools/lib/narration-manifest.test.mjs`
- Create: `packages/content/audio/variant-audio-catalog.json`
- Modify: `packages/content/audio/narration-manifest.json` only through the governed generator
- Modify: `apps/web/public/content/narration-manifest.json` only through the governed generator

**Interfaces:**
- Consumes: Task 1 `assets` and `references`.
- Produces: manifest v2 `production_profile_sha256`, `catalogue_id`, canonical asset items and reference aliases.

- [x] **Step 1: Write failing manifest migration and reuse tests**

Assert canonical paths, exact profile hashing, alias preservation, stale-file
exclusion, no credentials in private/public JSON, and safe migration from the
v1 base narration manifest.

- [x] **Step 2: Run tests and witness RED**

Run: `node --test packages/content/tools/lib/narration-manifest.test.mjs`

- [x] **Step 3: Extract manifest construction into a pure tested module**

The producer performs network and filesystem effects; the module validates and
constructs identities without effects. A filtered run must reject profile
changes and preserve only byte-verified reusable assets.

- [ ] **Step 4: Integrate canonical assets and aliases into production**

Produce one MP3 per production identity. Do not call ElevenLabs during tests or
catalogue checks. `--dry-run` reports selected references, unique production
assets, estimated characters and reuse savings.

- [x] **Step 5: Verify migration without credentials**

Run: `node packages/content/tools/produce-narration.mjs --only variants --dry-run`

Expected: deterministic plan, no network request, no manifest mutation.

### Task 3: Backend manifest validation and bounded review model

**Files:**
- Modify: `apps/api/internal/server/narration_reviews.go`
- Modify: `apps/api/internal/server/narration_reviews_test.go`
- Modify: `apps/api/internal/learning/narration_reviews.go`
- Modify: `apps/api/internal/learning/narration_reviews_test.go`
- Modify: `apps/api/internal/database/migrate.go`
- Create: `apps/api/internal/database/narration_manifest_v2_migration_test.go`

**Interfaces:**
- Consumes: manifest v2 canonical assets and aliases.
- Produces: bounded queue rows with profile hash, reuse count and exact stale-state calculation.
- Produces: idempotent review decisions bound to text, audio and profile hashes.

- [x] **Step 1: Write failing Go contract and migration tests**

Test v2 validation, alias resolution, unsupported version rejection, profile
change staleness, bounded pagination, role enforcement and idempotency replay
versus payload conflict.

- [x] **Step 2: Run focused Go tests and witness RED**

Run: `go test ./internal/server ./internal/learning ./internal/database`

Working directory: `apps/api`

- [x] **Step 3: Implement schema and repository changes**

Add immutable profile-hash binding while preserving historical review rows.
Use indexed manifest asset/reference columns or bounded import tables; never
scan all reviews once per request.

- [x] **Step 4: Implement v2 parser and bounded queue**

Reject incomplete hashes, duplicate aliases, unsupported schema versions and
unsafe file URLs. Return safe metadata only.

- [x] **Step 5: Run focused and complete Go tests**

Run: `go test ./...`

Working directory: `apps/api`

### Task 4: Production import and regeneration operations

**Files:**
- Create: `apps/api/internal/learning/audio_operations.go`
- Create: `apps/api/internal/learning/audio_operations_test.go`
- Create: `apps/api/internal/server/audio_operations.go`
- Create: `apps/api/internal/server/audio_operations_test.go`
- Modify: `apps/api/internal/server/server.go`
- Modify: `apps/api/internal/database/migrate.go`

**Interfaces:**
- Produces: `POST /v1/admin/audio/manifests/import` with idempotency.
- Produces: `POST /v1/admin/audio/assets/{id}/rerecord-request` with immutable audit event.
- Produces: bounded batch outcome `{accepted, rejected, replayed, errors}`.

- [x] **Step 1: Write failing import, permission and retry tests**

Assert exact content identity, payload conflict, role boundary, batch maximum,
transaction rollback for malformed manifests, and safe retry of partial
production operations.

- [x] **Step 2: Witness RED with focused Go tests**

- [x] **Step 3: Implement minimal repository and HTTP operations**

Store no provider key. Preserve prior manifests and decisions. Emit audit
events containing safe IDs and hashes only.

- [x] **Step 4: Witness GREEN and run `go test ./...`**

### Task 5: Admin listening and regeneration workspace

**Files:**
- Create: `apps/web/src/components/admin/AdminAudioWorkspace.tsx`
- Create: `apps/web/src/lib/admin-audio.ts`
- Modify: `apps/web/src/app/admin/page.tsx`
- Modify: `apps/web/src/components/admin/AdminNavigation.tsx`
- Modify: `apps/web/src/components/admin/adminSectionModel.ts`
- Create: `apps/web/tests/e2e/admin-audio-workspace.spec.ts`

**Interfaces:**
- Consumes: paginated queue, review-save and rerecord endpoints.
- Produces: role-scoped playback/review UI with URL-synchronised filters and bounded pagination.

- [x] **Step 1: Write failing Playwright journey**

Cover sign-in boundary, filter restoration, exact transcript/audio binding,
approval criteria, structured rejection, stale warning, re-record request,
keyboard operation and narrow viewport.

- [x] **Step 2: Witness RED in desktop Chromium**

Run: `npx playwright test tests/e2e/admin-audio-workspace.spec.ts --project=desktop-chromium`

Working directory: `apps/web`

- [x] **Step 3: Implement API client and focused workspace**

Use semantic controls and native audio playback. Display profile identity,
reuse count, technical state and human state separately. Require all approval
criteria and a reviewer name; require reasons or notes on rejection.

- [x] **Step 4: Witness GREEN on desktop and mobile Chromium**

### Task 6: Exact release gate and full verification

**Files:**
- Modify: `packages/content/tools/narration-readiness.mjs`
- Modify: `packages/content/tools/content-release-snapshot.mjs`
- Modify: `packages/content/tools/content-release-snapshot.test.mjs`
- Modify: `apps/api/internal/learning/content_release.go`
- Modify: `apps/api/internal/learning/content_release_test.go`
- Modify: `docs/ADR_CONTENT_RELEASE_ARCHITECTURE.md`
- Modify: `docs/QUALITY_GATES.md`

**Interfaces:**
- Consumes: catalogue ID, manifest release ID and current listening evidence.
- Produces: fail-closed release readiness with explicit blocker counts by year, subject and cause.

- [ ] **Step 1: Write failing release-gate tests**

Test missing, unresolved, specialist-required, stale, technically invalid,
unapproved and unsupported-licence identities, plus a completely current
review/pilot fixture.

- [ ] **Step 2: Witness RED with Node and Go focused tests**

- [ ] **Step 3: Implement exact release binding and diagnostics**

Review and pilot reports may expose blockers; live activation rejects them.
Runtime status never exposes transcript banks or operational credentials.

- [ ] **Step 4: Run the complete verification matrix**

Run from `apps/web`: `npm run lint`, `npx tsc --noEmit`, `npm run quality:content`,
`npm run quality:performance`, `npm run build`, and `npm run test:e2e`.

Run from `apps/api`: `go test ./...`.

- [ ] **Step 5: Inspect exact diff, update FS V2B and commit one coherent wave**

Record commands, exit codes, test counts, branch and HEAD. Stage exact intended
paths; exclude `.agent`, generated reports, local build metadata and secrets.
