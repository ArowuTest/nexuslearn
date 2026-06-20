package learning

import (
	"context"
	"encoding/json"
	"errors"
	"strconv"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

var ErrStudentNotFound = errors.New("student is not configured")
var ErrNoDiagnosticObjectives = errors.New("no live diagnostic objectives are available for this year group")

type Repository interface {
	RecordAttempt(ctx context.Context, attempt Attempt, result AttemptResult) (AttemptResult, error)
	ListMastery(ctx context.Context, studentID string) ([]StudentMastery, error)
	RecentAttempts(ctx context.Context, studentID string, limit int) ([]RecentAttempt, error)
	WarmUpItems(ctx context.Context, studentID string, limit int) ([]WarmUpItem, error)
	EvidenceSummary(ctx context.Context, studentID string) (EvidenceSummary, error)
	WorldState(ctx context.Context, studentID string, worldKey string) (WorldState, error)
	StartSession(ctx context.Context, studentID string, mode string, deviceTier string) (LearningSession, error)
	RecordLessonStep(ctx context.Context, attempt LessonStepAttempt) (LessonStepAttempt, error)
	RecordLearningEvent(ctx context.Context, event LearningEvent) (LearningEvent, error)
	ListAssignments(ctx context.Context, schoolURN string, studentExternalRef string) ([]Assignment, error)
	CreateAssignment(ctx context.Context, assignment Assignment) (Assignment, error)
	ListTeacherEvidence(ctx context.Context, schoolURN string, studentExternalRef string) ([]TeacherEvidenceRecord, error)
	CreateTeacherEvidence(ctx context.Context, record TeacherEvidenceRecord) (TeacherEvidenceRecord, error)
	ListInterventions(ctx context.Context, schoolURN string, studentExternalRef string) ([]InterventionPlan, error)
	CreateIntervention(ctx context.Context, plan InterventionPlan) (InterventionPlan, error)
	UpdateInterventionStatus(ctx context.Context, schoolURN string, id string, status string) (InterventionPlan, error)
	ListInterventionReviews(ctx context.Context, schoolURN string, studentExternalRef string) ([]InterventionReview, error)
	CreateInterventionReview(ctx context.Context, review InterventionReview) (InterventionReview, error)
	DiagnosticBaseline(ctx context.Context, studentID string) (DiagnosticBaseline, bool, error)
	CreateDiagnosticBaseline(ctx context.Context, baseline DiagnosticBaseline) (DiagnosticBaseline, error)
	StudentYear(ctx context.Context, studentID string) (int, bool, error)
	ListStudents(ctx context.Context) ([]StudentProfileConfig, error)
	UpsertStudent(ctx context.Context, student StudentProfileConfig) (StudentProfileConfig, error)
	ListSchools(ctx context.Context) ([]SchoolConfig, error)
	UpsertSchool(ctx context.Context, school SchoolConfig) (SchoolConfig, error)
	ListSchoolUsers(ctx context.Context) ([]SchoolUserConfig, error)
	UpsertSchoolUser(ctx context.Context, user SchoolUserConfig) (SchoolUserConfig, error)
	VerifySchoolUser(ctx context.Context, schoolURN string, loginID string, password string) (SchoolUserConfig, bool, error)
	SchoolPortal(ctx context.Context, schoolURN string) (SchoolPortalConfig, error)
	ListClasses(ctx context.Context) ([]ClassConfig, error)
	UpsertClass(ctx context.Context, classConfig ClassConfig) (ClassConfig, error)
	AssignStudentToClass(ctx context.Context, classID string, studentExternalRef string) (ClassConfig, error)
	ListStudentCredentials(ctx context.Context) ([]StudentCredentialConfig, error)
	UpsertStudentCredential(ctx context.Context, credential StudentCredentialConfig) (StudentCredentialConfig, error)
	GenerateClassCredentials(ctx context.Context, classID string, overwrite bool, picturePool []string) (ClassCredentialBatch, error)
	ListGroups(ctx context.Context) ([]LearningGroupConfig, error)
	UpsertGroup(ctx context.Context, group LearningGroupConfig) (LearningGroupConfig, error)
	AssignStudentToGroup(ctx context.Context, groupID string, studentExternalRef string) (LearningGroupConfig, error)
	ListParentLinks(ctx context.Context) ([]ParentLinkConfig, error)
	UpsertParentLink(ctx context.Context, link ParentLinkConfig) (ParentLinkConfig, error)
	UpsertParentAccount(ctx context.Context, parent ParentAccountConfig) (ParentAccountConfig, error)
	VerifyParentUser(ctx context.Context, loginID string, password string) (ParentAccountConfig, bool, error)
	ParentPortal(ctx context.Context, parentLoginID string) (ParentPortalConfig, error)
	UpsertStudentEngagement(ctx context.Context, profile StudentEngagementProfile) (StudentEngagementProfile, error)
	StudentEngagement(ctx context.Context, studentExternalRef string) (StudentEngagementProfile, error)
	ListAccessRequests(ctx context.Context, status string) ([]AccessRequestConfig, error)
	CreateAccessRequest(ctx context.Context, request AccessRequestConfig) (AccessRequestConfig, error)
	UpdateAccessRequestStatus(ctx context.Context, id string, status string) (AccessRequestConfig, error)
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
	ListRewardRules(ctx context.Context) ([]RewardRule, error)
	UpsertRewardRule(ctx context.Context, rule RewardRule) (RewardRule, error)
	ListAuditLogs(ctx context.Context, limit int) ([]AuditLog, error)
	ListContentVersions(ctx context.Context, limit int) ([]ContentVersion, error)
	RestoreContentVersion(ctx context.Context, id string) (ContentVersion, error)
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

func (NoopRepository) RecordLessonStep(_ context.Context, attempt LessonStepAttempt) (LessonStepAttempt, error) {
	return attempt, nil
}

func (NoopRepository) RecordLearningEvent(_ context.Context, event LearningEvent) (LearningEvent, error) {
	return event, nil
}

func (NoopRepository) ListAssignments(context.Context, string, string) ([]Assignment, error) {
	return []Assignment{}, nil
}

func (NoopRepository) CreateAssignment(_ context.Context, assignment Assignment) (Assignment, error) {
	return assignment, nil
}

func (NoopRepository) ListTeacherEvidence(context.Context, string, string) ([]TeacherEvidenceRecord, error) {
	return []TeacherEvidenceRecord{}, nil
}

func (NoopRepository) CreateTeacherEvidence(_ context.Context, record TeacherEvidenceRecord) (TeacherEvidenceRecord, error) {
	return record, nil
}

func (NoopRepository) ListInterventions(context.Context, string, string) ([]InterventionPlan, error) {
	return []InterventionPlan{}, nil
}

func (NoopRepository) CreateIntervention(_ context.Context, plan InterventionPlan) (InterventionPlan, error) {
	return plan, nil
}

func (NoopRepository) UpdateInterventionStatus(_ context.Context, schoolURN string, id string, status string) (InterventionPlan, error) {
	return InterventionPlan{ID: id, SchoolURN: schoolURN, Status: status}, nil
}

func (NoopRepository) ListInterventionReviews(context.Context, string, string) ([]InterventionReview, error) {
	return []InterventionReview{}, nil
}

func (NoopRepository) CreateInterventionReview(_ context.Context, review InterventionReview) (InterventionReview, error) {
	return review, nil
}

func (NoopRepository) DiagnosticBaseline(context.Context, string) (DiagnosticBaseline, bool, error) {
	return DiagnosticBaseline{}, false, nil
}

func (NoopRepository) CreateDiagnosticBaseline(_ context.Context, baseline DiagnosticBaseline) (DiagnosticBaseline, error) {
	if baseline.Status == "" {
		baseline.Status = "in_progress"
	}
	return baseline, nil
}

func (NoopRepository) StudentYear(context.Context, string) (int, bool, error) {
	return 0, false, nil
}

func (NoopRepository) ListStudents(context.Context) ([]StudentProfileConfig, error) {
	return []StudentProfileConfig{}, nil
}

func (NoopRepository) UpsertStudent(_ context.Context, student StudentProfileConfig) (StudentProfileConfig, error) {
	return student, nil
}

func (NoopRepository) ListSchools(context.Context) ([]SchoolConfig, error) {
	return []SchoolConfig{}, nil
}

func (NoopRepository) UpsertSchool(_ context.Context, school SchoolConfig) (SchoolConfig, error) {
	return school, nil
}

func (NoopRepository) ListSchoolUsers(context.Context) ([]SchoolUserConfig, error) {
	return []SchoolUserConfig{}, nil
}

func (NoopRepository) UpsertSchoolUser(_ context.Context, user SchoolUserConfig) (SchoolUserConfig, error) {
	return user, nil
}

func (NoopRepository) VerifySchoolUser(_ context.Context, schoolURN string, loginID string, _ string) (SchoolUserConfig, bool, error) {
	return SchoolUserConfig{SchoolURN: schoolURN, LoginID: loginID}, false, nil
}

func (NoopRepository) SchoolPortal(_ context.Context, schoolURN string) (SchoolPortalConfig, error) {
	return SchoolPortalConfig{School: SchoolConfig{URN: schoolURN}}, nil
}

func (NoopRepository) ListClasses(context.Context) ([]ClassConfig, error) {
	return []ClassConfig{}, nil
}

func (NoopRepository) UpsertClass(_ context.Context, classConfig ClassConfig) (ClassConfig, error) {
	return classConfig, nil
}

func (NoopRepository) AssignStudentToClass(_ context.Context, classID string, _ string) (ClassConfig, error) {
	return ClassConfig{ID: classID}, nil
}

func (NoopRepository) ListStudentCredentials(context.Context) ([]StudentCredentialConfig, error) {
	return []StudentCredentialConfig{}, nil
}

func (NoopRepository) UpsertStudentCredential(_ context.Context, credential StudentCredentialConfig) (StudentCredentialConfig, error) {
	return credential, nil
}

func (NoopRepository) GenerateClassCredentials(_ context.Context, classID string, overwrite bool, picturePool []string) (ClassCredentialBatch, error) {
	return ClassCredentialBatch{ClassID: classID, Overwrite: overwrite, PicturePool: picturePool}, nil
}

func (NoopRepository) ListGroups(context.Context) ([]LearningGroupConfig, error) {
	return []LearningGroupConfig{}, nil
}

func (NoopRepository) UpsertGroup(_ context.Context, group LearningGroupConfig) (LearningGroupConfig, error) {
	return group, nil
}

func (NoopRepository) AssignStudentToGroup(_ context.Context, groupID string, studentExternalRef string) (LearningGroupConfig, error) {
	return LearningGroupConfig{ID: groupID, Students: []StudentProfileConfig{{ExternalRef: studentExternalRef}}}, nil
}

func (NoopRepository) ListParentLinks(context.Context) ([]ParentLinkConfig, error) {
	return []ParentLinkConfig{}, nil
}

func (NoopRepository) UpsertParentLink(_ context.Context, link ParentLinkConfig) (ParentLinkConfig, error) {
	return link, nil
}

func (NoopRepository) UpsertParentAccount(_ context.Context, parent ParentAccountConfig) (ParentAccountConfig, error) {
	return parent, nil
}

func (NoopRepository) VerifyParentUser(_ context.Context, loginID string, _ string) (ParentAccountConfig, bool, error) {
	return ParentAccountConfig{LoginID: loginID}, false, nil
}

func (NoopRepository) ParentPortal(_ context.Context, parentLoginID string) (ParentPortalConfig, error) {
	return ParentPortalConfig{Parent: ParentAccountConfig{LoginID: parentLoginID}}, nil
}

func (NoopRepository) UpsertStudentEngagement(_ context.Context, profile StudentEngagementProfile) (StudentEngagementProfile, error) {
	return profile, nil
}

func (NoopRepository) StudentEngagement(_ context.Context, studentExternalRef string) (StudentEngagementProfile, error) {
	return defaultStudentEngagement(studentExternalRef), nil
}

func (NoopRepository) ListAccessRequests(context.Context, string) ([]AccessRequestConfig, error) {
	return []AccessRequestConfig{}, nil
}

func (NoopRepository) CreateAccessRequest(_ context.Context, request AccessRequestConfig) (AccessRequestConfig, error) {
	return request, nil
}

func (NoopRepository) UpdateAccessRequestStatus(_ context.Context, id string, status string) (AccessRequestConfig, error) {
	return AccessRequestConfig{ID: id, Status: status}, nil
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

func (NoopRepository) ListRewardRules(context.Context) ([]RewardRule, error) {
	return []RewardRule{}, nil
}

func (NoopRepository) UpsertRewardRule(_ context.Context, rule RewardRule) (RewardRule, error) {
	return rule, nil
}

func (NoopRepository) ListAuditLogs(context.Context, int) ([]AuditLog, error) {
	return []AuditLog{}, nil
}

func (NoopRepository) ListContentVersions(context.Context, int) ([]ContentVersion, error) {
	return []ContentVersion{}, nil
}

func (NoopRepository) RestoreContentVersion(_ context.Context, id string) (ContentVersion, error) {
	return ContentVersion{ID: id}, invalidConfig("content restore requires database persistence")
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

	studentUUID, err := r.studentUUID(ctx, attempt.StudentID)
	if errors.Is(err, pgx.ErrNoRows) {
		return result, ErrStudentNotFound
	}
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
	result.NextReviewDays, err = r.nextReviewDaysForObjective(ctx, attempt.ObjectiveID, result.ProjectedScore)
	if err != nil {
		return result, err
	}
	result, err = r.applyRewardPolicy(ctx, attempt.ObjectiveID, result)
	if err != nil {
		return result, err
	}

	_, err = r.db.Exec(ctx, `
		INSERT INTO question_attempts (
			student_id, objective_id, question_id, format, expected_answer, given_answer,
			correct, response_ms, hint_used, confidence, mastery_delta, explanation, response_mode
		)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NULLIF($10,0),$11,$12,$13)
	`, studentUUID, attempt.ObjectiveID, attempt.QuestionID, attemptFormat(attempt),
		expectedAnswerText(attempt), givenAnswerText(attempt),
		result.Correct, attempt.MS, attempt.HintUsed, attempt.Confidence,
		result.MasteryDelta, result.Explanation, attemptResponseMode(attempt))
	if err != nil {
		return result, err
	}

	var historyID string
	err = r.db.QueryRow(ctx, `
		INSERT INTO mastery_history (
			student_id, objective_id, question_id, prior_score, new_score, mastery_delta,
			correct, hint_used, confidence, response_format, response_mode
		)
		VALUES ($1,$2,NULLIF($3,''),$4,$5,$6,$7,$8,NULLIF($9,0),$10,$11)
		RETURNING id::text
	`, studentUUID, attempt.ObjectiveID, attempt.QuestionID, priorScore, result.ProjectedScore,
		result.MasteryDelta, result.Correct, attempt.HintUsed, attempt.Confidence, attemptFormat(attempt), attemptResponseMode(attempt)).Scan(&historyID)
	if err != nil {
		return result, err
	}
	if err := r.updateMisconceptionState(ctx, studentUUID, attempt, result); err != nil {
		return result, err
	}

	if result.Correct {
		retentionReview, err := r.completeMatchingReview(ctx, studentUUID, attempt.ObjectiveID)
		if err != nil {
			return result, err
		}
		if retentionReview {
			if _, err := r.db.Exec(ctx, `UPDATE mastery_history SET retention_review=true WHERE id=$1`, historyID); err != nil {
				return result, err
			}
		}
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
	if err := r.completeMasteredAssignments(ctx, studentUUID, attempt.ObjectiveID, result.ProjectedScore); err != nil {
		return result, err
	}
	_, adjustedBand, err := r.refreshEvidenceConfidence(ctx, studentUUID, attempt.ObjectiveID, result.ProjectedScore)
	if err != nil {
		return result, err
	}
	result.ProjectedBand = adjustedBand

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
	if err := r.advanceDiagnosticBaseline(ctx, studentUUID, attempt.ObjectiveID, attemptFormat(attempt), result.Correct); err != nil {
		return result, err
	}
	return result, nil
}

func (r *PostgresRepository) completeMasteredAssignments(ctx context.Context, studentUUID string, objectiveID string, score int) error {
	if _, err := r.db.Exec(ctx, `
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
	_, err := r.db.Exec(ctx, `
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

	studentUUID, err := r.studentUUID(ctx, studentID)
	if errors.Is(err, pgx.ErrNoRows) {
		return []StudentMastery{}, nil
	}
	if err != nil {
		return nil, err
	}

	rows, err := r.db.Query(ctx, `
		SELECT objective_id, score, band, last_signal, next_review_due_at,
		       evidence_count, format_count, independent_correct_count,
		       retained_success_count, evidence_confidence,
		       effective_evidence_score, evidence_freshness, last_evidence_at
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

	studentUUID, err := r.studentUUID(ctx, studentID)
	if errors.Is(err, pgx.ErrNoRows) {
		return []RecentAttempt{}, nil
	}
	if err != nil {
		return nil, err
	}

	rows, err := r.db.Query(ctx, `
		SELECT objective_id, question_id, response_mode, correct, response_ms, hint_used, mastery_delta, explanation, created_at
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
			&item.ResponseMode,
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
		FROM student_misconception_state
		WHERE student_id=$1
		  AND status = 'repaired'
		  AND repaired_at >= now() - interval '7 days'
	`, studentUUID).Scan(&summary.MisconceptionsRepaired); err != nil {
		return summary, err
	}

	if err := r.db.QueryRow(ctx, `
		SELECT
			(SELECT count(*)::int FROM teacher_evidence_records WHERE student_id=$1),
			(SELECT count(*)::int FROM intervention_plans WHERE student_id=$1 AND status IN ('active','monitoring'))
	`, studentUUID).Scan(&summary.TeacherEvidenceCount, &summary.ActiveInterventions); err != nil {
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

	studentUUID, err := r.studentUUID(ctx, studentID)
	if errors.Is(err, pgx.ErrNoRows) {
		return session, ErrStudentNotFound
	}
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
	var recordedAt time.Time
	err = r.db.QueryRow(ctx, `
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
	return attempt, nil
}

func (r *PostgresRepository) RecordLearningEvent(ctx context.Context, event LearningEvent) (LearningEvent, error) {
	if event.StudentID == "" || event.EventType == "" {
		return event, invalidConfig("student and event type are required")
	}
	switch event.EventType {
	case "assessment_started", "assessment_completed", "question_seen", "audio_replay", "hint_opened",
		"mission_paused", "mission_resumed", "mission_exited", "mission_restarted",
		"response_mode_changed", "support_changed":
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
	payload, err := json.Marshal(event.Payload)
	if err != nil {
		return event, invalidConfig("learning event payload is not valid")
	}
	var createdAt time.Time
	err = r.db.QueryRow(ctx, `
		INSERT INTO learning_events (student_id, event_type, event_payload)
		VALUES ($1,$2,$3)
		RETURNING id::text, created_at
	`, studentUUID, event.EventType, payload).Scan(&event.ID, &createdAt)
	if err != nil {
		return event, err
	}
	event.CreatedAt = createdAt.UTC().Format(time.RFC3339)
	return event, nil
}

func (r *PostgresRepository) ListAssignments(ctx context.Context, schoolURN string, studentExternalRef string) ([]Assignment, error) {
	rows, err := r.db.Query(ctx, `
		SELECT a.id::text, COALESCE(sch.urn,''), st.external_ref, st.display_name,
		       a.objective_id, COALESCE(a.activity_id,''), a.title, a.priority,
		       a.status, a.due_at, a.created_by, a.created_at, a.updated_at
		FROM assignments a
		JOIN schools sch ON sch.id = a.school_id
		JOIN students st ON st.id = a.student_id
		WHERE ($1 = '' OR sch.urn = $1)
		  AND ($2 = '' OR st.external_ref = $2)
		ORDER BY
		  CASE WHEN a.status = 'active' THEN 0 ELSE 1 END,
		  a.priority DESC,
		  a.due_at NULLS LAST,
		  a.updated_at DESC
	`, schoolURN, studentExternalRef)
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
	var createdAt, updatedAt time.Time
	err := r.db.QueryRow(ctx, `
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
	return assignment, nil
}

func (r *PostgresRepository) ListTeacherEvidence(ctx context.Context, schoolURN string, studentExternalRef string) ([]TeacherEvidenceRecord, error) {
	rows, err := r.db.Query(ctx, `
		SELECT e.id::text, COALESCE(sch.urn,''), st.external_ref, st.display_name,
		       e.objective_id, e.evidence_type, e.outcome, e.note, e.source_ref,
		       e.recorded_by, e.recorded_at
		FROM teacher_evidence_records e
		JOIN schools sch ON sch.id=e.school_id
		JOIN students st ON st.id=e.student_id
		WHERE ($1='' OR sch.urn=$1)
		  AND ($2='' OR st.external_ref=$2)
		ORDER BY e.recorded_at DESC
		LIMIT 200
	`, schoolURN, studentExternalRef)
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
	var recordedAt time.Time
	err := r.db.QueryRow(ctx, `
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
	return record, nil
}

func (r *PostgresRepository) ListInterventions(ctx context.Context, schoolURN string, studentExternalRef string) ([]InterventionPlan, error) {
	rows, err := r.db.Query(ctx, `
		SELECT p.id::text, COALESCE(sch.urn,''), st.external_ref, st.display_name,
		       p.objective_id, p.title, p.need, p.strategy, p.priority, p.status,
		       p.review_due_at, p.created_by, p.created_at, p.updated_at
		FROM intervention_plans p
		JOIN schools sch ON sch.id=p.school_id
		JOIN students st ON st.id=p.student_id
		WHERE ($1='' OR sch.urn=$1)
		  AND ($2='' OR st.external_ref=$2)
		ORDER BY
		  CASE WHEN p.status IN ('active','monitoring') THEN 0 ELSE 1 END,
		  p.priority DESC,
		  p.review_due_at NULLS LAST,
		  p.updated_at DESC
	`, schoolURN, studentExternalRef)
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
	var createdAt, updatedAt time.Time
	err := r.db.QueryRow(ctx, `
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
	rows, err := r.db.Query(ctx, `
		SELECT r.id::text, r.intervention_id::text, sch.urn, st.external_ref,
		       st.display_name, r.objective_id, r.outcome, r.evidence_note,
		       r.next_review_due_at, r.reviewed_by, r.reviewed_at
		FROM intervention_reviews r
		JOIN schools sch ON sch.id=r.school_id
		JOIN students st ON st.id=r.student_id
		WHERE ($1='' OR sch.urn=$1)
		  AND ($2='' OR st.external_ref=$2)
		ORDER BY r.reviewed_at DESC
	`, schoolURN, studentExternalRef)
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
	if err := tx.Commit(ctx); err != nil {
		return review, err
	}
	if nextReview != nil {
		review.NextReviewDueAt = nextReview.UTC().Format(time.RFC3339)
	}
	review.ReviewedAt = reviewedAt.UTC().Format(time.RFC3339)
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

func (r *PostgresRepository) currentMasteryScore(ctx context.Context, studentUUID string, objectiveID string) (int, error) {
	var score int
	err := r.db.QueryRow(ctx, `
		SELECT score
		FROM student_objective_mastery
		WHERE student_id=$1 AND objective_id=$2
	`, studentUUID, objectiveID).Scan(&score)
	if errors.Is(err, pgx.ErrNoRows) {
		return 0, nil
	}
	return score, err
}

func (r *PostgresRepository) nextReviewDaysForObjective(ctx context.Context, objectiveID string, score int) (int, error) {
	var expected, secure int
	var retentionDays []int
	err := r.db.QueryRow(ctx, `
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

func (r *PostgresRepository) updateMisconceptionState(ctx context.Context, studentUUID string, attempt Attempt, result AttemptResult) error {
	if attempt.QuestionID == "" {
		return nil
	}
	var key string
	err := r.db.QueryRow(ctx, `
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
		_, err = r.db.Exec(ctx, `
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
	err = r.db.QueryRow(ctx, `
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
	_, err = r.db.Exec(ctx, `
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

func (r *PostgresRepository) completeMatchingReview(ctx context.Context, studentUUID string, objectiveID string) (bool, error) {
	tag, err := r.db.Exec(ctx, `
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

func (r *PostgresRepository) refreshEvidenceConfidence(ctx context.Context, studentUUID string, objectiveID string, score int) (string, string, error) {
	rows, err := r.db.Query(ctx, `
		SELECT correct, hint_used, retention_review, response_format, recorded_at
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
		if err := rows.Scan(&signal.Correct, &signal.HintUsed, &signal.RetentionReview, &signal.Format, &signal.RecordedAt); err != nil {
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
	_, err = r.db.Exec(ctx, `
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
		if signal.Correct && !signal.HintUsed {
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

func (r *PostgresRepository) updateWorldState(ctx context.Context, studentUUID, studentID, objectiveID string, result AttemptResult) error {
	worldKey, err := r.worldKeyForObjective(ctx, objectiveID)
	if err != nil {
		return err
	}
	state := map[string]any{}
	var existing []byte
	err = r.db.QueryRow(ctx, `
		SELECT state
		FROM student_world_state
		WHERE student_id=$1 AND world_key=$2
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
	_, err = r.db.Exec(ctx, `
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

func (r *PostgresRepository) applyRewardPolicy(ctx context.Context, objectiveID string, result AttemptResult) (AttemptResult, error) {
	worldKey, err := r.worldKeyForObjective(ctx, objectiveID)
	if err != nil {
		return result, err
	}
	trigger := "attempt.incorrect"
	if result.Correct {
		trigger = "attempt.correct"
	}
	var raw []byte
	err = r.db.QueryRow(ctx, `
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

func (r *PostgresRepository) ensureObjective(ctx context.Context, objectiveID string) error {
	var exists bool
	err := r.db.QueryRow(ctx, `SELECT EXISTS (SELECT 1 FROM curriculum_objectives WHERE id=$1)`, objectiveID).Scan(&exists)
	if err != nil {
		return err
	}
	if !exists {
		return errors.New("objective is not configured")
	}
	return nil
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
		delta := -4
		if attempt.Confidence >= 4 {
			delta--
		}
		return delta
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
