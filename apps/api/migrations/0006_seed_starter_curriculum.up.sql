INSERT INTO curriculum_objectives (
  id, year_group, subject, strand, topic, statement, parent_explanation,
  teacher_evidence, expected_mastery, secure_mastery, retention_days, required_formats
) VALUES
  (
    'ma-y4-number-multiplication-12x12',
    4,
    'Mathematics',
    'Number',
    'Multiplication and division',
    'Recall multiplication and division facts for multiplication tables up to 12 x 12.',
    'Can recall mixed multiplication and division facts with increasing fluency.',
    'Accuracy, speed, mixed recall, retention and reduced hint use.',
    80,
    90,
    ARRAY[1,3,7,14,30],
    ARRAY['timed-recall','array-build','division-match']
  ),
  (
    'ma-y4-measure-area-rectangles',
    4,
    'Mathematics',
    'Measurement',
    'Area',
    'Find the area of rectilinear shapes by counting squares.',
    'Can find the space inside a rectangle or rectilinear shape by counting or using rows and columns.',
    'Can model area with squares, explain rows and columns, and avoid perimeter confusion.',
    80,
    90,
    ARRAY[1,3,7,14],
    ARRAY['grid-count','array-build','word-problem']
  ),
  (
    'en-y1-phonics-blend-cvc-words',
    1,
    'English',
    'Phonics',
    'Blending',
    'Blend sounds in simple CVC words to read the whole word.',
    'Can hear sounds in a simple word and blend them together to read the word.',
    'Can blend CVC words across different vowel sounds with reduced adult prompting.',
    80,
    90,
    ARRAY[1,3,7,14],
    ARRAY['audio-blend','tap-choice','word-build']
  )
ON CONFLICT (id) DO UPDATE SET
  year_group = EXCLUDED.year_group,
  subject = EXCLUDED.subject,
  strand = EXCLUDED.strand,
  topic = EXCLUDED.topic,
  statement = EXCLUDED.statement,
  parent_explanation = EXCLUDED.parent_explanation,
  teacher_evidence = EXCLUDED.teacher_evidence,
  expected_mastery = EXCLUDED.expected_mastery,
  secure_mastery = EXCLUDED.secure_mastery,
  retention_days = EXCLUDED.retention_days,
  required_formats = EXCLUDED.required_formats,
  updated_at = now();

INSERT INTO objective_prerequisites (objective_id, prerequisite_id) VALUES
  ('ma-y4-number-multiplication-12x12', 'ma-y2-number-count-in-2-5-10'),
  ('ma-y4-number-multiplication-12x12', 'ma-y3-number-recall-3-4-8-tables'),
  ('ma-y4-number-multiplication-12x12', 'ma-y3-number-arrays-repeated-addition'),
  ('ma-y4-measure-area-rectangles', 'ma-y2-geometry-recognise-rectangles'),
  ('ma-y4-measure-area-rectangles', 'ma-y3-number-arrays-repeated-addition'),
  ('ma-y4-measure-area-rectangles', 'ma-y4-number-multiplication-12x12'),
  ('en-y1-phonics-blend-cvc-words', 'en-y1-phonics-recognise-single-letter-sounds'),
  ('en-y1-phonics-blend-cvc-words', 'en-y1-listening-hear-initial-sounds')
ON CONFLICT DO NOTHING;

DELETE FROM objective_misconceptions WHERE objective_id IN (
  'ma-y4-number-multiplication-12x12',
  'ma-y4-measure-area-rectangles',
  'en-y1-phonics-blend-cvc-words'
);

INSERT INTO objective_misconceptions (objective_id, description) VALUES
  ('ma-y4-number-multiplication-12x12', 'Confuses nearby multiplication facts such as 6 x 8 and 7 x 8.'),
  ('ma-y4-number-multiplication-12x12', 'Counts every fact from the beginning instead of using known facts.'),
  ('ma-y4-number-multiplication-12x12', 'Does not connect division facts to multiplication facts.'),
  ('ma-y4-measure-area-rectangles', 'Confuses area with perimeter.'),
  ('ma-y4-measure-area-rectangles', 'Counts only the outside squares.'),
  ('ma-y4-measure-area-rectangles', 'Counts rows and columns but does not connect them to multiplication.'),
  ('en-y1-phonics-blend-cvc-words', 'Says each sound separately but does not blend into a whole word.'),
  ('en-y1-phonics-blend-cvc-words', 'Guesses from the picture without checking sounds.'),
  ('en-y1-phonics-blend-cvc-words', 'Reverses or skips the middle vowel sound.');
