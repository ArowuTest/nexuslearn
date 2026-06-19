CREATE TABLE IF NOT EXISTS diagnostic_baselines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  year_group integer NOT NULL CHECK (year_group BETWEEN 1 AND 7),
  status text NOT NULL DEFAULT 'in_progress'
    CHECK (status IN ('in_progress', 'completed', 'cancelled')),
  created_by text NOT NULL DEFAULT 'adaptive-engine',
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS diagnostic_baselines_one_active_idx
  ON diagnostic_baselines (student_id)
  WHERE status = 'in_progress';

CREATE INDEX IF NOT EXISTS diagnostic_baselines_student_date_idx
  ON diagnostic_baselines (student_id, created_at DESC);

CREATE TABLE IF NOT EXISTS diagnostic_baseline_items (
  baseline_id uuid NOT NULL REFERENCES diagnostic_baselines(id) ON DELETE CASCADE,
  objective_id text NOT NULL REFERENCES curriculum_objectives(id) ON DELETE CASCADE,
  position integer NOT NULL CHECK (position > 0),
  status text NOT NULL DEFAULT 'planned'
    CHECK (status IN ('planned', 'completed')),
  attempt_count integer NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  correct_count integer NOT NULL DEFAULT 0 CHECK (correct_count >= 0),
  response_formats text[] NOT NULL DEFAULT '{}',
  completed_at timestamptz,
  PRIMARY KEY (baseline_id, objective_id),
  UNIQUE (baseline_id, position)
);

CREATE INDEX IF NOT EXISTS diagnostic_baseline_items_progress_idx
  ON diagnostic_baseline_items (baseline_id, status, position);
