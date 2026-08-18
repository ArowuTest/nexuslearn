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
