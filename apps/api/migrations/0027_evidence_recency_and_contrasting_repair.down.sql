ALTER TABLE student_misconception_state
  DROP COLUMN IF EXISTS repair_formats,
  DROP COLUMN IF EXISTS repair_question_ids;

ALTER TABLE student_objective_mastery
  DROP CONSTRAINT IF EXISTS student_objective_mastery_evidence_freshness_check;

ALTER TABLE student_objective_mastery
  DROP COLUMN IF EXISTS last_evidence_at,
  DROP COLUMN IF EXISTS evidence_freshness,
  DROP COLUMN IF EXISTS effective_evidence_score;
