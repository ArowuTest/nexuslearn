package learning

import (
	"context"
	"encoding/json"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
)

func (r *PostgresRepository) RecordAttempt(ctx context.Context, attempt Attempt) (AttemptResult, error) {
	var result AttemptResult
	if attempt.StudentID == "" || attempt.ObjectiveID == "" {
		return AttemptResult{}, ErrInvalidResponse
	}

	studentUUID, err := r.studentUUID(ctx, attempt.StudentID)
	if errors.Is(err, pgx.ErrNoRows) {
		return result, ErrStudentNotFound
	}
	if err != nil {
		return result, err
	}
	attempt.AssistanceUsed = normaliseAssistance(attempt.AssistanceUsed, attempt.HintUsed)
	attempt.HintUsed = attempt.HintUsed || containsAssistance(attempt.AssistanceUsed, "hint")
	if attemptResponseMode(attempt) == "keyboard" && !containsAssistance(attempt.AssistanceUsed, "keyboard_response") {
		attempt.AssistanceUsed = append(attempt.AssistanceUsed, "keyboard_response")
	}
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return result, err
	}
	defer tx.Rollback(ctx)

	replay, err := beginIdempotency(ctx, tx, "learning.attempt", studentUUID, attempt.IdempotencyKey, attempt)
	if err != nil {
		return result, err
	}
	if replay.Found {
		if err := json.Unmarshal(replay.Response, &result); err != nil {
			return result, err
		}
		return result, nil
	}
	question, err := canonicalQuestion(ctx, tx, attempt.QuestionID)
	if err != nil {
		return AttemptResult{}, err
	}
	// Capture the typed value before normalization, but after historical replay.
	// This is not an HTTP transcript or a recording of keystrokes/speech.
	submittedResponse, err := json.Marshal(attempt.Response)
	if err != nil || len(submittedResponse) > 65536 {
		return AttemptResult{}, ErrInvalidResponse
	}
	attempt, result, err = gradeCanonicalAttempt(attempt, question)
	if err != nil {
		return AttemptResult{}, err
	}
	var priorScore int
	if attempt.MockAssessmentID != "" {
		if err := r.prepareMockAssessmentAttempt(ctx, tx, attempt, studentUUID); err != nil {
			return result, err
		}
		// Mock results never claim mastery/energy that was not awarded.
		result.MasteryGain, result.MasteryDelta, result.ProjectedScore, result.NextReviewDays = 0, 0, 0, 0
		result.RewardHook, result.AnimationHook = "assessment-progress", "quiet-progress"
		result.Feedback = "Your mock answer is recorded."
		result.Explanation = "This mock answer is recorded separately from mastery and spaced review."
	} else {
		if _, err := tx.Exec(ctx, `
			INSERT INTO student_objective_mastery (student_id, objective_id, score, band, updated_at)
			VALUES ($1,$2,0,$3,now())
			ON CONFLICT (student_id, objective_id) DO NOTHING
		`, studentUUID, attempt.ObjectiveID, MasteryBand(0)); err != nil {
			return result, err
		}

		priorScore, err = r.currentMasteryScore(ctx, tx, studentUUID, attempt.ObjectiveID)
		if err != nil {
			return result, err
		}
		result.MasteryDelta = cumulativeDelta(attempt, result)
		result.MasteryGain = maxInt(result.MasteryDelta, 0)
		result.ProjectedScore = clamp(priorScore+result.MasteryDelta, 0, 100)
		result.ProjectedBand = MasteryBand(result.ProjectedScore)
		result.NextReviewDays, err = r.nextReviewDaysForObjective(ctx, tx, attempt.ObjectiveID, result.ProjectedScore)
		if err != nil {
			return result, err
		}
		result, err = r.applyRewardPolicy(ctx, tx, attempt.ObjectiveID, result)
		if err != nil {
			return result, err
		}
		// World configuration still controls rewards/animation, but cannot replace
		// task-specific repair guidance with generic praise or speed pressure.
		result = applyQuestionRepairFeedback(question, result)
	}

	if _, err := tx.Exec(ctx, `
		INSERT INTO question_grading_versions(version,question_id,snapshot)
		VALUES ($1,$2,$3::jsonb) ON CONFLICT (version) DO NOTHING
	`, attempt.QuestionVersion, question.ID, mustJSON(question)); err != nil {
		return result, err
	}
	_, err = tx.Exec(ctx, `
		INSERT INTO question_attempts (
			student_id, objective_id, question_id, format, expected_answer, given_answer,
			correct, response_ms, hint_used, assistance_used, confidence, mastery_delta, explanation, response_mode,
			mock_assessment_id, question_version, submitted_response, grader_revision
		)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,NULLIF($11,0),$12,$13,$14,NULLIF($15,'')::uuid,$16,$17::json,$18)
	`, studentUUID, attempt.ObjectiveID, attempt.QuestionID, attemptFormat(attempt),
		expectedAnswerText(attempt), givenAnswerText(attempt),
		result.Correct, attempt.MS, attempt.HintUsed, attempt.AssistanceUsed, attempt.Confidence,
		result.MasteryDelta, result.Explanation, attemptResponseMode(attempt), attempt.MockAssessmentID, attempt.QuestionVersion, string(submittedResponse), canonicalGraderRevision)
	if err != nil {
		return result, err
	}
	if attempt.MockAssessmentID != "" {
		result.EvidenceEvent = "mock_assessment.answer_recorded"
		result.MockAssessment, err = r.updateMockAssessmentProgress(ctx, tx, attempt.MockAssessmentID)
		if err != nil {
			return result, err
		}
		if err := completeIdempotency(ctx, tx, "learning.attempt", studentUUID, attempt.IdempotencyKey, result); err != nil {
			return result, err
		}
		if err := tx.Commit(ctx); err != nil {
			return result, err
		}
		return result, nil
	}

	var historyID string
	err = tx.QueryRow(ctx, `
		INSERT INTO mastery_history (
			student_id, objective_id, question_id, prior_score, new_score, mastery_delta,
			correct, hint_used, assistance_used, confidence, response_format, response_mode
		)
		VALUES ($1,$2,NULLIF($3,''),$4,$5,$6,$7,$8,$9,NULLIF($10,0),$11,$12)
		RETURNING id::text
	`, studentUUID, attempt.ObjectiveID, attempt.QuestionID, priorScore, result.ProjectedScore,
		result.MasteryDelta, result.Correct, attempt.HintUsed, attempt.AssistanceUsed, attempt.Confidence, attemptFormat(attempt), attemptResponseMode(attempt)).Scan(&historyID)
	if err != nil {
		return result, err
	}
	if err := r.updateMisconceptionState(ctx, tx, studentUUID, attempt, result); err != nil {
		return result, err
	}

	if result.Correct {
		retentionReview, err := r.completeMatchingReview(ctx, tx, studentUUID, attempt.ObjectiveID)
		if err != nil {
			return result, err
		}
		if retentionReview {
			if _, err := tx.Exec(ctx, `UPDATE mastery_history SET retention_review=true WHERE id=$1`, historyID); err != nil {
				return result, err
			}
		}
	}

	var dueAt *time.Time
	if result.NextReviewDays > 0 {
		next := time.Now().UTC().Add(time.Duration(result.NextReviewDays) * 24 * time.Hour)
		dueAt = &next
	}

	_, err = tx.Exec(ctx, `
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
		return result, err
	}
	if err := r.completeMasteredAssignments(ctx, tx, studentUUID, attempt.ObjectiveID, result.ProjectedScore); err != nil {
		return result, err
	}
	_, adjustedBand, err := r.refreshEvidenceConfidence(ctx, tx, studentUUID, attempt.ObjectiveID, result.ProjectedScore)
	if err != nil {
		return result, err
	}
	result.ProjectedBand = adjustedBand

	if dueAt != nil {
		_, err = tx.Exec(ctx, `
			INSERT INTO spaced_review_queue (student_id, objective_id, due_at, interval_days, priority, reason)
			VALUES ($1,$2,$3,$4,$5,$6)
			ON CONFLICT (student_id, objective_id) WHERE completed_at IS NULL DO UPDATE SET
				due_at = EXCLUDED.due_at,
				interval_days = EXCLUDED.interval_days,
				priority = GREATEST(spaced_review_queue.priority, EXCLUDED.priority),
				reason = EXCLUDED.reason
		`, studentUUID, attempt.ObjectiveID, *dueAt, result.NextReviewDays, 70, result.Explanation)
	}
	if err != nil {
		return result, err
	}
	if err := r.updateWorldState(ctx, tx, studentUUID, attempt.StudentID, attempt.ObjectiveID, result); err != nil {
		return result, err
	}
	if err := r.advanceDiagnosticBaseline(ctx, tx, studentUUID, attempt.ObjectiveID, attemptFormat(attempt), result.Correct); err != nil {
		return result, err
	}
	if err := completeIdempotency(ctx, tx, "learning.attempt", studentUUID, attempt.IdempotencyKey, result); err != nil {
		return result, err
	}
	if err := tx.Commit(ctx); err != nil {
		return result, err
	}
	return result, nil
}

func (r *PostgresRepository) completeMasteredAssignments(ctx context.Context, exec queryExecutor, studentUUID string, objectiveID string, score int) error {
	if _, err := exec.Exec(ctx, `
		UPDATE assignments a
		SET status = 'completed',
			updated_at = now()
		FROM curriculum_objectives o
		WHERE a.objective_id = o.id
		  AND a.student_id = $1
		  AND a.objective_id = $2
		  AND a.status = 'active'
		  AND $3 >= o.expected_mastery
	`, studentUUID, objectiveID, score); err != nil {
		return err
	}
	_, err := exec.Exec(ctx, `
		UPDATE intervention_plans p
		SET status='monitoring',
			updated_at=now()
		FROM curriculum_objectives o
		WHERE p.objective_id=o.id
		  AND p.student_id=$1
		  AND p.objective_id=$2
		  AND p.status='active'
		  AND $3 >= o.expected_mastery
	`, studentUUID, objectiveID, score)
	return err
}

func (r *PostgresRepository) ListMastery(ctx context.Context, studentID string) ([]StudentMastery, error) {
	if studentID == "" {
		return []StudentMastery{}, nil
	}

	rows, err := r.db.Query(ctx, `
		SELECT m.objective_id, m.score, m.band, m.last_signal, m.next_review_due_at,
		       evidence_count, format_count, independent_correct_count,
		       retained_success_count, evidence_confidence,
		       effective_evidence_score, evidence_freshness, last_evidence_at
		FROM student_objective_mastery m
		JOIN students s ON s.id=m.student_id
		WHERE s.external_ref=$1
		ORDER BY m.updated_at DESC, m.objective_id
	`, studentID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	mastery := []StudentMastery{}
	for rows.Next() {
		var item StudentMastery
		var dueAt, lastEvidenceAt *time.Time
		if err := rows.Scan(
			&item.ObjectiveID, &item.Score, &item.Band, &item.LastSignal, &dueAt,
			&item.EvidenceCount, &item.FormatCount, &item.IndependentCorrect,
			&item.RetainedSuccess, &item.EvidenceConfidence, &item.EffectiveEvidence,
			&item.EvidenceFreshness, &lastEvidenceAt,
		); err != nil {
			return nil, err
		}
		item.StudentID = studentID
		item.NextReviewDue = "not scheduled"
		if dueAt != nil {
			item.NextReviewDue = dueAt.UTC().Format(time.RFC3339)
		}
		if lastEvidenceAt != nil {
			item.LastEvidenceAt = lastEvidenceAt.UTC().Format(time.RFC3339)
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

	rows, err := r.db.Query(ctx, `
		SELECT a.objective_id, a.question_id, a.response_mode, a.correct, a.response_ms, a.hint_used, a.assistance_used, a.mastery_delta, a.explanation, a.created_at
		FROM question_attempts a
		JOIN students s ON s.id=a.student_id
		WHERE s.external_ref=$1 AND a.mock_assessment_id IS NULL
		ORDER BY a.created_at DESC
		LIMIT $2
	`, studentID, limit)
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
			&item.ResponseMode,
			&item.Correct,
			&item.ResponseMS,
			&item.HintUsed,
			&item.AssistanceUsed,
			&item.MasteryDelta,
			&item.Explanation,
			&attemptedAt,
		); err != nil {
			return nil, err
		}
		item.AssistanceUsed = normaliseAssistance(item.AssistanceUsed, item.HintUsed)
		item.Independent = !usesAnswerRevealingAssistance(item.AssistanceUsed, item.HintUsed)
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

func (r *PostgresRepository) WarmUpItems(ctx context.Context, studentID string, limit int) ([]WarmUpItem, error) {
	if studentID == "" {
		return []WarmUpItem{}, nil
	}
	if limit <= 0 || limit > 10 {
		limit = 3
	}

	// A warm-up is a learner-owned review that is due now, not a preview of
	// future reviews or a fallback to published questions. Keep earlier-year
	// objectives eligible when their content is still available at runtime.
	rows, err := r.db.Query(ctx, `
		WITH active_release AS (
			SELECT id
			FROM content_releases
			WHERE channel='live' AND status='applied'
			ORDER BY applied_at DESC NULLS LAST, id DESC
			LIMIT 1
		)
		SELECT
		  q.objective_id,
		  q.due_at,
		  q.priority,
		  q.reason,
		  COALESCE(o.statement, q.objective_id),
		  COALESCE(o.required_formats[1], 'review')
		FROM spaced_review_queue q
		JOIN students s ON s.id=q.student_id
		JOIN curriculum_objectives o ON o.id=q.objective_id
		LEFT JOIN active_release ON TRUE
		WHERE s.external_ref=$1
		  AND q.completed_at IS NULL
		  AND q.due_at <= now()
		  AND (active_release.id IS NULL OR o.content_release_id=active_release.id)
		  AND EXISTS (
			SELECT 1 FROM activities a
			WHERE a.objective_id=q.objective_id
			  AND a.status IN ('approved','published','live')
			  AND (active_release.id IS NULL OR a.content_release_id=active_release.id)
			  AND EXISTS (
				SELECT 1 FROM questions question
				WHERE question.status IN ('approved','published','live')
				  AND (active_release.id IS NULL OR question.content_release_id=active_release.id)
				  AND (question.activity_id=a.id OR (question.activity_id IS NULL AND question.objective_id=a.objective_id))
			  )
		  )
		ORDER BY q.priority DESC, q.due_at ASC, q.objective_id
		LIMIT $2
	`, studentID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := []WarmUpItem{}
	for rows.Next() {
		var objectiveID, reason, statement, format string
		var dueAt time.Time
		var priority int
		if err := rows.Scan(&objectiveID, &dueAt, &priority, &reason, &statement, &format); err != nil {
			return nil, err
		}
		items = append(items, WarmUpItem{
			ObjectiveID:    objectiveID,
			Prompt:         statement,
			Format:         format,
			Reason:         reason,
			DueAt:          dueAt.UTC().Format(time.RFC3339),
			Priority:       priority,
			AnimationHook:  "",
			CompanionNudge: reason,
		})
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return items, nil
}

func (r *PostgresRepository) EvidenceSummary(ctx context.Context, studentID string) (EvidenceSummary, error) {
	summary := EvidenceSummary{
		StudentID: studentID,
		Bands:     map[string]int{},
		UpdatedAt: time.Now().UTC().Format(time.RFC3339),
	}
	if studentID == "" {
		return summary, nil
	}

	studentUUID, err := r.studentUUID(ctx, studentID)
	if errors.Is(err, pgx.ErrNoRows) {
		return summary, nil
	}
	if err != nil {
		return summary, err
	}

	var bandsRaw []byte
	if err := r.db.QueryRow(ctx, `
		WITH recent_attempts AS (
			SELECT
				count(*)::int AS attempts,
				count(*) FILTER (WHERE correct)::int AS correct
			FROM question_attempts
			WHERE student_id=$1
			  AND mock_assessment_id IS NULL
			  AND created_at >= now() - interval '7 days'
		), review_counts AS (
			SELECT
				count(*) FILTER (WHERE completed_at IS NULL AND due_at <= now())::int AS due,
				count(*) FILTER (WHERE completed_at IS NULL)::int AS open
			FROM spaced_review_queue
			WHERE student_id=$1
		), repaired_misconceptions AS (
			SELECT count(*)::int AS repaired
			FROM student_misconception_state
			WHERE student_id=$1
			  AND status='repaired'
			  AND repaired_at >= now() - interval '7 days'
		), teacher_evidence AS (
			SELECT count(*)::int AS recorded
			FROM teacher_evidence_records
			WHERE student_id=$1
		), active_interventions AS (
			SELECT count(*)::int AS active
			FROM intervention_plans
			WHERE student_id=$1
			  AND status IN ('active','monitoring')
		), mastery_bands AS (
			SELECT COALESCE(jsonb_object_agg(band, band_count), '{}'::jsonb) AS bands
			FROM (
				SELECT band, count(*)::int AS band_count
				FROM student_objective_mastery
				WHERE student_id=$1
				GROUP BY band
			) grouped
		)
		SELECT
			recent_attempts.attempts,
			recent_attempts.correct,
			COALESCE(round(100.0 * recent_attempts.correct / NULLIF(recent_attempts.attempts, 0)), 0)::int,
			review_counts.due,
			review_counts.open,
			repaired_misconceptions.repaired,
			teacher_evidence.recorded,
			active_interventions.active,
			mastery_bands.bands
		FROM recent_attempts
		CROSS JOIN review_counts
		CROSS JOIN repaired_misconceptions
		CROSS JOIN teacher_evidence
		CROSS JOIN active_interventions
		CROSS JOIN mastery_bands
	`, studentUUID).Scan(&summary.Attempts7Days, &summary.Correct7Days, &summary.Accuracy7Days,
		&summary.DueReviews, &summary.OpenReviews, &summary.MisconceptionsRepaired,
		&summary.TeacherEvidenceCount, &summary.ActiveInterventions, &bandsRaw); err != nil {
		return summary, err
	}
	if err := json.Unmarshal(bandsRaw, &summary.Bands); err != nil {
		return summary, err
	}
	return summary, nil
}

func (r *PostgresRepository) WorldState(ctx context.Context, studentID string, worldKey string) (WorldState, error) {
	if worldKey == "" {
		worldKey = "inventor-wilds"
	}
	state := WorldState{
		StudentID: studentID,
		WorldKey:  worldKey,
		State:     map[string]any{},
		UpdatedAt: time.Now().UTC().Format(time.RFC3339),
	}
	if studentID == "" {
		return state, nil
	}

	studentUUID, err := r.studentUUID(ctx, studentID)
	if errors.Is(err, pgx.ErrNoRows) {
		return state, nil
	}
	if err != nil {
		return state, err
	}

	var raw []byte
	var updatedAt time.Time
	err = r.db.QueryRow(ctx, `
		SELECT state, updated_at
		FROM student_world_state
		WHERE student_id=$1 AND world_key=$2
	`, studentUUID, worldKey).Scan(&raw, &updatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return state, nil
	}
	if err != nil {
		return state, err
	}
	if err := json.Unmarshal(raw, &state.State); err != nil {
		return state, err
	}
	state.UpdatedAt = updatedAt.UTC().Format(time.RFC3339)
	return state, nil
}

func (r *PostgresRepository) Diagnostics(ctx context.Context) (Diagnostics, error) {
	out := Diagnostics{Persistence: "postgres", ReviewQueueStatus: "unknown"}
	var lastAttempt, lastMigration *time.Time
	err := r.db.QueryRow(ctx, `
		SELECT
			(SELECT COALESCE(max(version), 'none') FROM schema_migrations),
			(SELECT count(*)::int FROM students),
			(SELECT count(*)::int FROM question_attempts),
			(SELECT count(*)::int FROM spaced_review_queue WHERE completed_at IS NULL),
			(SELECT count(*)::int FROM student_world_state),
			(SELECT max(created_at) FROM question_attempts),
			(SELECT max(applied_at) FROM schema_migrations),
			(
				SELECT CASE
					WHEN count(*) = count(DISTINCT (student_id, objective_id)) THEN 'deduped'
					ELSE 'duplicates-present'
				END
				FROM spaced_review_queue
				WHERE completed_at IS NULL
			)
	`).Scan(
		&out.SchemaVersion,
		&out.Students,
		&out.Attempts,
		&out.OpenReviews,
		&out.WorldStates,
		&lastAttempt,
		&lastMigration,
		&out.ReviewQueueStatus,
	)
	if err != nil {
		return out, err
	}
	if lastAttempt != nil {
		out.LastAttemptAt = lastAttempt.UTC().Format(time.RFC3339)
	}
	if lastMigration != nil {
		out.LastMigrationAt = lastMigration.UTC().Format(time.RFC3339)
	}
	return out, nil
}
