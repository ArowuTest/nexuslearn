UPDATE content_versions SET status='approved' WHERE status='live';
UPDATE content_versions SET status='review' WHERE status='pilot';

ALTER TABLE content_versions
  DROP CONSTRAINT IF EXISTS content_versions_status_check;

ALTER TABLE content_versions
  ADD CONSTRAINT content_versions_status_check
  CHECK (status IN ('draft', 'review', 'approved', 'published', 'archived'));
