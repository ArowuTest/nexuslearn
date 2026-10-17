package server

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/ArowuTest/nexuslearn/apps/api/internal/learning"
)

func TestProductionRefusesMemoryAndMissingSessionSecrets(t *testing.T) {
	t.Setenv("NEXUSLEARN_ENV", "")
	t.Setenv("RENDER", "")
	if err := ValidateProductionConfig(); err != nil {
		t.Fatal(err)
	}
	t.Setenv("NEXUSLEARN_ENV", "production")
	t.Setenv("DATABASE_URL", "")
	if err := ValidateProductionConfig(); err == nil || !strings.Contains(err.Error(), "DATABASE_URL") {
		t.Fatalf("expected database refusal, got %v", err)
	}
	t.Setenv("DATABASE_URL", "postgres://example")
	t.Setenv("ACCOUNT_SESSION_SECRET", "")
	t.Setenv("PUPIL_SESSION_SECRET", "pupil")
	if err := ValidateProductionConfig(); err == nil || !strings.Contains(err.Error(), "ACCOUNT_SESSION_SECRET") {
		t.Fatalf("expected account secret refusal, got %v", err)
	}
	t.Setenv("ACCOUNT_SESSION_SECRET", "account")
	t.Setenv("PUPIL_SESSION_SECRET", "")
	if err := ValidateProductionConfig(); err == nil || !strings.Contains(err.Error(), "PUPIL_SESSION_SECRET") {
		t.Fatalf("expected pupil secret refusal, got %v", err)
	}
}

func TestLegacyCredentialHeadersDefaultOff(t *testing.T) {
	t.Setenv("ALLOW_LEGACY_CREDENTIAL_HEADERS", "")
	srv := New(nil, "memory")
	if srv.allowLegacyAuth {
		t.Fatal("legacy shared passwords are on by default")
	}
	req := httptest.NewRequest(http.MethodGet, "/v1/admin/config", nil)
	req.Header.Set("X-Admin-Key", "test-admin")
	res := httptest.NewRecorder()
	srv.ServeHTTP(res, req)
	if res.Code != http.StatusUnauthorized || !strings.Contains(res.Body.String(), "administrator session required") {
		t.Fatalf("legacy admin key was accepted: %d %s", res.Code, res.Body.String())
	}
}

func TestCORSAllowsOnlyConfiguredOrigins(t *testing.T) {
	t.Setenv("NEXUSLEARN_ENV", "production")
	t.Setenv("CORS_ALLOWED_ORIGINS", "https://family.example")
	srv := New(nil, "memory")
	denied := httptest.NewRequest(http.MethodGet, "/healthz", nil)
	denied.Header.Set("Origin", "https://evil.example")
	deniedRes := httptest.NewRecorder()
	srv.ServeHTTP(deniedRes, denied)
	if deniedRes.Header().Get("Access-Control-Allow-Origin") != "" {
		t.Fatal("unexpected origin was reflected")
	}
	allowed := httptest.NewRequest(http.MethodOptions, "/healthz", nil)
	allowed.Header.Set("Origin", "https://family.example")
	allowedRes := httptest.NewRecorder()
	srv.ServeHTTP(allowedRes, allowed)
	if allowedRes.Code != http.StatusNoContent || allowedRes.Header().Get("Access-Control-Allow-Origin") != "https://family.example" {
		t.Fatalf("configured origin blocked: %d %q", allowedRes.Code, allowedRes.Header().Get("Access-Control-Allow-Origin"))
	}
}

func TestLocalDevelopmentAllowsLocalhostOnly(t *testing.T) {
	t.Setenv("NEXUSLEARN_ENV", "")
	t.Setenv("RENDER", "")
	t.Setenv("CORS_ALLOWED_ORIGINS", "")
	srv := New(nil, "memory")
	req := httptest.NewRequest(http.MethodGet, "/healthz", nil)
	req.Header.Set("Origin", "http://localhost:3000")
	res := httptest.NewRecorder()
	srv.ServeHTTP(res, req)
	if res.Header().Get("Access-Control-Allow-Origin") != "http://localhost:3000" {
		t.Fatalf("localhost blocked: %q", res.Header().Get("Access-Control-Allow-Origin"))
	}
	other := httptest.NewRequest(http.MethodGet, "/healthz", nil)
	other.Header.Set("Origin", "https://family.example")
	otherRes := httptest.NewRecorder()
	srv.ServeHTTP(otherRes, other)
	if otherRes.Header().Get("Access-Control-Allow-Origin") != "" {
		t.Fatal("development mode reflected a public origin")
	}
}

func TestHTTPServerHasTimeouts(t *testing.T) {
	srv := NewHTTPServer(":8080", http.NewServeMux())
	if srv.ReadHeaderTimeout == 0 || srv.ReadTimeout == 0 || srv.WriteTimeout == 0 || srv.IdleTimeout < time.Minute {
		t.Fatalf("timeouts missing: %+v", srv)
	}
}

func TestLoginLockout(t *testing.T) {
	t.Setenv("ALLOW_LEGACY_CREDENTIAL_HEADERS", "")
	srv := New(fakeRepository{credentials: []learning.StudentCredentialConfig{{
		StudentExternalRef: "child-1", LoginCode: "HOME-TEST",
	}}}, "memory")
	for i := 0; i < 8; i++ {
		res := postLogin(srv, `{"student_external_ref":"child-1","login_code":"WRONG"}`)
		if res.Code != http.StatusUnauthorized {
			t.Fatalf("attempt %d: %d %s", i+1, res.Code, res.Body.String())
		}
	}
	res := postLogin(srv, `{"student_external_ref":"child-1","login_code":"HOME-TEST"}`)
	if res.Code != http.StatusTooManyRequests {
		t.Fatalf("lockout missing: %d %s", res.Code, res.Body.String())
	}
}

func TestProductionRequiresPupilSessionAndDisablesBootstrap(t *testing.T) {
	t.Setenv("NEXUSLEARN_ENV", "production")
	t.Setenv("RENDER", "")
	t.Setenv("PUPIL_SESSION_SECRET", "pupil-secret")
	t.Setenv("ALLOW_ANONYMOUS_PUPIL_ROUTES", "")
	t.Setenv("ALLOW_BOOTSTRAP_ADMIN", "")
	t.Setenv("ADMIN_API_KEY", "bootstrap-secret")
	srv := New(nil, "memory")
	profile := httptest.NewRequest(http.MethodGet, "/v1/students/child-1/profile", nil)
	profileRes := httptest.NewRecorder()
	srv.ServeHTTP(profileRes, profile)
	if profileRes.Code != http.StatusUnauthorized || !strings.Contains(profileRes.Body.String(), "valid pupil session required") {
		t.Fatalf("anonymous pupil route stayed open: %d %s", profileRes.Code, profileRes.Body.String())
	}
	bootstrap := httptest.NewRequest(http.MethodPut, "/v1/admin/platform-users/owner@example.com", strings.NewReader(`{}`))
	bootstrap.Header.Set("X-Admin-Key", "bootstrap-secret")
	bootstrapRes := httptest.NewRecorder()
	srv.ServeHTTP(bootstrapRes, bootstrap)
	if bootstrapRes.Code != http.StatusUnauthorized || !strings.Contains(bootstrapRes.Body.String(), "bootstrap administrator access is disabled") {
		t.Fatalf("bootstrap key stayed on: %d %s", bootstrapRes.Code, bootstrapRes.Body.String())
	}
}

func TestYearLabelsRetentionAndReadiness(t *testing.T) {
	t.Setenv("NEXUSLEARN_ENV", "")
	t.Setenv("RENDER", "")
	srv := New(nil, "memory")
	nigeria := httptest.NewRequest(http.MethodGet, "/v1/curriculum/year-labels?region=nigeria", nil)
	nigeriaRes := httptest.NewRecorder()
	srv.ServeHTTP(nigeriaRes, nigeria)
	if nigeriaRes.Code != http.StatusOK || !strings.Contains(nigeriaRes.Body.String(), "Primary 1") || !strings.Contains(nigeriaRes.Body.String(), "JSS 1") {
		t.Fatalf("nigeria labels: %d %s", nigeriaRes.Code, nigeriaRes.Body.String())
	}
	england := httptest.NewRequest(http.MethodGet, "/v1/curriculum/year-labels", nil)
	englandRes := httptest.NewRecorder()
	srv.ServeHTTP(englandRes, england)
	if !strings.Contains(englandRes.Body.String(), `"region":"england"`) || !strings.Contains(englandRes.Body.String(), "Year 1") {
		t.Fatalf("england default: %s", englandRes.Body.String())
	}
	retention := httptest.NewRequest(http.MethodGet, "/v1/privacy/retention", nil)
	retentionRes := httptest.NewRecorder()
	srv.ServeHTTP(retentionRes, retention)
	body := retentionRes.Body.String()
	if retentionRes.Code != http.StatusOK || !strings.Contains(body, `"automatic_deletion":false`) || strings.Contains(body, "delete_automatically") {
		t.Fatalf("retention: %d %s", retentionRes.Code, body)
	}
	ready := httptest.NewRequest(http.MethodGet, "/readyz", nil)
	readyRes := httptest.NewRecorder()
	srv.ServeHTTP(readyRes, ready)
	if readyRes.Code != http.StatusOK {
		t.Fatalf("dev readiness: %d %s", readyRes.Code, readyRes.Body.String())
	}
	t.Setenv("NEXUSLEARN_ENV", "production")
	blocked := httptest.NewRequest(http.MethodGet, "/readyz", nil)
	blockedRes := httptest.NewRecorder()
	srv.ServeHTTP(blockedRes, blocked)
	if blockedRes.Code != http.StatusServiceUnavailable {
		t.Fatalf("production memory was ready: %d %s", blockedRes.Code, blockedRes.Body.String())
	}
}

func postLogin(srv *Server, body string) *httptest.ResponseRecorder {
	req := httptest.NewRequest(http.MethodPost, "/v1/auth/pupil-login", strings.NewReader(body))
	req.RemoteAddr = "203.0.113.9:1234"
	res := httptest.NewRecorder()
	srv.ServeHTTP(res, req)
	return res
}
