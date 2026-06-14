DELETE FROM feature_flags
WHERE key IN (
  'child_play_enabled',
  'public_access_requests',
  'public_family_signup',
  'public_school_workspace',
  'show_demo_badges'
);

