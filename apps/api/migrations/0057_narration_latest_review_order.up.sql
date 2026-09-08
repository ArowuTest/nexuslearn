-- The audio review queue selects one latest decision per asset with this
-- exact ordering. Keep the append-only review ledger seekable as it grows.
CREATE INDEX IF NOT EXISTS narration_reviews_asset_updated_id_idx
  ON narration_reviews (asset_id, updated_at DESC, id DESC);
