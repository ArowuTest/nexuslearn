# Deployment trigger recovery and persistent-storage release guard

Date: 2026-09-22

## Confirmed incident

GitHub main and Vercel served `a08776c73d79d9030ed76da3e8ae2ced71a88080`,
while Render continued serving `35a6243244e30af6aa2baf403dd07f006cf0c9f6`.
The earlier Platform quality and Content quality runs passed; Deployment smoke
correctly failed because the API did not serve the expected revision. A green
source build is not evidence that both hosted applications have been deployed.

The existing `nexuslearn-api` Render service was linked to the correct repository
and `main`, with automatic deployment enabled on commits. Its root directory
was `apps/api` and it had no build filter. The newer accessibility delivery
changed files outside that directory. Render's documented default ignores
changes outside a service root; a build filter can explicitly include them.
This accounts for the absent deployment, rather than a failed API compilation.
See [Render monorepo support](https://render.com/docs/monorepo-support).

## Hosting correction

Only the existing service's build filter was changed:

```json
{"buildFilter":{"paths":["**/*"],"ignoredPaths":[]}}
```

The repository, `main` branch, `apps/api` root, commit trigger, build/start
commands, environment, hosting plan and stored application data were unchanged.
This intentionally deploys every main commit, including web-, ops- and docs-only
changes, because our release policy requires both hosts to report the same
commit. It adds builds for otherwise irrelevant files; it does not change the
paid instance size. Future cost optimisation must preserve truthful release
identity rather than substituting a different SHA into the smoke check.

The configuration was read back before requesting one deployment of the already
tested `a08776c` revision with the existing build cache. Updating service
configuration alone does not deploy it; see the
[Render service update API](https://api-docs.render.com/reference/update-service)
and [specific-commit deployment API](https://api-docs.render.com/reference/create-deploy).
The provider reported this deployment live, and the independent public smoke at
20:56 UTC verified both exact full revisions with no problems.

That recovery does not by itself prove the new automatic trigger. The next
ops/docs-only main commit must produce its own automatic Render deployment,
successful GitHub quality runs and matching public API/frontend revisions.
Final remote evidence belongs in the release checkpoint; do not create a new
source commit merely to record checks for the preceding revision.

## Additional release-check correction

The public health endpoint alone can also describe a server using temporary
in-memory storage as healthy. The deployment validator previously did not
inspect storage mode, so this situation could pass alongside the correct SHA.

- Collect the existing `/v1/system/persistence` JSON response without credentials.
- Require HTTP 200 and exactly `mode: "postgres"`.
- Fail closed on memory mode, missing or malformed JSON, unknown modes, network
  failures, redirects and non-success HTTP responses.
- Retain exact API and frontend identities, all API contract checks, the pupil
  and family route checks, public narration availability, the private-report
  404 and unauthenticated parent-evidence 401.
- Retain bounded polling, 30-second request deadlines, disabled redirects,
  no-cache requests and fixed diagnostic labels without response-body logging.

Storage mode is configuration evidence, **not a fresh database ping**, a
read/write transaction check or an assurance that every learner journey works.
Likewise, HTTP 200 from a page is not proof of successful hydration. Real
API/PostgreSQL browser integration and authenticated user testing remain
separate requirements. The live API reported PostgreSQL before this guard was
added; no incident of lost pupil data is asserted here.

## Verification before push

- Test-first reproduction: 7 new/expanded assertions failed and 14 existing tests
  passed before the validator implementation. Failures included memory mode
  being accepted and polling finishing before persistent storage was configured.
- After the minimal fix, all 21 deployment-validator tests pass.
- The combined deployment, authentication, school/support, pupil journey,
  build identity, public-content boundary and performance-budget unit suite
  passes all 102 tests with no skips.
- The live read-only smoke for recovered `a08776c` returned API health/version/
  persistence 200, frontend version/pupil/family 200, public narration 200,
  private report 404 and unauthenticated parent evidence 401. Both full revisions
  matched and storage mode was `postgres`.

The prior revision's successful CI is not substituted for this batch's CI.
Neither visual baselines nor performance limits were relaxed. No curriculum,
audio asset, runtime content flag, pupil record, professional SEND sign-off,
human listening approval or pilot acceptance was changed.

## Future stale-deployment procedure

1. Read GitHub main and the relevant quality run's full SHA. Check both public
   version endpoints against that exact target; do not accept whichever SHA
   happens to be live or relabel an existing build.
2. Inspect only the known provider service's repository, branch, root,
   auto-deploy trigger, build filter and recent deployment statuses. Never dump
   environment settings or credentials into reports, command output or Git.
3. Check for an existing active deployment before retrying. Poll that deployment
   instead of creating duplicates; inspect a failed build before changing source.
4. If no deployment exists, inspect the commit's changed paths against the root
   and filter. Keep repository-wide inclusion while exact same-commit releases
   are the policy. Do not weaken the smoke check to hide a skipped deployment.
5. Deploy a specific tested commit only when needed, using the existing service
   and normal cache. A provider response is not sufficient: wait for live status
   and run the public smoke against the full target SHA.
6. For a new batch, require its Content quality, Platform quality and Deployment
   smoke runs, plus provider/public revision evidence. Keep professional review,
   narration listening and pilot acceptance visible as independent gates.

Read-only release command from the repository root:

```powershell
$env:SMOKE_EXPECTED_SHA = git rev-parse HEAD
node --test ops/deployment-smoke.test.mjs
node ops/deployment-smoke.mjs
```

Use the operating system's trusted certificate store where the local Node
installation requires it; never disable HTTPS certificate verification.
