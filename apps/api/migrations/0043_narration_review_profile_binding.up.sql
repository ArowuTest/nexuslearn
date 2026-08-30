ALTER TABLE narration_reviews
  ADD COLUMN IF NOT EXISTS production_profile_sha256 text;

ALTER TABLE narration_reviews
  DROP CONSTRAINT IF EXISTS narration_reviews_production_profile_sha256_check;

ALTER TABLE narration_reviews
  ADD CONSTRAINT narration_reviews_production_profile_sha256_check
  CHECK (
    production_profile_sha256 IS NULL
    OR production_profile_sha256 ~ '^[0-9a-f]{64}$'
  );

CREATE INDEX IF NOT EXISTS narration_reviews_binding_updated_idx
  ON narration_reviews (
    asset_id,
    text_sha256,
    audio_sha256,
    production_profile_sha256,
    updated_at DESC,
    id DESC
  );
