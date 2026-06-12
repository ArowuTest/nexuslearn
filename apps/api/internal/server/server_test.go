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
	mastery     []learning.StudentMastery
	attempts    []learning.RecentAttempt
	warmUp      []learning.WarmUpItem
	objectives  []learning.Objective
	summary     learning.EvidenceSummary
	world       learning.WorldState
	session     learning.LearningSession
	diagnostics learning.Diagnostics
	studentYear int
	flags       []learning.FeatureFlag
	worlds      []learning.WorldConfig
	activities  []learning.ActivityConfig
	questions   []learning.QuestionConfig
	rewardRules []learning.RewardRule
	students    []learning.StudentProfileConfig
	schools     []learning.SchoolConfig
	classes     []learning.ClassConfig
	credentials []learning.StudentCredentialConfig
	auditLogs   []learning.AuditLog
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
