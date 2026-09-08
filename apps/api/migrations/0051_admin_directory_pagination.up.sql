CREATE INDEX IF NOT EXISTS students_directory_order_idx
  ON students (year_group, display_name, external_ref);
