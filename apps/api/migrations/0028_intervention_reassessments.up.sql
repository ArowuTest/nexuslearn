CREATE TABLE IF NOT EXISTS intervention_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  intervention_id uuid NOT NULL REFERENCES intervention_plans(id) ON DELETE CASCADE,
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  objective_id text NOT NULL REFERENCES curriculum_objectives(id) ON DELETE CASCADE,
  outcome text NOT NULL
    CHECK (outcome IN ('continue', 'monitor', 'complete', 'reopen')),
  evidence_note text NOT NULL,
  next_review_due_at timestamptz,
  reviewed_by text NOT NULL DEFAULT '',
  reviewed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS intervention_reviews_plan_date_idx
  ON intervention_reviews (intervention_id, reviewed_at DESC);

CREATE INDEX IF NOT EXISTS intervention_reviews_student_date_idx
  ON intervention_reviews (student_id, reviewed_at DESC);
