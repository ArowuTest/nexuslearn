ALTER TABLE ai_review_evidence
  ADD COLUMN IF NOT EXISTS reviewed_variant_ids jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE ai_review_evidence
  ADD CONSTRAINT ai_review_evidence_reviewed_variant_ids_array
  CHECK (jsonb_typeof(reviewed_variant_ids) = 'array');

CREATE INDEX IF NOT EXISTS ai_review_evidence_current_idx
  ON ai_review_evidence (supersedes_id)
  WHERE supersedes_id IS NOT NULL;
