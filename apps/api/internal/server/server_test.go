package server

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/ArowuTest/nexuslearn/apps/api/internal/learning"
)

type fakeRepository struct {
	mastery      []learning.StudentMastery
	attempts     []learning.RecentAttempt
	warmUp       []learning.WarmUpItem
	objectives   []learning.Objective
	summary      learning.EvidenceSummary
	world        learning.WorldState
	session      learning.LearningSession
	diagnostics  learning.Diagnostics
	studentYear  int
	flags        []learning.FeatureFlag
	worlds       []learning.WorldConfig
	activities   []learning.ActivityConfig
	questions    []learning.QuestionConfig
	rewardRules  []learning.RewardRule
	students     []learning.StudentProfileConfig
	schools      []learning.SchoolConfig
	schoolUsers  []learning.SchoolUserConfig
	schoolPortal learning.SchoolPortalConfig
	verifySchool bool
	classes      []learning.ClassConfig
	credentials  []learning.StudentCredentialConfig
	groups       []learning.LearningGroupConfig
	parentLinks  []learning.ParentLinkConfig
	accessReqs   []learning.AccessRequestConfig
	auditLogs    []learning.AuditLog
}

func (f fakeRepository) RecordAttempt(_ context.Context, _ learning.Attempt, result learning.AttemptResult) (learning.AttemptResult, error) {
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
	return learning.SchoolUserConfig{SchoolURN: schoolURN, LoginID: loginID, Role: "school_admin"}, true, nil
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
		questions: []learning.QuestionConfig{
			{ID: "q-live", ActivityID: "act-configured", ObjectiveID: "ma-y4-test", Format: "multiple_choice", Status: "published"},
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
		Activity  learning.ActivityConfig   `json:"activity"`
		Questions []learning.QuestionConfig `json:"questions"`
	}
	if err := json.NewDecoder(res.Body).Decode(&body); err != nil {
		t.Fatal(err)
	}
	if body.Activity.ID != "act-configured" || len(body.Questions) != 1 || body.Questions[0].ID != "q-live" {
		t.Fatalf("expected configured mission with published questions, got %#v", body)
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

func TestHandleCreateAccessRequestUsesRepository(t *testing.T) {
	srv := New(fakeRepository{}, "postgres")

	req := httptest.NewRequest(http.MethodPost, "/v1/access-requests", strings.NewReader(`{
		"request_type":"school",
		"organisation_name":"Nexus Primary",
		"contact_name":"Mrs Patel",
		"contact_email":"patel@example.sch.uk",
		"learner_count":210,
		"year_groups":[1,2,3,4]
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
	if body.ID != "request-1" || body.Status != "new" || body.RequestType != "school" {
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
