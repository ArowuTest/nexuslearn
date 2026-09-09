package server

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/ArowuTest/nexuslearn/apps/api/internal/learning"
)

type schoolAccessLegacyRepository struct {
	fakeRepository
	portalReads, credentialReads, generations int
}

func (f *schoolAccessLegacyRepository) SchoolPortal(ctx context.Context, urn string) (learning.SchoolPortalConfig, error) {
	f.portalReads++
	return f.fakeRepository.SchoolPortal(ctx, urn)
}

func (f *schoolAccessLegacyRepository) ListStudentCredentials(context.Context) ([]learning.StudentCredentialConfig, error) {
	f.credentialReads++
	return nil, errors.New("global credentials must not be read")
}

func (f *schoolAccessLegacyRepository) ListStudentCredentialsForSchool(context.Context, string) ([]learning.StudentCredentialConfig, error) {
	f.credentialReads++
	return nil, errors.New("whole-school credentials must not be read")
}

func (f *schoolAccessLegacyRepository) GenerateClassCredentials(context.Context, string, bool, []string) (learning.ClassCredentialBatch, error) {
	f.generations++
	return learning.ClassCredentialBatch{}, nil
}

type schoolAccessReadRepository struct {
	schoolAccessLegacyRepository
	overviewReads, pageReads, scopeReads int
	urn, classID, cursor                 string
	limit                                int
	readErr                              error
}

func (f *schoolAccessReadRepository) SchoolOverview(_ context.Context, urn string) (learning.SchoolPortalConfig, error) {
	f.overviewReads++
	f.urn = urn
	return learning.SchoolPortalConfig{School: learning.SchoolConfig{URN: urn}}, f.readErr
}

func (f *schoolAccessReadRepository) ListClassStudentCredentialPage(_ context.Context, urn, classID string, limit int, cursor string) (learning.StudentCredentialPage, error) {
	f.pageReads++
	f.urn, f.classID, f.limit, f.cursor = urn, classID, limit, cursor
	return learning.StudentCredentialPage{StudentCredentials: []learning.StudentCredentialConfig{}}, f.readErr
}

func (f *schoolAccessReadRepository) ClassBelongsToSchool(_ context.Context, urn, id string) (bool, error) {
	f.scopeReads++
	return urn == "verified-school" && id == schoolHandlerClassID, f.readErr
}

func (f *schoolAccessReadRepository) GroupBelongsToSchool(_ context.Context, urn, id string) (bool, error) {
	f.scopeReads++
	return urn == "verified-school" && id == "owned-group", f.readErr
}

func (f *schoolAccessReadRepository) StudentBelongsToSchool(_ context.Context, urn, ref string) (bool, error) {
	f.scopeReads++
	return urn == "verified-school" && ref == "owned-child", f.readErr
}

func schoolAccessRequest(srv *Server, token, path string) *httptest.ResponseRecorder {
	req := httptest.NewRequest(http.MethodGet, path, nil)
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	req.Header.Set("X-School-URN", "spoofed-school")
	res := httptest.NewRecorder()
	srv.ServeHTTP(res, req)
	return res
}

func assertSchoolAccessPrivate(t *testing.T, res *httptest.ResponseRecorder) {
	t.Helper()
	cache := res.Header().Get("Cache-Control")
	if !strings.Contains(cache, "private") || !strings.Contains(cache, "no-store") {
		t.Fatalf("private school response is cacheable: %q", cache)
	}
}

func TestSchoolAccessOverviewUsesOptionalReadAndPreservesLegacy(t *testing.T) {
	base := schoolStudentHandlerFake("teacher")
	base.credentials = []learning.StudentCredentialConfig{{StudentExternalRef: "legacy-child", LoginCode: "LEGACY"}}
	repo := &schoolAccessReadRepository{schoolAccessLegacyRepository: schoolAccessLegacyRepository{fakeRepository: base}}
	srv, token := schoolStudentHandlerSession(t, repo, "teacher")
	res := schoolAccessRequest(srv, token, "/v1/school/config?include_credentials=false&school_urn=spoofed-school")
	if res.Code != http.StatusOK || repo.overviewReads != 1 || repo.portalReads != 0 || repo.credentialReads != 0 || repo.urn != "verified-school" {
		t.Fatalf("overview did not use authenticated lightweight read: status=%d overview=%d portal=%d credentials=%d urn=%q", res.Code, repo.overviewReads, repo.portalReads, repo.credentialReads, repo.urn)
	}
	assertSchoolAccessPrivate(t, res)
	var body map[string]json.RawMessage
	if err := json.Unmarshal(res.Body.Bytes(), &body); err != nil {
		t.Fatal(err)
	}
	if string(body["student_credentials"]) != "[]" {
		t.Fatalf("overview credentials must be an empty array: %s", res.Body.String())
	}
	for _, query := range []string{"", "?include_credentials=true"} {
		res = schoolAccessRequest(srv, token, "/v1/school/config"+query)
		if res.Code != http.StatusOK || !strings.Contains(res.Body.String(), `"login_code":"LEGACY"`) {
			t.Fatalf("legacy config changed: %d %s", res.Code, res.Body.String())
		}
		assertSchoolAccessPrivate(t, res)
	}
	if repo.portalReads != 2 || repo.overviewReads != 1 {
		t.Fatalf("incorrect rollout routing: portal=%d overview=%d", repo.portalReads, repo.overviewReads)
	}
}

func TestSchoolAccessMalformedOverviewQueryNeverLoadsCredentials(t *testing.T) {
	for _, query := range []string{"?include_credentials=%ZZ", "?include_credentials=false&bad=%ZZ", "?include_credentials=false;other=true", "?include_credentials=false&include_credentials=true", "?include_credentials=", "?include_credentials=0"} {
		repo := &schoolAccessReadRepository{schoolAccessLegacyRepository: schoolAccessLegacyRepository{fakeRepository: schoolStudentHandlerFake("teacher")}}
		srv, token := schoolStudentHandlerSession(t, repo, "teacher")
		res := schoolAccessRequest(srv, token, "/v1/school/config"+query)
		if res.Code != http.StatusBadRequest || repo.portalReads+repo.overviewReads+repo.credentialReads != 0 {
			t.Errorf("malformed overview query reached private reads: %q status=%d portal=%d overview=%d", query, res.Code, repo.portalReads, repo.overviewReads)
		}
		assertSchoolAccessPrivate(t, res)
	}
}

func TestSchoolAccessMissingCapabilitiesFailClosed(t *testing.T) {
	repo := &schoolAccessLegacyRepository{fakeRepository: schoolStudentHandlerFake("teacher")}
	srv, token := schoolStudentHandlerSession(t, repo, "teacher")
	for _, path := range []string{"/v1/school/config?include_credentials=false", "/v1/school/classes/" + schoolHandlerClassID + "/credentials"} {
		res := schoolAccessRequest(srv, token, path)
		if res.Code != http.StatusServiceUnavailable || repo.portalReads+repo.credentialReads+repo.generations != 0 {
			t.Errorf("missing capability fell back to eager reads: %s status=%d reads=%d", path, res.Code, repo.portalReads+repo.credentialReads)
		}
		assertSchoolAccessPrivate(t, res)
	}
}

func TestSchoolAccessCredentialHandlerLimitsAndReadOnlyRoles(t *testing.T) {
	for _, role := range []string{"school_admin", "teacher"} {
		t.Run(role, func(t *testing.T) {
			repo := &schoolAccessReadRepository{schoolAccessLegacyRepository: schoolAccessLegacyRepository{fakeRepository: schoolStudentHandlerFake(role)}}
			srv, token := schoolStudentHandlerSession(t, repo, role)
			path := "/v1/school/classes/" + schoolHandlerClassID + "/credentials"
			for _, tc := range []struct {
				query string
				limit int
			}{{"", 12}, {"?limit=1", 1}, {"?limit=50&school_urn=foreign-school", 50}} {
				res := schoolAccessRequest(srv, token, path+tc.query)
				if res.Code != http.StatusOK || repo.limit != tc.limit || repo.urn != "verified-school" || repo.classID != schoolHandlerClassID {
					t.Fatalf("wrong bounded request: status=%d limit=%d urn=%q class=%q", res.Code, repo.limit, repo.urn, repo.classID)
				}
				var body struct {
					ClassID     string                             `json:"class_id"`
					Credentials []learning.StudentCredentialConfig `json:"student_credentials"`
					Limit       int                                `json:"limit"`
					HasMore     bool                               `json:"has_more"`
					NextCursor  *string                            `json:"next_cursor"`
				}
				if err := json.Unmarshal(res.Body.Bytes(), &body); err != nil || body.ClassID != schoolHandlerClassID || body.Limit != tc.limit || body.Credentials == nil || len(body.Credentials) != 0 || body.HasMore || body.NextCursor == nil || *body.NextCursor != "" {
					t.Fatalf("empty page contract: %s err=%v", res.Body.String(), err)
				}
				assertSchoolAccessPrivate(t, res)
			}
			calls := repo.pageReads
			for _, query := range []string{"?limit=0", "?limit=-1", "?limit=51", "?limit=bad", "?limit=1.5", "?limit=", "?limit=99999999999999999999999", "?limit=2&limit=3", "?cursor=a&cursor=b", "?limit=%ZZ", "?cursor=%ZZ", "?cursor=bad;cursor=other"} {
				res := schoolAccessRequest(srv, token, path+query)
				if res.Code != http.StatusBadRequest || repo.pageReads != calls {
					t.Errorf("invalid query reached repository: %s status=%d", query, res.Code)
				}
				assertSchoolAccessPrivate(t, res)
			}
			if role == "teacher" {
				res := schoolStudentRequest(srv, token, path, `{}`)
				if res.Code != http.StatusForbidden {
					t.Fatalf("teacher generated credentials: status=%d", res.Code)
				}
			}
			if repo.portalReads+repo.credentialReads+repo.generations != 0 {
				t.Fatal("credential GET or teacher PUT reached legacy reads/generation")
			}
		})
	}
}

func TestSchoolAccessRejectsAnonymousAndNonSchoolRoles(t *testing.T) {
	paths := []string{"/v1/school/config?include_credentials=false", "/v1/school/classes/" + schoolHandlerClassID + "/credentials"}
	for _, role := range []string{"parent", "pupil", "platform_admin", "content_editor", "content_reviewer"} {
		t.Run(role, func(t *testing.T) {
			repo := &schoolAccessReadRepository{schoolAccessLegacyRepository: schoolAccessLegacyRepository{fakeRepository: schoolStudentHandlerFake(role)}}
			srv, token := schoolStudentHandlerSession(t, repo, role)
			for _, path := range paths {
				for _, tc := range []struct {
					token  string
					status int
				}{{"", 401}, {"bogus", 401}, {token, 403}} {
					res := schoolAccessRequest(srv, tc.token, path)
					if res.Code != tc.status || repo.pageReads+repo.overviewReads+repo.portalReads != 0 {
						t.Errorf("unauthorized school read: %s role=%s status=%d want=%d", path, role, res.Code, tc.status)
					}
					assertSchoolAccessPrivate(t, res)
				}
			}
		})
	}
}

func TestSchoolAccessScopeChecksUseBoundedCapabilityAndFailClosed(t *testing.T) {
	repo := &schoolAccessReadRepository{schoolAccessLegacyRepository: schoolAccessLegacyRepository{fakeRepository: schoolStudentHandlerFake("teacher")}}
	srv := New(repo, "postgres")
	ctx := context.Background()
	for _, tc := range []struct {
		name, id string
		check    func(context.Context, string, string) bool
	}{
		{"class", schoolHandlerClassID, srv.classBelongsToSchool}, {"group", "owned-group", srv.groupBelongsToSchool}, {"student", "owned-child", srv.studentBelongsToSchool},
	} {
		t.Run(tc.name, func(t *testing.T) {
			if !tc.check(ctx, "verified-school", tc.id) || tc.check(ctx, "foreign-school", tc.id) || tc.check(ctx, "verified-school", "missing") {
				t.Fatal("bounded membership check returned the wrong scope")
			}
			repo.readErr = errors.New("scope database unavailable")
			if tc.check(ctx, "verified-school", tc.id) {
				t.Fatal("scope error granted access")
			}
			repo.readErr = nil
		})
	}
	if repo.scopeReads != 12 || repo.portalReads+repo.credentialReads != 0 {
		t.Fatalf("scope assembled portal/credentials: direct=%d portal=%d credentials=%d", repo.scopeReads, repo.portalReads, repo.credentialReads)
	}
}
