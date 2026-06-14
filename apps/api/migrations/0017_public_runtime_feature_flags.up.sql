INSERT INTO feature_flags (key, enabled, description, config) VALUES
  ('child_play_enabled', true, 'Show the child play/world entry surface.', '{}'::jsonb),
  ('public_access_requests', true, 'Show public parent, school and tutoring access request entry points.', '{}'::jsonb),
  ('public_family_signup', true, 'Show direct family signup and child profile creation entry points.', '{}'::jsonb),
  ('public_school_workspace', true, 'Show delegated school workspace entry points.', '{}'::jsonb),
  ('show_demo_badges', true, 'Show prototype/live-demo labels where the product is still in controlled buildout.', '{}'::jsonb)
ON CONFLICT (key) DO UPDATE SET
  enabled = EXCLUDED.enabled,
  description = EXCLUDED.description,
  config = feature_flags.config || EXCLUDED.config,
  updated_at = now();

