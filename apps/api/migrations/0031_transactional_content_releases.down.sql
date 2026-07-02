DROP INDEX IF EXISTS idx_reward_rules_release;
DROP INDEX IF EXISTS idx_questions_release;
DROP INDEX IF EXISTS idx_activities_release;
DROP INDEX IF EXISTS idx_curriculum_objectives_release;
DROP INDEX IF EXISTS idx_content_release_chunks_release;
DROP INDEX IF EXISTS idx_content_releases_channel_status;

ALTER TABLE reward_rules DROP COLUMN IF EXISTS pack_id, DROP COLUMN IF EXISTS content_release_id;
ALTER TABLE questions DROP COLUMN IF EXISTS pack_id, DROP COLUMN IF EXISTS content_release_id;
ALTER TABLE activities DROP COLUMN IF EXISTS pack_id, DROP COLUMN IF EXISTS content_release_id;
ALTER TABLE curriculum_objectives DROP COLUMN IF EXISTS pack_id, DROP COLUMN IF EXISTS content_release_id;

DROP TABLE IF EXISTS content_release_chunks;
DROP TABLE IF EXISTS content_releases;
