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
  'inventor-wilds',
  'orbit-cities',
  'mastery-academy',
  'future-lab',
  'class-volcano-quest'
);

DELETE FROM objective_misconceptions WHERE objective_id IN (
  'ma-y4-number-multiplication-12x12',
  'ma-y4-measure-area-rectangles',
  'en-y1-phonics-blend-cvc-words'
);

DELETE FROM objective_prerequisites WHERE objective_id IN (
  'ma-y4-number-multiplication-12x12',
  'ma-y4-measure-area-rectangles',
  'en-y1-phonics-blend-cvc-words'
);

DELETE FROM curriculum_objectives WHERE id IN (
  'ma-y4-number-multiplication-12x12',
  'ma-y4-measure-area-rectangles',
  'en-y1-phonics-blend-cvc-words'
);

DELETE FROM feature_flags WHERE key IN (
  'configured_runtime_content',
  'admin_content_editing_ui'
);
