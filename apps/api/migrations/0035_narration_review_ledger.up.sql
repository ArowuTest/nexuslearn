CREATE TABLE IF NOT EXISTS narration_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id text NOT NULL,
  text_sha256 text NOT NULL CHECK (text_sha256 ~ '^[0-9a-f]{64}$'),
  audio_sha256 text NOT NULL CHECK (audio_sha256 ~ '^[0-9a-f]{64}$'),
  decision text NOT NULL CHECK (decision IN ('approved', 'rejected')),
  reviewer_id text NOT NULL DEFAULT '',
  reviewer_name text NOT NULL,
  criteria jsonb NOT NULL DEFAULT '{}'::jsonb,
  rejection_reasons jsonb NOT NULL DEFAULT '[]'::jsonb,
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_narration_reviews_asset_updated
  ON narration_reviews(asset_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_narration_reviews_decision_updated
  ON narration_reviews(decision, updated_at DESC);
