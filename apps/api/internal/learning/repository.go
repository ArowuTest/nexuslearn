package learning

import (
	"context"
	"log/slog"
	"strconv"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

type Repository interface {
	RecordAttempt(ctx context.Context, attempt Attempt, result AttemptResult) error
}

type NoopRepository struct{}

func (NoopRepository) RecordAttempt(context.Context, Attempt, AttemptResult) error {
	return nil
}

type PostgresRepository struct {
	db *pgxpool.Pool
}

func NewRepository(db *pgxpool.Pool) Repository {
	if db == nil {
		return NoopRepository{}
	}
	return &PostgresRepository{db: db}
}

func (r *PostgresRepository) RecordAttempt(ctx context.Context, attempt Attempt, result AttemptResult) error {
	if attempt.StudentID == "" || attempt.ObjectiveID == "" {
		return nil
	}

	studentUUID, err := r.ensureDemoStudent(ctx, attempt.StudentID)
	if err != nil {
		return err
	}
	if err := r.ensureObjective(ctx, attempt.ObjectiveID); err != nil {
		return err
	}

	_, err = r.db.Exec(ctx, `
		INSERT INTO question_attempts (
			student_id, objective_id, question_id, format, expected_answer, given_answer,
			correct, response_ms, hint_used, confidence, mastery_delta, explanation
		)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NULLIF($10,0),$11,$12)
	`, studentUUID, attempt.ObjectiveID, attempt.QuestionID, "timed-recall",
		strconv.Itoa(attempt.Expected), strconv.Itoa(attempt.Given),
		result.Correct, attempt.MS, attempt.HintUsed, attempt.Confidence,
		result.MasteryDelta, result.Explanation)
	if err != nil {
		return err
	}

	var dueAt *time.Time
	if result.NextReviewDays > 0 {
		next := time.Now().UTC().Add(time.Duration(result.NextReviewDays) * 24 * time.Hour)
		dueAt = &next
	}

	_, err = r.db.Exec(ctx, `
		INSERT INTO student_objective_mastery (
			student_id, objective_id, score, band, last_signal, next_review_due_at, updated_at
		)
		VALUES ($1,$2,$3,$4,$5,$6,now())
		ON CONFLICT (student_id, objective_id) DO UPDATE SET
			score = EXCLUDED.score,
			band = EXCLUDED.band,
			last_signal = EXCLUDED.last_signal,
			next_review_due_at = EXCLUDED.next_review_due_at,
			updated_at = now()
	`, studentUUID, attempt.ObjectiveID, result.ProjectedScore, result.ProjectedBand, result.Explanation, dueAt)
	if err != nil {
		return err
	}

	if dueAt != nil {
		_, err = r.db.Exec(ctx, `
			INSERT INTO spaced_review_queue (student_id, objective_id, due_at, interval_days, priority, reason)
			VALUES ($1,$2,$3,$4,$5,$6)
		`, studentUUID, attempt.ObjectiveID, *dueAt, result.NextReviewDays, 70, result.Explanation)
	}
	return err
}

func (r *PostgresRepository) ensureDemoStudent(ctx context.Context, externalID string) (string, error) {
	var id string
	err := r.db.QueryRow(ctx, `
		INSERT INTO students (external_ref, display_name, year_group)
		VALUES ($1, $1, 4)
		ON CONFLICT (external_ref) DO NOTHING
		RETURNING id::text
	`, externalID).Scan(&id)
	if err == nil {
		return id, nil
	}

	err = r.db.QueryRow(ctx, `SELECT id::text FROM students WHERE external_ref=$1 ORDER BY created_at LIMIT 1`, externalID).Scan(&id)
	return id, err
}

func (r *PostgresRepository) ensureObjective(ctx context.Context, objectiveID string) error {
	objective, ok := ObjectiveByID(objectiveID)
	if !ok {
		slog.Warn("attempt referenced unknown objective", "objective_id", objectiveID)
		return nil
	}
	_, err := r.db.Exec(ctx, `
		INSERT INTO curriculum_objectives (
			id, year_group, subject, strand, topic, statement, parent_explanation,
			teacher_evidence, expected_mastery, secure_mastery, retention_days, required_formats
		)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
		ON CONFLICT (id) DO NOTHING
	`, objective.ID, objective.Year, objective.Subject, objective.Strand, objective.Topic,
		objective.Statement, objective.ParentExplanation, objective.TeacherEvidence,
		objective.Mastery.Expected, objective.Mastery.Secure, objective.Mastery.RetentionDays,
		objective.Mastery.RequiredFormats)
	return err
}
