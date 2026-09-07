package server

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/ArowuTest/nexuslearn/apps/api/internal/learning"
)

func TestVersionAdvertisesCanonicalGradingForDeploymentChecks(t *testing.T) {
	srv := New(fakeRepository{}, "postgres")
	res := httptest.NewRecorder()
	srv.ServeHTTP(res, httptest.NewRequest(http.MethodGet, "/v1/version", nil))
	var version map[string]string
	if err := json.Unmarshal(res.Body.Bytes(), &version); err != nil {
		t.Fatal(err)
	}
	if version["grading_contract"] != "canonical-v1" {
		t.Fatalf("deployed grading contract cannot be verified: %+v", version)
	}
	if version["pupil_question_contract"] != "render-v1" {
		t.Fatalf("pupil-safe projection deployment cannot be verified: %+v", version)
	}
	if version["attempt_submission_contract"] != "typed-versioned-v1" {
		t.Fatalf("legacy retirement deployment cannot be verified: %+v", version)
	}
	if version["attempt_evidence_contract"] != "submitted-v1" {
		t.Fatalf("submitted evidence deployment cannot be verified: %+v", version)
	}
	if version["marking_policy_contract"] != "authored-v1" {
		t.Fatalf("missing authored marking policy contract: %v", version)
	}
	if version["pupil_audio_contract"] != "aliases-v1" {
		t.Fatalf("missing authored pupil audio projection: %v", version)
	}
	if version["required_listening_contract"] != "ledger-v1" {
		t.Fatalf("required listening deployment cannot be verified: %v", version)
	}
	if version["feedback_contract"] != "task-repair-v1" {
		t.Fatalf("task repair deployment cannot be verified: %+v", version)
	}
}

func TestAttemptCanonicalFailuresHaveActionableStatus(t *testing.T) {
	for _, tt := range []struct {
		err    error
		status int
	}{
		{learning.ErrQuestionUnavailable, 404}, {learning.ErrQuestionVersion, 409},
		{learning.ErrInvalidResponse, 422}, {learning.ErrQuestionNeedsReview, 422}, {learning.ErrGradingUnavailable, 503},
	} {
		t.Run(tt.err.Error(), func(t *testing.T) {
			srv := New(fakeRepository{recordAttemptErr: tt.err}, "postgres")
			req := httptest.NewRequest(http.MethodPost, "/v1/learning/attempt", strings.NewReader(`{"student_id":"alex-demo","question_id":"q","objective_id":"o"}`))
			res := httptest.NewRecorder()
			srv.ServeHTTP(res, req)
			if res.Code != tt.status {
				t.Fatalf("status=%d want=%d body=%s", res.Code, tt.status, res.Body.String())
			}
		})
	}
}

func TestAttemptRequestIsBoundedAndSingleJSON(t *testing.T) {
	for _, tc := range []struct {
		name, body string
		status     int
	}{
		{"oversized input", `{"student_id":"alex-demo","given_text":"` + strings.Repeat("x", 1<<20) + `"}`, http.StatusRequestEntityTooLarge},
		{"oversized trailing padding", `{"student_id":"alex-demo"}` + strings.Repeat(" ", 1<<20), http.StatusRequestEntityTooLarge},
		{"second document", `{"student_id":"alex-demo"} {}`, http.StatusBadRequest},
	} {
		t.Run(tc.name, func(t *testing.T) {
			// If validation reaches the repository, this fake returns 503.
			srv := New(fakeRepository{recordAttemptErr: learning.ErrGradingUnavailable}, "postgres")
			res := httptest.NewRecorder()
			srv.ServeHTTP(res, httptest.NewRequest(http.MethodPost, "/v1/learning/attempt", strings.NewReader(tc.body)))
			if res.Code != tc.status {
				t.Fatalf("status=%d want=%d", res.Code, tc.status)
			}
		})
	}
}
