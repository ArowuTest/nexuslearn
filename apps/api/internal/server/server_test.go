package server

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/ArowuTest/nexuslearn/apps/api/internal/learning"
)

type fakeRepository struct {
	mastery  []learning.StudentMastery
	attempts []learning.RecentAttempt
	warmUp   []learning.WarmUpItem
}

func (f fakeRepository) RecordAttempt(context.Context, learning.Attempt, learning.AttemptResult) error {
	return nil
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
