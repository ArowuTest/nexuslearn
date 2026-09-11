-- Immutable school/class and class/group positions for bounded directory reads.
CREATE INDEX IF NOT EXISTS classes_school_directory_keyset_idx
  ON classes (school_id, id);

CREATE INDEX IF NOT EXISTS learning_groups_school_directory_keyset_idx
  ON learning_groups (class_id, id);
