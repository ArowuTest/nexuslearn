ALTER TABLE access_requests
  DROP COLUMN IF EXISTS learning_priorities,
  DROP COLUMN IF EXISTS support_needs;
