# NexusLearn Consolidated Implementation Plan

Status: active build plan
Owner: product, curriculum, engineering and safeguarding
Scope: England-aligned Years 1-7 MVP across English, Mathematics and Science,
with SEND-aware access, gamified learning, adult reporting and a scalable
content operating model.

## 1. Product outcome

NexusLearn must make real curriculum progress visible without turning learning
into a leaderboard or a speed test. A pupil should receive the right challenge
for each subject independently, revisit earlier knowledge through spaced
retrieval, and access the same ambitious objective through an appropriate SEND
response route. Parents, tutors/schools and platform administrators must see
only the evidence their role is entitled to see.

## 2. Consolidated gap register

### P0: release-blocking platform gaps

1. Subject mock assessments were not a first-class product object. The existing
   assessment blueprint selected questions for one activity; it did not let an
   authorised pupil, parent or tutor create a durable subject assessment.
2. Progress visibility was strongest for parents and pupils but incomplete for
   school and platform operations. School and admin users need scoped progress
   and assessment evidence, not only assignments and teacher notes.
3. Any generated assessment must be idempotent, reproducible, quality-gated and
   bounded by role scope. It must never allow a parent to reach another child,
   a school to reach another school's learner, or a pupil to impersonate a
   different pupil.
4. Assessment generation must preserve the SEND contract: support changes
   access, pacing and representation, not the curriculum entitlement or the
   evidence value of a correct response.

### P1: experience and learning-quality gaps

1. The child route needs one consistent Notice -> Try -> Repair -> Prove ->
   Grow -> Return loop across all years and subjects.
2. Subject progression must be independent. Strong Mathematics evidence can
   open a higher Mathematics route while English remains on its own support
   route; revision is still scheduled for previously secure objectives.
3. Parent, tutor and admin reports must lead with plain-language meaning and
   show sampled, unsampled, on-track, secure, ahead and needs-practice states.
4. Produced narration and human listening QA must remain a release workflow,
   with honest unavailable states and no browser-TTS substitution.
5. Visual regression and performance gates must cover the stable mission shell,
   mobile layouts, accessibility states and the largest public assets.

### P2: scale and expansion gaps

1. Complete depth and independent review for all Years 1-7 English,
   Mathematics and Science packs before calling the MVP complete.
2. Keep curriculum, lessons, variants, audio, animation hooks and evidence
   language versioned and database-backed in production.
3. Add Computing and History after the three-subject experience is coherent;
   add Spanish and French only with a separate language-learning interaction
   and audio plan.
4. Add group mocks, exports, MIS integration, background report jobs and
   broader renderer coverage as follow-on slices.

## 3. Delivery order

### Slice A - assessment foundation (current implementation)

- Durable `mock_assessments` and ordered item records.
- Subject/year/topic-aware question selection from runtime-approved content.
- Deterministic selection with balanced objective coverage and optional revision
  and stretch years.
- Pupil, linked-parent and school/tutor creation routes.
- Pupil-protected mission loading for a generated assessment.
- Idempotency and tenant-scope tests.
- Durable answer capture linked to the mock, one answer per selected question,
  locked assessment state and completion/score summaries.
- Mock attempts are excluded from adaptive mastery, spaced review,
  misconception and world-state evidence until a future evidence policy
  explicitly promotes them.

Acceptance criteria:

- The same idempotency key and request returns the same assessment.
- A changed request with the same key is rejected.
- A parent can create only for a linked child.
- A school/tutor can create only for a learner in that school.
- A pupil can create only for their own pupil session.
- A mock contains only runtime-approved questions and records objective
  coverage, subject, year range and accessibility intent.

### Slice B - role-aware UI and reporting

- Pupil mock builder and launch route (implemented).
- Parent child-card mock builder and progress result link (implemented).
- School/tutor mock builder scoped to one learner (implemented; group creation
  remains follow-on work).
- Mock completion summary with subject-level evidence and revision guidance
  (completion evidence implemented; richer revision guidance remains).
- Admin operational view for generated assessments, content readiness and
  audio/listening QA (scoped read route implemented; richer dashboard remains).

### Slice C - progression and evidence hardening

- Subject-independent working/stretch routes with revision interleaving.
- School/admin progress endpoints with explicit tenant filters.
- Mock attempts separated from high-confidence mastery until evidence rules are
  satisfied; SEND response modes remain equivalent evidence (implemented).
- School progress and mock-history reads carry the authenticated school tenant
  through to persistence queries (implemented).
- Query budgets, indexes, pagination and audit events for all operational lists.

### Slice D - curriculum depth and expansion

- Finish complete depth packs for the three MVP subjects across Years 1-7.
- Review and produce all child-facing audio batches, including listening QA.
- Expand to Computing and History, then design curriculum-mapped Spanish and
  French pathways.

## 4. Shared mock assessment contract

Every mock carries:

- learner and creator role;
- subject and target year;
- optional revision and stretch year policy;
- selected strands/topics;
- deterministic ordered question items;
- question count and optional time guidance (never a punitive timed mastery
  rule);
- SEND/runtime intent, such as audio, low sensory, simple text, extra time or
  alternative response mode;
- status, creation time, audit identity and evidence summary.

Generation is a practice/evidence workflow, not a high-stakes exam. Incorrect
answers should trigger repair and revision guidance, not punitive rewards or
loss of access. A mock must be safe to resume and safe to repeat with a new
request key.

## 5. Role model

| Role | Generate for | View results |
| --- | --- | --- |
| Pupil | Self, within configured curriculum boundaries | Self |
| Parent | Linked children only | Linked children |
| Tutor/teacher | Learners in their school; group support follows | School-scoped learners |
| School admin | Learners and groups in their school | School-scoped learners |
| Platform admin | Operational support and QA; no child-facing bypass | Authorised platform operations |

## 6. Definition of done

The product is not ready to call best-in-class merely because a mock can be
generated. Each slice must pass:

- curriculum objective mapping and variant quality gates;
- human audio listening QA where narration is used;
- SEND and safeguarding review;
- role/tenant access tests;
- idempotency and query-efficiency tests;
- API, TypeScript, production build, performance and visual checks;
- a pupil, parent, tutor/school and admin walkthrough using seeded test data;
- plain-language reports that explain what was sampled, what is next and why.

This plan governs build order. Existing phase and content documents remain the
source of detail for their respective domains; this document consolidates the
cross-product dependencies and prevents more curriculum expansion from hiding
unfinished learner, adult or operational workflows.
