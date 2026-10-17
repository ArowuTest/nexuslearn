package server

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/ArowuTest/nexuslearn/apps/api/internal/learning"
	"github.com/ArowuTest/nexuslearn/apps/api/internal/platformenv"
)

func TestMain(m *testing.M) {
	platformenv.EnableTestProcess()
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
	if err := ValidateProductionEnvironment(); err == nil {
		t.Fatal("short session secrets were accepted")
	}
	t.Setenv("ACCOUNT_SESSION_SECRET", strings.Repeat("a", 32))
	t.Setenv("PUPIL_SESSION_SECRET", strings.Repeat("b", 32))
	t.Setenv("ALLOW_LEGACY_CREDENTIAL_HEADERS", "true")
	if err := ValidateProductionEnvironment(); err == nil {
		t.Fatal("legacy header authentication was allowed in production")
	}
	t.Setenv("ALLOW_LEGACY_CREDENTIAL_HEADERS", "false")
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
	req := httptest.NewRequest(http.MethodPost, "/v1/admin/content/pack-approvals", strings.NewReader(`{"pack_id":"en-y1-listening-comprehension","decision":"approved","notes":"I listened to this pack with the child nearby.","narration_ids":["en-y1-listening-comprehension--vocabulary--listen"]}`))
	req.Header.Set("Authorization", "Bearer "+session.Session.Token)
	res := httptest.NewRecorder()
	srv.ServeHTTP(res, req)
	if res.Code != http.StatusOK || !strings.Contains(res.Body.String(), `"catalogue_changed":false`) {
		t.Fatalf("approval %d %s", res.Code, res.Body.String())
	}
	req = httptest.NewRequest(http.MethodGet, "/v1/runtime/narration-approvals", nil)
	res = httptest.NewRecorder()
	srv.ServeHTTP(res, req)
	if !strings.Contains(res.Body.String(), "en-y1-listening-comprehension--vocabulary--listen") {
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

type guardedSignupRepo struct {
	fakeRepository
	blockedEmail string
}

func (g guardedSignupRepo) CreateParentAccount(ctx context.Context, parent learning.ParentAccountConfig) (learning.ParentAccountConfig, error) {
	if strings.EqualFold(parent.Email, g.blockedEmail) {
		return learning.ParentAccountConfig{}, learning.ErrParentAccountExists
	}
	return g.fakeRepository.CreateParentAccount(ctx, parent)
}

func TestSignupRejectsExistingEmailWithoutASession(t *testing.T) {
	t.Setenv("ACCOUNT_SESSION_SECRET", strings.Repeat("s", 32))
	srv := New(guardedSignupRepo{blockedEmail: "root@example.com"}, "memory")
	var first string
	for _, email := range []string{"root@example.com", "ROOT@example.com", "new-parent@example.com"} {
		req := httptest.NewRequest(http.MethodPost, "/v1/parents/signup", strings.NewReader(`{"email":"`+email+`","display_name":"Attacker","password":"a-new-password"}`))
		res := httptest.NewRecorder()
		srv.ServeHTTP(res, req)
		body := res.Body.String()
		if res.Code != http.StatusCreated || strings.Contains(strings.ToLower(body), "exist") || strings.Contains(body, "session") || !strings.Contains(body, parentSignupAcknowledgement) {
			t.Fatalf("signup %s status %d body %s", email, res.Code, body)
		}
		if first == "" {
			first = body
			continue
		}
		if body != first {
			t.Fatalf("existing and new signup responses differ: %s vs %s", first, body)
		}
	}
}

func TestSignupRateLimitCountsConflicts(t *testing.T) {
	srv := New(guardedSignupRepo{blockedEmail: "root@example.com"}, "memory")
	for attempt := 1; attempt <= 5; attempt++ {
		req := httptest.NewRequest(http.MethodPost, "/v1/parents/signup", strings.NewReader(`{"email":"root@example.com","display_name":"Attacker","password":"a-new-password"}`))
		req.RemoteAddr = "203.0.113.9:1000"
		res := httptest.NewRecorder()
		srv.ServeHTTP(res, req)
		if res.Code != http.StatusCreated {
			t.Fatalf("attempt %d status %d", attempt, res.Code)
		}
	}
	req := httptest.NewRequest(http.MethodPost, "/v1/parents/signup", strings.NewReader(`{"email":"other@example.com","display_name":"Other","password":"a-new-password"}`))
	req.RemoteAddr = "203.0.113.9:1000"
	req.Header.Set("X-Forwarded-For", "198.51.100.4")
	res := httptest.NewRecorder()
	srv.ServeHTTP(res, req)
	if res.Code != http.StatusTooManyRequests {
		t.Fatalf("signup lockout status %d body %s", res.Code, res.Body.String())
	}
}

func TestClientIPUsesTheTrustedProxyHop(t *testing.T) {
	t.Setenv("NEXUSLEARN_ENV", "")
	t.Setenv("APP_ENV", "")
	t.Setenv("RENDER", "")
	t.Setenv("NEXUSLEARN_TRUST_PROXY", "true")
	proxied := httptest.NewRequest(http.MethodGet, "/healthz", nil)
	proxied.RemoteAddr = "10.0.0.8:443"
	proxied.Header.Set("X-Forwarded-For", "198.51.100.4, 203.0.113.9")
	if clientIP(proxied) != "203.0.113.9" {
		t.Fatalf("trusted hop = %s", clientIP(proxied))
	}
	t.Setenv("NEXUSLEARN_TRUST_PROXY", "false")
	direct := httptest.NewRequest(http.MethodGet, "/healthz", nil)
	direct.RemoteAddr = "203.0.113.8:443"
	direct.Header.Set("X-Forwarded-For", "198.51.100.4")
	if clientIP(direct) != "203.0.113.8" {
		t.Fatalf("direct connection trusted the caller header: %s", clientIP(direct))
	}
	t.Setenv("NEXUSLEARN_ENV", "production")
	t.Setenv("NEXUSLEARN_TRUST_PROXY", "")
	behindRender := httptest.NewRequest(http.MethodGet, "/healthz", nil)
	behindRender.RemoteAddr = "10.0.0.8:443"
	behindRender.Header.Set("X-Forwarded-For", "198.51.100.4, 203.0.113.10")
	if clientIP(behindRender) != "203.0.113.10" {
		t.Fatalf("production proxy hop = %s", clientIP(behindRender))
	}
}

func TestLimiterDropsExpiredBuckets(t *testing.T) {
	limiter := newAttemptLimiter()
	limiter.maxKeys = 1
	limiter.window = time.Minute
	now := time.Now()
	limiter.now = func() time.Time { return now }
	limiter.fail("old")
	now = now.Add(2 * time.Minute)
	limiter.fail("new")
	limiter.mu.Lock()
	defer limiter.mu.Unlock()
	if _, ok := limiter.failures["old"]; ok {
		t.Fatal("expired limiter bucket was kept")
	}
	if _, ok := limiter.failures["new"]; !ok {
		t.Fatal("current limiter bucket was dropped")
	}
}

func TestLimiterEvictsOldestUnlockedKey(t *testing.T) {
	limiter := newAttemptLimiter()
	limiter.maxKeys = 1
	now := time.Now()
	limiter.now = func() time.Time { return now }
	limiter.fail("older")
	now = now.Add(time.Second)
	limiter.fail("newer")
	limiter.mu.Lock()
	defer limiter.mu.Unlock()
	if _, ok := limiter.failures["older"]; ok {
		t.Fatal("older unlocked key was kept")
	}
	if _, ok := limiter.failures["newer"]; !ok {
		t.Fatal("newer key was dropped")
	}
}

func TestLimiterFloodDoesNotEvictActiveLock(t *testing.T) {
	limiter := newAttemptLimiter()
	now := time.Now()
	limiter.now = func() time.Time { return now }
	const victim = "login|account|victim@example.com|/v1/auth/admin-login"
	for i := 0; i < 5; i++ {
		limiter.fail(victim)
	}
	if !limiter.blocked(victim) {
		t.Fatal("account was not locked before the flood")
	}
	for i := 0; i < 4200; i++ {
		limiter.fail("login|account|user-" + strconv.Itoa(i) + "|/v1/auth/admin-login")
	}
	if !limiter.blocked(victim) {
		t.Fatal("flood past the key cap evicted the locked account")
	}
	limiter.mu.Lock()
	defer limiter.mu.Unlock()
	if _, ok := limiter.lockedUntil[victim]; !ok {
		t.Fatal("locked entry was deleted")
	}
	if limiter.occupancy() > limiter.maxKeys {
		t.Fatalf("limiter grew to %d keys", limiter.occupancy())
	}
}

func TestLoginLockoutSurvivesFloodPastTheCap(t *testing.T) {
	srv := New(fakeRepository{}, "memory")
	srv.loginAttempts.maxKeys = 8
	victim := `{"login_id":"victim@example.com","password":"wrong"}`
	for attempt := 1; attempt <= 5; attempt++ {
		req := httptest.NewRequest(http.MethodPost, "/v1/auth/admin-login", strings.NewReader(victim))
		req.RemoteAddr = "203.0.113.8:1000"
		res := httptest.NewRecorder()
		srv.ServeHTTP(res, req)
		if res.Code != http.StatusUnauthorized {
			t.Fatalf("setup attempt %d status %d", attempt, res.Code)
		}
	}
	otherIP := httptest.NewRequest(http.MethodPost, "/v1/auth/admin-login", strings.NewReader(victim))
	otherIP.RemoteAddr = "203.0.113.9:1000"
	otherRes := httptest.NewRecorder()
	srv.ServeHTTP(otherRes, otherIP)
	if otherRes.Code != http.StatusTooManyRequests {
		t.Fatalf("account lock did not follow the username, status %d", otherRes.Code)
	}
	for i := 1; i <= 30; i++ {
		body := fmt.Sprintf(`{"login_id":"flood-%d@example.com","password":"wrong"}`, i)
		req := httptest.NewRequest(http.MethodPost, "/v1/auth/admin-login", strings.NewReader(body))
		req.RemoteAddr = fmt.Sprintf("198.51.100.%d:1000", i)
		res := httptest.NewRecorder()
		srv.ServeHTTP(res, req)
		if res.Code != http.StatusUnauthorized {
			t.Fatalf("flood %d status %d", i, res.Code)
		}
	}
	stillLocked := httptest.NewRequest(http.MethodPost, "/v1/auth/admin-login", strings.NewReader(victim))
	stillLocked.RemoteAddr = "203.0.113.10:1000"
	stillRes := httptest.NewRecorder()
	srv.ServeHTTP(stillRes, stillLocked)
	if stillRes.Code != http.StatusTooManyRequests {
		t.Fatalf("flood evicted the account lockout, status %d", stillRes.Code)
	}
	sameIP := httptest.NewRequest(http.MethodPost, "/v1/auth/admin-login", strings.NewReader(`{"login_id":"someone-else@example.com","password":"wrong"}`))
	sameIP.RemoteAddr = "203.0.113.8:1000"
	sameRes := httptest.NewRecorder()
	srv.ServeHTTP(sameRes, sameIP)
	if sameRes.Code != http.StatusTooManyRequests {
		t.Fatalf("ip lock did not apply to a different username, status %d", sameRes.Code)
	}
}

func TestParentsCannotApproveNarration(t *testing.T) {
	t.Setenv("ALLOW_LEGACY_CREDENTIAL_HEADERS", "false")
	t.Setenv("ACCOUNT_SESSION_SECRET", strings.Repeat("s", 32))
	repo := sessionParentRepo{fakeRepository: fakeRepository{
		verifyParent:   true,
		accountSession: learning.AccountSession{UserID: "parent-1", LoginID: "parent@example.com", Role: "parent"},
	}}
	srv := New(repo, "memory")
	login := httptest.NewRequest(http.MethodPost, "/v1/auth/parent-login", strings.NewReader(`{"login_id":"parent@example.com","password":"secret"}`))
	loginRes := httptest.NewRecorder()
	srv.ServeHTTP(loginRes, login)
	if loginRes.Code != http.StatusOK {
		t.Fatalf("parent login %d %s", loginRes.Code, loginRes.Body.String())
	}
	var session struct {
		Session struct {
			Token string `json:"token"`
		} `json:"session"`
	}
	if err := json.Unmarshal(loginRes.Body.Bytes(), &session); err != nil {
		t.Fatal(err)
	}
	req := httptest.NewRequest(http.MethodPost, "/v1/admin/content/pack-approvals", strings.NewReader(`{"pack_id":"en-y1-listening-comprehension","decision":"approved","notes":"I listened to this pack with the child nearby.","narration_ids":["en-y1-listening-comprehension--vocabulary--listen"]}`))
	req.Header.Set("Authorization", "Bearer "+session.Session.Token)
	res := httptest.NewRecorder()
	srv.ServeHTTP(res, req)
	if res.Code != http.StatusForbidden {
		t.Fatalf("parent approval status %d %s", res.Code, res.Body.String())
	}
}

type sessionParentRepo struct {
	fakeRepository
}

func (s sessionParentRepo) VerifyParentUser(_ context.Context, loginID string, _ string) (learning.ParentAccountConfig, bool, error) {
	if !s.verifyParent {
		return learning.ParentAccountConfig{}, false, nil
	}
	return learning.ParentAccountConfig{ID: "parent-1", Email: loginID, LoginID: loginID, DisplayName: "Parent"}, true, nil
}

func TestFamilyPrivacyUsesSessionsAndRejectsAnotherFamily(t *testing.T) {
	t.Setenv("ALLOW_LEGACY_CREDENTIAL_HEADERS", "false")
	t.Setenv("ACCOUNT_SESSION_SECRET", strings.Repeat("s", 32))
	repo := sessionParentRepo{fakeRepository: fakeRepository{
		verifyParent: true,
		accountSession: learning.AccountSession{
			UserID: "parent-1", LoginID: "parent@example.com", Role: "parent",
		},
		parentPortal: learning.ParentPortalConfig{
			Parent:   learning.ParentAccountConfig{ID: "parent-1", LoginID: "parent@example.com"},
			Children: []learning.ParentChildConfig{{Student: learning.StudentProfileConfig{ExternalRef: "ada-home"}}},
		},
	}}
	srv := New(repo, "memory")
	legacy := httptest.NewRequest(http.MethodGet, "/v1/parent/children/ada-home/export", nil)
	legacy.Header.Set("X-Parent-Login", "parent@example.com")
	legacy.Header.Set("X-Parent-Password", "secret")
	legacyRes := httptest.NewRecorder()
	srv.ServeHTTP(legacyRes, legacy)
	if legacyRes.Code != http.StatusUnauthorized {
		t.Fatalf("legacy privacy header status %d", legacyRes.Code)
	}
	login := httptest.NewRequest(http.MethodPost, "/v1/auth/parent-login", strings.NewReader(`{"login_id":"parent@example.com","password":"secret"}`))
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
	export := httptest.NewRequest(http.MethodGet, "/v1/parent/children/ada-home/export", nil)
	export.Header.Set("Authorization", "Bearer "+session.Session.Token)
	exportRes := httptest.NewRecorder()
	srv.ServeHTTP(exportRes, export)
	if exportRes.Code != http.StatusOK || !strings.Contains(exportRes.Body.String(), `"mastery"`) || !strings.Contains(exportRes.Body.String(), `"secrets_included":false`) {
		t.Fatalf("session export %d %s", exportRes.Code, exportRes.Body.String())
	}
	for _, target := range []struct {
		method string
		path   string
		body   string
	}{
		{http.MethodGet, "/v1/parent/children/other-child/export", ""},
		{http.MethodDelete, "/v1/parent/children/other-child", `{"confirm":"delete"}`},
	} {
		req := httptest.NewRequest(target.method, target.path, strings.NewReader(target.body))
		req.Header.Set("Authorization", "Bearer "+session.Session.Token)
		res := httptest.NewRecorder()
		srv.ServeHTTP(res, req)
		if res.Code != http.StatusForbidden {
			t.Fatalf("%s %s status %d %s", target.method, target.path, res.Code, res.Body.String())
		}
	}
}

func TestBootstrapKeyStopsAfterTheFirstAdministrator(t *testing.T) {
	t.Setenv("ADMIN_API_KEY", "test-admin")
	t.Setenv("ALLOW_LEGACY_CREDENTIAL_HEADERS", "false")
	open := New(fakeRepository{}, "memory")
	req := httptest.NewRequest(http.MethodPut, "/v1/admin/platform-users/first@example.com", strings.NewReader(`{"display_name":"First Admin","password":"a-long-password","roles":["platform_admin"]}`))
	req.Header.Set("X-Admin-Key", "test-admin")
	res := httptest.NewRecorder()
	open.ServeHTTP(res, req)
	if res.Code != http.StatusOK {
		t.Fatalf("first administrator status %d %s", res.Code, res.Body.String())
	}
	closed := New(fakeRepository{platformAdminExists: true}, "memory")
	req = httptest.NewRequest(http.MethodPut, "/v1/admin/platform-users/second@example.com", strings.NewReader(`{"display_name":"Second Admin","password":"a-long-password","roles":["platform_admin"]}`))
	req.Header.Set("X-Admin-Key", "test-admin")
	res = httptest.NewRecorder()
	closed.ServeHTTP(res, req)
	if res.Code != http.StatusForbidden {
		t.Fatalf("later bootstrap status %d %s", res.Code, res.Body.String())
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
