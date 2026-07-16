CREATE TABLE IF NOT EXISTS mock_assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  school_id uuid REFERENCES schools(id) ON DELETE SET NULL,
  created_by_role text NOT NULL CHECK (created_by_role IN ('pupil', 'parent', 'teacher', 'school_admin', 'admin')),
  created_by text NOT NULL DEFAULT '',
  subject text NOT NULL,
  year_group integer NOT NULL CHECK (year_group BETWEEN 1 AND 7),
  year_from integer NOT NULL CHECK (year_from BETWEEN 1 AND 7),
  year_to integer NOT NULL CHECK (year_to BETWEEN 1 AND 7),
  title text NOT NULL,
  status text NOT NULL DEFAULT 'ready'
    CHECK (status IN ('ready', 'in_progress', 'completed', 'cancelled')),
  question_count integer NOT NULL CHECK (question_count BETWEEN 1 AND 40),
  duration_minutes integer NOT NULL DEFAULT 0 CHECK (duration_minutes BETWEEN 0 AND 120),
  include_revision boolean NOT NULL DEFAULT true,
  include_stretch boolean NOT NULL DEFAULT false,
  accessibility jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  CHECK (year_from <= year_to)
);

CREATE TABLE IF NOT EXISTS mock_assessment_items (
  assessment_id uuid NOT NULL REFERENCES mock_assessments(id) ON DELETE CASCADE,
  position integer NOT NULL CHECK (position > 0),
  question_id text NOT NULL REFERENCES questions(id) ON DELETE RESTRICT,
  objective_id text NOT NULL REFERENCES curriculum_objectives(id) ON DELETE RESTRICT,
  activity_id text REFERENCES activities(id) ON DELETE SET NULL,
  selection_reason text NOT NULL DEFAULT '',
  PRIMARY KEY (assessment_id, position),
  UNIQUE (assessment_id, question_id)
);

CREATE INDEX IF NOT EXISTS mock_assessments_student_created_idx
  ON mock_assessments (student_id, created_at DESC);

CREATE INDEX IF NOT EXISTS mock_assessments_school_status_idx
  ON mock_assessments (school_id, status, updated_at DESC);

CREATE INDEX IF NOT EXISTS mock_assessment_items_question_idx
  ON mock_assessment_items (question_id);
