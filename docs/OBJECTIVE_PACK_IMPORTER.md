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

Compile a pack into an admin payload:

```text
node packages/content/tools/objective-pack.mjs compile packages/content/packs/ma-y4-number-multiplication-12x12.pack.sample.json --out packages/content/generated
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

It also warns when the pack has fewer question variants than the pilot target.
That warning is expected for sample packs but should block real production
planning until variants are generated and reviewed.

## Current Limitations

- The importer generates one teaching activity per objective pack.
- It does not yet create content version rows or rollback snapshots.
- It does not yet upload art/audio assets.
- It does not yet create a browser-based preview.
- It does not yet validate against the JSON Schema with a full schema engine;
  it uses dependency-free structural validation suitable for the current repo.

## Next Build Step

The next iteration should add:

- content version records
- importer dry-run diff against live admin config
- browser preview of generated lesson steps
- asset manifest validation
- bulk pack import for a year/subject folder
- CI validation for every `*.pack.json`
