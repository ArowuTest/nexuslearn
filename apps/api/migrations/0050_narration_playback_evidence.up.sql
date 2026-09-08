ALTER TABLE narration_reviews
  ADD COLUMN IF NOT EXISTS playback_evidence jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE narration_reviews
  DROP CONSTRAINT IF EXISTS narration_reviews_playback_evidence_object_check;

ALTER TABLE narration_reviews
  ADD CONSTRAINT narration_reviews_playback_evidence_object_check
  CHECK (jsonb_typeof(playback_evidence) = 'object');
