package server

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"sort"
	"strings"
	"testing"

	"github.com/ArowuTest/nexuslearn/apps/api/internal/learning"
)

func TestAdminConfigProjectsExactKeysForEachRole(t *testing.T) {
	tests := []struct {
		role      string
		status    int
		exactKeys []string
		section   string
	}{
		{
			role: "content_reviewer", status: http.StatusForbidden,
		},
		{
			role: "content_editor", status: http.StatusOK,
			exactKeys: []string{"activities", "questions"},
		},
		{
			role: "platform_admin", status: http.StatusOK, section: "learners",
			exactKeys: []string{"student_credentials", "students"},
		},
	}

	for _, test := range tests {
		t.Run(test.role, func(t *testing.T) {
			srv, repo, token := newAIReviewTestServer(t, test.role)
			repo.activities = []learning.ActivityConfig{{ID: "activity-1"}}
			repo.questions = []learning.QuestionConfig{{ID: "question-1"}}
			repo.students = []learning.StudentProfileConfig{{ExternalRef: "learner-1"}}
			repo.credentials = []learning.StudentCredentialConfig{{StudentExternalRef: "learner-1", LoginCode: "SECRET"}}

			path := "/v1/admin/config"
			if test.section != "" {
				path += "?section=" + test.section
			}
			request := httptest.NewRequest(http.MethodGet, path, nil)
			request.Header.Set("Authorization", "Bearer "+token)
			response := httptest.NewRecorder()
			srv.ServeHTTP(response, request)
			if response.Code != test.status {
				t.Fatalf("status=%d body=%s, expected %d", response.Code, response.Body.String(), test.status)
			}
			if test.status != http.StatusOK {
				return
			}

			var body map[string]json.RawMessage
			if err := json.NewDecoder(response.Body).Decode(&body); err != nil {
				t.Fatal(err)
			}
			keys := make([]string, 0, len(body))
			for key := range body {
				keys = append(keys, key)
			}
			sort.Strings(keys)
			sort.Strings(test.exactKeys)
			if len(keys) != len(test.exactKeys) {
				t.Fatalf("response keys=%v, expected exactly %v; body=%s", keys, test.exactKeys, response.Body.String())
			}
			for index := range keys {
				if keys[index] != test.exactKeys[index] {
					t.Fatalf("response keys=%v, expected exactly %v; body=%s", keys, test.exactKeys, response.Body.String())
				}
			}
		})
	}
}

func TestNonAdminRolesCannotAccessOperationalOrLearnerEndpointsDirectly(t *testing.T) {
	tests := []struct {
		method string
		path   string
	}{
		{http.MethodGet, "/v1/system/diagnostics"},
		{http.MethodGet, "/v1/admin/students"},
		{http.MethodGet, "/v1/admin/students/learner-1/progress"},
		{http.MethodGet, "/v1/admin/schools"},
		{http.MethodGet, "/v1/admin/school-users"},
		{http.MethodGet, "/v1/admin/classes"},
		{http.MethodGet, "/v1/admin/student-credentials"},
		{http.MethodGet, "/v1/admin/groups"},
		{http.MethodGet, "/v1/admin/parent-links"},
		{http.MethodGet, "/v1/admin/parent-invitations"},
		{http.MethodGet, "/v1/admin/access-requests"},
		{http.MethodGet, "/v1/admin/audit"},
		{http.MethodGet, "/v1/admin/worlds"},
		{http.MethodGet, "/v1/admin/reward-rules"},
		{http.MethodGet, "/v1/admin/feature-flags"},
		{http.MethodPut, "/v1/admin/students/learner-1"},
		{http.MethodPut, "/v1/admin/student-credentials/learner-1"},
		{http.MethodPost, "/v1/admin/parent-invitations"},
		{http.MethodPut, "/v1/admin/feature-flags/test"},
	}

	for _, role := range []string{"content_reviewer", "content_editor"} {
		t.Run(role, func(t *testing.T) {
			srv, _, token := newAIReviewTestServer(t, role)
			for _, test := range tests {
				request := httptest.NewRequest(test.method, test.path, nil)
				request.Header.Set("Authorization", "Bearer "+token)
				response := httptest.NewRecorder()
				srv.ServeHTTP(response, request)
				if response.Code != http.StatusForbidden {
					t.Errorf("%s %s: status=%d body=%s, expected 403", test.method, test.path, response.Code, response.Body.String())
				}
			}
		})
	}
}

func TestContentEditorCanOnlyUseCurriculumAuthoringEndpoints(t *testing.T) {
	srv, _, token := newAIReviewTestServer(t, "content_editor")
	for _, test := range []struct {
		method string
		path   string
		body   string
	}{
		{http.MethodGet, "/v1/admin/content/activities", ""},
		{http.MethodGet, "/v1/admin/content/questions", ""},
		{http.MethodPut, "/v1/admin/content/activities/activity-1", `{}`},
		{http.MethodPut, "/v1/admin/content/questions/question-1", `{}`},
		{http.MethodPut, "/v1/admin/curriculum/objectives/objective-1", `{}`},
	} {
		request := httptest.NewRequest(test.method, test.path, strings.NewReader(test.body))
		request.Header.Set("Authorization", "Bearer "+token)
		response := httptest.NewRecorder()
		srv.ServeHTTP(response, request)
		if response.Code != http.StatusOK {
			t.Fatalf("%s %s must remain available to content editors: status=%d body=%s", test.method, test.path, response.Code, response.Body.String())
		}
	}
}

func TestContentEditorCannotUseReviewEndpointsDirectly(t *testing.T) {
	srv, _, token := newAIReviewTestServer(t, "content_editor")
	for _, test := range []struct {
		method string
		path   string
	}{
		{http.MethodGet, "/v1/admin/ai-reviews"},
		{http.MethodGet, "/v1/admin/ai-reviews/summary"},
		{http.MethodPost, "/v1/admin/ai-reviews"},
	} {
		request := httptest.NewRequest(test.method, test.path, nil)
		request.Header.Set("Authorization", "Bearer "+token)
		response := httptest.NewRecorder()
		srv.ServeHTTP(response, request)
		if response.Code != http.StatusForbidden {
			t.Errorf("%s %s: status=%d body=%s, expected 403", test.method, test.path, response.Code, response.Body.String())
		}
	}
}

func TestContentReviewerCanUseNarrationReviewWorkflow(t *testing.T) {
	srv, _, token := newAIReviewTestServer(t, "content_reviewer")
	for _, path := range []string{
		"/v1/admin/content/narration-queue?status=awaiting&limit=1",
		"/v1/admin/content/narration-reviews?limit=1",
	} {
		request := httptest.NewRequest(http.MethodGet, path, nil)
		request.Header.Set("Authorization", "Bearer "+token)
		response := httptest.NewRecorder()
		srv.ServeHTTP(response, request)
		if response.Code == http.StatusForbidden || response.Code == http.StatusUnauthorized {
			t.Errorf("GET %s must remain available to content reviewers: status=%d body=%s", path, response.Code, response.Body.String())
		}
	}
}
