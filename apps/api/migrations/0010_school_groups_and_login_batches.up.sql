CREATE TABLE IF NOT EXISTS learning_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid REFERENCES classes(id) ON DELETE CASCADE,
  name text NOT NULL,
  purpose text NOT NULL DEFAULT 'intervention',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (class_id, name)
);

CREATE TABLE IF NOT EXISTS learning_group_students (
  group_id uuid NOT NULL REFERENCES learning_groups(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  PRIMARY KEY (group_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_learning_groups_class ON learning_groups(class_id);
CREATE INDEX IF NOT EXISTS idx_learning_group_students_student ON learning_group_students(student_id);
