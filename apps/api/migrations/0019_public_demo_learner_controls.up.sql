INSERT INTO feature_flags (key, enabled, description, config) VALUES
  (
    'public_demo_learner_enabled',
    false,
    'Allow anonymous visitors to launch the configured demo learner without a school, parent or pupil-login session.',
    '{"release_channel":"controlled_demo","reason":"Real child learning should normally start from issued pupil credentials or a parent/school profile."}'::jsonb
  )
ON CONFLICT (key) DO UPDATE SET
  description = EXCLUDED.description,
  config = feature_flags.config || EXCLUDED.config,
  updated_at = now();
