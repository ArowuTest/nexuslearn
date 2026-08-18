package server

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/ArowuTest/nexuslearn/apps/api/internal/learning"
)

type fakeMockAssessmentStore struct {
	fakeRepository
	created     learning.MockAssessment
	page        learning.MockAssessmentPage
	pageQueries []learning.MockAssessmentQuery
}

func (f *fakeMockAssessmentStore) ListMockAssessmentPage(_ context.Context, query learning.MockAssessmentQuery) (learning.MockAssessmentPage, error) {
	f.pageQueries = append(f.pageQueries, query)
	if f.page.Assessments == nil {
		f.page.Assessments = []learning.MockAssessment{}
		if f.created.ID != "" {
			f.page.Assessments = append(f.page.Assessments, f.created)
		}
	}
	return f.page, nil
}

func (f *fakeMockAssessmentStore) CreateMockAssessment(_ context.Context, assessment learning.MockAssessment) (learning.MockAssessment, error) {
	assessment.ID = "mock-assessment-1"
	f.created = assessment
	return assessment, nil
}

func (f *fakeMockAssessmentStore) ListMockAssessments(context.Context, string, string, int) ([]learning.MockAssessment, error) {
	if f.created.ID == "" {
		return []learning.MockAssessment{}, nil
	}
	return []learning.MockAssessment{f.created}, nil
}

func (f *fakeMockAssessmentStore) GetMockAssessment(context.Context, string, string, string) (learning.MockAssessment, bool, error) {
	return f.created, f.created.ID != "", nil
}

func (f *fakeMockAssessmentStore) ListMockAssessmentQuestions(context.Context, string, string) ([]learning.QuestionConfig, error) {
	return f.questions, nil
}

func TestCreateMockAssessmentSelectsOneSubjectAndBalancesObjectives(t *testing.T) {
	repo := &fakeMockAssessmentStore{fakeRepository: fakeRepository{
		studentYear: 3,
		objectives: []learning.Objective{
			{ID: "ma-y3-number", Year: 3, Subject: "Mathematics", Strand: "Number", Topic: "Place value"},
			{ID: "ma-y3-fractions", Year: 3, Subject: "Mathematics", Strand: "Number", Topic: "Fractions"},
			{ID: "en-y3-reading", Year: 3, Subject: "English", Strand: "Reading", Topic: "Retrieval"},
		},
	}}
	for index := 1; index <= 3; index++ {
		repo.questions = append(repo.questions, learning.QuestionConfig{ID: "number-" + string(rune('0'+index)), ObjectiveID: "ma-y3-number", Status: "published", Format: "tap-choice", Difficulty: index})
		repo.questions = append(repo.questions, learning.QuestionConfig{ID: "fraction-" + string(rune('0'+index)), ObjectiveID: "ma-y3-fractions", Status: "published", Format: "multiple_choice", Difficulty: index})
		repo.questions = append(repo.questions, learning.QuestionConfig{ID: "english-" + string(rune('0'+index)), ObjectiveID: "en-y3-reading", Status: "published", Format: "multiple_choice", Difficulty: index})
	}
	srv := New(repo, "postgres")
	req := httptest.NewRequest(http.MethodPost, "/v1/students/ava-y3/mock-assessments", nil)
	assessment, err := srv.createMockAssessment(req, mockAssessmentRequest{
		Subject: "maths", YearGroup: 3, QuestionCount: 6, IncludeRevision: true,
	}, "ava-y3", "pupil", "ava-y3", "")
	if err != nil {
		t.Fatal(err)
	}
	if assessment.Subject != "Mathematics" || len(assessment.Items) != 6 {
		t.Fatalf("expected a six-question mathematics mock, got %#v", assessment)
	}
	seenObjectives := map[string]bool{}
	for _, item := range assessment.Items {
		seenObjectives[item.ObjectiveID] = true
		if item.ObjectiveID == "en-y3-reading" {
			t.Fatalf("English question leaked into mathematics mock: %#v", assessment.Items)
		}
	}
	if len(seenObjectives) != 2 {
		t.Fatalf("expected balanced objective coverage, got %#v", seenObjectives)
	}
}

func TestCreateMockAssessmentRejectsUnknownSubjectBeforePersistence(t *testing.T) {
	repo := &fakeMockAssessmentStore{fakeRepository: fakeRepository{studentYear: 4}}
	srv := New(repo, "postgres")
	req := httptest.NewRequest(http.MethodPost, "/v1/students/ava-y4/mock-assessments", nil)
	_, err := srv.createMockAssessment(req, mockAssessmentRequest{Subject: "History", YearGroup: 4, QuestionCount: 5}, "ava-y4", "pupil", "ava-y4", "")
	if err == nil {
		t.Fatal("expected unsupported subject to be rejected")
	}
	if repo.created.ID != "" {
		t.Fatal("unsupported subject should not reach persistence")
	}
}

func TestMockAssessmentBlueprintExplainsRevisionAndStretch(t *testing.T) {
	blueprint := mockAssessmentBlueprint([]learning.QuestionConfig{
		{Format: "tap-choice", Difficulty: 4},
		{Format: "multiple_choice", Difficulty: 6},
	}, learning.MockAssessment{IncludeRevision: true, IncludeStretch: true})
	if blueprint.Mode != "assessment" || blueprint.QuestionCount != 2 || blueprint.TargetDifficulty != 5 {
		t.Fatalf("unexpected mock blueprint: %#v", blueprint)
	}
	if len(blueprint.Rationale) != 5 {
		t.Fatalf("expected explicit mock rationale, got %#v", blueprint.Rationale)
	}
}

func TestAdminCanReadLearnerMockAssessmentHistory(t *testing.T) {
	t.Setenv("ADMIN_API_KEY", "test-admin")
	repo := &fakeMockAssessmentStore{
		created: learning.MockAssessment{
			ID: "mock-1", StudentExternalRef: "ava-y3", Subject: "Mathematics",
			YearGroup: 3, Status: "completed", QuestionCount: 10, AnsweredCount: 10,
			CorrectCount: 8, Score: 80,
		},
	}
	srv := New(repo, "postgres")
	req := httptest.NewRequest(http.MethodGet, "/v1/admin/students/ava-y3/mock-assessments", nil)
	req.Header.Set("X-Admin-Key", "test-admin")
	res := httptest.NewRecorder()
	srv.ServeHTTP(res, req)
	if res.Code != http.StatusOK {
		t.Fatalf("expected admin mock history, got %d: %s", res.Code, res.Body.String())
	}
	var body struct {
		Assessments []learning.MockAssessment `json:"mock_assessments"`
	}
	if err := json.NewDecoder(res.Body).Decode(&body); err != nil {
		t.Fatal(err)
	}
	if len(body.Assessments) != 1 || body.Assessments[0].Score != 80 {
		t.Fatalf("expected completed mock evidence in admin response, got %#v", body.Assessments)
	}
}

func TestAdminMockHistoryForwardsBoundedFiltersAndCursor(t *testing.T) {
	t.Setenv("ADMIN_API_KEY", "test-admin")
	cursorTime := time.Date(2026, time.August, 9, 9, 30, 0, 0, time.UTC)
	cursor := learning.EncodeMockAssessmentCursor(cursorTime, "7b20d33f-10c4-4918-b53e-b95f2c28cb7c")
	repo := &fakeMockAssessmentStore{page: learning.MockAssessmentPage{
		Assessments: []learning.MockAssessment{{ID: "mock-2", StudentExternalRef: "ava-y3", Subject: "Mathematics", Status: "completed"}},
		NextCursor:  "next-page",
	}}
	srv := New(repo, "postgres")
	req := httptest.NewRequest(http.MethodGet, "/v1/admin/students/ava-y3/mock-assessments?limit=25&status=completed&subject=Mathematics&cursor="+cursor, nil)
	req.Header.Set("X-Admin-Key", "test-admin")
	res := httptest.NewRecorder()
	srv.ServeHTTP(res, req)
	if res.Code != http.StatusOK {
		t.Fatalf("expected paginated admin mock history, got %d: %s", res.Code, res.Body.String())
	}
	if len(repo.pageQueries) != 1 {
		t.Fatalf("expected one page query, got %#v", repo.pageQueries)
	}
	query := repo.pageQueries[0]
	if query.StudentExternalRef != "ava-y3" || query.Limit != 25 || query.Status != "completed" || query.Subject != "Mathematics" {
		t.Fatalf("unexpected mock history query: %#v", query)
	}
	if !query.BeforeCreatedAt.Equal(cursorTime) || query.BeforeID != "7b20d33f-10c4-4918-b53e-b95f2c28cb7c" {
		t.Fatalf("cursor was not forwarded: %#v", query)
	}
	var body learning.MockAssessmentPage
	if err := json.NewDecoder(res.Body).Decode(&body); err != nil {
		t.Fatal(err)
	}
	if body.NextCursor != "next-page" || len(body.Assessments) != 1 {
		t.Fatalf("unexpected page response: %#v", body)
	}
}

func TestMockHistoryQueryClampsLimitAndPreservesSchoolScope(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/v1/school/mock-assessments?studentId=ava-y3&limit=500&subject=maths&status=in_progress", nil)
	query, err := mockAssessmentPageQuery(req, "ava-y3", "urn-100", 50)
	if err != nil {
		t.Fatal(err)
	}
	if query.StudentExternalRef != "ava-y3" || query.SchoolURN != "urn-100" {
		t.Fatalf("learner or tenant scope was lost: %#v", query)
	}
	if query.Limit != 100 || query.Subject != "Mathematics" || query.Status != "in_progress" {
		t.Fatalf("filters were not normalised and bounded: %#v", query)
	}
}

func TestAdminMockHistoryRejectsMalformedCursor(t *testing.T) {
	t.Setenv("ADMIN_API_KEY", "test-admin")
	repo := &fakeMockAssessmentStore{}
	srv := New(repo, "postgres")
	req := httptest.NewRequest(http.MethodGet, "/v1/admin/students/ava-y3/mock-assessments?cursor=not-a-cursor", nil)
	req.Header.Set("X-Admin-Key", "test-admin")
	res := httptest.NewRecorder()
	srv.ServeHTTP(res, req)
	if res.Code != http.StatusBadRequest {
		t.Fatalf("expected invalid cursor to be rejected, got %d: %s", res.Code, res.Body.String())
	}
	if len(repo.pageQueries) != 0 {
		t.Fatalf("invalid cursor should not reach persistence: %#v", repo.pageQueries)
	}
}

func TestParentMockHistoryProjectsOnlyDisplayedEvidenceFields(t *testing.T) {
	repo := &fakeMockAssessmentStore{
		fakeRepository: fakeRepository{
			verifyParent: true,
			parentPortal: learning.ParentPortalConfig{
				Parent: learning.ParentAccountConfig{LoginID: "parent@example.test"},
				Children: []learning.ParentChildConfig{{
					Student: learning.StudentProfileConfig{ExternalRef: "ava-y3", DisplayName: "Ava", YearGroup: 3},
				}},
			},
		},
		page: learning.MockAssessmentPage{
			Assessments: []learning.MockAssessment{{
				ID: "mock-school-created", StudentExternalRef: "ava-y3", StudentDisplayName: "Ava",
				SchoolURN: "123456", CreatedByRole: "school_admin", CreatedBy: "staff-login-id",
				Subject: "Science", YearGroup: 3, YearFrom: 2, YearTo: 4, Title: "Science check",
				Status: "completed", QuestionCount: 10, AnsweredCount: 10, CorrectCount: 8, Score: 80,
				DurationMinutes: 20, IncludeRevision: true, IncludeStretch: true,
				Accessibility:    map[string]any{"runtime_adaptations": map[string]any{"support_needs": []string{"dyslexia"}}},
				Items:            []learning.MockAssessmentItem{{Position: 1, QuestionID: "question-internal", ObjectiveID: "science-objective"}},
				ObjectiveResults: []learning.MockObjectiveResult{{ObjectiveID: "science-objective", Statement: "Describe rocks.", Score: 80}},
				CreatedAt:        "2026-08-18T10:00:00Z", UpdatedAt: "2026-08-18T10:30:00Z", CompletedAt: "2026-08-18T10:30:00Z",
			}},
			NextCursor: "older-parent-history",
		},
	}
	srv := New(repo, "postgres")
	req := httptest.NewRequest(http.MethodGet, "/v1/parent/children/ava-y3/mock-assessments", nil)
	req.Header.Set("X-Parent-Login", "parent@example.test")
	req.Header.Set("X-Parent-Password", "parent-password")
	res := httptest.NewRecorder()
	srv.ServeHTTP(res, req)
	if res.Code != http.StatusOK {
		t.Fatalf("expected parent history, got %d: %s", res.Code, res.Body.String())
	}
	var body struct {
		Assessments []map[string]json.RawMessage `json:"mock_assessments"`
		NextCursor  string                       `json:"next_cursor"`
	}
	if err := json.NewDecoder(res.Body).Decode(&body); err != nil {
		t.Fatal(err)
	}
	if len(body.Assessments) != 1 || body.NextCursor != "older-parent-history" {
		t.Fatalf("parent history page shape was not preserved: %s", res.Body.String())
	}
	wantKeys := []string{
		"id", "subject", "year_group", "title", "status", "question_count", "answered_count",
		"correct_count", "score", "objective_results", "created_at",
	}
	assessment := body.Assessments[0]
	if len(assessment) != len(wantKeys) {
		t.Fatalf("parent history contains unexpected fields: %v", assessment)
	}
	for _, key := range wantKeys {
		if _, ok := assessment[key]; !ok {
			t.Fatalf("parent history is missing displayed field %q: %s", key, res.Body.String())
		}
	}
	for _, forbidden := range []string{
		"student_external_ref", "student_display_name", "school_urn", "created_by_role", "created_by",
		"year_from", "year_to", "duration_minutes", "include_revision", "include_stretch", "accessibility",
		"items", "updated_at", "completed_at",
	} {
		if _, ok := assessment[forbidden]; ok {
			t.Fatalf("parent history leaked %q: %s", forbidden, res.Body.String())
		}
	}
}
