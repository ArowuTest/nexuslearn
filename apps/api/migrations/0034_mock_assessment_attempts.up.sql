ALTER TABLE question_attempts
  ADD COLUMN IF NOT EXISTS mock_assessment_id uuid
    REFERENCES mock_assessments(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS question_attempts_mock_assessment_idx
  ON question_attempts (mock_assessment_id, created_at DESC)
  WHERE mock_assessment_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS question_attempts_mock_question_unique_idx
  ON question_attempts (mock_assessment_id, question_id)
  WHERE mock_assessment_id IS NOT NULL;
