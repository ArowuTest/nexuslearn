ALTER TABLE question_attempts
  ADD COLUMN IF NOT EXISTS response_mode text NOT NULL DEFAULT 'interactive';

ALTER TABLE mastery_history
  ADD COLUMN IF NOT EXISTS response_mode text NOT NULL DEFAULT 'interactive';

CREATE INDEX IF NOT EXISTS question_attempts_response_mode_idx
  ON question_attempts (student_id, response_mode, created_at DESC);
