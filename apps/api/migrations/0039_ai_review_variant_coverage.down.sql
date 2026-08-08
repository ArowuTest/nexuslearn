DROP INDEX IF EXISTS ai_review_evidence_current_idx;

ALTER TABLE ai_review_evidence
  DROP CONSTRAINT IF EXISTS ai_review_evidence_reviewed_variant_ids_array;

ALTER TABLE ai_review_evidence
  DROP COLUMN IF EXISTS reviewed_variant_ids;
