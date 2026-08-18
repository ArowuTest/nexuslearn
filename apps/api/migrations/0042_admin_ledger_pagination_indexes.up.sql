CREATE INDEX IF NOT EXISTS audit_logs_created_id_idx
  ON audit_logs (created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS content_versions_created_id_idx
  ON content_versions (created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS content_releases_created_id_idx
  ON content_releases (created_at DESC, id DESC);
