UPDATE feature_flags
SET enabled = true,
    description = 'Allow local demo fallbacks.',
    config = '{}'::jsonb,
    updated_at = now()
WHERE key = 'demo_mode_fallbacks';

UPDATE feature_flags
SET config = '{"fallback_to_demo":true}'::jsonb,
    updated_at = now()
WHERE key = 'configured_runtime_content';
