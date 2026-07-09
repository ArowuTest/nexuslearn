# Objective Pack Importer

Status: Phase 3.6 foundation  
Purpose: validate rich curriculum packs and promote them into admin-configured
runtime content without manual copy-paste.

## Why This Exists

NexusLearn content should be authored as rich objective packs first. A pack
contains source alignment, teaching sequence, manipulatives, question variants,
misconception repairs, adaptive supports, animation hooks, evidence rules and QA
state.

The importer turns that authored pack into the platform's current admin API
shape:

- curriculum objective
- teaching activity
- question variants
- reward rule
- readiness-report seed metadata

This keeps curriculum production structured while the database content model is
still evolving.

## Commands

Validate one or more packs:

```text
node packages/content/tools/objective-pack.mjs validate packages/content/packs/ma-y4-number-multiplication-12x12.pack.sample.json
```

Validate every pack in `packages/content/packs`:

```text
node packages/content/tools/objective-pack.mjs validate --all
```

Treat warnings as failures for CI/content release checks:

```text
node packages/content/tools/objective-pack.mjs validate --all --strict
```

Compile a pack into an admin payload:

```text
node packages/content/tools/objective-pack.mjs compile packages/content/packs/ma-y4-number-multiplication-12x12.pack.sample.json --out packages/content/generated
```

Generate a static reviewer preview:

```text
node packages/content/tools/objective-pack.mjs preview packages/content/packs/ma-y4-number-multiplication-12x12.pack.sample.json --out packages/content/generated/previews
```

Dry-run a pack against live admin configuration:

```text
node packages/content/tools/objective-pack.mjs diff packages/content/packs/ma-y4-number-multiplication-12x12.pack.sample.json --api https://nexuslearn-api.onrender.com --admin-key <ADMIN_API_KEY>
```

Publish a validated pack through the protected admin API:

```text
node packages/content/tools/objective-pack.mjs publish packages/content/packs/ma-y4-number-multiplication-12x12.pack.sample.json --api https://nexuslearn-api.onrender.com --admin-key <ADMIN_API_KEY>
```

The publish command calls existing API endpoints:

- `PUT /v1/admin/curriculum/objectives/{id}`
- `PUT /v1/admin/content/activities/{id}`
- `PUT /v1/admin/content/questions/{id}`
- `PUT /v1/admin/reward-rules/{id}`

The preview command creates an HTML review page for curriculum and product
reviewers. It shows validation warnings, source alignment, teaching journey,
animation hooks, manipulatives, adaptive support, question variants and the
generated admin payload summary without touching the live app.

Validate the Year 1-7 roadmap coverage:

```text
node packages/content/tools/roadmap-check.mjs
```

The roadmap check requires Year 1 to Year 7 coverage, unique pack IDs, valid
source IDs and Mathematics, English and Science priority packs for every year.
The GitHub `Content quality` workflow runs this check alongside objective-pack
validation.

Validate equal product depth for every year:

```text
node packages/content/tools/year-spec-check.mjs
```

Summarise and validate planned variant-bank volume:

```text
node packages/content/tools/variant-bank-plan.mjs
```

The variant-bank plan checks that every objective pack has serious pilot,
release and mature targets, that blueprint counts reach the mature target, and
that every required practice format has planned coverage.

Generate the Year 1-7 coverage matrix:

```text
node packages/content/tools/coverage-matrix.mjs --out packages/content/generated/coverage
```

The coverage matrix compares the roadmap against authored packs. It shows, for
each year and core subject, whether the pack is only planned or already exists
as a rich proof pack with a generated payload, preview and variant-bank plan.

Generate the next-pack production queue:

```text
node packages/content/tools/production-queue.mjs --out packages/content/generated/coverage
```

The production queue ranks missing roadmap packs by subject coverage gap, year
balance, target status and roadmap priority. It also writes a reviewer HTML
report showing the next balanced batch and the expected interaction/animation
standard for each missing pack.

Once all roadmap pack files exist, generate the reviewed-variant depth queue:

```text
node packages/content/tools/variant-production-queue.mjs
```

This reports authored variants, runtime-approved variants, candidates awaiting
review, the remaining pilot review gap and a balanced next batch across Years
1-7. It does not confuse a blueprint target with delivered content.

Validate authored item quality:

```text
node packages/content/tools/variant-quality.mjs
```

The quality gate checks duplicate IDs, duplicate prompt/answer/format
signatures, arithmetic consistency for supported mathematical formats,
required-format coverage, repeated hints and review-batch provenance. JSON and
HTML reports are written to `packages/content/generated/coverage`, and the JSON
reports are copied into the admin readiness dashboard.

Generate the current Year 4 multiplication flagship review bank
deterministically:

```text
node packages/content/tools/generate-y4-multiplication-bank.mjs --write
```

Generated candidates are deliberately marked `review`. They carry
`variant_blueprint_id` and `review_batch` metadata inside the question body and
cannot enter child missions until curriculum, teacher and accessibility review
promotes them to an approved runtime status.

The other flagship bank generators follow the same rule:

```text
node packages/content/tools/generate-y1-phonics-bank.mjs --write
node packages/content/tools/generate-y7-particle-bank.mjs --write
```

Use `--check` instead of `--write` in CI. The Year 1 generator uses a curated
100-word, single-letter CVC set to produce 300 audio-blend, middle-vowel choice
and word-building tasks. Every task requires SSP progression mapping and
produced phoneme audio before pilot. The Year 7 generator produces state-model,
energy-control and misconception-explanation candidates while explicitly
preserving particle identity, count and size.

Generate the structured internal review ledger:

```text
node packages/content/tools/flagship-review.mjs
```

The ledger records item-level internal curriculum, product, technical,
accessibility-contract and safeguarding-content checks. It deliberately keeps
these separate from independent classroom-teacher review, produced-audio QA,
child usability testing and pilot calibration. Passing internal review does not
change a question to runtime-approved status.

Validate child renderer readiness:

```text
node packages/content/tools/renderer-readiness.mjs --out packages/content/generated/coverage
```

The renderer-readiness gate checks every interaction format used by authored
packs against `packages/content/roadmaps/interaction-renderer-registry.json`.
It fails when an approved, published or live question uses a format that does
not yet have a concrete child-runtime contract. This lets the curriculum team
author ambitious interactions early while keeping unfinished builders,
simulations, table inputs and rubric-scored tasks in review until the renderer,
scoring and accessibility paths are complete.

Validate asset production readiness:

```text
node packages/content/tools/asset-manifest-check.mjs --out packages/content/generated/coverage
```

The asset-manifest gate checks
`packages/content/roadmaps/asset-production-manifest.json` for produced-art,
animation, narration and manipulative asset coverage. It requires every runtime
asset family to be at least prototype status, every year to have asset-family
coverage, and every family to carry reduced-motion, low-sensory, labelling and
Chromebook-budget accessibility commitments.

Audit produced narration and question-level audio references:

```text
node packages/content/tools/narration-readiness.mjs
node packages/content/tools/narration-readiness.mjs --strict
```

The default command writes deterministic JSON/HTML reports without blocking
authoring while production is incomplete. `--strict` is the release gate: it
fails for missing, stale, invalid, duplicate, orphaned or unreviewed narration,
and for unresolved or nonconforming question-level audio references. Technical
MP3 validation never substitutes for human listening approval.

Human listening decisions are stored in the append-only
`packages/content/audio/narration-listening-reviews.json` ledger. First inspect
the queue, then record a decision against the exact produced asset:

```text
node packages/content/tools/narration-review.mjs
node packages/content/tools/narration-review.mjs --asset <asset-id> --decision approve --reviewer "<name>" --confirm natural,clear,pronunciation,age_suitable --notes "<optional evidence>"
node packages/content/tools/narration-review.mjs --asset <asset-id> --decision reject --reviewer "<name>" --notes "<required correction>"
```

An approval is bound to the script hash, MP3 hash, voice and model. Changing or
regenerating any of them makes the approval stale and returns the asset to the
review queue. The tool never bulk-approves audio and never infers a human
decision from automated format checks. Add `--dry-run` to validate a proposed
decision without writing it to the ledger.

Plan an ElevenLabs narration run without making API calls or changing the live
manifest:

```text
node packages/content/tools/produce-narration.mjs --dry-run
```

Production requires `ELEVENLABS_API_KEY` in the process environment. Existing
audio is reusable only when its manifest text hash, voice, model and output path
still match the authored script. A changed script or voice therefore regenerates
audio instead of silently attaching stale speech to current content.
Safe resumable batches can be scoped with `--year 1`, `--pack <pack-id>`,
`--only lessons|vocabulary` and `--limit <count>`. Filtered runs merge their
results into the complete valid production inventory; they never replace the
manifest with only the selected subset. A voice or model migration must run
against the complete inventory; the producer refuses a filtered mixed-voice
manifest.

The authoritative internal manifest retains script and file hashes. Its public
web copy is deliberately reduced to runtime-safe identity, URL, status and
technical-pass fields so production metadata does not become a large client
asset.

Generate a content release snapshot:

```text
node packages/content/tools/content-release-snapshot.mjs --out packages/content/generated/coverage
```

The release snapshot hashes each authored pack, generated admin payload and
reviewer preview against `packages/content/roadmaps/content-release-policy.json`.
It gives the product team deterministic rollback evidence and keeps Phase 3
proof packs in the `authoring` channel until teacher, accessibility,
safeguarding, pilot and item-bank requirements are explicitly met.

The original Phase 3 proof-pack set completed a 29-pack core spine and included
Mathematics, English and Science representation for every year. The live
roadmap has since expanded to 87 packs; this original importer example remains
useful as the baseline set:

- Year 1: `en-y1-phonics-blend-cvc-words`
- Year 1: `en-y1-phonics-form-lowercase-letters`
- Year 1: `ma-y1-number-counting-within-100`
- Year 1: `sc-y1-plants-identify-common`
- Year 2: `en-y2-reading-fluency-reread`
- Year 2: `en-y2-writing-sentence-punctuation`
- Year 2: `ma-y2-number-add-subtract-two-digit`
- Year 2: `sc-y2-materials-suitability`
- Year 3: `en-y3-writing-paragraph-grouping`
- Year 3: `ma-y3-number-fractions-tenths`
- Year 3: `ma-y3-number-recall-3-4-8-tables`
- Year 3: `sc-y3-plants-functions`
- Year 4: `en-y4-writing-fronted-adverbials`
- Year 4: `ma-y4-measure-area-rectangles`
- Year 4: `ma-y4-number-multiplication-12x12`
- Year 4: `sc-y4-electricity-simple-circuits`
- Year 5: `en-y5-reading-inference-evidence`
- Year 5: `ma-y5-number-decimals-percentages`
- Year 5: `ma-y5-number-fractions-equivalence`
- Year 5: `sc-y5-earth-space-models`
- Year 6: `en-y6-reading-inference-justify`
- Year 6: `en-y6-writing-cohesion-devices`
- Year 6: `ma-y6-arithmetic-multi-step`
- Year 6: `ma-y6-ratio-proportion-scale`
- Year 6: `sc-y6-light-shadows-explain`
- Year 7: `en-y7-literature-evidence-inference`
- Year 7: `ma-y7-algebra-simplify-expressions`
- Year 7: `ma-y7-ratio-proportion-tables`
- Year 7: `sc-y7-particles-states-of-matter`

The generated coverage matrix currently reports 87 roadmapped packs, 87
authored packs, no missing roadmap packs and 143,040 planned mature-bank
variants. The authored banks contain 20,210 variants and meet all 87 numeric
pilot targets. Those figures describe authored depth, not release approval:
teacher/SEND/safeguarding review, runtime promotion, produced-and-listened audio,
child usability evidence and pilot calibration remain separate gates.

## Status Mapping

Pack status controls whether children can see the generated activity.

- `draft` -> draft activity
- `review` -> review activity
- `pilot` -> approved activity
- `approved` -> approved activity
- `published` -> published activity
- `archived` -> archived activity

Learner runtime only serves `approved`, `published` or `live` activities.
Therefore draft and review packs can be safely imported for admin review without
being exposed to children.

Files named `*.sample.*` are protected from accidental publish. To publish a
sample intentionally, pass `--allow-sample`; production content should usually be
renamed to `*.pack.json` after review instead.

## Validation Rules

The importer currently checks:

- required top-level pack sections
- known official source IDs
- Year 1-7 range
- objective statement, prerequisites, misconceptions and mastery model
- teaching sequence depth
- manipulative presence
- misconception repair paths
- question variant shape
- required format coverage
- animation hooks
- adaptive support fields
- pilot/approved/published packs have at least three runtime-approved variants
- serious variant target minimums: 150 pilot, 300 release and 500 mature
- variant blueprint coverage against mature targets and required formats
- folder-wide validation using `--all`
- Year 1-7 roadmap coverage validation
- equal-depth Year 1-7 experience validation
- strict mode using `--strict`
- sample-pack publish protection
- static HTML reviewer previews
- production queue generation for remaining roadmap packs, currently empty for
  the Phase 3 core roadmap because all 87 proof packs exist
- reviewed-variant production queue generation even when no roadmap packs are
  missing
- deterministic duplicate, arithmetic and required-format quality checks

It also warns when the pack's hand-authored sample variants are fewer than the
pilot target. That warning is expected for sample packs, but real production
planning must use the variant blueprint totals to show how the reviewed bank
will reach hundreds or thousands of variants without manual copy-paste.

## Live Diff

`diff` reads `/v1/admin/config` and compares generated payloads against current
admin configuration. It prints `create`, `update` or `unchanged` for:

- objective
- activity
- each question
- reward rule

Use this before `publish` so reviewers can see what the importer would change.

## Current Limitations

- The importer generates one teaching activity per objective pack.
- Direct `publish` remains a legacy per-item review convenience. Production
  releases should use `bundle` plus `content-release.mjs`, which provides
  immutable manifests, bounded pack chunks and transactional activation.
- It does not yet upload art/audio assets.
- It does not yet validate against the JSON Schema with a full schema engine;
  it uses dependency-free structural validation suitable for the current repo.
- Live diff compares generated fields only; it does not yet show a pretty
  field-by-field patch.

## Next Build Step

The next iteration should add:

- object-storage transport for large release artifacts while preserving the
  current signed bundle contract
- field-by-field dry-run patch output
- browser preview of generated lesson steps
- asset manifest validation
- CI validation for every `*.pack.json`
- automatic production-queue links inside the admin readiness dashboard
