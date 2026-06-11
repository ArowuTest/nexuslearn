package learning

import (
	"context"
	"errors"
	"log/slog"
	"strconv"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Repository interface {
	RecordAttempt(ctx context.Context, attempt Attempt, result AttemptResult) error
	ListMastery(ctx context.Context, studentID string) ([]StudentMastery, error)
	RecentAttempts(ctx context.Context, studentID string, limit int) ([]RecentAttempt, error)
}

type NoopRepository struct{}

func (NoopRepository) RecordAttempt(context.Context, Attempt, AttemptResult) error {
	return nil
}

func (NoopRepository) ListMastery(_ context.Context, studentID string) ([]StudentMastery, error) {
	return DemoMastery(studentID), nil
}

func (NoopRepository) RecentAttempts(_ context.Context, studentID string, limit int) ([]RecentAttempt, error) {
	attempts := []RecentAttempt{
		{
			StudentID:     studentID,
			ObjectiveID:   "ma-y4-number-multiplication-12x12",
			QuestionID:    "demo-7x8",
			Correct:       false,
			ResponseMS:    9400,
			HintUsed:      true,
			MasteryDelta:  -2,
			Explanation:   "Incorrect recall suggests this fact should be repaired with a visual array before returning to timed practice.",
			AttemptedAt:   "demo",
			AnimationHook: "array-scaffold",
		},
		{
			StudentID:     studentID,
			ObjectiveID:   "ma-y4-number-multiplication-12x12",
			QuestionID:    "demo-6x8",
			Correct:       true,
			ResponseMS:    4100,
			HintUsed:      false,
			MasteryDelta:  10,
			Explanation:   "Correct recall increases mastery; the fact will return through spaced review so it sticks over time.",
			AttemptedAt:   "demo",
			AnimationHook: "machine-charge",
		},
	}
	if limit > 0 && limit < len(attempts) {
		return attempts[:limit], nil
	}
	return attempts, nil
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

func (r *PostgresRepository) ListMastery(ctx context.Context, studentID string) ([]StudentMastery, error) {
	if studentID == "" {
		return []StudentMastery{}, nil
	}

	studentUUID, err := r.studentUUID(ctx, studentID)
	if errors.Is(err, pgx.ErrNoRows) {
		return []StudentMastery{}, nil
	}
	if err != nil {
		return nil, err
	}

	rows, err := r.db.Query(ctx, `
		SELECT objective_id, score, band, last_signal, next_review_due_at
		FROM student_objective_mastery
		WHERE student_id=$1
		ORDER BY updated_at DESC, objective_id
	`, studentUUID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	mastery := []StudentMastery{}
	for rows.Next() {
		var item StudentMastery
		var dueAt *time.Time
		if err := rows.Scan(&item.ObjectiveID, &item.Score, &item.Band, &item.LastSignal, &dueAt); err != nil {
			return nil, err
		}
		item.StudentID = studentID
		item.NextReviewDue = "not scheduled"
		if dueAt != nil {
			item.NextReviewDue = dueAt.UTC().Format(time.RFC3339)
		}
		mastery = append(mastery, item)
	}
	return mastery, rows.Err()
}

func (r *PostgresRepository) RecentAttempts(ctx context.Context, studentID string, limit int) ([]RecentAttempt, error) {
	if studentID == "" {
		return []RecentAttempt{}, nil
	}
	if limit <= 0 || limit > 50 {
		limit = 10
	}

	studentUUID, err := r.studentUUID(ctx, studentID)
	if errors.Is(err, pgx.ErrNoRows) {
		return []RecentAttempt{}, nil
	}
	if err != nil {
		return nil, err
	}

	rows, err := r.db.Query(ctx, `
		SELECT objective_id, question_id, correct, response_ms, hint_used, mastery_delta, explanation, created_at
		FROM question_attempts
		WHERE student_id=$1
		ORDER BY created_at DESC
		LIMIT $2
	`, studentUUID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	attempts := []RecentAttempt{}
	for rows.Next() {
		var item RecentAttempt
		var attemptedAt time.Time
		if err := rows.Scan(
			&item.ObjectiveID,
			&item.QuestionID,
			&item.Correct,
			&item.ResponseMS,
			&item.HintUsed,
			&item.MasteryDelta,
			&item.Explanation,
			&attemptedAt,
		); err != nil {
			return nil, err
		}
		item.StudentID = studentID
		item.AttemptedAt = attemptedAt.UTC().Format(time.RFC3339)
		if item.Correct {
			item.AnimationHook = "machine-charge"
		} else {
			item.AnimationHook = "array-scaffold"
		}
		attempts = append(attempts, item)
	}
	return attempts, rows.Err()
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

func (r *PostgresRepository) studentUUID(ctx context.Context, externalID string) (string, error) {
	var id string
	err := r.db.QueryRow(ctx, `SELECT id::text FROM students WHERE external_ref=$1 ORDER BY created_at LIMIT 1`, externalID).Scan(&id)
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
