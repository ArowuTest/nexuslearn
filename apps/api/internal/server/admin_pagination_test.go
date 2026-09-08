package server

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/ArowuTest/nexuslearn/apps/api/internal/learning"
)

type fakeAdminPageRepository struct {
	fakeRepository
	auditPage    learning.AuditLogPage
	versionPage  learning.ContentVersionPage
	auditQuery   learning.AdminPageQuery
	versionQuery learning.AdminPageQuery
	auditCalls   int
	versionCalls int
}

func (f *fakeAdminPageRepository) ListAuditLogPage(_ context.Context, query learning.AdminPageQuery) (learning.AuditLogPage, error) {
	f.auditCalls++
	f.auditQuery = query
	return f.auditPage, nil
}

func (f *fakeAdminPageRepository) ListContentVersionPage(_ context.Context, query learning.AdminPageQuery) (learning.ContentVersionPage, error) {
	f.versionCalls++
	f.versionQuery = query
	return f.versionPage, nil
}

type fakeAdminReleasePageRepository struct {
	fakeAdminPageRepository
	releasePage  learning.ContentReleasePage
	releaseQuery learning.AdminPageQuery
	releaseCalls int
}

type fakeAdminDirectoryPageRepository struct {
	fakeRepository
	studentPage       learning.StudentProfilePage
	credentialPage    learning.StudentCredentialPage
	studentQuery      learning.AdminDirectoryPageQuery
	credentialQuery   learning.AdminDirectoryPageQuery
	studentCalls      int
	credentialCalls   int
	invalidCursorPage bool
}

type fakeAdminOrganisationPageRepository struct {
	fakeRepository
	schoolPage  learning.SchoolPage
	userPage    learning.SchoolUserPage
	classPage   learning.ClassPage
	schoolQuery learning.AdminOrganisationPageQuery
	userQuery   learning.AdminOrganisationPageQuery
	classQuery  learning.AdminOrganisationPageQuery
}

func (f *fakeAdminOrganisationPageRepository) ListSchoolPage(_ context.Context, query learning.AdminOrganisationPageQuery) (learning.SchoolPage, error) {
	f.schoolQuery = query
	return f.schoolPage, nil
}

func (f *fakeAdminOrganisationPageRepository) ListSchoolUserPage(_ context.Context, query learning.AdminOrganisationPageQuery) (learning.SchoolUserPage, error) {
	f.userQuery = query
	return f.userPage, nil
}

func (f *fakeAdminOrganisationPageRepository) ListClassPage(_ context.Context, query learning.AdminOrganisationPageQuery) (learning.ClassPage, error) {
	f.classQuery = query
	return f.classPage, nil
}

func (f *fakeAdminDirectoryPageRepository) ListStudentPage(_ context.Context, query learning.AdminDirectoryPageQuery) (learning.StudentProfilePage, error) {
	f.studentCalls++
	f.studentQuery = query
	if f.invalidCursorPage && query.Cursor != "" {
		return learning.StudentProfilePage{}, learning.ErrInvalidConfiguration
	}
	return f.studentPage, nil
}

func (f *fakeAdminDirectoryPageRepository) ListStudentCredentialPage(_ context.Context, query learning.AdminDirectoryPageQuery) (learning.StudentCredentialPage, error) {
	f.credentialCalls++
	f.credentialQuery = query
	if f.invalidCursorPage && query.Cursor != "" {
		return learning.StudentCredentialPage{}, learning.ErrInvalidConfiguration
	}
	return f.credentialPage, nil
}

func TestAdminDirectoryHandlersUseBoundedPagesAndPreserveAdminAuth(t *testing.T) {
	t.Setenv("ADMIN_API_KEY", "test-admin")
	repo := &fakeAdminDirectoryPageRepository{
		studentPage: learning.StudentProfilePage{
			Students:   []learning.StudentProfileConfig{{ExternalRef: "student-1", DisplayName: "Student One", YearGroup: 3}},
			NextCursor: "student-next",
		},
		credentialPage: learning.StudentCredentialPage{
			StudentCredentials: []learning.StudentCredentialConfig{{StudentExternalRef: "student-1", DisplayName: "Student One"}},
			NextCursor:         "credential-next",
		},
	}
	srv := New(repo, "postgres")

	tests := []struct {
		name      string
		path      string
		wantKey   string
		wantQuery func() learning.AdminDirectoryPageQuery
	}{
		{name: "students", path: "/v1/admin/students", wantKey: "students", wantQuery: func() learning.AdminDirectoryPageQuery { return repo.studentQuery }},
		{name: "credentials", path: "/v1/admin/student-credentials", wantKey: "student_credentials", wantQuery: func() learning.AdminDirectoryPageQuery { return repo.credentialQuery }},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			req := httptest.NewRequest(http.MethodGet, test.path+"?limit=2&cursor=directory-cursor", nil)
			req.Header.Set("X-Admin-Key", "test-admin")
			res := httptest.NewRecorder()
			srv.ServeHTTP(res, req)
			if res.Code != http.StatusOK {
				t.Fatalf("expected 200, got %d: %s", res.Code, res.Body.String())
			}
			query := test.wantQuery()
			if query.Limit != 2 || query.Cursor != "directory-cursor" {
				t.Fatalf("directory query was not forwarded: %#v", query)
			}
			var body map[string]json.RawMessage
			if err := json.NewDecoder(res.Body).Decode(&body); err != nil {
				t.Fatal(err)
			}
			if _, ok := body[test.wantKey]; !ok {
				t.Fatalf("compatibility collection key %q is missing: %s", test.wantKey, res.Body.String())
			}
			var next string
			if err := json.Unmarshal(body["next_cursor"], &next); err != nil || next == "" {
				t.Fatalf("expected next_cursor, got %q err=%v", next, err)
			}
		})
	}

	repo.invalidCursorPage = true
	for _, path := range []string{"/v1/admin/students", "/v1/admin/student-credentials"} {
		req := httptest.NewRequest(http.MethodGet, path+"?cursor=not-valid", nil)
		req.Header.Set("X-Admin-Key", "test-admin")
		res := httptest.NewRecorder()
		srv.ServeHTTP(res, req)
		if res.Code != http.StatusBadRequest {
			t.Fatalf("%s: expected malformed cursor 400, got %d: %s", path, res.Code, res.Body.String())
		}
	}

	for _, path := range []string{"/v1/admin/students?limit=2", "/v1/admin/student-credentials?limit=2"} {
		res := httptest.NewRecorder()
		srv.ServeHTTP(res, httptest.NewRequest(http.MethodGet, path, nil))
		if res.Code != http.StatusUnauthorized {
			t.Fatalf("%s: expected 401, got %d", path, res.Code)
		}
	}
}

func TestAdminCombinedDirectoryHandlerUsesIndependentOpaqueCursors(t *testing.T) {
	t.Setenv("ADMIN_API_KEY", "test-admin")
	repo := &fakeAdminDirectoryPageRepository{
		studentPage: learning.StudentProfilePage{
			Students:   []learning.StudentProfileConfig{{ExternalRef: "student-2", DisplayName: "Student Two", YearGroup: 4}},
			NextCursor: "student-next",
		},
		credentialPage: learning.StudentCredentialPage{
			StudentCredentials: []learning.StudentCredentialConfig{{StudentExternalRef: "student-2", DisplayName: "Student Two"}},
			NextCursor:         "credential-next",
		},
	}
	srv := New(repo, "postgres")
	req := httptest.NewRequest(http.MethodGet, "/v1/admin/learner-directory?limit=2&student_cursor=student-cursor&credential_cursor=credential-cursor", nil)
	req.Header.Set("X-Admin-Key", "test-admin")
	res := httptest.NewRecorder()
	srv.ServeHTTP(res, req)
	if res.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", res.Code, res.Body.String())
	}
	if repo.studentQuery.Limit != 2 || repo.studentQuery.Cursor != "student-cursor" {
		t.Fatalf("student query was not forwarded independently: %#v", repo.studentQuery)
	}
	if repo.credentialQuery.Limit != 2 || repo.credentialQuery.Cursor != "credential-cursor" {
		t.Fatalf("credential query was not forwarded independently: %#v", repo.credentialQuery)
	}
	var body struct {
		Students             []learning.StudentProfileConfig    `json:"students"`
		StudentNextCursor    string                             `json:"student_next_cursor"`
		Credentials          []learning.StudentCredentialConfig `json:"student_credentials"`
		CredentialNextCursor string                             `json:"credential_next_cursor"`
	}
	if err := json.NewDecoder(res.Body).Decode(&body); err != nil {
		t.Fatal(err)
	}
	if len(body.Students) != 1 || body.StudentNextCursor != "student-next" || len(body.Credentials) != 1 || body.CredentialNextCursor != "credential-next" {
		t.Fatalf("unexpected combined page: %#v", body)
	}
}

func TestAdminCombinedDirectoryHandlerDoesNotRestartExhaustedCollection(t *testing.T) {
	t.Setenv("ADMIN_API_KEY", "test-admin")
	repo := &fakeAdminDirectoryPageRepository{
		credentialPage: learning.StudentCredentialPage{
			StudentCredentials: []learning.StudentCredentialConfig{{StudentExternalRef: "student-2", DisplayName: "Student Two"}},
		},
	}
	srv := New(repo, "postgres")
	req := httptest.NewRequest(http.MethodGet, "/v1/admin/learner-directory?limit=2&student_done=1&credential_cursor=credential-cursor", nil)
	req.Header.Set("X-Admin-Key", "test-admin")
	res := httptest.NewRecorder()
	srv.ServeHTTP(res, req)
	if res.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", res.Code, res.Body.String())
	}
	if repo.studentCalls != 0 || repo.credentialCalls != 1 {
		t.Fatalf("exhausted collection was queried again: student_calls=%d credential_calls=%d", repo.studentCalls, repo.credentialCalls)
	}
	var body struct {
		Students       []learning.StudentProfileConfig    `json:"students"`
		Credentials    []learning.StudentCredentialConfig `json:"student_credentials"`
		StudentNext    string                             `json:"student_next_cursor"`
		CredentialNext string                             `json:"credential_next_cursor"`
	}
	if err := json.NewDecoder(res.Body).Decode(&body); err != nil {
		t.Fatal(err)
	}
	if len(body.Students) != 0 || len(body.Credentials) != 1 || body.StudentNext != "" || body.CredentialNext != "" {
		t.Fatalf("unexpected exhausted collection response: %#v", body)
	}
}

func TestAdminCombinedOrganisationHandlerUsesIndependentCursors(t *testing.T) {
	t.Setenv("ADMIN_API_KEY", "test-admin")
	repo := &fakeAdminOrganisationPageRepository{
		schoolPage: learning.SchoolPage{
			Schools: []learning.SchoolConfig{{ID: "school-2", Name: "Beta", URN: "beta"}}, NextCursor: "school-next",
		},
		userPage: learning.SchoolUserPage{
			SchoolUsers: []learning.SchoolUserConfig{{ID: "user-2", SchoolName: "Beta", Role: "teacher", DisplayName: "Teacher Two"}}, NextCursor: "user-next",
		},
		classPage: learning.ClassPage{
			Classes: []learning.ClassConfig{{ID: "class-2", SchoolName: "Beta", Name: "Blue", YearGroup: 4}}, NextCursor: "class-next",
		},
	}
	srv := New(repo, "postgres")
	req := httptest.NewRequest(http.MethodGet, "/v1/admin/organisation-directory?limit=2&school_cursor=school-cursor&school_user_cursor=user-cursor&class_cursor=class-cursor", nil)
	req.Header.Set("X-Admin-Key", "test-admin")
	res := httptest.NewRecorder()
	srv.ServeHTTP(res, req)
	if res.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", res.Code, res.Body.String())
	}
	if repo.schoolQuery.Limit != 2 || repo.schoolQuery.Cursor != "school-cursor" || repo.userQuery.Cursor != "user-cursor" || repo.classQuery.Cursor != "class-cursor" {
		t.Fatalf("organisation cursors were not forwarded independently: school=%#v user=%#v class=%#v", repo.schoolQuery, repo.userQuery, repo.classQuery)
	}
	var body struct {
		Schools          []learning.SchoolConfig     `json:"schools"`
		SchoolNextCursor string                      `json:"school_next_cursor"`
		Users            []learning.SchoolUserConfig `json:"school_users"`
		UserNextCursor   string                      `json:"school_user_next_cursor"`
		Classes          []learning.ClassConfig      `json:"classes"`
		ClassNextCursor  string                      `json:"class_next_cursor"`
	}
	if err := json.NewDecoder(res.Body).Decode(&body); err != nil {
		t.Fatal(err)
	}
	if len(body.Schools) != 1 || body.SchoolNextCursor != "school-next" || len(body.Users) != 1 || body.UserNextCursor != "user-next" || len(body.Classes) != 1 || body.ClassNextCursor != "class-next" {
		t.Fatalf("unexpected combined organisation page: %#v", body)
	}
}

func (f *fakeAdminReleasePageRepository) StageContentRelease(_ context.Context, item learning.ContentReleaseManifest) (learning.ContentReleaseManifest, error) {
	return item, nil
}

func (f *fakeAdminReleasePageRepository) PutContentReleaseChunk(_ context.Context, id string, _ learning.ContentReleaseChunk) (learning.ContentReleaseManifest, error) {
	return learning.ContentReleaseManifest{ID: id}, nil
}

func (f *fakeAdminReleasePageRepository) ApplyContentRelease(_ context.Context, id string) (learning.ContentReleaseManifest, error) {
	return learning.ContentReleaseManifest{ID: id}, nil
}

func (f *fakeAdminReleasePageRepository) ListContentReleases(context.Context, int) ([]learning.ContentReleaseManifest, error) {
	return f.releasePage.ContentReleases, nil
}

func (f *fakeAdminReleasePageRepository) ListContentReleasePage(_ context.Context, query learning.AdminPageQuery) (learning.ContentReleasePage, error) {
	f.releaseCalls++
	f.releaseQuery = query
	return f.releasePage, nil
}

func (f *fakeAdminReleasePageRepository) ActiveContentRelease(context.Context, string) (learning.ContentReleaseManifest, bool, error) {
	return learning.ContentReleaseManifest{}, false, nil
}

func TestAdminLedgerHandlersPreserveKeysAndForwardCursor(t *testing.T) {
	t.Setenv("ADMIN_API_KEY", "test-admin")
	cursorTime := time.Date(2026, time.August, 18, 14, 30, 12, 0, time.UTC)
	cursor := rawAdminCursor(t, cursorTime, "00000000-0000-0000-0000-000000000002")
	repo := &fakeAdminReleasePageRepository{
		fakeAdminPageRepository: fakeAdminPageRepository{
			auditPage: learning.AuditLogPage{
				AuditLogs: []learning.AuditLog{{ID: "audit-1"}}, NextCursor: "audit-next",
			},
			versionPage: learning.ContentVersionPage{
				ContentVersions: []learning.ContentVersion{{ID: "version-1"}}, NextCursor: "version-next",
			},
		},
		releasePage: learning.ContentReleasePage{
			ContentReleases: []learning.ContentReleaseManifest{{ID: "release-1"}}, NextCursor: "release-next",
		},
	}
	srv := New(repo, "postgres")

	tests := []struct {
		name       string
		path       string
		key        string
		nextCursor string
		query      func() learning.AdminPageQuery
	}{
		{name: "audit", path: "/v1/admin/audit", key: "audit_logs", nextCursor: "audit-next", query: func() learning.AdminPageQuery { return repo.auditQuery }},
		{name: "versions", path: "/v1/admin/content/versions", key: "content_versions", nextCursor: "version-next", query: func() learning.AdminPageQuery { return repo.versionQuery }},
		{name: "releases", path: "/v1/admin/content/releases", key: "content_releases", nextCursor: "release-next", query: func() learning.AdminPageQuery { return repo.releaseQuery }},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			req := httptest.NewRequest(http.MethodGet, test.path+"?limit=2&cursor="+cursor, nil)
			req.Header.Set("X-Admin-Key", "test-admin")
			res := httptest.NewRecorder()
			srv.ServeHTTP(res, req)
			if res.Code != http.StatusOK {
				t.Fatalf("expected 200, got %d: %s", res.Code, res.Body.String())
			}
			query := test.query()
			if query.Limit != 2 || !query.BeforeCreatedAt.Equal(cursorTime) || query.BeforeID != "00000000-0000-0000-0000-000000000002" {
				t.Fatalf("pagination query was not forwarded: %#v", query)
			}
			var body map[string]json.RawMessage
			if err := json.NewDecoder(res.Body).Decode(&body); err != nil {
				t.Fatal(err)
			}
			if _, ok := body[test.key]; !ok {
				t.Fatalf("compatibility collection key %q is missing: %s", test.key, res.Body.String())
			}
			var next string
			if err := json.Unmarshal(body["next_cursor"], &next); err != nil || next != test.nextCursor {
				t.Fatalf("unexpected next_cursor: %q err=%v", next, err)
			}
		})
	}
}

func TestReleaseHistoryIncludesAuthoritativeLiveAppliedTruth(t *testing.T) {
	t.Setenv("ADMIN_API_KEY", "test-admin")
	repo := &fakeAdminReleasePageRepository{
		releasePage: learning.ContentReleasePage{
			ContentReleases: []learning.ContentReleaseManifest{{ID: "recent-review", Channel: "review", Status: "staged"}},
			LiveApplied:     true,
		},
	}
	srv := New(repo, "postgres")
	req := httptest.NewRequest(http.MethodGet, "/v1/admin/content/releases?limit=1", nil)
	req.Header.Set("X-Admin-Key", "test-admin")
	res := httptest.NewRecorder()
	srv.ServeHTTP(res, req)
	if res.Code != http.StatusOK {
		t.Fatalf("expected release history, got %d: %s", res.Code, res.Body.String())
	}
	var body struct {
		ContentReleases []learning.ContentReleaseManifest `json:"content_releases"`
		LiveApplied     bool                              `json:"live_applied"`
	}
	if err := json.NewDecoder(res.Body).Decode(&body); err != nil {
		t.Fatal(err)
	}
	if !body.LiveApplied || len(body.ContentReleases) != 1 || body.ContentReleases[0].Channel == "live" {
		t.Fatalf("release history did not preserve live truth beyond the returned page: %#v", body)
	}
}

func TestAdminLedgerQueryDefaultsAndCapsLimitAtOneHundred(t *testing.T) {
	for _, rawQuery := range []string{"", "limit=999"} {
		req := httptest.NewRequest(http.MethodGet, "/v1/admin/audit?"+rawQuery, nil)
		query, err := adminPageQuery(req)
		if err != nil {
			t.Fatal(err)
		}
		if query.Limit != 100 {
			t.Fatalf("query %q: expected limit 100, got %d", rawQuery, query.Limit)
		}
	}
}

func TestAdminLedgerHandlersRejectMalformedCursor(t *testing.T) {
	t.Setenv("ADMIN_API_KEY", "test-admin")
	repo := &fakeAdminReleasePageRepository{}
	srv := New(repo, "postgres")
	for _, path := range []string{
		"/v1/admin/audit",
		"/v1/admin/content/versions",
		"/v1/admin/content/releases",
	} {
		req := httptest.NewRequest(http.MethodGet, path+"?cursor=not-valid!", nil)
		req.Header.Set("X-Admin-Key", "test-admin")
		res := httptest.NewRecorder()
		srv.ServeHTTP(res, req)
		if res.Code != http.StatusBadRequest {
			t.Fatalf("%s: expected malformed cursor 400, got %d: %s", path, res.Code, res.Body.String())
		}
	}
	if repo.auditCalls != 0 || repo.versionCalls != 0 || repo.releaseCalls != 0 {
		t.Fatalf("malformed cursors must not reach repositories: %#v", repo)
	}
}

func TestAdminLedgerHandlersKeepPlatformAdminAuthorization(t *testing.T) {
	t.Setenv("ADMIN_API_KEY", "test-admin")
	repo := &fakeAdminReleasePageRepository{}
	srv := New(repo, "postgres")
	for _, path := range []string{
		"/v1/admin/audit",
		"/v1/admin/content/versions",
		"/v1/admin/content/releases",
	} {
		res := httptest.NewRecorder()
		srv.ServeHTTP(res, httptest.NewRequest(http.MethodGet, path, nil))
		if res.Code != http.StatusUnauthorized {
			t.Fatalf("%s: expected 401, got %d", path, res.Code)
		}
	}
	if repo.auditCalls != 0 || repo.versionCalls != 0 || repo.releaseCalls != 0 {
		t.Fatalf("unauthorized requests must not reach repositories: %#v", repo)
	}
}

func rawAdminCursor(t *testing.T, createdAt time.Time, id string) string {
	t.Helper()
	raw, err := json.Marshal(map[string]string{
		"created_at": createdAt.UTC().Format(time.RFC3339Nano),
		"id":         id,
	})
	if err != nil {
		t.Fatal(err)
	}
	return base64.RawURLEncoding.EncodeToString(raw)
}
