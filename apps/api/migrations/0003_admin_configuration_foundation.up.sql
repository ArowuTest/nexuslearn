CREATE TABLE IF NOT EXISTS app_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE,
  display_name text NOT NULL,
  user_type text NOT NULL CHECK (user_type IN ('platform_admin', 'school_admin', 'teacher', 'parent', 'pupil')),
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS roles (
  id text PRIMARY KEY,
  description text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_roles (
  user_id uuid NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  role_id text NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, role_id)
);

CREATE TABLE IF NOT EXISTS schools (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  urn text,
  status text NOT NULL DEFAULT 'trial',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS school_users (
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'teacher',
  PRIMARY KEY (school_id, user_id)
);

CREATE TABLE IF NOT EXISTS classes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid REFERENCES schools(id) ON DELETE CASCADE,
  name text NOT NULL,
  year_group int CHECK (year_group BETWEEN 1 AND 7),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS class_students (
  class_id uuid NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  PRIMARY KEY (class_id, student_id)
);

CREATE TABLE IF NOT EXISTS student_credentials (
  student_id uuid PRIMARY KEY REFERENCES students(id) ON DELETE CASCADE,
  login_code text UNIQUE,
  picture_password jsonb NOT NULL DEFAULT '[]'::jsonb,
  qr_secret_hash text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS feature_flags (
  key text PRIMARY KEY,
  enabled boolean NOT NULL DEFAULT false,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  description text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS content_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content_key text NOT NULL,
  content_type text NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'review', 'approved', 'published', 'archived')),
  version int NOT NULL DEFAULT 1,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES app_users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz,
  UNIQUE (content_key, version)
);

CREATE TABLE IF NOT EXISTS activity_templates (
  id text PRIMARY KEY,
  name text NOT NULL,
  interaction_type text NOT NULL,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  enabled boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS activities (
  id text PRIMARY KEY,
  objective_id text REFERENCES curriculum_objectives(id) ON DELETE SET NULL,
  template_id text REFERENCES activity_templates(id) ON DELETE SET NULL,
  world_key text NOT NULL DEFAULT '',
  title text NOT NULL,
  prompt text NOT NULL DEFAULT '',
  difficulty int NOT NULL DEFAULT 1 CHECK (difficulty BETWEEN 1 AND 10),
  interaction jsonb NOT NULL DEFAULT '{}'::jsonb,
  feedback jsonb NOT NULL DEFAULT '{}'::jsonb,
  animation_hooks jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'draft',
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS questions (
  id text PRIMARY KEY,
  activity_id text REFERENCES activities(id) ON DELETE CASCADE,
  objective_id text REFERENCES curriculum_objectives(id) ON DELETE SET NULL,
  format text NOT NULL,
  body jsonb NOT NULL DEFAULT '{}'::jsonb,
  expected_answer jsonb NOT NULL DEFAULT '{}'::jsonb,
  hints jsonb NOT NULL DEFAULT '[]'::jsonb,
  explanation text NOT NULL DEFAULT '',
  difficulty int NOT NULL DEFAULT 1 CHECK (difficulty BETWEEN 1 AND 10),
  status text NOT NULL DEFAULT 'draft',
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS worlds (
  key text PRIMARY KEY,
  name text NOT NULL,
  year_group int CHECK (year_group BETWEEN 1 AND 7),
  theme text NOT NULL DEFAULT '',
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  enabled boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS reward_rules (
  id text PRIMARY KEY,
  world_key text REFERENCES worlds(key) ON DELETE CASCADE,
  objective_id text REFERENCES curriculum_objectives(id) ON DELETE SET NULL,
  trigger text NOT NULL,
  reward_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  enabled boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid REFERENCES app_users(id) ON DELETE SET NULL,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO roles (id, description) VALUES
  ('platform_admin', 'Can configure platform-wide curriculum, content, features and diagnostics.'),
  ('content_editor', 'Can draft and update curriculum/content packs.'),
  ('content_reviewer', 'Can review and approve content.'),
  ('school_admin', 'Can configure a school, classes and pupil access.'),
  ('teacher', 'Can assign work and view class evidence.')
ON CONFLICT (id) DO NOTHING;

INSERT INTO feature_flags (key, enabled, description, config) VALUES
  ('phase_3_5_admin_config', true, 'Enable Phase 3.5 admin/configuration foundation endpoints.', '{}'::jsonb),
  ('demo_mode_fallbacks', true, 'Allow demo fallback data when configured content is missing.', '{}'::jsonb),
  ('low_sensory_default', false, 'Default new learners into low-sensory mode.', '{"animation_tier":"standard"}'::jsonb)
ON CONFLICT (key) DO NOTHING;

INSERT INTO worlds (key, name, year_group, theme, config) VALUES
  ('inventor-wilds', 'Inventor Wilds', 4, 'Dino Lab, workshops and engineering biomes', '{"default_biome":"dino-lab"}'::jsonb),
  ('storybook-glade', 'Storybook Glade', 1, 'Audio-led phonics and story world', '{"audio_first":true}'::jsonb)
ON CONFLICT (key) DO NOTHING;

INSERT INTO activity_templates (id, name, interaction_type, config) VALUES
  ('timed-recall', 'Timed Recall', 'number-pad', '{"supports_fluency":true}'::jsonb),
  ('array-build', 'Array Builder', 'drag-build', '{"supports_scaffold":true}'::jsonb),
  ('audio-blend', 'Audio Blend', 'tap-choice', '{"audio_first":true}'::jsonb)
ON CONFLICT (id) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_app_users_type ON app_users(user_type);
CREATE INDEX IF NOT EXISTS idx_content_versions_key_status ON content_versions(content_key, status);
CREATE INDEX IF NOT EXISTS idx_activities_objective ON activities(objective_id);
CREATE INDEX IF NOT EXISTS idx_questions_objective ON questions(objective_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id, created_at DESC);
