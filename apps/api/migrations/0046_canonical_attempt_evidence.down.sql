ALTER TABLE question_attempts
  DROP COLUMN IF EXISTS question_version;
DROP TABLE IF EXISTS question_grading_versions;
