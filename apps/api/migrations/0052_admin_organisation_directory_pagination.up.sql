CREATE INDEX IF NOT EXISTS schools_directory_order_idx
  ON schools (name, COALESCE(urn, ''), (id::text));

CREATE INDEX IF NOT EXISTS classes_directory_order_idx
  ON classes (school_id, year_group, name, id);

CREATE INDEX IF NOT EXISTS school_users_directory_order_idx
  ON school_users (school_id, role, user_id);
