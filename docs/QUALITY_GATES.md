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
- Year 1-7 coverage matrix
- next-pack production queue

This prevents curriculum packs from being accepted when they are missing
teaching sequence, manipulatives, misconception repair, adaptive support,
animation hooks, evidence language or variant planning.

The curriculum-area gate also prevents the 68-pack proof roadmap from being
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
  - total emitted JavaScript at or below 1.2 MB;
  - no JavaScript chunk above 250 KB;
  - total emitted CSS at or below 120 KB;
- no individual public asset above 600 KB.
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

The narration production gate inventories every curriculum `audio_script`,
requires technically valid produced MP3s and checksums before a pack can leave
authoring/review, prohibits browser TTS and unreviewed pure phonemes, and
publishes a human listening-review page. Newly authored review packs may report
pending narration as an explicit warning while they remain unavailable to the
child runtime. Automated technical completion does not impersonate listening
approval.

## Remaining Hardening Before Production

- Enable GitHub branch protection so `main` requires green checks before merge.
  Current blocker: GitHub returned `Upgrade to GitHub Pro or make this
  repository public to enable this feature` for this private repository. Until
  the repo is public or on a paid plan, GitHub can run checks but cannot enforce
  branch protection on `main`.
- Expand visual regression from the flagship mission states to every released
  interaction renderer and high-contrast mode.
