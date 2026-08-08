ALTER TABLE mock_assessments
  DROP CONSTRAINT IF EXISTS mock_assessments_objective_results_array;

ALTER TABLE mock_assessments
  DROP COLUMN IF EXISTS objective_results;
