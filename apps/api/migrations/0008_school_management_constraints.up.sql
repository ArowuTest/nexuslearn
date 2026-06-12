CREATE UNIQUE INDEX IF NOT EXISTS idx_schools_urn_unique ON schools(urn) WHERE urn IS NOT NULL AND urn <> '';
CREATE UNIQUE INDEX IF NOT EXISTS idx_classes_school_name_unique ON classes(school_id, name);
CREATE INDEX IF NOT EXISTS idx_class_students_student ON class_students(student_id);
CREATE INDEX IF NOT EXISTS idx_student_credentials_login_code ON student_credentials(login_code);
