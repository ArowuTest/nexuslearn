CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS students (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  external_ref text UNIQUE,
  display_name text NOT NULL,
  year_group int NOT NULL CHECK (year_group BETWEEN 1 AND 7),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS curriculum_objectives (
  id text PRIMARY KEY,
  year_group int NOT NULL CHECK (year_group BETWEEN 1 AND 7),
  subject text NOT NULL,
  strand text NOT NULL,
  topic text NOT NULL,
  statement text NOT NULL,
  parent_explanation text NOT NULL DEFAULT '',
  teacher_evidence text NOT NULL DEFAULT '',
  expected_mastery int NOT NULL DEFAULT 80,
  secure_mastery int NOT NULL DEFAULT 90,
  retention_days int[] NOT NULL DEFAULT ARRAY[1,3,7,14,30],
  required_formats text[] NOT NULL DEFAULT ARRAY[]::text[],
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS objective_prerequisites (
  objective_id text NOT NULL REFERENCES curriculum_objectives(id) ON DELETE CASCADE,
  prerequisite_id text NOT NULL,
  PRIMARY KEY (objective_id, prerequisite_id)
);

CREATE TABLE IF NOT EXISTS objective_misconceptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  objective_id text NOT NULL REFERENCES curriculum_objectives(id) ON DELETE CASCADE,
  description text NOT NULL,
  repair_activity_type text NOT NULL DEFAULT 'scaffold',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS learning_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid REFERENCES students(id) ON DELETE CASCADE,
  mode text NOT NULL DEFAULT 'home',
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  device_tier text NOT NULL DEFAULT 'unknown'
);

CREATE TABLE IF NOT EXISTS question_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid REFERENCES learning_sessions(id) ON DELETE SET NULL,
  student_id uuid REFERENCES students(id) ON DELETE CASCADE,
  objective_id text REFERENCES curriculum_objectives(id) ON DELETE SET NULL,
  question_id text NOT NULL,
  format text NOT NULL DEFAULT 'unknown',
  expected_answer text NOT NULL,
  given_answer text NOT NULL,
  correct boolean NOT NULL,
  response_ms int NOT NULL DEFAULT 0,
  hint_used boolean NOT NULL DEFAULT false,
  confidence int CHECK (confidence IS NULL OR confidence BETWEEN 1 AND 5),
  mastery_delta int NOT NULL DEFAULT 0,
  explanation text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS student_objective_mastery (
  student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  objective_id text NOT NULL REFERENCES curriculum_objectives(id) ON DELETE CASCADE,
  score int NOT NULL DEFAULT 0 CHECK (score BETWEEN 0 AND 100),
  band text NOT NULL DEFAULT 'Unknown',
  last_signal text NOT NULL DEFAULT '',
  next_review_due_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (student_id, objective_id)
);

CREATE TABLE IF NOT EXISTS spaced_review_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  objective_id text NOT NULL REFERENCES curriculum_objectives(id) ON DELETE CASCADE,
  due_at timestamptz NOT NULL,
  interval_days int NOT NULL,
  priority int NOT NULL DEFAULT 50 CHECK (priority BETWEEN 0 AND 100),
  reason text NOT NULL,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS student_world_state (
  student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  world_key text NOT NULL,
  state jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (student_id, world_key)
);

CREATE TABLE IF NOT EXISTS learning_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid REFERENCES students(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  event_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_curriculum_objectives_year_subject ON curriculum_objectives(year_group, subject);
CREATE INDEX IF NOT EXISTS idx_question_attempts_student_created ON question_attempts(student_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mastery_student ON student_objective_mastery(student_id);
CREATE INDEX IF NOT EXISTS idx_spaced_review_due ON spaced_review_queue(student_id, due_at) WHERE completed_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_learning_events_student_created ON learning_events(student_id, created_at DESC);
