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
