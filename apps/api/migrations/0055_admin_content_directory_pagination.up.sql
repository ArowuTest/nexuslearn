CREATE INDEX IF NOT EXISTS activities_admin_directory_order_idx
  ON activities (updated_at DESC, id ASC);

CREATE INDEX IF NOT EXISTS questions_admin_directory_order_idx
  ON questions (updated_at DESC, id ASC);

CREATE INDEX IF NOT EXISTS reward_rules_admin_directory_order_idx
  ON reward_rules (updated_at DESC, id ASC);

CREATE INDEX IF NOT EXISTS curriculum_objectives_admin_directory_order_idx
  ON curriculum_objectives (year_group, subject, strand, topic, id);
