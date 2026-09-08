CREATE INDEX IF NOT EXISTS learning_groups_directory_order_idx
  ON learning_groups (class_id, name, (id::text));

CREATE INDEX IF NOT EXISTS learning_group_students_directory_group_idx
  ON learning_group_students (group_id, student_id);
