# Database and Migrations

Status: implementation note  
Scope: API persistence foundation

## Current State

The API can run with or without `DATABASE_URL`.

- Without `DATABASE_URL`, the API uses a no-op repository and keeps demo behavior.
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
GET /v1/learning/warm-up?studentId={studentId}
POST /v1/learning/attempt
```

This closes the first evidence loop: a child answers a question, the attempt is stored, projected mastery is updated, and parent/school reporting can read the result back.

The warm-up endpoint now reads the spaced-review queue when PostgreSQL is available. It still falls back to demo items when a child has no stored due reviews, which keeps the prototype playable while the adaptive engine matures.

## Safety Notes

- Do not commit database credentials.
- Keep `DATABASE_URL` in Render environment variables.
- Keep `AUTO_MIGRATE=true` only while the migration set is small and low-risk; later replace it with a pre-deploy migration job on a paid plan.
- The API logs persistence errors but still returns learning feedback so children are not blocked by a database issue.
