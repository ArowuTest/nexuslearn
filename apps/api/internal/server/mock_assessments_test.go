package server

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/ArowuTest/nexuslearn/apps/api/internal/learning"
)

type fakeMockAssessmentStore struct {
	fakeRepository
	created learning.MockAssessment
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
