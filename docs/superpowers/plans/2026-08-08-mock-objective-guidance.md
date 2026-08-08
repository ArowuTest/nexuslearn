# Mock Objective Guidance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn completed subject checks from a percentage-only result into durable, objective-level evidence with clear “secure for now”, “practising”, and “review next” guidance.

**Architecture:** Persist immutable per-objective sample counts on the mock assessment when its final answer is recorded. Derive learner-facing status and guidance in Go from those raw counts, carry the results through existing assessment/summary APIs, and render one reusable guidance component in mission completion, pupil history, and adult progress reports. Mock evidence remains isolated from adaptive mastery and spaced-review writes.

**Tech Stack:** Go 1.22, PostgreSQL/pgx v5, Next.js 16.2.9, React 19.2.7, TypeScript 5, Playwright 1.61.

## Global Constraints

- English, Mathematics and Science only for the current MVP.
- A mock is sampled practice evidence and must not update adaptive mastery, misconception, review-queue or world-state records.
- Guidance must use plain language and must not overclaim whole-objective mastery from a small sample.
- SEND support changes access and representation, not the meaning of correct evidence.
- Assessment writes remain idempotent and tenant scoped.
- Operational list reads must remain bounded and avoid per-assessment N+1 queries.

---

### Task 1: Objective evidence contract and policy

**Files:**
- Modify: `apps/api/internal/learning/curriculum.go`
- Modify: `apps/api/internal/learning/mock_assessment_test.go`
- Create: `apps/api/migrations/0040_mock_assessment_objective_results.up.sql`
- Create: `apps/api/migrations/0040_mock_assessment_objective_results.down.sql`

**Interfaces:**
- Produces: `MockObjectiveResult`, `classifyMockObjectiveResult`, and `objective_results` on `MockAssessment` and `MockAssessmentSummary`.
- Stores: raw objective identity, curriculum label, sample counts and score in `mock_assessments.objective_results`.

- [x] Add failing table tests for `not_sampled`, `review_next`, `practising`, and `secure_for_now`, including the exact plain-language guidance.
- [x] Run `go test ./internal/learning -run MockObjective -count=1` and confirm the new contract is missing.
- [x] Add the types, deterministic classifier, summary propagation, and reversible JSONB migration.
- [x] Re-run the focused learning tests and confirm they pass.

### Task 2: Atomic completion persistence

**Files:**
- Modify: `apps/api/internal/learning/mock_assessment.go`
- Modify: `apps/api/internal/learning/mock_assessment_test.go`

**Interfaces:**
- Consumes: `MockObjectiveResult` from Task 1.
- Produces: completion summaries whose `objective_results` are generated in the same transaction as the final answer and assessment status.

- [x] Add a failing decoder test requiring persisted objective sample counts to become classified API evidence.
- [x] Confirm the test fails before the persistence decoder and SQL are changed.
- [x] Extend the completion CTE to persist objective/year/strand/topic/statement and sample counts only when all selected questions have answers.
- [x] Extend list/get scans to read the single persisted JSONB column, classify each item in Go, and avoid extra database queries.
- [x] Run `go test ./internal/learning ./internal/server -count=1`.

### Task 3: Reusable learner and adult guidance UI

**Files:**
- Create: `apps/web/src/components/MockObjectiveGuidance.tsx`
- Modify: `apps/web/src/lib/api.ts`
- Modify: `apps/web/src/app/play/mission/page.tsx`
- Modify: `apps/web/src/app/play/mock/page.tsx`
- Modify: `apps/web/src/components/ProgressSnapshot.tsx`
- Modify: `apps/web/tests/e2e/critical-journeys.spec.ts`

**Interfaces:**
- Consumes: `MockObjectiveResult[]` from assessment and progress responses.
- Produces: a compact, accessible objective breakdown ordered with revision needs first, plus explicit wording that results are sampled evidence rather than a progression restriction.

- [x] Extend the mocked mission completion response and add failing assertions for “Review next”, curriculum topic text, and secure/revision guidance.
- [x] Run the focused Playwright test and confirm the guidance assertion fails.
- [x] Add the shared component and render it in final mission feedback, saved pupil checks, and adult progress history.
- [x] Re-run the focused desktop and mobile journey.

### Task 4: Documentation and full verification

**Files:**
- Modify: `docs/CONSOLIDATED_IMPLEMENTATION_PLAN.md`
- Modify: `docs/DATABASE_AND_MIGRATIONS.md`
- Modify: `docs/QUALITY_GATES.md`

**Interfaces:**
- Documents the evidence boundary, migration, current gate status, and exact verification commands.

- [x] Update Slice B to mark richer revision guidance implemented without changing the human-review release gates.
- [x] Run `gofmt` on changed Go files.
- [x] Run `go test ./...` from `apps/api`.
- [x] Run `npm run lint`, `npx tsc --noEmit`, affected Playwright journeys, `npm run build`, and `npm run quality:performance` from `apps/web`.
- [ ] Inspect `git diff --check` and stage only intended source, migration, test, and documentation files.
- [ ] Commit one coherent local batch and push `main`; verify required GitHub checks before claiming completion.
