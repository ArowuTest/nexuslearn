CREATE TABLE IF NOT EXISTS content_review_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id text NOT NULL,
  batch_sha256 text NOT NULL CHECK (batch_sha256 ~ '^[0-9a-f]{64}$'),
  pack_id text NOT NULL,
  lane_id text NOT NULL,
  decision text NOT NULL CHECK (decision IN ('approved', 'revise', 'hold')),
  reviewer_id text NOT NULL DEFAULT '',
  reviewer_name text NOT NULL,
  evidence_notes text NOT NULL,
  candidate_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  revision_actions jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS content_review_decisions_scope_idx
  ON content_review_decisions(batch_id, pack_id, lane_id, created_at DESC);

CREATE INDEX IF NOT EXISTS content_review_decisions_latest_idx
  ON content_review_decisions(batch_id, created_at DESC);
