# NexusLearn runbook

This is the short guide for running the family site and the later school pilot.
It does not change Render or Vercel by itself. A person still has to set the
values in [PRODUCTION_ENV.md](PRODUCTION_ENV.md) before the next deploy.

## Is the site up?

- `GET /healthz` means the API process is running.
- `GET /readyz` means it is safe to send children to it. In production this
  stays red until the API is using Postgres and can reach it.
- The web app is the Vercel site. The API is the Render site. The browser will
  only talk to the API when `CORS_ALLOWED_ORIGINS` includes the exact web
  address, for example `https://nexuslearn-woad.vercel.app`.

## Logs

The API writes one JSON line per request: method, path, status and how long it
took. It does not write passwords, login codes or children's answers. Health
checks are debug-level so they do not flood the log.

## Error reporting

Nothing is sent to an error service unless `SENTRY_DSN` is set. With a DSN, the
API posts a Sentry-compatible event for server errors only. Leave the DSN empty
until a grown-up has a Sentry project and has checked that events contain no
child content.

## When a child cannot sign in

1. Eight wrong attempts lock that login for 15 minutes. The lock is forgotten
   if the API restarts. A correct login before the lock clears the count.
2. A new family child cannot sign in until a parent records core-learning
   consent. Children who already existed are not locked out by this rule.
3. In production the API also requires the child's session token. The web app
   already sends it.

## Parent data rights

These need a parent session and the database:

- `POST /v1/parent/children/{id}/consent` records the exact statement the parent
  agreed to.
- `GET /v1/parent/children/{id}/export` downloads that child's learning record.
  It leaves out login codes, picture passwords and other children.
- `DELETE /v1/parent/children/{id}` deletes a family child who is not enrolled
  in a school class. A school enrolment returns a conflict so a school record
  is not removed by accident.
- `GET /v1/privacy/retention` shows how long data is meant to be kept. Nothing
  is deleted on a timer.

Consent rows are kept after deletion so the family can show what was agreed.
The deletion receipt stores a hash of the child id, not the child's name.

## Content a child is allowed to see

A question reaches a child only when people have finished curriculum, teacher,
accessibility and safeguarding review, the question itself is approved to run,
and every narration it uses has been listened to and released. AI review does
not unlock anything.

`GET /v1/admin/content/child-safety` (admin session) counts what is servable
and what is blocked. Audio review is the admin listening queue. Filter by one
pack id, play the clip, then approve or send it back.

## Year names

England is the default: Year 1 to Year 7. Nigeria uses the same numbers as
Primary 1 to Primary 6, then JSS 1. Set `CURRICULUM_REGION=nigeria` on the API
and `NEXT_PUBLIC_CURRICULUM_REGION=nigeria` on the web. The lessons themselves
stay the one shared catalogue.

## Database backup and restore

Children's records live in Postgres. A free Render database can expire. Use a
paid database before a school pilot.

Take a copy:

```text
pg_dump "$DATABASE_URL" --format=custom --file=nexuslearn.dump
```

Restore into a new empty database, not the one children are using:

```text
pg_restore --no-owner --dbname="$NEW_DATABASE_URL" nexuslearn.dump
```

Check `/readyz` on a spare API pointed at the new database before you change
the live `DATABASE_URL`. Render's paid Postgres also keeps dashboard backups.
A restore from the dashboard replaces that database, so take a dump first.

New tables for consent, privacy settings and deletion receipts are migration
`0061_child_data_rights`. Apply it with the same migrate command or
`AUTO_MIGRATE=true` already described in [DATABASE_AND_MIGRATIONS.md](DATABASE_AND_MIGRATIONS.md).
Existing children stay usable: only newly created family children require
consent before login.

## If the API will not start

Production refuses to start when `DATABASE_URL`, `ACCOUNT_SESSION_SECRET` or
`PUPIL_SESSION_SECRET` is missing. That is intentional. Put the missing value
in the host's environment. Do not point production at an empty database URL.

## Large files

Narration audio is still in git so the site and the audio check keep working.
See [ASSET_MIGRATION.md](ASSET_MIGRATION.md) before moving those files.
