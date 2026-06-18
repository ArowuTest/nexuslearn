ALTER TABLE student_objective_mastery
  DROP CONSTRAINT IF EXISTS student_objective_mastery_evidence_confidence_check,
  DROP COLUMN IF EXISTS evidence_confidence,
  DROP COLUMN IF EXISTS retained_success_count,
  DROP COLUMN IF EXISTS independent_correct_count,
  DROP COLUMN IF EXISTS format_count,
  DROP COLUMN IF EXISTS evidence_count;

ALTER TABLE mastery_history
  DROP COLUMN IF EXISTS retention_review;
