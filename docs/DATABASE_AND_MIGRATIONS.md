# Database and Migrations

Status: implementation note  
Scope: API persistence foundation

## Current State

The API can run with or without `DATABASE_URL`.

- Without `DATABASE_URL`, the API uses a no-op repository and keeps demo behavior.
- With `DATABASE_URL`, the API connects to PostgreSQL and persists learning attempts, projected mastery and spaced review entries.

This lets Render remain stable while the database is introduced in stages.

## Environment Variable

```text
DATABASE_URL=postgres://user:password@host:5432/database
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

The API does not auto-run migrations yet. Apply migrations explicitly before enabling database writes in production.

Recommended next step:

```text
Add a small migration command or Render pre-deploy job that applies SQL files once per deploy.
```

Until then, use a database console or migration tool to apply `0001_learning_foundation.up.sql`.

## Safety Notes

- Do not commit database credentials.
- Keep `DATABASE_URL` in Render environment variables.
- Apply migrations before setting `DATABASE_URL` on a live API.
- The API logs persistence errors but still returns learning feedback so children are not blocked by a database issue.
