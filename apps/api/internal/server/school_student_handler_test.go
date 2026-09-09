package server

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/ArowuTest/nexuslearn/apps/api/internal/learning"
)

const schoolHandlerClassID = "00000000-0000-0000-0000-000000000001"

type schoolStudentHandlerRepository struct {
	fakeRepository
	upserts, assignments             int
	actorID, schoolURN, classID, ref string
	student                          learning.StudentProfileConfig
}

func (f *schoolStudentHandlerRepository) UpsertSchoolStudent(_ context.Context, actorID, schoolURN, classID string, student learning.StudentProfileConfig) (learning.StudentProfileConfig, error) {
	f.upserts++
	f.actorID, f.schoolURN, f.classID, f.student = actorID, schoolURN, classID, student
	return student, nil
}

func (f *schoolStudentHandlerRepository) AssignSchoolStudentToClass(_ context.Context, actorID, schoolURN, classID, ref string) (learning.ClassConfig, error) {
	f.assignments++
	f.actorID, f.schoolURN, f.classID, f.ref = actorID, schoolURN, classID, ref
	return learning.ClassConfig{ID: classID, SchoolURN: schoolURN, Students: []learning.StudentProfileConfig{{ExternalRef: ref}}}, nil
}

func schoolStudentHandlerSession(t *testing.T, repo learning.Repository, role string) (*Server, string) {
	t.Helper()
	t.Setenv("ACCOUNT_SESSION_SECRET", "school-student-handler-test-secret")
	t.Setenv("ALLOW_LEGACY_CREDENTIAL_HEADERS", "false")
	srv := New(repo, "postgres")
	session, err := srv.createAccountSession(context.Background(), "verified-school-user", "school-login", role, "verified-school", time.Hour)
	if err != nil {
		t.Fatal(err)
	}
	return srv, session.Token
}

func schoolStudentHandlerFake(role string) fakeRepository {
	return fakeRepository{accountSession: learning.AccountSession{UserID: "verified-school-user", Role: role, SchoolURN: "verified-school"}, classes: []learning.ClassConfig{{ID: schoolHandlerClassID, SchoolURN: "verified-school"}}}
}

func schoolStudentRequest(srv *Server, token, path, body string) *httptest.ResponseRecorder {
	req := httptest.NewRequest(http.MethodPut, path, strings.NewReader(body))
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("X-School-URN", "spoofed-school")
	res := httptest.NewRecorder()
	srv.ServeHTTP(res, req)
	return res
}

func TestSchoolStudentHandlerRequiresAtomicCapability(t *testing.T) {
	fake := schoolStudentHandlerFake("school_admin")
	srv, token := schoolStudentHandlerSession(t, parentChildLegacyOnlyRepository{Repository: fake, accountSessionRepository: fake}, "school_admin")
	for _, path := range []string{"/v1/school/students/new-child", "/v1/school/classes/" + schoolHandlerClassID + "/students/existing-child"} {
		res := schoolStudentRequest(srv, token, path, `{"display_name":"Child","year_group":2,"class_id":"`+schoolHandlerClassID+`"}`)
		if res.Code != http.StatusServiceUnavailable {
			t.Errorf("missing atomic capability must fail closed: %s status=%d", path, res.Code)
		}
	}
}

func TestSchoolStudentHandlerUsesVerifiedActorScopeAndRoute(t *testing.T) {
	repo := &schoolStudentHandlerRepository{fakeRepository: schoolStudentHandlerFake("school_admin")}
	srv, token := schoolStudentHandlerSession(t, repo, "school_admin")
	res := schoolStudentRequest(srv, token, "/v1/school/students/route-child", `{"display_name":" Child ","year_group":2,"class_id":"`+schoolHandlerClassID+`","external_ref":"spoof-child","school_urn":"spoof-school","user_id":"spoof-user"}`)
	if res.Code != http.StatusOK || repo.upserts != 1 || repo.actorID != "verified-school-user" || repo.schoolURN != "verified-school" || repo.classID != schoolHandlerClassID || repo.student.ExternalRef != "route-child" || repo.student.DisplayName != "Child" {
		t.Fatalf("wrong atomic request: status=%d repo=%+v", res.Code, repo)
	}
	var saved learning.StudentProfileConfig
	if err := json.Unmarshal(res.Body.Bytes(), &saved); err != nil || saved.ExternalRef != "route-child" {
		t.Fatalf("student response contract changed: %+v %v", saved, err)
	}
	res = schoolStudentRequest(srv, token, "/v1/school/classes/"+schoolHandlerClassID+"/students/route-child", "")
	if res.Code != http.StatusOK || repo.assignments != 1 || repo.actorID != "verified-school-user" || repo.schoolURN != "verified-school" || repo.classID != schoolHandlerClassID || repo.ref != "route-child" {
		t.Fatalf("wrong assignment request: status=%d repo=%+v", res.Code, repo)
	}
}

func TestSchoolStudentHandlerValidatesBeforeWrites(t *testing.T) {
	for _, body := range []string{`{`, `{"display_name":"Child","year_group":2}`, `{"display_name":"Child","year_group":2,"class_id":" "}`, `{"display_name":"Child","year_group":2,"class_id":"typed-class-name"}`, `{"display_name":" ","year_group":2,"class_id":"` + schoolHandlerClassID + `"}`, `{"display_name":"Child","year_group":8,"class_id":"` + schoolHandlerClassID + `"}`} {
		t.Run(body, func(t *testing.T) {
			repo := &schoolStudentHandlerRepository{fakeRepository: schoolStudentHandlerFake("school_admin")}
			srv, token := schoolStudentHandlerSession(t, repo, "school_admin")
			res := schoolStudentRequest(srv, token, "/v1/school/students/invalid-child", body)
			if res.Code != http.StatusBadRequest || repo.upserts != 0 {
				t.Fatalf("invalid request reached writes: status=%d calls=%d", res.Code, repo.upserts)
			}
		})
	}
}

func TestSchoolStudentHandlerRequiresSchoolAdmin(t *testing.T) {
	for _, role := range []string{"teacher", "parent", "pupil", "platform_admin", "content_editor", "content_reviewer"} {
		t.Run(role, func(t *testing.T) {
			repo := &schoolStudentHandlerRepository{fakeRepository: schoolStudentHandlerFake(role)}
			srv, token := schoolStudentHandlerSession(t, repo, role)
			for _, path := range []string{"/v1/school/students/new-child", "/v1/school/classes/" + schoolHandlerClassID + "/students/existing-child"} {
				res := schoolStudentRequest(srv, token, path, `{"display_name":"Child","year_group":2,"class_id":"`+schoolHandlerClassID+`"}`)
				if res.Code != http.StatusForbidden || repo.upserts+repo.assignments != 0 {
					t.Fatalf("non-admin reached school writes: status=%d", res.Code)
				}
			}
		})
	}
}

func TestSchoolStudentHandlerRejectsInvalidOrRevokedSession(t *testing.T) {
	repo := &schoolStudentHandlerRepository{}
	srv, revoked := schoolStudentHandlerSession(t, repo, "school_admin")
	for _, token := range []string{"", "invalid", revoked} {
		for _, path := range []string{"/v1/school/students/new-child", "/v1/school/classes/" + schoolHandlerClassID + "/students/existing-child"} {
			res := schoolStudentRequest(srv, token, path, `{"display_name":"Child","year_group":2,"class_id":"`+schoolHandlerClassID+`"}`)
			if res.Code != http.StatusUnauthorized || repo.upserts+repo.assignments != 0 {
				t.Fatalf("invalid session accepted: status=%d", res.Code)
			}
		}
	}
}
