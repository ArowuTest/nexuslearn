INSERT INTO feature_flags (key, enabled, description, config) VALUES
  (
    'child_visual_portals_enabled',
    true,
    'Use animated portal cards on the child play entry while the full art asset pipeline is being produced.',
    '{"release_channel":"phase_3","requires_reduced_motion_fallback":true}'::jsonb
  ),
  (
    'child_world_ambient_motion_enabled',
    true,
    'Allow ambient child-world background motion when the learner/browser has not requested reduced motion.',
    '{"release_channel":"phase_3","respects_reduced_motion":true}'::jsonb
  ),
  (
    'child_audio_narration_enabled',
    false,
    'Enable produced narration/audio-first learning moments after narration assets pass review.',
    '{"release_channel":"pilot","fallback":"captions_and_text","requires_asset_manifest":true}'::jsonb
  ),
  (
    'advanced_interaction_renderers_enabled',
    false,
    'Enable advanced drag, table, circuit, graph and rubric renderers only after renderer-readiness gates pass.',
    '{"release_channel":"pilot","requires_renderer_readiness":true}'::jsonb
  )
ON CONFLICT (key) DO UPDATE SET
  enabled = EXCLUDED.enabled,
  description = EXCLUDED.description,
  config = feature_flags.config || EXCLUDED.config,
  updated_at = now();
