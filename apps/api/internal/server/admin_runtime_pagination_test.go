package server

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/ArowuTest/nexuslearn/apps/api/internal/learning"
)

type fakeAdminRuntimePageRepository struct {
	fakeRepository
	worldPage  learning.WorldPage
	flagPage   learning.FeatureFlagPage
	worldQuery learning.AdminRuntimePageQuery
	flagQuery  learning.AdminRuntimePageQuery
}

func (f *fakeAdminRuntimePageRepository) ListWorldPage(_ context.Context, query learning.AdminRuntimePageQuery) (learning.WorldPage, error) {
	f.worldQuery = query
	return f.worldPage, nil
}

func (f *fakeAdminRuntimePageRepository) ListFeatureFlagPage(_ context.Context, query learning.AdminRuntimePageQuery) (learning.FeatureFlagPage, error) {
	f.flagQuery = query
	return f.flagPage, nil
}

func TestAdminRuntimeDirectoryHandlersForwardOpaquePages(t *testing.T) {
	t.Setenv("ADMIN_API_KEY", "test-admin")
	repo := &fakeAdminRuntimePageRepository{
		worldPage: learning.WorldPage{Worlds: []learning.WorldConfig{{Key: "world-1"}}, NextCursor: "world-next"},
		flagPage:  learning.FeatureFlagPage{FeatureFlags: []learning.FeatureFlag{{Key: "flag-1"}}, NextCursor: "flag-next"},
	}
	srv := New(repo, "postgres")
	tests := []struct {
		name      string
		path      string
		wantKey   string
		wantQuery func() learning.AdminRuntimePageQuery
	}{
		{name: "worlds", path: "/v1/admin/world-directory", wantKey: "worlds", wantQuery: func() learning.AdminRuntimePageQuery { return repo.worldQuery }},
		{name: "flags", path: "/v1/admin/feature-flag-directory", wantKey: "feature_flags", wantQuery: func() learning.AdminRuntimePageQuery { return repo.flagQuery }},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			req := httptest.NewRequest(http.MethodGet, test.path+"?limit=37&cursor=opaque-runtime-cursor", nil)
			req.Header.Set("X-Admin-Key", "test-admin")
			res := httptest.NewRecorder()
			srv.ServeHTTP(res, req)
			if res.Code != http.StatusOK {
				t.Fatalf("expected 200, got %d: %s", res.Code, res.Body.String())
			}
			query := test.wantQuery()
			if query.Limit != 37 || query.Cursor != "opaque-runtime-cursor" {
				t.Fatalf("runtime query was not forwarded: %#v", query)
			}
			var body map[string]json.RawMessage
			if err := json.NewDecoder(res.Body).Decode(&body); err != nil {
				t.Fatal(err)
			}
			if _, ok := body[test.wantKey]; !ok {
				t.Fatalf("collection key %q is missing: %s", test.wantKey, res.Body.String())
			}
		})
	}

	for _, path := range []string{
		"/v1/admin/world-directory?limit=2",
		"/v1/admin/feature-flag-directory?limit=2",
	} {
		res := httptest.NewRecorder()
		srv.ServeHTTP(res, httptest.NewRequest(http.MethodGet, path, nil))
		if res.Code != http.StatusUnauthorized {
			t.Fatalf("%s: expected 401, got %d", path, res.Code)
		}
	}
}
