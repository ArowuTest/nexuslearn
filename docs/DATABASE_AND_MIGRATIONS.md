# Database and Migrations

Status: implementation note  
Scope: API persistence foundation

## Current State

The API can run with or without `DATABASE_URL`.

- Without `DATABASE_URL`, the API uses a no-op repository that returns honest empty state. It does not invent learner progress.
- With `DATABASE_URL`, the API connects to PostgreSQL and persists learning attempts, projected mastery and spaced review entries.
- With `AUTO_MIGRATE=true`, the API applies pending migrations on startup before serving traffic.

This lets Render remain stable while the database is introduced in stages.

## Environment Variable

```text
DATABASE_URL=postgres://user:password@host:5432/database
AUTO_MIGRATE=true
```

Use Render's internal database URL for production once a managed PostgreSQL instance is attached.

## Migration Files

```text
apps/api/migrations/0001_learning_foundation.up.sql
apps/api/migrations/0001_learning_foundation.down.sql
apps/api/migrations/0002_review_queue_integrity.up.sql
apps/api/migrations/0002_review_queue_integrity.down.sql
apps/api/migrations/0003_admin_configuration_foundation.up.sql
apps/api/migrations/0003_admin_configuration_foundation.down.sql
apps/api/migrations/0004_configured_runtime_seed.up.sql
apps/api/migrations/0004_configured_runtime_seed.down.sql
apps/api/migrations/0005_disable_demo_fallbacks.up.sql
apps/api/migrations/0005_disable_demo_fallbacks.down.sql
apps/api/migrations/0006_seed_starter_curriculum.up.sql
apps/api/migrations/0006_seed_starter_curriculum.down.sql
apps/api/migrations/0007_reward_policy_seed.up.sql
apps/api/migrations/0007_reward_policy_seed.down.sql
apps/api/migrations/0008_school_management_constraints.up.sql
apps/api/migrations/0008_school_management_constraints.down.sql
apps/api/migrations/0009_broaden_starter_curriculum_map.up.sql
apps/api/migrations/0009_broaden_starter_curriculum_map.down.sql
apps/api/migrations/0010_school_groups_and_login_batches.up.sql
apps/api/migrations/0010_school_groups_and_login_batches.down.sql
apps/api/migrations/0011_parent_child_links.up.sql
apps/api/migrations/0011_parent_child_links.down.sql
apps/api/migrations/0012_access_requests.up.sql
apps/api/migrations/0012_access_requests.down.sql
apps/api/migrations/0013_school_delegated_admin.up.sql
apps/api/migrations/0013_school_delegated_admin.down.sql
apps/api/migrations/0014_direct_parent_profiles.up.sql
apps/api/migrations/0014_direct_parent_profiles.down.sql
apps/api/migrations/0015_access_request_support_needs.up.sql
apps/api/migrations/0015_access_request_support_needs.down.sql
apps/api/migrations/0016_student_engagement_support_columns.up.sql
apps/api/migrations/0016_student_engagement_support_columns.down.sql
apps/api/migrations/0017_public_runtime_feature_flags.up.sql
apps/api/migrations/0017_public_runtime_feature_flags.down.sql
apps/api/migrations/0018_child_experience_release_flags.up.sql
apps/api/migrations/0018_child_experience_release_flags.down.sql
apps/api/migrations/0019_public_demo_learner_controls.up.sql
apps/api/migrations/0019_public_demo_learner_controls.down.sql
apps/api/migrations/0020_content_version_status_channels.up.sql
apps/api/migrations/0020_content_version_status_channels.down.sql
apps/api/migrations/0021_account_sessions_and_parent_invitations.up.sql
apps/api/migrations/0021_account_sessions_and_parent_invitations.down.sql
```

The first migration creates:

- students
- curriculum_objectives
- objective_prerequisites
- objective_misconceptions
- learning_sessions
- question_attempts
- student_objective_mastery
- spaced_review_queue
- student_world_state
- learning_events

The second migration deduplicates open spaced-review rows and adds a partial unique index so each student/objective has at most one open review.

The third migration adds the Phase 3.5 configuration foundation: app users, roles, schools, classes, pupil credentials, feature flags, content versions, activity templates, activities, questions, worlds, reward rules and audit logs.

The fourth migration seeds the configured runtime catalogue: baseline starter objectives needed by the activities, Year 1-7 worlds, runtime feature flags, published starter activities and published starter questions.

The fifth migration disables demo fallback mode in database configuration.

The sixth migration enriches starter curriculum objectives with prerequisites and misconceptions. Application code no longer keeps starter objectives in Go arrays or auto-creates them during reads.

The seventh migration seeds configurable reward policies. Attempt responses now apply matching `reward_rules` rows after persisted mastery is calculated, so reward hooks, animation hooks, learner feedback, evidence events and companion prompts can be configured without code edits.

The eighth migration adds school/class administration constraints and indexes:
unique school URNs/import keys, unique class names per school, class membership
lookup indexes and credential lookup support.

The ninth migration broadens starter curriculum coverage with representative
Year 1-7 objectives across Mathematics, English and Science. This is still a
starter map, not full curriculum coverage, but it prevents the live product
from looking like a single multiplication-table proof.

The tenth migration adds school teaching/intervention groups and group
membership. Class-level login batches use the existing `student_credentials`
table so schools can provision children without pupil email/password accounts.

The eleventh migration adds parent-child links. Parent users can be connected to
existing learner records while pupil access remains school-managed through login
codes, picture passwords and future QR login cards.

The twelfth migration adds public onboarding/access requests for parents,
schools and tutoring organisations. Requests capture contact details,
organisation context, estimated learner volume, Year 1-7 demand, message,
source and admin review status.

The thirteenth migration adds delegated school administration credentials:
school staff login IDs, development temporary password hashes, and timestamps
on school-user membership records. This lets school leads manage classes,
groups and pupil access inside their own school boundary.

The fourteenth migration adds direct parent child profiles and Adaptive
Inclusion Profiles. Each child can have declared support needs, learning
approaches, sensory load, attention/communication/processing/confidence support,
audio and reading support, companion/reward preferences and interests.

The fifteenth migration adds structured SEND/support needs and learning
priorities to public access requests. These replace unreliable free-text-only
triage and allow onboarding demand to be filtered by ADHD, autism, dyslexia,
sensory support, processing support, low-sensory needs, short-burst learning and
similar setup requirements.

The sixteenth migration is a forward-compatibility repair for live databases
that applied the first parent-profile migration before the structured SEND and
adaptation fields were expanded. It adds the missing Adaptive Inclusion Profile
columns without depending on edited historical migrations.

The seventeenth migration seeds public-safe runtime feature flags for child
entry, public access requests, family signup, delegated school workspace
visibility and prototype/demo labels. These let platform admins control public
journeys without exposing protected admin configuration.

The eighteenth migration adds child-experience release flags for advanced
renderers, produced narration and scoped pilot cohorts.

The nineteenth migration makes public demo learner entry an explicit feature
flag, disabled by default.

The twentieth migration aligns `content_versions.status` with the runtime and
content-production status model by allowing `pilot` and `live` snapshots.

The twenty-first migration adds revocable account sessions and durable parent
invitations. Both store token hashes rather than raw tokens. Sessions support
expiry and revocation; invitations support expiry, sent, accepted and revoked
states with audit evidence.

Migrations twenty-two to twenty-eight establish the Phase 3.7 evidence layer:
durable mastery history and misconception state, lesson-step evidence, teacher
assignments, evidence-confidence and recency measures, moderated teacher
evidence, intervention plans, contrasting misconception repair and auditable
intervention reassessments.

The twenty-ninth migration adds durable diagnostic baselines and ordered
baseline items. Each item records attempts, correct responses, response-format
diversity and completion; one in-progress baseline is allowed per pupil.

The thirtieth migration records the child's response mode on attempts and
mastery history, keeping motor/access choice separate from the configured
curriculum interaction format.

The thirty-third migration adds durable, ordered subject mock assessments. A
mock records its learner, authorised creator role, subject/year range,
revision/stretch policy, accessibility intent and runtime-approved question
items. It is idempotent at the application boundary and indexed for learner,
school and question lookups.

The thirty-fourth migration links learner question attempts to their mock
assessment when applicable. It enforces one answer per selected question and
adds the index used to calculate resumable completion, score and status. Mock
answers remain separate from long-term mastery evidence until an explicit
assessment-evidence policy promotes them.

The thirty-fifth migration adds the narration review ledger. The thirty-sixth
migration makes that ledger explicitly append-only: each reviewer decision is
immutable, while API reads expose the latest decision for each asset and
idempotency keys prevent a retried request from creating a duplicate event.

The thirty-seventh migration adds the append-only content review ledger. It
stores curriculum, independent teacher, SEND/accessibility, safeguarding,
renderer and conditional audio decisions per pilot pack and lane. Decisions
are bound to the generated pilot-batch SHA-256, so a regenerated queue makes
old approvals visibly stale instead of silently carrying them into release.

## Applying Migrations

The API includes an explicit migration command. For paid Render plans, this can be run as a one-off job. Render free web services do not support one-off jobs, so the current prototype path is `AUTO_MIGRATE=true`.

From `apps/api`:

```bash
DATABASE_URL="postgres://..." go run ./cmd/migrate -dir migrations
```

For a built Render-style binary:

```bash
go build -o bin/migrate ./cmd/migrate
DATABASE_URL="postgres://..." ./bin/migrate -dir migrations
```

The runner creates a `schema_migrations` table and applies each `*.up.sql` file once in sorted order.

## Render Free Prototype Path

1. Create a free 30-day Render Postgres database.
2. Set `DATABASE_URL` on `nexuslearn-api` using the internal connection string.
3. Set `AUTO_MIGRATE=true`.
4. Redeploy the API.
5. The API applies pending migrations at startup.

## Phase 3 Read Endpoints

These endpoints now read from PostgreSQL when `DATABASE_URL` is configured and fall back to demo evidence when it is not.

```text
GET /v1/system/persistence
GET /v1/students/{studentId}/mastery
GET /v1/students/{studentId}/attempts
GET /v1/students/{studentId}/summary
GET /v1/students/{studentId}/world?worldKey={worldKey}
POST /v1/students/{studentId}/sessions
GET /v1/learning/warm-up?studentId={studentId}
POST /v1/learning/attempt
GET /v1/system/diagnostics
```

This closes the first evidence loop: a child answers a question, the attempt is stored, projected mastery is updated, and parent/school reporting can read the result back.

The warm-up endpoint now reads the spaced-review queue when PostgreSQL is available. It still falls back to demo items when a child has no stored due reviews, which keeps the prototype playable while the adaptive engine matures.

Attempt recording now uses cumulative mastery: the API reads the current objective score, applies the latest signal, updates the score and band, completes the matching review item, creates the next deduplicated review, and persists the child's world-state unlocks.

The summary, world and diagnostics endpoints provide the remaining Phase 3 operating surface:

- Evidence summary: attempts, accuracy, review counts, repaired misconceptions and mastery-band counts.
- World state: permanent child-facing unlock state for the current world.
- Sessions: explicit child/session starts with mode and device tier for future adaptive context.
- Diagnostics: schema version, table counts, last write times and review-queue integrity status.

## Phase 3.5 Admin Configuration Endpoints

These endpoints are protected by `ADMIN_API_KEY` and the `X-Admin-Key` request header.

```text
GET /v1/admin/config
GET /v1/admin/students
PUT /v1/admin/students/{externalRef}
GET /v1/admin/schools
PUT /v1/admin/schools/{urn}
GET /v1/admin/school-users
PUT /v1/admin/schools/{urn}/users/{email}
GET /v1/admin/classes
PUT /v1/admin/classes/{id}
PUT /v1/admin/classes/{id}/students/{externalRef}
PUT /v1/admin/classes/{id}/credentials
GET /v1/admin/student-credentials
PUT /v1/admin/student-credentials/{externalRef}
GET /v1/admin/groups
PUT /v1/admin/groups/{id}
PUT /v1/admin/groups/{id}/students/{externalRef}
GET /v1/admin/parent-links
PUT /v1/admin/parent-links/{studentExternalRef}
GET /v1/admin/access-requests
PUT /v1/admin/access-requests/{id}/status
POST /v1/admin/access-requests/{id}/convert
GET /v1/admin/feature-flags
PUT /v1/admin/feature-flags/{key}
GET /v1/admin/worlds
PUT /v1/admin/worlds/{key}
GET /v1/admin/content/activities
PUT /v1/admin/content/activities/{id}
GET /v1/admin/content/questions
PUT /v1/admin/content/questions/{id}
GET /v1/admin/content/readiness
GET /v1/admin/content/versions
POST /v1/admin/content/versions?id={id}
POST /v1/admin/content/versions/{id}/restore
GET /v1/admin/reward-rules
PUT /v1/admin/reward-rules/{id}
PUT /v1/admin/curriculum/objectives/{id}
GET /v1/system/diagnostics
GET /v1/admin/audit
```

`/v1/admin/content/readiness` returns an objective-by-objective quality gate for
the content production system. It checks whether each objective has a complete
curriculum record, prerequisite/misconception evidence, runtime-approved
teaching activities, published question evidence, required formats, hints,
explanations and animation hooks. Admin surfaces should use it as the first
triage view before expanding content breadth.

`/v1/admin/content/versions` returns the latest database-backed content
snapshots from `content_versions`. Curriculum objective, world, activity,
question and reward-rule upserts now record a new version row with the payload,
content type, status, created timestamp and published timestamp when relevant.
This gives admins a reviewable history before full restore/diff tooling is
introduced.

`POST /v1/admin/content/versions?id={id}` restores a snapshot through the same
validated upsert paths as ordinary admin edits. The nested
`/v1/admin/content/versions/{id}/restore` route is also registered for local
compatibility, but the Admin Console uses the flat query-param route because it
is more conservative across deploy targets. Restore creates fresh audit/version
records; it does not bypass required objective, activity, question, world or
reward-rule validation.

Public onboarding endpoint:

```text
POST /v1/access-requests
POST /v1/auth/pupil-login
```

Supported `request_type` values are `parent`, `school` and `tutor_org`.
Supported admin statuses are `new`, `reviewing`, `approved`, `waitlisted`,
`rejected` and `converted`.

Approved school and tutoring organisation requests can be converted through
`POST /v1/admin/access-requests/{id}/convert`. The conversion creates a trial
organisation record, a first school-admin/teacher access record with a
temporary password, and an optional starter class using the request year-group
context. The endpoint refuses unapproved requests so enquiry triage remains
auditable before platform data is created.

Pupil login verifies an existing `student_credentials` row using
`student_external_ref`, `login_code`, optional `qr_secret_hash` and the
picture-password sequence. It returns the learner profile plus the next
configured activity when available. This is the Phase 3 bridge for printed
school login cards; it is not a replacement for production identity/RBAC.

When `PUPIL_SESSION_SECRET` is configured, the same endpoint also returns a
short-lived signed pupil session:

```json
{
  "session": {
    "configured": true,
    "token_type": "pupil",
    "token": "base64url-payload.base64url-signature",
    "expires_at": "2026-06-17T16:00:00Z",
    "expires_in_seconds": 28800
  }
}
```

The token is HMAC-SHA256 signed and expires after eight hours. Production
deployments must set `PUPIL_SESSION_SECRET`; development environments can omit
it, in which case login still works but the response reports
`"configured": false`.

Set `REQUIRE_PUPIL_SESSION=true` only after learner clients send the returned
token as `X-Pupil-Session` or `Authorization: Bearer <token>`. When enabled,
learner profile, mastery, attempts, summary, world-state, warm-up, next-mission,
mission and attempt-recording endpoints reject missing, expired or mismatched
pupil sessions.

Direct parent and family endpoints:

```text
POST /v1/parents/signup
GET /v1/parent/config
PUT /v1/parent/children/{externalRef}
PUT /v1/parent/children/{externalRef}/engagement
```

Parent-scoped endpoints use `X-Parent-Login` and `X-Parent-Password`. The child
engagement profile stores support needs and learning adaptations that can drive
mission length, sensory load, animation intensity, audio/reading support,
scaffolding and reward style.

Delegated school workspace endpoints use `X-School-URN`, `X-School-Login` and
`X-School-Password` request headers. They do not require the platform
`ADMIN_API_KEY` and are scoped to the authenticated school.

```text
GET /v1/school/config
PUT /v1/school/students/{externalRef}
PUT /v1/school/classes/{id}
PUT /v1/school/classes/{id}/students/{externalRef}
PUT /v1/school/classes/{id}/credentials
PUT /v1/school/groups/{id}
PUT /v1/school/groups/{id}/students/{externalRef}
```

The current password hashing is a development bridge for Phase 3.6. Production
auth should move to a real identity provider or Argon2/bcrypt-backed credential
flow with password reset, MFA options for staff, invite emails and audit actors.

Public curriculum reads now use the repository layer. With PostgreSQL, they read from `curriculum_objectives`; starter objectives are migration-backed seed content and should be expanded through the admin/content pipeline. `/v1/curriculum/map` exposes year, subject, strand and topic coverage for product and reporting surfaces.

## Phase 3.5b Configured Runtime Endpoints

Migration `0004_configured_runtime_seed` seeds the first runtime catalogue:

- Year 1-7 worlds plus a co-operative class world
- runtime feature flags
- published starter activities
- published starter questions

Public learner runtime endpoints:

```text
GET /v1/learning/worlds
GET /v1/curriculum/map
GET /v1/runtime/flags
GET /v1/learning/next?studentId={studentId}
GET /v1/learning/mission?studentId={studentId}&activityId={optionalActivityId}
GET /v1/students/{studentId}/profile
```

`/v1/runtime/flags` is public-safe and allowlisted. It exposes only frontend
runtime flags such as child play visibility, public access requests, family
signup, school workspace visibility, demo labels, opt-in public demo learner
entry, configured runtime mode and low-sensory default. It does not expose
arbitrary admin-only flags.

Migration `0019_public_demo_learner_controls` adds
`public_demo_learner_enabled`, disabled by default. Real child learning should
normally begin through a school card, parent-created profile or tutoring
organisation profile; anonymous demo learner entry is a deliberate controlled
demo setting rather than the default public route.

Advanced child-experience flags can also carry rollout config:

```json
{
  "pilot_school_urns": ["nexus-primary"],
  "blocked_school_urns": ["pause-this-school"],
  "pilot_student_ids": ["ava-y4"],
  "blocked_student_ids": ["hold-back-learner"]
}
```

Mission routing uses these scoped controls for `advanced_interaction_renderers_enabled`
and `child_audio_narration_enabled`. This allows one school or learner to pilot
produced narration or richer renderers without turning those experiences on for
all children.

`/v1/learning/next` and `/v1/learning/mission` include
`runtime_adaptations`, derived from the child's Adaptive Inclusion Profile when
one exists. The initial Phase 3.6 rules expose animation tier, reduced motion,
celebration intensity, session length, question limit, scaffold level,
audio/reading support, companion tone, reward style and human-readable reasons.
This is the foundation for Phase 4's deeper adaptive routing.

Runtime selection rule:

- prefer `live`, `published` or `approved` configured activities
- refuse draft/review/archived activities in learner runtime even when an
  `activityId` is supplied directly
- return a visible missing-configuration error if no approved/published/live
  mission exists

Browser admin support:

- CORS allows `PUT`
- CORS allows `X-Admin-Key`
- world, activity, question, curriculum objective and feature-flag saves write
  audit log entries
- objective, world, activity, question and reward-rule saves write
  `content_versions` snapshots for admin review
- content-version restore uses the same validation/upsert path as manual edits
  and records a new audit event

## Safety Notes

- Do not commit database credentials.
- Keep `DATABASE_URL` in Render environment variables.
- Set `ADMIN_API_KEY` before enabling admin/config endpoints outside local development.
- Keep `AUTO_MIGRATE=true` only while the migration set is small and low-risk; later replace it with a pre-deploy migration job on a paid plan.
- The API logs persistence errors but still returns learning feedback so children are not blocked by a database issue.
