package learning

import (
	"context"
	"encoding/json"
	"errors"
	"log/slog"
	"strconv"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Repository interface {
	RecordAttempt(ctx context.Context, attempt Attempt, result AttemptResult) (AttemptResult, error)
	ListMastery(ctx context.Context, studentID string) ([]StudentMastery, error)
	RecentAttempts(ctx context.Context, studentID string, limit int) ([]RecentAttempt, error)
	WarmUpItems(ctx context.Context, studentID string, limit int) ([]WarmUpItem, error)
	EvidenceSummary(ctx context.Context, studentID string) (EvidenceSummary, error)
	WorldState(ctx context.Context, studentID string, worldKey string) (WorldState, error)
	StartSession(ctx context.Context, studentID string, mode string, deviceTier string) (LearningSession, error)
	Diagnostics(ctx context.Context) (Diagnostics, error)
	ListObjectives(ctx context.Context) ([]Objective, error)
	GetObjective(ctx context.Context, id string) (Objective, bool, error)
	UpsertObjective(ctx context.Context, objective Objective) (Objective, error)
	ListFeatureFlags(ctx context.Context) ([]FeatureFlag, error)
	UpsertFeatureFlag(ctx context.Context, flag FeatureFlag) (FeatureFlag, error)
	ListWorlds(ctx context.Context) ([]WorldConfig, error)
	UpsertWorld(ctx context.Context, world WorldConfig) (WorldConfig, error)
	ListActivities(ctx context.Context) ([]ActivityConfig, error)
	UpsertActivity(ctx context.Context, activity ActivityConfig) (ActivityConfig, error)
	ListQuestions(ctx context.Context) ([]QuestionConfig, error)
	UpsertQuestion(ctx context.Context, question QuestionConfig) (QuestionConfig, error)
	ListAuditLogs(ctx context.Context, limit int) ([]AuditLog, error)
}

type NoopRepository struct{}

func (NoopRepository) RecordAttempt(_ context.Context, _ Attempt, result AttemptResult) (AttemptResult, error) {
	return result, nil
}

func (NoopRepository) ListMastery(_ context.Context, studentID string) ([]StudentMastery, error) {
	return []StudentMastery{}, nil
}

func (NoopRepository) RecentAttempts(_ context.Context, studentID string, limit int) ([]RecentAttempt, error) {
	return []RecentAttempt{}, nil
}

func (NoopRepository) WarmUpItems(_ context.Context, studentID string, limit int) ([]WarmUpItem, error) {
	return []WarmUpItem{}, nil
}

func (NoopRepository) EvidenceSummary(_ context.Context, studentID string) (EvidenceSummary, error) {
	return EvidenceSummary{
		StudentID: studentID,
		Bands:     map[string]int{},
	}, nil
}

func (NoopRepository) WorldState(_ context.Context, studentID string, worldKey string) (WorldState, error) {
	return WorldState{
		StudentID: studentID,
		WorldKey:  worldKey,
		State:     map[string]any{},
	}, nil
}

func (NoopRepository) StartSession(_ context.Context, studentID string, mode string, deviceTier string) (LearningSession, error) {
	if mode == "" {
		mode = "home"
	}
	if deviceTier == "" {
		deviceTier = "unknown"
	}
	return LearningSession{
		StudentID:  studentID,
		Mode:       mode,
		DeviceTier: deviceTier,
	}, nil
}

func (NoopRepository) Diagnostics(context.Context) (Diagnostics, error) {
	return Diagnostics{
		Persistence:       "memory",
		SchemaVersion:     "not_configured",
		ReviewQueueStatus: "not_configured",
	}, nil
}

func (NoopRepository) ListObjectives(context.Context) ([]Objective, error) {
	return []Objective{}, nil
}

func (NoopRepository) GetObjective(_ context.Context, id string) (Objective, bool, error) {
	return Objective{}, false, nil
}

func (NoopRepository) UpsertObjective(_ context.Context, objective Objective) (Objective, error) {
	return objective, nil
}

func (NoopRepository) ListFeatureFlags(context.Context) ([]FeatureFlag, error) {
	return []FeatureFlag{}, nil
}

func (NoopRepository) UpsertFeatureFlag(_ context.Context, flag FeatureFlag) (FeatureFlag, error) {
	return flag, nil
}

func (NoopRepository) ListWorlds(context.Context) ([]WorldConfig, error) {
	return []WorldConfig{}, nil
}

func (NoopRepository) UpsertWorld(_ context.Context, world WorldConfig) (WorldConfig, error) {
	return world, nil
}

func (NoopRepository) ListActivities(context.Context) ([]ActivityConfig, error) {
	return []ActivityConfig{}, nil
}

func (NoopRepository) UpsertActivity(_ context.Context, activity ActivityConfig) (ActivityConfig, error) {
	return activity, nil
}

func (NoopRepository) ListQuestions(context.Context) ([]QuestionConfig, error) {
	return []QuestionConfig{}, nil
}

func (NoopRepository) UpsertQuestion(_ context.Context, question QuestionConfig) (QuestionConfig, error) {
	return question, nil
}

func (NoopRepository) ListAuditLogs(context.Context, int) ([]AuditLog, error) {
	return []AuditLog{}, nil
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

func (r *PostgresRepository) RecordAttempt(ctx context.Context, attempt Attempt, result AttemptResult) (AttemptResult, error) {
	if attempt.StudentID == "" || attempt.ObjectiveID == "" {
		return result, nil
	}

	studentUUID, err := r.ensureDemoStudent(ctx, attempt.StudentID)
	if err != nil {
		return result, err
	}
	if err := r.ensureObjective(ctx, attempt.ObjectiveID); err != nil {
		return result, err
	}

	priorScore, err := r.currentMasteryScore(ctx, studentUUID, attempt.ObjectiveID)
	if err != nil {
		return result, err
	}
	result.MasteryDelta = cumulativeDelta(attempt, result)
	result.MasteryGain = maxInt(result.MasteryDelta, 0)
	result.ProjectedScore = clamp(priorScore+result.MasteryDelta, 0, 100)
	result.ProjectedBand = MasteryBand(result.ProjectedScore)
	result.NextReviewDays = nextReviewDays(result.ProjectedScore)

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
		return result, err
	}

	if err := r.completeMatchingReview(ctx, studentUUID, attempt.ObjectiveID); err != nil {
		return result, err
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
		return result, err
	}

	if dueAt != nil {
		_, err = r.db.Exec(ctx, `
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
	if err := r.updateWorldState(ctx, studentUUID, attempt.StudentID, attempt.ObjectiveID, result); err != nil {
		return result, err
	}
	return result, nil
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

func (r *PostgresRepository) WarmUpItems(ctx context.Context, studentID string, limit int) ([]WarmUpItem, error) {
	if studentID == "" {
		return []WarmUpItem{}, nil
	}
	if limit <= 0 || limit > 10 {
		limit = 3
	}

	studentUUID, err := r.studentUUID(ctx, studentID)
	if errors.Is(err, pgx.ErrNoRows) {
		return r.configuredWarmUpItems(ctx, limit)
	}
	if err != nil {
		return nil, err
	}

	rows, err := r.db.Query(ctx, `
		SELECT
		  q.objective_id,
		  q.due_at,
		  q.priority,
		  q.reason,
		  COALESCE(o.statement, q.objective_id),
		  COALESCE(o.required_formats[1], 'review')
		FROM spaced_review_queue q
		LEFT JOIN curriculum_objectives o ON o.id = q.objective_id
		WHERE q.student_id=$1
		  AND q.completed_at IS NULL
		  AND q.due_at <= now() + interval '30 days'
		ORDER BY
		  CASE WHEN q.due_at <= now() THEN 0 ELSE 1 END,
		  q.priority DESC,
		  q.due_at ASC
		LIMIT $2
	`, studentUUID, limit)
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
	if len(items) == 0 {
		return r.configuredWarmUpItems(ctx, limit)
	}
	return items, nil
}

func (r *PostgresRepository) configuredWarmUpItems(ctx context.Context, limit int) ([]WarmUpItem, error) {
	rows, err := r.db.Query(ctx, `
		SELECT
			q.objective_id,
			COALESCE(NULLIF(q.body->>'prompt', ''), o.statement, q.objective_id),
			q.format,
			COALESCE(NULLIF(q.body->>'animation_hook', ''), ''),
			COALESCE(NULLIF(q.body->>'companion_nudge', ''), ''),
			q.difficulty
		FROM questions q
		LEFT JOIN curriculum_objectives o ON o.id = q.objective_id
		WHERE q.status IN ('published', 'approved', 'live')
		ORDER BY q.difficulty, q.updated_at DESC, q.id
		LIMIT $1
	`, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items := []WarmUpItem{}
	for rows.Next() {
		var item WarmUpItem
		if err := rows.Scan(&item.ObjectiveID, &item.Prompt, &item.Format, &item.AnimationHook, &item.CompanionNudge, &item.Priority); err != nil {
			return nil, err
		}
		item.Reason = "Selected from published configured question content."
		items = append(items, item)
	}
	return items, rows.Err()
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

	if err := r.db.QueryRow(ctx, `
		SELECT
			count(*)::int,
			count(*) FILTER (WHERE correct)::int,
			COALESCE(round(100.0 * count(*) FILTER (WHERE correct) / NULLIF(count(*), 0)), 0)::int
		FROM question_attempts
		WHERE student_id=$1
		  AND created_at >= now() - interval '7 days'
	`, studentUUID).Scan(&summary.Attempts7Days, &summary.Correct7Days, &summary.Accuracy7Days); err != nil {
		return summary, err
	}

	if err := r.db.QueryRow(ctx, `
		SELECT
			count(*) FILTER (WHERE completed_at IS NULL AND due_at <= now())::int,
			count(*) FILTER (WHERE completed_at IS NULL)::int
		FROM spaced_review_queue
		WHERE student_id=$1
	`, studentUUID).Scan(&summary.DueReviews, &summary.OpenReviews); err != nil {
		return summary, err
	}

	if err := r.db.QueryRow(ctx, `
		SELECT count(*)::int
		FROM question_attempts
		WHERE student_id=$1
		  AND correct
		  AND mastery_delta > 0
		  AND created_at >= now() - interval '7 days'
	`, studentUUID).Scan(&summary.MisconceptionsRepaired); err != nil {
		return summary, err
	}

	rows, err := r.db.Query(ctx, `
		SELECT band, count(*)::int
		FROM student_objective_mastery
		WHERE student_id=$1
		GROUP BY band
	`, studentUUID)
	if err != nil {
		return summary, err
	}
	defer rows.Close()
	for rows.Next() {
		var band string
		var count int
		if err := rows.Scan(&band, &count); err != nil {
			return summary, err
		}
		summary.Bands[band] = count
	}
	return summary, rows.Err()
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

func (r *PostgresRepository) StartSession(ctx context.Context, studentID string, mode string, deviceTier string) (LearningSession, error) {
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

	studentUUID, err := r.ensureDemoStudent(ctx, studentID)
	if err != nil {
		return session, err
	}
	var startedAt time.Time
	err = r.db.QueryRow(ctx, `
		INSERT INTO learning_sessions (student_id, mode, device_tier)
		VALUES ($1,$2,$3)
		RETURNING id::text, started_at
	`, studentUUID, mode, deviceTier).Scan(&session.ID, &startedAt)
	if err != nil {
		return session, err
	}
	session.StartedAt = startedAt.UTC().Format(time.RFC3339)
	return session, nil
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

func (r *PostgresRepository) currentMasteryScore(ctx context.Context, studentUUID string, objectiveID string) (int, error) {
	var score int
	err := r.db.QueryRow(ctx, `
		SELECT score
		FROM student_objective_mastery
		WHERE student_id=$1 AND objective_id=$2
	`, studentUUID, objectiveID).Scan(&score)
	if errors.Is(err, pgx.ErrNoRows) {
		return 50, nil
	}
	return score, err
}

func (r *PostgresRepository) completeMatchingReview(ctx context.Context, studentUUID string, objectiveID string) error {
	_, err := r.db.Exec(ctx, `
		UPDATE spaced_review_queue
		SET completed_at = now()
		WHERE id = (
			SELECT id
			FROM spaced_review_queue
			WHERE student_id=$1
			  AND objective_id=$2
			  AND completed_at IS NULL
			  AND due_at <= now() + interval '30 days'
			ORDER BY due_at ASC, created_at ASC
			LIMIT 1
		)
	`, studentUUID, objectiveID)
	return err
}

func (r *PostgresRepository) updateWorldState(ctx context.Context, studentUUID, studentID, objectiveID string, result AttemptResult) error {
	worldKey, err := r.worldKeyForObjective(ctx, objectiveID)
	if err != nil {
		return err
	}
	state := map[string]any{
		"student_id":        studentID,
		"world_key":         worldKey,
		"last_objective_id": objectiveID,
		"last_animation":    result.AnimationHook,
		"last_reward":       result.RewardHook,
		"mastery_score":     result.ProjectedScore,
		"mastery_band":      result.ProjectedBand,
		"updated_at":        time.Now().UTC().Format(time.RFC3339),
	}
	if result.Correct {
		state["progress_level"] = maxInt(1, result.ProjectedScore/20)
		state["reward_state"] = "progress"
		state["companion_energy"] = result.ProjectedScore
	} else {
		state["repair_mode"] = true
		state["reward_state"] = "repair"
		state["companion_energy"] = maxInt(20, result.ProjectedScore)
	}
	raw, err := json.Marshal(state)
	if err != nil {
		return err
	}
	_, err = r.db.Exec(ctx, `
		INSERT INTO student_world_state (student_id, world_key, state, updated_at)
		VALUES ($1,$2,$3::jsonb,now())
		ON CONFLICT (student_id, world_key) DO UPDATE SET
			state = EXCLUDED.state,
			updated_at = now()
	`, studentUUID, worldKey, string(raw))
	return err
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

func (r *PostgresRepository) worldKeyForObjective(ctx context.Context, objectiveID string) (string, error) {
	var worldKey string
	err := r.db.QueryRow(ctx, `
		SELECT world_key
		FROM activities
		WHERE objective_id=$1
		  AND world_key <> ''
		  AND status IN ('published', 'approved', 'live')
		ORDER BY updated_at DESC, id
		LIMIT 1
	`, objectiveID).Scan(&worldKey)
	if err == nil {
		return worldKey, nil
	}
	if err != nil && !errors.Is(err, pgx.ErrNoRows) {
		return "", err
	}

	err = r.db.QueryRow(ctx, `
		SELECT w.key
		FROM curriculum_objectives o
		JOIN worlds w ON w.year_group = o.year_group
		WHERE o.id=$1
		  AND w.enabled
		ORDER BY w.updated_at DESC, w.key
		LIMIT 1
	`, objectiveID).Scan(&worldKey)
	if err == nil {
		return worldKey, nil
	}
	if err != nil && !errors.Is(err, pgx.ErrNoRows) {
		return "", err
	}

	err = r.db.QueryRow(ctx, `
		SELECT key
		FROM worlds
		WHERE enabled
		ORDER BY updated_at DESC, key
		LIMIT 1
	`).Scan(&worldKey)
	if errors.Is(err, pgx.ErrNoRows) {
		return "unassigned", nil
	}
	return worldKey, err
}

func cumulativeDelta(attempt Attempt, result AttemptResult) int {
	if !result.Correct {
		delta := -3
		if attempt.HintUsed {
			delta--
		}
		if attempt.Confidence >= 4 {
			delta--
		}
		return delta
	}
	delta := 6
	if attempt.MS > 0 && attempt.MS < 5000 {
		delta += 3
	} else if attempt.MS > 9000 {
		delta -= 2
	}
	if attempt.HintUsed {
		delta -= 4
	}
	if attempt.Confidence > 0 && attempt.Confidence < 3 {
		delta -= 2
	}
	return maxInt(delta, 1)
}

func maxInt(a, b int) int {
	if a > b {
		return a
	}
	return b
}
