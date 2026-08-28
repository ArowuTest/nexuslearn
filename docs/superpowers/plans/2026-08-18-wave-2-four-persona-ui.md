# NexusLearn Wave 2: Four-Persona UI Architecture

## Outcome

Turn the current feature-complete but oversized web surfaces into a coherent,
maintainable product for pupils, parents, schools/tutors and platform operators.
This wave improves information architecture and component boundaries without
weakening curriculum, SEND, safeguarding, privacy or release controls.

Wave 2 is one significant integration milestone. The three implementation
packages are combined, verified as a whole and then subjected to one
adversarial review. Minor extraction edits do not trigger separate pushes or
reviews.

## Product contract

- Curriculum, learner evidence, progression and operational state remain
  backend-authoritative.
- A learner may advance independently in Mathematics, English or Science while
  spaced retrieval continues in earlier material.
- SEND settings alter access, pacing and representation, never curriculum
  entitlement or the meaning of evidence.
- Rewards recognise effort, strategy, repair and demonstrated learning. They do
  not punish errors or use coercive streak pressure.
- Reduced-motion, low-sensory, keyboard and non-audio routes are first-class
  equivalents.
- Parents see only linked children. Schools and tutors see only learners in
  their organisation. Platform operations remain authenticated and audited.
- Mock assessments sample and report evidence; they do not directly overwrite
  adaptive mastery.
- AI review evidence does not represent human safeguarding, listening or pilot
  approval.

## Persona journeys

### Pupil

1. Enter through a child-safe login card, code, picture password or QR route.
2. See one understandable next action and the reason it was selected.
3. Follow Notice -> Try -> Repair -> Prove -> Grow -> Return.
4. Use configured audio, visual guide, simple text, high contrast, switch or
   reduced-motion support without losing the learning objective.
5. Receive constructive feedback and visible progress tied to learning.
6. Complete or resume subject checks without confusing them with mastery.

### Parent

1. Sign in before any linked-child data or workspace navigation is exposed.
2. Select only a linked child and retain that context across progress and mocks.
3. Understand progress by subject, curriculum strand and working year.
4. See strengths, practice priorities, evidence freshness and recent learning.
5. Configure access preferences and understand their runtime effect.
6. Create and review subject mock assessments without implying that a mock
   controls adaptive progression.

### School or tutor

1. Sign in to the correct organisation and see a role-appropriate overview.
2. Manage classes, learning groups, pupils and child-safe access credentials.
3. Assign learning by subject/objective and inspect progress/evidence.
4. Review support profiles, interventions and follow-up evidence.
5. Create and review role-scoped mock assessments for a selected learner.
6. Never expose another organisation's learners or operational data.

### Platform administrator

1. See only a simple sign-in/bootstrap migration surface before authentication.
2. Enter an authenticated control room with grouped navigation rather than one
   unstructured page.
3. Manage organisations, learners, curriculum, review, audio, releases,
   engagement and system/audit operations without losing existing CRUD.
4. Load growing ledgers in bounded pages with explicit progress and errors.
5. See honest release blockers and never bypass human gates through UI wording.

## Information architecture

### Platform operations

- Overview
- Organisations
  - Access requests
  - Schools and staff
  - Parents and invitations
- Learners and progress
  - Learners
  - Classes and groups
  - Progress and interventions
- Curriculum and review
  - Objectives
  - Activities and questions
  - AI review evidence
  - Human review queue
- Audio and assets
  - Narration readiness
  - Listening queue
  - Interaction/asset readiness
- Releases
  - Versions
  - Release manifests
  - Activation gates
- Engagement
  - Worlds
  - Rewards
  - Feature flags
- System and audit
  - Audit log
  - Runtime/configuration diagnostics

### Parent and family

- Overview
- Child progress
- Learning and practice
- Subject checks
- Access and SEND preferences
- Account and invitations

### School and tutor

- Overview
- Pupils
- Classes and learning groups
- Assignments
- Progress and evidence
- Support and interventions
- Subject checks
- Access cards

## Implementation packages

### A. Admin architecture

Split the authenticated admin control room into typed, independently rendered
modules and grouped navigation. Preserve the existing sign-in boundary, CRUD,
review and release controls. This package owns only the admin route and new
admin components/tests.

### B. Learner renderer architecture

Split `LearningStudio` into typed renderer families with an explicit dispatcher
and a safe fallback. Preserve DOM semantics, visual baselines, keyboard access,
SEND modes, audio and the mission contract. This package owns only the studio,
new renderer modules and new focused tests.

### C. Parent and school workspaces

Split the family, parent and school/tutor pages into role-workspace modules with
clear local navigation and explicit state handling. Preserve endpoint and
tenant boundaries. This package owns only those routes, new role-workspace
components and new focused tests.

## Integration acceptance matrix

| Boundary | Required evidence |
| --- | --- |
| Unauthenticated admin | Sign-in-only visual/DOM assertion; no menu or data |
| Authenticated admin | Grouped keyboard-reachable navigation and representative CRUD section |
| Parent scope | Invalid/unlinked child query safely falls back; linked child persists |
| School scope | Selected learner and organisation endpoint remain aligned |
| Pupil runtime | Existing mission visual and accessibility baselines remain stable |
| Renderer dispatch | Literacy, Mathematics and Science examples plus unknown-format fallback |
| SEND equivalence | Keyboard, simple-text, visual-guide, switch and reduced-motion checks |
| Mock semantics | Wording states sampled evidence and does not imply mastery mutation |
| Performance | Per-route, aggregate, chunk, CSS and public-asset budgets pass |
| Build quality | Lint, TypeScript and production build pass |
| Browser journeys | Complete desktop/mobile Playwright suite passes serially |

## Review and release procedure

1. Integrate all three packages into local `main` without including generated
   review/audio artefacts or local build files.
2. Run focused tests and resolve mechanical integration issues.
3. Run the complete API, content, lint, typecheck, production build,
   performance and Playwright gates.
4. Ask one adversarial reviewer to inspect the complete integrated diff for
   authorization, privacy, accessibility, misleading education claims,
   maintainability, performance and regression risk.
5. Remediate every critical or important finding and rerun affected plus full
   verification.
6. Commit one coherent Wave 2 milestone to `main`, push it, and remain with
   GitHub Actions and deployment checks until terminal.
