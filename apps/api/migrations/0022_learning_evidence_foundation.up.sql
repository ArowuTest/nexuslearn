CREATE TABLE IF NOT EXISTS mastery_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  objective_id text NOT NULL REFERENCES curriculum_objectives(id) ON DELETE CASCADE,
  question_id text,
  prior_score integer NOT NULL CHECK (prior_score BETWEEN 0 AND 100),
  new_score integer NOT NULL CHECK (new_score BETWEEN 0 AND 100),
  mastery_delta integer NOT NULL,
  correct boolean NOT NULL,
  hint_used boolean NOT NULL DEFAULT false,
  confidence integer CHECK (confidence BETWEEN 1 AND 5),
  response_format text NOT NULL DEFAULT '',
  recorded_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS mastery_history_student_objective_idx
  ON mastery_history (student_id, objective_id, recorded_at DESC);

CREATE TABLE IF NOT EXISTS student_misconception_state (
  student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  objective_id text NOT NULL REFERENCES curriculum_objectives(id) ON DELETE CASCADE,
  misconception_key text NOT NULL,
  status text NOT NULL DEFAULT 'suspected'
    CHECK (status IN ('suspected', 'confirmed', 'repairing', 'repaired', 'reopened')),
  evidence_count integer NOT NULL DEFAULT 0,
  repair_evidence_count integer NOT NULL DEFAULT 0,
  last_question_id text,
  first_detected_at timestamptz NOT NULL DEFAULT now(),
  last_evidence_at timestamptz NOT NULL DEFAULT now(),
  repaired_at timestamptz,
  PRIMARY KEY (student_id, objective_id, misconception_key)
);

CREATE INDEX IF NOT EXISTS student_misconception_status_idx
  ON student_misconception_state (student_id, status, last_evidence_at DESC);
