CREATE TABLE IF NOT EXISTS ai_review_evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content_id text NOT NULL,
  content_type text NOT NULL CHECK (content_type IN ('pack', 'variant', 'variant_family')),
  content_revision text NOT NULL,
  content_hash text NOT NULL CHECK (content_hash ~ '^[0-9a-f]{64}$'),
  pack_id text NOT NULL,
  year_group integer NOT NULL CHECK (year_group BETWEEN 1 AND 7),
  subject text NOT NULL,
  lane_id text NOT NULL CHECK (lane_id IN ('ai_curriculum_lead', 'ai_send_lead')),
  status text NOT NULL CHECK (status IN ('approved', 'approved_with_observation', 'revision_required', 'escalation_required')),
  risk_tier text NOT NULL CHECK (risk_tier IN ('tier_1', 'tier_2', 'tier_3')),
  rubric_revision text NOT NULL,
  source_set_revision text NOT NULL,
  reviewer_implementation text NOT NULL,
  model_identifier text NOT NULL,
  confidence numeric(4,3) NOT NULL CHECK (confidence BETWEEN 0 AND 1),
  criterion_results jsonb NOT NULL,
  source_ids jsonb NOT NULL,
  evidence_notes text NOT NULL,
  supersedes_id uuid REFERENCES ai_review_evidence(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (jsonb_typeof(criterion_results) = 'object'),
  CHECK (jsonb_typeof(source_ids) = 'array'),
  CHECK (supersedes_id IS NULL OR supersedes_id <> id),
  UNIQUE(content_id, content_hash, lane_id, rubric_revision, source_set_revision, reviewer_implementation)
);

CREATE TABLE IF NOT EXISTS ai_review_findings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  evidence_id uuid NOT NULL REFERENCES ai_review_evidence(id) ON DELETE RESTRICT,
  criterion_id text NOT NULL,
  severity text NOT NULL CHECK (severity IN ('observation', 'blocking', 'escalation')),
  finding_code text NOT NULL,
  affected_fields jsonb NOT NULL DEFAULT '[]'::jsonb,
  rationale text NOT NULL,
  required_revisions jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (jsonb_typeof(affected_fields) = 'array'),
  CHECK (jsonb_typeof(required_revisions) = 'array'),
  UNIQUE(evidence_id, criterion_id, finding_code)
);

CREATE INDEX IF NOT EXISTS ai_review_evidence_queue_idx
  ON ai_review_evidence(lane_id, status, risk_tier, year_group, subject, created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS ai_review_evidence_pack_idx
  ON ai_review_evidence(pack_id, lane_id, created_at DESC);

CREATE INDEX IF NOT EXISTS ai_review_evidence_identity_idx
  ON ai_review_evidence(content_id, content_hash, lane_id);

CREATE INDEX IF NOT EXISTS ai_review_findings_evidence_idx
  ON ai_review_findings(evidence_id, severity, created_at, id);
