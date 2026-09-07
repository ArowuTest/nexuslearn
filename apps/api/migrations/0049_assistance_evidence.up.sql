ALTER TABLE question_attempts
  ADD COLUMN IF NOT EXISTS assistance_used text[] NOT NULL DEFAULT '{}'::text[];

ALTER TABLE mastery_history
  ADD COLUMN IF NOT EXISTS assistance_used text[] NOT NULL DEFAULT '{}'::text[];
