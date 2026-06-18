CREATE TABLE IF NOT EXISTS assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  objective_id text NOT NULL REFERENCES curriculum_objectives(id) ON DELETE CASCADE,
  activity_id text REFERENCES activities(id) ON DELETE SET NULL,
  title text NOT NULL,
  priority integer NOT NULL DEFAULT 70 CHECK (priority BETWEEN 1 AND 100),
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'completed', 'cancelled')),
  due_at timestamptz,
  created_by text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS assignments_student_priority_idx
  ON assignments (student_id, status, priority DESC, due_at);

CREATE INDEX IF NOT EXISTS assignments_school_idx
  ON assignments (school_id, status, updated_at DESC);
