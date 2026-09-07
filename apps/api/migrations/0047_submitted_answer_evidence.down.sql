-- Rollback removes newly collected original input; export it first if needed.
ALTER TABLE question_attempts
  DROP CONSTRAINT submitted_evidence_pair,
  DROP COLUMN submitted_response,
  DROP COLUMN grader_revision;
