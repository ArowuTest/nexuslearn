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

The current Phase 3 proof-pack set includes two rich samples per year:

- Year 1: `en-y1-phonics-blend-cvc-words`
- Year 1: `ma-y1-number-counting-within-100`
- Year 2: `en-y2-writing-sentence-punctuation`
- Year 2: `ma-y2-number-add-subtract-two-digit`
- Year 3: `ma-y3-number-fractions-tenths`
- Year 3: `sc-y3-plants-functions`
- Year 4: `ma-y4-number-multiplication-12x12`
- Year 4: `sc-y4-electricity-simple-circuits`
- Year 5: `en-y5-reading-inference-evidence`
- Year 5: `ma-y5-number-fractions-equivalence`
- Year 6: `ma-y6-ratio-proportion-scale`
- Year 6: `en-y6-reading-inference-justify`
- Year 7: `ma-y7-algebra-simplify-expressions`
- Year 7: `sc-y7-particles-states-of-matter`

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
- production queue generation for remaining roadmap packs

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
- It does not yet create content version rows or rollback snapshots.
- It does not yet upload art/audio assets.
- It does not yet validate against the JSON Schema with a full schema engine;
  it uses dependency-free structural validation suitable for the current repo.
- Live diff compares generated fields only; it does not yet show a pretty
  field-by-field patch.

## Next Build Step

The next iteration should add:

- content version records
- field-by-field dry-run patch output
- browser preview of generated lesson steps
- asset manifest validation
- CI validation for every `*.pack.json`
- automatic production-queue links inside the admin readiness dashboard
