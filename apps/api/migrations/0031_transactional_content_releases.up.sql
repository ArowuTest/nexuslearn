CREATE TABLE IF NOT EXISTS content_releases (
  id text PRIMARY KEY,
  schema_version text NOT NULL,
  channel text NOT NULL CHECK (channel IN ('review', 'pilot', 'live')),
  source_revision text NOT NULL DEFAULT '',
  manifest_sha256 text NOT NULL,
  complete_snapshot boolean NOT NULL DEFAULT true,
  expected_pack_count integer NOT NULL CHECK (expected_pack_count > 0),
  expected_objective_count integer NOT NULL CHECK (expected_objective_count >= 0),
  expected_activity_count integer NOT NULL CHECK (expected_activity_count >= 0),
  expected_question_count integer NOT NULL CHECK (expected_question_count >= 0),
  expected_reward_rule_count integer NOT NULL CHECK (expected_reward_rule_count >= 0),
  status text NOT NULL DEFAULT 'staged' CHECK (status IN ('staged', 'applied', 'superseded')),
  packs jsonb NOT NULL DEFAULT '[]'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  applied_at timestamptz,
  UNIQUE (channel, manifest_sha256)
);

CREATE TABLE IF NOT EXISTS content_release_chunks (
  release_id text NOT NULL REFERENCES content_releases(id) ON DELETE CASCADE,
  pack_id text NOT NULL,
  pack_version text NOT NULL,
  payload_sha256 text NOT NULL,
  payload jsonb NOT NULL,
  objective_count integer NOT NULL CHECK (objective_count >= 0),
  activity_count integer NOT NULL CHECK (activity_count >= 0),
  question_count integer NOT NULL CHECK (question_count >= 0),
  reward_rule_count integer NOT NULL CHECK (reward_rule_count >= 0),
  uploaded_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (release_id, pack_id),
  UNIQUE (release_id, payload_sha256)
);

INSERT INTO worlds (key, name, year_group, theme, config, enabled) VALUES
  ('wonder-garden', 'Wonder Garden', 1, 'Gentle discovery through language, number and nature', '{"realm":"Year 1 Wonder Garden"}'::jsonb, true),
  ('storybook-kingdom', 'Storybook Kingdom', 2, 'Stories, patterns and growing independence', '{"realm":"Year 2 Storybook Kingdom"}'::jsonb, true),
  ('explorer-islands', 'Explorer Islands', 3, 'Evidence, exploration and connected ideas', '{"realm":"Year 3 Explorer Islands"}'::jsonb, true),
  ('inventor-wilds', 'Inventor Wilds', 4, 'Making, reasoning and scientific discovery', '{"realm":"Year 4 Inventor Wilds"}'::jsonb, true),
  ('orbit-city', 'Orbit City', 5, 'Complex systems, evidence and ambitious problem solving', '{"realm":"Year 5 Orbit City"}'::jsonb, true),
  ('quest-academy', 'Quest Academy', 6, 'Mastery, investigation and readiness for transition', '{"realm":"Year 6 Quest Academy"}'::jsonb, true),
  ('future-worlds', 'Future Worlds', 7, 'Secondary foundations, disciplinary thinking and independence', '{"realm":"Year 7 Future Worlds"}'::jsonb, true)
ON CONFLICT (key) DO NOTHING;

ALTER TABLE curriculum_objectives
  ADD COLUMN IF NOT EXISTS content_release_id text,
  ADD COLUMN IF NOT EXISTS pack_id text;

ALTER TABLE activities
  ADD COLUMN IF NOT EXISTS content_release_id text,
  ADD COLUMN IF NOT EXISTS pack_id text;

ALTER TABLE questions
  ADD COLUMN IF NOT EXISTS content_release_id text,
  ADD COLUMN IF NOT EXISTS pack_id text;

ALTER TABLE reward_rules
  ADD COLUMN IF NOT EXISTS content_release_id text,
  ADD COLUMN IF NOT EXISTS pack_id text;

CREATE INDEX IF NOT EXISTS idx_content_releases_channel_status
  ON content_releases(channel, status, applied_at DESC);
CREATE INDEX IF NOT EXISTS idx_content_release_chunks_release
  ON content_release_chunks(release_id, pack_id);
CREATE INDEX IF NOT EXISTS idx_curriculum_objectives_release
  ON curriculum_objectives(content_release_id, pack_id);
CREATE INDEX IF NOT EXISTS idx_activities_release
  ON activities(content_release_id, pack_id, status);
CREATE INDEX IF NOT EXISTS idx_questions_release
  ON questions(content_release_id, pack_id, status);
CREATE INDEX IF NOT EXISTS idx_reward_rules_release
  ON reward_rules(content_release_id, pack_id, enabled);
