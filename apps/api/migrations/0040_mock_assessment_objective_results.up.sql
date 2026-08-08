ALTER TABLE mock_assessments
  ADD COLUMN IF NOT EXISTS objective_results jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE mock_assessments
  ADD CONSTRAINT mock_assessments_objective_results_array
  CHECK (jsonb_typeof(objective_results) = 'array');

WITH objective_counts AS (
  SELECT mi.assessment_id, co.id AS objective_id, co.year_group, co.strand,
         co.topic, co.statement, COUNT(mi.question_id)::int AS question_count,
         COUNT(qa.question_id)::int AS answered_count,
         COUNT(*) FILTER (WHERE qa.correct)::int AS correct_count
  FROM mock_assessment_items mi
  JOIN mock_assessments ma ON ma.id=mi.assessment_id AND ma.status='completed'
  JOIN curriculum_objectives co ON co.id=mi.objective_id
  LEFT JOIN question_attempts qa
    ON qa.mock_assessment_id=mi.assessment_id
   AND qa.question_id=mi.question_id
  GROUP BY mi.assessment_id, co.id, co.year_group, co.strand, co.topic, co.statement
), assessment_results AS (
  SELECT assessment_id, jsonb_agg(jsonb_build_object(
           'objective_id', objective_id,
           'year_group', year_group,
           'strand', strand,
           'topic', topic,
           'statement', statement,
           'question_count', question_count,
           'answered_count', answered_count,
           'correct_count', correct_count
         ) ORDER BY
           CASE
             WHEN answered_count=0 THEN 3
             WHEN correct_count * 100 / answered_count < 50 THEN 0
             WHEN correct_count * 100 / answered_count < 80 THEN 1
             ELSE 2
           END,
           year_group, strand, topic, objective_id
         ) AS objective_results
  FROM objective_counts
  GROUP BY assessment_id
)
UPDATE mock_assessments ma
SET objective_results=ar.objective_results
FROM assessment_results ar
WHERE ma.id=ar.assessment_id
  AND ma.objective_results='[]'::jsonb;
