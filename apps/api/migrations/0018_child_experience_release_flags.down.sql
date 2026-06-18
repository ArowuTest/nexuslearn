DELETE FROM feature_flags
WHERE key IN (
  'child_visual_portals_enabled',
  'child_world_ambient_motion_enabled',
  'child_audio_narration_enabled',
  'advanced_interaction_renderers_enabled'
);
