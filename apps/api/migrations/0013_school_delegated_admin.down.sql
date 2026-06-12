DROP INDEX IF EXISTS idx_school_users_school_role;
DROP INDEX IF EXISTS idx_school_users_user;
DROP INDEX IF EXISTS idx_app_users_login_id;

ALTER TABLE school_users
  DROP COLUMN IF EXISTS updated_at,
  DROP COLUMN IF EXISTS created_at;

ALTER TABLE app_users
  DROP COLUMN IF EXISTS temporary_password_required,
  DROP COLUMN IF EXISTS password_hash,
  DROP COLUMN IF EXISTS login_id;
