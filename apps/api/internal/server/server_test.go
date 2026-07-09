package server

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/ArowuTest/nexuslearn/apps/api/internal/learning"
)

type fakeRepository struct {
	mastery             []learning.StudentMastery
	attempts            []learning.RecentAttempt
	warmUp              []learning.WarmUpItem
	objectives          []learning.Objective
	summary             learning.EvidenceSummary
	world               learning.WorldState
	session             learning.LearningSession
	diagnostics         learning.Diagnostics
	studentYear         int
	flags               []learning.FeatureFlag
	worlds              []learning.WorldConfig
	activities          []learning.ActivityConfig
	questions           []learning.QuestionConfig
	rewardRules         []learning.RewardRule
	students            []learning.StudentProfileConfig
	schools             []learning.SchoolConfig
	schoolUsers         []learning.SchoolUserConfig
	schoolPortal        learning.SchoolPortalConfig
	verifySchool        bool
	schoolRole          string
	classes             []learning.ClassConfig
	credentials         []learning.StudentCredentialConfig
	groups              []learning.LearningGroupConfig
	parentLinks         []learning.ParentLinkConfig
	parentPortal        learning.ParentPortalConfig
	verifyParent        bool
	engagement          learning.StudentEngagementProfile
	accessReqs          []learning.AccessRequestConfig
	auditLogs           []learning.AuditLog
	versions            []learning.ContentVersion
	accountSession      learning.AccountSession
	platformUser        learning.PlatformUserConfig
	invitations         []learning.ParentInvitation
	recordAttemptErr    error
	assignments         []learning.Assignment
	teacherEvidence     []learning.TeacherEvidenceRecord
	interventions       []learning.InterventionPlan
	interventionReviews []learning.InterventionReview
	baseline            learning.DiagnosticBaseline
	hasBaseline         bool
}

func (f fakeRepository) RecordAttempt(_ context.Context, _ learning.Attempt, result learning.AttemptResult) (learning.AttemptResult, error) {
	if f.recordAttemptErr != nil {
		return result, f.recordAttemptErr
	}
	result.ProjectedScore = 88
	return result, nil
}

func (f fakeRepository) ListMastery(context.Context, string) ([]learning.StudentMastery, error) {
	return f.mastery, nil
}

func (f fakeRepository) RecentAttempts(context.Context, string, int) ([]learning.RecentAttempt, error) {
	return f.attempts, nil
}

func (f fakeRepository) WarmUpItems(context.Context, string, int) ([]learning.WarmUpItem, error) {
	return f.warmUp, nil
}

func (f fakeRepository) EvidenceSummary(context.Context, string) (learning.EvidenceSummary, error) {
	return f.summary, nil
}

func (f fakeRepository) WorldState(context.Context, string, string) (learning.WorldState, error) {
	return f.world, nil
}

func (f fakeRepository) StartSession(context.Context, string, string, string) (learning.LearningSession, error) {
	return f.session, nil
}

func (f fakeRepository) RecordLessonStep(_ context.Context, attempt learning.LessonStepAttempt) (learning.LessonStepAttempt, error) {
	attempt.ID = "lesson-step-attempt"
	return attempt, nil
}

func (f fakeRepository) RecordLearningEvent(_ context.Context, event learning.LearningEvent) (learning.LearningEvent, error) {
	event.ID = "learning-event"
	return event, nil
}

func (f fakeRepository) ListAssignments(context.Context, string, string) ([]learning.Assignment, error) {
	return f.assignments, nil
}

func (f fakeRepository) CreateAssignment(_ context.Context, assignment learning.Assignment) (learning.Assignment, error) {
	assignment.ID = "assignment-created"
	return assignment, nil
}

func (f fakeRepository) ListTeacherEvidence(context.Context, string, string) ([]learning.TeacherEvidenceRecord, error) {
	return f.teacherEvidence, nil
}

func (f fakeRepository) CreateTeacherEvidence(_ context.Context, record learning.TeacherEvidenceRecord) (learning.TeacherEvidenceRecord, error) {
	record.ID = "teacher-evidence-created"
	return record, nil
}

func (f fakeRepository) ListInterventions(context.Context, string, string) ([]learning.InterventionPlan, error) {
	return f.interventions, nil
}

func (f fakeRepository) CreateIntervention(_ context.Context, plan learning.InterventionPlan) (learning.InterventionPlan, error) {
	plan.ID = "intervention-created"
	return plan, nil
}

func (f fakeRepository) UpdateInterventionStatus(_ context.Context, schoolURN string, id string, status string) (learning.InterventionPlan, error) {
	return learning.InterventionPlan{ID: id, SchoolURN: schoolURN, Status: status}, nil
}

func (f fakeRepository) ListInterventionReviews(context.Context, string, string) ([]learning.InterventionReview, error) {
	return f.interventionReviews, nil
}

func (f fakeRepository) CreateInterventionReview(_ context.Context, review learning.InterventionReview) (learning.InterventionReview, error) {
	review.ID = "intervention-review-created"
	return review, nil
}

func (f fakeRepository) DiagnosticBaseline(context.Context, string) (learning.DiagnosticBaseline, bool, error) {
	return f.baseline, f.hasBaseline, nil
}

func (f fakeRepository) CreateDiagnosticBaseline(_ context.Context, baseline learning.DiagnosticBaseline) (learning.DiagnosticBaseline, error) {
	baseline.ID = "baseline-created"
	baseline.Status = "in_progress"
	baseline.TotalItems = len(baseline.Items)
	if len(baseline.Items) > 0 {
		baseline.CurrentObjectiveID = baseline.Items[0].ObjectiveID
	}
	return baseline, nil
}

func (f fakeRepository) StudentYear(context.Context, string) (int, bool, error) {
	if f.studentYear == 0 {
		return 0, false, nil
	}
	return f.studentYear, true, nil
}

func (f fakeRepository) Diagnostics(context.Context) (learning.Diagnostics, error) {
	return f.diagnostics, nil
}

func (f fakeRepository) ListObjectives(context.Context) ([]learning.Objective, error) {
	return f.objectives, nil
}

func (f fakeRepository) GetObjective(_ context.Context, id string) (learning.Objective, bool, error) {
	for _, objective := range f.objectives {
		if objective.ID == id {
			return objective, true, nil
		}
	}
	return learning.Objective{}, false, nil
}

func (f fakeRepository) UpsertObjective(_ context.Context, objective learning.Objective) (learning.Objective, error) {
	return objective, nil
}

func (f fakeRepository) ListFeatureFlags(context.Context) ([]learning.FeatureFlag, error) {
	return f.flags, nil
}

func (f fakeRepository) UpsertFeatureFlag(_ context.Context, flag learning.FeatureFlag) (learning.FeatureFlag, error) {
	return flag, nil
}

func (f fakeRepository) ListWorlds(context.Context) ([]learning.WorldConfig, error) {
	return f.worlds, nil
}

func (f fakeRepository) UpsertWorld(_ context.Context, world learning.WorldConfig) (learning.WorldConfig, error) {
	return world, nil
}

func (f fakeRepository) ListActivities(context.Context) ([]learning.ActivityConfig, error) {
	return f.activities, nil
}

func (f fakeRepository) UpsertActivity(_ context.Context, activity learning.ActivityConfig) (learning.ActivityConfig, error) {
	return activity, nil
}

func (f fakeRepository) ListQuestions(context.Context) ([]learning.QuestionConfig, error) {
	return f.questions, nil
}

func (f fakeRepository) UpsertQuestion(_ context.Context, question learning.QuestionConfig) (learning.QuestionConfig, error) {
	return question, nil
}

func (f fakeRepository) ListRewardRules(context.Context) ([]learning.RewardRule, error) {
	return f.rewardRules, nil
}

func (f fakeRepository) UpsertRewardRule(_ context.Context, rule learning.RewardRule) (learning.RewardRule, error) {
	return rule, nil
}

func (f fakeRepository) ListStudents(context.Context) ([]learning.StudentProfileConfig, error) {
	return f.students, nil
}

func (f fakeRepository) UpsertStudent(_ context.Context, student learning.StudentProfileConfig) (learning.StudentProfileConfig, error) {
	return student, nil
}

func (f fakeRepository) ListSchools(context.Context) ([]learning.SchoolConfig, error) {
	return f.schools, nil
}

func (f fakeRepository) UpsertSchool(_ context.Context, school learning.SchoolConfig) (learning.SchoolConfig, error) {
	return school, nil
}

func (f fakeRepository) ListSchoolUsers(context.Context) ([]learning.SchoolUserConfig, error) {
	return f.schoolUsers, nil
}

func (f fakeRepository) UpsertSchoolUser(_ context.Context, user learning.SchoolUserConfig) (learning.SchoolUserConfig, error) {
	user.ID = "school-user-1"
	user.LoginID = "nexus-primary-lead"
	user.TemporaryPassword = "abc-123-def"
	return user, nil
}

func (f fakeRepository) VerifySchoolUser(_ context.Context, schoolURN string, loginID string, _ string) (learning.SchoolUserConfig, bool, error) {
	if !f.verifySchool {
		return learning.SchoolUserConfig{}, false, nil
	}
	role := f.schoolRole
	if role == "" {
		role = "school_admin"
	}
	return learning.SchoolUserConfig{SchoolURN: schoolURN, LoginID: loginID, Role: role}, true, nil
}

func (f fakeRepository) SchoolPortal(_ context.Context, schoolURN string) (learning.SchoolPortalConfig, error) {
	if f.schoolPortal.School.URN != "" {
		return f.schoolPortal, nil
	}
	return learning.SchoolPortalConfig{School: learning.SchoolConfig{URN: schoolURN}, Classes: f.classes, Groups: f.groups, StudentCredentials: f.credentials, Users: f.schoolUsers}, nil
}

func (f fakeRepository) ListClasses(context.Context) ([]learning.ClassConfig, error) {
	return f.classes, nil
}

func (f fakeRepository) UpsertClass(_ context.Context, classConfig learning.ClassConfig) (learning.ClassConfig, error) {
	return classConfig, nil
}

func (f fakeRepository) AssignStudentToClass(_ context.Context, classID string, studentExternalRef string) (learning.ClassConfig, error) {
	return learning.ClassConfig{ID: classID, Students: []learning.StudentProfileConfig{{ExternalRef: studentExternalRef}}}, nil
}

func (f fakeRepository) ListStudentCredentials(context.Context) ([]learning.StudentCredentialConfig, error) {
	return f.credentials, nil
}

func (f fakeRepository) UpsertStudentCredential(_ context.Context, credential learning.StudentCredentialConfig) (learning.StudentCredentialConfig, error) {
	return credential, nil
}

func (f fakeRepository) GenerateClassCredentials(_ context.Context, classID string, overwrite bool, picturePool []string) (learning.ClassCredentialBatch, error) {
	return learning.ClassCredentialBatch{
		ClassID:        classID,
		Overwrite:      overwrite,
		PicturePool:    picturePool,
		GeneratedCount: 1,
		Credentials:    []learning.StudentCredentialConfig{{StudentExternalRef: "ava-y1", LoginCode: "AVA-123"}},
	}, nil
}

func (f fakeRepository) ListGroups(context.Context) ([]learning.LearningGroupConfig, error) {
	return f.groups, nil
}

func (f fakeRepository) UpsertGroup(_ context.Context, group learning.LearningGroupConfig) (learning.LearningGroupConfig, error) {
	return group, nil
}

func (f fakeRepository) AssignStudentToGroup(_ context.Context, groupID string, studentExternalRef string) (learning.LearningGroupConfig, error) {
	return learning.LearningGroupConfig{ID: groupID, Students: []learning.StudentProfileConfig{{ExternalRef: studentExternalRef}}}, nil
}

func (f fakeRepository) ListParentLinks(context.Context) ([]learning.ParentLinkConfig, error) {
	return f.parentLinks, nil
}

func (f fakeRepository) UpsertParentLink(_ context.Context, link learning.ParentLinkConfig) (learning.ParentLinkConfig, error) {
	return link, nil
}

func (f fakeRepository) UpsertParentAccount(_ context.Context, parent learning.ParentAccountConfig) (learning.ParentAccountConfig, error) {
	parent.ID = "parent-1"
	parent.LoginID = parent.Email
	return parent, nil
}

func (f fakeRepository) VerifyParentUser(_ context.Context, loginID string, _ string) (learning.ParentAccountConfig, bool, error) {
	if !f.verifyParent {
		return learning.ParentAccountConfig{}, false, nil
	}
	return learning.ParentAccountConfig{Email: loginID, LoginID: loginID, DisplayName: "Parent"}, true, nil
}

func (f fakeRepository) ParentPortal(_ context.Context, parentLoginID string) (learning.ParentPortalConfig, error) {
	if f.parentPortal.Parent.LoginID != "" {
		return f.parentPortal, nil
	}
	return learning.ParentPortalConfig{Parent: learning.ParentAccountConfig{LoginID: parentLoginID}}, nil
}

func (f fakeRepository) UpsertStudentEngagement(_ context.Context, profile learning.StudentEngagementProfile) (learning.StudentEngagementProfile, error) {
	return profile, nil
}

func (f fakeRepository) StudentEngagement(_ context.Context, studentExternalRef string) (learning.StudentEngagementProfile, error) {
	if f.engagement.StudentExternalRef != "" {
		return f.engagement, nil
	}
	return learning.StudentEngagementProfile{StudentExternalRef: studentExternalRef}, nil
}

func (f fakeRepository) ListAccessRequests(context.Context, string) ([]learning.AccessRequestConfig, error) {
	return f.accessReqs, nil
}

func (f fakeRepository) CreateAccessRequest(_ context.Context, request learning.AccessRequestConfig) (learning.AccessRequestConfig, error) {
	request.ID = "request-1"
	request.Status = "new"
	return request, nil
}

func (f fakeRepository) UpdateAccessRequestStatus(_ context.Context, id string, status string) (learning.AccessRequestConfig, error) {
	return learning.AccessRequestConfig{ID: id, Status: status}, nil
}

func (f fakeRepository) ListAuditLogs(context.Context, int) ([]learning.AuditLog, error) {
	return f.auditLogs, nil
}

func (f fakeRepository) ListContentVersions(context.Context, int) ([]learning.ContentVersion, error) {
	return f.versions, nil
}

func (f fakeRepository) RestoreContentVersion(_ context.Context, id string) (learning.ContentVersion, error) {
	for _, version := range f.versions {
		if version.ID == id {
			return version, nil
		}
	}
	return learning.ContentVersion{}, learning.ErrInvalidConfiguration
}

func (f fakeRepository) PromoteContentVersion(_ context.Context, id string, status string) (learning.ContentVersion, error) {
	for _, version := range f.versions {
		if version.ID == id {
			version.Status = status
			version.Version++
			return version, nil
		}
	}
	return learning.ContentVersion{}, learning.ErrInvalidConfiguration
}

func (f fakeRepository) VerifyPlatformUser(_ context.Context, loginID string, _ string) (learning.PlatformUserConfig, bool, error) {
	if f.platformUser.ID == "" {
		return learning.PlatformUserConfig{}, false, nil
	}
	user := f.platformUser
	user.LoginID = loginID
	return user, true, nil
}

func (f fakeRepository) UpsertPlatformUser(_ context.Context, user learning.PlatformUserConfig, _ string) (learning.PlatformUserConfig, error) {
	user.ID = "platform-user-1"
	user.Status = "active"
	return user, nil
}

func (f fakeRepository) CreateAccountSession(_ context.Context, session learning.AccountSession) (learning.AccountSession, error) {
	session.ID = "session-1"
	return session, nil
}

func (f fakeRepository) AccountSessionByTokenHash(_ context.Context, tokenHash string) (learning.AccountSession, bool, error) {
	session := f.accountSession
	if session.UserID == "" {
		return learning.AccountSession{}, false, nil
	}
	session.TokenHash = tokenHash
	return session, true, nil
}

func (f fakeRepository) RevokeAccountSession(context.Context, string) error {
	return nil
}

func (f fakeRepository) CreateParentInvitation(_ context.Context, invitation learning.ParentInvitation) (learning.ParentInvitation, error) {
	invitation.ID = "invitation-1"
	invitation.Status = "pending"
	return invitation, nil
}

func (f fakeRepository) ListParentInvitations(context.Context) ([]learning.ParentInvitation, error) {
	return f.invitations, nil
}

func (f fakeRepository) UpdateParentInvitationStatus(_ context.Context, id string, status string) (learning.ParentInvitation, error) {
	return learning.ParentInvitation{ID: id, Status: status}, nil
}

func (f fakeRepository) ParentInvitationByTokenHash(context.Context, string) (learning.ParentInvitation, bool, error) {
	if len(f.invitations) == 0 {
		return learning.ParentInvitation{}, false, nil
	}
	return f.invitations[0], true, nil
}

func (f fakeRepository) AcceptParentInvitation(_ context.Context, _ string, _ string) (learning.ParentInvitation, error) {
	if len(f.invitations) == 0 {
		return learning.ParentInvitation{}, learning.ErrInvalidConfiguration
	}
	invitation := f.invitations[0]
	invitation.Status = "accepted"
	return invitation, nil
}

func TestHandleMasteryUsesRepository(t *testing.T) {
	srv := New(fakeRepository{
		mastery: []learning.StudentMastery{
			{
				StudentID:     "alex-demo",
				ObjectiveID:   "ma-y4-number-multiplication-12x12",
				Score:         86,
				Band:          "Expected standard",
				LastSignal:    "Fast accurate recall.",
				NextReviewDue: "2026-06-18T09:00:00Z",
			},
		},
	}, "postgres")

	req := httptest.NewRequest(http.MethodGet, "/v1/students/alex-demo/mastery", nil)
	res := httptest.NewRecorder()
	srv.ServeHTTP(res, req)

	if res.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", res.Code)
	}

	var body struct {
		Mastery []learning.StudentMastery `json:"mastery"`
	}
	if err := json.NewDecoder(res.Body).Decode(&body); err != nil {
		t.Fatal(err)
	}
	if len(body.Mastery) != 1 || body.Mastery[0].Score != 86 {
		t.Fatalf("expected repository mastery, got %#v", body.Mastery)
	}
}

func TestHandleRecentAttemptsUsesRepository(t *testing.T) {
	srv := New(fakeRepository{
		attempts: []learning.RecentAttempt{
			{
				StudentID:     "alex-demo",
				ObjectiveID:   "ma-y4-number-multiplication-12x12",
				QuestionID:    "q1",
				Correct:       true,
				MasteryDelta:  10,
				AnimationHook: "machine-charge",
			},
		},
	}, "postgres")

	req := httptest.NewRequest(http.MethodGet, "/v1/students/alex-demo/attempts", nil)
	res := httptest.NewRecorder()
	srv.ServeHTTP(res, req)

	if res.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", res.Code)
	}

	var body struct {
		Attempts []learning.RecentAttempt `json:"attempts"`
	}
	if err := json.NewDecoder(res.Body).Decode(&body); err != nil {
		t.Fatal(err)
	}
	if len(body.Attempts) != 1 || body.Attempts[0].QuestionID != "q1" {
		t.Fatalf("expected repository attempts, got %#v", body.Attempts)
	}
}

func TestHandleWarmUpUsesRepository(t *testing.T) {
	srv := New(fakeRepository{
		warmUp: []learning.WarmUpItem{
			{
				ObjectiveID:    "ma-y4-number-multiplication-12x12",
				Prompt:         "Power the lab.",
				Format:         "timed-recall",
				Reason:         "Spaced review is due.",
				Priority:       70,
				AnimationHook:  "machine-charge",
				CompanionNudge: "Let's review this together.",
			},
		},
	}, "postgres")

	req := httptest.NewRequest(http.MethodGet, "/v1/learning/warm-up?studentId=alex-demo", nil)
	res := httptest.NewRecorder()
	srv.ServeHTTP(res, req)

	if res.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", res.Code)
	}

	var body struct {
		Items []learning.WarmUpItem `json:"items"`
	}
	if err := json.NewDecoder(res.Body).Decode(&body); err != nil {
		t.Fatal(err)
	}
	if len(body.Items) != 1 || body.Items[0].AnimationHook != "machine-charge" {
		t.Fatalf("expected repository warm-up items, got %#v", body.Items)
	}
}

func TestLearningRuntimeRequiresStudentID(t *testing.T) {
	srv := New(fakeRepository{}, "postgres")

	for _, path := range []string{"/v1/learning/warm-up", "/v1/learning/next", "/v1/learning/mission"} {
		req := httptest.NewRequest(http.MethodGet, path, nil)
		res := httptest.NewRecorder()
		srv.ServeHTTP(res, req)
		if res.Code != http.StatusBadRequest {
			t.Fatalf("%s: expected 400 without studentId, got %d", path, res.Code)
		}
	}
}

func TestConfiguredMissionDoesNotReturnLegacyDemoWhenContentMissing(t *testing.T) {
	srv := New(fakeRepository{}, "postgres")

	req := httptest.NewRequest(http.MethodGet, "/v1/learning/mission?studentId=alex-demo", nil)
	res := httptest.NewRecorder()
	srv.ServeHTTP(res, req)

	if res.Code != http.StatusNotFound {
		t.Fatalf("expected 404 without configured mission, got %d", res.Code)
	}
}

func TestHandleAttemptReturnsAdjustedResult(t *testing.T) {
	srv := New(fakeRepository{}, "postgres")

	req := httptest.NewRequest(http.MethodPost, "/v1/learning/attempt", strings.NewReader(`{
		"student_id":"alex-demo",
		"objective_id":"ma-y4-number-multiplication-12x12",
		"question_id":"q1",
		"given":56,
		"expected":56
	}`))
	res := httptest.NewRecorder()
	srv.ServeHTTP(res, req)

	if res.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", res.Code)
	}

	var body learning.AttemptResult
	if err := json.NewDecoder(res.Body).Decode(&body); err != nil {
		t.Fatal(err)
	}
	if body.ProjectedScore != 88 {
		t.Fatalf("expected adjusted projected score, got %d", body.ProjectedScore)
	}
}

func TestHandleLessonStepPersistsTeachingEvidence(t *testing.T) {
	srv := New(fakeRepository{}, "postgres")

	req := httptest.NewRequest(http.MethodPost, "/v1/learning/lesson-step", strings.NewReader(`{
		"student_id":"alex-demo",
		"activity_id":"act-configured",
		"objective_id":"ma-y4-test",
		"step_id":"worked-example",
		"step_kind":"worked_example",
		"status":"completed",
		"duration_ms":4200,
		"support_used":["audio_support","step_by_step"]
	}`))
	res := httptest.NewRecorder()
	srv.ServeHTTP(res, req)

	if res.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d", res.Code)
	}
	var body learning.LessonStepAttempt
	if err := json.NewDecoder(res.Body).Decode(&body); err != nil {
		t.Fatal(err)
	}
	if body.ID != "lesson-step-attempt" || body.StepID != "worked-example" || len(body.SupportUsed) != 2 {
		t.Fatalf("expected saved lesson-step evidence, got %#v", body)
	}
}

func TestHandleAttemptDoesNotPretendUnsavedEvidenceSucceeded(t *testing.T) {
	srv := New(fakeRepository{recordAttemptErr: errors.New("database unavailable")}, "postgres")

	req := httptest.NewRequest(http.MethodPost, "/v1/learning/attempt", strings.NewReader(`{
		"student_id":"alex-demo",
		"objective_id":"ma-y4-number-multiplication-12x12",
		"question_id":"q1",
		"given":56,
		"expected":56
	}`))
	res := httptest.NewRecorder()
	srv.ServeHTTP(res, req)

	if res.Code != http.StatusInternalServerError {
		t.Fatalf("expected 500 when evidence is not saved, got %d", res.Code)
	}
}

func TestHandleEvidenceSummaryUsesRepository(t *testing.T) {
	srv := New(fakeRepository{
		summary: learning.EvidenceSummary{
			StudentID:     "alex-demo",
			Attempts7Days: 5,
			Accuracy7Days: 80,
		},
	}, "postgres")

	req := httptest.NewRequest(http.MethodGet, "/v1/students/alex-demo/summary", nil)
	res := httptest.NewRecorder()
	srv.ServeHTTP(res, req)

	if res.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", res.Code)
	}

	var body learning.EvidenceSummary
	if err := json.NewDecoder(res.Body).Decode(&body); err != nil {
		t.Fatal(err)
	}
	if body.Attempts7Days != 5 || body.Accuracy7Days != 80 {
		t.Fatalf("expected repository summary, got %#v", body)
	}
}

func TestHandleWorldStateUsesRepository(t *testing.T) {
	srv := New(fakeRepository{
		world: learning.WorldState{
			StudentID: "alex-demo",
			WorldKey:  "inventor-wilds",
			State: map[string]any{
				"power_cores": float64(4),
			},
		},
	}, "postgres")

	req := httptest.NewRequest(http.MethodGet, "/v1/students/alex-demo/world?worldKey=inventor-wilds", nil)
	res := httptest.NewRecorder()
	srv.ServeHTTP(res, req)

	if res.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", res.Code)
	}

	var body learning.WorldState
	if err := json.NewDecoder(res.Body).Decode(&body); err != nil {
		t.Fatal(err)
	}
	if body.WorldKey != "inventor-wilds" {
		t.Fatalf("expected repository world state, got %#v", body)
	}
}

func TestHandlePublicWorldsReturnsEnabledConfiguredWorlds(t *testing.T) {
	srv := New(fakeRepository{
		worlds: []learning.WorldConfig{
			{Key: "wonder-garden", Name: "Wonder Garden", YearGroup: 1, Enabled: true},
			{Key: "archived-test", Name: "Archived", YearGroup: 2, Enabled: false},
		},
	}, "postgres")

	req := httptest.NewRequest(http.MethodGet, "/v1/learning/worlds", nil)
	res := httptest.NewRecorder()
	srv.ServeHTTP(res, req)

	if res.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", res.Code)
	}
	var body struct {
		Worlds []learning.WorldConfig `json:"worlds"`
	}
	if err := json.NewDecoder(res.Body).Decode(&body); err != nil {
		t.Fatal(err)
	}
	if len(body.Worlds) != 1 || body.Worlds[0].Key != "wonder-garden" {
		t.Fatalf("expected only enabled configured worlds, got %#v", body.Worlds)
	}
}

func TestHandleCurriculumMapGroupsObjectives(t *testing.T) {
	srv := New(fakeRepository{
		objectives: []learning.Objective{
			{ID: "ma-y1-count", Year: 1, Subject: "Mathematics", Strand: "Number", Topic: "Counting"},
			{ID: "en-y1-read", Year: 1, Subject: "English", Strand: "Reading", Topic: "Words"},
			{ID: "ma-y2-add", Year: 2, Subject: "Mathematics", Strand: "Number", Topic: "Addition"},
		},
	}, "postgres")

	req := httptest.NewRequest(http.MethodGet, "/v1/curriculum/map", nil)
	res := httptest.NewRecorder()
	srv.ServeHTTP(res, req)

	if res.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", res.Code)
	}
	var body learning.CurriculumMap
	if err := json.NewDecoder(res.Body).Decode(&body); err != nil {
		t.Fatal(err)
	}
	if body.Total != 3 || len(body.Years) != 7 || body.Years[0].Total != 2 {
		t.Fatalf("expected grouped curriculum map, got %#v", body)
	}
	if len(body.Subjects) != 2 || body.Subjects[0].Name != "English" {
		t.Fatalf("expected sorted subject coverage, got %#v", body.Subjects)
	}
}

func TestHandleNextActivityPrefersConfiguredPublishedActivity(t *testing.T) {
	srv := New(fakeRepository{
		objectives: []learning.Objective{{ID: "ma-y4-test", Mastery: learning.MasteryRule{RequiredFormats: []string{"array-build"}}}},
		worlds: []learning.WorldConfig{{
			Key:       "inventor-wilds",
			Name:      "Inventor Wilds",
			YearGroup: 4,
			Config:    map[string]any{"realm": "Year 4 Inventor Wilds"},
			Enabled:   true,
		}},
		activities: []learning.ActivityConfig{{
			ID:             "act-configured",
			ObjectiveID:    "ma-y4-test",
			TemplateID:     "array-build",
			WorldKey:       "inventor-wilds",
			Title:          "Configured Activity",
			Prompt:         "Build the fact.",
			Difficulty:     4,
			Interaction:    map[string]any{"type": "array-build", "scaffold": true},
			Feedback:       map[string]any{"selection_reason": "Configured path selected.", "companion_prompt": "Teach it back."},
			AnimationHooks: map[string]any{"primary": "configured-animation", "reward": "configured-reward"},
			Status:         "published",
		}},
		engagement: learning.StudentEngagementProfile{
			StudentExternalRef:   "alex-demo",
			LearningApproaches:   []string{"low_sensory", "short_bursts"},
			SensoryLoad:          "low",
			AttentionSupport:     "chunked",
			AudioSupport:         true,
			CompanionStyle:       "calm",
			RewardStyle:          "world_building",
			CelebrationIntensity: "balanced",
			SessionLength:        "standard",
		},
	}, "postgres")

	req := httptest.NewRequest(http.MethodGet, "/v1/learning/next?studentId=alex-demo", nil)
	res := httptest.NewRecorder()
	srv.ServeHTTP(res, req)

	if res.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", res.Code)
	}
	var body learning.NextActivityDecision
	if err := json.NewDecoder(res.Body).Decode(&body); err != nil {
		t.Fatal(err)
	}
	if body.ActivityID != "act-configured" || body.WorldKey != "inventor-wilds" || body.AnimationHook != "configured-animation" {
		t.Fatalf("expected configured next activity, got %#v", body)
	}
	if !body.RuntimeAdaptations.ReducedMotion || body.RuntimeAdaptations.QuestionLimit != 5 || body.RuntimeAdaptations.CompanionStyle != "calm" {
		t.Fatalf("expected low-sensory runtime adaptations, got %#v", body.RuntimeAdaptations)
	}
}

func TestChooseAdaptiveActivityPrioritisesDueReview(t *testing.T) {
	activities := []learning.ActivityConfig{
		{ID: "new-learning", ObjectiveID: "objective-new", Status: "published"},
		{ID: "due-review", ObjectiveID: "objective-review", Status: "published"},
	}
	choice, ok := chooseAdaptiveActivity(
		activities,
		[]learning.Objective{{ID: "objective-new", Year: 4}, {ID: "objective-review", Year: 4}},
		nil,
		[]learning.WarmUpItem{{ObjectiveID: "objective-review"}},
		nil,
		nil,
		nil,
		nil,
		4,
	)
	if !ok || choice.Activity.ID != "due-review" || !choice.Review {
		t.Fatalf("expected due review to win, got %#v", choice)
	}
}

func TestChooseDiagnosticBaselineItemsBalancesCoreSubjectsAndWeakEvidence(t *testing.T) {
	objectives := []learning.Objective{
		{ID: "en-secure", Year: 4, Subject: "English"},
		{ID: "en-new", Year: 4, Subject: "English"},
		{ID: "ma-new", Year: 4, Subject: "Mathematics"},
		{ID: "sc-stale", Year: 4, Subject: "Science"},
		{ID: "sc-other-year", Year: 5, Subject: "Science"},
	}
	activities := []learning.ActivityConfig{
		{ID: "a-en-secure", ObjectiveID: "en-secure", Status: "published"},
		{ID: "a-en-new", ObjectiveID: "en-new", Status: "published"},
		{ID: "a-ma-new", ObjectiveID: "ma-new", Status: "published"},
		{ID: "a-sc-stale", ObjectiveID: "sc-stale", Status: "published"},
		{ID: "a-sc-other", ObjectiveID: "sc-other-year", Status: "published"},
	}
	items := chooseDiagnosticBaselineItems(objectives, activities, []learning.StudentMastery{
		{ObjectiveID: "en-secure", Score: 90, EffectiveEvidence: 6, EvidenceFreshness: "current"},
		{ObjectiveID: "sc-stale", Score: 55, EffectiveEvidence: 1.5, EvidenceFreshness: "stale"},
	}, 4, 4)
	if len(items) != 4 {
		t.Fatalf("expected four baseline items, got %#v", items)
	}
	got := map[string]bool{}
	for _, item := range items {
		got[item.ObjectiveID] = true
	}
	for _, objectiveID := range []string{"en-new", "ma-new", "sc-stale"} {
		if !got[objectiveID] {
			t.Fatalf("expected balanced baseline to include %s, got %#v", objectiveID, items)
		}
	}
	if got["sc-other-year"] {
		t.Fatalf("did not expect another year group in baseline: %#v", items)
	}
}

func TestNextDecisionPrioritisesActiveDiagnosticBaseline(t *testing.T) {
	srv := New(fakeRepository{
		studentYear: 4,
		baseline: learning.DiagnosticBaseline{
			Status:             "in_progress",
			CurrentObjectiveID: "objective-diagnostic",
			Items: []learning.DiagnosticBaselineItem{
				{ObjectiveID: "objective-diagnostic", Status: "planned"},
			},
		},
		hasBaseline: true,
		objectives: []learning.Objective{
			{ID: "objective-diagnostic", Year: 4},
			{ID: "objective-review", Year: 4},
		},
		activities: []learning.ActivityConfig{
			{ID: "diagnostic-activity", ObjectiveID: "objective-diagnostic", Status: "published"},
			{ID: "review-activity", ObjectiveID: "objective-review", Status: "published"},
		},
		warmUp: []learning.WarmUpItem{{ObjectiveID: "objective-review"}},
	}, "postgres")

	decision, err := srv.nextDecision(context.Background(), "alex-demo")
	if err != nil {
		t.Fatal(err)
	}
	if decision.ActivityID != "diagnostic-activity" || decision.AssessmentMode != "diagnostic" {
		t.Fatalf("expected active baseline activity, got %#v", decision)
	}
}

func TestCreateDiagnosticBaselineBuildsYearAppropriatePlan(t *testing.T) {
	srv := New(fakeRepository{
		studentYear: 3,
		objectives: []learning.Objective{
			{ID: "en-y3", Year: 3, Subject: "English"},
			{ID: "ma-y3", Year: 3, Subject: "Mathematics"},
			{ID: "sc-y3", Year: 3, Subject: "Science"},
			{ID: "ma-y4", Year: 4, Subject: "Mathematics"},
		},
		activities: []learning.ActivityConfig{
			{ID: "a-en-y3", ObjectiveID: "en-y3", Status: "published"},
			{ID: "a-ma-y3", ObjectiveID: "ma-y3", Status: "published"},
			{ID: "a-sc-y3", ObjectiveID: "sc-y3", Status: "published"},
			{ID: "a-ma-y4", ObjectiveID: "ma-y4", Status: "published"},
		},
	}, "postgres")
	req := httptest.NewRequest(http.MethodPost, "/v1/students/alex-demo/baseline", strings.NewReader(`{"limit":6}`))
	res := httptest.NewRecorder()
	srv.ServeHTTP(res, req)
	if res.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d: %s", res.Code, res.Body.String())
	}
	var baseline learning.DiagnosticBaseline
	if err := json.NewDecoder(res.Body).Decode(&baseline); err != nil {
		t.Fatal(err)
	}
	if baseline.YearGroup != 3 || baseline.TotalItems != 3 || baseline.CurrentObjectiveID == "" {
		t.Fatalf("expected a three-subject Year 3 baseline, got %#v", baseline)
	}
}

func TestChooseAdaptiveActivityRoutesToMissingPrerequisite(t *testing.T) {
	activities := []learning.ActivityConfig{
		{ID: "target", ObjectiveID: "objective-target", Status: "published"},
		{ID: "prerequisite", ObjectiveID: "objective-prerequisite", Status: "published"},
	}
	objectives := []learning.Objective{
		{
			ID:            "objective-target",
			Year:          4,
			Prerequisites: []string{"objective-prerequisite"},
			Mastery:       learning.MasteryRule{Expected: 80},
		},
		{
			ID:      "objective-prerequisite",
			Year:    4,
			Mastery: learning.MasteryRule{Expected: 80},
		},
	}
	choice, ok := chooseAdaptiveActivity(
		activities,
		objectives,
		[]learning.StudentMastery{
			{ObjectiveID: "objective-target", Score: 20},
			{ObjectiveID: "objective-prerequisite", Score: 40},
		},
		nil,
		nil,
		nil,
		nil,
		nil,
		4,
	)
	if !ok || choice.Activity.ID != "prerequisite" || !choice.PrerequisiteProbe {
		t.Fatalf("expected prerequisite probe, got %#v", choice)
	}
}

func TestChooseAdaptiveActivityUsesTeacherAssignmentAfterDueReview(t *testing.T) {
	activities := []learning.ActivityConfig{
		{ID: "general", ObjectiveID: "objective-general", Status: "published"},
		{ID: "assigned", ObjectiveID: "objective-assigned", Status: "published"},
	}
	choice, ok := chooseAdaptiveActivity(
		activities,
		[]learning.Objective{{ID: "objective-general", Year: 4}, {ID: "objective-assigned", Year: 4}},
		nil,
		nil,
		nil,
		nil,
		[]learning.Assignment{{ObjectiveID: "objective-assigned", ActivityID: "assigned", Status: "active", Priority: 90}},
		nil,
		4,
	)
	if !ok || choice.Activity.ID != "assigned" || !strings.Contains(choice.Explanation, "teacher assigned") {
		t.Fatalf("expected teacher assignment to be selected, got %#v", choice)
	}
}

func TestChooseAdaptiveActivityUsesActiveInterventionBeforeAssignment(t *testing.T) {
	activities := []learning.ActivityConfig{
		{ID: "intervention", ObjectiveID: "objective-intervention", Status: "published"},
		{ID: "assigned", ObjectiveID: "objective-assigned", Status: "published"},
	}
	choice, ok := chooseAdaptiveActivity(
		activities,
		[]learning.Objective{{ID: "objective-intervention", Year: 4}, {ID: "objective-assigned", Year: 4}},
		nil,
		nil,
		nil,
		[]learning.InterventionPlan{{ObjectiveID: "objective-intervention", Status: "active", Strategy: "Use concrete arrays."}},
		[]learning.Assignment{{ObjectiveID: "objective-assigned", Status: "active"}},
		nil,
		4,
	)
	if !ok || choice.Activity.ID != "intervention" || !choice.Scaffold {
		t.Fatalf("expected active intervention to win, got %#v", choice)
	}
}

func TestHandleConfiguredMissionReturnsActivityAndQuestions(t *testing.T) {
	srv := New(fakeRepository{
		objectives: []learning.Objective{{ID: "ma-y4-test", Statement: "Test objective"}},
		worlds:     []learning.WorldConfig{{Key: "inventor-wilds", Name: "Inventor Wilds", Enabled: true}},
		activities: []learning.ActivityConfig{{
			ID:          "act-configured",
			ObjectiveID: "ma-y4-test",
			WorldKey:    "inventor-wilds",
			Title:       "Configured Activity",
			Status:      "published",
		}},
		engagement: learning.StudentEngagementProfile{
			StudentExternalRef: "alex-demo",
			LearningApproaches: []string{"short_bursts"},
			AttentionSupport:   "chunked",
			SessionLength:      "short",
		},
		questions: []learning.QuestionConfig{
			{ID: "q-live-1", ActivityID: "act-configured", ObjectiveID: "ma-y4-test", Format: "multiple_choice", Status: "published"},
			{ID: "q-live-2", ActivityID: "act-configured", ObjectiveID: "ma-y4-test", Format: "multiple_choice", Status: "published"},
			{ID: "q-live-3", ActivityID: "act-configured", ObjectiveID: "ma-y4-test", Format: "multiple_choice", Status: "published"},
			{ID: "q-live-4", ActivityID: "act-configured", ObjectiveID: "ma-y4-test", Format: "multiple_choice", Status: "published"},
			{ID: "q-live-5", ActivityID: "act-configured", ObjectiveID: "ma-y4-test", Format: "multiple_choice", Status: "published"},
			{ID: "q-live-6", ActivityID: "act-configured", ObjectiveID: "ma-y4-test", Format: "multiple_choice", Status: "published"},
			{ID: "q-draft", ActivityID: "act-configured", ObjectiveID: "ma-y4-test", Format: "multiple_choice", Status: "draft"},
		},
	}, "postgres")

	req := httptest.NewRequest(http.MethodGet, "/v1/learning/mission?studentId=alex-demo", nil)
	res := httptest.NewRecorder()
	srv.ServeHTTP(res, req)

	if res.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", res.Code)
	}
	var body struct {
		Activity            learning.ActivityConfig      `json:"activity"`
		Questions           []learning.QuestionConfig    `json:"questions"`
		AssessmentBlueprint learning.AssessmentBlueprint `json:"assessment_blueprint"`
		RuntimeAdaptations  learning.RuntimeAdaptations  `json:"runtime_adaptations"`
	}
	if err := json.NewDecoder(res.Body).Decode(&body); err != nil {
		t.Fatal(err)
	}
	if body.Activity.ID != "act-configured" || len(body.Questions) != 3 || body.Questions[0].ID != "q-live-1" {
		t.Fatalf("expected configured mission with published questions, got %#v", body)
	}
	if body.RuntimeAdaptations.QuestionLimit != 5 || body.RuntimeAdaptations.ScaffoldLevel != "chunked" {
		t.Fatalf("expected short-session mission adaptations, got %#v", body.RuntimeAdaptations)
	}
	if body.AssessmentBlueprint.Mode != "diagnostic" || body.AssessmentBlueprint.QuestionCount != 3 {
		t.Fatalf("expected an explainable diagnostic blueprint, got %#v", body.AssessmentBlueprint)
	}
}

func TestHandleConfiguredMissionCapsDiagnosticAtThreeQuestions(t *testing.T) {
	repo := fakeRepository{
		objectives: []learning.Objective{{ID: "ma-y4-test", Statement: "Test objective"}},
		worlds:     []learning.WorldConfig{{Key: "inventor-wilds", Name: "Inventor Wilds", Enabled: true}},
		activities: []learning.ActivityConfig{{
			ID:          "act-configured",
			ObjectiveID: "ma-y4-test",
			WorldKey:    "inventor-wilds",
			Status:      "published",
		}},
	}
	for index := 1; index <= 6; index++ {
		repo.questions = append(repo.questions, learning.QuestionConfig{
			ID:          "q-" + strconv.Itoa(index),
			ActivityID:  "act-configured",
			ObjectiveID: "ma-y4-test",
			Format:      "multiple_choice",
			Status:      "published",
		})
	}
	srv := New(repo, "postgres")
	req := httptest.NewRequest(http.MethodGet, "/v1/learning/mission?studentId=alex-demo&activityId=act-configured&mode=diagnostic", nil)
	res := httptest.NewRecorder()
	srv.ServeHTTP(res, req)
	if res.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", res.Code)
	}
	var body struct {
		Questions []learning.QuestionConfig `json:"questions"`
	}
	if err := json.NewDecoder(res.Body).Decode(&body); err != nil {
		t.Fatal(err)
	}
	if len(body.Questions) != 3 {
		t.Fatalf("expected diagnostic mission to contain three questions, got %d", len(body.Questions))
	}
}

func TestSelectMissionQuestionsBalancesFreshnessDifficultyAndFormat(t *testing.T) {
	candidates := []learning.QuestionConfig{
		{ID: "seen", Format: "multiple_choice", Difficulty: 5, Body: map[string]any{"prompt": "Seen prompt"}, ExpectedAnswer: map[string]any{"value": 4}},
		{ID: "fresh-choice", Format: "multiple_choice", Difficulty: 6, Body: map[string]any{"prompt": "Fresh choice"}, ExpectedAnswer: map[string]any{"value": 6}},
		{ID: "fresh-build", Format: "array-build", Difficulty: 6, Body: map[string]any{"prompt": "Build it"}, ExpectedAnswer: map[string]any{"value": 8}},
		{ID: "too-hard", Format: "short-response", Difficulty: 10, Body: map[string]any{"prompt": "Transfer"}, ExpectedAnswer: map[string]any{"value": 12}},
	}
	selected, blueprint := selectMissionQuestions(
		candidates,
		[]learning.RecentAttempt{{QuestionID: "seen", ObjectiveID: "objective", Correct: true}},
		learning.StudentMastery{ObjectiveID: "objective", Score: 65, EvidenceCount: 4},
		"practice",
		2,
		5,
		learning.RuntimeAdaptations{},
	)
	if len(selected) != 2 || selected[0].ID != "fresh-build" && selected[1].ID != "fresh-build" {
		t.Fatalf("expected fresh format-diverse questions, got %#v", selected)
	}
	if selected[0].ID == "seen" || selected[1].ID == "seen" {
		t.Fatalf("expected recent exposure to be held back, got %#v", selected)
	}
	if len(blueprint.Formats) != 2 || blueprint.TargetDifficulty != 6 {
		t.Fatalf("expected a difficulty-six mixed-format blueprint, got %#v", blueprint)
	}
}

func TestSelectMissionQuestionsPrioritisesConfiguredAccessFormats(t *testing.T) {
	candidates := []learning.QuestionConfig{
		{ID: "trace", Format: "trace-path", Difficulty: 5, Body: map[string]any{"prompt": "Trace it"}, ExpectedAnswer: map[string]any{"value": "done"}},
		{ID: "choice", Format: "multiple_choice", Difficulty: 5, Body: map[string]any{"prompt": "Choose it"}, ExpectedAnswer: map[string]any{"value": "a"}},
		{ID: "drag", Format: "drag-drop", Difficulty: 5, Body: map[string]any{"prompt": "Drag it"}, ExpectedAnswer: map[string]any{"value": "a"}},
	}
	selected, blueprint := selectMissionQuestions(
		candidates,
		nil,
		learning.StudentMastery{ObjectiveID: "objective", Score: 50, EvidenceCount: 2},
		"practice",
		1,
		5,
		learning.RuntimeAdaptations{
			PreferredFormats: []string{"multiple-choice"},
			AvoidFormats:     []string{"trace-path", "drag-drop"},
		},
	)
	if len(selected) != 1 || selected[0].ID != "choice" {
		t.Fatalf("expected direct-choice access format, got %#v", selected)
	}
	if !strings.Contains(selected[0].SelectionReason, "configured access method") {
		t.Fatalf("expected access rationale on selected question, got %q", selected[0].SelectionReason)
	}
	if len(blueprint.Rationale) < 4 {
		t.Fatalf("expected access-plan rationale in blueprint, got %#v", blueprint)
	}
}

func TestRuntimeAdaptationsExecuteExplicitSpecialistControls(t *testing.T) {
	adaptations := runtimeAdaptationsFromProfile(learning.StudentEngagementProfile{
		StudentExternalRef:   "ava-y1",
		DeclaredSupportNeeds: []string{"fine_motor", "dyslexia"},
		LearningApproaches:   []string{"visual_steps", "simple_text", "high_contrast", "switch_access"},
		CommunicationSupport: "visual",
	})
	if !adaptations.SimpleText || !adaptations.VisualGuide || !adaptations.HighContrast || !adaptations.LargeTargets || !adaptations.SwitchAccess {
		t.Fatalf("expected configured specialist controls to execute, got %#v", adaptations)
	}
	if !containsAccessFormat(adaptations.PreferredFormats, "multiple_choice") || !containsAccessFormat(adaptations.AvoidFormats, "trace-path") {
		t.Fatalf("expected switch-safe interaction priorities, got %#v", adaptations)
	}
}

func TestHandleConfiguredMissionRejectsUnknownAssessmentMode(t *testing.T) {
	srv := New(fakeRepository{}, "postgres")
	req := httptest.NewRequest(http.MethodGet, "/v1/learning/mission?studentId=alex-demo&mode=guesswork", nil)
	res := httptest.NewRecorder()
	srv.ServeHTTP(res, req)
	if res.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 for unknown assessment mode, got %d", res.Code)
	}
}

func TestHandleConfiguredMissionRejectsDraftActivityByID(t *testing.T) {
	srv := New(fakeRepository{
		activities: []learning.ActivityConfig{{
			ID:          "act-draft",
			ObjectiveID: "ma-y4-draft",
			WorldKey:    "inventor-wilds",
			Title:       "Draft Activity",
			Status:      "draft",
		}},
	}, "postgres")

	req := httptest.NewRequest(http.MethodGet, "/v1/learning/mission?studentId=alex-demo&activityId=act-draft", nil)
	res := httptest.NewRecorder()
	srv.ServeHTTP(res, req)

	if res.Code != http.StatusNotFound {
		t.Fatalf("expected 404 for draft runtime activity, got %d", res.Code)
	}
}

func TestHandleConfiguredMissionRespectsAdvancedRendererFlag(t *testing.T) {
	repo := fakeRepository{
		objectives: []learning.Objective{{ID: "sc-y4-circuits", Statement: "Build simple circuits"}},
		worlds:     []learning.WorldConfig{{Key: "inventor-wilds", Name: "Inventor Wilds", Enabled: true}},
		activities: []learning.ActivityConfig{{
			ID:          "act-circuit",
			ObjectiveID: "sc-y4-circuits",
			WorldKey:    "inventor-wilds",
			Title:       "Circuit Lab",
			Status:      "published",
		}},
		questions: []learning.QuestionConfig{
			{ID: "q-choice", ActivityID: "act-circuit", ObjectiveID: "sc-y4-circuits", Format: "multiple_choice", Status: "published"},
			{ID: "q-circuit", ActivityID: "act-circuit", ObjectiveID: "sc-y4-circuits", Format: "circuit-builder", Status: "published"},
		},
	}
	srv := New(repo, "postgres")
	req := httptest.NewRequest(http.MethodGet, "/v1/learning/mission?studentId=alex-demo", nil)
	res := httptest.NewRecorder()
	srv.ServeHTTP(res, req)
	if res.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", res.Code)
	}
	var body struct {
		Questions []learning.QuestionConfig `json:"questions"`
	}
	if err := json.NewDecoder(res.Body).Decode(&body); err != nil {
		t.Fatal(err)
	}
	if len(body.Questions) != 1 || body.Questions[0].ID != "q-choice" {
		t.Fatalf("expected advanced renderer to be held back by default, got %#v", body.Questions)
	}

	repo.flags = []learning.FeatureFlag{{Key: "advanced_interaction_renderers_enabled", Enabled: true}}
	srv = New(repo, "postgres")
	req = httptest.NewRequest(http.MethodGet, "/v1/learning/mission?studentId=alex-demo", nil)
	res = httptest.NewRecorder()
	srv.ServeHTTP(res, req)
	if res.Code != http.StatusOK {
		t.Fatalf("expected 200 with flag enabled, got %d", res.Code)
	}
	if err := json.NewDecoder(res.Body).Decode(&body); err != nil {
		t.Fatal(err)
	}
	if len(body.Questions) != 2 || body.Questions[1].ID != "q-circuit" {
		t.Fatalf("expected advanced renderer when flag enabled, got %#v", body.Questions)
	}

	repo.flags = []learning.FeatureFlag{{
		Key:     "advanced_interaction_renderers_enabled",
		Enabled: false,
		Config:  map[string]any{"pilot_school_urns": []any{"nexus-primary"}},
	}}
	repo.classes = []learning.ClassConfig{{
		SchoolURN: "nexus-primary",
		Students:  []learning.StudentProfileConfig{{ExternalRef: "alex-demo"}},
	}}
	srv = New(repo, "postgres")
	req = httptest.NewRequest(http.MethodGet, "/v1/learning/mission?studentId=alex-demo", nil)
	res = httptest.NewRecorder()
	srv.ServeHTTP(res, req)
	if res.Code != http.StatusOK {
		t.Fatalf("expected 200 with school pilot flag, got %d", res.Code)
	}
	if err := json.NewDecoder(res.Body).Decode(&body); err != nil {
		t.Fatal(err)
	}
	if len(body.Questions) != 2 || body.Questions[1].ID != "q-circuit" {
		t.Fatalf("expected school pilot to allow advanced renderer, got %#v", body.Questions)
	}

	repo.flags = []learning.FeatureFlag{{
		Key:     "advanced_interaction_renderers_enabled",
		Enabled: true,
		Config:  map[string]any{"blocked_school_urns": []any{"nexus-primary"}},
	}}
	srv = New(repo, "postgres")
	req = httptest.NewRequest(http.MethodGet, "/v1/learning/mission?studentId=alex-demo", nil)
	res = httptest.NewRecorder()
	srv.ServeHTTP(res, req)
	if res.Code != http.StatusOK {
		t.Fatalf("expected 200 with blocked school flag, got %d", res.Code)
	}
	if err := json.NewDecoder(res.Body).Decode(&body); err != nil {
		t.Fatal(err)
	}
	if len(body.Questions) != 1 || body.Questions[0].ID != "q-choice" {
		t.Fatalf("expected blocked school to hold back advanced renderer, got %#v", body.Questions)
	}
}

func TestLearnerEndpointsCanRequireSignedPupilSession(t *testing.T) {
	t.Setenv("PUPIL_SESSION_SECRET", "test-pupil-session-secret")
	t.Setenv("REQUIRE_PUPIL_SESSION", "true")
	repo := fakeRepository{
		objectives: []learning.Objective{{ID: "ma-y1-counting", Statement: "Count within 100"}},
		worlds:     []learning.WorldConfig{{Key: "wonder-garden", Name: "Wonder Garden", Enabled: true}},
		activities: []learning.ActivityConfig{{
			ID:          "act-counting",
			ObjectiveID: "ma-y1-counting",
			WorldKey:    "wonder-garden",
			Title:       "Counting path",
			Status:      "published",
		}},
		questions: []learning.QuestionConfig{{ID: "q-count", ActivityID: "act-counting", ObjectiveID: "ma-y1-counting", Format: "multiple_choice", Status: "published"}},
	}
	srv := New(repo, "postgres")

	req := httptest.NewRequest(http.MethodGet, "/v1/learning/mission?studentId=ava-y1", nil)
	res := httptest.NewRecorder()
	srv.ServeHTTP(res, req)
	if res.Code != http.StatusUnauthorized {
		t.Fatalf("expected missing pupil session to be rejected, got %d", res.Code)
	}

	session := srv.createPupilSession("ava-y1")
	req = httptest.NewRequest(http.MethodGet, "/v1/learning/mission?studentId=ava-y1", nil)
	req.Header.Set("X-Pupil-Session", session.Token)
	res = httptest.NewRecorder()
	srv.ServeHTTP(res, req)
	if res.Code != http.StatusOK {
		t.Fatalf("expected matching pupil session to pass, got %d", res.Code)
	}

	otherSession := srv.createPupilSession("other-y1")
	req = httptest.NewRequest(http.MethodGet, "/v1/learning/mission?studentId=ava-y1", nil)
	req.Header.Set("X-Pupil-Session", otherSession.Token)
	res = httptest.NewRecorder()
	srv.ServeHTTP(res, req)
	if res.Code != http.StatusForbidden {
		t.Fatalf("expected mismatched pupil session to be forbidden, got %d", res.Code)
	}
}

func TestHandleDiagnosticsUsesRepository(t *testing.T) {
	t.Setenv("ADMIN_API_KEY", "test-admin")
	srv := New(fakeRepository{
		diagnostics: learning.Diagnostics{
			Persistence:       "postgres",
			SchemaVersion:     "0002_review_queue_integrity",
			ReviewQueueStatus: "deduped",
		},
	}, "postgres")

	req := httptest.NewRequest(http.MethodGet, "/v1/system/diagnostics", nil)
	req.Header.Set("X-Admin-Key", "test-admin")
	res := httptest.NewRecorder()
	srv.ServeHTTP(res, req)

	if res.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", res.Code)
	}

	var body learning.Diagnostics
	if err := json.NewDecoder(res.Body).Decode(&body); err != nil {
		t.Fatal(err)
	}
	if body.ReviewQueueStatus != "deduped" {
		t.Fatalf("expected repository diagnostics, got %#v", body)
	}
}

func TestAdminEndpointsRequireKey(t *testing.T) {
	t.Setenv("ADMIN_API_KEY", "test-admin")
	srv := New(fakeRepository{}, "postgres")

	req := httptest.NewRequest(http.MethodGet, "/v1/admin/config", nil)
	res := httptest.NewRecorder()
	srv.ServeHTTP(res, req)

	if res.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", res.Code)
	}
}

func TestHandleAdminUpsertObjectiveUsesRepository(t *testing.T) {
	t.Setenv("ADMIN_API_KEY", "test-admin")
	srv := New(fakeRepository{}, "postgres")

	req := httptest.NewRequest(http.MethodPut, "/v1/admin/curriculum/objectives/ma-y4-test", strings.NewReader(`{
		"year":4,
		"subject":"Mathematics",
		"strand":"Number",
		"topic":"Test",
		"statement":"Test objective.",
		"mastery":{"expected":80,"secure":90,"retention_days":[1,3,7],"required_formats":["timed-recall"]}
	}`))
	req.Header.Set("X-Admin-Key", "test-admin")
	res := httptest.NewRecorder()
	srv.ServeHTTP(res, req)

	if res.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", res.Code)
	}

	var body learning.Objective
	if err := json.NewDecoder(res.Body).Decode(&body); err != nil {
		t.Fatal(err)
	}
	if body.ID != "ma-y4-test" {
		t.Fatalf("expected objective id from path, got %#v", body)
	}
}

func TestHandleAdminUpsertQuestionUsesRepository(t *testing.T) {
	t.Setenv("ADMIN_API_KEY", "test-admin")
	srv := New(fakeRepository{}, "postgres")

	req := httptest.NewRequest(http.MethodPut, "/v1/admin/content/questions/q1", strings.NewReader(`{
		"activity_id":"act-1",
		"objective_id":"ma-y4-test",
		"format":"timed-recall",
		"body":{"a":7,"b":8},
		"expected_answer":{"value":56},
		"hints":["Build 7 rows of 8."],
		"explanation":"7 x 8 is 56.",
		"difficulty":6,
		"status":"draft"
	}`))
	req.Header.Set("X-Admin-Key", "test-admin")
	res := httptest.NewRecorder()
	srv.ServeHTTP(res, req)

	if res.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", res.Code)
	}

	var body learning.QuestionConfig
	if err := json.NewDecoder(res.Body).Decode(&body); err != nil {
		t.Fatal(err)
	}
	if body.ID != "q1" || body.ExpectedAnswer["value"] == nil {
		t.Fatalf("expected question from repository, got %#v", body)
	}
}

func TestHandleAdminContentReadinessSummarizesCoverage(t *testing.T) {
	t.Setenv("ADMIN_API_KEY", "test-admin")
	srv := New(fakeRepository{
		objectives: []learning.Objective{{
			ID:                "ma-y4-times-tables",
			Year:              4,
			Subject:           "Mathematics",
			Strand:            "Number",
			Topic:             "Multiplication",
			Statement:         "Recall multiplication facts up to 12 x 12.",
			Prerequisites:     []string{"equal groups"},
			Misconceptions:    []string{"commutativity confusion"},
			ParentExplanation: "Practise facts in short bursts.",
			TeacherEvidence:   "Accurate recall across formats.",
			Mastery: learning.MasteryRule{
				Expected:        80,
				Secure:          90,
				RetentionDays:   []int{1, 3, 7},
				RequiredFormats: []string{"timed-recall", "multiple_choice"},
			},
		}},
		activities: []learning.ActivityConfig{{
			ID:             "act-times-table-forge",
			ObjectiveID:    "ma-y4-times-tables",
			TemplateID:     "interactive-array-builder",
			WorldKey:       "inventor-wilds",
			Title:          "Array forge",
			Prompt:         "Build the fact, say the pattern, then answer.",
			Difficulty:     4,
			Interaction:    map[string]any{"type": "multiple_choice", "scaffold": true},
			Feedback:       map[string]any{"companion_prompt": "Teach me the pattern."},
			AnimationHooks: map[string]any{"primary": "forge-light", "reward": "gear-spin"},
			Status:         "published",
		}},
		questions: []learning.QuestionConfig{
			{ID: "q1", ActivityID: "act-times-table-forge", ObjectiveID: "ma-y4-times-tables", Format: "timed-recall", Body: map[string]any{"a": 7}, ExpectedAnswer: map[string]any{"value": 56}, Hints: []string{"Use 7 x 8."}, Explanation: "7 x 8 is 56.", Status: "published"},
			{ID: "q2", ActivityID: "act-times-table-forge", ObjectiveID: "ma-y4-times-tables", Format: "multiple_choice", Body: map[string]any{"prompt": "7 x 8"}, ExpectedAnswer: map[string]any{"value": "56"}, Hints: []string{"Try double 7 x 4."}, Explanation: "Doubling 28 gives 56.", Status: "published"},
			{ID: "q3", ActivityID: "act-times-table-forge", ObjectiveID: "ma-y4-times-tables", Format: "multiple_choice", Body: map[string]any{"prompt": "8 x 7"}, ExpectedAnswer: map[string]any{"value": "56"}, Hints: []string{"Swap the factors."}, Explanation: "8 x 7 is the same as 7 x 8.", Status: "approved"},
		},
	}, "postgres")

	req := httptest.NewRequest(http.MethodGet, "/v1/admin/content/readiness", nil)
	req.Header.Set("X-Admin-Key", "test-admin")
	res := httptest.NewRecorder()
	srv.ServeHTTP(res, req)

	if res.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", res.Code)
	}

	var body struct {
		Totals struct {
			Objectives          int `json:"objectives"`
			Ready               int `json:"ready"`
			PublishedActivities int `json:"published_activities"`
			PublishedQuestions  int `json:"published_questions"`
			Formats             int `json:"formats"`
		} `json:"totals"`
		Items []contentReadinessItem `json:"items"`
	}
	if err := json.NewDecoder(res.Body).Decode(&body); err != nil {
		t.Fatal(err)
	}
	if body.Totals.Objectives != 1 || body.Totals.Ready != 1 || body.Totals.PublishedActivities != 1 || body.Totals.PublishedQuestions != 3 || body.Totals.Formats != 2 {
		t.Fatalf("expected ready coverage totals, got %#v", body.Totals)
	}
	if len(body.Items) != 1 || body.Items[0].Status != "ready" || body.Items[0].Score < 85 {
		t.Fatalf("expected ready item, got %#v", body.Items)
	}
}

func TestHandleAdminContentReadinessFlagsMissingTeachingEvidence(t *testing.T) {
	t.Setenv("ADMIN_API_KEY", "test-admin")
	srv := New(fakeRepository{
		objectives: []learning.Objective{{
			ID:        "en-y1-phonics",
			Year:      1,
			Subject:   "English",
			Strand:    "Reading",
			Topic:     "Phonics",
			Statement: "Blend sounds in simple words.",
			Mastery:   learning.MasteryRule{Expected: 75, Secure: 85},
		}},
		activities: []learning.ActivityConfig{{
			ID:          "act-phonics",
			ObjectiveID: "en-y1-phonics",
			TemplateID:  "audio-blend",
			WorldKey:    "storybook-kingdom",
			Title:       "Sound gate",
			Prompt:      "Blend the sounds.",
			Status:      "draft",
		}},
		questions: []learning.QuestionConfig{{
			ID:          "q-draft",
			ActivityID:  "act-phonics",
			ObjectiveID: "en-y1-phonics",
			Format:      "audio_blend",
			Status:      "draft",
		}},
	}, "postgres")

	req := httptest.NewRequest(http.MethodGet, "/v1/admin/content/readiness", nil)
	req.Header.Set("X-Admin-Key", "test-admin")
	res := httptest.NewRecorder()
	srv.ServeHTTP(res, req)

	if res.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", res.Code)
	}

	var body struct {
		Totals struct {
			Blocked int `json:"blocked"`
		} `json:"totals"`
		Items []contentReadinessItem `json:"items"`
	}
	if err := json.NewDecoder(res.Body).Decode(&body); err != nil {
		t.Fatal(err)
	}
	if body.Totals.Blocked != 1 || len(body.Items) != 1 || body.Items[0].Status != "blocked" {
		t.Fatalf("expected blocked readiness, got %#v", body)
	}
	if !containsString(body.Items[0].Missing, "published teaching activity") || !containsString(body.Items[0].Missing, "published assessment questions") {
		t.Fatalf("expected missing teaching and assessment evidence, got %#v", body.Items[0].Missing)
	}
}

func TestHandleAdminNarrationReadinessServesGeneratedReport(t *testing.T) {
	t.Setenv("ADMIN_API_KEY", "test-admin")
	reportPath := filepath.Join(t.TempDir(), "narration-readiness.json")
	if err := os.WriteFile(reportPath, []byte(`{"status":"production_gaps","totals":{"expected_assets":874,"technical_pass":874,"missing":0}}`), 0o600); err != nil {
		t.Fatal(err)
	}
	t.Setenv("NARRATION_READINESS_PATH", reportPath)
	srv := New(fakeRepository{}, "postgres")

	req := httptest.NewRequest(http.MethodGet, "/v1/admin/content/narration-readiness", nil)
	req.Header.Set("X-Admin-Key", "test-admin")
	res := httptest.NewRecorder()
	srv.ServeHTTP(res, req)

	if res.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", res.Code)
	}
	var body struct {
		Status   string `json:"status"`
		ServedBy string `json:"served_by"`
		Source   string `json:"source"`
		Totals   struct {
			ExpectedAssets int `json:"expected_assets"`
			TechnicalPass  int `json:"technical_pass"`
			Missing        int `json:"missing"`
		} `json:"totals"`
	}
	if err := json.NewDecoder(res.Body).Decode(&body); err != nil {
		t.Fatal(err)
	}
	if body.Status != "production_gaps" || body.ServedBy != "api" || body.Source != reportPath {
		t.Fatalf("expected API-served narration report metadata, got %#v", body)
	}
	if body.Totals.ExpectedAssets != 874 || body.Totals.TechnicalPass != 874 || body.Totals.Missing != 0 {
		t.Fatalf("expected narration totals, got %#v", body.Totals)
	}
}

func TestHandleAdminNarrationReadinessRequiresAdmin(t *testing.T) {
	t.Setenv("ADMIN_API_KEY", "test-admin")
	srv := New(fakeRepository{}, "postgres")

	req := httptest.NewRequest(http.MethodGet, "/v1/admin/content/narration-readiness", nil)
	res := httptest.NewRecorder()
	srv.ServeHTTP(res, req)

	if res.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", res.Code)
	}
}

func TestHandleAdminContentVersionsReturnsSnapshots(t *testing.T) {
	t.Setenv("ADMIN_API_KEY", "test-admin")
	srv := New(fakeRepository{
		versions: []learning.ContentVersion{{
			ID:          "version-1",
			ContentKey:  "ma-y4-times-tables",
			ContentType: "activity",
			Status:      "published",
			Version:     3,
			Payload:     map[string]any{"title": "Array forge"},
			CreatedAt:   "2026-06-17T10:00:00Z",
			PublishedAt: "2026-06-17T10:00:00Z",
		}},
	}, "postgres")

	req := httptest.NewRequest(http.MethodGet, "/v1/admin/content/versions", nil)
	req.Header.Set("X-Admin-Key", "test-admin")
	res := httptest.NewRecorder()
	srv.ServeHTTP(res, req)

	if res.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", res.Code)
	}

	var body struct {
		ContentVersions []learning.ContentVersion `json:"content_versions"`
	}
	if err := json.NewDecoder(res.Body).Decode(&body); err != nil {
		t.Fatal(err)
	}
	if len(body.ContentVersions) != 1 || body.ContentVersions[0].Version != 3 || body.ContentVersions[0].ContentType != "activity" {
		t.Fatalf("expected content version snapshot, got %#v", body.ContentVersions)
	}
}

func TestHandleAdminRestoreContentVersionUsesRepository(t *testing.T) {
	t.Setenv("ADMIN_API_KEY", "test-admin")
	srv := New(fakeRepository{
		versions: []learning.ContentVersion{{
			ID:          "version-1",
			ContentKey:  "ma-y4-times-tables",
			ContentType: "activity",
			Status:      "published",
			Version:     3,
		}},
	}, "postgres")

	req := httptest.NewRequest(http.MethodPost, "/v1/admin/content/versions?id=version-1", nil)
	req.Header.Set("X-Admin-Key", "test-admin")
	res := httptest.NewRecorder()
	srv.ServeHTTP(res, req)

	if res.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", res.Code, res.Body.String())
	}

	var body struct {
		Restored       bool                    `json:"restored"`
		ContentVersion learning.ContentVersion `json:"content_version"`
	}
	if err := json.NewDecoder(res.Body).Decode(&body); err != nil {
		t.Fatal(err)
	}
	if !body.Restored || body.ContentVersion.ID != "version-1" || body.ContentVersion.ContentType != "activity" {
		t.Fatalf("expected restored content version, got %#v", body)
	}
}

func TestHandleAdminUpsertStudentUsesRepository(t *testing.T) {
	t.Setenv("ADMIN_API_KEY", "test-admin")
	srv := New(fakeRepository{}, "postgres")

	req := httptest.NewRequest(http.MethodPut, "/v1/admin/students/ava-y1", strings.NewReader(`{
		"display_name":"Ava",
		"year_group":1
	}`))
	req.Header.Set("X-Admin-Key", "test-admin")
	res := httptest.NewRecorder()
	srv.ServeHTTP(res, req)

	if res.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", res.Code)
	}

	var body learning.StudentProfileConfig
	if err := json.NewDecoder(res.Body).Decode(&body); err != nil {
		t.Fatal(err)
	}
	if body.ExternalRef != "ava-y1" || body.YearGroup != 1 {
		t.Fatalf("expected student from repository, got %#v", body)
	}
}

func TestHandleAdminUpsertSchoolClassAndCredentialUsesRepository(t *testing.T) {
	t.Setenv("ADMIN_API_KEY", "test-admin")
	srv := New(fakeRepository{}, "postgres")

	cases := []struct {
		method string
		path   string
		body   string
	}{
		{
			method: http.MethodPut,
			path:   "/v1/admin/schools/urn-100",
			body:   `{"name":"Nexus Primary","status":"trial"}`,
		},
		{
			method: http.MethodPut,
			path:   "/v1/admin/classes/class-1",
			body:   `{"school_urn":"urn-100","name":"Year 3 Falcon","year_group":3}`,
		},
		{
			method: http.MethodPut,
			path:   "/v1/admin/student-credentials/ava-y1",
			body:   `{"login_code":"AVA-123","picture_password":["sun","book"]}`,
		},
	}

	for _, tc := range cases {
		req := httptest.NewRequest(tc.method, tc.path, strings.NewReader(tc.body))
		req.Header.Set("X-Admin-Key", "test-admin")
		res := httptest.NewRecorder()
		srv.ServeHTTP(res, req)
		if res.Code != http.StatusOK {
			t.Fatalf("%s: expected 200, got %d", tc.path, res.Code)
		}
	}
}

func TestHandleAdminUpsertSchoolUserUsesRepository(t *testing.T) {
	t.Setenv("ADMIN_API_KEY", "test-admin")
	srv := New(fakeRepository{}, "postgres")

	req := httptest.NewRequest(http.MethodPut, "/v1/admin/schools/urn-100/users/lead@example.sch.uk", strings.NewReader(`{
		"display_name":"School Lead",
		"role":"school_admin",
		"status":"active"
	}`))
	req.Header.Set("X-Admin-Key", "test-admin")
	res := httptest.NewRecorder()
	srv.ServeHTTP(res, req)

	if res.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", res.Code)
	}
	var body learning.SchoolUserConfig
	if err := json.NewDecoder(res.Body).Decode(&body); err != nil {
		t.Fatal(err)
	}
	if body.SchoolURN != "urn-100" || body.Email != "lead@example.sch.uk" || body.TemporaryPassword == "" {
		t.Fatalf("expected school user with temporary credential, got %#v", body)
	}
}

func TestSchoolScopedEndpointsUseSchoolUserAndScope(t *testing.T) {
	srv := New(fakeRepository{
		verifySchool: true,
		schoolPortal: learning.SchoolPortalConfig{
			School:  learning.SchoolConfig{URN: "urn-100", Name: "Nexus Primary"},
			Classes: []learning.ClassConfig{{ID: "class-1", SchoolURN: "urn-100", Name: "Year 3", YearGroup: 3}},
			Groups:  []learning.LearningGroupConfig{{ID: "group-1", ClassID: "class-1", Name: "Phonics"}},
		},
	}, "postgres")

	req := httptest.NewRequest(http.MethodGet, "/v1/school/config", nil)
	req.Header.Set("X-School-URN", "urn-100")
	req.Header.Set("X-School-Login", "lead")
	req.Header.Set("X-School-Password", "secret")
	res := httptest.NewRecorder()
	srv.ServeHTTP(res, req)
	if res.Code != http.StatusOK {
		t.Fatalf("expected 200 for school config, got %d", res.Code)
	}

	req = httptest.NewRequest(http.MethodPut, "/v1/school/classes/class-2", strings.NewReader(`{
		"name":"Year 4 Falcons",
		"year_group":4
	}`))
	req.Header.Set("X-School-URN", "urn-100")
	req.Header.Set("X-School-Login", "lead")
	req.Header.Set("X-School-Password", "secret")
	res = httptest.NewRecorder()
	srv.ServeHTTP(res, req)
	if res.Code != http.StatusOK {
		t.Fatalf("expected 200 for school class upsert, got %d", res.Code)
	}
	var classBody learning.ClassConfig
	if err := json.NewDecoder(res.Body).Decode(&classBody); err != nil {
		t.Fatal(err)
	}
	if classBody.SchoolURN != "urn-100" || classBody.ID != "class-2" {
		t.Fatalf("expected scoped class response, got %#v", classBody)
	}
}

func TestSchoolScopedEndpointsApplyStaffRBAC(t *testing.T) {
	srv := New(fakeRepository{
		verifySchool: true,
		schoolRole:   "teacher",
		schoolPortal: learning.SchoolPortalConfig{
			School:  learning.SchoolConfig{URN: "urn-100", Name: "Nexus Primary"},
			Classes: []learning.ClassConfig{{ID: "class-1", SchoolURN: "urn-100", Name: "Year 3", YearGroup: 3}},
		},
	}, "postgres")

	req := httptest.NewRequest(http.MethodPut, "/v1/school/classes/class-2", strings.NewReader(`{
		"name":"Year 4 Falcons",
		"year_group":4
	}`))
	req.Header.Set("X-School-URN", "urn-100")
	req.Header.Set("X-School-Login", "teacher")
	req.Header.Set("X-School-Password", "secret")
	res := httptest.NewRecorder()
	srv.ServeHTTP(res, req)
	if res.Code != http.StatusForbidden {
		t.Fatalf("expected teacher to be forbidden from class setup, got %d", res.Code)
	}

	req = httptest.NewRequest(http.MethodPut, "/v1/school/classes/class-1/credentials", strings.NewReader(`{"overwrite":false}`))
	req.Header.Set("X-School-URN", "urn-100")
	req.Header.Set("X-School-Login", "teacher")
	req.Header.Set("X-School-Password", "secret")
	res = httptest.NewRecorder()
	srv.ServeHTTP(res, req)
	if res.Code != http.StatusForbidden {
		t.Fatalf("expected teacher to be forbidden from login batch generation, got %d", res.Code)
	}

	req = httptest.NewRequest(http.MethodPut, "/v1/school/groups/group-1", strings.NewReader(`{
		"class_id":"class-1",
		"name":"Reading boost",
		"purpose":"intervention"
	}`))
	req.Header.Set("X-School-URN", "urn-100")
	req.Header.Set("X-School-Login", "teacher")
	req.Header.Set("X-School-Password", "secret")
	res = httptest.NewRecorder()
	srv.ServeHTTP(res, req)
	if res.Code != http.StatusOK {
		t.Fatalf("expected teacher to manage teaching groups inside their school, got %d", res.Code)
	}

	req = httptest.NewRequest(http.MethodPost, "/v1/school/assignments", strings.NewReader(`{
		"student_external_ref":"ava-y3",
		"objective_id":"en-y3-reading",
		"title":"Inference repair",
		"priority":90
	}`))
	req.Header.Set("X-School-URN", "urn-100")
	req.Header.Set("X-School-Login", "teacher")
	req.Header.Set("X-School-Password", "secret")
	res = httptest.NewRecorder()
	srv.ServeHTTP(res, req)
	if res.Code != http.StatusCreated {
		t.Fatalf("expected teacher to assign learning priority, got %d", res.Code)
	}

	req = httptest.NewRequest(http.MethodPost, "/v1/school/evidence", strings.NewReader(`{
		"student_external_ref":"ava-y3",
		"objective_id":"en-y3-reading",
		"evidence_type":"observation",
		"outcome":"developing",
		"note":"Used two relevant clues independently."
	}`))
	req.Header.Set("X-School-URN", "urn-100")
	req.Header.Set("X-School-Login", "teacher")
	req.Header.Set("X-School-Password", "secret")
	res = httptest.NewRecorder()
	srv.ServeHTTP(res, req)
	if res.Code != http.StatusCreated {
		t.Fatalf("expected teacher to record moderated evidence, got %d", res.Code)
	}

	req = httptest.NewRequest(http.MethodPost, "/v1/school/interventions", strings.NewReader(`{
		"student_external_ref":"ava-y3",
		"objective_id":"en-y3-reading",
		"title":"Inference support",
		"need":"Selects evidence but does not explain it.",
		"strategy":"Use highlight then explain-back.",
		"priority":90
	}`))
	req.Header.Set("X-School-URN", "urn-100")
	req.Header.Set("X-School-Login", "teacher")
	req.Header.Set("X-School-Password", "secret")
	res = httptest.NewRecorder()
	srv.ServeHTTP(res, req)
	if res.Code != http.StatusCreated {
		t.Fatalf("expected teacher to create intervention, got %d", res.Code)
	}
}

func TestSchoolStudentEngagementRequiresSchoolPupilScope(t *testing.T) {
	unauthenticated := New(fakeRepository{}, "postgres")
	req := httptest.NewRequest(http.MethodGet, "/v1/school/students/ava-y3/engagement", nil)
	res := httptest.NewRecorder()
	unauthenticated.ServeHTTP(res, req)
	if res.Code != http.StatusUnauthorized {
		t.Fatalf("expected school authentication to be required, got %d", res.Code)
	}

	srv := New(fakeRepository{
		verifySchool: true,
		schoolRole:   "teacher",
		schoolPortal: learning.SchoolPortalConfig{
			School: learning.SchoolConfig{URN: "urn-100", Name: "Nexus Primary"},
			Classes: []learning.ClassConfig{{
				ID:        "class-1",
				SchoolURN: "urn-100",
				Students:  []learning.StudentProfileConfig{{ExternalRef: "ava-y3"}},
			}},
		},
		engagement: learning.StudentEngagementProfile{
			StudentExternalRef:   "ava-y3",
			DeclaredSupportNeeds: []string{"dyslexia"},
			LearningApproaches:   []string{"simple_text", "large_targets"},
			SessionLength:        "short",
		},
	}, "postgres")

	req = httptest.NewRequest(http.MethodGet, "/v1/school/students/ava-y3/engagement", nil)
	req.Header.Set("X-School-URN", "urn-100")
	req.Header.Set("X-School-Login", "senco")
	req.Header.Set("X-School-Password", "secret")
	res = httptest.NewRecorder()
	srv.ServeHTTP(res, req)
	if res.Code != http.StatusOK {
		t.Fatalf("expected school staff to read pupil engagement, got %d", res.Code)
	}
	var profile learning.StudentEngagementProfile
	if err := json.NewDecoder(res.Body).Decode(&profile); err != nil {
		t.Fatal(err)
	}
	if profile.StudentExternalRef != "ava-y3" || profile.SessionLength != "short" || len(profile.LearningApproaches) != 2 {
		t.Fatalf("unexpected engagement profile %#v", profile)
	}

	req = httptest.NewRequest(http.MethodGet, "/v1/school/students/outside-school/engagement", nil)
	req.Header.Set("X-School-URN", "urn-100")
	req.Header.Set("X-School-Login", "senco")
	req.Header.Set("X-School-Password", "secret")
	res = httptest.NewRecorder()
	srv.ServeHTTP(res, req)
	if res.Code != http.StatusForbidden {
		t.Fatalf("expected out-of-school pupil read to be forbidden, got %d", res.Code)
	}
}

func TestSchoolStudentEngagementPutUsesScopedPathPupil(t *testing.T) {
	srv := New(fakeRepository{
		verifySchool: true,
		schoolPortal: learning.SchoolPortalConfig{
			School: learning.SchoolConfig{URN: "urn-100", Name: "Nexus Primary"},
			Classes: []learning.ClassConfig{{
				ID:        "class-1",
				SchoolURN: "urn-100",
				Students:  []learning.StudentProfileConfig{{ExternalRef: "ava-y3"}},
			}},
		},
	}, "postgres")

	req := httptest.NewRequest(http.MethodPut, "/v1/school/students/ava-y3/engagement", strings.NewReader(`{
		"student_external_ref":"outside-school",
		"declared_support_needs":["fine_motor"],
		"learning_approaches":["simplified_controls","switch_access"],
		"celebration_intensity":"quiet",
		"audio_support":true,
		"reading_support":true,
		"session_length":"short",
		"sensory_load":"low",
		"attention_support":"high_structure",
		"communication_support":"visual",
		"processing_support":"step_by_step",
		"confidence_support":"gentle",
		"companion_style":"calm",
		"reward_style":"story",
		"interests":["space"],
		"notes":"Use the switch mount on the left."
	}`))
	req.Header.Set("X-School-URN", "urn-100")
	req.Header.Set("X-School-Login", "lead")
	req.Header.Set("X-School-Password", "secret")
	res := httptest.NewRecorder()
	srv.ServeHTTP(res, req)
	if res.Code != http.StatusOK {
		t.Fatalf("expected school engagement update, got %d: %s", res.Code, res.Body.String())
	}
	var profile learning.StudentEngagementProfile
	if err := json.NewDecoder(res.Body).Decode(&profile); err != nil {
		t.Fatal(err)
	}
	if profile.StudentExternalRef != "ava-y3" || !profile.AudioSupport || !profile.ReadingSupport {
		t.Fatalf("expected path-scoped engagement profile, got %#v", profile)
	}
	if len(profile.LearningApproaches) != 2 || profile.LearningApproaches[1] != "switch_access" {
		t.Fatalf("expected access approaches to be preserved, got %#v", profile.LearningApproaches)
	}
}

func TestHandleAdminAssignStudentToClassUsesRepository(t *testing.T) {
	t.Setenv("ADMIN_API_KEY", "test-admin")
	srv := New(fakeRepository{}, "postgres")

	req := httptest.NewRequest(http.MethodPut, "/v1/admin/classes/class-1/students/ava-y1", nil)
	req.Header.Set("X-Admin-Key", "test-admin")
	res := httptest.NewRecorder()
	srv.ServeHTTP(res, req)

	if res.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", res.Code)
	}
	var body learning.ClassConfig
	if err := json.NewDecoder(res.Body).Decode(&body); err != nil {
		t.Fatal(err)
	}
	if body.ID != "class-1" || len(body.Students) != 1 || body.Students[0].ExternalRef != "ava-y1" {
		t.Fatalf("expected class assignment response, got %#v", body)
	}
}

func TestHandleAdminGenerateClassCredentialsUsesRepository(t *testing.T) {
	t.Setenv("ADMIN_API_KEY", "test-admin")
	srv := New(fakeRepository{}, "postgres")

	req := httptest.NewRequest(http.MethodPut, "/v1/admin/classes/class-1/credentials", strings.NewReader(`{"overwrite":true,"picture_pool":["sun","book","star"]}`))
	req.Header.Set("X-Admin-Key", "test-admin")
	res := httptest.NewRecorder()
	srv.ServeHTTP(res, req)

	if res.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", res.Code)
	}
	var body learning.ClassCredentialBatch
	if err := json.NewDecoder(res.Body).Decode(&body); err != nil {
		t.Fatal(err)
	}
	if body.ClassID != "class-1" || body.GeneratedCount != 1 || !body.Overwrite {
		t.Fatalf("expected credential batch response, got %#v", body)
	}
}

func TestHandlePupilLoginVerifiesCredentialAndReturnsRoute(t *testing.T) {
	t.Setenv("PUPIL_SESSION_SECRET", "test-pupil-session-secret")
	srv := New(fakeRepository{
		students: []learning.StudentProfileConfig{{ExternalRef: "ava-y1", DisplayName: "Ava", YearGroup: 1}},
		credentials: []learning.StudentCredentialConfig{{
			StudentExternalRef: "ava-y1",
			DisplayName:        "Ava",
			LoginCode:          "AVA-123",
			PicturePassword:    []string{"sun", "book", "star"},
			QRSecretHash:       "card-secret",
		}},
		worlds: []learning.WorldConfig{{Key: "wonder-garden", Name: "Wonder Garden", YearGroup: 1, Enabled: true}},
		activities: []learning.ActivityConfig{{
			ID:          "counting-1",
			ObjectiveID: "y1-maths-counting",
			WorldKey:    "wonder-garden",
			Title:       "Counting path",
			Status:      "published",
		}},
		objectives: []learning.Objective{{ID: "y1-maths-counting", Year: 1, Subject: "Mathematics", Statement: "Count forwards and backwards."}},
	}, "postgres")

	req := httptest.NewRequest(http.MethodPost, "/v1/auth/pupil-login", strings.NewReader(`{
		"student_external_ref":"ava-y1",
		"login_code":"ava-123",
		"picture_password":["sun","book","star"],
		"qr_secret_hash":"card-secret"
	}`))
	res := httptest.NewRecorder()
	srv.ServeHTTP(res, req)

	if res.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", res.Code)
	}
	var body struct {
		Student      learning.StudentProfileConfig `json:"student"`
		Session      pupilSession                  `json:"session"`
		NextActivity learning.NextActivityDecision `json:"next_activity"`
	}
	if err := json.NewDecoder(res.Body).Decode(&body); err != nil {
		t.Fatal(err)
	}
	if body.Student.ExternalRef != "ava-y1" || body.NextActivity.ActivityID != "counting-1" {
		t.Fatalf("expected pupil profile and next route, got %#v", body)
	}
	if !body.Session.Configured || body.Session.TokenType != "pupil" || body.Session.ExpiresAt == "" || strings.Count(body.Session.Token, ".") != 1 {
		t.Fatalf("expected signed pupil session, got %#v", body.Session)
	}
}

func TestHandlePupilLoginRejectsWrongPicturePassword(t *testing.T) {
	srv := New(fakeRepository{
		credentials: []learning.StudentCredentialConfig{{
			StudentExternalRef: "ava-y1",
			LoginCode:          "AVA-123",
			PicturePassword:    []string{"sun", "book", "star"},
		}},
	}, "postgres")

	req := httptest.NewRequest(http.MethodPost, "/v1/auth/pupil-login", strings.NewReader(`{
		"student_external_ref":"ava-y1",
		"login_code":"AVA-123",
		"picture_password":["sun","star","book"]
	}`))
	res := httptest.NewRecorder()
	srv.ServeHTTP(res, req)

	if res.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", res.Code)
	}
}

func TestHandleAdminGroupEndpointsUseRepository(t *testing.T) {
	t.Setenv("ADMIN_API_KEY", "test-admin")
	srv := New(fakeRepository{}, "postgres")

	req := httptest.NewRequest(http.MethodPut, "/v1/admin/groups/group-1", strings.NewReader(`{
		"class_id":"class-1",
		"name":"Fraction repair",
		"purpose":"intervention"
	}`))
	req.Header.Set("X-Admin-Key", "test-admin")
	res := httptest.NewRecorder()
	srv.ServeHTTP(res, req)
	if res.Code != http.StatusOK {
		t.Fatalf("expected 200 for group upsert, got %d", res.Code)
	}

	req = httptest.NewRequest(http.MethodPut, "/v1/admin/groups/group-1/students/ava-y1", nil)
	req.Header.Set("X-Admin-Key", "test-admin")
	res = httptest.NewRecorder()
	srv.ServeHTTP(res, req)
	if res.Code != http.StatusOK {
		t.Fatalf("expected 200 for group assignment, got %d", res.Code)
	}
}

func TestHandleAdminParentLinkUsesRepository(t *testing.T) {
	t.Setenv("ADMIN_API_KEY", "test-admin")
	srv := New(fakeRepository{}, "postgres")

	req := httptest.NewRequest(http.MethodPut, "/v1/admin/parent-links/ava-y1", strings.NewReader(`{
		"parent_email":"parent@example.com",
		"parent_display_name":"Ava Parent",
		"relationship":"parent",
		"status":"invited"
	}`))
	req.Header.Set("X-Admin-Key", "test-admin")
	res := httptest.NewRecorder()
	srv.ServeHTTP(res, req)

	if res.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", res.Code)
	}
	var body learning.ParentLinkConfig
	if err := json.NewDecoder(res.Body).Decode(&body); err != nil {
		t.Fatal(err)
	}
	if body.StudentExternalRef != "ava-y1" || body.ParentEmail != "parent@example.com" {
		t.Fatalf("expected parent link response, got %#v", body)
	}
}

func TestHandleParentSignupAndChildProfileUseRepository(t *testing.T) {
	t.Setenv("ACCOUNT_SESSION_SECRET", "test-account-session-secret")
	srv := New(fakeRepository{
		verifyParent: true,
		parentPortal: learning.ParentPortalConfig{
			Parent: learning.ParentAccountConfig{Email: "parent@example.com", LoginID: "parent@example.com", DisplayName: "Parent"},
		},
	}, "postgres")

	req := httptest.NewRequest(http.MethodPost, "/v1/parents/signup", strings.NewReader(`{
		"email":"parent@example.com",
		"display_name":"Ava Parent",
		"password":"secure-pass"
	}`))
	res := httptest.NewRecorder()
	srv.ServeHTTP(res, req)
	if res.Code != http.StatusCreated {
		t.Fatalf("expected 201 for signup, got %d", res.Code)
	}

	req = httptest.NewRequest(http.MethodPut, "/v1/parent/children/ava-home", strings.NewReader(`{
		"display_name":"Ava",
		"year_group":2,
		"engagement":{
			"declared_support_needs":["adhd","dyslexia"],
			"learning_approaches":["short_bursts","visual_steps","audio_read_aloud"],
			"celebration_intensity":"quiet",
			"audio_support":true,
			"reading_support":true,
			"session_length":"short",
			"sensory_load":"low",
			"attention_support":"chunked",
			"communication_support":"audio_visual",
			"processing_support":"step_by_step",
			"confidence_support":"gentle",
			"companion_style":"calm",
			"reward_style":"story",
			"interests":["space","music"]
		}
	}`))
	req.Header.Set("X-Parent-Login", "parent@example.com")
	req.Header.Set("X-Parent-Password", "secure-pass")
	res = httptest.NewRecorder()
	srv.ServeHTTP(res, req)
	if res.Code != http.StatusOK {
		t.Fatalf("expected 200 for child profile, got %d", res.Code)
	}
	var body learning.ParentChildConfig
	if err := json.NewDecoder(res.Body).Decode(&body); err != nil {
		t.Fatal(err)
	}
	if body.Student.ExternalRef != "ava-home" || body.Engagement.SensoryLoad != "low" || len(body.Engagement.DeclaredSupportNeeds) != 2 {
		t.Fatalf("expected child support profile response, got %#v", body)
	}
}

func TestHandleParentChildEvidenceIsScopedToParent(t *testing.T) {
	repo := fakeRepository{
		verifyParent: true,
		parentPortal: learning.ParentPortalConfig{
			Parent: learning.ParentAccountConfig{Email: "parent@example.com", LoginID: "parent@example.com", DisplayName: "Parent"},
			Children: []learning.ParentChildConfig{{
				Student:    learning.StudentProfileConfig{ExternalRef: "ava-home", DisplayName: "Ava", YearGroup: 2},
				Credential: learning.StudentCredentialConfig{StudentExternalRef: "ava-home", LoginCode: "AVA-1"},
				Engagement: learning.StudentEngagementProfile{StudentExternalRef: "ava-home", SessionLength: "short"},
			}},
		},
		mastery: []learning.StudentMastery{{
			StudentID:   "ava-home",
			ObjectiveID: "ma-y2-add",
			Score:       72,
			Band:        "Nearly secure",
		}},
		attempts: []learning.RecentAttempt{{
			StudentID:   "ava-home",
			ObjectiveID: "ma-y2-add",
			QuestionID:  "q1",
			Correct:     true,
		}},
		summary: learning.EvidenceSummary{StudentID: "ava-home", Attempts7Days: 4, Correct7Days: 3, Accuracy7Days: 75, Bands: map[string]int{"Nearly secure": 1}},
		objectives: []learning.Objective{{
			ID: "ma-y2-add", Year: 2, Subject: "Mathematics", Strand: "Number", Topic: "Addition", Statement: "Add two-digit numbers.",
		}},
		worlds: []learning.WorldConfig{{
			Key: "story-kingdom", Name: "Story Kingdom", YearGroup: 2, Enabled: true, Config: map[string]any{"realm": "Story Kingdom"},
		}},
		activities: []learning.ActivityConfig{{
			ID: "act-y2-add", ObjectiveID: "ma-y2-add", WorldKey: "story-kingdom", Title: "Bridge Builder", Difficulty: 2, Status: "published",
			Interaction: map[string]any{"type": "numeric-array"}, Feedback: map[string]any{"selection_reason": "Next parent-visible route."},
		}},
	}
	srv := New(repo, "postgres")

	req := httptest.NewRequest(http.MethodGet, "/v1/parent/children/ava-home/evidence", nil)
	req.Header.Set("X-Parent-Login", "parent@example.com")
	req.Header.Set("X-Parent-Password", "secure-pass")
	res := httptest.NewRecorder()
	srv.ServeHTTP(res, req)

	if res.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", res.Code)
	}
	var body struct {
		Child        learning.ParentChildConfig     `json:"child"`
		Mastery      []learning.StudentMastery      `json:"mastery"`
		Attempts     []learning.RecentAttempt       `json:"attempts"`
		Summary      learning.EvidenceSummary       `json:"summary"`
		NextActivity *learning.NextActivityDecision `json:"next_activity"`
	}
	if err := json.NewDecoder(res.Body).Decode(&body); err != nil {
		t.Fatal(err)
	}
	if body.Child.Student.ExternalRef != "ava-home" || len(body.Mastery) != 1 || body.Summary.Accuracy7Days != 75 || body.NextActivity == nil || body.NextActivity.ActivityID != "act-y2-add" {
		t.Fatalf("expected scoped parent evidence payload, got %#v", body)
	}

	req = httptest.NewRequest(http.MethodGet, "/v1/parent/children/not-this-parent/evidence", nil)
	req.Header.Set("X-Parent-Login", "parent@example.com")
	req.Header.Set("X-Parent-Password", "secure-pass")
	res = httptest.NewRecorder()
	srv.ServeHTTP(res, req)
	if res.Code != http.StatusForbidden {
		t.Fatalf("expected 403 for unlinked child, got %d", res.Code)
	}

	unauthorised := New(fakeRepository{}, "postgres")
	req = httptest.NewRequest(http.MethodGet, "/v1/parent/children/ava-home/evidence", nil)
	res = httptest.NewRecorder()
	unauthorised.ServeHTTP(res, req)
	if res.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401 without parent credentials, got %d", res.Code)
	}
}

func TestAccountSessionsAuthorizeNamedUsersAndLogout(t *testing.T) {
	t.Setenv("ACCOUNT_SESSION_SECRET", "test-account-session-secret")
	t.Setenv("ALLOW_LEGACY_CREDENTIAL_HEADERS", "false")
	repo := fakeRepository{
		platformUser: learning.PlatformUserConfig{
			ID: "admin-1", LoginID: "admin@example.com", DisplayName: "Admin",
			Roles: []string{"platform_admin"}, Status: "active",
		},
		accountSession: learning.AccountSession{
			UserID: "admin-1", LoginID: "admin@example.com", Role: "platform_admin",
		},
	}
	srv := New(repo, "postgres")

	req := httptest.NewRequest(http.MethodPost, "/v1/auth/admin-login", strings.NewReader(`{
		"login_id":"admin@example.com",
		"password":"a-secure-password"
	}`))
	res := httptest.NewRecorder()
	srv.ServeHTTP(res, req)
	if res.Code != http.StatusOK {
		t.Fatalf("expected admin login 200, got %d: %s", res.Code, res.Body.String())
	}
	var login struct {
		Session accountSessionResult `json:"session"`
	}
	if err := json.NewDecoder(res.Body).Decode(&login); err != nil {
		t.Fatal(err)
	}
	if login.Session.Token == "" || login.Session.Role != "platform_admin" {
		t.Fatalf("expected named admin session, got %#v", login.Session)
	}

	req = httptest.NewRequest(http.MethodGet, "/v1/admin/config", nil)
	req.Header.Set("Authorization", "Bearer "+login.Session.Token)
	res = httptest.NewRecorder()
	srv.ServeHTTP(res, req)
	if res.Code != http.StatusOK {
		t.Fatalf("expected session-authorized admin config 200, got %d: %s", res.Code, res.Body.String())
	}

	req = httptest.NewRequest(http.MethodPost, "/v1/auth/logout", nil)
	req.Header.Set("Authorization", "Bearer "+login.Session.Token)
	res = httptest.NewRecorder()
	srv.ServeHTTP(res, req)
	if res.Code != http.StatusOK {
		t.Fatalf("expected logout 200, got %d: %s", res.Code, res.Body.String())
	}
}

func TestPlatformAdminBootstrapWorksWithLegacyHeadersDisabled(t *testing.T) {
	t.Setenv("ADMIN_API_KEY", "bootstrap-key")
	t.Setenv("ALLOW_LEGACY_CREDENTIAL_HEADERS", "false")
	srv := New(fakeRepository{}, "postgres")

	req := httptest.NewRequest(http.MethodPut, "/v1/admin/platform-users/admin%40example.com", strings.NewReader(`{
		"display_name":"Platform Admin",
		"login_id":"admin@example.com",
		"password":"a-strong-bootstrap-password",
		"roles":["platform_admin"]
	}`))
	req.Header.Set("X-Admin-Key", "bootstrap-key")
	res := httptest.NewRecorder()
	srv.ServeHTTP(res, req)
	if res.Code != http.StatusOK {
		t.Fatalf("expected bootstrap platform user 200, got %d: %s", res.Code, res.Body.String())
	}

	req = httptest.NewRequest(http.MethodGet, "/v1/admin/config", nil)
	req.Header.Set("X-Admin-Key", "bootstrap-key")
	res = httptest.NewRecorder()
	srv.ServeHTTP(res, req)
	if res.Code != http.StatusUnauthorized {
		t.Fatalf("expected bootstrap key to be rejected outside platform-user creation, got %d", res.Code)
	}
}

func TestParentInvitationLifecycleIsProtectedAndAcceptable(t *testing.T) {
	t.Setenv("ADMIN_API_KEY", "test-admin")
	t.Setenv("ACCOUNT_SESSION_SECRET", "test-account-session-secret")
	repo := fakeRepository{
		invitations: []learning.ParentInvitation{{
			ID: "invitation-1", ParentEmail: "parent@example.com", ParentDisplayName: "Ava Parent",
			StudentExternalRef: "ava-y1", Relationship: "parent", Status: "sent",
			ExpiresAt: time.Now().UTC().Add(time.Hour).Format(time.RFC3339),
		}},
	}
	srv := New(repo, "postgres")

	req := httptest.NewRequest(http.MethodPost, "/v1/admin/parent-invitations", strings.NewReader(`{
		"parent_email":"parent@example.com",
		"parent_display_name":"Ava Parent",
		"student_external_ref":"ava-y1",
		"relationship":"parent"
	}`))
	res := httptest.NewRecorder()
	srv.ServeHTTP(res, req)
	if res.Code != http.StatusUnauthorized {
		t.Fatalf("expected unauthenticated invitation creation to be rejected, got %d", res.Code)
	}

	req = httptest.NewRequest(http.MethodPost, "/v1/admin/parent-invitations", strings.NewReader(`{
		"parent_email":"parent@example.com",
		"parent_display_name":"Ava Parent",
		"student_external_ref":"ava-y1",
		"relationship":"parent"
	}`))
	req.Header.Set("X-Admin-Key", "test-admin")
	res = httptest.NewRecorder()
	srv.ServeHTTP(res, req)
	if res.Code != http.StatusCreated {
		t.Fatalf("expected invitation creation 201, got %d: %s", res.Code, res.Body.String())
	}

	req = httptest.NewRequest(http.MethodPost, "/v1/parent/invitations/accept", strings.NewReader(`{
		"token":"valid-invitation-token",
		"display_name":"Ava Parent",
		"password":"secure-parent-password"
	}`))
	res = httptest.NewRecorder()
	srv.ServeHTTP(res, req)
	if res.Code != http.StatusOK {
		t.Fatalf("expected invitation acceptance 200, got %d: %s", res.Code, res.Body.String())
	}
}

func TestContentPromotionUsesExplicitTransitionEndpoint(t *testing.T) {
	t.Setenv("ADMIN_API_KEY", "test-admin")
	srv := New(fakeRepository{versions: []learning.ContentVersion{{
		ID: "version-1", ContentKey: "activity-1", ContentType: "activity", Status: "review", Version: 2,
	}}}, "postgres")

	req := httptest.NewRequest(http.MethodPost, "/v1/admin/content/versions/version-1/promote", strings.NewReader(`{"status":"pilot"}`))
	req.Header.Set("X-Admin-Key", "test-admin")
	res := httptest.NewRecorder()
	srv.ServeHTTP(res, req)
	if res.Code != http.StatusOK {
		t.Fatalf("expected content promotion 200, got %d: %s", res.Code, res.Body.String())
	}
	var body struct {
		ContentVersion learning.ContentVersion `json:"content_version"`
		Promoted       bool                    `json:"promoted"`
	}
	if err := json.NewDecoder(res.Body).Decode(&body); err != nil {
		t.Fatal(err)
	}
	if !body.Promoted || body.ContentVersion.Status != "pilot" {
		t.Fatalf("expected promoted pilot version, got %#v", body)
	}
}

func TestHandleCreateAccessRequestUsesRepository(t *testing.T) {
	srv := New(fakeRepository{}, "postgres")

	req := httptest.NewRequest(http.MethodPost, "/v1/access-requests", strings.NewReader(`{
		"request_type":"school",
		"organisation_name":"Nexus Primary",
		"contact_name":"Mrs Patel",
		"contact_email":"patel@example.sch.uk",
		"learner_count":210,
		"year_groups":[1,2,3,4],
		"support_needs":["adhd","autism"],
		"learning_priorities":["short_bursts","visual_steps"]
	}`))
	res := httptest.NewRecorder()
	srv.ServeHTTP(res, req)

	if res.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d", res.Code)
	}
	var body learning.AccessRequestConfig
	if err := json.NewDecoder(res.Body).Decode(&body); err != nil {
		t.Fatal(err)
	}
	if body.ID != "request-1" || body.Status != "new" || body.RequestType != "school" || len(body.SupportNeeds) != 2 {
		t.Fatalf("expected access request response, got %#v", body)
	}
}

func TestHandleAdminAccessRequestsUseRepository(t *testing.T) {
	t.Setenv("ADMIN_API_KEY", "test-admin")
	srv := New(fakeRepository{
		accessReqs: []learning.AccessRequestConfig{{
			ID:               "request-1",
			RequestType:      "tutor_org",
			OrganisationName: "Nexus Tutors",
			ContactEmail:     "hello@example.com",
			Status:           "new",
		}},
	}, "postgres")

	req := httptest.NewRequest(http.MethodGet, "/v1/admin/access-requests", nil)
	req.Header.Set("X-Admin-Key", "test-admin")
	res := httptest.NewRecorder()
	srv.ServeHTTP(res, req)
	if res.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", res.Code)
	}
	var listBody struct {
		AccessRequests []learning.AccessRequestConfig `json:"access_requests"`
	}
	if err := json.NewDecoder(res.Body).Decode(&listBody); err != nil {
		t.Fatal(err)
	}
	if len(listBody.AccessRequests) != 1 || listBody.AccessRequests[0].RequestType != "tutor_org" {
		t.Fatalf("expected admin access requests, got %#v", listBody.AccessRequests)
	}

	req = httptest.NewRequest(http.MethodPut, "/v1/admin/access-requests/request-1/status", strings.NewReader(`{"status":"reviewing"}`))
	req.Header.Set("X-Admin-Key", "test-admin")
	res = httptest.NewRecorder()
	srv.ServeHTTP(res, req)
	if res.Code != http.StatusOK {
		t.Fatalf("expected 200 for status update, got %d", res.Code)
	}
	var statusBody learning.AccessRequestConfig
	if err := json.NewDecoder(res.Body).Decode(&statusBody); err != nil {
		t.Fatal(err)
	}
	if statusBody.ID != "request-1" || statusBody.Status != "reviewing" {
		t.Fatalf("expected status response, got %#v", statusBody)
	}
}

func TestHandleConvertAccessRequestCreatesSchoolUserAndStarterClass(t *testing.T) {
	t.Setenv("ADMIN_API_KEY", "test-admin")
	srv := New(fakeRepository{
		accessReqs: []learning.AccessRequestConfig{{
			ID:               "request-1",
			RequestType:      "school",
			OrganisationName: "Nexus Primary",
			ContactName:      "Mrs Patel",
			ContactEmail:     "patel@example.sch.uk",
			Status:           "approved",
			YearGroups:       []int{3, 4},
		}},
	}, "postgres")

	req := httptest.NewRequest(http.MethodPost, "/v1/admin/access-requests/request-1/convert", strings.NewReader(`{
		"create_starter_class":true
	}`))
	req.Header.Set("X-Admin-Key", "test-admin")
	res := httptest.NewRecorder()
	srv.ServeHTTP(res, req)

	if res.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d with %s", res.Code, res.Body.String())
	}
	var body accessRequestConversionResult
	if err := json.NewDecoder(res.Body).Decode(&body); err != nil {
		t.Fatal(err)
	}
	if body.AccessRequest.Status != "converted" {
		t.Fatalf("expected converted request, got %#v", body.AccessRequest)
	}
	if body.School.URN != "nexus-primary" || body.School.Status != "trial" {
		t.Fatalf("expected trial school from request, got %#v", body.School)
	}
	if body.SchoolUser.Email != "patel@example.sch.uk" || body.SchoolUser.Role != "school_admin" || body.SchoolUser.TemporaryPassword == "" {
		t.Fatalf("expected initial school admin credentials, got %#v", body.SchoolUser)
	}
	if body.Class.Name != "Pilot Y3" || body.Class.YearGroup != 3 || body.Class.SchoolURN != "nexus-primary" {
		t.Fatalf("expected starter class from first request year, got %#v", body.Class)
	}
}

func TestHandleConvertAccessRequestRequiresApprovedRequest(t *testing.T) {
	t.Setenv("ADMIN_API_KEY", "test-admin")
	srv := New(fakeRepository{
		accessReqs: []learning.AccessRequestConfig{{
			ID:               "request-1",
			RequestType:      "school",
			OrganisationName: "Nexus Primary",
			ContactName:      "Mrs Patel",
			ContactEmail:     "patel@example.sch.uk",
			Status:           "new",
			YearGroups:       []int{3},
		}},
	}, "postgres")

	req := httptest.NewRequest(http.MethodPost, "/v1/admin/access-requests/request-1/convert", strings.NewReader(`{"create_starter_class":true}`))
	req.Header.Set("X-Admin-Key", "test-admin")
	res := httptest.NewRecorder()
	srv.ServeHTTP(res, req)

	if res.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d with %s", res.Code, res.Body.String())
	}
	if !strings.Contains(res.Body.String(), "approved") {
		t.Fatalf("expected approved-request error, got %s", res.Body.String())
	}
}

func TestHandleRuntimeFlagsReturnsPublicSafeFlags(t *testing.T) {
	srv := New(fakeRepository{
		flags: []learning.FeatureFlag{
			{Key: "public_family_signup", Enabled: false, Config: map[string]any{"reason": "pilot-only"}},
			{Key: "child_audio_narration_enabled", Enabled: true, Config: map[string]any{"release_channel": "pilot"}},
			{Key: "internal_admin_only", Enabled: true, Config: map[string]any{"secret": "hidden"}},
		},
	}, "postgres")

	req := httptest.NewRequest(http.MethodGet, "/v1/runtime/flags", nil)
	res := httptest.NewRecorder()
	srv.ServeHTTP(res, req)
	if res.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", res.Code)
	}
	var body learning.RuntimeFlags
	if err := json.NewDecoder(res.Body).Decode(&body); err != nil {
		t.Fatal(err)
	}
	if body.Flags["public_family_signup"] || !body.Flags["public_access_requests"] {
		t.Fatalf("expected public defaults with family disabled, got %#v", body.Flags)
	}
	if !body.Flags["child_visual_portals_enabled"] || !body.Flags["child_audio_narration_enabled"] {
		t.Fatalf("expected public child experience rollout flags, got %#v", body.Flags)
	}
	if body.Flags["public_demo_learner_enabled"] {
		t.Fatalf("expected public demo learner to be opt-in, got %#v", body.Flags)
	}
	if _, ok := body.Flags["internal_admin_only"]; ok {
		t.Fatalf("internal flag leaked into public runtime flags: %#v", body.Flags)
	}
	if body.Config["public_family_signup"]["reason"] != "pilot-only" {
		t.Fatalf("expected safe public config, got %#v", body.Config)
	}
	if body.Config["child_audio_narration_enabled"]["release_channel"] != "pilot" {
		t.Fatalf("expected child audio rollout config, got %#v", body.Config)
	}
}

func TestHandleStartSessionUsesRepository(t *testing.T) {
	srv := New(fakeRepository{
		session: learning.LearningSession{
			ID:         "session-1",
			StudentID:  "alex-demo",
			Mode:       "home",
			DeviceTier: "chromebook",
		},
	}, "postgres")

	req := httptest.NewRequest(http.MethodPost, "/v1/students/alex-demo/sessions", strings.NewReader(`{"mode":"home","device_tier":"chromebook"}`))
	res := httptest.NewRecorder()
	srv.ServeHTTP(res, req)

	if res.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d", res.Code)
	}

	var body learning.LearningSession
	if err := json.NewDecoder(res.Body).Decode(&body); err != nil {
		t.Fatal(err)
	}
	if body.ID != "session-1" {
		t.Fatalf("expected repository session, got %#v", body)
	}
}
