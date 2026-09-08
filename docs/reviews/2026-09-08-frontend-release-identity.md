# Exact frontend release verification

Date: 2026-09-08

## Observed failure

The pupil-route delivery `96fac8a3207406a77d38d3393f414684bd4ac5b4` passed
Content quality, Platform quality and Deployment smoke on GitHub. Render
already served that exact clean Go revision, but Vercel still served
`89bb4a7`: the new `/play/today` returned 404. The smoke validator checked the
API revision but only frontend HTTP availability. A working old family page
therefore masked an undeployed UI.

The existing Vercel project remained linked to ArowuTest/nexuslearn, main,
`apps/web`. No deployment of the new SHA existed. An exact-SHA production
deployment on that same project reached READY and acquired the existing
production alias. The cause of the missing automatic deployment was not
established; no settings or environment variables were changed.

Live desktop (1280px) and mobile (390px) browser checks then verified the
access-card entry, HTTP 200, no private pupil API requests, no page errors and
no horizontal overflow. This is an anonymous-entry smoke check, not a new
hosted authenticated four-role acceptance run.

## Remediation

- Add a public, build-generated `/api/version` response containing only
  `service`, `git_revision` and `git_revision_source`.
- Accept only a complete lowercase 40-character Vercel Git SHA. Missing,
  malformed or unrelated metadata cannot become a release identity.
- Preserve the version as a static deployment artifact. Changing a running
  server's environment must not relabel the already-built application.
- Require both exact revisions and `/play/today` availability in the existing
  bounded deployment poll. Retain all API contracts, private-report 404,
  anonymous parent-evidence 401 and public-audio guards.
- Keep all requests unauthenticated, bounded and non-redirecting. Fixed problem
  labels, not arbitrary response bodies, enter logs.
- Add CI coverage that builds with the tested commit and serves with a different
  runtime SHA, alongside the existing Linux browser and real-backend checks.

The provider's build SHA is provenance metadata, not a cryptographic attestation
of the source tree. Provider deployment metadata and alias checks remain part of
release verification.

## Local evidence

- Five smoke-validator regressions reproduced the false pass before the fix.
- Two desktop/mobile HTTP checks failed with the expected 404 before the new
  endpoint existed.
- A malformed-provider regression failed before strict SHA validation.
- The corrected smoke validator passes all 16 tests; all 11 web
  identity/session/chunk-boundary tests pass.
- Production build, TypeScript, scoped ESLint and the five performance-budget
  tests pass. Aggregate JavaScript is 1,424,860 / 1,430,000 bytes, largest route
  694,912 / 750,000; no budget or baseline was relaxed.
- All 118 focused desktop/mobile checks pass: build identity, personal pupil
  routes across Years 1-7 and mission integrity. The build contained synthetic
  revision `aaaa...`; the test server received `bbbb...` and still returned
  the original build identity. These fixture values are not deployed revisions.
- The preceding pupil delivery's GitHub suite passed 316 browser checks and
  six real API/PostgreSQL browser checks. The follow-on delivery must obtain its
  own hosted verification; prior success is not substituted for that result.

One bounded, read-only independent review found no blocking issues. The reviewer
did not run the build or hosted checks; those are recorded separately above.
The HTTP pupil probe establishes availability only: a 200-status error page,
failed hydration or broken assets still require the browser journeys and live
browser verification. The reviewer was closed after returning.

No curriculum, learner record, narration asset, listening approval, professional
SEND review or pilot acceptance is changed by this patch.
