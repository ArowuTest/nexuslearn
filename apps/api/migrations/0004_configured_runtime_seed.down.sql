DELETE FROM questions WHERE id IN (
  'q-y4-array-forge-7x8',
  'q-y4-array-forge-6x8',
  'q-y1-sound-sprout-cat'
);

DELETE FROM activities WHERE id IN (
  'act-y4-kinetic-array-forge',
  'act-y1-sound-sprout-blend'
);

DELETE FROM worlds WHERE key IN (
  'wonder-garden',
  'storybook-kingdom',
  'explorer-archipelago',
  'orbit-cities',
  'mastery-academy',
  'future-lab',
  'class-volcano-quest'
);

DELETE FROM feature_flags WHERE key IN (
  'configured_runtime_content',
  'admin_content_editing_ui'
);
