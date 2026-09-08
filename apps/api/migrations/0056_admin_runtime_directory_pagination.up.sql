CREATE INDEX IF NOT EXISTS worlds_admin_directory_order_idx
  ON worlds (COALESCE(year_group, 0), key);

CREATE INDEX IF NOT EXISTS feature_flags_admin_directory_order_idx
  ON feature_flags (key);
