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
- variant-bank planning
- Year 1-7 coverage matrix
- next-pack production queue

This prevents curriculum packs from being accepted when they are missing
teaching sequence, manipulatives, misconception repair, adaptive support,
animation hooks, evidence language or variant planning.

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
  standard and calm states, with animations disabled before capture

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

## Remaining Hardening Before Production

- Enable GitHub branch protection so `main` requires green checks before merge.
  Current blocker: GitHub returned `Upgrade to GitHub Pro or make this
  repository public to enable this feature` for this private repository. Until
  the repo is public or on a paid plan, GitHub can run checks but cannot enforce
  branch protection on `main`.
- Expand visual regression from the flagship mission states to every released
  interaction renderer and high-contrast mode.
