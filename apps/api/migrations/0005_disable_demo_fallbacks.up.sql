INSERT INTO feature_flags (key, enabled, description, config) VALUES
  ('demo_mode_fallbacks', false, 'Demo fallback data is disabled; missing runtime content must fail visibly.', '{}'::jsonb),
  ('configured_runtime_content', true, 'Use configured worlds, activities and questions for learner runtime endpoints.', '{"fallback_to_demo":false}'::jsonb)
ON CONFLICT (key) DO UPDATE SET
  enabled = EXCLUDED.enabled,
  description = EXCLUDED.description,
  config = EXCLUDED.config,
  updated_at = now();
