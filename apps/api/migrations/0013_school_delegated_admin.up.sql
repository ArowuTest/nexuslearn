ALTER TABLE app_users
  ADD COLUMN IF NOT EXISTS login_id text UNIQUE,
  ADD COLUMN IF NOT EXISTS password_hash text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS temporary_password_required boolean NOT NULL DEFAULT true;

ALTER TABLE school_users
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_app_users_login_id ON app_users(login_id);
CREATE INDEX IF NOT EXISTS idx_school_users_user ON school_users(user_id);
CREATE INDEX IF NOT EXISTS idx_school_users_school_role ON school_users(school_id, role);
