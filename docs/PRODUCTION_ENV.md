# Production environment checklist

Set these on the host before deploying the safety changes. Do not commit the
values. Leave a box unset when the default is the safe one.

## API (Render)

| Variable | Production value | Why |
| --- | --- | --- |
| `DATABASE_URL` | Postgres connection string | The API will not start in production without it. |
| `ACCOUNT_SESSION_SECRET` | Long random secret | Signs parent, teacher and admin sessions. |
| `PUPIL_SESSION_SECRET` | Different long random secret | Signs child sessions. |
| `NEXUSLEARN_ENV` | `production` | Turns on the production safety rules. Render also sets `RENDER=true`, which counts as production. |
| `CORS_ALLOWED_ORIGINS` | `https://nexuslearn-woad.vercel.app` | Exact web address. Add a second origin with a comma if a school site is separate. An empty list blocks browsers. |
| `TRUST_PROXY` | `true` on Render | Uses the platform's forwarded client address for login lockout. |
| `AUTO_MIGRATE` | `true` until a one-off migrate job exists | Applies migration `0061` and later ones on startup. |
| `PORT` | Provided by Render | The API listens on `0.0.0.0:$PORT`. |

Leave these unset, or set them only for a named repair:

| Variable | Safe value | Why |
| --- | --- | --- |
| `ALLOW_LEGACY_CREDENTIAL_HEADERS` | unset or `false` | Shared admin, school and parent passwords stay off. |
| `ALLOW_BOOTSTRAP_ADMIN` | unset | The old `X-Admin-Key` cannot create users in production. |
| `ALLOW_ANONYMOUS_PUPIL_ROUTES` | unset | Child pages require a child session. |
| `ADMIN_API_KEY` | unset after the first admin exists | Bootstrap key. Not a normal login. |
| `SENTRY_DSN` | unset until a project exists | Off means no error reports leave the server. |
| `CURRICULUM_REGION` | unset, or `england`, or `nigeria` | Unset means England year names. |

## Web (Vercel)

| Variable | Production value | Why |
| --- | --- | --- |
| `NEXT_PUBLIC_API_URL` | `https://nexuslearn-api.onrender.com` | Where the browser calls the API. |
| `NEXT_PUBLIC_APP_ORIGIN` | `https://nexuslearn-woad.vercel.app` | Printed login cards need a full address. |
| `NEXT_PUBLIC_CURRICULUM_REGION` | unset, or `england`, or `nigeria` | Year names on school screens. England if unset. |

Vercel sets `VERCEL=1`. The web app then sends a strict-transport header so
browsers stay on HTTPS. Local `next dev` does not send that header.

## After the values are saved

1. Deploy the API and confirm `/readyz` returns ready.
2. Open the family site and sign in as a parent. A blocked browser call usually
   means `CORS_ALLOWED_ORIGINS` does not match the site address exactly.
3. Confirm a child who already had an account can still sign in.
4. Create a new family child only after recording core-learning consent.
