package learning

import (
	"context"
	"encoding/json"
	"errors"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
)

func (r *PostgresRepository) DiagnosticBaseline(ctx context.Context, studentID string) (DiagnosticBaseline, bool, error) {
	if strings.TrimSpace(studentID) == "" {
		return DiagnosticBaseline{}, false, nil
	}
	studentUUID, err := r.studentUUID(ctx, studentID)
	if errors.Is(err, pgx.ErrNoRows) {
		return DiagnosticBaseline{}, false, nil
	}
	if err != nil {
		return DiagnosticBaseline{}, false, err
	}

	var baseline DiagnosticBaseline
	var startedAt time.Time
	var completedAt *time.Time
	err = r.db.QueryRow(ctx, `
		SELECT id::text, year_group, status, created_by, started_at, completed_at
		FROM diagnostic_baselines
		WHERE student_id=$1
		ORDER BY (status='in_progress') DESC, created_at DESC
		LIMIT 1
	`, studentUUID).Scan(
		&baseline.ID, &baseline.YearGroup, &baseline.Status, &baseline.CreatedBy, &startedAt, &completedAt,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return DiagnosticBaseline{}, false, nil
	}
	if err != nil {
		return DiagnosticBaseline{}, false, err
	}
	baseline.StudentID = studentID
	baseline.StartedAt = startedAt.UTC().Format(time.RFC3339)
	if completedAt != nil {
		baseline.CompletedAt = completedAt.UTC().Format(time.RFC3339)
	}

	rows, err := r.db.Query(ctx, `
		SELECT objective_id, position, status, attempt_count, correct_count, response_formats, completed_at
		FROM diagnostic_baseline_items
		WHERE baseline_id=$1
		ORDER BY position
	`, baseline.ID)
	if err != nil {
		return DiagnosticBaseline{}, false, err
	}
	defer rows.Close()
	baseline.Items = []DiagnosticBaselineItem{}
	for rows.Next() {
		var item DiagnosticBaselineItem
		var itemCompletedAt *time.Time
		if err := rows.Scan(
			&item.ObjectiveID, &item.Position, &item.Status, &item.AttemptCount,
			&item.CorrectCount, &item.ResponseFormats, &itemCompletedAt,
		); err != nil {
			return DiagnosticBaseline{}, false, err
		}
		if itemCompletedAt != nil {
			item.CompletedAt = itemCompletedAt.UTC().Format(time.RFC3339)
		}
		if item.Status == "completed" {
			baseline.CompletedItems++
		} else if baseline.CurrentObjectiveID == "" {
			baseline.CurrentObjectiveID = item.ObjectiveID
		}
		baseline.Items = append(baseline.Items, item)
	}
	baseline.TotalItems = len(baseline.Items)
	return baseline, true, rows.Err()
}

func (r *PostgresRepository) CreateDiagnosticBaseline(ctx context.Context, baseline DiagnosticBaseline) (DiagnosticBaseline, error) {
	if strings.TrimSpace(baseline.StudentID) == "" {
		return baseline, invalidConfig("student_id is required")
	}
	if baseline.YearGroup < 1 || baseline.YearGroup > 7 {
		return baseline, invalidConfig("year_group must be between 1 and 7")
	}
	if len(baseline.Items) == 0 {
		return baseline, invalidConfig("at least one diagnostic objective is required")
	}
	studentUUID, err := r.studentUUID(ctx, baseline.StudentID)
	if errors.Is(err, pgx.ErrNoRows) {
		return baseline, ErrStudentNotFound
	}
	if err != nil {
		return baseline, err
	}

	tx, err := r.db.Begin(ctx)
	if err != nil {
		return baseline, err
	}
	defer tx.Rollback(ctx)
	replay, err := beginIdempotency(ctx, tx, "learning.diagnostic_baseline", studentUUID, baseline.IdempotencyKey, baseline)
	if err != nil {
		return baseline, err
	}
	if replay.Found {
		if err := json.Unmarshal(replay.Response, &baseline); err != nil {
			return baseline, err
		}
		return baseline, nil
	}
	if _, err := tx.Exec(ctx, `
		UPDATE diagnostic_baselines
		SET status='cancelled', updated_at=now()
		WHERE student_id=$1 AND status='in_progress'
	`, studentUUID); err != nil {
		return baseline, err
	}
	if strings.TrimSpace(baseline.CreatedBy) == "" {
		baseline.CreatedBy = "adaptive-engine"
	}
	var startedAt time.Time
	if err := tx.QueryRow(ctx, `
		INSERT INTO diagnostic_baselines (student_id, year_group, status, created_by)
		VALUES ($1,$2,'in_progress',$3)
		RETURNING id::text, started_at
	`, studentUUID, baseline.YearGroup, baseline.CreatedBy).Scan(&baseline.ID, &startedAt); err != nil {
		return baseline, err
	}
	objectiveIDs := make([]string, 0, len(baseline.Items))
	for _, item := range baseline.Items {
		if strings.TrimSpace(item.ObjectiveID) == "" {
			return baseline, invalidConfig("diagnostic objective_id is required")
		}
		objectiveIDs = append(objectiveIDs, item.ObjectiveID)
	}
	if _, err := tx.Exec(ctx, `
		INSERT INTO diagnostic_baseline_items (baseline_id, objective_id, position)
		SELECT $1, objective_id, position::int
		FROM unnest($2::text[]) WITH ORDINALITY AS items(objective_id, position)
	`, baseline.ID, objectiveIDs); err != nil {
		return baseline, err
	}
	baseline.Status = "in_progress"
	baseline.StartedAt = startedAt.UTC().Format(time.RFC3339)
	baseline.CurrentObjectiveID = baseline.Items[0].ObjectiveID
	baseline.CompletedItems = 0
	baseline.TotalItems = len(baseline.Items)
	for index := range baseline.Items {
		baseline.Items[index].Position = index + 1
		baseline.Items[index].Status = "planned"
		baseline.Items[index].ResponseFormats = []string{}
	}
	if err := completeIdempotency(ctx, tx, "learning.diagnostic_baseline", studentUUID, baseline.IdempotencyKey, baseline); err != nil {
		return baseline, err
	}
	if err := tx.Commit(ctx); err != nil {
		return baseline, err
	}
	return baseline, nil
}

func (r *PostgresRepository) advanceDiagnosticBaseline(ctx context.Context, exec queryExecutor, studentUUID string, objectiveID string, responseFormat string, correct bool) error {
	if responseFormat == "" {
		responseFormat = "unknown"
	}
	correctIncrement := 0
	if correct {
		correctIncrement = 1
	}
	_, err := exec.Exec(ctx, `
		WITH target AS (
			SELECT i.baseline_id, i.objective_id,
			       i.attempt_count + 1 AS next_attempt_count,
			       i.correct_count + $4 AS next_correct_count,
			       CASE
			         WHEN $3 = ANY(i.response_formats) THEN i.response_formats
			         ELSE array_append(i.response_formats, $3)
			       END AS next_formats
			FROM diagnostic_baseline_items i
			JOIN diagnostic_baselines b ON b.id=i.baseline_id
			WHERE b.student_id=$1
			  AND b.status='in_progress'
			  AND i.objective_id=$2
			  AND i.status='planned'
			LIMIT 1
			FOR UPDATE
		), updated AS (
			UPDATE diagnostic_baseline_items i
			SET attempt_count=t.next_attempt_count,
			    correct_count=t.next_correct_count,
			    response_formats=t.next_formats,
			    status=CASE
			      WHEN t.next_attempt_count >= 3
			        OR (t.next_correct_count >= 2 AND cardinality(t.next_formats) >= 2)
			      THEN 'completed'
			      ELSE 'planned'
			    END,
			    completed_at=CASE
			      WHEN t.next_attempt_count >= 3
			        OR (t.next_correct_count >= 2 AND cardinality(t.next_formats) >= 2)
			      THEN now()
			      ELSE NULL
			    END
			FROM target t
			WHERE i.baseline_id=t.baseline_id AND i.objective_id=t.objective_id
			RETURNING i.baseline_id, i.objective_id
		)
		UPDATE diagnostic_baselines b
		SET status='completed', completed_at=now(), updated_at=now()
		WHERE b.id IN (SELECT baseline_id FROM updated)
		  AND NOT EXISTS (
		    SELECT 1 FROM diagnostic_baseline_items pending
		    WHERE pending.baseline_id=b.id AND pending.status <> 'completed'
		      AND NOT EXISTS (
		        SELECT 1 FROM updated u
		        WHERE u.baseline_id=pending.baseline_id
		          AND u.objective_id=pending.objective_id
		      )
		  )
	`, studentUUID, objectiveID, responseFormat, correctIncrement)
	return err
}
