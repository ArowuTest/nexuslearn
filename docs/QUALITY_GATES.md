# Quality Gates

Status: active

This project should not rely on manual memory before production deployment.
Every meaningful change needs automated checks that fail visibly before a broken
commit reaches production.

## Current Automated Gates

### GitHub: Content quality

Runs on every push to `main` and every pull request. It is intentionally not
path-filtered, because branch protection should be able to require it for every
change without accidentally blocking unrelated commits where the workflow did
not run.

Checks:

- objective-pack validation for every authored pack
- Year 1-7 roadmap coverage
- equal-depth year specification
- honest curriculum-area breadth (90 declared core areas, mapped independently
  from the smaller proof-pack roadmap)
- variant-bank planning
- deterministic AI Curriculum Lead and AI SEND Lead review batches
- immutable review-ledger reconciliation and a zero-write backend import dry run
- Year 1-7 coverage matrix
- next-pack production queue

This prevents curriculum packs from being accepted when they are missing
teaching sequence, manipulatives, misconception repair, adaptive support,
animation hooks, evidence language or variant planning.

The curriculum-area gate also prevents the 87-pack proof roadmap from being
reported as complete curriculum coverage. It publishes the authored and missing
areas by year and subject, validates the next balanced production wave, and
fails if any year/subject loses its minimum proof representation or total
authored breadth regresses below the accepted baseline.

### GitHub: Platform quality

Runs on every push to `main` and every pull request.

Checks:

- Go formatting for the API
- API test suite
- API server build
- migration tool build
- frontend dependency install from lockfile
- frontend production build
- Chromebook-oriented production asset budgets:
  - per-route initial uncompressed JavaScript at or below 750,000 bytes;
  - aggregate emitted JavaScript at or below 1,400,000 bytes;
  - no JavaScript chunk above 250,000 bytes;
  - total emitted CSS at or below 120,000 bytes;
- no individual public asset above 600,000 bytes.
- every JavaScript chunk referenced by emitted static HTML or a route client
  reference manifest must exist in the built static map; missing references
  fail the gate, and the gate reports the number of HTML and manifest route
  evidence files it inspected.
- deterministic desktop and mobile visual snapshots for the flagship mission's
  standard and calm states, with animations disabled before capture. Desktop
  comparison remains tight; mobile allows additional pixel tolerance for
  Linux/Windows system-font substitution while still rejecting material layout,
  colour and missing-component changes. Mobile captures a fixed viewport rather
  than full-page height so font wrapping cannot change the image dimensions;
  semantic assertions still verify the prompt, controls and calm-state switch
  independently of the image comparison. The mobile ceiling is calibrated to
  observed Linux/Windows system-font drift; desktop remains at five percent.

This catches broken code, TypeScript/build errors and API regressions before a
deployment is trusted.

The 1,400,000-byte aggregate JavaScript ceiling is an explicitly approved
metric change from the earlier repository-wide total. It remains a secondary
repository-health cap for runaway dependency growth; it is not a claim that a
browser downloads all emitted route-isolated chunks. The 750,000-byte
per-route initial JavaScript ceiling is the user-facing payload boundary and
therefore remains the stricter release decision. Emitted static HTML extraction
is the authoritative cross-check for static routes, while client-reference
manifests cover route evidence that is not represented by static HTML.

### Deployment Checks

Vercel still performs its own frontend production deployment build after GitHub
receives a commit. The frontend `prebuild` hook now runs the content quality
suite before `next build`, so curriculum/content errors should fail Vercel
deployment rather than silently reaching the live web app. Render performs
backend deployment checks when API/backend changes are deployed.

Manual release verification should still check:

- latest GitHub workflows are green
- Vercel deployment is `READY`
- Render API `/healthz` returns `200`
- `/v1/version` returns the expected API version
- key child, parent, school and admin routes load

The platform workflow also applies every migration to disposable PostgreSQL 16
and runs desktop/mobile Playwright journeys for public, family, school, admin
and pupil-card entry. A separate deployment-smoke workflow waits for Render and
Vercel, then verifies API health, family-page availability and the anonymous
parent-evidence privacy boundary.

Renderer acceptance additionally checks particle models and sentence cards on
desktop and mobile for named screen-reader structures, keyboard operation and
critical/serious axe violations. Mission-level acceptance also covers the
visible focus ring, high-contrast and Simple text modes, plus one-switch
scanning, single-key selection and icon-supported Visual guide steps.

Array-building and audio-blend acceptance additionally verifies keyboard range
operation, semantic array descriptions and named phoneme/prompt replay controls.

The narration production gate inventories every curriculum `audio_script` and
every question-level `audio_asset_id`, `audio_ref` and `whole_audio_asset_id`,
requires technically valid produced MP3s and checksums before a pack can leave
authoring/review, prohibits browser TTS and unreviewed pure phonemes, and
publishes a human listening-review page. Variant assets are independently
registered and deduplicated by asset ID; a generated prompt fallback is labelled
in the manifest and is not treated as a dedicated narration script. Newly
authored review packs may report pending narration as an explicit warning while
they remain unavailable to the child runtime. Automated technical completion
does not impersonate listening approval. Listening decisions live in an
append-only, reviewer-attributed ledger and are valid only while their script,
audio, voice and model hashes still match the produced asset. The pupil runtime
resolves only technically valid, human-approved manifest assets; pending assets
remain available through the adult listening-review surface.
The `narration-listening-priority.json` report turns that large review backlog
into an ordered first-pass listening queue. It prioritises Year 1-2,
phonics/listening and high-impact referenced assets, and includes the exact
review commands needed to approve or reject an asset after human listening.

The exact Wave 3 audio release gate is separate from the legacy inventory
report. It consumes the private v2 manifest, its content-derived release and
catalogue identities, provider-terms licence and current listening ledger. It
fails closed for missing assets, unresolved aliases, specialist-required
recordings, invalid technical evidence, unapproved or stale listening
decisions, unsupported licences and any release/catalogue digest mismatch.
Diagnostics provide bounded samples and complete blocker counts by cause, year
and subject. The release snapshot allows promotion only when both the dual AI
review reconciliation and this exact audio gate are current; it never claims a
production release because independent safeguarding and real-child pilot
evidence remain API-enforced human gates.

Live API activation independently repeats the exact check against PostgreSQL.
It resolves the manifest and all required assets with bounded set queries,
matches transcript/audio/profile/identity hashes, requires technical success
and verifies the latest append-only listening decision. Legacy imported audio
rows without a recorded supported licence remain deliberately ineligible until
they are re-imported through the governed manifest path.

Pack depth is also a release gate, not a vanity metric. The generated
`pack-depth-readiness.json` report checks every Year 1-7 pack for minimum
teaching stages, manipulatives, practice formats, variant blueprints, authored
variants, animation states and adaptive/SEND supports. Its policy treats 180
variants as a pilot seed floor only; release, mature and deep targets remain
visible so the platform does not confuse a pilot pack with full curriculum
depth. Each pack carries an `accessibility_policy` covering no timed mastery,
no lost progress for mistakes, equivalent response routes, produced-audio
requirements and reduced-motion parity.

Pilot review promotion is evidence-led. The generated
`pilot-review-batch.json` report selects a balanced Year 1-7 first-pass review
batch from the production queue, while `pilot-review-evidence-template.json`
and its printable HTML companion define the human evidence record required for
each pack. A pack must not move review candidates into child runtime until the
template records curriculum accuracy, independent teacher review,
SEND/accessibility, safeguarding, renderer/accessibility acceptance, produced
audio listening where needed and pilot calibration evidence. The Admin
Readiness tab links directly to this operator template.
The `pilot-review-evidence-check.mjs` gate fails promotion-shaped evidence when
reviewers, review dates, candidate ids or required lane notes are missing, so
future hand-edited evidence cannot accidentally approve a pack by changing only
the top-level decision.

Generated report JSON files remain deploy artifacts for static smoke tests, but
the admin product should load approved readiness reports through
`/v1/admin/content/reports/{name}` where possible. That API whitelists report
names, preserves admin access control and keeps future report storage changes
behind the backend boundary instead of coupling operational screens directly to
public web assets.

### Verified AI review and backend reconciliation (8 August 2026)

The governed source projection currently contains 87 packs, 20,210 authored
review variants and 6,614 immutable review units. Both AI lanes have a current
decision for every unit: 13,228/13,228 decisions, zero missing, zero stale and
20,210/20,210 variants covered. These records may be described only as
`AI Curriculum Lead evidence` and `AI SEND Lead evidence`; they are not
independent teacher, SEND-specialist or safeguarding approval.

`import-ai-review-evidence.mjs --dry-run` verifies the batch self-hash, all seven
year-ledger revisions, the compact evidence index, exact unit identities and
stable idempotency keys before any API call. The measured dry run processed
13,228 records with zero malformed identities and zero writes. The release
snapshot reports `source_review_projection` separately from
`backend_release_state` and keeps `promotion_allowed` false whenever the API is
unavailable, revisions differ, coverage is incomplete or either lane has an
open gate.

Verified commands and results:

- review evidence, importer and release reconciliation tests: 14 passed;
- `npm run quality:content`: 87 packs and 20,210/20,210 variants covered;
- `go test ./... -count=1`: passed;
- `npm run lint`, `npm run quality:performance`, and `npm run build`: passed;
  the nine prior React lifecycle/dependency warnings are resolved with no lint
  suppression.
- Playwright: 48 family, learner, SEND, mock-evidence, renderer, keyboard and
  switch-access journeys passed across desktop and mobile, including WCAG
  scanning of the completed-check evidence view. Visual baselines now cover
  every currently released interaction contract (`choice_ready`,
  `choice_or_numeric_ready`, `model_sort_ready`, `numeric_ready` and
  `trace_ready`) in standard and high-contrast modes on desktop and mobile.
  The screenshot harness waits for cold mission loading and disables motion
  through a Shadow-DOM-aware stability stylesheet. Mission visual baselines
  remain a required GitHub check; each newly released renderer contract must
  add its baseline before registry promotion.
- Narration operations: the authenticated admin serves a live paginated queue
  across the complete 874-asset production manifest, with year, subject, type,
  status and text filters. Approval is disabled when playback fails; decisions
  remain append-only, idempotent and bound to current script/audio hashes. The
  queue joins latest review state in one bounded database query.

## Remaining Hardening Before Production

- Import the 13,228 verified source decisions into the deployed backend using a
  named review account, then run `content-release-snapshot.mjs --strict-backend`
  and retain the matching release artifact.
- Complete independent human safeguarding review, required human listening for
  all produced narration, and real-child pilot evidence. AI and technical gates
  cannot satisfy these release conditions.

- Enable GitHub branch protection so `main` requires green checks before merge.
  Current blocker: GitHub returned `Upgrade to GitHub Pro or make this
  repository public to enable this feature` for this private repository. Until
  the repo is public or on a paid plan, GitHub can run checks but cannot enforce
  branch protection on `main`.
