ALTER TABLE content_versions
  DROP CONSTRAINT IF EXISTS content_versions_status_check;

ALTER TABLE content_versions
  ADD CONSTRAINT content_versions_status_check
  CHECK (status IN ('draft', 'review', 'pilot', 'approved', 'published', 'live', 'archived'));
