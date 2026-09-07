-- Preserve typed learner input separately from the normalized marking value.
-- JSON (not JSONB) also retains numeric token precision such as 1.2500.
-- Do not reconstruct historical input or claim a grader revision for old rows.
ALTER TABLE question_attempts
  ADD COLUMN submitted_response json,
  ADD COLUMN grader_revision text,
  ADD CONSTRAINT submitted_evidence_pair CHECK (
    (submitted_response IS NULL AND grader_revision IS NULL) OR
    (submitted_response IS NOT NULL AND grader_revision IS NOT NULL
      AND question_version IS NOT NULL
      AND octet_length(submitted_response::text) <= 65536
      AND length(grader_revision) BETWEEN 1 AND 100
      AND json_typeof(submitted_response) = 'object'
      AND COALESCE(submitted_response->>'kind' IN ('text','number','sequence','mapping'), false)
      AND submitted_response->'value' IS NOT NULL
      AND json_typeof(submitted_response->'value') <> 'null')
  );
