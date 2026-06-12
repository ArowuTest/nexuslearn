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
GET /v1/admin/feature-flags
PUT /v1/admin/feature-flags/{key}
GET /v1/admin/worlds
PUT /v1/admin/worlds/{key}
GET /v1/admin/content/activities
PUT /v1/admin/content/activities/{id}
GET /v1/admin/content/questions
PUT /v1/admin/content/questions/{id}
PUT /v1/admin/curriculum/objectives/{id}
GET /v1/system/diagnostics
GET /v1/admin/audit
```

Public curriculum reads now use the repository layer. With PostgreSQL, they read from `curriculum_objectives`; starter objectives are migration-backed seed content and should be expanded through the admin/content pipeline.

## Phase 3.5b Configured Runtime Endpoints

Migration `0004_configured_runtime_seed` seeds the first runtime catalogue:

- Year 1-7 worlds plus a co-operative class world
- runtime feature flags
- published starter activities
- published starter questions

Public learner runtime endpoints:

```text
GET /v1/learning/worlds
GET /v1/learning/next?studentId={studentId}
GET /v1/learning/mission?studentId={studentId}&activityId={optionalActivityId}
GET /v1/students/{studentId}/profile
```

Runtime selection rule:

- prefer `live`, `published` or `approved` configured activities
- use draft/non-archived activities only as editor/runtime fallback where explicitly requested
- return a visible missing-configuration error if no configured mission exists

Browser admin support:

- CORS allows `PUT`
- CORS allows `X-Admin-Key`
- world, activity, question, curriculum objective and feature-flag saves write
  audit log entries

## Safety Notes

- Do not commit database credentials.
- Keep `DATABASE_URL` in Render environment variables.
- Set `ADMIN_API_KEY` before enabling admin/config endpoints outside local development.
- Keep `AUTO_MIGRATE=true` only while the migration set is small and low-risk; later replace it with a pre-deploy migration job on a paid plan.
- The API logs persistence errors but still returns learning feedback so children are not blocked by a database issue.
