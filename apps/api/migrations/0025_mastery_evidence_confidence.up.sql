ALTER TABLE mastery_history
  ADD COLUMN IF NOT EXISTS retention_review boolean NOT NULL DEFAULT false;

ALTER TABLE student_objective_mastery
  ADD COLUMN IF NOT EXISTS evidence_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS format_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS independent_correct_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS retained_success_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS evidence_confidence text NOT NULL DEFAULT 'limited';

ALTER TABLE student_objective_mastery
  DROP CONSTRAINT IF EXISTS student_objective_mastery_evidence_confidence_check;

ALTER TABLE student_objective_mastery
  ADD CONSTRAINT student_objective_mastery_evidence_confidence_check
  CHECK (evidence_confidence IN ('limited', 'emerging', 'supported', 'strong'));
