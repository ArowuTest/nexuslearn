ALTER TABLE narration_reviews
  DROP CONSTRAINT IF EXISTS narration_reviews_playback_evidence_object_check;

ALTER TABLE narration_reviews
  DROP COLUMN IF EXISTS playback_evidence;
