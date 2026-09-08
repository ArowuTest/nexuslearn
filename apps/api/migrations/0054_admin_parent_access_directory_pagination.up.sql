CREATE INDEX IF NOT EXISTS parent_student_links_admin_order_idx
  ON parent_student_links (student_id, parent_user_id, id);

CREATE INDEX IF NOT EXISTS parent_invitations_admin_order_idx
  ON parent_invitations (created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS access_requests_admin_order_idx
  ON access_requests (created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS access_requests_status_admin_order_idx
  ON access_requests (status, created_at DESC, id DESC);
