DROP INDEX IF EXISTS question_attempts_mock_question_unique_idx;
DROP INDEX IF EXISTS question_attempts_mock_assessment_idx;
ALTER TABLE question_attempts DROP COLUMN IF EXISTS mock_assessment_id;
