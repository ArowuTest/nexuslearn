CREATE TABLE IF NOT EXISTS teacher_evidence_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  objective_id text NOT NULL REFERENCES curriculum_objectives(id) ON DELETE CASCADE,
  evidence_type text NOT NULL
    CHECK (evidence_type IN ('observation', 'work_sample', 'conversation', 'assessment', 'external')),
  outcome text NOT NULL
    CHECK (outcome IN ('secure', 'developing', 'needs_support', 'inconclusive')),
  note text NOT NULL,
  source_ref text NOT NULL DEFAULT '',
  recorded_by text NOT NULL DEFAULT '',
  recorded_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS teacher_evidence_student_objective_idx
  ON teacher_evidence_records (student_id, objective_id, recorded_at DESC);

CREATE TABLE IF NOT EXISTS intervention_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  objective_id text NOT NULL REFERENCES curriculum_objectives(id) ON DELETE CASCADE,
  title text NOT NULL,
  need text NOT NULL,
  strategy text NOT NULL,
  priority integer NOT NULL DEFAULT 85 CHECK (priority BETWEEN 1 AND 100),
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'monitoring', 'completed', 'cancelled')),
  review_due_at timestamptz,
  created_by text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS intervention_plans_student_priority_idx
  ON intervention_plans (student_id, status, priority DESC, review_due_at);
