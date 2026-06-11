# NexusLearn Master Blueprint

Status: Source-of-truth product, curriculum and engineering blueprint  
Audience: Founder/product owner, developers, designers, curriculum authors, school partners  
Scope: UK Years 1-7 adaptive animated learning platform  
Date: 11 June 2026

## 1. Executive Summary

NexusLearn should become a full Years 1-7 adaptive learning platform, not a single game, quiz site or dashboard. The strongest product direction is:

> A curriculum-mapped adaptive learning world system where children master objectives through interactive missions, animated feedback and persistent world growth, while parents and schools see clear evidence of progress.

The existing repository is an early scaffold. It proves that a Vercel frontend and Render API can exist, but it does not yet represent the desired product quality. The correct next move is a controlled rebuild inside the repo:

- Keep the deployment shell and monorepo direction.
- Keep useful API naming and the live proof mission as reference only.
- Rebuild the design system, curriculum engine, activity runtime, content pipeline, animation architecture and dashboards properly.

Year 4 Dino-Craft should be the first proof slice because it tests many hard reusable systems, but the platform must be designed from day one for Years 1-7 and multiple subjects.

## 2. Source Inputs Reviewed

This blueprint is based on:

- The 34-page NexusLearn / WonderPath technical specification PDF.
- The additional feedback supplied by the product owner.
- The current GitHub repository structure and implementation.
- Live API/frontend smoke checks.
- The intended deployment targets: GitHub, Vercel and Render.

Key original specification areas incorporated:

- Product vision
- Curriculum hierarchy
- Learning design principles
- Year 1-7 world strategy
- Personalisation and learning profiles
- Adaptive engine inputs/outputs
- School product model
- Parent product model
- Gamification and reward model
- Animation principles
- Accessibility and inclusion
- Assessment and reporting
- Technical architecture
- Database model
- API requirements
- Safeguarding and data protection
- Admin/CMS
- AI content guardrails
- MVP and roadmap
- Acceptance criteria

## 3. Repository Review

### Current Repository Contents

Observed structure:

```text
apps/
  web/     Next.js app
  api/     Go API
docs/
  IMPLEMENTATION_PLAN.md
README.md
```

After this blueprint update, the repo also contains:

```text
docs/
  MASTER_IMPLEMENTATION_PLAN.md
  CURRICULUM_AND_CONTENT_STRATEGY.md
  ANIMATION_UX_AND_ACCESSIBILITY_STRATEGY.md
  NEXUSLEARN_MASTER_BLUEPRINT.md
packages/
  content/
    objectives/
      year-1-phonics.sample.json
      year-4-maths.sample.json
```

### Current Strengths

- Simple monorepo shape.
- Frontend and API are separated.
- API has a small demo mission and attempt scoring endpoint.
- Frontend can call the API but also survive cold API startup.
- Existing deployment claim is plausible after checking correct endpoints.
- The project has enough scaffolding to rebuild without starting completely from zero.

### Current Weaknesses

- UI quality is prototype-level.
- The app visually over-indexes on one Year 4 mission.
- No real curriculum graph.
- No database persistence.
- No content CMS.
- No proper activity runtime.
- No full adaptive engine.
- No school onboarding.
- No real parent/teacher data.
- No design system.
- No production-grade animation pipeline.
- No proper acceptance gates.
- Previous docs are useful but not detailed enough to govern a serious build.

### Recommendation

Do not delete the repo yet. Use it as a deployment and source-control container, but rebuild the product layer.

Decision:

- Repository: keep.
- Current UI: replace.
- Current API: evolve from scaffold.
- Current docs: supersede with this blueprint and supporting docs.
- Current Year 4 mission: keep as a temporary proof, not as architecture or creative ceiling.

## 3.1 Updated Creative Direction: Think Bigger Than Dino-Craft

Dino-Craft is engaging enough for a first proof, but it is too narrow to carry the whole product vision. The stronger flagship direction is a connected **Nexusverse** or **Wonderpath Map**:

```text
Personal Learning Hub
  Year Realms
  Subject Portals
  Companion Team
  Persistent World Growth
  Mistake Museum
  Create Mode
  Class Co-op Quests
  Curriculum Engine Underneath
```

The child should feel they are travelling through a living learning universe, not sitting inside one themed maths game.

Key creative decision:

```text
Replace "Dino-Craft is the flagship" with "Dino Lab is the first biome inside the wider Nexusverse."
```

Year 4 can become **Inventor Wilds**, a broader world with:

- Dino Lab
- Volcano Workshop
- Crystal Caves
- Rainforest Canopy
- River Engineering Zone
- Sky Bridge Observatory

This lets Year 4 cover Maths, English, Science and Geography without every activity needing to be dinosaur-themed.

## 4. Product Benchmark and Quality Target

NexusLearn should not benchmark itself against simple homework quiz sites. It should aim for a hybrid quality bar:

- Curriculum trust similar to serious school platforms.
- Engagement loop closer to high-quality children's games.
- Parent clarity similar to premium tutoring feedback.
- Teacher usefulness similar to intervention planning tools.
- Accessibility and safeguarding expected of school-ready child software.

### Products to Learn From

Not as copies, but as benchmark categories:

- Duolingo: session rhythm, feedback, streak caution, skill paths.
- Khan Academy Kids: younger child warmth, audio-led UX, friendly companions.
- Prodigy / gamified maths platforms: motivation and world progression, while avoiding weak curriculum mapping.
- Times Tables Rock Stars: focused fluency loop and measurable outcomes.
- Century / Sparx-style systems: adaptive learning and school reporting.
- Scratch / Minecraft education patterns: creativity, agency and world-building.

### Differentiation

NexusLearn should win by combining:

- UK curriculum objective mapping.
- Animated age-specific worlds.
- Adaptive prerequisite repair.
- Parent and school evidence.
- Persistent world growth.
- Mistake-positive learning design.
- Accessibility and low-sensory modes.

## 5. Product Scope

### Year Groups

- Year 1: early number, phonics, listening, letter formation.
- Year 2: reading fluency, sentence building, number bonds, spelling.
- Year 3: lower KS2 transition, times tables, fractions, paragraphs, science/geography exploration.
- Year 4: MTC readiness, multiplication/division, area/perimeter, grammar, states of matter, electricity.
- Year 5: fractions/decimals/percentages, multi-step reasoning, Earth and space, inference, complex sentences.
- Year 6: SATs readiness, arithmetic, reasoning, reading comprehension, grammar, writing quality, transition.
- Year 7: secondary transition, algebra, ratio, science labs, literature, geography/history analysis, study habits.

### Subjects

Build order:

1. Mathematics
2. English Reading
3. Phonics and Spelling
4. English Writing and Grammar
5. Science
6. Computing
7. Geography
8. History
9. Design and Technology
10. Art, Music, PSHE-style knowledge and cross-curricular projects

### Product Modes

- Home learner mode
- Parent dashboard mode
- School pupil mode
- Teacher dashboard mode
- SENCO/intervention mode
- School admin mode
- Platform admin/CMS mode

## 6. Full Platform Architecture

### High-Level Architecture

```text
Web App
  Child Worlds
  Activity Runtime
  Parent Dashboard
  Teacher Dashboard
  School Admin
  CMS Admin

API
  Auth Service
  User/Profile Service
  School Service
  Curriculum Service
  Content Service
  Learning Session Service
  Adaptive Engine
  Assessment Service
  Reward/World Service
  Reporting Service
  Notification Service
  Audit Service

Data
  PostgreSQL
  Object Storage
  CDN
  Analytics/Event Store
  Background Job Queue
```

### Frontend Architecture

Recommended stack:

- Next.js
- TypeScript
- Tailwind or a strongly governed component system
- PixiJS/Canvas for interactive learning scenes
- Rive for production companion animation
- CSS motion for dashboard and general UI
- Web Audio API for sound effects
- Pre-generated narration files for younger years

Frontend modules:

```text
apps/web/src/
  app/
    play/
    parents/
    teacher/
    school/
    admin/
  components/
    design-system/
    child-ui/
    dashboards/
    worlds/
    activities/
  lib/
    api/
    audio/
    accessibility/
    animation/
    curriculum/
    offline/
```

### Backend Architecture

Recommended stack:

- Go is acceptable if the team can support it.
- TypeScript backend is also acceptable if faster full-stack iteration is needed.
- PostgreSQL for core data.
- Background worker for spaced review, reporting and analytics processing.

Backend modules:

```text
apps/api/
  cmd/server
  internal/
    auth
    users
    schools
    curriculum
    content
    learning
    adaptive
    assessment
    rewards
    reporting
    audit
```

### Data Storage

PostgreSQL:

- Identity
- Schools/classes/groups
- Student profiles
- Curriculum objectives
- Content versions
- Attempts
- Mastery records
- Assignments
- Rewards
- World state
- Reports
- Audit logs
- Consent records

Object storage/CDN:

- Rive files
- Sprite sheets
- Narration audio
- World background assets
- Printable login cards
- Exports

## 7. Database Model

### Identity and Roles

- users
- roles
- user_roles
- schools
- school_users
- parents
- parent_children
- students
- student_credentials
- consent_records

### School Structure

- classes
- groups
- group_members
- teacher_class_assignments
- school_import_batches
- login_cards

### Student Profile

- student_learning_profiles
- student_accessibility_settings
- student_interest_profiles
- student_baselines
- student_session_preferences

### Curriculum

- key_stages
- year_groups
- subjects
- strands
- topics
- subtopics
- curriculum_objectives
- objective_prerequisites
- misconceptions
- objective_misconceptions
- learning_outcomes
- mastery_rules

### Content

- lessons
- lesson_steps
- activities
- activity_templates
- questions
- answer_options
- explanations
- hints
- media_assets
- audio_assets
- game_mappings
- content_versions
- content_review_status

### Learning Evidence

- learning_sessions
- activity_attempts
- question_attempts
- hint_events
- confidence_events
- audio_events
- task_abandon_events
- retention_reviews
- prerequisite_probes

### Mastery

- student_objective_mastery
- student_prerequisite_mastery
- student_misconception_state
- mastery_history
- spaced_review_queue

### Rewards and Worlds

- worlds
- world_regions
- world_tiles
- reward_items
- student_rewards
- inventory_items
- student_inventory
- companion_state
- student_world_state
- mistake_museum_items
- class_quests
- class_quest_contributions

### Reporting and Admin

- parent_reports
- teacher_reports
- school_reports
- intervention_plans
- audit_logs
- data_exports
- feature_flags

## 8. Curriculum Engine

### Curriculum Graph

Every objective exists in a graph:

```text
Objective
  prerequisites
  misconceptions
  related objectives
  review schedule
  activity templates
  mastery rules
  reporting language
```

The adaptive engine uses this graph to decide:

- what to teach
- what to practise
- what to review
- when to scaffold
- when to route backwards
- when to re-escalate
- when to alert an adult

### Objective Pack

Each objective pack must include:

- id
- year
- subject
- strand
- topic
- statement
- skill statement
- prerequisites
- misconceptions
- activity templates
- question variants
- hint ladder
- explanations
- audio script
- animation hooks
- mastery rules
- parent explanation
- teacher evidence statement

### Content Coverage Strategy

Do not attempt all Years 1-7 at equal depth immediately. Build coverage in rings.

Ring 1:

- Year 4 Maths
- Year 3 prerequisite Maths
- Year 5 extension Maths
- Year 1 phonics/number sample

Ring 2:

- Year 1-2 phonics and number foundations
- Year 6 arithmetic and reading
- Year 3-5 Maths depth

Ring 3:

- English reading
- Grammar and writing
- Science

Ring 4:

- Computing
- Geography
- History
- DT
- Cross-curricular projects

## 9. Adaptive Algorithm

### Inputs

The engine should consider:

- year group
- assigned objective
- current mastery
- prerequisite mastery
- accuracy
- speed
- attempts
- hint usage
- confidence rating
- response changes
- abandoned tasks
- audio usage
- accessibility profile
- fatigue indicators
- teacher assignments
- parent assignments
- due spaced reviews
- recent topics
- curriculum priority

### Outputs

The engine returns:

- next activity
- objective id
- difficulty
- interaction type
- whether to scaffold
- whether to reteach
- whether to review
- whether to move forward
- whether to trigger a break
- reward intensity
- adult alert recommendation
- explanation string

### Mastery Score

Each objective has a mastery score from 0 to 100.

Bands:

- 0-19: Unknown / Not started
- 20-39: Introduced
- 40-59: Developing
- 60-79: Nearly secure
- 80-89: Expected standard
- 90-100: Secure / greater depth

### Mastery Update Formula

For v1, use explainable rules, not machine learning.

Base update:

```text
if correct:
  gain = base_gain * difficulty_factor * format_factor
else:
  loss = base_loss * misconception_factor
```

Modifiers:

```text
hint_used lowers gain
slow_response lowers fluency gain, not conceptual gain
high_confidence_wrong increases misconception check priority
low_confidence_correct triggers confidence-building repeat
repeated_success across formats increases mastery cap
retention success after days unlocks higher mastery cap
```

Suggested v1 values:

```text
base_gain = 4 to 10
base_loss = 1 to 4
hint penalty = 30-50 percent
same-day mastery cap = 75
mastery above 80 requires at least one review day
mastery above 90 requires varied formats and retention
```

### Spaced Review Algorithm

Default review intervals:

- 1 day
- 3 days
- 7 days
- 14 days
- 30 days

Adjustments:

- If review correct and confident: extend interval.
- If review correct but low confidence: repeat soon.
- If review incorrect: route to misconception or prerequisite probe.
- If multiple reviews missed: prioritise short warm-up.

### Back-Scaffolding Algorithm

When a child struggles:

1. Check whether the error maps to a known misconception.
2. If yes, serve misconception repair activity.
3. If no, probe prerequisites with 2-4 quick diagnostic items.
4. Select the weakest prerequisite.
5. Route to foundation activity.
6. After success, re-escalate to the original objective.

Example:

```text
Problem: Area of rectangle incorrect
Possible causes:
  weak multiplication
  counting squares issue
  area/perimeter confusion
  reading dimensions issue

Engine probes:
  array build
  perimeter identify
  count squares
  dimension read

Decision:
  route to weakest prerequisite, then return to area
```

### Next Activity Selection

Priority order:

1. Teacher assignment due soon
2. Spaced review due
3. Current objective continuation
4. Misconception repair
5. Prerequisite probe
6. New objective in pathway
7. Enrichment objective

The engine should never ignore teacher assignments, but it can scaffold inside them.

### Explainability

Every adaptive decision must produce a human-readable reason:

- "Reviewing 7 x 8 because it was missed in the last session."
- "Routing to arrays because area errors suggest a multiplication foundation gap."
- "Repeating with a different format because the answer was correct but confidence was low."
- "Reducing animation intensity because low-sensory mode is enabled."

## 10. Activity Runtime

The app should not hard-code lessons. It should run activity definitions.

Activity definition:

```json
{
  "id": "act-y4-array-builder-7x8",
  "objective_id": "ma-y4-number-multiplication-12x12",
  "type": "array-build",
  "world": "dino-craft",
  "prompt": "Build 7 rows of 8 blocks.",
  "difficulty": 6,
  "interaction": {
    "kind": "drag-build",
    "target_rows": 7,
    "target_columns": 8
  },
  "feedback": {
    "success": "Yes. 7 rows of 8 makes 56.",
    "scaffold": "Try making 5 rows first, then add 2 more rows."
  },
  "animation_hooks": {
    "success": "incubator-charge",
    "error": "array-highlight",
    "mastery": "fossil-unlock"
  }
}
```

Reusable interaction types:

- tap-choice
- number-pad
- drag-sort
- match-pairs
- drag-build
- array-builder
- sequence-cards
- word-build
- sentence-build
- highlight-text
- trace-path
- timeline-arrange
- map-locate
- simulation-slider
- free-write
- audio-listen
- timed-recall
- teach-back

## 11. Animation and World Strategy

### Year 1: Number Garden and Letter Zoo

Purpose:

- Audio-led early learning.
- Concrete number and letter representation.

Signature interactions:

- Count butterflies.
- Feed number bugs.
- Match animal sounds to letters.
- Trace letter paths.
- Build CVC words with stones.

Animation:

- Soft character bounces.
- Gentle letter morphs.
- Calm sparkles.
- No fast motion.

### Year 2: Storybook Kingdom

Purpose:

- Reading confidence, phonics consolidation and sentence building.

Signature interactions:

- Repair story bridges with decoding.
- Build sentences with blocks.
- Sequence picture events.
- Trace spelling words.

Animation:

- Page turns.
- Glowing trails.
- Word-by-word highlighting.
- Narrated story panels.

### Year 3: Explorer Islands

Purpose:

- Transition from basic skills to reasoning.

Signature interactions:

- Sail to islands.
- Use tools to solve missions.
- Build field journal pages.
- Debug simple code caves.

Animation:

- Boat movement.
- Island unlocks.
- Puzzle doors.
- Badge reveal.

### Year 4: Inventor Wilds

Purpose:

- Multiplication fluency, visual maths, science missions, engineering and exploration.

Biomes:

- Dino Lab
- Volcano Workshop
- Crystal Caves
- Rainforest Canopy
- River Engineering Zone
- Sky Bridge Observatory

Signature interactions:

- Power incubators.
- Build arrays.
- Design habitats by area/perimeter.
- Locate dig sites with coordinates.
- Repair misconception fossils.
- Use grammar to repair expedition logs.
- Use states of matter to control lab machines.
- Use geography to map wild zones.

Animation:

- Isometric tile placement.
- Fossil bursts.
- Dino companion state changes.
- Lab machines charging.
- Drone flights.
- Bridges assembling.
- Volcano pressure simulations.

### Year 5: Space Engineers and Eco Cities

Purpose:

- Systems thinking, fractions/decimals/percentages, Earth and space, reading inference.

Signature interactions:

- Balance oxygen/water/energy.
- Convert fractions to configure engines.
- Run orbit simulations.
- Design eco-city districts.

Animation:

- Orbits.
- Resource meters.
- Engine charge.
- City lights.

### Year 6: Quest Academy

Purpose:

- SATs readiness and confidence.

Signature interactions:

- Skill arenas.
- Booster rooms.
- Boss battles against misconceptions.
- Reading inference missions.

Animation:

- Training room unlocks.
- Progress gates.
- Calm mastery badges.

### Year 7: Future Worlds Lab

Purpose:

- Secondary transition and independent study.

Signature interactions:

- Algebra machines.
- Ratio blueprints.
- Force simulations.
- Literature theme maps.
- Historical investigations.

Animation:

- Lab dashboards.
- Simulation motion.
- Blueprint lines.
- Strategy UI.

## 12. UX System

### Child UX

Requirements:

- First task visible quickly.
- One main action at a time.
- Clear target.
- Friendly failure.
- Short task batches.
- Audio support where needed.
- Visible progress.
- World changes after learning.

### Parent UX

Requirements:

- Plain-English progress.
- Strengths and gaps.
- What to do next.
- How confidence is changing.
- What the platform will revisit.
- No overwhelming data.

### Teacher UX

Requirements:

- Objective heatmaps.
- Class and group views.
- Assignment control.
- Intervention recommendations.
- Exportable reports.
- Pupil login support.
- Fast scanning.

### Admin/CMS UX

Requirements:

- Curriculum editing.
- Content versioning.
- Review status.
- Asset management.
- Feature flags.
- School management.
- Audit trail.

## 13. API Endpoint Blueprint

### Auth

```text
POST /v1/auth/login
POST /v1/auth/logout
POST /v1/auth/refresh
POST /v1/auth/pupil-login
POST /v1/auth/pin-reset
POST /v1/auth/password-reset
```

### Users and Profiles

```text
GET  /v1/me
GET  /v1/students/:studentId
POST /v1/students
PATCH /v1/students/:studentId
GET  /v1/students/:studentId/profile
PATCH /v1/students/:studentId/accessibility
PATCH /v1/students/:studentId/preferences
```

### Schools

```text
POST /v1/schools
GET  /v1/schools/:schoolId
POST /v1/schools/:schoolId/classes
GET  /v1/schools/:schoolId/classes
POST /v1/classes/:classId/pupils/import
POST /v1/classes/:classId/login-cards
POST /v1/groups
POST /v1/groups/:groupId/members
```

### Curriculum

```text
GET  /v1/curriculum/years
GET  /v1/curriculum/subjects
GET  /v1/curriculum/objectives?year=&subject=&strand=
GET  /v1/curriculum/objectives/:objectiveId
GET  /v1/curriculum/objectives/:objectiveId/prerequisites
GET  /v1/curriculum/objectives/:objectiveId/misconceptions
```

### Content

```text
GET  /v1/content/activities/:activityId
GET  /v1/content/objectives/:objectiveId/activities
POST /v1/admin/content/objectives
POST /v1/admin/content/activities
POST /v1/admin/content/review/:contentId
POST /v1/admin/content/publish/:contentId
```

### Learning

```text
POST /v1/learning/session/start
POST /v1/learning/session/end
GET  /v1/learning/next?studentId=
POST /v1/learning/attempt
POST /v1/learning/hint-used
POST /v1/learning/confidence
POST /v1/learning/task-abandoned
GET  /v1/learning/warm-up?studentId=
```

Initial implemented foundation endpoints:

```text
GET /v1/curriculum/objectives
GET /v1/curriculum/objectives/{id}
GET /v1/students/{studentId}/mastery
GET /v1/learning/warm-up?studentId=
GET /v1/learning/next?studentId=
```

### Adaptive Engine

```text
POST /v1/adaptive/next-activity
POST /v1/adaptive/probe-prerequisite
POST /v1/adaptive/update-mastery
GET  /v1/adaptive/explanation/:decisionId
```

### Rewards and Worlds

```text
GET  /v1/worlds/student/:studentId
PATCH /v1/worlds/student/:studentId
POST /v1/rewards/award
GET  /v1/rewards/student/:studentId
POST /v1/mistake-museum/unlock
GET  /v1/companions/student/:studentId
PATCH /v1/companions/student/:studentId
```

### Assignments

```text
POST /v1/assignments
GET  /v1/assignments?classId=&studentId=
PATCH /v1/assignments/:assignmentId
POST /v1/assignments/:assignmentId/complete
```

### Reporting

```text
GET /v1/reports/parent/:studentId
GET /v1/reports/teacher/class/:classId
GET /v1/reports/school/:schoolId
GET /v1/reports/interventions/:groupId
POST /v1/reports/export
```

### Admin and Compliance

```text
GET  /v1/admin/audit
GET  /v1/admin/feature-flags
PATCH /v1/admin/feature-flags/:flag
POST /v1/data/export
POST /v1/data/delete-request
GET  /v1/compliance/subprocessors
```

## 14. Content Creation System

### Roles

- Curriculum lead
- Subject author
- Content reviewer
- Accessibility reviewer
- Safeguarding reviewer
- Voice/audio producer
- Animator/designer
- Teacher pilot reviewer

### Workflow

1. Map objective.
2. Define prerequisites.
3. Define misconceptions.
4. Write teach moment.
5. Choose activity templates.
6. Generate question variants.
7. Write hints and explanations.
8. Write audio scripts.
9. Attach animation hooks.
10. Review for curriculum accuracy.
11. Review for safeguarding/accessibility.
12. Publish to staging.
13. Pilot with children/teachers.
14. Calibrate difficulty.
15. Publish to production.

### AI Usage

AI can help with:

- question variations
- hint wording
- explanation drafts
- parent summaries
- teacher notes
- differentiated text
- misconception examples

AI must not:

- publish without review
- invent curriculum objectives
- diagnose children
- create open chat
- replace teacher judgement
- generate unsafe or unmoderated content

## 15. Deployment and DevOps

### Environments

- local
- preview
- staging
- production

### Services

- Vercel for frontend
- Render for API
- Managed PostgreSQL
- Object storage for assets
- CDN for media

### CI/CD Requirements

Each pull request should run:

- TypeScript check
- frontend build
- API tests
- content schema validation
- linting
- basic accessibility checks
- dependency vulnerability check

### Secrets

Rules:

- No tokens in repository.
- No tokens in docs.
- Use provider secret stores.
- Rotate tokens exposed in chat before production.
- Use least-privilege tokens for CI/CD.

## 16. Compliance and Safeguarding

Required:

- UK GDPR alignment
- Data Protection Act 2018 alignment
- ICO Age Appropriate Design Code / Children's Code alignment
- Data Processing Agreement for schools
- Data Protection Impact Assessment before school pilots
- subprocessor list
- data retention schedule
- deletion/export processes
- breach response process
- role-based access
- audit logs
- high privacy defaults
- no behavioural advertising
- no public child profiles
- no open pupil chat
- no unnecessary geolocation

Important: final compliance materials need legal review before school procurement.

## 17. Build Phases

### Phase 0: Blueprint and Rebuild Foundation

Deliver:

- master blueprint
- curriculum strategy
- animation/UX strategy
- repo cleanup
- design system direction
- initial content schemas
- rebuild decision log

### Phase 1: Platform Skeleton Rebuild

Deliver:

- new UI shell
- proper routes
- design system primitives
- child world entry
- parent dashboard shell
- teacher dashboard shell
- API health/version
- auth skeleton
- content package validation

### Phase 2: First Learning Engine

Deliver:

- PostgreSQL schema
- learning sessions
- attempt logging
- mastery records
- next-activity endpoint
- spaced review queue
- prerequisite probing
- Year 4 Maths objective pack

### Phase 3: First Best-in-Class Playable Slice

Deliver:

- Dino-Craft Year 4 Maths world
- 8-12 high-quality objectives
- array builder
- timed recall
- area/perimeter builder
- companion reactions
- Mistake Museum
- persistent world state
- parent report using real data

### Phase 4: Curriculum Breadth Proof

Deliver:

- Year 1 Number Garden phonics/number
- Year 2 Storybook reading
- Year 5 Space Engineers maths/science sample
- shared activity runtime across different year styles

### Phase 5: School Pilot

Deliver:

- school onboarding
- class import
- pupil login cards
- groups
- assignments
- teacher objective heatmap
- intervention suggestions
- exportable reports

### Phase 6: Core Subject Expansion

Deliver:

- Maths Years 1-7 wider coverage
- English reading Years 1-7
- phonics and spelling
- grammar and writing
- science packs

### Phase 7: Wider Curriculum and Procurement

Deliver:

- computing
- geography
- history
- DT
- MIS integration exploration
- trust support
- billing
- compliance pack
- accessibility audit

## 18. Risks

### Product Risks

Risk: Too broad too early.  
Mitigation: Build vertical slices with reusable architecture.

Risk: Feels like a quiz, not a world.  
Mitigation: Persistent world state and animation hooks tied to mastery.

Risk: Children enjoy it but do not learn.  
Mitigation: Objective mapping, mastery rules and evidence reporting.

Risk: Schools do not trust it.  
Mitigation: Explainable adaptation, teacher reports and curriculum transparency.

### Curriculum Risks

Risk: Content production becomes the bottleneck.  
Mitigation: content schemas, review workflow and reusable activity templates.

Risk: Coverage is shallow.  
Mitigation: build objective packs with prerequisites, misconceptions and mastery.

Risk: AI-generated content is inaccurate.  
Mitigation: human review and content approval workflow.

### Technical Risks

Risk: Animation performance poor on Chromebooks.  
Mitigation: rendering tiers, asset budgets and early device testing.

Risk: Offline/weak Wi-Fi problems.  
Mitigation: cache next lesson, queue attempts and sync later.

Risk: Data model hard-coded to first slice.  
Mitigation: year-agnostic and subject-agnostic schemas.

Risk: Too many services too early.  
Mitigation: modular monolith first, clear domain boundaries.

### Compliance Risks

Risk: School procurement blocked.  
Mitigation: DPIA, DPA, retention schedule, audit logs and privacy-by-design.

Risk: Child data overcollection.  
Mitigation: data minimisation and purpose limitation.

Risk: Manipulative engagement.  
Mitigation: no public leaderboards, no shame streaks, no behavioural ads.

## 19. Acceptance Criteria

### Platform-Level Acceptance

- Supports Years 1-7 in schema and navigation.
- Supports multiple subjects in schema.
- Every activity maps to an objective.
- Every attempt produces learning evidence.
- Every adaptive decision is explainable.
- Parent report uses plain English.
- Teacher report shows objective-level progress.
- Low-sensory and reduced-motion modes exist.
- Pupil login does not require child email.
- Data is protected by role-based access.

### Curriculum Acceptance

- Objective has prerequisites.
- Objective has misconceptions.
- Objective has mastery rules.
- Objective has at least one activity.
- Objective has hints and explanations.
- Objective has parent and teacher language.
- Objective has review intervals.

### Activity Acceptance

- Clear instruction.
- Fast feedback.
- Success state.
- Incorrect state.
- Scaffolded retry.
- Reduced-motion equivalent.
- Sound-off equivalent.
- Evidence event.
- Works on tablet/Chromebook layout.

### Animation Acceptance

- Animation has a learning or feedback purpose.
- Does not block progress.
- Runs smoothly on target devices.
- Respects reduced motion.
- Has low-sensory alternative.
- Does not rely on flashing.

### School Acceptance

- Teacher can create/import pupils.
- Pupils can log in without email.
- Teacher can assign work.
- Teacher can view class progress.
- Teacher can identify gaps.
- Teacher can create intervention groups.
- School can export/delete data.

### Launch Acceptance

- Frontend deployed.
- API deployed.
- Database migrations applied.
- Environment variables configured.
- Smoke tests pass.
- No secrets committed.
- Privacy and safeguarding review completed.
- At least one real child learning flow works end to end.

## 20. Rebuild Recommendation

The strategic decision is:

```text
Rebuild the product layer inside the existing repository.
```

Why:

- Starting fully from scratch wastes deployment and repo setup.
- Continuing the existing UI would lower the quality ceiling.
- A controlled rebuild keeps operational momentum while replacing weak product foundations.

Immediate rebuild tasks:

1. Freeze current prototype as reference.
2. Create proper design system.
3. Create curriculum package and validation.
4. Create data model and migrations.
5. Build activity runtime.
6. Build adaptive engine v1.
7. Rebuild child worlds from shared primitives.
8. Rebuild dashboards around objective evidence.

## 21. First 30-Day Build Plan

Week 1:

- Finalise blueprint.
- Clean repo structure.
- Set up CI checks.
- Define content schemas.
- Define database migrations.
- Create design tokens and UI primitives.

Week 2:

- Build new child world shell.
- Build activity runtime v1.
- Implement attempt logging.
- Implement mastery update v1.
- Add Year 4 Maths content pack.

Week 3:

- Build Dino-Craft world slice.
- Add array builder and timed recall.
- Add companion state system.
- Add world persistence.
- Add parent report using real data.

Week 4:

- Add spaced review queue.
- Add prerequisite probe.
- Add teacher dashboard shell.
- Add Year 1 phonics mini-slice to prove breadth.
- Test on mobile/tablet/Chromebook-like viewport.

## 22. Success Definition

The first serious milestone is not "many pages exist."

The first serious milestone is:

> A Year 4 child completes a Dino-Craft maths mission, the system logs evidence, updates mastery, schedules review, changes the child's world, repairs a misconception if needed, and shows the parent/teacher a clear explanation of what happened and what comes next.

The second serious milestone is:

> The same engine powers a Year 1 audio-led phonics mission, proving the platform is genuinely Years 1-7 capable rather than hard-coded around Year 4.

That is the path from prototype to best-in-class platform.
