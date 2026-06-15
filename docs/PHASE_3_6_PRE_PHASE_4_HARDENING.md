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
3. Interaction renderers beyond multiplication: active, text-choice slice closed.
4. Curriculum breadth and content production system: active, starter map breadth slice closed.
5. Content workflow, preview, validation and rollback: active, readiness reporting slice closed.
6. School/class/user management UI: active, platform-admin school/class/credential slice closed.
7. Feature-flag-driven frontend behaviour: pending.
8. Configurable world/reward/companion rules: active.
9. Safety/compliance hardening: pending.
10. Visual excellence and asset pipeline: active.

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
- Next-activity routing now reads a stored learner year where available instead
  of inferring year group from `studentId` text.
- Learner mission scene now has dynamic configured-world accent colour, portal
  rings, orbiting energy, scan-line motion, improved sparks and clearer
  learning-purpose chips.
- Companion SVG was cleaned to remove broken encoded glyphs and use native SVG
  celebration shapes.
- Attempt responses now apply configured `reward_rules` after persisted mastery
  is calculated.
- Reward policy seed includes world/objective-specific rows and safe defaults
  for correct and repair outcomes.
- API attempts now support text answers as well as numeric answers, enabling
  phonics and choice-based interactions to produce real evidence.
- Mission renderer now supports configured choice questions with large tappable
  answer tiles, alongside the existing numeric keypad.
- API content validation now checks interaction-specific question shapes for
  `multiple_choice`, `audio_blend` and `timed-recall`.
- Platform admins can now list and edit reward rules through protected admin
  API endpoints and the admin console Rewards tab.
- Platform admins can now create and edit learner profiles with explicit
  external refs, display names and Year 1-7 routing in the admin console.
- Platform admins can now create and edit schools with stable URN/import keys.
- Platform admins can now create school staff access records with login IDs and
  one-time temporary passwords for school admins and teachers.
- Platform admins can now create classes against configured schools and assign
  learners to classes through protected admin endpoints.
- School staff can now use delegated school-scoped endpoints and the school
  workspace to create pupils, create classes, assign pupils, generate login
  batches, create teaching/intervention groups and assign pupils to groups
  without using the platform admin key.
- Direct parents can now create a family account, create child profiles, generate
  child-friendly access and complete an Adaptive Inclusion Profile covering
  declared support needs, learning approach, sensory load, audio/reading support,
  processing support, confidence support, companion tone and reward style.
- Learner runtime endpoints now expose `runtime_adaptations` derived from the
  child's Adaptive Inclusion Profile. Short-burst/attention profiles reduce
  mission question count, low-sensory/reduced-motion profiles start in calmer
  animation mode, and audio/reading/confidence supports are returned as explicit
  runtime instructions.
- Platform admins can now create pupil access records with login codes, picture
  password choices and QR secret hash fields ready for login-card generation.
- Platform admins can now generate login-code and picture-password batches for
  an entire class, so pupils do not need email/password sign-up.
- Platform admins can now create teaching/intervention groups and assign pupils
  to those groups.
- Platform admins can now link parent/guardian/carer accounts to existing
  learners without requiring pupil email/password sign-up.
- Parents, schools and tutoring organisations now have a public request-access
  route that collects contact, organisation, learner count and Year 1-7 demand.
- The public request-access route now keeps first contact lightweight: only
  essential details are required, while year groups, learner counts and SEND
  support needs are optional structured selections.
- Platform admins can now review public access requests, move them through
  onboarding statuses and use those records to decide school setup, tutor cohort
  setup, parent linking and priority resource production.
- Admin config reads now include schools, classes and pupil credential records,
  so the console has one operational view of curriculum, worlds, rewards,
  learners and school structure.
- Migration `0008_school_management_constraints` adds school/class indexes and
  class membership lookup indexes for reliable school administration.
- Public API now exposes `/v1/curriculum/map`, grouping configured objectives
  by year, subject, strand and topic for product, parent and admin surfaces.
- Starter seed content now covers representative objectives across Years 1-7
  and Mathematics, English and Science instead of presenting the platform as a
  Year 4 multiplication product.
- Landing page now uses the live curriculum map, live world catalogue and live
  next learner route to show a strategic Nexusverse/product view.
- Public runtime feature flags now have a safe unauthenticated endpoint and the
  frontend consumes them for child play entry, public access requests, family
  signup, school workspace visibility and prototype/demo labels.
- The public homepage, child play entry, access request flow and direct family
  workspace have been restructured into clearer product routes instead of
  exposing learning content as an unorganised landing-page list.
- The access request flow now separates essential contact details from optional
  Year-group, SEND/support-needs and learning-approach context, so families and
  schools are not forced into free-text diagnosis capture.
- The direct family workspace now presents parent access, child credentials and
  the Adaptive Inclusion Profile as separate operational steps, with visible
  runtime adaptation feedback for mission length, sensory load, audio, reading
  support, scaffolding and reward style.
- School workspaces can now print pupil login cards from generated credential
  batches. Each card includes the learner name, login code, picture-password
  sequence and a real QR code that carries the pupil/code route back into the
  NexusLearn child entry.
- Pupil login now has a Phase 3 bridge endpoint and child-facing `/login` page.
  It verifies the printed login code, optional QR card hash and
  picture-password sequence before returning the learner profile and next
  configured mission route.
- The web dependency audit is clean. Next is pinned at the latest available
  `16.2.9`, with an npm override forcing its transitive PostCSS dependency to
  patched `8.5.10`; this keeps the framework current while closing the
  PostCSS advisory without applying npm's unsafe downgrade suggestion.
- Platform admins now have a protected content readiness report at
  `/v1/admin/content/readiness` and an Admin Console Readiness tab. Each
  objective is scored against teaching design, runtime-approved activities,
  published question evidence, required formats, hints, explanations,
  prerequisite/misconception mapping and animation hooks, so the product does
  not treat a topic as ready just because it has questions.
- Learner mission routing now refuses draft/review activities even when an
  `activityId` is supplied directly. Child runtime content must be `approved`,
  `published` or `live`; draft content remains authoring-only until a proper
  preview/release workflow exists.
- Curriculum research now has a build-governing blueprint, source register,
  objective-pack JSON schema and model Year 4 multiplication pack. This gives
  the content team an auditable path from official curriculum source to teaching
  sequence, interactive manipulative, variants, SEND adaptations, animation
  states, evidence and QA.
- Objective-pack importer CLI now validates rich packs, compiles admin API
  payloads and can publish reviewed packs into objectives, activities,
  questions and reward rules through protected admin endpoints.
- Objective-pack importer can now generate static reviewer previews showing
  validation warnings, curriculum source alignment, teaching journey, animation
  hooks, manipulatives, adaptive supports, question variants and admin payload
  summary before live import.
- Curriculum breadth now has an explicit Year 1-7 core pack roadmap covering
  priority Mathematics, English and Science packs for every year group. This
  prevents the product from silently narrowing back to one Year 4 maths slice.
- Objective-pack samples now cover every year from Year 1 to Year 7:
  Year 1 phonics blending, Year 2 sentence punctuation, Year 3 tenths
  fractions, Year 4 multiplication fluency, Year 5 reading inference, Year 6
  ratio/scale and Year 7 algebraic expression simplification. Each sample
  includes teaching sequence, manipulative, misconception repairs, adaptive
  supports, animation hooks, evidence language, variant-bank blueprint and
  generated admin payload/preview support.
- Year 1-7 equal-depth specification now defines the same level of product
  detail for every year: learner need, world identity, Mathematics/English/
  Science contract, flagship interactions, animation language, companion role,
  inclusion model, assessment evidence and proof-pack expectations.
- Variant-bank planning now raises the content bar beyond early low-volume item
  assumptions. Packs must target at least 150 pilot variants, 300 release
  variants and mature banks in the hundreds to 1500+ range depending on the
  objective family.
- The 29 current proof-pack samples plan 40,950 mature-bank variants before
  deep expansion. These are planning blueprints, not a claim that the reviewed
  item banks are complete.
- Coverage matrix tooling now compares the Year 1-7 roadmap with authored packs
  and generated previews, so core subject gaps remain visible instead of being
  hidden by the presence of one strong proof pack per year.
- Balanced content expansion added a second rich objective-pack sample for
  every year: Year 1 counting within 100, Year 2 two-digit addition/subtraction,
  Year 3 plant functions, Year 4 simple circuits, Year 5 equivalent fractions,
  Year 6 inference justification and Year 7 particles/states of matter.
- Balanced content expansion added the next seven queue-selected packs:
  Year 1 common plants, Year 2 material suitability, Year 3 paragraph grouping,
  Year 4 fronted adverbials, Year 5 Earth/space models, Year 6 light/shadows and
  Year 7 literature inference.
- Authored proof-pack coverage is now 29 of 29 roadmapped core packs, with
  40,950 planned mature-bank variants across Mathematics, English and Science.
- Every year now has at least one authored Mathematics, English and Science
  proof pack, so Phase 3 breadth is no longer dependent on one subject in any
  year group.
- Production-queue tooling now reports zero missing Phase 3 core roadmap packs.
  The same queue pattern should be reused for the next roadmap wave and for
  deciding which proof packs move first into pilot-grade reviewed banks.

## Remaining Hardcode Audit

Known areas still to close:

- Public UI structure has been cleaned up, but the next visual-quality pass
  still needs produced visual assets, stronger child-facing animation states and
  polished brand illustration before the experience can be considered
  best-in-class.
- API key based admin auth.
- Feature flags are editable and now consumed by the homepage/play entry for
  public runtime journeys. More granular feature consumption is still needed for
  later interaction renderers, audio rollout and school pilot controls.
- Reward rules now drive persisted attempt reward/animation/copy responses and
  are editable in admin.
- JSON payloads have structural validation for the initial runtime interaction
  types; each new renderer needs matching validation before it is considered
  production-ready.
- More interaction types remain to build, including tracing, drag/drop, sorting
  and sentence construction.
- Pure no-database scoring still has safe fallback copy; database-backed runtime
  applies configured reward policies.
- Learner profile creation, school setup, class setup, class assignment, pupil
  credential records, class credential batches, intervention groups and parent
  account links exist at platform-admin level; public access requests can now be
  reviewed by admins; school admins can manage internal structure through
  school-scoped endpoints, print generated login cards and route pupils through
  the child login bridge. Full staff RBAC, parent invitation emails,
  request-to-school conversion automation and production-grade pupil session
  tokens are still pending.
- Full-depth resource production across Years 1-7 and subjects remains a major
  content workstream. The Phase 3 core roadmap is fully authored as proof packs,
  and the packs define the desired depth, but each objective still needs
  production-scale reviewed variant volume, teacher review, accessibility
  review, safeguarding review, audio/art asset production and pilot evidence
  before it is considered complete.
- Content rollback/version history remains pending. Current validation,
  readiness reporting and runtime status gates reduce the risk of incomplete
  content, but authors still need preview, approval workflow, restore points and
  release channels before production-scale content editing.
- Objective packs now have a dependency-free importer/validator with bulk
  folder validation, strict warning gates, live diff/dry-run and sample publish
  protection. Remaining importer work before large-scale production: content
  version rows, rollback snapshots, field-level patch output, asset manifest
  validation and richer interactive preview.
- Adaptive Inclusion Profiles are now stored, exposed through parent flows and
  consumed by the mission/next-activity runtime foundation. Phase 4 still needs
  deeper adaptive selection rules so prerequisite routing, misconception repair
  and teaching sequence choice respond to those profiles.
- Current mission visuals are code-native SVG/CSS. The next visual pass should
  add a formal asset pipeline for companion variants, world backdrops and
  interaction-specific animation states.
