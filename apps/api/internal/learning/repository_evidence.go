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

// StudentIdentity is an indexed point read, not an administrative pupil-list
// scan. Enrolment identity must stay separate from a selected learning world.
func (r *PostgresRepository) StudentIdentity(ctx context.Context, studentID string) (StudentProfileConfig, bool, error) {
	if studentID == "" {
		return StudentProfileConfig{}, false, nil
	}
	var student StudentProfileConfig
	err := r.db.QueryRow(ctx, `SELECT external_ref, display_name, year_group FROM students WHERE external_ref=$1`, studentID).
		Scan(&student.ExternalRef, &student.DisplayName, &student.YearGroup)
	if errors.Is(err, pgx.ErrNoRows) {
		return StudentProfileConfig{}, false, nil
	}
	if err != nil {
		return StudentProfileConfig{}, false, err
	}
	return student, true, nil
}

func (r *PostgresRepository) StudentYear(ctx context.Context, studentID string) (int, bool, error) {
	if studentID == "" {
		return 0, false, nil
	}
	var year int
	err := r.db.QueryRow(ctx, `SELECT year_group FROM students WHERE external_ref=$1 ORDER BY created_at LIMIT 1`, studentID).Scan(&year)
	if errors.Is(err, pgx.ErrNoRows) {
		return 0, false, nil
	}
	if err != nil {
		return 0, false, err
	}
	return year, true, nil
}

func (r *PostgresRepository) studentUUID(ctx context.Context, externalID string) (string, error) {
	var id string
	err := r.db.QueryRow(ctx, `SELECT id::text FROM students WHERE external_ref=$1 ORDER BY created_at LIMIT 1`, externalID).Scan(&id)
	return id, err
}

func (r *PostgresRepository) currentMasteryScore(ctx context.Context, exec queryExecutor, studentUUID string, objectiveID string) (int, error) {
	var score int
	err := exec.QueryRow(ctx, `
		SELECT score
		FROM student_objective_mastery
		WHERE student_id=$1 AND objective_id=$2
		FOR UPDATE
	`, studentUUID, objectiveID).Scan(&score)
	if errors.Is(err, pgx.ErrNoRows) {
		return 0, nil
	}
	return score, err
}

func (r *PostgresRepository) nextReviewDaysForObjective(ctx context.Context, exec queryExecutor, objectiveID string, score int) (int, error) {
	var expected, secure int
	var retentionDays []int
	err := exec.QueryRow(ctx, `
		SELECT expected_mastery, secure_mastery, retention_days
		FROM curriculum_objectives
		WHERE id=$1
	`, objectiveID).Scan(&expected, &secure, &retentionDays)
	if err != nil {
		return 0, err
	}
	return selectRetentionInterval(score, expected, secure, retentionDays), nil
}

func selectRetentionInterval(score, expected, secure int, days []int) int {
	if len(days) == 0 {
		return nextReviewDays(score)
	}
	sorted := append([]int(nil), days...)
	for i := 1; i < len(sorted); i++ {
		for j := i; j > 0 && sorted[j] < sorted[j-1]; j-- {
			sorted[j], sorted[j-1] = sorted[j-1], sorted[j]
		}
	}
	switch {
	case score >= secure:
		return sorted[len(sorted)-1]
	case score >= expected:
		return sorted[maxInt(0, len(sorted)-2)]
	case score >= 60:
		return sorted[len(sorted)/2]
	default:
		return sorted[0]
	}
}

func (r *PostgresRepository) updateMisconceptionState(ctx context.Context, exec queryExecutor, studentUUID string, attempt Attempt, result AttemptResult) error {
	if attempt.QuestionID == "" {
		return nil
	}
	var key string
	err := exec.QueryRow(ctx, `
		SELECT COALESCE(NULLIF(body->>'misconception_tag', ''), NULLIF(body->>'misconception', ''), '')
		FROM questions
		WHERE id=$1
	`, attempt.QuestionID).Scan(&key)
	if errors.Is(err, pgx.ErrNoRows) || key == "" {
		return nil
	}
	if err != nil {
		return err
	}
	if !result.Correct {
		_, err = exec.Exec(ctx, `
			INSERT INTO student_misconception_state (
				student_id, objective_id, misconception_key, status, evidence_count,
				repair_evidence_count, last_question_id, last_evidence_at, repaired_at
			)
			VALUES ($1,$2,$3,'confirmed',1,0,$4,now(),NULL)
			ON CONFLICT (student_id, objective_id, misconception_key) DO UPDATE SET
				status = CASE
					WHEN student_misconception_state.status = 'repaired' THEN 'reopened'
					ELSE 'confirmed'
				END,
				evidence_count = student_misconception_state.evidence_count + 1,
				repair_evidence_count = 0,
				repair_question_ids = '{}',
				repair_formats = '{}',
				last_question_id = EXCLUDED.last_question_id,
				last_evidence_at = now(),
				repaired_at = NULL
		`, studentUUID, attempt.ObjectiveID, key, attempt.QuestionID)
		return err
	}
	var questionIDs, formats []string
	err = exec.QueryRow(ctx, `
		SELECT repair_question_ids, repair_formats
		FROM student_misconception_state
		WHERE student_id=$1
		  AND objective_id=$2
		  AND misconception_key=$3
		  AND status IN ('suspected', 'confirmed', 'repairing', 'reopened')
	`, studentUUID, attempt.ObjectiveID, key).Scan(&questionIDs, &formats)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil
	}
	if err != nil {
		return err
	}
	questionIDs = appendUnique(questionIDs, attempt.QuestionID)
	formats = appendUnique(formats, attemptFormat(attempt))
	repaired := contrastingRepairSatisfied(questionIDs, formats)
	status := "repairing"
	var repairedAt *time.Time
	if repaired {
		status = "repaired"
		now := time.Now().UTC()
		repairedAt = &now
	}
	_, err = exec.Exec(ctx, `
		UPDATE student_misconception_state
		SET repair_evidence_count = $5,
			repair_question_ids = $6,
			repair_formats = $7,
			status = $8,
			last_question_id = $4,
			last_evidence_at = now(),
			repaired_at = $9
		WHERE student_id=$1
		  AND objective_id=$2
		  AND misconception_key=$3
		  AND status IN ('suspected', 'confirmed', 'repairing', 'reopened')
	`, studentUUID, attempt.ObjectiveID, key, attempt.QuestionID, len(questionIDs), questionIDs, formats, status, repairedAt)
	return err
}

func (r *PostgresRepository) completeMatchingReview(ctx context.Context, exec queryExecutor, studentUUID string, objectiveID string) (bool, error) {
	tag, err := exec.Exec(ctx, `
		UPDATE spaced_review_queue
		SET completed_at = now()
		WHERE id = (
			SELECT id
			FROM spaced_review_queue
			WHERE student_id=$1
			  AND objective_id=$2
			  AND completed_at IS NULL
			  AND due_at <= now()
			ORDER BY due_at ASC, created_at ASC
			LIMIT 1
		)
	`, studentUUID, objectiveID)
	return tag.RowsAffected() > 0, err
}

func (r *PostgresRepository) refreshEvidenceConfidence(ctx context.Context, exec queryExecutor, studentUUID string, objectiveID string, score int) (string, string, error) {
	rows, err := exec.Query(ctx, `
		SELECT correct, hint_used, assistance_used, retention_review, response_format, recorded_at
		FROM mastery_history
		WHERE student_id=$1 AND objective_id=$2
		ORDER BY recorded_at DESC
	`, studentUUID, objectiveID)
	if err != nil {
		return "", "", err
	}
	defer rows.Close()
	signals := []evidenceSignal{}
	for rows.Next() {
		var signal evidenceSignal
		if err := rows.Scan(&signal.Correct, &signal.HintUsed, &signal.AssistanceUsed, &signal.RetentionReview, &signal.Format, &signal.RecordedAt); err != nil {
			return "", "", err
		}
		signals = append(signals, signal)
	}
	if err := rows.Err(); err != nil {
		return "", "", err
	}
	summary := summariseEvidence(signals, time.Now().UTC())
	confidence := evidenceConfidenceBand(summary.EffectiveScore, summary.FormatCount, summary.IndependentCorrect, summary.RetainedSuccess, summary.Freshness)
	band := evidenceAdjustedMasteryBand(score, confidence)
	_, err = exec.Exec(ctx, `
		UPDATE student_objective_mastery
		SET evidence_count=$3,
			format_count=$4,
			independent_correct_count=$5,
			retained_success_count=$6,
			evidence_confidence=$7,
			band=$8,
			effective_evidence_score=$9,
			evidence_freshness=$10,
			last_evidence_at=$11,
			updated_at=now()
		WHERE student_id=$1 AND objective_id=$2
	`, studentUUID, objectiveID, summary.EvidenceCount, summary.FormatCount, summary.IndependentCorrect,
		summary.RetainedSuccess, confidence, band, summary.EffectiveScore, summary.Freshness, summary.LastEvidenceAt)
	return confidence, band, err
}

type evidenceSignal struct {
	Correct         bool
	HintUsed        bool
	AssistanceUsed  []string
	RetentionReview bool
	Format          string
	RecordedAt      time.Time
}

type evidenceRecencySummary struct {
	EvidenceCount      int
	FormatCount        int
	IndependentCorrect int
	RetainedSuccess    int
	EffectiveScore     float64
	Freshness          string
	LastEvidenceAt     *time.Time
}

func summariseEvidence(signals []evidenceSignal, now time.Time) evidenceRecencySummary {
	summary := evidenceRecencySummary{EvidenceCount: len(signals), Freshness: "stale"}
	formats := map[string]bool{}
	for _, signal := range signals {
		age := now.Sub(signal.RecordedAt)
		if age < 0 {
			age = 0
		}
		summary.EffectiveScore += evidenceRecencyWeight(age)
		if signal.Format != "" {
			formats[signal.Format] = true
		}
		if signal.Correct && !usesAnswerRevealingAssistance(signal.AssistanceUsed, signal.HintUsed) {
			summary.IndependentCorrect++
		}
		if signal.Correct && signal.RetentionReview {
			summary.RetainedSuccess++
		}
		if summary.LastEvidenceAt == nil || signal.RecordedAt.After(*summary.LastEvidenceAt) {
			recorded := signal.RecordedAt
			summary.LastEvidenceAt = &recorded
		}
	}
	summary.FormatCount = len(formats)
	if summary.LastEvidenceAt != nil {
		age := now.Sub(*summary.LastEvidenceAt)
		switch {
		case age <= 30*24*time.Hour:
			summary.Freshness = "current"
		case age <= 90*24*time.Hour:
			summary.Freshness = "aging"
		}
	}
	return summary
}

func evidenceRecencyWeight(age time.Duration) float64 {
	switch {
	case age <= 14*24*time.Hour:
		return 1
	case age <= 30*24*time.Hour:
		return 0.75
	case age <= 60*24*time.Hour:
		return 0.5
	case age <= 120*24*time.Hour:
		return 0.25
	default:
		return 0.1
	}
}

func evidenceConfidenceBand(effectiveScore float64, formatCount, independentCorrect, retainedSuccess int, freshness string) string {
	switch {
	case effectiveScore >= 8 && formatCount >= 2 && independentCorrect >= 5 && retainedSuccess >= 1 && freshness == "current":
		return "strong"
	case effectiveScore >= 5 && formatCount >= 2 && independentCorrect >= 3 && freshness != "stale":
		return "supported"
	case effectiveScore >= 3:
		return "emerging"
	default:
		return "limited"
	}
}

func appendUnique(values []string, value string) []string {
	if value == "" {
		return values
	}
	for _, item := range values {
		if item == value {
			return values
		}
	}
	return append(values, value)
}

func contrastingRepairSatisfied(questionIDs, formats []string) bool {
	return len(questionIDs) >= 3 || (len(questionIDs) >= 2 && len(formats) >= 2)
}

func evidenceAdjustedMasteryBand(score int, confidence string) string {
	if score >= 90 && confidence != "strong" {
		return "Expected standard"
	}
	return MasteryBand(score)
}

func (r *PostgresRepository) updateWorldState(ctx context.Context, exec queryExecutor, studentUUID, studentID, objectiveID string, result AttemptResult) error {
	worldKey, err := r.worldKeyForObjective(ctx, exec, objectiveID)
	if err != nil {
		return err
	}
	state := map[string]any{}
	if _, err := exec.Exec(ctx, `
		INSERT INTO student_world_state (student_id, world_key, state, updated_at)
		VALUES ($1,$2,'{}'::jsonb,now())
		ON CONFLICT (student_id, world_key) DO NOTHING
	`, studentUUID, worldKey); err != nil {
		return err
	}
	var existing []byte
	err = exec.QueryRow(ctx, `
		SELECT state
		FROM student_world_state
		WHERE student_id=$1 AND world_key=$2
		FOR UPDATE
	`, studentUUID, worldKey).Scan(&existing)
	if err == nil {
		if unmarshalErr := json.Unmarshal(existing, &state); unmarshalErr != nil {
			return unmarshalErr
		}
	} else if !errors.Is(err, pgx.ErrNoRows) {
		return err
	}

	state["student_id"] = studentID
	state["world_key"] = worldKey
	state["last_objective_id"] = objectiveID
	state["last_animation"] = result.AnimationHook
	state["last_reward"] = result.RewardHook
	state["mastery_score"] = result.ProjectedScore
	state["mastery_band"] = result.ProjectedBand
	state["updated_at"] = time.Now().UTC().Format(time.RFC3339)
	state["completed_attempts"] = intFromAny(state["completed_attempts"]) + 1
	if result.Correct {
		state["progress_level"] = maxInt(1, result.ProjectedScore/20)
		state["reward_state"] = "progress"
		state["companion_energy"] = result.ProjectedScore
		state["successful_attempts"] = intFromAny(state["successful_attempts"]) + 1
		state["repair_mode"] = false
		if result.RewardHook != "" {
			artefacts := stringSliceFromAny(state["artefacts"])
			if !containsStringValue(artefacts, result.RewardHook) {
				artefacts = append(artefacts, result.RewardHook)
			}
			if len(artefacts) > 50 {
				artefacts = artefacts[len(artefacts)-50:]
			}
			state["artefacts"] = artefacts
		}
	} else {
		state["repair_mode"] = true
		state["reward_state"] = "repair"
		state["companion_energy"] = maxInt(20, result.ProjectedScore)
		state["repair_attempts"] = intFromAny(state["repair_attempts"]) + 1
	}
	raw, err := json.Marshal(state)
	if err != nil {
		return err
	}
	_, err = exec.Exec(ctx, `
		INSERT INTO student_world_state (student_id, world_key, state, updated_at)
		VALUES ($1,$2,$3::jsonb,now())
		ON CONFLICT (student_id, world_key) DO UPDATE SET
			state = EXCLUDED.state,
			updated_at = now()
	`, studentUUID, worldKey, string(raw))
	return err
}

func intFromAny(value any) int {
	switch typed := value.(type) {
	case int:
		return typed
	case float64:
		return int(typed)
	case json.Number:
		n, _ := typed.Int64()
		return int(n)
	default:
		return 0
	}
}

func stringSliceFromAny(value any) []string {
	items, ok := value.([]any)
	if !ok {
		if strings, ok := value.([]string); ok {
			return append([]string(nil), strings...)
		}
		return []string{}
	}
	out := make([]string, 0, len(items))
	for _, item := range items {
		if text, ok := item.(string); ok && text != "" {
			out = append(out, text)
		}
	}
	return out
}

func containsStringValue(values []string, target string) bool {
	for _, value := range values {
		if value == target {
			return true
		}
	}
	return false
}

func (r *PostgresRepository) applyRewardPolicy(ctx context.Context, exec queryExecutor, objectiveID string, result AttemptResult) (AttemptResult, error) {
	worldKey, err := r.worldKeyForObjective(ctx, exec, objectiveID)
	if err != nil {
		return result, err
	}
	trigger := "attempt.incorrect"
	if result.Correct {
		trigger = "attempt.correct"
	}
	var raw []byte
	err = exec.QueryRow(ctx, `
		SELECT reward_payload
		FROM reward_rules
		WHERE enabled
		  AND trigger=$1
		  AND (objective_id=$2 OR objective_id IS NULL)
		  AND (world_key=$3 OR world_key IS NULL)
		ORDER BY
		  CASE WHEN objective_id=$2 THEN 0 ELSE 1 END,
		  CASE WHEN world_key=$3 THEN 0 ELSE 1 END,
		  updated_at DESC,
		  id
		LIMIT 1
	`, trigger, objectiveID, worldKey).Scan(&raw)
	if errors.Is(err, pgx.ErrNoRows) {
		return result, nil
	}
	if err != nil {
		return result, err
	}
	var payload map[string]any
	if err := json.Unmarshal(raw, &payload); err != nil {
		return result, err
	}
	result.RewardHook = mapText(payload, "reward_hook", result.RewardHook)
	result.AnimationHook = mapText(payload, "animation_hook", result.AnimationHook)
	result.Feedback = mapText(payload, "feedback", result.Feedback)
	result.Explanation = mapText(payload, "explanation", result.Explanation)
	result.EvidenceEvent = mapText(payload, "evidence_event", result.EvidenceEvent)
	result.CompanionPrompt = mapText(payload, "companion_prompt", result.CompanionPrompt)
	return result, nil
}

func (r *PostgresRepository) ensureObjective(ctx context.Context, exec queryExecutor, objectiveID string) error {
	var exists bool
	err := exec.QueryRow(ctx, `SELECT EXISTS (SELECT 1 FROM curriculum_objectives WHERE id=$1)`, objectiveID).Scan(&exists)
	if err != nil {
		return err
	}
	if !exists {
		return errors.New("objective is not configured")
	}
	return nil
}

func (r *PostgresRepository) worldKeyForObjective(ctx context.Context, exec queryExecutor, objectiveID string) (string, error) {
	var worldKey string
	err := exec.QueryRow(ctx, `
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

	err = exec.QueryRow(ctx, `
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

	err = exec.QueryRow(ctx, `
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
		delta := -4
		if attempt.Confidence >= 4 {
			delta--
		}
		return delta
	}
	if usesAnswerRevealingAssistance(attempt.AssistanceUsed, attempt.HintUsed) {
		return maxInt(result.MasteryDelta, 1)
	}
	delta := 6
	if attempt.HintUsed {
		delta -= 2
	}
	if attempt.Confidence > 0 && attempt.Confidence < 3 {
		delta--
	}
	return maxInt(delta, 1)
}

func maxInt(a, b int) int {
	if a > b {
		return a
	}
	return b
}

func mapText(values map[string]any, key string, fallback string) string {
	value, ok := values[key]
	if !ok {
		return fallback
	}
	text, ok := value.(string)
	if !ok || text == "" {
		return fallback
	}
	return text
}

func attemptFormat(attempt Attempt) string {
	if strings.TrimSpace(attempt.Format) != "" {
		return strings.ToLower(strings.TrimSpace(attempt.Format))
	}
	if attempt.ExpectedText != "" {
		return "text-choice"
	}
	return "timed-recall"
}

func attemptResponseMode(attempt Attempt) string {
	switch strings.ToLower(strings.TrimSpace(attempt.ResponseMode)) {
	case "keyboard", "interactive":
		return strings.ToLower(strings.TrimSpace(attempt.ResponseMode))
	default:
		return "interactive"
	}
}

func expectedAnswerText(attempt Attempt) string {
	if attempt.ExpectedText != "" {
		return attempt.ExpectedText
	}
	return strconv.Itoa(attempt.Expected)
}

func givenAnswerText(attempt Attempt) string {
	if attempt.ExpectedText != "" {
		return attempt.GivenText
	}
	return strconv.Itoa(attempt.Given)
}
