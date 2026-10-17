package server

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/ArowuTest/nexuslearn/apps/api/internal/learning"
)

func TestMain(m *testing.M) {
	if os.Getenv("ALLOW_LEGACY_CREDENTIAL_HEADERS") == "" {
		_ = os.Setenv("ALLOW_LEGACY_CREDENTIAL_HEADERS", "true")
	}
	os.Exit(m.Run())
}

func TestLegacyCredentialHeadersDefaultOff(t *testing.T) {
	t.Setenv("ALLOW_LEGACY_CREDENTIAL_HEADERS", "")
	t.Setenv("ADMIN_API_KEY", "secret")
	srv := New(fakeRepository{}, "memory")
	req := httptest.NewRequest(http.MethodGet, "/v1/admin/students", nil)
	req.Header.Set("X-Admin-Key", "secret")
	res := httptest.NewRecorder()
	srv.ServeHTTP(res, req)
	if res.Code != http.StatusUnauthorized {
		t.Fatalf("shared password header was accepted, status %d", res.Code)
	}
}

func TestCORSAllowsConfiguredOriginsOnly(t *testing.T) {
	t.Setenv("CORS_ALLOWED_ORIGINS", "https://family.example")
	t.Setenv("NEXUSLEARN_ENV", "")
	t.Setenv("APP_ENV", "")
	t.Setenv("RENDER", "")
	srv := New(fakeRepository{}, "memory")

	req := httptest.NewRequest(http.MethodGet, "/healthz", nil)
	req.Header.Set("Origin", "https://family.example")
	res := httptest.NewRecorder()
	srv.ServeHTTP(res, req)
	if res.Header().Get("Access-Control-Allow-Origin") != "https://family.example" {
		t.Fatalf("allowed origin header = %q", res.Header().Get("Access-Control-Allow-Origin"))
	}
	if res.Header().Get("X-Content-Type-Options") != "nosniff" {
		t.Fatal("security header missing")
	}

	req = httptest.NewRequest(http.MethodOptions, "/healthz", nil)
	req.Header.Set("Origin", "https://evil.example")
	res = httptest.NewRecorder()
	srv.ServeHTTP(res, req)
	if res.Code != http.StatusForbidden || res.Header().Get("Access-Control-Allow-Origin") == "*" {
		t.Fatalf("disallowed origin status %d origin %q", res.Code, res.Header().Get("Access-Control-Allow-Origin"))
	}

	req = httptest.NewRequest(http.MethodGet, "/healthz", nil)
	res = httptest.NewRecorder()
	srv.ServeHTTP(res, req)
	if res.Code != http.StatusOK || res.Header().Get("Access-Control-Allow-Origin") != "" {
		t.Fatalf("same-origin health status %d origin %q", res.Code, res.Header().Get("Access-Control-Allow-Origin"))
	}
}

func TestLoginLockoutAndBodyLimit(t *testing.T) {
	srv := New(fakeRepository{}, "memory")
	for attempt := 1; attempt <= 5; attempt++ {
		req := httptest.NewRequest(http.MethodPost, "/v1/auth/admin-login", strings.NewReader(`{"login_id":"admin@example.com","password":"wrong"}`))
		res := httptest.NewRecorder()
		srv.ServeHTTP(res, req)
		if res.Code != http.StatusUnauthorized {
			t.Fatalf("attempt %d status %d body %s", attempt, res.Code, res.Body.String())
		}
	}
	req := httptest.NewRequest(http.MethodPost, "/v1/auth/admin-login", strings.NewReader(`{"login_id":"admin@example.com","password":"wrong"}`))
	res := httptest.NewRecorder()
	srv.ServeHTTP(res, req)
	if res.Code != http.StatusTooManyRequests || res.Header().Get("Retry-After") == "" {
		t.Fatalf("lockout status %d retry %q", res.Code, res.Header().Get("Retry-After"))
	}
	req = httptest.NewRequest(http.MethodPost, "/v1/auth/admin-login", strings.NewReader(strings.Repeat("a", 20_000)))
	res = httptest.NewRecorder()
	srv.ServeHTTP(res, req)
	if res.Code != http.StatusRequestEntityTooLarge {
		t.Fatalf("large body status %d", res.Code)
	}
}

func TestPicturePasswordCompare(t *testing.T) {
	if !sameStringSequence([]string{" Cat ", "Dog"}, []string{"cat", "dog"}) {
		t.Fatal("picture passwords should ignore case and surrounding spaces")
	}
	if sameStringSequence([]string{"cat"}, []string{"cat", "dog"}) || sameStringSequence([]string{"dog", "cat"}, []string{"cat", "dog"}) {
		t.Fatal("picture password order and length must still matter")
	}
}

func TestProductionRefusesIncompleteConfig(t *testing.T) {
	t.Setenv("NEXUSLEARN_ENV", "production")
	t.Setenv("DATABASE_URL", "")
	t.Setenv("ACCOUNT_SESSION_SECRET", "")
	t.Setenv("PUPIL_SESSION_SECRET", "")
	t.Setenv("CORS_ALLOWED_ORIGINS", "")
	t.Setenv("WEB_ORIGIN", "")
	t.Setenv("DATA_RETENTION_DAYS", "")
	if err := ValidateProductionEnvironment(); err == nil {
		t.Fatal("production started without a database, session secrets and an allowed origin")
	}
	t.Setenv("DATABASE_URL", "postgres://example")
	t.Setenv("ACCOUNT_SESSION_SECRET", "account")
	t.Setenv("PUPIL_SESSION_SECRET", "pupil")
	t.Setenv("CORS_ALLOWED_ORIGINS", "https://family.example")
	if err := ValidateProductionEnvironment(); err != nil {
		t.Fatal(err)
	}
	srv := New(fakeRepository{}, "memory")
	req := httptest.NewRequest(http.MethodGet, "/readyz", nil)
	res := httptest.NewRecorder()
	srv.ServeHTTP(res, req)
	if res.Code != http.StatusServiceUnavailable {
		t.Fatalf("memory mode in production readyz = %d", res.Code)
	}
}

func TestHTTPServerTimeouts(t *testing.T) {
	srv := NewHTTPServer(":8080", http.NewServeMux())
	if srv.ReadHeaderTimeout != 5*time.Second || srv.ReadTimeout != 30*time.Second || srv.WriteTimeout != 60*time.Second || srv.IdleTimeout != 120*time.Second {
		t.Fatalf("timeouts = %s %s %s %s", srv.ReadHeaderTimeout, srv.ReadTimeout, srv.WriteTimeout, srv.IdleTimeout)
	}
}

func TestMissionHidesUnapprovedAIQuestions(t *testing.T) {
	srv := New(fakeRepository{
		activities: []learning.ActivityConfig{{ID: "act", ObjectiveID: "obj", Status: "published", WorldKey: "garden"}},
		questions: []learning.QuestionConfig{
			{ID: "seed", ActivityID: "act", ObjectiveID: "obj", Status: "published", Format: "number"},
			{ID: "draft-ai", ActivityID: "act", ObjectiveID: "obj", Status: "published", Format: "number", Body: map[string]any{"ai_generated": true}},
		},
	}, "memory")
	req := httptest.NewRequest(http.MethodGet, "/v1/learning/mission?studentId=ava&activityId=act", nil)
	res := httptest.NewRecorder()
	srv.ServeHTTP(res, req)
	if res.Code != http.StatusOK {
		t.Fatalf("mission status %d %s", res.Code, res.Body.String())
	}
	var body struct {
		Questions []struct {
			ID string `json:"id"`
		} `json:"questions"`
	}
	if err := json.Unmarshal(res.Body.Bytes(), &body); err != nil {
		t.Fatal(err)
	}
	if len(body.Questions) != 1 || body.Questions[0].ID != "seed" {
		t.Fatalf("questions = %#v", body.Questions)
	}
}

func TestPackApprovalDoesNotPublishUntilAPersonApprovesAudio(t *testing.T) {
	t.Setenv("ACCOUNT_SESSION_SECRET", "test-account-session-secret")
	repo := fakeRepository{
		platformUser:   learning.PlatformUserConfig{ID: "parent-1", LoginID: "parent@example.com", Roles: []string{"content_reviewer"}, Status: "active"},
		accountSession: learning.AccountSession{UserID: "parent-1", LoginID: "parent@example.com", Role: "content_reviewer"},
	}
	srv := New(repo, "memory")
	login := httptest.NewRequest(http.MethodPost, "/v1/auth/admin-login", strings.NewReader(`{"login_id":"parent@example.com","password":"a-secure-password"}`))
	loginRes := httptest.NewRecorder()
	srv.ServeHTTP(loginRes, login)
	if loginRes.Code != http.StatusOK {
		t.Fatalf("login %d %s", loginRes.Code, loginRes.Body.String())
	}
	var session struct {
		Session struct {
			Token string `json:"token"`
		} `json:"session"`
	}
	if err := json.Unmarshal(loginRes.Body.Bytes(), &session); err != nil {
		t.Fatal(err)
	}
	req := httptest.NewRequest(http.MethodPost, "/v1/admin/content/pack-approvals", strings.NewReader(`{"pack_id":"en-y1-listening","decision":"approved","notes":"I listened to this pack with the child nearby.","narration_ids":["clip-1"]}`))
	req.Header.Set("Authorization", "Bearer "+session.Session.Token)
	res := httptest.NewRecorder()
	srv.ServeHTTP(res, req)
	if res.Code != http.StatusOK || !strings.Contains(res.Body.String(), `"catalogue_changed":false`) {
		t.Fatalf("approval %d %s", res.Code, res.Body.String())
	}
	req = httptest.NewRequest(http.MethodGet, "/v1/runtime/narration-approvals", nil)
	res = httptest.NewRecorder()
	srv.ServeHTTP(res, req)
	if !strings.Contains(res.Body.String(), "clip-1") {
		t.Fatalf("approvals %s", res.Body.String())
	}
}

func TestParentConsentExportAndDelete(t *testing.T) {
	srv := New(fakeRepository{
		verifyParent: true,
		parentPortal: learning.ParentPortalConfig{
			Parent:   learning.ParentAccountConfig{LoginID: "parent@example.com"},
			Children: []learning.ParentChildConfig{{Student: learning.StudentProfileConfig{ExternalRef: "ada-home"}}},
		},
	}, "memory")
	consent := httptest.NewRequest(http.MethodPost, "/v1/parent/consent", strings.NewReader(`{"student_external_ref":"ada-home","purpose":"family_learning","policy_version":"2026-10-17"}`))
	consent.Header.Set("X-Parent-Login", "parent@example.com")
	consent.Header.Set("X-Parent-Password", "secret")
	res := httptest.NewRecorder()
	srv.ServeHTTP(res, consent)
	if res.Code != http.StatusOK {
		t.Fatalf("consent %d %s", res.Code, res.Body.String())
	}
	req := httptest.NewRequest(http.MethodGet, "/v1/parent/children/ada-home/export", nil)
	req.Header.Set("X-Parent-Login", "parent@example.com")
	req.Header.Set("X-Parent-Password", "secret")
	res = httptest.NewRecorder()
	srv.ServeHTTP(res, req)
	if res.Code != http.StatusOK || !strings.Contains(res.Body.String(), `"secrets_included":false`) {
		t.Fatalf("export %d %s", res.Code, res.Body.String())
	}
	req = httptest.NewRequest(http.MethodGet, "/v1/privacy/policy", nil)
	res = httptest.NewRecorder()
	srv.ServeHTTP(res, req)
	if res.Code != http.StatusOK || !strings.Contains(res.Body.String(), `"marketing":false`) {
		t.Fatalf("policy %d %s", res.Code, res.Body.String())
	}
	req = httptest.NewRequest(http.MethodDelete, "/v1/parent/children/ada-home", strings.NewReader(`{"confirm":"delete"}`))
	req.Header.Set("X-Parent-Login", "parent@example.com")
	req.Header.Set("X-Parent-Password", "secret")
	res = httptest.NewRecorder()
	srv.ServeHTTP(res, req)
	if res.Code != http.StatusOK {
		t.Fatalf("delete %d %s", res.Code, res.Body.String())
	}
}

type consentRepository struct {
	fakeRepository
	schoolHeld bool
	linked     bool
	consent    bool
}

func (c consentRepository) FamilyChildAccess(context.Context, string) (bool, bool, bool, error) {
	return c.schoolHeld, c.linked, c.consent, nil
}

func TestFamilyLoginRequiresConsentWhenConfigured(t *testing.T) {
	t.Setenv("REQUIRE_PARENTAL_CONSENT", "true")
	repo := consentRepository{
		fakeRepository: fakeRepository{
			credentials: []learning.StudentCredentialConfig{{StudentExternalRef: "ada-home", LoginCode: "ADA-1"}},
			students:    []learning.StudentProfileConfig{{ExternalRef: "ada-home", DisplayName: "Ada", YearGroup: 1}},
			hasBaseline: true,
		},
		linked: true,
	}
	srv := New(repo, "memory")
	body := `{"student_external_ref":"ada-home","login_code":"ADA-1"}`
	req := httptest.NewRequest(http.MethodPost, "/v1/auth/pupil-login", strings.NewReader(body))
	res := httptest.NewRecorder()
	srv.ServeHTTP(res, req)
	if res.Code != http.StatusForbidden {
		t.Fatalf("expected consent refusal, got %d %s", res.Code, res.Body.String())
	}
	repo.consent = true
	srv = New(repo, "memory")
	req = httptest.NewRequest(http.MethodPost, "/v1/auth/pupil-login", strings.NewReader(body))
	res = httptest.NewRecorder()
	srv.ServeHTTP(res, req)
	if res.Code != http.StatusOK {
		t.Fatalf("consent should allow login, got %d %s", res.Code, res.Body.String())
	}
}

func TestCurriculumRegionEndpoint(t *testing.T) {
	t.Setenv("CURRICULUM_REGION", "nigeria")
	srv := New(fakeRepository{}, "memory")
	req := httptest.NewRequest(http.MethodGet, "/v1/curriculum/region", nil)
	res := httptest.NewRecorder()
	srv.ServeHTTP(res, req)
	if res.Code != http.StatusOK || !strings.Contains(res.Body.String(), "JSS 1") || !strings.Contains(res.Body.String(), `"region":"nigeria"`) {
		t.Fatalf("region %d %s", res.Code, res.Body.String())
	}
}
