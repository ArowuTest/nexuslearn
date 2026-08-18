# NexusLearn Delivery Recovery Wave 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:test-driven-development for implementation. Do not spawn other agents. Work only in the assigned write set, commit locally, and report changed files, commit hashes, tests and concerns.

**Goal:** Deliver one substantial, integrated operational milestone: scalable admin ledgers plus complete role-scoped mock-assessment history, while preserving subject-independent progression, SEND access and non-punitive gamification.

**Architecture:** PostgreSQL and the Go API remain the authoritative source for operational and learner data. The Next.js application requests bounded, role-scoped pages and renders them through explicit loading, empty, error and continuation states. Generated curriculum reports remain evidence artefacts; they do not become an alternative runtime database.

**Tech Stack:** Go 1.22, PostgreSQL/pgx, Next.js 16, React 19, TypeScript 5, Playwright 1.61.

**Spec:** `docs/superpowers/specs/2026-08-08-ai-curriculum-send-review-design.md`

## Global Constraints

- MVP scope is England-aligned Years 1-7 English, Mathematics and Science.
- Curriculum, versions, approvals, release snapshots, learner evidence and routing decisions are backend-authoritative.
- Progression is independent per subject; a stronger subject may advance while another remains on its own route.
- Spaced retrieval remains eligible after advancement and errors never remove earned progress or use punitive streak pressure.
- SEND adaptations change access, representation and pacing, not curriculum entitlement or evidence meaning.
- All list reads are bounded, indexed, role/tenant scoped and use stable keyset cursors where records can grow without bound.
- AI curriculum and AI SEND decisions never masquerade as human professional sign-off.
- Public release remains blocked without applicable human safeguarding, human audio listening and real-child pilot evidence.
- Do not edit or stage the pre-existing dirty generated review/audio artefacts or `apps/web/next-env.d.ts`/`apps/web/tsconfig.tsbuildinfo`.
- Agents do not push GitHub. The lead workspace integrates, verifies, adversarially reviews, commits and pushes the combined milestone.

## Verified repository baseline (2026-08-18)

- 87/87 packs meet the current authored depth target across 90/90 contracted year-subject-strand areas.
- 20,210/20,210 pilot-target variants are authored. This is inventory depth, not production approval.
- 62 variants are source runtime-approved and 199 additional variants are supplied by the runtime-spine overlay, for 261 currently playable variants.
- 20,148 variants remain review candidates on the human release hold; no pack is currently in pilot or public release.
- AI review evidence covers all 87 packs and all 20,210 variants in both AI lanes, with no missing or stale lane decisions in the generated evidence.
- 874/874 expected narration assets pass technical file checks, but 0/874 have recorded human listening approval.
- Variant content declares 5,352 audio references and none currently resolves through the approved variant-reference manifest; this remains a production gap even though the base narration inventory exists.
- 168 interaction formats are renderer-ready and 82 are preview-only. Runtime tests report no released-renderer failures.
- Five asset families are tracked; none is yet marked pilot or production-ready.

These figures are the starting truth for delivery. A later wave may call a pack authored-depth complete, but may not call the MVP release-complete until the release, human and pilot gates are satisfied.

---

### Work package 1: Paginated admin operational ledgers

**Write ownership:** `apps/api/**` only.

**Deliverable:** Replace fixed-limit audit-log, content-version and content-release reads with bounded keyset-page contracts. Preserve authorization, add stable ordering and appropriate PostgreSQL indexes, and retain compatibility response collection keys while adding `next_cursor`.

**Required behaviour:**

- Accept `limit` with a default and hard maximum of 100.
- Accept an opaque URL-safe cursor and reject malformed cursors with a 400 response.
- Order by a stable timestamp plus ID tie-breaker.
- Return no duplicates or omissions when multiple rows share the same timestamp.
- Keep `audit_logs`, `content_versions` and `content_releases` in responses; add `next_cursor` only when more rows exist.
- Keep platform-admin authorization and existing release safety gates unchanged.
- Add repository, handler and migration tests, including cursor boundaries and same-timestamp rows.

### Work package 2: Scalable admin console consumption

**Write ownership:** `apps/web/src/app/admin/**`, new files under `apps/web/src/components/admin/**`, `apps/web/src/lib/**` and admin-focused Playwright tests only. Do not touch pupil, parent or school pages.

**Deliverable:** Consume the three operational page contracts without loading fixed whole lists during the initial admin configuration request. Each ledger must have a visible bounded first page, explicit load-more/continuation behaviour, independent loading and error states, and filters already supported by the API contract.

**Required behaviour:**

- Unauthenticated `/admin` remains a simple sign-in surface with no platform data or admin navigation exposed.
- Authenticated admin data loads by operational section rather than forcing all ledgers into one eager request.
- Audit, version and release rows append without replacing the current page and deduplicate by ID.
- Cursor state resets when the relevant section/filter context changes.
- The UI remains keyboard reachable and announces loading/error outcomes.
- Preserve existing CRUD, review, narration and release-control behaviour.
- Add focused Playwright coverage for first page, continuation, empty and failed-page states.

### Work package 3: Parent and school mock-history parity

**Write ownership:** `apps/web/src/app/parents/**`, `apps/web/src/app/school-admin/**`, new reusable components outside `components/admin`, `apps/web/src/lib/api.ts`, and non-admin Playwright tests. Do not touch `/admin` or the Go API.

**Deliverable:** Give linked parents and school/tutor staff an understandable, paginated history of subject mock assessments for the learner they are authorised to view, using the existing role-scoped backend endpoints.

**Required behaviour:**

- Parent history is limited to the selected linked child; school history is limited to the selected school learner.
- First and older pages append and deduplicate by assessment ID.
- Subject and status filters reset cursor/history and are passed to the API.
- Each row explains subject, target year, sampled score/status and how to open available detail without implying mock evidence controls adaptive mastery.
- Loading, empty, unavailable and end-of-history states are explicit.
- Existing mock generation remains intact.
- Add Playwright coverage for role-specific endpoint selection, filter reset, append/deduplication and scope-preserving UI.

### Lead integration task: Progression, SEND and gamification contract

**Write ownership:** cross-cutting tests and the smallest required implementation corrections after the three packages integrate.

**Deliverable:** Verify that the integrated flows preserve subject-independent advancement, earlier-year spaced retrieval, SEND-equivalent response routes and non-punitive learner feedback across pupil, parent, school and admin views.

### Milestone verification and adversarial review

Run, from a clean integration state excluding the quarantined generated artefacts:

- `go test ./...` in `apps/api`.
- `npm run quality:content`, `npm run lint`, `npm run build` and `npm run quality:performance` in `apps/web`.
- Focused Playwright tests for the three packages, then the complete Playwright suite serially.
- One adversarial review over the full integrated diff. Review authorization, tenant boundaries, cursor correctness, query/index efficiency, idempotency, accessibility, misleading educational claims, regression risk and test adequacy.
- Remediate all critical/important findings, rerun affected tests, then run final full gates before committing and pushing `main`.

### Adversarial-review performance gate decision

- Use a 1,400,000-byte aggregate emitted-JavaScript ceiling, retaining the
  750,000-byte per-route initial-JavaScript ceiling, 250,000-byte per-chunk
  ceiling, 120,000-byte total CSS ceiling and 600,000-byte individual public
  asset ceiling.
- This is explicit product-management approval of a metric correction, not a
  hidden budget raise. Total all-route output is a secondary repository-health
  cap for dependency growth; per-route initial payload is the user-facing
  performance boundary.
- The performance gate must fail every static-HTML or client-reference-manifest
  chunk reference missing from the built static map, report the route evidence
  file counts, and treat emitted static HTML extraction as the authoritative
  cross-check for static routes.

## Programme after Wave 1

Each later wave is integrated and tested as one significant milestone, followed by one adversarial review. Minor edits inside a wave do not trigger separate review agents or GitHub pushes.

### Wave 2: Four-persona product experience and maintainable UI

- Replace the 3,500-line admin page with authenticated route modules for overview, organisations, learners, curriculum, review, audio, release, assessment/progress, engagement and system/audit operations while preserving authorization and audit behaviour.
- Split the 1,600-line learning studio and 1,400-line mission route by teaching sequence, response renderer, feedback/repair, evidence, progression and celebration responsibilities without changing the stable mission contract accidentally.
- Complete seeded pupil, parent, school/tutor and platform-admin journeys with understandable navigation, first-use guidance, responsive layouts, keyboard/accessibility checks and explicit unavailable states.
- Give Years 1-2, 3-4 and 5-7 age-appropriate presentation and autonomy while retaining one coherent Notice -> Try -> Repair -> Prove -> Grow -> Return loop.
- Verify that quests, worlds, companions, collections and unlocks are tied to effort, strategy and demonstrated learning; remove decorative or misleading rewards and preserve low-sensory/reduced-motion equivalents.

**Wave 2 exit:** all four persona journeys pass seeded Playwright walkthroughs; no unauthenticated platform data is exposed; major UI modules have bounded responsibilities; every released interaction remains accessible and visually stable.

### Wave 3: Curriculum, review and audio release operations

- Reconcile the 20,210 authored variants with the backend release ledger and close the gap between authored, AI-reviewed, runtime-playable and independently releasable content.
- Resolve declared variant audio references against versioned manifest identities, regenerate changed assets where necessary and preserve provider/license metadata without retaining credentials.
- Operate paginated curriculum/SEND review, human safeguarding, human listening and pilot-evidence queues with immutable hashes, stale-decision invalidation, evidence comparison and audited reasons.
- Provide the human listening workspace with playback, transcript, pronunciation/pacing criteria, rejection/regeneration workflow and batch progress. Human decisions remain human.
- Exercise every renderer family used by a candidate release, promote preview-only formats only after behaviour/accessibility tests, and keep unready formats closed to learners.
- Revise failed curriculum or SEND items at source and regenerate deterministically; never edit generated evidence to manufacture readiness.

**Wave 3 exit:** every candidate release item reconciles to exact review/audio identities; no unresolved required audio reference enters release; operators can complete and audit every human gate through the product; catalogue activation fails closed on absent or stale evidence.

### Wave 4: Security, observability and controlled production readiness

- Complete threat modelling and role/tenant abuse tests for pupil sessions, linked parents, school staff, content reviewers and platform operations.
- Add production observability for authentication, release activation, catalogue fallback, assessment generation, learner routing, audio delivery and review queues with child-safe error responses.
- Add incident, rollback and immutable-release operating procedures; test atomic activation and fallback to the last valid catalogue.
- Execute browser performance, accessibility, visual stability, data-volume/query-plan and migration tests from a clean checkout and disposable PostgreSQL database.
- Run named human safeguarding review, human audio listening, controlled real-child pilot and remediation under approved protocols. These steps cannot be delegated to AI.
- Produce launch evidence and an honest go/no-go decision; rotate temporary development credentials before production.

**Wave 4 exit:** all automated gates are green; production secrets and access are hardened; required human and pilot evidence is current; rollback is exercised; there are no unresolved release-blocking findings.

### Deferred expansion

Computing and History, followed by separate curriculum-mapped Spanish and French pathways, remain specified future work. They start only after the English, Mathematics and Science MVP meets the Wave 4 gate or the product owner explicitly accepts the cost and risk of changing priority.
