CREATE TABLE IF NOT EXISTS lesson_step_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  activity_id text NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
  objective_id text NOT NULL REFERENCES curriculum_objectives(id) ON DELETE CASCADE,
  step_id text NOT NULL,
  step_kind text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'completed'
    CHECK (status IN ('started', 'completed', 'skipped', 'paused')),
  duration_ms integer NOT NULL DEFAULT 0 CHECK (duration_ms >= 0),
  support_used text[] NOT NULL DEFAULT '{}',
  recorded_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS lesson_step_attempts_student_activity_idx
  ON lesson_step_attempts (student_id, activity_id, recorded_at DESC);

CREATE INDEX IF NOT EXISTS lesson_step_attempts_student_objective_idx
  ON lesson_step_attempts (student_id, objective_id, recorded_at DESC);
