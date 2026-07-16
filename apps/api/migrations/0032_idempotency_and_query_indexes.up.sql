CREATE TABLE IF NOT EXISTS request_idempotency (
  scope text NOT NULL,
  actor_key text NOT NULL,
  request_key text NOT NULL,
  request_hash text NOT NULL,
  response_payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (scope, actor_key, request_key)
);

CREATE INDEX IF NOT EXISTS request_idempotency_created_idx
  ON request_idempotency (created_at DESC);

CREATE INDEX IF NOT EXISTS objective_misconceptions_objective_idx
  ON objective_misconceptions (objective_id);

CREATE INDEX IF NOT EXISTS teacher_evidence_school_date_idx
  ON teacher_evidence_records (school_id, recorded_at DESC);

CREATE INDEX IF NOT EXISTS intervention_plans_school_status_idx
  ON intervention_plans (school_id, status, priority DESC, review_due_at);

CREATE INDEX IF NOT EXISTS intervention_reviews_school_date_idx
  ON intervention_reviews (school_id, reviewed_at DESC);
