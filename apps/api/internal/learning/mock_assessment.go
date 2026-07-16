package learning

import (
	"context"
	"encoding/json"
	"errors"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
)

func (r *PostgresRepository) prepareMockAssessmentAttempt(ctx context.Context, exec queryExecutor, attempt Attempt, studentUUID string) error {
	var status string
	if err := exec.QueryRow(ctx, `
		SELECT status
		FROM mock_assessments
		WHERE id=$1::uuid AND student_id=$2::uuid
		FOR UPDATE
	`, attempt.MockAssessmentID, studentUUID).Scan(&status); errors.Is(err, pgx.ErrNoRows) {
		return ErrMockAssessmentNotFound
	} else if err != nil {
		return err
	}
	if status == "completed" || status == "cancelled" {
		return ErrMockAssessmentClosed
	}
	var selected bool
	if err := exec.QueryRow(ctx, `
		SELECT EXISTS (
			SELECT 1
			FROM mock_assessment_items
			WHERE assessment_id=$1::uuid
			  AND question_id=$2
			  AND objective_id=$3
		)
	`, attempt.MockAssessmentID, attempt.QuestionID, attempt.ObjectiveID).Scan(&selected); err != nil {
		return err
	}
	if !selected {
		return ErrMockQuestionNotInAssessment
	}
	var answered bool
	if err := exec.QueryRow(ctx, `
		SELECT EXISTS (
			SELECT 1 FROM question_attempts
			WHERE mock_assessment_id=$1::uuid AND question_id=$2
		)
	`, attempt.MockAssessmentID, attempt.QuestionID).Scan(&answered); err != nil {
		return err
	}
	if answered {
		return ErrMockQuestionAlreadyAnswered
	}
	return nil
}

func (r *PostgresRepository) updateMockAssessmentProgress(ctx context.Context, exec queryExecutor, assessmentID string) (*MockAssessmentSummary, error) {
	var summary MockAssessmentSummary
	var completedAt *time.Time
	err := exec.QueryRow(ctx, `
		WITH stats AS (
			SELECT ma.id, ma.question_count,
			       COUNT(qa.question_id)::int AS answered_count,
			       COUNT(*) FILTER (WHERE qa.correct)::int AS correct_count
			FROM mock_assessments ma
			JOIN mock_assessment_items mi ON mi.assessment_id=ma.id
			LEFT JOIN question_attempts qa
			  ON qa.mock_assessment_id=mi.assessment_id
			 AND qa.question_id=mi.question_id
			WHERE ma.id=$1::uuid
			GROUP BY ma.id, ma.question_count
		)
		UPDATE mock_assessments ma
		SET status = CASE
				WHEN stats.answered_count >= stats.question_count THEN 'completed'
				WHEN ma.status = 'ready' THEN 'in_progress'
				ELSE ma.status
			END,
			completed_at = CASE
				WHEN stats.answered_count >= stats.question_count THEN COALESCE(ma.completed_at, now())
				ELSE ma.completed_at
			END,
			updated_at = now()
		FROM stats
		WHERE ma.id=stats.id
		RETURNING ma.id::text, ma.subject, ma.year_group, ma.title, ma.status,
		          ma.question_count, stats.answered_count, stats.correct_count,
		          ma.completed_at
	`, assessmentID).Scan(
		&summary.ID, &summary.Subject, &summary.YearGroup, &summary.Title, &summary.Status,
		&summary.QuestionCount, &summary.AnsweredCount, &summary.CorrectCount, &completedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrMockAssessmentNotFound
		}
		return nil, err
	}
	if summary.AnsweredCount > 0 {
		summary.Score = summary.CorrectCount * 100 / summary.AnsweredCount
	}
	if completedAt != nil {
		summary.CompletedAt = completedAt.UTC().Format(time.RFC3339)
	}
	return &summary, nil
}

// MockAssessmentStore is intentionally optional on Repository. This keeps the
// in-memory/demo repository useful while requiring production persistence for
// generated assessments.
type MockAssessmentStore interface {
	CreateMockAssessment(context.Context, MockAssessment) (MockAssessment, error)
	ListMockAssessments(context.Context, string, string, int) ([]MockAssessment, error)
	GetMockAssessment(context.Context, string, string, string) (MockAssessment, bool, error)
	ListMockAssessmentQuestions(context.Context, string, string) ([]QuestionConfig, error)
}

func (r *PostgresRepository) CreateMockAssessment(ctx context.Context, assessment MockAssessment) (MockAssessment, error) {
	if strings.TrimSpace(assessment.StudentExternalRef) == "" {
		return assessment, invalidConfig("student is required")
	}
	if strings.TrimSpace(assessment.Subject) == "" {
		return assessment, invalidConfig("subject is required")
	}
	if assessment.YearGroup < 1 || assessment.YearGroup > 7 || assessment.YearFrom < 1 || assessment.YearFrom > 7 || assessment.YearTo < assessment.YearFrom || assessment.YearTo > 7 {
		return assessment, invalidConfig("assessment year range must be between Year 1 and Year 7")
	}
	if len(assessment.Items) == 0 || len(assessment.Items) > 40 {
		return assessment, invalidConfig("assessment must contain between 1 and 40 questions")
	}
	assessment.QuestionCount = len(assessment.Items)
	if assessment.Title == "" {
		assessment.Title = strings.Title(strings.ToLower(assessment.Subject)) + " practice check"
	}
	if assessment.Status == "" {
		assessment.Status = "ready"
	}
	if assessment.Accessibility == nil {
		assessment.Accessibility = map[string]any{}
	}
	seen := map[string]struct{}{}
	for index := range assessment.Items {
		item := &assessment.Items[index]
		// Positions are server-owned so callers cannot create collisions or
		// gaps in the ordered assessment payload.
		item.Position = index + 1
		if item.QuestionID == "" || item.ObjectiveID == "" {
			return assessment, invalidConfig("assessment items require question and objective ids")
		}
		if _, exists := seen[item.QuestionID]; exists {
			return assessment, invalidConfig("assessment cannot contain duplicate questions")
		}
		seen[item.QuestionID] = struct{}{}
	}

	tx, err := r.db.Begin(ctx)
	if err != nil {
		return assessment, err
	}
	defer tx.Rollback(ctx)
	actorKey := assessment.CreatedByRole + ":" + assessment.CreatedBy + ":" + assessment.StudentExternalRef
	replay, err := beginIdempotency(ctx, tx, "learning.mock_assessment", actorKey, assessment.IdempotencyKey, assessment)
	if err != nil {
		return assessment, err
	}
	if replay.Found {
		if err := json.Unmarshal(replay.Response, &assessment); err != nil {
			return assessment, err
		}
		return assessment, nil
	}

	var createdAt, updatedAt time.Time
	err = tx.QueryRow(ctx, `
		INSERT INTO mock_assessments (
			student_id, school_id, created_by_role, created_by, subject, year_group,
			year_from, year_to, title, status, question_count, duration_minutes,
			include_revision, include_stretch, accessibility
		)
		SELECT st.id, sch.id, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15::jsonb
		FROM students st
		LEFT JOIN schools sch ON sch.urn = NULLIF($2, '')
		WHERE st.external_ref = $1
		  AND ($2 = '' OR sch.id IS NOT NULL)
		RETURNING id::text, created_at, updated_at
	`, assessment.StudentExternalRef, assessment.SchoolURN, assessment.CreatedByRole,
		assessment.CreatedBy, assessment.Subject, assessment.YearGroup, assessment.YearFrom,
		assessment.YearTo, assessment.Title, assessment.Status, assessment.QuestionCount,
		assessment.DurationMinutes, assessment.IncludeRevision, assessment.IncludeStretch,
		assessment.Accessibility).Scan(&assessment.ID, &createdAt, &updatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return assessment, ErrStudentNotFound
	}
	if err != nil {
		return assessment, err
	}
	for _, item := range assessment.Items {
		result, execErr := tx.Exec(ctx, `
			INSERT INTO mock_assessment_items (assessment_id, position, question_id, objective_id, activity_id, selection_reason)
			SELECT $1::uuid, $2, q.id, q.objective_id, NULLIF($5, ''), $6
			FROM questions q
			WHERE q.id=$3
			  AND q.objective_id=$4
			  AND q.status IN ('approved','published','live')
		`, assessment.ID, item.Position, item.QuestionID, item.ObjectiveID, item.ActivityID, item.SelectionReason)
		if execErr != nil {
			return assessment, execErr
		}
		// A missing row means a stale or non-runtime question slipped into the
		// request. Fail the whole transaction instead of storing a partial mock.
		if result.RowsAffected() != 1 {
			return assessment, invalidConfig("assessment contains a question that is not runtime-approved or does not match its objective")
		}
	}
	assessment.CreatedAt = createdAt.UTC().Format(time.RFC3339)
	assessment.UpdatedAt = updatedAt.UTC().Format(time.RFC3339)
	if err := completeIdempotency(ctx, tx, "learning.mock_assessment", actorKey, assessment.IdempotencyKey, assessment); err != nil {
		return assessment, err
	}
	if err := tx.Commit(ctx); err != nil {
		return assessment, err
	}
	return assessment, nil
}

func (r *PostgresRepository) ListMockAssessments(ctx context.Context, studentExternalRef string, schoolURN string, limit int) ([]MockAssessment, error) {
	if limit <= 0 || limit > 100 {
		limit = 50
	}
	rows, err := r.db.Query(ctx, `
		SELECT ma.id::text, st.external_ref, st.display_name, COALESCE(sch.urn,''),
		       ma.created_by_role, ma.created_by, ma.subject, ma.year_group, ma.year_from,
		       ma.year_to, ma.title, ma.status, ma.question_count, ma.duration_minutes,
		       ma.include_revision, ma.include_stretch, ma.accessibility,
		       COALESCE(stats.answered_count, 0), COALESCE(stats.correct_count, 0),
		       ma.created_at, ma.updated_at, ma.completed_at
		FROM mock_assessments ma
		JOIN students st ON st.id=ma.student_id
		LEFT JOIN schools sch ON sch.id=ma.school_id
		LEFT JOIN LATERAL (
			SELECT COUNT(qa.question_id)::int AS answered_count,
			       COUNT(*) FILTER (WHERE qa.correct)::int AS correct_count
			FROM mock_assessment_items mi
			LEFT JOIN question_attempts qa
			  ON qa.mock_assessment_id=mi.assessment_id
			 AND qa.question_id=mi.question_id
			WHERE mi.assessment_id=ma.id
		) stats ON TRUE
		WHERE st.external_ref=$1
		  AND ($2='' OR sch.urn=$2)
		ORDER BY ma.created_at DESC, ma.id
		LIMIT $3
	`, studentExternalRef, schoolURN, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []MockAssessment{}
	for rows.Next() {
		assessment, err := scanMockAssessment(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, assessment)
	}
	return out, rows.Err()
}

func (r *PostgresRepository) GetMockAssessment(ctx context.Context, id string, studentExternalRef string, schoolURN string) (MockAssessment, bool, error) {
	var assessment MockAssessment
	row := r.db.QueryRow(ctx, `
		SELECT ma.id::text, st.external_ref, st.display_name, COALESCE(sch.urn,''),
		       ma.created_by_role, ma.created_by, ma.subject, ma.year_group, ma.year_from,
		       ma.year_to, ma.title, ma.status, ma.question_count, ma.duration_minutes,
		       ma.include_revision, ma.include_stretch, ma.accessibility,
		       COALESCE(stats.answered_count, 0), COALESCE(stats.correct_count, 0),
		       ma.created_at, ma.updated_at, ma.completed_at
		FROM mock_assessments ma
		JOIN students st ON st.id=ma.student_id
		LEFT JOIN schools sch ON sch.id=ma.school_id
		LEFT JOIN LATERAL (
			SELECT COUNT(qa.question_id)::int AS answered_count,
			       COUNT(*) FILTER (WHERE qa.correct)::int AS correct_count
			FROM mock_assessment_items mi
			LEFT JOIN question_attempts qa
			  ON qa.mock_assessment_id=mi.assessment_id
			 AND qa.question_id=mi.question_id
			WHERE mi.assessment_id=ma.id
		) stats ON TRUE
		WHERE ma.id=$1::uuid
		  AND st.external_ref=$2
		  AND ($3='' OR sch.urn=$3)
	`, id, studentExternalRef, schoolURN)
	var err error
	assessment, err = scanMockAssessmentRow(row)
	if errors.Is(err, pgx.ErrNoRows) {
		return MockAssessment{}, false, nil
	}
	if err != nil {
		return MockAssessment{}, false, err
	}
	items, err := r.listMockAssessmentItems(ctx, assessment.ID)
	if err != nil {
		return MockAssessment{}, false, err
	}
	assessment.Items = items
	return assessment, true, nil
}

func (r *PostgresRepository) listMockAssessmentItems(ctx context.Context, assessmentID string) ([]MockAssessmentItem, error) {
	rows, err := r.db.Query(ctx, `
		SELECT position, question_id, objective_id, COALESCE(activity_id,''), selection_reason
		FROM mock_assessment_items
		WHERE assessment_id=$1::uuid
		ORDER BY position
	`, assessmentID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items := []MockAssessmentItem{}
	for rows.Next() {
		var item MockAssessmentItem
		if err := rows.Scan(&item.Position, &item.QuestionID, &item.ObjectiveID, &item.ActivityID, &item.SelectionReason); err != nil {
			return nil, err
		}
		items = append(items, item)
	}
	return items, rows.Err()
}

func (r *PostgresRepository) ListMockAssessmentQuestions(ctx context.Context, assessmentID string, studentExternalRef string) ([]QuestionConfig, error) {
	items, err := r.listMockAssessmentItems(ctx, assessmentID)
	if err != nil {
		return nil, err
	}
	reasons := map[string]string{}
	for _, item := range items {
		reasons[item.QuestionID] = item.SelectionReason
	}
	rows, err := r.db.Query(ctx, `
		SELECT q.id, COALESCE(q.activity_id,''), COALESCE(q.objective_id,''), q.format,
		       q.body, q.expected_answer, q.hints, q.explanation, q.difficulty,
		       q.status, q.updated_at
		FROM mock_assessment_items mi
		JOIN mock_assessments ma ON ma.id=mi.assessment_id
		JOIN students st ON st.id=ma.student_id
		JOIN questions q ON q.id=mi.question_id
		WHERE mi.assessment_id=$1::uuid
		  AND st.external_ref=$2
		  AND q.status IN ('approved','published','live')
		ORDER BY mi.position
	`, assessmentID, studentExternalRef)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	questions := []QuestionConfig{}
	for rows.Next() {
		question, err := scanQuestion(rows)
		if err != nil {
			return nil, err
		}
		question.SelectionReason = reasons[question.ID]
		questions = append(questions, question)
	}
	return questions, rows.Err()
}

type mockAssessmentRow interface {
	Scan(...any) error
}

func scanMockAssessment(rows interface{ Scan(...any) error }) (MockAssessment, error) {
	return scanMockAssessmentRow(rows)
}

func scanMockAssessmentRow(row mockAssessmentRow) (MockAssessment, error) {
	var assessment MockAssessment
	var accessibility []byte
	var createdAt, updatedAt time.Time
	var completedAt *time.Time
	err := row.Scan(
		&assessment.ID, &assessment.StudentExternalRef, &assessment.StudentDisplayName, &assessment.SchoolURN,
		&assessment.CreatedByRole, &assessment.CreatedBy, &assessment.Subject, &assessment.YearGroup,
		&assessment.YearFrom, &assessment.YearTo, &assessment.Title, &assessment.Status,
		&assessment.QuestionCount, &assessment.DurationMinutes, &assessment.IncludeRevision,
		&assessment.IncludeStretch, &accessibility, &assessment.AnsweredCount, &assessment.CorrectCount,
		&createdAt, &updatedAt, &completedAt,
	)
	if err != nil {
		return MockAssessment{}, err
	}
	assessment.Accessibility = map[string]any{}
	if len(accessibility) > 0 {
		if err := json.Unmarshal(accessibility, &assessment.Accessibility); err != nil {
			return MockAssessment{}, err
		}
	}
	assessment.CreatedAt = createdAt.UTC().Format(time.RFC3339)
	assessment.UpdatedAt = updatedAt.UTC().Format(time.RFC3339)
	if completedAt != nil {
		assessment.CompletedAt = completedAt.UTC().Format(time.RFC3339)
	}
	if assessment.AnsweredCount > 0 {
		assessment.Score = assessment.CorrectCount * 100 / assessment.AnsweredCount
	}
	return assessment, nil
}
