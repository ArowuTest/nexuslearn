CREATE INDEX IF NOT EXISTS mock_assessments_student_created_id_idx
  ON mock_assessments (student_id, created_at DESC, id DESC);
