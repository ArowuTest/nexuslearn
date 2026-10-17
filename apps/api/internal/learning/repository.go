package learning

import (
	"context"
	"crypto/sha256"
	"encoding/json"
	"errors"
	"fmt"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

var ErrStudentNotFound = errors.New("student is not configured")
var ErrNoDiagnosticObjectives = errors.New("no live diagnostic objectives are available for this year group")
var ErrIdempotencyConflict = errors.New("idempotency key was already used with a different request")
var ErrMockAssessmentNotFound = errors.New("mock assessment is not available for this learner")
var ErrMockAssessmentClosed = errors.New("mock assessment is already closed")
var ErrMockQuestionNotInAssessment = errors.New("question is not part of this mock assessment")
var ErrMockQuestionAlreadyAnswered = errors.New("question has already been answered in this mock assessment")

type queryExecutor interface {
	Exec(context.Context, string, ...any) (pgconn.CommandTag, error)
	Query(context.Context, string, ...any) (pgx.Rows, error)
	QueryRow(context.Context, string, ...any) pgx.Row
}

type idempotencyReplay struct {
	Found    bool
	Response []byte
}

func requestHash(value any) (string, error) {
	raw, err := json.Marshal(value)
	if err != nil {
		return "", err
	}
	digest := sha256.Sum256(raw)
	return fmt.Sprintf("%x", digest[:]), nil
}

func beginIdempotency(ctx context.Context, tx pgx.Tx, scope string, actor string, key string, request any) (idempotencyReplay, error) {
	key = strings.TrimSpace(key)
	if key == "" {
		return idempotencyReplay{}, nil
	}
	hash, err := requestHash(request)
	if err != nil {
		return idempotencyReplay{}, err
	}
	tag, err := tx.Exec(ctx, `
		INSERT INTO request_idempotency (scope, actor_key, request_key, request_hash)
		VALUES ($1,$2,$3,$4)
		ON CONFLICT (scope, actor_key, request_key) DO NOTHING
	`, scope, actor, key, hash)
	if err != nil {
		return idempotencyReplay{}, err
	}
	if tag.RowsAffected() > 0 {
		return idempotencyReplay{}, nil
	}
	var existingHash string
	var response []byte
	if err := tx.QueryRow(ctx, `
		SELECT request_hash, response_payload
		FROM request_idempotency
		WHERE scope=$1 AND actor_key=$2 AND request_key=$3
		FOR UPDATE
	`, scope, actor, key).Scan(&existingHash, &response); err != nil {
		return idempotencyReplay{}, err
	}
	if existingHash != hash {
		return idempotencyReplay{}, ErrIdempotencyConflict
	}
	if len(response) == 0 {
		return idempotencyReplay{}, errors.New("idempotent request is still being processed")
	}
	return idempotencyReplay{Found: true, Response: response}, nil
}

func completeIdempotency(ctx context.Context, tx pgx.Tx, scope string, actor string, key string, response any) error {
	if strings.TrimSpace(key) == "" {
		return nil
	}
	payload, err := json.Marshal(response)
	if err != nil {
		return err
	}
	_, err = tx.Exec(ctx, `
		UPDATE request_idempotency
		SET response_payload=$4::jsonb, updated_at=now()
		WHERE scope=$1 AND actor_key=$2 AND request_key=$3
	`, scope, actor, key, payload)
	return err
}

type Repository interface {
	RecordAttempt(ctx context.Context, attempt Attempt) (AttemptResult, error)
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
	StudentIdentity(ctx context.Context, studentID string) (StudentProfileConfig, bool, error)
	ListStudents(ctx context.Context) ([]StudentProfileConfig, error)
	UpsertStudent(ctx context.Context, student StudentProfileConfig) (StudentProfileConfig, error)
	ListSchools(ctx context.Context) ([]SchoolConfig, error)
	UpsertSchool(ctx context.Context, school SchoolConfig) (SchoolConfig, error)
	ListSchoolUsers(ctx context.Context) ([]SchoolUserConfig, error)
	ListSchoolUsersForSchool(ctx context.Context, schoolURN string) ([]SchoolUserConfig, error)
	UpsertSchoolUser(ctx context.Context, user SchoolUserConfig) (SchoolUserConfig, error)
	VerifySchoolUser(ctx context.Context, schoolURN string, loginID string, password string) (SchoolUserConfig, bool, error)
	SchoolPortal(ctx context.Context, schoolURN string) (SchoolPortalConfig, error)
	ListClasses(ctx context.Context) ([]ClassConfig, error)
	ListClassesForSchool(ctx context.Context, schoolURN string) ([]ClassConfig, error)
	UpsertClass(ctx context.Context, classConfig ClassConfig) (ClassConfig, error)
	AssignStudentToClass(ctx context.Context, classID string, studentExternalRef string) (ClassConfig, error)
	ListStudentCredentials(ctx context.Context) ([]StudentCredentialConfig, error)
	ListStudentCredentialsForSchool(ctx context.Context, schoolURN string) ([]StudentCredentialConfig, error)
	UpsertStudentCredential(ctx context.Context, credential StudentCredentialConfig) (StudentCredentialConfig, error)
	GenerateClassCredentials(ctx context.Context, classID string, overwrite bool, picturePool []string) (ClassCredentialBatch, error)
	ListGroups(ctx context.Context) ([]LearningGroupConfig, error)
	ListGroupsForSchool(ctx context.Context, schoolURN string) ([]LearningGroupConfig, error)
	UpsertGroup(ctx context.Context, group LearningGroupConfig) (LearningGroupConfig, error)
	AssignStudentToGroup(ctx context.Context, groupID string, studentExternalRef string) (LearningGroupConfig, error)
	ListParentLinks(ctx context.Context) ([]ParentLinkConfig, error)
	UpsertParentLink(ctx context.Context, link ParentLinkConfig) (ParentLinkConfig, error)
	UpsertParentAccount(ctx context.Context, parent ParentAccountConfig) (ParentAccountConfig, error)
	VerifyParentUser(ctx context.Context, loginID string, password string) (ParentAccountConfig, bool, error)
	ParentPortal(ctx context.Context, parentLoginID string) (ParentPortalConfig, error)
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
	ListAuditLogPage(ctx context.Context, query AdminPageQuery) (AuditLogPage, error)
	ListContentVersions(ctx context.Context, limit int) ([]ContentVersion, error)
	ListContentVersionPage(ctx context.Context, query AdminPageQuery) (ContentVersionPage, error)
	RestoreContentVersion(ctx context.Context, id string) (ContentVersion, error)
}

type NoopRepository struct{}

func (NoopRepository) RecordAttempt(_ context.Context, _ Attempt) (AttemptResult, error) {
	return AttemptResult{}, ErrGradingUnavailable
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

func (NoopRepository) StudentIdentity(context.Context, string) (StudentProfileConfig, bool, error) {
	return StudentProfileConfig{}, false, nil
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

func (NoopRepository) ListSchoolUsersForSchool(context.Context, string) ([]SchoolUserConfig, error) {
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

func (NoopRepository) ListClassesForSchool(context.Context, string) ([]ClassConfig, error) {
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

func (NoopRepository) ListStudentCredentialsForSchool(context.Context, string) ([]StudentCredentialConfig, error) {
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

func (NoopRepository) ListGroupsForSchool(context.Context, string) ([]LearningGroupConfig, error) {
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

func (NoopRepository) ListAuditLogPage(context.Context, AdminPageQuery) (AuditLogPage, error) {
	return AuditLogPage{AuditLogs: []AuditLog{}}, nil
}

func (NoopRepository) ListContentVersions(context.Context, int) ([]ContentVersion, error) {
	return []ContentVersion{}, nil
}

func (NoopRepository) ListContentVersionPage(context.Context, AdminPageQuery) (ContentVersionPage, error) {
	return ContentVersionPage{ContentVersions: []ContentVersion{}}, nil
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
