-- Store each immutable question/marking contract once, not once per learner
-- attempt. Snapshots survive later changes or withdrawal of live content.
CREATE TABLE IF NOT EXISTS question_grading_versions (
  version text PRIMARY KEY CHECK (length(version) = 64),
  question_id text NOT NULL,
  snapshot jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS question_grading_versions_question_idx
  ON question_grading_versions(question_id, created_at DESC);

-- Historical rows deliberately remain unversioned; do not invent provenance.
ALTER TABLE question_attempts
  ADD COLUMN IF NOT EXISTS question_version text REFERENCES question_grading_versions(version);
