INSERT INTO reward_rules (id, world_key, objective_id, trigger, reward_payload, enabled) VALUES
  (
    'reward-y4-array-forge-correct',
    'inventor-wilds',
    'ma-y4-number-multiplication-12x12',
    'attempt.correct',
    '{
      "reward_hook":"kinetic-core-charge",
      "animation_hook":"machine-charge",
      "feedback":"Brilliant recall. The forge is charging.",
      "explanation":"Correct recall increases mastery; this fact will return through spaced review so it sticks over time.",
      "evidence_event":"attempt.correct.mastery_gain",
      "companion_prompt":"Great. Can you teach Nixi why that fact works?"
    }'::jsonb,
    true
  ),
  (
    'reward-y4-array-forge-repair',
    'inventor-wilds',
    'ma-y4-number-multiplication-12x12',
    'attempt.incorrect',
    '{
      "reward_hook":"mistake-museum-progress",
      "animation_hook":"array-scaffold",
      "feedback":"Almost. Let us build the array together.",
      "explanation":"Incorrect recall suggests this fact should be repaired with a visual array before returning to timed practice.",
      "evidence_event":"attempt.incorrect.scaffold",
      "companion_prompt":"Make the groups first, then try the fact again."
    }'::jsonb,
    true
  ),
  (
    'reward-y1-sound-sprout-correct',
    'wonder-garden',
    'en-y1-phonics-blend-cvc-words',
    'attempt.correct',
    '{
      "reward_hook":"garden-bloom",
      "animation_hook":"sprout-pop",
      "feedback":"Lovely blending. The sound sprout is growing.",
      "explanation":"Correct blending strengthens the sound-to-word pathway and should return through short spaced review.",
      "evidence_event":"attempt.correct.phonics_blend",
      "companion_prompt":"Can you sweep the sounds together one more time?"
    }'::jsonb,
    true
  ),
  (
    'reward-default-correct',
    NULL,
    NULL,
    'attempt.correct',
    '{
      "reward_hook":"world-growth",
      "animation_hook":"portal-charge",
      "feedback":"Good thinking. Your world has more energy.",
      "explanation":"A correct answer adds a positive mastery signal and schedules future review.",
      "evidence_event":"attempt.correct.mastery_gain",
      "companion_prompt":"Can you explain your strategy?"
    }'::jsonb,
    true
  ),
  (
    'reward-default-repair',
    NULL,
    NULL,
    'attempt.incorrect',
    '{
      "reward_hook":"mistake-museum-progress",
      "animation_hook":"gentle-repair",
      "feedback":"Not yet. Let us repair the idea together.",
      "explanation":"An incorrect answer opens a scaffold so the misconception can be repaired safely.",
      "evidence_event":"attempt.incorrect.scaffold",
      "companion_prompt":"Try the scaffold, then we will come back stronger."
    }'::jsonb,
    true
  )
ON CONFLICT (id) DO UPDATE SET
  world_key = EXCLUDED.world_key,
  objective_id = EXCLUDED.objective_id,
  trigger = EXCLUDED.trigger,
  reward_payload = EXCLUDED.reward_payload,
  enabled = EXCLUDED.enabled,
  updated_at = now();
