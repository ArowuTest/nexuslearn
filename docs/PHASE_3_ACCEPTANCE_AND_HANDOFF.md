# Phase 3 Acceptance and Phase 4 Handoff

Status: Phase 3A platform foundation accepted; Phase 3.7 learning foundation active

## Phase 3 Outcome

Phase 3 now provides a configurable, persistent and access-controlled platform
foundation. It is no longer a public multiplication demo or a Year 4-only
prototype. The runtime, administration and content pipeline are structured for
Years 1-7, multiple subjects, schools, tutoring organisations and direct
families.

Identity, parent-child privacy, content release control and deployment quality
gates are accepted as the Phase 3A platform foundation. Curriculum scale remains
blocked until the child-facing learning and SEND gates in
`docs/PHASE_3_7_LEARNING_FOUNDATION.md` are complete.

## Accepted Capabilities

### Identity and access

- Named platform administrator, content editor and content reviewer accounts.
- Bcrypt password storage for new accounts, with upgrade-on-login support for
  earlier development hashes.
- Revocable database-backed bearer sessions for platform, school and parent
  users.
- Explicit logout and server-side revocation.
- School-scoped school-admin and teacher roles.
- Parent-scoped child evidence and child profile management.
- HMAC-signed pupil sessions and configurable mandatory enforcement.
- Legacy password/key headers isolated behind
  `ALLOW_LEGACY_CREDENTIAL_HEADERS`.

### Parent invitations

- Platform-admin invitation creation for an existing learner.
- Parent, guardian and carer relationships.
- 72-hour default expiry.
- One-time token hashing; raw invitation tokens are never stored.
- Mark-sent, token-rotating resend, revoke and accept operations.
- Invitation acceptance activates the parent-child link and creates a parent
  session.
- Every lifecycle operation writes an audit event.
- Delivery is provider-neutral. Until an email provider is configured, the
  admin console exposes a one-time URL for an approved manual channel.

### Content governance

- Version snapshots for curriculum objectives, worlds, activities, questions
  and reward rules.
- Field-level nested diff paths in the admin console.
- Guarded restore that creates a fresh version and audit trail.
- Explicit progression:
  `draft -> review -> pilot -> approved -> published -> live`.
- Content editors cannot approve; publishing, live release and archival require
  platform-admin authority when named sessions are used.
- CLI rollback by content-version UUID.
- CLI publish/diff supports named bearer sessions as the preferred
  authentication method.
- Renderer, asset-manifest and release-snapshot gates remain part of every
  production web build.

### Configuration and hardcode closure

- Public demo learner access requires both an enabled feature flag and an
  explicitly configured `NEXT_PUBLIC_DEMO_STUDENT_ID`.
- There is no implicit `alex-demo` production fallback.
- Missing world configuration is displayed as unavailable rather than replaced
  by hardcoded child profiles.
- Public learning remains behind pupil, parent or school access by default.
- Runtime worlds, curriculum, activities, questions, reward rules, feature
  flags, schools, classes, groups and learner support profiles are
  database-configured.

### Automated evidence

- Go formatting, tests and server/migration builds in GitHub Actions.
- All migrations applied to disposable PostgreSQL 16 in CI.
- Full frontend production build and curriculum/content gates.
- Playwright smoke journeys on desktop Chromium and a mobile Pixel viewport:
  public entry, family/invitation, school workspace, named admin login and pupil
  card login.
- Post-deployment checks wait for Render and Vercel, then verify API health,
  family-page availability and the protected parent-evidence boundary.

## Route and Permission Matrix

| Route family | Platform admin | Reviewer | Editor | School admin | Teacher | Parent | Pupil |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `/v1/admin/platform-users` | manage | no | no | no | no | no | no |
| admin content draft/edit | manage | manage | manage | no | no | no | no |
| content approval | manage | approve | no | no | no | no | no |
| publish/live/archive | manage | no | no | no | no | no | no |
| `/v1/admin/schools/*` | manage | no | no | no | no | no | no |
| `/v1/school/*` | no | no | no | own school | scoped groups | no | no |
| `/v1/parent/*` | no | no | no | no | no | linked children | no |
| learner evidence | operational | no | no | future | future | linked endpoint | own session |
| mission runtime | configure | review | author | no | no | no | own session |

## Environment Contract

Required for the deployed API:

- `DATABASE_URL`
- `ACCOUNT_SESSION_SECRET`
- `PUPIL_SESSION_SECRET`
- `REQUIRE_PUPIL_SESSION=true`
- `ALLOW_LEGACY_CREDENTIAL_HEADERS=false` after the first named platform admin
  is created
- `ADMIN_API_KEY` only during bootstrap migration, then rotate or remove
- `PUBLIC_WEB_URL=https://nexuslearn-woad.vercel.app`

Required for the deployed web app:

- `NEXT_PUBLIC_API_URL=https://nexuslearn-api.onrender.com`
- `NEXT_PUBLIC_DEMO_STUDENT_ID` only for a deliberately controlled demo learner

## Phase 4 Entry Criteria

Platform deployment verification requires:

1. migration `0021` has applied successfully;
2. a named platform-admin account has been created;
3. named admin login has been verified;
4. `ALLOW_LEGACY_CREDENTIAL_HEADERS=false` is enabled;
5. `REQUIRE_PUPIL_SESSION=true` is enabled;
6. GitHub platform/content workflows are green;
7. Render, Vercel and deployment smoke checks are green.

Curriculum/adaptive scale additionally requires the Phase 3.7 exit criteria.

## Deliberately Deferred

These remain later scale phases after Phase 3.7:

- production-scale reviewed resources across every objective: Phase 5;
- final character rigs, world backdrops, narration and advanced manipulatives:
  Phase 6;
- full teacher/SENCO analytics, MIS sync and procurement operations: Phase 7.
