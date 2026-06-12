# Phase 3.6: Pre-Phase-4 Hardening

Status: active  
Purpose: close every known Phase 1-3.5 gap before Phase 4 adaptive/curriculum scale

## Non-Negotiable Standard

Phase 4 does not start while known hardcoded product behaviour, hidden demo
defaults, untracked admin changes, missing tests, or undocumented risks remain.

Safe boot constants are allowed only when they fail honestly and do not invent
learner progress, curriculum coverage or school data.

## Closure Checklist

1. Admin UI polish and guided editors: active, core validation closed.
2. Real auth/RBAC: pending.
3. Interaction renderers beyond multiplication: pending.
4. Curriculum breadth and content production system: pending.
5. Content workflow, preview, validation and rollback: pending.
6. School/class/user management UI: pending.
7. Feature-flag-driven frontend behaviour: pending.
8. Configurable world/reward/companion rules: active.
9. Safety/compliance hardening: pending.
10. Visual excellence and asset pipeline: pending.

## Completed In This Slice

- Removed silent `demo-student` defaults from learner runtime endpoints.
- Removed the legacy public demo mission route from the API.
- Runtime mission requests now return `404` when configured content is missing.
- No-database repository mode returns honest empty state instead of fake learner
  progress.
- Warm-up fallback now reads published configured questions.
- Due-review warm-ups use objective statements and required formats from the
  database instead of objective-specific switches.
- Attempt world-state updates resolve world keys from configured activities and
  enabled worlds instead of objective-specific switches.
- Attempt world-state no longer writes hardcoded tile names.
- Frontend parent dashboard no longer uses fake subject, objective or attempt
  evidence.
- Frontend mission no longer generates local multiplication questions when
  configured content is missing.
- Live feature flags now disable demo fallback mode.
- Starter curriculum objectives now live in migration-backed seed data instead
  of Go runtime arrays.
- Public curriculum reads no longer auto-seed objectives from application code.
- Attempt recording now rejects unknown objectives instead of silently creating
  partial curriculum rows.
- Legacy generated demo missions and their tests have been removed from the
  learning package.
- Learning package tests now cover shared mastery-band boundaries rather than
  in-code demo content.
- Admin create forms now start from neutral blank drafts instead of inheriting
  Year 4 or prototype-world defaults.
- Admin saves validate required world, activity, question, objective and flag
  fields before sending requests.
- API admin writes now reject incomplete configuration with explicit `400`
  validation errors.
- Validation tests cover required content links, published question activity
  links and complete curriculum objective records.
- Homepage world cards now read from the configured public world catalogue
  instead of a hardcoded Year 1-7 array.
- Homepage live-world messaging now reflects the currently configured active
  world, with an honest empty state when no worlds are enabled.
- Pure attempt scoring no longer uses a fake prototype mastery baseline; real
  projected mastery is calculated from persisted learner state.

## Remaining Hardcode Audit

Known areas still to close:

- Homepage quality principles remain static product positioning; world/runtime
  content is now configuration-driven.
- API key based admin auth.
- Feature flags are editable but not yet broadly consumed by the frontend.
- Reward rules table exists but is not yet the source of all reward behaviour.
- JSON payloads have basic structural validation; schema-level validation per
  interaction type is still pending.
- Scoring feedback/reward copy is still v1 policy code; Phase 4 should move it
  behind configurable mastery and reward policies.
