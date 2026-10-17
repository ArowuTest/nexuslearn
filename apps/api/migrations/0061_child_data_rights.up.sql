ALTER TABLE students
  ADD COLUMN IF NOT EXISTS consent_required boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS parental_consents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_user_id uuid REFERENCES app_users(id) ON DELETE SET NULL,
  student_external_ref text NOT NULL,
  purpose text NOT NULL CHECK (purpose IN ('core_learning', 'school_reporting', 'research')),
  policy_version text NOT NULL,
  granted boolean NOT NULL,
  region text NOT NULL DEFAULT 'england',
  statement text NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS parental_consents_student_purpose_idx
  ON parental_consents (student_external_ref, purpose, recorded_at DESC, id DESC);

CREATE TABLE IF NOT EXISTS family_privacy_settings (
  parent_user_id uuid PRIMARY KEY REFERENCES app_users(id) ON DELETE CASCADE,
  analytics_enabled boolean NOT NULL DEFAULT false,
  marketing_enabled boolean NOT NULL DEFAULT false,
  research_enabled boolean NOT NULL DEFAULT false,
  share_with_school boolean NOT NULL DEFAULT false,
  curriculum_region text NOT NULL DEFAULT 'england',
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS data_deletion_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_user_id uuid REFERENCES app_users(id) ON DELETE SET NULL,
  student_ref_hash text NOT NULL,
  status text NOT NULL,
  summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  completed_at timestamptz NOT NULL DEFAULT now()
);
