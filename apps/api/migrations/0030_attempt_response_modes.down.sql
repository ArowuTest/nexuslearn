DROP INDEX IF EXISTS question_attempts_response_mode_idx;

ALTER TABLE mastery_history
  DROP COLUMN IF EXISTS response_mode;

ALTER TABLE question_attempts
  DROP COLUMN IF EXISTS response_mode;
