# AI Curriculum and SEND Approval Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the auditable AI Curriculum Lead and AI SEND Lead review system, run it across the Year 1-7 MVP catalogue, and make controlled-pilot and public-release eligibility fail closed on current evidence.

**Architecture:** Extend the existing PostgreSQL append-only review ledger and transactional release pipeline rather than adding a second source of truth. Node-based content tooling will compute canonical hashes, deterministic findings, risk tiers and reproducible review batches; the Go API will persist immutable decisions, expose paginated queues and enforce release gates; the Next.js admin will render authenticated review and release operations.

**Tech Stack:** Go 1.22, PostgreSQL/pgx v5, Node.js ES modules, JSON Schema, Next.js 16.2.9, React 19.2.7, TypeScript 5, Playwright 1.61 and Axe.

## Global Constraints

- Use the exact decision labels `ai_curriculum_lead`, `ai_send_lead`, `human_safeguarding`, `human_audio_listening` and `child_pilot_evidence`.
- Never render AI Curriculum Lead approval as teacher approval or AI SEND Lead approval as human SEND-specialist approval.
- Controlled development and pilot content requires current dual AI approval plus technical eligibility.
- Public production also requires human safeguarding, human listening for every required produced-audio asset, and successful real-child pilot evidence.
- Bind every AI decision to immutable content ID, content revision, canonical content hash, rubric revision, source-set revision and reviewer implementation identity.
- A changed content hash or material dependency makes the earlier decision stale and removes release eligibility.
- The backend remains authoritative for curriculum, decisions, releases, learner evidence and routing; browser assets are immutable projections, not an independent catalogue.
- All writes are idempotent; list APIs are cursor-paginated, tenant- or role-scoped and backed by indexes.
- Missing, stale, conflicting or unreadable evidence fails closed.
- Preserve existing user changes and generated working files; stage only files owned by each task.
- Use test-driven development and verify the focused test fails before adding implementation.
- Default to inline execution; dispatch a subagent only for an independent, bounded task with material value and no duplicate work.

## Programme Boundaries

This plan is the first delivery workstream from the approved design. It produces working review infrastructure, catalogue review evidence, release enforcement and admin review operations. After it passes, separate implementation plans will cover:

1. learner mission and cross-year progression UX;
2. parent, educator and platform-admin reporting journeys;
3. complete SEND renderer and accessibility validation;
4. narration production/listening operations;
5. performance, observability, safeguarding and controlled child-pilot readiness.

The present plan must finish before those plans consume the final review and release interfaces.

## File Structure

### Authoritative review configuration

- `packages/content/review/rubrics/v1.json` — versioned Curriculum Lead and SEND Lead criteria, severities and release-blocking rules.
- `packages/content/review/source-registry.v1.json` — authoritative source metadata and criterion mappings.
- `packages/content/review/decisions/y1.ai-review.json` through `y7.ai-review.json` — reviewed pack, family and direct-variant semantic decisions.

### Content tooling

- `packages/content/tools/lib/review-evidence.mjs` — canonicalisation, hashing, status validation, staleness and risk calculation.
- `packages/content/tools/lib/review-evidence.test.mjs` — deterministic unit tests for the library.
- `packages/content/tools/ai-review-batch.mjs` — builds the complete review queue and deterministic findings.
- `packages/content/tools/ai-review-batch.test.mjs` — fixture-driven queue and risk tests.
- `packages/content/tools/ai-review-evidence.mjs` — validates semantic decisions, reconciles all 20,210 variants and emits immutable evidence reports.
- `packages/content/tools/ai-review-evidence.test.mjs` — completeness, family coverage, staleness and claim-language tests.
- `packages/content/generated/coverage/ai-review-batch.json` — generated full queue.
- `packages/content/generated/coverage/ai-review-evidence.json` — generated full ledger.
- `apps/web/public/content/ai-review-summary.json` — compact, non-authoritative admin projection.

### Persistence and API

- `apps/api/migrations/0038_ai_review_evidence.up.sql` and `.down.sql` — immutable evidence, finding, source and rubric schema plus indexes.
- `apps/api/internal/learning/ai_reviews.go` — domain types, validation, repository reads/writes and eligibility evaluation.
- `apps/api/internal/learning/ai_reviews_test.go` — state, hash, pagination and eligibility tests.
- `apps/api/internal/learning/curriculum.go` — shared JSON domain types used by HTTP adapters.
- `apps/api/internal/learning/content_release.go` — transactional review-evidence enforcement.
- `apps/api/internal/learning/content_release_test.go` — pilot/live release-gate tests.
- `apps/api/internal/server/ai_reviews.go` — authenticated paginated review, summary and decision handlers.
- `apps/api/internal/server/ai_reviews_test.go` — authorization, cursor, conflict and response-contract tests.
- `apps/api/internal/server/server.go` — route registration only.

### Admin web

- `apps/web/src/lib/admin-reviews.ts` — typed API client and session-scoped operations.
- `apps/web/src/components/admin/AdminReviewWorkspace.tsx` — queue, evidence and decision workspace.
- `apps/web/src/components/admin/AdminReleaseGate.tsx` — controlled-pilot/public gate explanation.
- `apps/web/src/app/admin/page.tsx` — integrates the authenticated navigation destination.
- `apps/web/tests/e2e/admin-review-workflow.spec.ts` — authenticated review and stale-evidence browser journey.

---

### Task 1: Versioned Rubrics, Sources and Canonical Evidence Library

**Files:**
- Create: `packages/content/review/rubrics/v1.json`
- Create: `packages/content/review/source-registry.v1.json`
- Create: `packages/content/tools/lib/review-evidence.mjs`
- Create: `packages/content/tools/lib/review-evidence.test.mjs`

**Interfaces:**
- Consumes: pack JSON objects and the existing `packages/content/research/uk-y1-y7-curriculum-source-map.json` identifiers.
- Produces: `canonicalContent(value): string`, `sha256Content(value): string`, `validateReviewStatus(status): boolean`, `calculateRiskTier(input): "tier_1" | "tier_2" | "tier_3"`, and `isReviewCurrent(review, identity): boolean`.

- [ ] **Step 1: Write failing canonicalisation, staleness and risk tests**

```js
import test from "node:test";
import assert from "node:assert/strict";
import {
  calculateRiskTier,
  canonicalContent,
  isReviewCurrent,
  sha256Content,
  validateReviewStatus,
} from "./review-evidence.mjs";

test("canonical content is key-order independent", () => {
  assert.equal(canonicalContent({ b: 2, a: 1 }), canonicalContent({ a: 1, b: 2 }));
  assert.equal(sha256Content({ b: 2, a: 1 }), sha256Content({ a: 1, b: 2 }));
});

test("changed dependencies make approval stale", () => {
  const review = { content_hash: "a".repeat(64), rubric_revision: "1", source_set_revision: "1", reviewer_implementation: "nexuslearn-ai-curriculum-send-review-v1" };
  assert.equal(isReviewCurrent(review, review), true);
  assert.equal(isReviewCurrent(review, { ...review, source_set_revision: "2" }), false);
});

test("risk rises for open answers, SEND transformations and safety context", () => {
  assert.equal(calculateRiskTier({ format: "choice", sendAdaptation: false, safetySensitive: false, generatorNovel: false }), "tier_1");
  assert.equal(calculateRiskTier({ format: "free_text", sendAdaptation: true, safetySensitive: false, generatorNovel: false }), "tier_2");
  assert.equal(calculateRiskTier({ format: "free_text", sendAdaptation: true, safetySensitive: true, generatorNovel: true }), "tier_3");
});

test("only governed statuses are valid", () => {
  assert.equal(validateReviewStatus("approved_with_observation"), true);
  assert.equal(validateReviewStatus("teacher_approved"), false);
});
```

- [ ] **Step 2: Run the focused test and confirm the missing module failure**

Run: `node --test packages/content/tools/lib/review-evidence.test.mjs`

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `review-evidence.mjs`.

- [ ] **Step 3: Create the rubric and source registries**

The rubric JSON must have schema revision `1`, lanes `ai_curriculum_lead` and `ai_send_lead`, criterion IDs matching sections 9 and 10 of the approved design, severities `observation`, `blocking` and `escalation`, and a `release_blocking` boolean per criterion. The source registry must contain the exact publisher, direct URL, checked date, applicable years, subjects and criterion IDs for each source; it must include Department for Education National Curriculum and SEND Code material plus WCAG 2.2 and the Equality Act source basis.

```json
{
  "schema_version": 1,
  "rubric_revision": "curriculum-send-v1",
  "lanes": {
    "ai_curriculum_lead": { "criteria": [] },
    "ai_send_lead": { "criteria": [] }
  },
  "statuses": ["not_reviewed", "in_review", "approved", "approved_with_observation", "revision_required", "escalation_required", "stale", "superseded"]
}
```

- [ ] **Step 4: Implement the canonical evidence library**

```js
import { createHash } from "node:crypto";

const statuses = new Set(["not_reviewed", "in_review", "approved", "approved_with_observation", "revision_required", "escalation_required", "stale", "superseded"]);

export function canonicalContent(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalContent).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalContent(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

export function sha256Content(value) {
  return createHash("sha256").update(canonicalContent(value)).digest("hex");
}

export function validateReviewStatus(status) { return statuses.has(status); }

export function isReviewCurrent(review, identity) {
  return ["content_hash", "rubric_revision", "source_set_revision", "reviewer_implementation"]
    .every((key) => review[key] === identity[key]);
}
```

Implement `calculateRiskTier` as a deterministic point score: open/free-text `+2`, transformed SEND response `+2`, safety-sensitive context `+3`, novel generator/renderer `+2`, narration-dependent `+1`, prior failure `+2`; 0-2 is Tier 1, 3-5 Tier 2 and 6+ Tier 3.

- [ ] **Step 5: Run tests and validate both JSON files parse**

Run: `node --test packages/content/tools/lib/review-evidence.test.mjs`

Run: `node -e "JSON.parse(require('fs').readFileSync('packages/content/review/rubrics/v1.json')); JSON.parse(require('fs').readFileSync('packages/content/review/source-registry.v1.json'));"`

Expected: both commands exit 0.

- [ ] **Step 6: Commit the foundation**

```bash
git add packages/content/review packages/content/tools/lib/review-evidence.mjs packages/content/tools/lib/review-evidence.test.mjs
git commit -m "Add versioned AI review rubrics"
```

### Task 2: Immutable PostgreSQL Review Evidence Schema

**Files:**
- Create: `apps/api/migrations/0038_ai_review_evidence.up.sql`
- Create: `apps/api/migrations/0038_ai_review_evidence.down.sql`
- Create: `apps/api/internal/learning/ai_reviews_test.go`

**Interfaces:**
- Consumes: lane/status/risk values from Task 1.
- Produces: tables `ai_review_evidence` and `ai_review_findings`, uniqueness on the review identity, and cursor indexes for queue reads.

- [ ] **Step 1: Add a failing migration contract test**

```go
func TestAIReviewMigrationContainsImmutableIdentityAndQueueIndexes(t *testing.T) {
    raw, err := os.ReadFile("../../migrations/0038_ai_review_evidence.up.sql")
    if err != nil { t.Fatal(err) }
    sql := string(raw)
    for _, required := range []string{
        "CREATE TABLE IF NOT EXISTS ai_review_evidence",
        "content_hash text NOT NULL",
        "lane_id text NOT NULL",
        "reviewer_implementation text NOT NULL",
        "UNIQUE(content_id, content_hash, lane_id, rubric_revision, source_set_revision, reviewer_implementation)",
        "ai_review_evidence_queue_idx",
    } {
        if !strings.Contains(sql, required) { t.Fatalf("migration missing %q", required) }
    }
}
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run: `go test ./internal/learning -run TestAIReviewMigrationContainsImmutableIdentityAndQueueIndexes -count=1`

Working directory: `apps/api`

Expected: FAIL because migration `0038` does not exist.

- [ ] **Step 3: Add the forward and reverse migrations**

The forward migration must create:

```sql
CREATE TABLE IF NOT EXISTS ai_review_evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content_id text NOT NULL,
  content_type text NOT NULL CHECK (content_type IN ('pack','variant','variant_family')),
  content_revision text NOT NULL,
  content_hash text NOT NULL CHECK (content_hash ~ '^[0-9a-f]{64}$'),
  pack_id text NOT NULL,
  year_group integer NOT NULL CHECK (year_group BETWEEN 1 AND 7),
  subject text NOT NULL,
  lane_id text NOT NULL CHECK (lane_id IN ('ai_curriculum_lead','ai_send_lead')),
  status text NOT NULL CHECK (status IN ('approved','approved_with_observation','revision_required','escalation_required')),
  risk_tier text NOT NULL CHECK (risk_tier IN ('tier_1','tier_2','tier_3')),
  rubric_revision text NOT NULL,
  source_set_revision text NOT NULL,
  reviewer_implementation text NOT NULL,
  model_identifier text NOT NULL,
  confidence numeric(4,3) NOT NULL CHECK (confidence BETWEEN 0 AND 1),
  criterion_results jsonb NOT NULL,
  source_ids jsonb NOT NULL,
  evidence_notes text NOT NULL,
  supersedes_id uuid REFERENCES ai_review_evidence(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(content_id, content_hash, lane_id, rubric_revision, source_set_revision, reviewer_implementation)
);
```

Add `ai_review_findings` with evidence foreign key, criterion ID, severity, finding code, affected fields, rationale and required revisions. Add indexes `(lane_id,status,risk_tier,year_group,subject,created_at DESC,id DESC)`, `(pack_id,lane_id,created_at DESC)` and `(content_id,content_hash,lane_id)`. The down migration drops findings first, then evidence.

- [ ] **Step 4: Run migration and all database package tests**

Run: `go test ./internal/learning -run 'TestAIReviewMigration|TestValidate' -count=1`

Expected: PASS.

- [ ] **Step 5: Commit the schema**

```bash
git add apps/api/migrations/0038_ai_review_evidence.* apps/api/internal/learning/ai_reviews_test.go
git commit -m "Add immutable AI review evidence schema"
```

### Task 3: Go Review Domain, Validation and Repository

**Files:**
- Create: `apps/api/internal/learning/ai_reviews.go`
- Modify: `apps/api/internal/learning/ai_reviews_test.go`
- Modify: `apps/api/internal/learning/curriculum.go`

**Interfaces:**
- Consumes: `requestHash`, `beginIdempotency`, `completeIdempotency` and the Task 2 tables.
- Produces: `AIReviewEvidence`, `AIReviewFinding`, `AIReviewQuery`, `AIReviewPage`, `AIReviewSummary`, `ReviewIdentity`, `ValidateAIReviewEvidence(AIReviewEvidence) error`, `SaveAIReviewEvidence(context.Context, AIReviewEvidence, string) (AIReviewEvidence, error)`, `ListAIReviewEvidence(context.Context, AIReviewQuery) (AIReviewPage, error)`, `SummariseAIReviews(context.Context) (AIReviewSummary, error)` and `EvaluateAIReviewEligibility(context.Context, queryExecutor, []ReviewIdentity) (AIReviewEligibility, error)`.

- [ ] **Step 1: Add failing validation and staleness tests**

```go
func TestValidateAIReviewEvidenceRejectsHumanClaimsAndIncompleteIdentity(t *testing.T) {
    item := validAIReviewEvidence()
    item.LaneID = "teacher_review"
    if err := ValidateAIReviewEvidence(item); !errors.Is(err, ErrInvalidConfiguration) {
        t.Fatalf("expected invalid lane, got %v", err)
    }
    item = validAIReviewEvidence()
    item.EvidenceNotes = "Teacher approved this pack"
    if err := ValidateAIReviewEvidence(item); !errors.Is(err, ErrInvalidConfiguration) {
        t.Fatalf("expected prohibited human claim, got %v", err)
    }
}

func TestReviewIdentityCurrentRequiresExactMaterialIdentity(t *testing.T) {
    review := validAIReviewEvidence()
    identity := ReviewIdentityFromEvidence(review)
    if !ReviewEvidenceCurrent(review, identity) { t.Fatal("exact identity should be current") }
    identity.ContentHash = strings.Repeat("b", 64)
    if ReviewEvidenceCurrent(review, identity) { t.Fatal("changed hash must be stale") }
}
```

- [ ] **Step 2: Run the focused tests and confirm undefined-symbol failures**

Run: `go test ./internal/learning -run 'TestValidateAIReviewEvidence|TestReviewIdentityCurrent' -count=1`

Working directory: `apps/api`

Expected: FAIL because the new types and functions are undefined.

- [ ] **Step 3: Define domain types and strict validation**

```go
type AIReviewEvidence struct {
    ID string `json:"id"`
    ContentID string `json:"content_id"`
    ContentType string `json:"content_type"`
    ContentRevision string `json:"content_revision"`
    ContentHash string `json:"content_hash"`
    PackID string `json:"pack_id"`
    YearGroup int `json:"year_group"`
    Subject string `json:"subject"`
    LaneID string `json:"lane_id"`
    Status string `json:"status"`
    RiskTier string `json:"risk_tier"`
    RubricRevision string `json:"rubric_revision"`
    SourceSetRevision string `json:"source_set_revision"`
    ReviewerImplementation string `json:"reviewer_implementation"`
    ModelIdentifier string `json:"model_identifier"`
    Confidence float64 `json:"confidence"`
    CriterionResults map[string]any `json:"criterion_results"`
    SourceIDs []string `json:"source_ids"`
    EvidenceNotes string `json:"evidence_notes"`
    Findings []AIReviewFinding `json:"findings"`
    CreatedAt string `json:"created_at"`
    Stale bool `json:"stale"`
}
```

Reject missing identity fields, hashes outside lowercase SHA-256, unsupported lanes/statuses/risk tiers, confidence outside 0-1, empty criterion results, empty source IDs and evidence text containing claims `teacher approved`, `SEND specialist approved`, `human reviewed` or `safeguarding approved` for either AI lane.

- [ ] **Step 4: Add repository save, idempotent replay and keyset pagination**

Use one transaction for evidence, findings, audit log and idempotency completion. Insert evidence with `ON CONFLICT` on the immutable identity and return the existing row when the request body matches. A conflicting body with the same transport idempotency key must return `ErrIdempotencyConflict`.

`AIReviewQuery` must support `LaneID`, `Status`, `RiskTier`, `YearGroup`, `Subject`, `PackID`, `Limit`, `BeforeCreatedAt` and `BeforeID`. Clamp limit to 1-200. Order by `created_at DESC, id DESC`; encode the final tuple as the next cursor.

- [ ] **Step 5: Add eligibility evaluation tests and implementation**

```go
func TestEvaluateReviewSetRequiresBothCurrentAILanes(t *testing.T) {
    identity := ReviewIdentity{ContentID: "pack-1", ContentHash: strings.Repeat("a", 64), RubricRevision: "curriculum-send-v1", SourceSetRevision: "sources-v1", ReviewerImplementation: "nexuslearn-ai-curriculum-send-review-v1"}
    reviews := []AIReviewEvidence{
        approvedReview(identity, "ai_curriculum_lead"),
        approvedReview(identity, "ai_send_lead"),
    }
    got := EvaluateReviewSet([]ReviewIdentity{identity}, reviews)
    if !got.ControlledPilotAllowed || got.MissingLaneCount != 0 { t.Fatalf("unexpected gate %#v", got) }
    reviews[1].ContentHash = strings.Repeat("b", 64)
    got = EvaluateReviewSet([]ReviewIdentity{identity}, reviews)
    if got.ControlledPilotAllowed || got.StaleCount != 1 { t.Fatalf("stale review must block %#v", got) }
}
```

Run: `go test ./internal/learning -run 'TestValidateAIReviewEvidence|TestReviewIdentityCurrent|TestEvaluateReviewSet' -count=1`

Expected: PASS.

- [ ] **Step 6: Run the whole Go learning package**

Run: `go test ./internal/learning -count=1`

Expected: PASS.

- [ ] **Step 7: Commit the domain layer**

```bash
git add apps/api/internal/learning/ai_reviews.go apps/api/internal/learning/ai_reviews_test.go apps/api/internal/learning/curriculum.go
git commit -m "Implement AI review evidence repository"
```

### Task 4: Deterministic Review Batch and Risk Engine

**Files:**
- Create: `packages/content/tools/ai-review-batch.mjs`
- Create: `packages/content/tools/ai-review-batch.test.mjs`
- Modify: `apps/web/package.json`

**Interfaces:**
- Consumes: all `packages/content/packs/*.pack.sample.json`, Task 1 registries and existing content-quality tools.
- Produces: `packages/content/generated/coverage/ai-review-batch.json` with pack, variant-family and direct-variant identities, deterministic findings and risk tiers.

- [ ] **Step 1: Write a failing fixture-driven batch test**

```js
import test from "node:test";
import assert from "node:assert/strict";
import { buildReviewBatch } from "./ai-review-batch.mjs";

test("batch gives every variant a hash, risk tier and both lanes", () => {
  const pack = {
    id: "ma-y3-test",
    version: "1.0.0",
    objective: { year: 3, subject: "Mathematics" },
    question_variants: [{ id: "v1", status: "review", format: "choice", body: { prompt: "2 + 2" }, expected_answer: { value: 4 } }],
  };
  const batch = buildReviewBatch([pack], { rubricRevision: "curriculum-send-v1", sourceSetRevision: "sources-v1" });
  assert.equal(batch.totals.variants, 1);
  assert.match(batch.packs[0].variants[0].content_hash, /^[0-9a-f]{64}$/);
  assert.deepEqual(batch.packs[0].required_lanes, ["ai_curriculum_lead", "ai_send_lead"]);
});
```

- [ ] **Step 2: Run and confirm export/module failure**

Run: `node --test packages/content/tools/ai-review-batch.test.mjs`

Expected: FAIL because `buildReviewBatch` is unavailable.

- [ ] **Step 3: Implement deterministic checks and family grouping**

For every variant record answer presence/resolution, duplicate signature, prompt-answer mismatch, visible/narration text parity, reading load, response-route metadata, curriculum link, renderer novelty and release state. Group only Tier 1 variants sharing pack ID, format, generator/template signature, expected-answer shape and deterministic constraint signature. Tier 2 and Tier 3 variants remain direct review units.

The report must include:

```js
{
  schema_version: 1,
  batch_id,
  batch_hash,
  rubric_revision: "curriculum-send-v1",
  source_set_revision: "sources-v1",
  reviewer_implementation: "nexuslearn-ai-curriculum-send-review-v1",
  totals: { packs, variants, tier_1, tier_2, tier_3, blocking_findings },
  packs: []
}
```

- [ ] **Step 4: Add the generator to the content quality chain**

Add `node ../../packages/content/tools/ai-review-batch.mjs` after `variant-quality.mjs` and before `variant-approval-audit.mjs` in `apps/web/package.json`.

- [ ] **Step 5: Run focused and real-catalogue validation**

Run: `node --test packages/content/tools/ai-review-batch.test.mjs`

Run: `node packages/content/tools/ai-review-batch.mjs`

Run: `node -e "const r=require('./packages/content/generated/coverage/ai-review-batch.json'); if(r.totals.packs!==87||r.totals.variants!==20210) process.exit(1)"`

Expected: tests pass and the real report has exactly 87 packs and 20,210 variants.

- [ ] **Step 6: Commit the batch engine without generated drift from unrelated tools**

```bash
git add packages/content/tools/ai-review-batch.mjs packages/content/tools/ai-review-batch.test.mjs apps/web/package.json packages/content/generated/coverage/ai-review-batch.json
git commit -m "Generate deterministic AI review batches"
```

### Task 5: Semantic Decision Files and Complete Evidence Reconciliation

**Files:**
- Create: `packages/content/review/decisions/y1.ai-review.json`
- Create: `packages/content/review/decisions/y2.ai-review.json`
- Create: `packages/content/review/decisions/y3.ai-review.json`
- Create: `packages/content/review/decisions/y4.ai-review.json`
- Create: `packages/content/review/decisions/y5.ai-review.json`
- Create: `packages/content/review/decisions/y6.ai-review.json`
- Create: `packages/content/review/decisions/y7.ai-review.json`
- Create: `packages/content/tools/ai-review-evidence.mjs`
- Create: `packages/content/tools/ai-review-evidence.test.mjs`
- Modify: `apps/web/package.json`

**Interfaces:**
- Consumes: Task 4 batch, Task 1 rubrics/sources and human-readable pack previews.
- Produces: complete dual-lane semantic decisions, `packages/content/generated/coverage/ai-review-evidence.json` and `apps/web/public/content/ai-review-summary.json`.

- [ ] **Step 1: Write failing reconciliation tests**

```js
test("every batch review unit has both AI lane decisions", () => {
  const result = reconcileEvidence(fixtureBatch, fixtureDecisions);
  assert.equal(result.totals.missing_lane_decisions, 0);
  assert.equal(result.totals.stale_decisions, 0);
});

test("family decisions cannot cover Tier 2 or Tier 3 variants", () => {
  assert.throws(() => reconcileEvidence(tier2Batch, familyOnlyDecision), /direct semantic decision/);
});

test("AI notes cannot claim human approval", () => {
  assert.throws(() => validateDecision({ ...validDecision, evidence_notes: "SEND specialist approved" }), /human approval claim/);
});
```

- [ ] **Step 2: Run and confirm missing implementation failure**

Run: `node --test packages/content/tools/ai-review-evidence.test.mjs`

Expected: FAIL because reconciliation exports are undefined.

- [ ] **Step 3: Implement the evidence reconciler**

Validate review-unit identity, lane, status, criterion result for every rubric criterion, source IDs, confidence, finding structure and content hash. Treat the top-level batch hash as provenance: rebuilding the catalogue does not stale an unchanged review unit whose content and material-dependency identity still match. Accept Tier 1 family decisions only when the recorded family hash and boundary-case IDs match the current batch. Require direct decisions for every Tier 2 and Tier 3 unit. Emit `approved`, `approved_with_observation`, `revision_required` or `escalation_required`; never convert a missing decision into approval.

- [ ] **Step 4: Review Years 1-7 and write decisions**

For each year, inspect every pack teaching sequence, objective, misconceptions, assessment design, gamification, narration script, SEND response route and the batch's Tier 1 boundary cases plus every Tier 2/Tier 3 variant. Record separate lane decisions in the year file using this exact top-level shape:

```json
{
  "schema_version": 1,
  "year_group": 1,
  "batch_hash": "64 lowercase hex characters",
  "rubric_revision": "curriculum-send-v1",
  "source_set_revision": "sources-v1",
  "reviewer_implementation": "nexuslearn-ai-curriculum-send-review-v1",
  "model_identifier": "gpt-5",
  "decisions": []
}
```

Each decision must include content identity, lane, status, risk tier, criterion results, source IDs, confidence, evidence notes, findings and reviewed boundary/direct variant IDs. If any blocking issue is found, set `revision_required`, fix the source pack or generator, regenerate the batch and re-review the changed identities before approval.

- [ ] **Step 5: Run reconciliation after each year and at full scope**

Run for each value 1 through 7: `node packages/content/tools/ai-review-evidence.mjs --year <year>`

Run: `node packages/content/tools/ai-review-evidence.mjs --strict`

Expected after all seven years: 87 packs and 20,210 variants covered, zero missing lane decisions, zero stale decisions, zero unacknowledged blocking findings and no prohibited human-approval claims.

- [ ] **Step 6: Add strict reconciliation to quality:content**

Add `node ../../packages/content/tools/ai-review-evidence.mjs --strict` immediately after the batch generator in `apps/web/package.json`.

- [ ] **Step 7: Commit the reviewed year cohorts in substantial batches**

```bash
git add packages/content/review/decisions packages/content/tools/ai-review-evidence.mjs packages/content/tools/ai-review-evidence.test.mjs packages/content/generated/coverage/ai-review-evidence.json apps/web/public/content/ai-review-summary.json apps/web/package.json
git commit -m "Complete Year 1 to 7 AI curriculum and SEND review"
```

When review requires pack or generator fixes, inspect `git diff --name-only -- packages/content/packs packages/content/tools`, stage each reviewed source path explicitly, then inspect `git diff --cached --name-only` and unstage any file not intentionally revised by this task.

### Task 6: Authenticated Paginated Review API

**Files:**
- Create: `apps/api/internal/server/ai_reviews.go`
- Create: `apps/api/internal/server/ai_reviews_test.go`
- Modify: `apps/api/internal/server/server.go`

**Interfaces:**
- Consumes: Task 3 repository methods and account-session roles `platform_admin`, `content_editor`, `content_reviewer`.
- Produces: `GET /v1/admin/ai-reviews`, `GET /v1/admin/ai-reviews/summary` and `POST /v1/admin/ai-reviews`.

- [ ] **Step 1: Write failing handler authorization and cursor tests**

```go
func TestAIReviewListRequiresReviewRoleAndReturnsCursorPage(t *testing.T) {
    repo := &fakeAIReviewRepository{page: learning.AIReviewPage{Items: []learning.AIReviewEvidence{{ID: "r1"}}, NextCursor: "cursor-2"}}
    server := newAuthenticatedTestServer(t, repo, "content_reviewer")
    response := server.get("/v1/admin/ai-reviews?lane_id=ai_send_lead&limit=1")
    if response.Code != http.StatusOK { t.Fatalf("status=%d body=%s", response.Code, response.Body.String()) }
    assertJSONField(t, response.Body.Bytes(), "next_cursor", "cursor-2")
}

func TestAIReviewSaveRejectsChangedHashAndHumanClaim(t *testing.T) {
    server := newAuthenticatedTestServer(t, &fakeAIReviewRepository{}, "content_reviewer")
    response := server.postJSON("/v1/admin/ai-reviews", invalidHumanClaimPayload())
    if response.Code != http.StatusBadRequest { t.Fatalf("status=%d", response.Code) }
}
```

- [ ] **Step 2: Run the focused server tests and verify route failure**

Run: `go test ./internal/server -run TestAIReview -count=1`

Working directory: `apps/api`

Expected: FAIL because handlers and routes do not exist.

- [ ] **Step 3: Implement strict handlers**

Require an account session with `platform_admin`, `content_editor` or `content_reviewer`. Permit all three roles to read. Permit `content_reviewer` to submit only the two AI review lanes; block release/configuration writes through the existing `requireAdmin` rule. Parse query filters and opaque cursor, clamp limit, validate body with `learning.ValidateAIReviewEvidence`, require `Idempotency-Key`, and map `ErrIdempotencyConflict` to HTTP 409.

Summary response fields must be:

```go
map[string]any{
    "packs": 87,
    "variants": 20210,
    "current_ai_curriculum_lead": 0,
    "current_ai_send_lead": 0,
    "stale": 0,
    "revision_required": 0,
    "escalation_required": 0,
    "controlled_pilot_allowed": false,
}
```

Values must come from repository queries, not constants; the literal map documents the response contract.

- [ ] **Step 4: Register routes and run server tests**

Register:

```go
s.mux.HandleFunc("GET /v1/admin/ai-reviews", s.handleListAIReviews)
s.mux.HandleFunc("GET /v1/admin/ai-reviews/summary", s.handleAIReviewSummary)
s.mux.HandleFunc("POST /v1/admin/ai-reviews", s.handleSaveAIReview)
```

Run: `go test ./internal/server -run TestAIReview -count=1`

Run: `go test ./... -count=1`

Expected: PASS.

- [ ] **Step 5: Commit the API**

```bash
git add apps/api/internal/server/ai_reviews.go apps/api/internal/server/ai_reviews_test.go apps/api/internal/server/server.go
git commit -m "Expose paginated AI review operations"
```

### Task 7: Fail-Closed Pilot and Public Release Enforcement

**Files:**
- Modify: `apps/api/internal/learning/content_release.go`
- Modify: `apps/api/internal/learning/content_release_test.go`
- Modify: `apps/api/internal/server/content_reviews.go`
- Modify: `apps/api/internal/server/content_reviews_test.go`
- Modify: `packages/content/roadmaps/content-release-policy.json`

**Interfaces:**
- Consumes: `AIReviewEligibility` from Task 3, current human evidence lanes from the legacy append-only review and narration ledgers, and exact pack hashes from release chunks.
- Produces: `ValidateReleaseEvidence(channel string, ai AIReviewEligibility, human HumanReleaseEvidence) error` and transactional enforcement before any catalogue activation.

- [ ] **Step 1: Write failing release matrix tests**

```go
func TestValidateReleaseEvidenceMatrix(t *testing.T) {
    ai := AIReviewEligibility{ControlledPilotAllowed: true}
    human := HumanReleaseEvidence{}
    if err := ValidateReleaseEvidence("review", ai, human); err != nil { t.Fatal(err) }
    if err := ValidateReleaseEvidence("pilot", ai, human); err != nil { t.Fatal(err) }
    if err := ValidateReleaseEvidence("live", ai, human); !errors.Is(err, ErrContentReleaseIncomplete) { t.Fatalf("live must require human gates: %v", err) }
    human = HumanReleaseEvidence{SafeguardingApproved: true, RequiredAudioListeningApproved: true, ChildPilotEvidenceApproved: true}
    if err := ValidateReleaseEvidence("live", ai, human); err != nil { t.Fatal(err) }
    ai.ControlledPilotAllowed = false
    if err := ValidateReleaseEvidence("pilot", ai, human); !errors.Is(err, ErrContentReleaseIncomplete) { t.Fatalf("pilot must require dual AI: %v", err) }
}
```

- [ ] **Step 2: Run and confirm missing-function failure**

Run: `go test ./internal/learning -run 'TestValidateReleaseEvidenceMatrix|TestValidateReleaseChannel' -count=1`

Working directory: `apps/api`

Expected: FAIL because `ValidateReleaseEvidence` is undefined.

- [ ] **Step 3: Implement and call the evidence gate inside ApplyContentRelease**

Evaluate the exact `pack_id`, payload SHA-256, rubric revision, source-set revision and reviewer implementation recorded in the signed manifest metadata. For `pilot`, require current approved or approved-with-observation decisions from both AI lanes. For `live`, require both AI lanes with status `approved` plus human safeguarding, all required audio hashes listened and approved, and child-pilot evidence. Run the query and validation inside the same transaction before `applyReleasePack`.

Remove the old `pending_human_review` wording for AI lanes from `buildContentReviewGate`; preserve human lane names and state. Update `content-release-policy.json` so its machine-readable gates match the matrix exactly.

- [ ] **Step 4: Prove missing and stale evidence fail closed**

Run: `go test ./internal/learning -run 'TestValidateReleaseEvidenceMatrix|TestValidateReleaseChannel|TestApplyContentRelease' -count=1`

Run: `go test ./internal/server -run TestBuildContentReviewGate -count=1`

Expected: PASS, including stale-hash and missing-human-evidence cases.

- [ ] **Step 5: Commit release enforcement**

```bash
git add apps/api/internal/learning/content_release.go apps/api/internal/learning/content_release_test.go apps/api/internal/server/content_reviews.go apps/api/internal/server/content_reviews_test.go packages/content/roadmaps/content-release-policy.json
git commit -m "Enforce AI and human content release gates"
```

### Task 8: Admin Review Workspace and Release Explanation

**Files:**
- Create: `apps/web/src/lib/admin-reviews.ts`
- Create: `apps/web/src/components/admin/AdminReviewWorkspace.tsx`
- Create: `apps/web/src/components/admin/AdminReleaseGate.tsx`
- Modify: `apps/web/src/app/admin/page.tsx`
- Create: `apps/web/tests/e2e/admin-review-workflow.spec.ts`

**Interfaces:**
- Consumes: Task 6 API and existing `accountSessionHeaders`/`accountSessionRole`.
- Produces: `getAIReviews(query): Promise<AIReviewPage>`, `getAIReviewSummary(): Promise<AIReviewSummary>`, `saveAIReview(input): Promise<AIReviewEvidence>` and authenticated review/release UI.

- [x] **Step 1: Write a failing Playwright admin review journey**

```ts
test("reviewer filters the SEND queue and sees honest release gates", async ({ page }) => {
  await seedAccountSession(page, "content_reviewer");
  await mockAIReviewEndpoints(page, {
    items: [{ content_id: "en-y1-phonics", lane_id: "ai_send_lead", status: "revision_required", stale: false }],
    summary: { packs: 87, variants: 20210, controlled_pilot_allowed: false, stale: 0, revision_required: 1 },
  });
  await page.goto("/admin?section=reviews");
  await expect(page.getByRole("heading", { name: "Curriculum and SEND review" })).toBeVisible();
  await page.getByLabel("Review lane").selectOption("ai_send_lead");
  await expect(page.getByText("AI SEND Lead")).toBeVisible();
  await expect(page.getByText(/not human SEND-specialist approval/i)).toBeVisible();
  await expect(page.getByText(/controlled pilot blocked/i)).toBeVisible();
});
```

- [x] **Step 2: Run the focused browser test and verify UI failure**

Run: `npx playwright test tests/e2e/admin-review-workflow.spec.ts --project=desktop-chromium`

Working directory: `apps/web`

Expected: FAIL because the review section is absent.

- [x] **Step 3: Implement the typed client**

Define exact API response types mirroring the Go JSON types. Apply `accountSessionHeaders(["platform_admin", "content_editor", "content_reviewer"])`, `cache: "no-store"`, URLSearchParams filters, opaque cursor and a generated UUID `Idempotency-Key` for saves. Throw API-provided messages without logging credentials or evidence payloads.

- [x] **Step 4: Implement the review workspace**

Render lane, status, risk, year, subject and pack filters; cursor-based next-page navigation; content identity and stale state; criterion outcomes; sources; findings; prior revision linkage; and a decision editor. Disable approval when a blocking criterion fails, required source IDs are missing, the hash changed or the API summary reports a stale batch.

Use visible labels `AI Curriculum Lead` and `AI SEND Lead`, followed by the fixed disclosure `AI review evidence — not independent human professional approval.`

- [x] **Step 5: Implement the release-gate panel and integrate admin navigation**

Show separate sections:

- Controlled pilot: dual current AI approval, technical gates and pilot controls.
- Public production: dual current AI approval, human safeguarding, required human audio listening and real-child pilot evidence.

Unauthenticated `/admin` continues to render only the existing simple sign-in card. Add `Reviews` to authenticated role navigation and keep the existing administration sections behind the session boundary.

- [x] **Step 6: Run Playwright, Axe, lint and production build**

Run: `npx playwright test tests/e2e/admin-review-workflow.spec.ts --project=desktop-chromium`

Run: `npm run lint`

Run: `npm run build`

Expected: all commands pass; no serious or critical Axe violations; unauthenticated tests find no review data.

- [x] **Step 7: Commit the admin workspace**

```bash
git add apps/web/src/lib/admin-reviews.ts apps/web/src/components/admin/AdminReviewWorkspace.tsx apps/web/src/components/admin/AdminReleaseGate.tsx apps/web/src/app/admin/page.tsx apps/web/tests/e2e/admin-review-workflow.spec.ts
git commit -m "Add authenticated AI review workspace"
```

### Task 9: Import Reviewed Evidence and Reconcile Backend State

**Files:**
- Create: `packages/content/tools/import-ai-review-evidence.mjs`
- Create: `packages/content/tools/import-ai-review-evidence.test.mjs`
- Modify: `packages/content/tools/content-release-snapshot.mjs`
- Modify: `apps/web/package.json`

**Interfaces:**
- Consumes: Task 5 full evidence report and Task 6 POST endpoint.
- Produces: idempotent evidence import and a release snapshot that reports database-backed gate state separately from source projections.

- [x] **Step 1: Write failing import idempotency tests**

```js
test("import key is stable for one immutable review identity", () => {
  const key1 = evidenceIdempotencyKey(validEvidence);
  const key2 = evidenceIdempotencyKey({ ...validEvidence });
  assert.equal(key1, key2);
});

test("import refuses evidence absent from the current review batch", async () => {
  await assert.rejects(() => importEvidence({ report: staleReport, batch: currentBatch, api: fakeAPI }), /stale review unit/);
});
```

- [x] **Step 2: Run and confirm missing implementation failure**

Run: `node --test packages/content/tools/import-ai-review-evidence.test.mjs`

Expected: FAIL because import functions are missing.

- [x] **Step 3: Implement resumable import**

Read the full evidence ledger, verify its self-hash, reconcile every review-unit identity with the current batch, sort by immutable identity, POST each decision with idempotency key `sha256(content_id + content_hash + lane_id + rubric_revision + source_set_revision + reviewer_implementation)`, retry 429/502/503/504 with bounded exponential backoff, stop on 400/401/403/409 and write only aggregate progress to stdout. Never print bearer tokens, evidence text or learner data.

- [x] **Step 4: Separate source projection from backend release state**

Update `content-release-snapshot.mjs` to label generated source figures `source_review_projection` and API figures `backend_release_state`. It must refuse to report `promotion_allowed: true` when the API is unavailable, the response revision differs or either AI lane is incomplete.

- [x] **Step 5: Run tests and a dry-run import**

Run: `node --test packages/content/tools/import-ai-review-evidence.test.mjs`

Run: `node packages/content/tools/import-ai-review-evidence.mjs --dry-run`

Expected: the dry run reports the exact number of evidence records, zero malformed identities and zero network writes.

- [x] **Step 6: Commit importer and release reconciliation**

```bash
git add packages/content/tools/import-ai-review-evidence.mjs packages/content/tools/import-ai-review-evidence.test.mjs packages/content/tools/content-release-snapshot.mjs apps/web/package.json
git commit -m "Reconcile AI reviews with backend release state"
```

### Task 10: Full Verification and Evidence Handoff

**Files:**
- Modify: `docs/QUALITY_GATES.md`
- Modify: `docs/CURRICULUM_AND_CONTENT_STRATEGY.md`
- Modify: `docs/IMPLEMENTATION_PLAN.md`

**Interfaces:**
- Consumes: all prior tasks.
- Produces: verified commands, current metrics, honest remaining human gates and a clean integration commit.

- [ ] **Step 1: Run content and unit verification from a clean staging state**

Run: `node --test packages/content/tools/lib/review-evidence.test.mjs packages/content/tools/ai-review-batch.test.mjs packages/content/tools/ai-review-evidence.test.mjs packages/content/tools/import-ai-review-evidence.test.mjs`

Run: `npm run quality:content`

Working directory for the second command: `apps/web`

Expected: PASS with 87 packs, 20,210 variants, zero missing AI lane decisions, zero stale approvals and zero unresolved blocking findings. If review discovers genuine content defects, those figures remain non-zero until source fixes and re-review are complete.

- [ ] **Step 2: Run complete API verification**

Run: `gofmt -w internal/learning/ai_reviews.go internal/learning/ai_reviews_test.go internal/learning/content_release.go internal/learning/content_release_test.go internal/server/ai_reviews.go internal/server/ai_reviews_test.go internal/server/content_reviews.go internal/server/content_reviews_test.go internal/server/server.go`

Run: `go test ./... -count=1`

Working directory: `apps/api`

Expected: PASS.

- [ ] **Step 3: Run complete web verification**

Run: `npm run lint`

Run: `npm run quality:performance`

Run: `npm run build`

Run: `npx playwright test --project=desktop-chromium --project=mobile-chromium`

Working directory: `apps/web`

Expected: PASS, including stable mission visuals and authenticated/unauthenticated admin journeys.

- [ ] **Step 4: Reconcile generated and database evidence**

Run: `node packages/content/tools/import-ai-review-evidence.mjs --dry-run`

Run: `node packages/content/tools/content-release-snapshot.mjs --strict-backend`

Expected: the source and backend hashes match; controlled-pilot state reflects dual AI decisions; public production remains blocked until human safeguarding, required audio listening and child-pilot evidence are recorded.

- [ ] **Step 5: Update governance documents with measured results**

Document exact executed counts and commands. State `AI Curriculum Lead approved` and `AI SEND Lead approved` only for evidence records that passed. State human safeguarding, human audio listening and real-child pilot as incomplete until their independent ledgers prove otherwise. Do not report technical validity as educational or human approval.

- [ ] **Step 6: Inspect staged scope and commit**

Run: `git diff --check`

Run: `git status --short`

Stage only intentional source, tests, approved review evidence and required generated release artifacts, then run: `git diff --cached --check`.

```bash
git add docs/QUALITY_GATES.md docs/CURRICULUM_AND_CONTENT_STRATEGY.md docs/IMPLEMENTATION_PLAN.md
git commit -m "Document verified AI review release gates"
```

- [ ] **Step 7: Push main and verify the remote commit**

Run the repository's approved credential-safe push procedure without printing the PAT, then compare `git rev-parse HEAD` with `git ls-remote <authenticated-origin> refs/heads/main`.

Expected: both hashes are identical. Check GitHub Actions and do not claim completion while any required check is pending or failing.

## Completion Gate

This plan is complete only when all ten tasks are checked, focused tests and full quality gates pass, GitHub `main` matches the verified local commit, and the release report truthfully separates:

- complete/current AI Curriculum Lead evidence;
- complete/current AI SEND Lead evidence;
- human safeguarding state;
- required produced-audio listening state;
- real-child pilot evidence state.

Completion of this plan authorises the next programme plan; it does not by itself authorise public production.
