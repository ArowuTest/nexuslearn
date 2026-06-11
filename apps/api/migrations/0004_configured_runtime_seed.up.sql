INSERT INTO feature_flags (key, enabled, description, config) VALUES
  ('configured_runtime_content', true, 'Use configured worlds, activities and questions for learner runtime endpoints.', '{"fallback_to_demo":true}'::jsonb),
  ('admin_content_editing_ui', true, 'Expose admin-facing content configuration surfaces in the web app.', '{}'::jsonb)
ON CONFLICT (key) DO UPDATE SET
  enabled = EXCLUDED.enabled,
  description = EXCLUDED.description,
  config = EXCLUDED.config,
  updated_at = now();

INSERT INTO worlds (key, name, year_group, theme, config, enabled) VALUES
  ('wonder-garden', 'Wonder Garden', 1, 'Counting, phonics, listening and gentle discovery', '{"realm":"Year 1 Wonder Garden","visual_style":"soft tactile garden","companion":"Nixi Sprout","focus":"Counting, phonics and listening","accent":"#8be28f"}'::jsonb, true),
  ('storybook-kingdom', 'Storybook Kingdom', 2, 'Reading fluency, sentence craft and number stories', '{"realm":"Year 2 Storybook Kingdom","visual_style":"paper theatre and magical books","companion":"Nixi Quill","focus":"Reading fluency and sentence building","accent":"#f7a6d8"}'::jsonb, true),
  ('explorer-archipelago', 'Explorer Archipelago', 3, 'Times tables, fractions, maps and discovery quests', '{"realm":"Year 3 Explorer Archipelago","visual_style":"bright islands and map puzzles","companion":"Nixi Compass","focus":"Times tables, fractions and discovery","accent":"#55cbd3"}'::jsonb, true),
  ('inventor-wilds', 'Inventor Wilds', 4, 'Animated labs, creature engineering and maths machines', '{"realm":"Year 4 Inventor Wilds","default_biome":"kinetic-lab","visual_style":"animated maker world","companion":"Nixi Spark","focus":"Maths machines, science labs and expedition writing","accent":"#ffbf45"}'::jsonb, true),
  ('orbit-cities', 'Orbit Cities', 5, 'Reasoning systems, percentages, science cities and collaborative repairs', '{"realm":"Year 5 Orbit Cities","visual_style":"clean sci-fi city","companion":"Nixi Nova","focus":"Reasoning, percentages and systems","accent":"#74a7ff"}'::jsonb, true),
  ('mastery-academy', 'Mastery Academy', 6, 'SATs confidence, strategy rooms and calm mastery rituals', '{"realm":"Year 6 Mastery Academy","visual_style":"focused academy and challenge halls","companion":"Nixi Sage","focus":"SATs confidence and mastery paths","accent":"#ff7b73"}'::jsonb, true),
  ('future-lab', 'Future Lab', 7, 'Secondary transition, simulations and independent learning missions', '{"realm":"Year 7 Future Lab","visual_style":"advanced simulation studio","companion":"Nixi Flux","focus":"Secondary transition and simulations","accent":"#9d82ff"}'::jsonb, true),
  ('class-volcano-quest', 'Class Volcano Quest', NULL, 'Co-operative whole-class progress without leaderboards', '{"realm":"Class Co-op Volcano Quest","visual_style":"shared class construction quest","companion":"Nixi Crew","focus":"Shared class goals without leaderboards","accent":"#2c8a63"}'::jsonb, true)
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  year_group = EXCLUDED.year_group,
  theme = EXCLUDED.theme,
  config = EXCLUDED.config,
  enabled = EXCLUDED.enabled,
  updated_at = now();

INSERT INTO activities (
  id, objective_id, template_id, world_key, title, prompt, difficulty,
  interaction, feedback, animation_hooks, status
) VALUES
  (
    'act-y4-kinetic-array-forge',
    'ma-y4-number-multiplication-12x12',
    'array-build',
    'inventor-wilds',
    'Kinetic Array Forge',
    'Build the fact as an array, then answer from memory.',
    5,
    '{"type":"array-build","scaffold":true,"review":true,"prerequisite_probe":false,"total_questions":8}'::jsonb,
    '{"selection_reason":"Alex is routed to a configured Year 4 activity that repairs weak multiplication facts before returning to harder area work.","companion_prompt":"Build it once, say the pattern, then teach Nixi the fact back."}'::jsonb,
    '{"primary":"kinetic-array-forge","reward":"mistake-museum-fossil","success":"machine-charge","repair":"array-scaffold"}'::jsonb,
    'published'
  ),
  (
    'act-y1-sound-sprout-blend',
    'en-y1-phonics-blend-cvc-words',
    'audio-blend',
    'wonder-garden',
    'Sound Sprout Blend',
    'Hear the sounds, tap them, then blend the word.',
    2,
    '{"type":"audio-blend","scaffold":true,"review":true,"audio_first":true,"total_questions":5}'::jsonb,
    '{"selection_reason":"This configured Year 1 activity keeps the interface audio-led and predictable.","companion_prompt":"Tap each sound with me, then sweep them into one word."}'::jsonb,
    '{"primary":"sound-spark-trail","reward":"garden-bloom","success":"sprout-pop","repair":"gentle-replay"}'::jsonb,
    'published'
  )
ON CONFLICT (id) DO UPDATE SET
  objective_id = EXCLUDED.objective_id,
  template_id = EXCLUDED.template_id,
  world_key = EXCLUDED.world_key,
  title = EXCLUDED.title,
  prompt = EXCLUDED.prompt,
  difficulty = EXCLUDED.difficulty,
  interaction = EXCLUDED.interaction,
  feedback = EXCLUDED.feedback,
  animation_hooks = EXCLUDED.animation_hooks,
  status = EXCLUDED.status,
  updated_at = now();

INSERT INTO questions (
  id, activity_id, objective_id, format, body, expected_answer, hints, explanation, difficulty, status
) VALUES
  (
    'q-y4-array-forge-7x8',
    'act-y4-kinetic-array-forge',
    'ma-y4-number-multiplication-12x12',
    'multiple_choice',
    '{"prompt":"What is 7 x 8?","a":7,"b":8,"choices":[48,54,56,64],"animation_hook":"kinetic-array-forge"}'::jsonb,
    '{"value":56}'::jsonb,
    '["Think of 7 groups of 8.","Double 7 x 4.","Use the array rows before answering."]'::jsonb,
    '7 groups of 8 make 56.',
    5,
    'published'
  ),
  (
    'q-y4-array-forge-6x8',
    'act-y4-kinetic-array-forge',
    'ma-y4-number-multiplication-12x12',
    'multiple_choice',
    '{"prompt":"What is 6 x 8?","a":6,"b":8,"choices":[42,46,48,56],"animation_hook":"machine-charge"}'::jsonb,
    '{"value":48}'::jsonb,
    '["Use 3 x 8, then double it.","Six rows of eight make the fact visible."]'::jsonb,
    '6 groups of 8 make 48.',
    4,
    'published'
  ),
  (
    'q-y1-sound-sprout-cat',
    'act-y1-sound-sprout-blend',
    'en-y1-phonics-blend-cvc-words',
    'audio_blend',
    '{"prompt":"Blend c-a-t.","sounds":["c","a","t"],"choices":["cat","cap","cot"],"animation_hook":"sound-spark-trail"}'::jsonb,
    '{"value":"cat"}'::jsonb,
    '["Say each sound slowly.","Now sweep the sounds together."]'::jsonb,
    'The sounds c-a-t blend into cat.',
    1,
    'published'
  )
ON CONFLICT (id) DO UPDATE SET
  activity_id = EXCLUDED.activity_id,
  objective_id = EXCLUDED.objective_id,
  format = EXCLUDED.format,
  body = EXCLUDED.body,
  expected_answer = EXCLUDED.expected_answer,
  hints = EXCLUDED.hints,
  explanation = EXCLUDED.explanation,
  difficulty = EXCLUDED.difficulty,
  status = EXCLUDED.status,
  updated_at = now();
