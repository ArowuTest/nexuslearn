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
	summary     learning.EvidenceSummary
	world       learning.WorldState
	session     learning.LearningSession
	diagnostics learning.Diagnostics
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

func (f fakeRepository) Diagnostics(context.Context) (learning.Diagnostics, error) {
	return f.diagnostics, nil
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

func TestHandleDiagnosticsUsesRepository(t *testing.T) {
	srv := New(fakeRepository{
		diagnostics: learning.Diagnostics{
			Persistence:       "postgres",
			SchemaVersion:     "0002_review_queue_integrity",
			ReviewQueueStatus: "deduped",
		},
	}, "postgres")

	req := httptest.NewRequest(http.MethodGet, "/v1/system/diagnostics", nil)
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
