package server

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/ArowuTest/nexuslearn/apps/api/internal/learning"
)

// Hide the optional atomic capability to test fail-closed behavior.
type parentChildLegacyOnlyRepository struct {
	learning.Repository
	accountSessionRepository
}

type parentChildHandlerRepository struct {
	fakeRepository
	called   int
	parentID string
	student  learning.StudentProfileConfig
	profile  learning.StudentEngagementProfile
}

func (f *parentChildHandlerRepository) UpsertParentChild(_ context.Context, parentID string, student learning.StudentProfileConfig, profile learning.StudentEngagementProfile) (learning.ParentChildConfig, error) {
	f.called++
	f.parentID, f.student, f.profile = parentID, student, profile
	return learning.ParentChildConfig{Student: student, Engagement: profile}, nil
}

func parentChildHandlerSession(t *testing.T, repo learning.Repository, role string) (*Server, string) {
	t.Helper()
	t.Setenv("ACCOUNT_SESSION_SECRET", "parent-child-handler-test-secret")
	t.Setenv("ALLOW_LEGACY_CREDENTIAL_HEADERS", "false")
	srv := New(repo, "postgres")
	session, err := srv.createAccountSession(context.Background(), "verified-parent-id", "verified-login-not-an-email", role, "", time.Hour)
	if err != nil {
		t.Fatal(err)
	}
	return srv, session.Token
}

func TestParentChildHandlerRequiresAtomicCapability(t *testing.T) {
	fake := fakeRepository{accountSession: learning.AccountSession{UserID: "verified-parent-id", Role: "parent"}}
	srv, token := parentChildHandlerSession(t, parentChildLegacyOnlyRepository{Repository: fake, accountSessionRepository: fake}, "parent")
	res := putParentChild(srv, token, "new-child", `{"display_name":"Child","year_group":2}`)
	if res.Code != http.StatusServiceUnavailable {
		t.Fatalf("missing atomic capability must fail closed, got %d: %s", res.Code, res.Body.String())
	}
}

func TestParentChildHandlerUsesVerifiedIdentityAndPath(t *testing.T) {
	repo := &parentChildHandlerRepository{fakeRepository: fakeRepository{accountSession: learning.AccountSession{UserID: "verified-parent-id", Role: "parent"}}}
	srv, token := parentChildHandlerSession(t, repo, "parent")
	req := httptest.NewRequest(http.MethodPut, "/v1/parent/children/path-child", strings.NewReader(`{"display_name":"  Child  ","year_group":2,"parent_user_id":"attacker","parent_email":"spoof@example.test","engagement":{"student_external_ref":"other-child","sensory_load":"low"}}`))
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("X-Parent-Login", "spoof@example.test")
	res := httptest.NewRecorder()
	srv.ServeHTTP(res, req)
	if res.Code != http.StatusOK || repo.called != 1 || repo.parentID != "verified-parent-id" || repo.student.ExternalRef != "path-child" || repo.profile.StudentExternalRef != "path-child" || repo.student.DisplayName != "Child" {
		t.Fatalf("unconstrained atomic request: status=%d parent=%q student=%+v profile=%+v calls=%d", res.Code, repo.parentID, repo.student, repo.profile, repo.called)
	}
}

func TestParentChildHandlerValidatesBeforeRepositoryWrites(t *testing.T) {
	for _, body := range []string{`{`, `{"display_name":" ","year_group":2}`, `{"display_name":"Child","year_group":8}`, `{"display_name":"Child","year_group":2,"engagement":{"sensory_load":"invalid"}}`, `{"display_name":"Child","year_group":2,"engagement":{"declared_support_needs":["invalid"]}}`} {
		t.Run(body, func(t *testing.T) {
			repo := &parentChildHandlerRepository{fakeRepository: fakeRepository{accountSession: learning.AccountSession{UserID: "verified-parent-id", Role: "parent"}}}
			srv, token := parentChildHandlerSession(t, repo, "parent")
			res := putParentChild(srv, token, "invalid-child", body)
			if res.Code != http.StatusBadRequest || repo.called != 0 {
				t.Fatalf("invalid request reached writes: status=%d calls=%d", res.Code, repo.called)
			}
		})
	}
}

func TestParentChildHandlerRequiresParentRole(t *testing.T) {
	for _, role := range []string{"platform_admin", "content_editor", "content_reviewer", "school_admin", "teacher", "pupil"} {
		t.Run(role, func(t *testing.T) {
			repo := &parentChildHandlerRepository{fakeRepository: fakeRepository{accountSession: learning.AccountSession{UserID: "verified-parent-id", Role: role}}}
			srv, token := parentChildHandlerSession(t, repo, role)
			res := putParentChild(srv, token, "forbidden-child", `{"display_name":"Child","year_group":2}`)
			if res.Code != http.StatusForbidden || repo.called != 0 {
				t.Fatalf("non-parent allowed: %d calls=%d", res.Code, repo.called)
			}
		})
	}
}

func TestParentChildHandlerRejectsMissingInvalidAndRevokedSession(t *testing.T) {
	for _, state := range []string{"missing", "invalid", "revoked"} {
		t.Run(state, func(t *testing.T) {
			repo := &parentChildHandlerRepository{}
			srv, token := parentChildHandlerSession(t, repo, "parent")
			if state == "missing" {
				token = ""
			}
			if state == "invalid" {
				token = "invalid-token"
			}
			res := putParentChild(srv, token, "forbidden-child", `{"display_name":"Child","year_group":2}`)
			if res.Code != http.StatusUnauthorized || repo.called != 0 {
				t.Fatalf("invalid session allowed: %d calls=%d", res.Code, repo.called)
			}
		})
	}
}

func TestParentChildHandlerNamedAdminCapabilitiesUnchanged(t *testing.T) {
	for _, role := range []string{"platform_admin", "content_editor", "content_reviewer", "parent"} {
		t.Run(role, func(t *testing.T) {
			repo := fakeRepository{accountSession: learning.AccountSession{UserID: "verified-parent-id", Role: role}}
			srv, token := parentChildHandlerSession(t, repo, role)
			req := httptest.NewRequest(http.MethodPut, "/v1/admin/students/admin-managed-child", strings.NewReader(`{"display_name":"Admin managed","year_group":3}`))
			req.Header.Set("Authorization", "Bearer "+token)
			res := httptest.NewRecorder()
			srv.ServeHTTP(res, req)
			want := http.StatusForbidden
			if role == "platform_admin" {
				want = http.StatusOK
			}
			if res.Code != want {
				t.Fatalf("admin capability changed: role=%s status=%d want=%d", role, res.Code, want)
			}
		})
	}
}

// Extend the existing fixture in a new file without changing server_test.go.
// Its legacy verifier represents authenticated parents without synthetic IDs;
// real database tests above exercise immutable IDs, transactions and replays.
func (f fakeRepository) UpsertParentChild(_ context.Context, parentID string, student learning.StudentProfileConfig, profile learning.StudentEngagementProfile) (learning.ParentChildConfig, error) {
	if parentID != f.accountSession.UserID || (parentID == "" && !f.verifyParent) {
		return learning.ParentChildConfig{}, learning.ErrParentChildForbidden
	}
	student, profile, err := learning.PrepareParentChild(student, profile)
	if err != nil {
		return learning.ParentChildConfig{}, err
	}
	exists := false
	for _, item := range f.students {
		if item.ExternalRef == student.ExternalRef {
			exists = true
			student.ID = item.ID
		}
	}
	for _, item := range f.parentPortal.Children {
		if item.Student.ExternalRef == student.ExternalRef {
			exists = true
			student.ID = item.Student.ID
		}
	}
	if exists {
		linked := false
		for _, link := range f.parentLinks {
			if link.StudentExternalRef == student.ExternalRef && link.ParentEmail == f.parentPortal.Parent.Email && link.Status == "active" {
				linked = true
			}
		}
		if !linked {
			return learning.ParentChildConfig{}, learning.ErrParentChildForbidden
		}
	}
	credential := learning.StudentCredentialConfig{StudentExternalRef: student.ExternalRef, LoginCode: "FAKE-HOME-CREDENTIAL", PicturePassword: []string{"key", "moon", "tree", "book", "shell", "rocket"}}
	for _, item := range f.credentials {
		if item.StudentExternalRef == student.ExternalRef {
			credential = item
		}
	}
	for _, item := range f.parentPortal.Children {
		if item.Student.ExternalRef == student.ExternalRef && item.Credential.StudentExternalRef != "" {
			credential = item.Credential
		}
	}
	return learning.ParentChildConfig{Student: student, Credential: credential, Engagement: profile}, nil
}
