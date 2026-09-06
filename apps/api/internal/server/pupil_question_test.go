package server

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/ArowuTest/nexuslearn/apps/api/internal/learning"
)

func TestPupilMissionDoesNotSerializePrivateMarkingMaterial(t *testing.T) {
	q := learning.QuestionConfig{ID: "q", ActivityID: "a", ObjectiveID: "o", Format: "number-input", Status: "published",
		Body:           map[string]any{"prompt": "Add the numbers", "input": "number", "audio_asset_id": "prompt-audio", "accepted_spans": []any{"secret"}, "private_author_note": "secret", "model": map[string]any{"label": "Two groups", "correct_answer": "secret"}},
		ExpectedAnswer: map[string]any{"value": float64(5)}, Explanation: "Private worked solution", Hints: []string{"Count each group"}}
	srv := New(fakeRepository{activities: []learning.ActivityConfig{{ID: "a", ObjectiveID: "o", Status: "published"}}, questions: []learning.QuestionConfig{q}}, "postgres")
	res := httptest.NewRecorder()
	srv.ServeHTTP(res, httptest.NewRequest(http.MethodGet, "/v1/learning/mission?studentId=alex-demo&activityId=a", nil))
	if res.Code != 200 {
		t.Fatalf("status=%d body=%s", res.Code, res.Body.String())
	}
	var body struct {
		Questions []map[string]any `json:"questions"`
	}
	if err := json.Unmarshal(res.Body.Bytes(), &body); err != nil {
		t.Fatal(err)
	}
	if len(body.Questions) != 1 {
		t.Fatalf("questions=%v", body.Questions)
	}
	public := body.Questions[0]
	for _, key := range []string{"expected_answer", "explanation"} {
		if _, ok := public[key]; ok {
			t.Errorf("pupil question leaks %s", key)
		}
	}
	if public["response_kind"] != "number" || public["question_version"] == "" || public["question_version"] == nil {
		t.Errorf("missing safe response contract: %v", public)
	}
	render := public["body"].(map[string]any)
	for _, key := range []string{"accepted_spans", "private_author_note"} {
		if _, ok := render[key]; ok {
			t.Errorf("render body leaks %s", key)
		}
	}
	if render["audio_asset_id"] != "prompt-audio" || render["prompt"] != "Add the numbers" {
		t.Errorf("lost learning/audio data: %v", render)
	}
	if _, ok := render["model"].(map[string]any)["correct_answer"]; ok {
		t.Error("nested marking key leaked")
	}
	// Projection must not mutate repository/admin authoring data.
	if q.ExpectedAnswer["value"] != float64(5) || q.Body["accepted_spans"] == nil {
		t.Error("canonical authoring data changed")
	}
}
