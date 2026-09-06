package server

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/ArowuTest/nexuslearn/apps/api/internal/learning"
)

type attemptEvidenceRepository struct {
	fakeRepository
	calls []string
	fail  bool
}

func (r *attemptEvidenceRepository) AdultAttemptEvidence(_ context.Context, student string, limit int) ([]learning.AttemptEvidence, error) {
	r.calls = append(r.calls, student)
	if student != "linked" || limit != 10 {
		return nil, errors.New("unscoped or unbounded read")
	}
	if r.fail {
		return nil, errors.New("database unavailable")
	}
	return []learning.AttemptEvidence{{ID: "immutable-evidence", QuestionID: "q1", QuestionVersion: strings.Repeat("a", 64), RecordedAnswer: "2.5", MasteryDelta: 4}}, nil
}

func TestAdultEvidenceRoleAndLearnerBoundaries(t *testing.T) {
	t.Setenv("ADMIN_API_KEY", "test-admin")
	t.Setenv("ALLOW_LEGACY_CREDENTIAL_HEADERS", "true")
	t.Setenv("PUPIL_SESSION_SECRET", "test-pupil-session-secret")
	t.Setenv("REQUIRE_PUPIL_SESSION", "true")
	for _, role := range []string{"parent", "school", "teacher", "admin", "pupil"} {
		t.Run(role, func(t *testing.T) {
			repo := &attemptEvidenceRepository{fakeRepository: fakeRepository{studentYear: 3, verifyParent: true, verifySchool: true,
				parentPortal: learning.ParentPortalConfig{Parent: learning.ParentAccountConfig{Email: "parent@example.test", LoginID: "parent"}, Children: []learning.ParentChildConfig{{Student: learning.StudentProfileConfig{ExternalRef: "linked", YearGroup: 3}}}},
				classes:      []learning.ClassConfig{{Students: []learning.StudentProfileConfig{{ExternalRef: "linked", YearGroup: 3}}}},
			}}
			if role == "teacher" {
				repo.schoolRole = "teacher"
			}
			srv := New(repo, "postgres")
			request := func(student string, authorized bool) *httptest.ResponseRecorder {
				path := "/v1/" + role + "/students/" + student + "/progress"
				if role == "teacher" {
					path = "/v1/school/students/" + student + "/progress"
				}
				if role == "parent" {
					path = "/v1/parent/children/" + student + "/evidence"
				}
				if role == "pupil" {
					path = "/v1/students/" + student + "/progress"
				}
				req := httptest.NewRequest(http.MethodGet, path, nil)
				if authorized {
					switch role {
					case "admin":
						req.Header.Set("X-Admin-Key", "test-admin")
					case "parent":
						req.Header.Set("X-Parent-Login", "parent")
						req.Header.Set("X-Parent-Password", "test")
					case "school", "teacher":
						req.Header.Set("X-School-URN", "school-a")
						req.Header.Set("X-School-Login", "teacher")
						req.Header.Set("X-School-Password", "test")
					case "pupil":
						req.Header.Set("X-Pupil-Session", srv.createPupilSession("linked").Token)
					}
				} else {
					repo.verifyParent = false
					repo.verifySchool = false
				}
				res := httptest.NewRecorder()
				srv.ServeHTTP(res, req)
				return res
			}
			res := request("linked", true)
			if res.Code != 200 {
				t.Fatalf("status=%d %s", res.Code, res.Body.String())
			}
			if role == "pupil" {
				if res := request("LINKED", true); res.Code != http.StatusForbidden {
					t.Fatalf("pupil token authorized a different case-sensitive ID: %d", res.Code)
				}
				if len(repo.calls) != 0 || strings.Contains(res.Body.String(), "attempt_evidence") {
					t.Fatal("adult evidence exposed through pupil progress")
				}
				return
			}
			if !strings.Contains(res.Body.String(), "immutable-evidence") || !strings.Contains(res.Body.String(), `"recorded_answer":"2.5"`) || res.Header().Get("Cache-Control") != "private, no-store" {
				t.Fatalf("missing private adult evidence: headers=%v body=%s", res.Header(), res.Body.String())
			}
			repo.fail = true
			if res := request("linked", true); res.Code != 500 || strings.Contains(res.Body.String(), "immutable-evidence") {
				t.Fatalf("evidence failure reported as success: %d %s", res.Code, res.Body.String())
			}
			before := len(repo.calls)
			if role != "admin" {
				if res := request("LINKED", true); res.Code != http.StatusForbidden || len(repo.calls) != before {
					t.Fatalf("case-only ID bypassed scope: %d %+v", res.Code, repo.calls)
				}
				if res := request("outside", true); res.Code != 403 || len(repo.calls) != before {
					t.Fatalf("outside scope read: %d %+v", res.Code, repo.calls)
				}
			}
			if res := request("linked", false); res.Code != 401 || len(repo.calls) != before {
				t.Fatalf("anonymous read: %d %+v", res.Code, repo.calls)
			}
		})
	}
}
