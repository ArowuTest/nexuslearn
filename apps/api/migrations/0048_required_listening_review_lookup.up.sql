-- Runtime availability must inspect the latest decision before comparing hashes.
CREATE INDEX IF NOT EXISTS idx_narration_reviews_asset_created_id
  ON narration_reviews (asset_id, created_at DESC, id DESC);
