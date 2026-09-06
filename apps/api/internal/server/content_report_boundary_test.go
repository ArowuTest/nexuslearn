package server

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"
)

func TestContentReportDownloadsRequireAdminAndDoNotCache(t *testing.T) {
	t.Setenv("ADMIN_API_KEY", "test-admin")
	dir := t.TempDir()
	t.Setenv("GENERATED_CONTENT_REPORT_DIR", dir)
	if err := os.WriteFile(filepath.Join(dir, "pack-depth-readiness.json"), []byte(`{"status":"private-audit"}`), 0600); err != nil {
		t.Fatal(err)
	}
	srv := New(fakeRepository{}, "postgres")
	for _, tc := range []struct {
		name, key string
		want      int
	}{
		{"pack-depth-readiness", "", 401},
		{"pack-depth-readiness", "wrong", 401},
		{"pack-depth-readiness", "test-admin", 200},
		{"secrets", "test-admin", 404},
	} {
		req := httptest.NewRequest(http.MethodGet, "/v1/admin/content/reports/"+tc.name, nil)
		req.Header.Set("X-Admin-Key", tc.key)
		res := httptest.NewRecorder()
		srv.ServeHTTP(res, req)
		if res.Code != tc.want {
			t.Fatalf("%s authenticated=%t: got %d want %d", tc.name, tc.key != "", res.Code, tc.want)
		}
		if tc.want == 200 {
			var body struct {
				Status string `json:"status"`
			}
			if err := json.Unmarshal(res.Body.Bytes(), &body); err != nil {
				t.Fatal(err)
			}
			if body.Status != "private-audit" {
				t.Fatalf("wrong report: %#v", body)
			}
			if res.Header().Get("Cache-Control") != "private, no-store" {
				t.Fatal("private reports must not be cached")
			}
		}
	}
}

func TestNarrationReportAccessErrorsAreNotCached(t *testing.T) {
	t.Setenv("ADMIN_API_KEY", "test-admin")
	srv := New(fakeRepository{}, "postgres")
	req := httptest.NewRequest(http.MethodGet, "/v1/admin/content/narration-readiness", nil)
	res := httptest.NewRecorder()
	srv.ServeHTTP(res, req)
	if res.Code != http.StatusUnauthorized {
		t.Fatalf("got %d", res.Code)
	}
	if res.Header().Get("Cache-Control") != "private, no-store" {
		t.Fatal("narration report boundary must not cache access errors")
	}
}
