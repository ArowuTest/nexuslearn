package server

import (
	"context"
	"errors"
	"github.com/ArowuTest/nexuslearn/apps/api/internal/learning"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

type preflightRepository struct {
	fakeRepository
	calls int
	err   error
}

func (r *preflightRepository) PreflightContentRelease(_ context.Context, m learning.ContentReleaseManifest) (learning.ContentReleasePreflight, error) {
	r.calls++
	return learning.ContentReleasePreflight{ReleaseID: m.ID, Checks: []learning.ReleaseEvidenceCheck{{Code: "audio_listening", Passed: false, Message: "human listening approval required"}}}, r.err
}

func TestReleasePreflightRouteAuthenticatesAndRejectsMalformedInput(t *testing.T) {
	t.Setenv("ADMIN_API_KEY", "preflight-test")
	for _, tc := range []struct {
		name, body, key string
		want, calls     int
	}{
		{"anonymous", `{}`, "", 401, 0},
		{"blocked evidence report", `{"id":"release-1"}`, "preflight-test", 200, 1},
		{"trailing document", `{} {}`, "preflight-test", 400, 0},
		{"unknown field", `{"secret":"x"}`, "preflight-test", 400, 0},
	} {
		t.Run(tc.name, func(t *testing.T) {
			r := &preflightRepository{}
			s := New(r, "postgres")
			req := httptest.NewRequest(http.MethodPost, "/v1/admin/content/releases/preflight", strings.NewReader(tc.body))
			req.Header.Set("X-Admin-Key", tc.key)
			res := httptest.NewRecorder()
			s.ServeHTTP(res, req)
			if res.Code != tc.want || r.calls != tc.calls {
				t.Fatalf("status=%d calls=%d body=%s", res.Code, r.calls, res.Body.String())
			}
		})
	}
	for _, role := range []string{"content_editor", "content_reviewer", "parent", "school_admin"} {
		s, _, token := newAIReviewTestServer(t, role)
		req := httptest.NewRequest(http.MethodPost, "/v1/admin/content/releases/preflight", strings.NewReader(`{}`))
		req.Header.Set("Authorization", "Bearer "+token)
		res := httptest.NewRecorder()
		s.ServeHTTP(res, req)
		if res.Code != http.StatusForbidden {
			t.Fatalf("role %s status=%d", role, res.Code)
		}
	}
}

func TestReleasePreflightDatabaseFailureCannotReturnReadiness(t *testing.T) {
	t.Setenv("ADMIN_API_KEY", "preflight-test")
	s := New(&preflightRepository{err: errors.New("database unavailable")}, "postgres")
	req := httptest.NewRequest(http.MethodPost, "/v1/admin/content/releases/preflight", strings.NewReader(`{}`))
	req.Header.Set("X-Admin-Key", "preflight-test")
	res := httptest.NewRecorder()
	s.ServeHTTP(res, req)
	if res.Code != 500 || strings.Contains(res.Body.String(), "evidence_ready") {
		t.Fatalf("failed database returned a report: %d %s", res.Code, res.Body.String())
	}
}
