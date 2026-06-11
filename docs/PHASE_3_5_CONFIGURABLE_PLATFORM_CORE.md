# Phase 3.5: Configurable Platform Core

Status: Build-governing implementation milestone  
Purpose: Remove hardcoded product assumptions before Phase 4 adaptive expansion

## Why Phase 3.5 Exists

Phase 3 proved the learning evidence loop: attempts are stored, mastery updates, reviews are queued, world state changes, and parent/school evidence can be read back.

The review of Phases 1-3 found one strategic risk: too much behaviour was still hardcoded around the Year 4 demo. Phase 3.5 exists to make platform-admin configuration the default direction before building the adaptive engine and curriculum breadth.

## Non-Negotiable Rule

No curriculum, world, reward, activity, feature or user-management behaviour should remain hardcoded if it can reasonably be configured by platform admin or content admin.

Hardcoded values are allowed only for:

- local/demo fallbacks
- constants required for safe boot
- temporary proof content with a documented replacement path

## Phase 3.5 Implementation Scope

### Database Foundation

Migration:

```text
apps/api/migrations/0003_admin_configuration_foundation.up.sql
apps/api/migrations/0003_admin_configuration_foundation.down.sql
```

Adds:

- app users
- roles and user roles
- schools and school users
- classes and class membership
- student login credentials
- feature flags
- content versions
- activity templates
- activities
- questions
- worlds
- reward rules
- audit logs

### Admin API Foundation

Protected by:

```text
ADMIN_API_KEY
X-Admin-Key: <key>
```

Endpoints:

```text
GET /v1/admin/config
GET /v1/admin/feature-flags
PUT /v1/admin/feature-flags/{key}
GET /v1/admin/worlds
PUT /v1/admin/worlds/{key}
GET /v1/admin/content/activities
PUT /v1/admin/content/activities/{id}
PUT /v1/admin/curriculum/objectives/{id}
GET /v1/system/diagnostics
```

### Curriculum Configuration

Public curriculum reads now go through the repository layer:

```text
GET /v1/curriculum/objectives
GET /v1/curriculum/objectives/{id}
```

When PostgreSQL is configured, the API reads curriculum objectives from the database and seeds the original demo objectives only as safe fallback content.

### Admin-Configurable Areas

Phase 3.5 starts admin configuration for:

- curriculum objectives
- mastery rules per objective
- prerequisites
- misconceptions
- feature flags
- worlds
- activity definitions
- interaction payloads
- feedback payloads
- animation hooks

## What Still Remains After Phase 3.5

Phase 3.5 creates the configurable platform core. It does not yet deliver a full visual CMS.

Next implementation steps:

1. Add a real admin UI in `apps/web/src/app/admin`.
2. Add role-based auth rather than API-key-only admin protection.
3. Move the live mission runtime to consume `activities` and `questions`.
4. Add content review states and publishing workflows to the UI.
5. Add school/class management screens.
6. Add feature-flag-driven frontend behaviour.
7. Add audit-log views.

## Acceptance Criteria

Phase 3.5 is acceptable when:

- admin/config schema is migrated live
- admin endpoints are protected
- diagnostics is no longer public when `ADMIN_API_KEY` is configured
- curriculum objectives can be created/updated through admin API
- public curriculum endpoints can read database-backed objectives
- feature flags can be created/updated through admin API
- worlds can be created/updated through admin API
- activity definitions can be created/updated through admin API
- documentation states which demo hardcoding remains and why

## Remaining Hardcoded Areas To Remove

Known remaining demo constants:

- `alex-demo` in frontend pages
- Year 4 mission UI in `apps/web/src/app/play/mission`
- local generated multiplication questions
- `NextActivity` demo function
- world unlock rules inside the learning repository
- no full admin UI yet

These are now explicitly Phase 3.5/4 follow-up work, not acceptable long-term architecture.
