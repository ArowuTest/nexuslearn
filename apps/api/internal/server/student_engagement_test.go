package server

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/ArowuTest/nexuslearn/apps/api/internal/learning"
)

func TestSchoolSupportUnversionedSaveFailsClosed(t *testing.T) {
	repo := fakeRepository{verifySchool: true, schoolPortal: learning.SchoolPortalConfig{School: learning.SchoolConfig{URN: "support-school"}, Classes: []learning.ClassConfig{{Students: []learning.StudentProfileConfig{{ExternalRef: "support-child"}}}}}}
	srv := New(repo, "postgres")
	req := httptest.NewRequest(http.MethodPut, "/v1/school/students/support-child/engagement", strings.NewReader(`{"notes":"unversioned overwrite"}`))
	req.Header.Set("X-School-URN", "support-school")
	req.Header.Set("X-School-Login", "teacher")
	req.Header.Set("X-School-Password", "fixture")
	res := httptest.NewRecorder()
	srv.ServeHTTP(res, req)
	if res.Code != http.StatusPreconditionRequired {
		t.Fatalf("unversioned save status=%d", res.Code)
	}
	if res.Header().Get("Cache-Control") != "private, no-store" {
		t.Fatal("support response can be cached")
	}
}

func supportJSON(t *testing.T) map[string]any {
	t.Helper()
	return map[string]any{"student_external_ref": "untrusted-body-child", "version": int64(10), "declared_support_needs": []string{}, "learning_approaches": []string{}, "celebration_intensity": "quiet", "audio_support": false, "reading_support": false, "session_length": "short", "sensory_load": "low", "attention_support": "chunked", "communication_support": "visual", "processing_support": "extra_time", "confidence_support": "gentle", "companion_style": "calm", "reward_style": "story", "interests": []string{}, "notes": "Keep this support"}
}

func supportBody(t *testing.T, value any) string {
	t.Helper()
	raw, err := json.Marshal(value)
	if err != nil {
		t.Fatal(err)
	}
	return string(raw)
}

func TestSupportPayloadRejectsMissingAndAmbiguousFields(t *testing.T) {
	repo := fakeRepository{verifySchool: true, schoolPortal: learning.SchoolPortalConfig{School: learning.SchoolConfig{URN: "support-school"}, Classes: []learning.ClassConfig{{Students: []learning.StudentProfileConfig{{ExternalRef: "support-child"}}}}}}
	srv := New(repo, "postgres")
	check := func(t *testing.T, body, key string, status int) {
		t.Helper()
		req := httptest.NewRequest(http.MethodPut, "/v1/school/students/support-child/engagement", strings.NewReader(body))
		req.Header.Set("X-School-URN", "support-school")
		req.Header.Set("X-School-Login", "teacher")
		req.Header.Set("X-School-Password", "fixture")
		if key != "" {
			req.Header.Set("Idempotency-Key", key)
		}
		res := httptest.NewRecorder()
		srv.ServeHTTP(res, req)
		if res.Code != status {
			t.Fatalf("wanted %d, got %d", status, res.Code)
		}
	}
	for field := range supportJSON(t) {
		if field == "student_external_ref" {
			continue
		}
		t.Run("missing "+field, func(t *testing.T) {
			body := supportJSON(t)
			delete(body, field)
			status := 400
			if field == "version" {
				status = 428
			}
			check(t, supportBody(t, body), "key", status)
		})
	}
	for _, field := range []string{"version", "audio_support", "reading_support", "interests", "notes"} {
		t.Run("null "+field, func(t *testing.T) {
			body := supportJSON(t)
			body[field] = nil
			check(t, supportBody(t, body), "key", 400)
		})
	}
	for _, version := range []any{-1, 1.5, 9007199254740992, "10"} {
		body := supportJSON(t)
		body["version"] = version
		check(t, supportBody(t, body), "key", 400)
	}
	raw := supportBody(t, supportJSON(t))
	check(t, strings.Replace(raw, `"version":10`, `"version":10,"version":11`, 1), "key", 400)
	check(t, raw+` {"version":10}`, "key", 400)
	check(t, `null`, "key", 400)
	check(t, raw, "", 400)
	check(t, raw, strings.Repeat("k", 129), 400)
	body := supportJSON(t)
	body["notes"] = strings.Repeat("x", 66000)
	check(t, supportBody(t, body), "key", 400)
}

type engagementHandlerRepository struct {
	fakeRepository
	actor      learning.EngagementActor
	input      learning.EngagementSave
	calls      int
	saveErr    error
	allowedRef string
}

func (f *engagementHandlerRepository) ReadStudentEngagement(_ context.Context, actor learning.EngagementActor, ref string) (learning.StudentEngagementProfile, error) {
	f.actor = actor
	f.calls++
	if f.allowedRef != "" && f.allowedRef != ref {
		return learning.StudentEngagementProfile{}, learning.ErrEngagementForbidden
	}
	p := f.engagement
	p.StudentExternalRef = ref
	p.Version = 10
	return p, f.saveErr
}
func (f *engagementHandlerRepository) SaveStudentEngagement(_ context.Context, actor learning.EngagementActor, in learning.EngagementSave) (learning.SavedStudentEngagement, error) {
	f.actor = actor
	f.input = in
	f.calls++
	p := in.Profile
	p.Version = 20
	return learning.SavedStudentEngagement{StudentEngagementProfile: p, SaveResult: learning.EngagementSaveReceipt{AppliedVersion: 20, Changed: true}}, f.saveErr
}
func supportHandler(t *testing.T, repo learning.Repository, role string) (*Server, string) {
	t.Helper()
	t.Setenv("ACCOUNT_SESSION_SECRET", "support-handler-fixture-secret")
	t.Setenv("ALLOW_LEGACY_CREDENTIAL_HEADERS", "false")
	srv := New(repo, "postgres")
	school := ""
	if role == "teacher" || role == "school_admin" {
		school = "support-school"
	}
	session, err := srv.createAccountSession(context.Background(), "verified-support-adult", "support-login", role, school, time.Hour)
	if err != nil {
		t.Fatal(err)
	}
	return srv, session.Token
}
func TestSupportHandlersUseVerifiedActorAndRoute(t *testing.T) {
	for _, role := range []string{"parent", "teacher", "school_admin"} {
		t.Run(role, func(t *testing.T) {
			repo := &engagementHandlerRepository{fakeRepository: fakeRepository{accountSession: learning.AccountSession{UserID: "verified-support-adult", Role: role}}}
			if role != "parent" {
				repo.accountSession.SchoolURN = "support-school"
			}
			srv, token := supportHandler(t, repo, role)
			path := "/v1/school/students/route-child/engagement"
			kind := "school"
			if role == "parent" {
				path = "/v1/parent/children/route-child/engagement"
				kind = "parent"
			}
			req := httptest.NewRequest(http.MethodPut, path, strings.NewReader(supportBody(t, supportJSON(t))))
			req.Header.Set("Authorization", "Bearer "+token)
			req.Header.Set("Idempotency-Key", "logical-save")
			res := httptest.NewRecorder()
			srv.ServeHTTP(res, req)
			if res.Code != 200 || repo.calls != 1 || repo.actor.ID != "verified-support-adult" || repo.actor.Kind != kind || repo.input.Profile.StudentExternalRef != "route-child" || repo.input.ExpectedVersion != 10 || repo.input.IdempotencyKey != "logical-save" {
				t.Fatalf("unscoped save status=%d calls=%d actor=%+v", res.Code, repo.calls, repo.actor)
			}
			var got learning.SavedStudentEngagement
			if err := json.Unmarshal(res.Body.Bytes(), &got); err != nil {
				t.Fatal(err)
			}
			if got.Version != 20 || got.SaveResult.AppliedVersion != 20 || !got.SaveResult.Changed {
				t.Fatal("server omitted save receipt")
			}
			if res.Header().Get("Cache-Control") != "private, no-store" {
				t.Fatal("private profile response cacheable")
			}
		})
	}
}
func TestSupportHandlerErrorContracts(t *testing.T) {
	for _, tc := range []struct {
		name   string
		err    error
		status int
		code   string
	}{
		{"conflict", &learning.EngagementConflict{CurrentProfile: learning.StudentEngagementProfile{StudentExternalRef: "route-child", Version: 30}, PreviouslySaved: true}, 409, "support_profile_conflict"},
		{"key", learning.ErrIdempotencyConflict, 409, "idempotency_key_conflict"},
		{"scope", learning.ErrEngagementForbidden, 403, "support_forbidden"},
		{"storage", errors.New("database failure with sensitive detail"), 500, "support_unavailable"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			repo := &engagementHandlerRepository{fakeRepository: fakeRepository{accountSession: learning.AccountSession{UserID: "verified-support-adult", Role: "parent"}}, saveErr: tc.err}
			srv, token := supportHandler(t, repo, "parent")
			req := httptest.NewRequest(http.MethodPut, "/v1/parent/children/route-child/engagement", strings.NewReader(supportBody(t, supportJSON(t))))
			req.Header.Set("Authorization", "Bearer "+token)
			req.Header.Set("Idempotency-Key", "key")
			res := httptest.NewRecorder()
			srv.ServeHTTP(res, req)
			var body map[string]any
			if err := json.Unmarshal(res.Body.Bytes(), &body); err != nil {
				t.Fatal(err)
			}
			if res.Code != tc.status || body["code"] != tc.code {
				t.Fatalf("error contract=%d %+v", res.Code, body)
			}
			if tc.name == "conflict" {
				if body["previously_saved"] != true || body["current_profile"].(map[string]any)["version"] != float64(30) {
					t.Fatal("conflict not actionable")
				}
			} else if body["current_profile"] != nil || strings.Contains(res.Body.String(), "sensitive") {
				t.Fatal("error leaked profile/storage detail")
			}
		})
	}
}
func TestSupportHandlersFailWithoutAtomicCapability(t *testing.T) {
	fake := fakeRepository{accountSession: learning.AccountSession{UserID: "verified-support-adult", Role: "parent"}}
	srv, token := supportHandler(t, parentChildLegacyOnlyRepository{Repository: fake, accountSessionRepository: fake}, "parent")
	req := httptest.NewRequest(http.MethodPut, "/v1/parent/children/route-child/engagement", strings.NewReader(supportBody(t, supportJSON(t))))
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Idempotency-Key", "key")
	res := httptest.NewRecorder()
	srv.ServeHTTP(res, req)
	if res.Code != 503 {
		t.Fatalf("missing capability status=%d", res.Code)
	}
}
