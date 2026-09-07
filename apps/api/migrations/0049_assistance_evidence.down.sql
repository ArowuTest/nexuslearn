ALTER TABLE mastery_history
  DROP COLUMN IF EXISTS assistance_used;

ALTER TABLE question_attempts
  DROP COLUMN IF EXISTS assistance_used;
