# NexusLearn runbook

This is the short operating guide for a family install and, later, a small school pilot. It does not turn hosting on. Deploy only after the checklist below is filled in.

## Is it up?

- `GET /healthz` means the API process is running.
- `GET /readyz` means it can talk to Postgres. In production an in-memory database is reported not ready.
- The web app should answer its own homepage. Narration files are not in the public folder. An anonymous visitor can fetch a clip only after a reviewer has approved that exact recording. Encoded or lookalike paths do not bypass that check.

Logs are JSON, one line per request: method, route template, status, and how long it took. They do not include passwords, login codes, or request bodies. If `SENTRY_DSN` is set, panics are also sent to Sentry. Leave that variable empty and nothing is sent.

## Before a real child uses it

The API treats every boot as production unless `NEXUSLEARN_ENV=development` (or `dev` or `test`). Local `go run` needs that flag. Render does not. Production refuses to start if any line below is missing or too short (`WEB_ORIGIN` can stand in for the origin list).

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Postgres connection. There is no silent in-memory fallback in production. |
| `ACCOUNT_SESSION_SECRET` | Signs parent, teacher and admin sessions. At least 32 characters. |
| `PUPIL_SESSION_SECRET` | Signs each child's session. At least 32 characters. Required in production even if `REQUIRE_PUPIL_SESSION` is unset. |
| `CORS_ALLOWED_ORIGINS` | The exact web address, for example `https://your-app.example`. No wildcard. |
| `ALLOW_LEGACY_CREDENTIAL_HEADERS` | Must stay unset in production. The API will not boot if this is turned on. |
| `DATA_RETENTION_DAYS` | Optional. Defaults to 730. Allowed range is 30 to 3650. |
| `CURRICULUM_REGION` | Optional. `england` (default) or `nigeria`. |
| `SENTRY_DSN` | Optional. Empty means error reporting stays off. |
| `ADMIN_API_KEY` | Creates the first named administrator only. After one platform admin exists, the key is refused. |
| `NEXUSLEARN_TRUST_PROXY` | Optional. Production already trusts a private proxy hop and uses the right-most `X-Forwarded-For` address, which is the one Render appends. Set this to `true` only if the proxy address is public. |
| `AUTO_MIGRATE` | `true` on the first boot of a new database, then you can turn it off. |

**Merging this branch to `main` will break the Render auto-deploy until `DATABASE_URL`, `ACCOUNT_SESSION_SECRET`, `PUPIL_SESSION_SECRET` (each secret at least 32 characters), and `CORS_ALLOWED_ORIGINS` or `WEB_ORIGIN` are set.** The API process will exit on boot instead of serving an in-memory site.

On the web build, set `NEXT_PUBLIC_API_URL` to the API address. `NARRATION_ACCESS_SECRET` has no built-in value. Leave it unset and signed narration links stay off, including on preview deployments. Approved recordings play because the site asks the API which ids a reviewer has accepted. The MP3s live in `apps/web/private/audio/`, not in `public/`. On Vercel they are traced into the audio route. If a deploy is too large for that function, set `NARRATION_AUDIO_ROOT` to a private mount and do not copy the files back into `public/`. `NEXT_PUBLIC_CURRICULUM_REGION` or `CURRICULUM_REGION` changes the homepage year-range line (`england` or `nigeria`). England stays the default. Signed-in class lists still say "Year N" so the page-size budget stays intact. `GET /v1/curriculum/region` returns the full England and Nigeria names.

A family child who is linked to a parent cannot sign in until that parent records consent (`family_learning`). Children on a school class or group are the school's responsibility. Demo pupils with no parent link can still sign in.

## Consent, export and deletion

- Parents record consent at `POST /v1/parent/consent`.
- A parent can download one linked child's record at `GET /v1/parent/children/{id}/export`. The copy includes mastery, history, baselines, mocks, world state, lesson steps, events and every attempt. Sign-in secrets and answer keys are left out. Another family's child is refused.
- Signing up with an email that already has an account fails with the same message whether or not that person is an admin. It does not change their password or sign them in.
- Deleting a family child needs `{"confirm":"delete"}`. A child who is also on a school roll is kept and the school has to release them first. The delete also clears login codes and picture passwords from the audit log, empties that child's learning-event contents, and removes the child id from privacy-action rows.
- Old attempts are not deleted on a timer. An admin can run `POST /v1/admin/privacy/purge` with `{"confirm":"purge"}` to remove attempts older than the retention setting.
- Sharing for school, marketing and research is off in the public privacy policy. This is a technical default, not a lawyer's privacy notice. Have a person write the UK and Nigeria notices before a pilot.

## Content a child can see

Question variants in the content packs are still in review (62 carry an approved status, 20,148 are blocked, and all 87 packs are status `review`). They do not replace the live catalogue until the existing human release checks pass.

Narration: 0 of 874 recordings are approved for children. 874 are blocked. A content reviewer or platform administrator opens `/review`, plays one pack, and writes what they heard. Parents cannot approve audio. Every clip id has to belong to that pack. Approving a pack lets those recordings play. It does not publish the question bank. Pack holds stay in `human_content_approvals` because the per-clip listening ledger requires audio hashes and cannot store a hold.

## Backups

No backup is configured by this repository. On Render Postgres, or any other host:

1. Take a dump: `pg_dump --format=custom --no-owner --file nexuslearn.dump "$DATABASE_URL"`.
2. Store the dump somewhere that is not the web server's disk. Render disks are wiped on restart.
3. Practise a restore into an empty database before you need it: `pg_restore --no-owner --dbname "$RESTORE_DATABASE_URL" nexuslearn.dump`.
4. Then run the API migrations if the dump is older than the code.

## What this guide does not do

It does not deploy, change hosting, or merge. The next person who deploys must set the variables above or the API will refuse to boot, and the browser will be blocked until the web address is on the CORS list.
