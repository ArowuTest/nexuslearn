# Phase 3.5: Configurable Platform Core

Status: Build-governing implementation milestone  
Purpose: Remove hardcoded product assumptions before Phase 4 adaptive expansion

Latest pass: Phase 3.5b strengthens the learner runtime so configured worlds,
activities and questions are used by the child-facing experience before demo
fallbacks.

Latest pass: Phase 3.5c turns the admin surface into the first edit-capable
control room for worlds, activities, questions, objectives and feature flags.

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
apps/api/migrations/0004_configured_runtime_seed.up.sql
apps/api/migrations/0004_configured_runtime_seed.down.sql
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

The `0004` runtime seed adds:

- full Year 1-7 world catalogue plus a co-operative class world
- runtime feature flags
- published starter activities for Year 1 phonics and Year 4 multiplication
- published configurable starter questions

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
GET /v1/admin/content/questions
PUT /v1/admin/content/questions/{id}
PUT /v1/admin/curriculum/objectives/{id}
GET /v1/admin/audit
GET /v1/system/diagnostics
```

Browser support:

- CORS now permits `PUT` and `X-Admin-Key`, so the web admin can read and save
  protected configuration from Vercel to Render.

### Curriculum Configuration

Public curriculum reads now go through the repository layer:

```text
GET /v1/curriculum/objectives
GET /v1/curriculum/objectives/{id}
GET /v1/learning/worlds
GET /v1/learning/next
GET /v1/learning/mission
GET /v1/students/{studentId}/profile
```

When PostgreSQL is configured, the API reads curriculum objectives from the database and seeds the original demo objectives only as safe fallback content.

The learner runtime now prefers configured activities/questions:

- `/v1/learning/next` selects the first live/published/approved configured
  activity before falling back to demo logic.
- `/v1/learning/mission` returns the selected activity, objective, world and
  published questions together.
- `/v1/learning/worlds` exposes enabled configured worlds for the child entry
  experience.
- `/v1/students/{studentId}/profile` gives the frontend one place to read the
  active learner identity and next activity pointer.

### Admin-Configurable Areas

Phase 3.5 starts admin configuration for:

- curriculum objectives
- mastery rules per objective
- prerequisites
- misconceptions
- feature flags
- worlds
- activity definitions
- question definitions
- interaction payloads
- feedback payloads
- animation hooks
- audit visibility

### Admin UI Foundation

The first web admin surface is available at:

```text
/admin
```

It accepts the current `ADMIN_API_KEY` in the browser and can now read and edit:

- worlds
- activities
- questions
- curriculum objectives
- feature flags
- recent audit entries

Advanced payloads such as interaction settings, feedback, animation hooks and
question bodies are edited as JSON so the platform is configurable before a
full visual CMS is built.

The child and parent surfaces now use shared runtime configuration:

- `NEXT_PUBLIC_DEMO_STUDENT_ID` controls the active proof learner.
- `/play` reads the configured world catalogue.
- `/play/mission` loads configured mission questions when available, with local
  fallback only for cold-start resilience.
- `/parents` reads the learner profile and adaptive decision instead of
  scattering a fixed child ID through the page.

## What Still Remains After Phase 3.5

Phase 3.5 creates the configurable platform core. It does not yet deliver a full visual CMS.

Next implementation steps:

1. Replace JSON textareas with guided editors for common interaction types.
2. Add role-based auth rather than API-key-only admin protection.
3. Expand the mission renderer so every configured interaction type has a rich
   native UI, not only the current multiplication/number-pad runtime.
4. Add content review states and publishing workflows to the UI.
5. Add school/class management screens.
6. Add feature-flag-driven frontend behaviour.
7. Add richer audit-log filtering and export.

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
- question definitions can be created/updated through admin API
- audit logs can be read through admin API
- first admin UI can inspect live configuration
- admin UI can create/update worlds, activities, questions, objectives and flags
- admin saves create audit entries for major configurable records
- child world picker reads configured worlds
- mission endpoint returns configured activity/objective/world/questions
- mission page can play configured question content before fallback
- parent dashboard reads shared learner profile configuration
- documentation states which demo hardcoding remains and why

## Remaining Hardcoded Areas To Remove

Known remaining demo constants:

- `alex-demo` remains only as the default `NEXT_PUBLIC_DEMO_STUDENT_ID` fallback
- the mission renderer is still visually optimised for number-pad multiplication
- local generated multiplication questions remain only as a cold-start fallback
- `NextActivity` demo function
- world unlock rules inside the learning repository
- admin UI is edit-capable but still not a full visual CMS

These are now explicitly Phase 3.5/4 follow-up work, not acceptable long-term architecture.
