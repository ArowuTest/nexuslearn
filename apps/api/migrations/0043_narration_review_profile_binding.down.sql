DROP INDEX IF EXISTS narration_reviews_binding_updated_idx;

ALTER TABLE narration_reviews
  DROP CONSTRAINT IF EXISTS narration_reviews_production_profile_sha256_check;

ALTER TABLE narration_reviews
  DROP COLUMN IF EXISTS production_profile_sha256;
