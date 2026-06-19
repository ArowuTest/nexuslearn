ALTER TABLE student_objective_mastery
  ADD COLUMN IF NOT EXISTS effective_evidence_score numeric(8,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS evidence_freshness text NOT NULL DEFAULT 'stale',
  ADD COLUMN IF NOT EXISTS last_evidence_at timestamptz;

ALTER TABLE student_objective_mastery
  DROP CONSTRAINT IF EXISTS student_objective_mastery_evidence_freshness_check;

ALTER TABLE student_objective_mastery
  ADD CONSTRAINT student_objective_mastery_evidence_freshness_check
  CHECK (evidence_freshness IN ('current', 'aging', 'stale'));

ALTER TABLE student_misconception_state
  ADD COLUMN IF NOT EXISTS repair_question_ids text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS repair_formats text[] NOT NULL DEFAULT '{}';
