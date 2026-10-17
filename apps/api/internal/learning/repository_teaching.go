package learning

import (
	"context"
	"encoding/json"
	"errors"
	"strconv"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
)

func (r *PostgresRepository) StartSession(ctx context.Context, studentID string, mode string, deviceTier string) (LearningSession, error) {
	return r.startSession(ctx, studentID, mode, deviceTier, "")
}

func (r *PostgresRepository) StartSessionWithKey(ctx context.Context, studentID string, mode string, deviceTier string, idempotencyKey string) (LearningSession, error) {
	return r.startSession(ctx, studentID, mode, deviceTier, idempotencyKey)
}

func (r *PostgresRepository) startSession(ctx context.Context, studentID string, mode string, deviceTier string, idempotencyKey string) (LearningSession, error) {
	if mode == "" {
		mode = "home"
	}
	if deviceTier == "" {
		deviceTier = "unknown"
	}
	session := LearningSession{
		StudentID:  studentID,
		Mode:       mode,
		DeviceTier: deviceTier,
	}
	if studentID == "" {
		return session, nil
	}

	studentUUID, err := r.studentUUID(ctx, studentID)
	if errors.Is(err, pgx.ErrNoRows) {
		return session, ErrStudentNotFound
	}
	if err != nil {
		return session, err
	}
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return session, err
	}
	defer tx.Rollback(ctx)
	replay, err := beginIdempotency(ctx, tx, "learning.session", studentUUID, idempotencyKey, map[string]string{"student_id": studentID, "mode": mode, "device_tier": deviceTier})
	if err != nil {
		return session, err
	}
	if replay.Found {
		if err := json.Unmarshal(replay.Response, &session); err != nil {
			return session, err
		}
		return session, nil
	}
	var startedAt time.Time
	err = tx.QueryRow(ctx, `
		INSERT INTO learning_sessions (student_id, mode, device_tier)
		VALUES ($1,$2,$3)
		RETURNING id::text, started_at
	`, studentUUID, mode, deviceTier).Scan(&session.ID, &startedAt)
	if err != nil {
		return session, err
	}
	session.StartedAt = startedAt.UTC().Format(time.RFC3339)
	if err := completeIdempotency(ctx, tx, "learning.session", studentUUID, idempotencyKey, session); err != nil {
		return session, err
	}
	if err := tx.Commit(ctx); err != nil {
		return session, err
	}
	return session, nil
}

func (r *PostgresRepository) RecordLessonStep(ctx context.Context, attempt LessonStepAttempt) (LessonStepAttempt, error) {
	if attempt.StudentID == "" || attempt.ActivityID == "" || attempt.ObjectiveID == "" || attempt.StepID == "" {
		return attempt, invalidConfig("student, activity, objective and lesson step are required")
	}
	switch attempt.Status {
	case "started", "completed", "skipped", "paused":
	default:
		return attempt, invalidConfig("lesson step status must be started, completed, skipped or paused")
	}
	if attempt.DurationMS < 0 {
		return attempt, invalidConfig("lesson step duration cannot be negative")
	}
	studentUUID, err := r.studentUUID(ctx, attempt.StudentID)
	if errors.Is(err, pgx.ErrNoRows) {
		return attempt, ErrStudentNotFound
	}
	if err != nil {
		return attempt, err
	}
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return attempt, err
	}
	defer tx.Rollback(ctx)
	replay, err := beginIdempotency(ctx, tx, "learning.lesson_step", studentUUID, attempt.IdempotencyKey, attempt)
	if err != nil {
		return attempt, err
	}
	if replay.Found {
		if err := json.Unmarshal(replay.Response, &attempt); err != nil {
			return attempt, err
		}
		return attempt, nil
	}
	var recordedAt time.Time
	err = tx.QueryRow(ctx, `
		INSERT INTO lesson_step_attempts (
			student_id, activity_id, objective_id, step_id, step_kind,
			status, duration_ms, support_used
		)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
		RETURNING id::text, recorded_at
	`, studentUUID, attempt.ActivityID, attempt.ObjectiveID, attempt.StepID,
		attempt.StepKind, attempt.Status, attempt.DurationMS, attempt.SupportUsed,
	).Scan(&attempt.ID, &recordedAt)
	if err != nil {
		return attempt, err
	}
	attempt.RecordedAt = recordedAt.UTC().Format(time.RFC3339)
	if err := completeIdempotency(ctx, tx, "learning.lesson_step", studentUUID, attempt.IdempotencyKey, attempt); err != nil {
		return attempt, err
	}
	if err := tx.Commit(ctx); err != nil {
		return attempt, err
	}
	return attempt, nil
}

func (r *PostgresRepository) RecordLearningEvent(ctx context.Context, event LearningEvent) (LearningEvent, error) {
	if event.StudentID == "" || event.EventType == "" {
		return event, invalidConfig("student and event type are required")
	}
	switch event.EventType {
	case "assessment_started", "assessment_completed", "question_seen", "audio_replay", "hint_opened",
		"mission_paused", "mission_resumed", "mission_exited", "mission_restarted",
		"response_mode_changed", "support_changed", "audio_playback_failed":
	default:
		return event, invalidConfig("learning event type is not valid")
	}
	if event.Payload == nil {
		event.Payload = map[string]any{}
	}
	studentUUID, err := r.studentUUID(ctx, event.StudentID)
	if errors.Is(err, pgx.ErrNoRows) {
		return event, ErrStudentNotFound
	}
	if err != nil {
		return event, err
	}
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return event, err
	}
	defer tx.Rollback(ctx)
	replay, err := beginIdempotency(ctx, tx, "learning.event", studentUUID, event.IdempotencyKey, event)
	if err != nil {
		return event, err
	}
	if replay.Found {
		if err := json.Unmarshal(replay.Response, &event); err != nil {
			return event, err
		}
		return event, nil
	}
	payload, err := json.Marshal(event.Payload)
	if err != nil {
		return event, invalidConfig("learning event payload is not valid")
	}
	var createdAt time.Time
	err = tx.QueryRow(ctx, `
		INSERT INTO learning_events (student_id, event_type, event_payload)
		VALUES ($1,$2,$3)
		RETURNING id::text, created_at
	`, studentUUID, event.EventType, payload).Scan(&event.ID, &createdAt)
	if err != nil {
		return event, err
	}
	event.CreatedAt = createdAt.UTC().Format(time.RFC3339)
	if err := completeIdempotency(ctx, tx, "learning.event", studentUUID, event.IdempotencyKey, event); err != nil {
		return event, err
	}
	if err := tx.Commit(ctx); err != nil {
		return event, err
	}
	return event, nil
}

func (r *PostgresRepository) ListAssignments(ctx context.Context, schoolURN string, studentExternalRef string) ([]Assignment, error) {
	query := `
		SELECT a.id::text, COALESCE(sch.urn,''), st.external_ref, st.display_name,
		       a.objective_id, COALESCE(a.activity_id,''), a.title, a.priority,
		       a.status, a.due_at, a.created_by, a.created_at, a.updated_at
		FROM assignments a
		JOIN schools sch ON sch.id = a.school_id
		JOIN students st ON st.id = a.student_id
		WHERE 1=1
	`
	args := []any{}
	if strings.TrimSpace(schoolURN) != "" {
		query += " AND sch.urn=$" + strconv.Itoa(len(args)+1)
		args = append(args, strings.TrimSpace(schoolURN))
	}
	if strings.TrimSpace(studentExternalRef) != "" {
		query += " AND st.external_ref=$" + strconv.Itoa(len(args)+1)
		args = append(args, strings.TrimSpace(studentExternalRef))
	}
	query += `
		ORDER BY
		  CASE WHEN a.status = 'active' THEN 0 ELSE 1 END,
		  a.priority DESC,
		  a.due_at NULLS LAST,
		  a.updated_at DESC
		LIMIT 500`
	rows, err := r.db.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []Assignment{}
	for rows.Next() {
		var assignment Assignment
		var dueAt *time.Time
		var createdAt, updatedAt time.Time
		if err := rows.Scan(
			&assignment.ID, &assignment.SchoolURN, &assignment.StudentExternalRef,
			&assignment.StudentDisplayName, &assignment.ObjectiveID, &assignment.ActivityID,
			&assignment.Title, &assignment.Priority, &assignment.Status, &dueAt,
			&assignment.CreatedBy, &createdAt, &updatedAt,
		); err != nil {
			return nil, err
		}
		if dueAt != nil {
			assignment.DueAt = dueAt.UTC().Format(time.RFC3339)
		}
		assignment.CreatedAt = createdAt.UTC().Format(time.RFC3339)
		assignment.UpdatedAt = updatedAt.UTC().Format(time.RFC3339)
		out = append(out, assignment)
	}
	return out, rows.Err()
}

func (r *PostgresRepository) CreateAssignment(ctx context.Context, assignment Assignment) (Assignment, error) {
	if assignment.SchoolURN == "" || assignment.StudentExternalRef == "" || assignment.ObjectiveID == "" || assignment.Title == "" {
		return assignment, invalidConfig("school, student, objective and assignment title are required")
	}
	if assignment.Priority == 0 {
		assignment.Priority = 70
	}
	if assignment.Priority < 1 || assignment.Priority > 100 {
		return assignment, invalidConfig("assignment priority must be between 1 and 100")
	}
	if assignment.Status == "" {
		assignment.Status = "active"
	}
	switch assignment.Status {
	case "active", "completed", "cancelled":
	default:
		return assignment, invalidConfig("assignment status must be active, completed or cancelled")
	}
	var dueAt *time.Time
	if assignment.DueAt != "" {
		parsed, err := time.Parse(time.RFC3339, assignment.DueAt)
		if err != nil {
			return assignment, invalidConfig("assignment due_at must use RFC3339")
		}
		dueAt = &parsed
	}
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return assignment, err
	}
	defer tx.Rollback(ctx)
	replay, err := beginIdempotency(ctx, tx, "school.assignment", assignment.SchoolURN+":"+assignment.StudentExternalRef, assignment.IdempotencyKey, assignment)
	if err != nil {
		return assignment, err
	}
	if replay.Found {
		if err := json.Unmarshal(replay.Response, &assignment); err != nil {
			return assignment, err
		}
		return assignment, nil
	}
	var createdAt, updatedAt time.Time
	err = tx.QueryRow(ctx, `
		INSERT INTO assignments (
			school_id, student_id, objective_id, activity_id, title,
			priority, status, due_at, created_by
		)
		SELECT sch.id, st.id, $3, NULLIF($4,''), $5, $6, $7, $8, $9
		FROM schools sch
		JOIN classes c ON c.school_id = sch.id
		JOIN class_students cs ON cs.class_id = c.id
		JOIN students st ON st.id = cs.student_id
		WHERE sch.urn = $1
		  AND st.external_ref = $2
		  AND EXISTS (SELECT 1 FROM curriculum_objectives o WHERE o.id = $3)
		  AND (
		    $4 = ''
		    OR EXISTS (
		      SELECT 1
		      FROM activities act
		      WHERE act.id = $4
		        AND act.objective_id = $3
		        AND act.status IN ('approved', 'published', 'live')
		    )
		  )
		LIMIT 1
		RETURNING id::text, created_at, updated_at
	`, assignment.SchoolURN, assignment.StudentExternalRef, assignment.ObjectiveID,
		assignment.ActivityID, assignment.Title, assignment.Priority, assignment.Status,
		dueAt, assignment.CreatedBy,
	).Scan(&assignment.ID, &createdAt, &updatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return assignment, invalidConfig("student is not assigned to this school")
	}
	if err != nil {
		return assignment, err
	}
	assignment.CreatedAt = createdAt.UTC().Format(time.RFC3339)
	assignment.UpdatedAt = updatedAt.UTC().Format(time.RFC3339)
	if err := completeIdempotency(ctx, tx, "school.assignment", assignment.SchoolURN+":"+assignment.StudentExternalRef, assignment.IdempotencyKey, assignment); err != nil {
		return assignment, err
	}
	if err := tx.Commit(ctx); err != nil {
		return assignment, err
	}
	return assignment, nil
}

func (r *PostgresRepository) ListTeacherEvidence(ctx context.Context, schoolURN string, studentExternalRef string) ([]TeacherEvidenceRecord, error) {
	query := `
		SELECT e.id::text, COALESCE(sch.urn,''), st.external_ref, st.display_name,
		       e.objective_id, e.evidence_type, e.outcome, e.note, e.source_ref,
		       e.recorded_by, e.recorded_at
		FROM teacher_evidence_records e
		JOIN schools sch ON sch.id=e.school_id
		JOIN students st ON st.id=e.student_id
		WHERE 1=1
	`
	args := []any{}
	if strings.TrimSpace(schoolURN) != "" {
		query += " AND sch.urn=$" + strconv.Itoa(len(args)+1)
		args = append(args, strings.TrimSpace(schoolURN))
	}
	if strings.TrimSpace(studentExternalRef) != "" {
		query += " AND st.external_ref=$" + strconv.Itoa(len(args)+1)
		args = append(args, strings.TrimSpace(studentExternalRef))
	}
	query += `
		ORDER BY e.recorded_at DESC
		LIMIT 200`
	rows, err := r.db.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []TeacherEvidenceRecord{}
	for rows.Next() {
		var item TeacherEvidenceRecord
		var recordedAt time.Time
		if err := rows.Scan(
			&item.ID, &item.SchoolURN, &item.StudentExternalRef, &item.StudentDisplayName,
			&item.ObjectiveID, &item.EvidenceType, &item.Outcome, &item.Note,
			&item.SourceRef, &item.RecordedBy, &recordedAt,
		); err != nil {
			return nil, err
		}
		item.RecordedAt = recordedAt.UTC().Format(time.RFC3339)
		out = append(out, item)
	}
	return out, rows.Err()
}

func (r *PostgresRepository) CreateTeacherEvidence(ctx context.Context, record TeacherEvidenceRecord) (TeacherEvidenceRecord, error) {
	if record.SchoolURN == "" || record.StudentExternalRef == "" || record.ObjectiveID == "" || record.Note == "" {
		return record, invalidConfig("school, student, objective and evidence note are required")
	}
	switch record.EvidenceType {
	case "observation", "work_sample", "conversation", "assessment", "external":
	default:
		return record, invalidConfig("teacher evidence type is not valid")
	}
	switch record.Outcome {
	case "secure", "developing", "needs_support", "inconclusive":
	default:
		return record, invalidConfig("teacher evidence outcome is not valid")
	}
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return record, err
	}
	defer tx.Rollback(ctx)
	replay, err := beginIdempotency(ctx, tx, "school.teacher_evidence", record.SchoolURN+":"+record.StudentExternalRef, record.IdempotencyKey, record)
	if err != nil {
		return record, err
	}
	if replay.Found {
		if err := json.Unmarshal(replay.Response, &record); err != nil {
			return record, err
		}
		return record, nil
	}
	var recordedAt time.Time
	err = tx.QueryRow(ctx, `
		INSERT INTO teacher_evidence_records (
			school_id, student_id, objective_id, evidence_type, outcome,
			note, source_ref, recorded_by
		)
		SELECT sch.id, st.id, $3, $4, $5, $6, $7, $8
		FROM schools sch
		JOIN classes c ON c.school_id=sch.id
		JOIN class_students cs ON cs.class_id=c.id
		JOIN students st ON st.id=cs.student_id
		WHERE sch.urn=$1 AND st.external_ref=$2
		  AND EXISTS (SELECT 1 FROM curriculum_objectives o WHERE o.id=$3)
		LIMIT 1
		RETURNING id::text, recorded_at
	`, record.SchoolURN, record.StudentExternalRef, record.ObjectiveID,
		record.EvidenceType, record.Outcome, record.Note, record.SourceRef, record.RecordedBy,
	).Scan(&record.ID, &recordedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return record, invalidConfig("student or objective is outside this school")
	}
	if err != nil {
		return record, err
	}
	record.RecordedAt = recordedAt.UTC().Format(time.RFC3339)
	if err := completeIdempotency(ctx, tx, "school.teacher_evidence", record.SchoolURN+":"+record.StudentExternalRef, record.IdempotencyKey, record); err != nil {
		return record, err
	}
	if err := tx.Commit(ctx); err != nil {
		return record, err
	}
	return record, nil
}

func (r *PostgresRepository) ListInterventions(ctx context.Context, schoolURN string, studentExternalRef string) ([]InterventionPlan, error) {
	query := `
		SELECT p.id::text, COALESCE(sch.urn,''), st.external_ref, st.display_name,
		       p.objective_id, p.title, p.need, p.strategy, p.priority, p.status,
		       p.review_due_at, p.created_by, p.created_at, p.updated_at
		FROM intervention_plans p
		JOIN schools sch ON sch.id=p.school_id
		JOIN students st ON st.id=p.student_id
		WHERE 1=1
	`
	args := []any{}
	if strings.TrimSpace(schoolURN) != "" {
		query += " AND sch.urn=$" + strconv.Itoa(len(args)+1)
		args = append(args, strings.TrimSpace(schoolURN))
	}
	if strings.TrimSpace(studentExternalRef) != "" {
		query += " AND st.external_ref=$" + strconv.Itoa(len(args)+1)
		args = append(args, strings.TrimSpace(studentExternalRef))
	}
	query += `
		ORDER BY
		  CASE WHEN p.status IN ('active','monitoring') THEN 0 ELSE 1 END,
		  p.priority DESC,
		  p.review_due_at NULLS LAST,
		  p.updated_at DESC
		LIMIT 500`
	rows, err := r.db.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []InterventionPlan{}
	for rows.Next() {
		var item InterventionPlan
		var reviewDue *time.Time
		var createdAt, updatedAt time.Time
		if err := rows.Scan(
			&item.ID, &item.SchoolURN, &item.StudentExternalRef, &item.StudentDisplayName,
			&item.ObjectiveID, &item.Title, &item.Need, &item.Strategy, &item.Priority,
			&item.Status, &reviewDue, &item.CreatedBy, &createdAt, &updatedAt,
		); err != nil {
			return nil, err
		}
		if reviewDue != nil {
			item.ReviewDueAt = reviewDue.UTC().Format(time.RFC3339)
		}
		item.CreatedAt = createdAt.UTC().Format(time.RFC3339)
		item.UpdatedAt = updatedAt.UTC().Format(time.RFC3339)
		out = append(out, item)
	}
	return out, rows.Err()
}

func (r *PostgresRepository) CreateIntervention(ctx context.Context, plan InterventionPlan) (InterventionPlan, error) {
	if plan.SchoolURN == "" || plan.StudentExternalRef == "" || plan.ObjectiveID == "" || plan.Title == "" || plan.Need == "" || plan.Strategy == "" {
		return plan, invalidConfig("school, student, objective, title, need and strategy are required")
	}
	if plan.Priority == 0 {
		plan.Priority = 85
	}
	if plan.Priority < 1 || plan.Priority > 100 {
		return plan, invalidConfig("intervention priority must be between 1 and 100")
	}
	if plan.Status == "" {
		plan.Status = "active"
	}
	switch plan.Status {
	case "active", "monitoring", "completed", "cancelled":
	default:
		return plan, invalidConfig("intervention status is not valid")
	}
	var reviewDue *time.Time
	if plan.ReviewDueAt != "" {
		parsed, err := time.Parse(time.RFC3339, plan.ReviewDueAt)
		if err != nil {
			return plan, invalidConfig("intervention review_due_at must use RFC3339")
		}
		reviewDue = &parsed
	}
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return plan, err
	}
	defer tx.Rollback(ctx)
	replay, err := beginIdempotency(ctx, tx, "school.intervention", plan.SchoolURN+":"+plan.StudentExternalRef, plan.IdempotencyKey, plan)
	if err != nil {
		return plan, err
	}
	if replay.Found {
		if err := json.Unmarshal(replay.Response, &plan); err != nil {
			return plan, err
		}
		return plan, nil
	}
	var createdAt, updatedAt time.Time
	err = tx.QueryRow(ctx, `
		INSERT INTO intervention_plans (
			school_id, student_id, objective_id, title, need, strategy,
			priority, status, review_due_at, created_by
		)
		SELECT sch.id, st.id, $3, $4, $5, $6, $7, $8, $9, $10
		FROM schools sch
		JOIN classes c ON c.school_id=sch.id
		JOIN class_students cs ON cs.class_id=c.id
		JOIN students st ON st.id=cs.student_id
		WHERE sch.urn=$1 AND st.external_ref=$2
		  AND EXISTS (SELECT 1 FROM curriculum_objectives o WHERE o.id=$3)
		LIMIT 1
		RETURNING id::text, created_at, updated_at
	`, plan.SchoolURN, plan.StudentExternalRef, plan.ObjectiveID, plan.Title,
		plan.Need, plan.Strategy, plan.Priority, plan.Status, reviewDue, plan.CreatedBy,
	).Scan(&plan.ID, &createdAt, &updatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return plan, invalidConfig("student or objective is outside this school")
	}
	if err != nil {
		return plan, err
	}
	plan.CreatedAt = createdAt.UTC().Format(time.RFC3339)
	plan.UpdatedAt = updatedAt.UTC().Format(time.RFC3339)
	if err := completeIdempotency(ctx, tx, "school.intervention", plan.SchoolURN+":"+plan.StudentExternalRef, plan.IdempotencyKey, plan); err != nil {
		return plan, err
	}
	if err := tx.Commit(ctx); err != nil {
		return plan, err
	}
	return plan, nil
}

func (r *PostgresRepository) UpdateInterventionStatus(ctx context.Context, schoolURN string, id string, status string) (InterventionPlan, error) {
	if schoolURN == "" || id == "" {
		return InterventionPlan{}, invalidConfig("school and intervention id are required")
	}
	switch status {
	case "active", "monitoring", "completed", "cancelled":
	default:
		return InterventionPlan{}, invalidConfig("intervention status is not valid")
	}
	var plan InterventionPlan
	var reviewDue *time.Time
	var createdAt, updatedAt time.Time
	err := r.db.QueryRow(ctx, `
		UPDATE intervention_plans p
		SET status=$3, updated_at=now()
		FROM schools sch, students st
		WHERE p.id=$2::uuid
		  AND p.school_id=sch.id
		  AND p.student_id=st.id
		  AND sch.urn=$1
		RETURNING p.id::text, sch.urn, st.external_ref, st.display_name,
		          p.objective_id, p.title, p.need, p.strategy, p.priority,
		          p.status, p.review_due_at, p.created_by, p.created_at, p.updated_at
	`, schoolURN, id, status).Scan(
		&plan.ID, &plan.SchoolURN, &plan.StudentExternalRef, &plan.StudentDisplayName,
		&plan.ObjectiveID, &plan.Title, &plan.Need, &plan.Strategy, &plan.Priority,
		&plan.Status, &reviewDue, &plan.CreatedBy, &createdAt, &updatedAt,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return InterventionPlan{}, invalidConfig("intervention does not exist in this school")
	}
	if err != nil {
		return InterventionPlan{}, err
	}
	if reviewDue != nil {
		plan.ReviewDueAt = reviewDue.UTC().Format(time.RFC3339)
	}
	plan.CreatedAt = createdAt.UTC().Format(time.RFC3339)
	plan.UpdatedAt = updatedAt.UTC().Format(time.RFC3339)
	return plan, nil
}

func (r *PostgresRepository) ListInterventionReviews(ctx context.Context, schoolURN string, studentExternalRef string) ([]InterventionReview, error) {
	query := `
		SELECT r.id::text, r.intervention_id::text, sch.urn, st.external_ref,
		       st.display_name, r.objective_id, r.outcome, r.evidence_note,
		       r.next_review_due_at, r.reviewed_by, r.reviewed_at
		FROM intervention_reviews r
		JOIN schools sch ON sch.id=r.school_id
		JOIN students st ON st.id=r.student_id
		WHERE 1=1
	`
	args := []any{}
	if strings.TrimSpace(schoolURN) != "" {
		query += " AND sch.urn=$" + strconv.Itoa(len(args)+1)
		args = append(args, strings.TrimSpace(schoolURN))
	}
	if strings.TrimSpace(studentExternalRef) != "" {
		query += " AND st.external_ref=$" + strconv.Itoa(len(args)+1)
		args = append(args, strings.TrimSpace(studentExternalRef))
	}
	query += `
		ORDER BY r.reviewed_at DESC
		LIMIT 500`
	rows, err := r.db.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []InterventionReview{}
	for rows.Next() {
		var review InterventionReview
		var nextReview *time.Time
		var reviewedAt time.Time
		if err := rows.Scan(
			&review.ID, &review.InterventionID, &review.SchoolURN,
			&review.StudentExternalRef, &review.StudentDisplayName, &review.ObjectiveID,
			&review.Outcome, &review.EvidenceNote, &nextReview,
			&review.ReviewedBy, &reviewedAt,
		); err != nil {
			return nil, err
		}
		if nextReview != nil {
			review.NextReviewDueAt = nextReview.UTC().Format(time.RFC3339)
		}
		review.ReviewedAt = reviewedAt.UTC().Format(time.RFC3339)
		out = append(out, review)
	}
	return out, rows.Err()
}

func (r *PostgresRepository) CreateInterventionReview(ctx context.Context, review InterventionReview) (InterventionReview, error) {
	if review.SchoolURN == "" || review.InterventionID == "" || review.EvidenceNote == "" {
		return review, invalidConfig("school, intervention and reassessment evidence note are required")
	}
	status, ok := interventionStatusForReviewOutcome(review.Outcome)
	if !ok {
		return review, invalidConfig("intervention review outcome is not valid")
	}
	var nextReview *time.Time
	if review.NextReviewDueAt != "" {
		parsed, err := time.Parse(time.RFC3339, review.NextReviewDueAt)
		if err != nil {
			return review, invalidConfig("intervention next_review_due_at must use RFC3339")
		}
		nextReview = &parsed
	}
	if (review.Outcome == "continue" || review.Outcome == "monitor" || review.Outcome == "reopen") && nextReview == nil {
		return review, invalidConfig("continuing or monitoring an intervention requires a next review date")
	}
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return review, err
	}
	defer tx.Rollback(ctx)
	replay, err := beginIdempotency(ctx, tx, "school.intervention_review", review.SchoolURN+":"+review.InterventionID, review.IdempotencyKey, review)
	if err != nil {
		return review, err
	}
	if replay.Found {
		if err := json.Unmarshal(replay.Response, &review); err != nil {
			return review, err
		}
		return review, nil
	}
	var reviewedAt time.Time
	err = tx.QueryRow(ctx, `
		INSERT INTO intervention_reviews (
			intervention_id, school_id, student_id, objective_id, outcome,
			evidence_note, next_review_due_at, reviewed_by
		)
		SELECT p.id, p.school_id, p.student_id, p.objective_id, $3, $4, $5, $6
		FROM intervention_plans p
		JOIN schools sch ON sch.id=p.school_id
		WHERE sch.urn=$1 AND p.id=$2::uuid
		RETURNING id::text, intervention_id::text, objective_id, reviewed_at
	`, review.SchoolURN, review.InterventionID, review.Outcome, review.EvidenceNote,
		nextReview, review.ReviewedBy,
	).Scan(&review.ID, &review.InterventionID, &review.ObjectiveID, &reviewedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return review, invalidConfig("intervention does not exist in this school")
	}
	if err != nil {
		return review, err
	}
	if _, err := tx.Exec(ctx, `
		UPDATE intervention_plans p
		SET status=$3, review_due_at=$4, updated_at=now()
		FROM schools sch
		WHERE p.id=$2::uuid
		  AND p.school_id=sch.id
		  AND sch.urn=$1
	`, review.SchoolURN, review.InterventionID, status, nextReview); err != nil {
		return review, err
	}
	if nextReview != nil {
		review.NextReviewDueAt = nextReview.UTC().Format(time.RFC3339)
	}
	review.ReviewedAt = reviewedAt.UTC().Format(time.RFC3339)
	if err := completeIdempotency(ctx, tx, "school.intervention_review", review.SchoolURN+":"+review.InterventionID, review.IdempotencyKey, review); err != nil {
		return review, err
	}
	if err := tx.Commit(ctx); err != nil {
		return review, err
	}
	return review, nil
}

func interventionStatusForReviewOutcome(outcome string) (string, bool) {
	switch outcome {
	case "continue", "reopen":
		return "active", true
	case "monitor":
		return "monitoring", true
	case "complete":
		return "completed", true
	default:
		return "", false
	}
}
