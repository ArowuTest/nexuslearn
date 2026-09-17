-- Local migration testing only: old unconditional writers are not safe rollback targets.
ALTER TABLE student_engagement_profiles DROP COLUMN version;
