CREATE TABLE IF NOT EXISTS consent_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_user_id uuid NOT NULL,
  student_external_ref text NOT NULL,
  purpose text NOT NULL CHECK (purpose IN ('family_learning', 'school_pilot')),
  policy_version text NOT NULL,
  region text NOT NULL DEFAULT 'england',
  method text NOT NULL DEFAULT 'recorded',
  granted_at timestamptz NOT NULL DEFAULT now(),
  withdrawn_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_consent_records_child_purpose
  ON consent_records (student_external_ref, purpose, granted_at DESC);

CREATE TABLE IF NOT EXISTS human_content_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pack_id text NOT NULL,
  decision text NOT NULL CHECK (decision IN ('approved', 'hold')),
  reviewer text NOT NULL,
  notes text NOT NULL,
  narration_ids text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_human_content_approvals_pack
  ON human_content_approvals (pack_id, created_at DESC);

CREATE TABLE IF NOT EXISTS privacy_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action text NOT NULL CHECK (action IN ('export', 'delete', 'purge')),
  actor text NOT NULL,
  subject_ref text NOT NULL,
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_privacy_actions_subject
  ON privacy_actions (subject_ref, created_at DESC);
