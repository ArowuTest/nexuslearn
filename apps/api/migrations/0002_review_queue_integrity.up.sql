WITH ranked_open_reviews AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY student_id, objective_id
      ORDER BY due_at ASC, created_at ASC
    ) AS review_rank
  FROM spaced_review_queue
  WHERE completed_at IS NULL
)
UPDATE spaced_review_queue q
SET completed_at = now()
FROM ranked_open_reviews r
WHERE q.id = r.id
  AND r.review_rank > 1;

CREATE UNIQUE INDEX IF NOT EXISTS idx_spaced_review_one_open_objective
ON spaced_review_queue(student_id, objective_id)
WHERE completed_at IS NULL;
