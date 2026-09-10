package server

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"strings"
	"testing"

	"github.com/ArowuTest/nexuslearn/apps/api/internal/learning"
)

var schoolRecordRoutes = []struct {
	path, key string
	cap       int
}{
	{"/v1/school/assignments", "assignments", 500},
	{"/v1/school/evidence", "teacher_evidence", 200},
	{"/v1/school/interventions", "interventions", 500},
	{"/v1/school/intervention-reviews", "intervention_reviews", 500},
}

type schoolRecordReadRepository struct {
	fakeRepository
	allowed                       bool
	authErr, listErr              error
	authReads, listReads          int
	actorID, authURN, role        string
	listKind, listURN, studentRef string
}

func (f *schoolRecordReadRepository) SchoolUserCanRead(_ context.Context, actorID, urn, role string) (bool, error) {
	f.authReads++
	f.actorID, f.authURN, f.role = actorID, urn, role
	return f.allowed, f.authErr
}

func (f *schoolRecordReadRepository) recordRead(kind, urn, ref string) error {
	f.listReads++
	f.listKind, f.listURN, f.studentRef = kind, urn, ref
	return f.listErr
}

func (f *schoolRecordReadRepository) ListAssignments(_ context.Context, urn, ref string) ([]learning.Assignment, error) {
	return []learning.Assignment{{ID: "saved-record"}}, f.recordRead("assignments", urn, ref)
}

func (f *schoolRecordReadRepository) ListTeacherEvidence(_ context.Context, urn, ref string) ([]learning.TeacherEvidenceRecord, error) {
	return []learning.TeacherEvidenceRecord{{ID: "saved-record"}}, f.recordRead("teacher_evidence", urn, ref)
}

func (f *schoolRecordReadRepository) ListInterventions(_ context.Context, urn, ref string) ([]learning.InterventionPlan, error) {
	return []learning.InterventionPlan{{ID: "saved-record"}}, f.recordRead("interventions", urn, ref)
}

func (f *schoolRecordReadRepository) ListInterventionReviews(_ context.Context, urn, ref string) ([]learning.InterventionReview, error) {
	return []learning.InterventionReview{{ID: "saved-record"}}, f.recordRead("intervention_reviews", urn, ref)
}

func TestSchoolRecordReadsUseVerifiedScopeAndKeepSchoolWideReads(t *testing.T) {
	for _, role := range []string{"teacher", "school_admin"} {
		for _, route := range schoolRecordRoutes {
			t.Run(role+route.path, func(t *testing.T) {
				for _, tc := range []struct{ query, ref string }{
					{"", ""},
					{"?school_urn=spoofed-school", ""},
					{"?studentId=child-a&school_urn=spoofed-school", "child-a"},
					{"?studentId=%20child-a%20", "child-a"},
					{"?studentId=child%2Bwith%26symbols", "child+with&symbols"},
				} {
					t.Run(tc.query, func(t *testing.T) {
						repo := &schoolRecordReadRepository{fakeRepository: schoolStudentHandlerFake(role), allowed: true}
						srv, token := schoolStudentHandlerSession(t, repo, role)
						res := schoolAccessRequest(srv, token, route.path+tc.query)
						if res.Code != http.StatusOK || repo.authReads != 1 || repo.actorID != "verified-school-user" || repo.authURN != "verified-school" || repo.role != role {
							t.Errorf("live scope not verified: status=%d authReads=%d actor=%q urn=%q role=%q", res.Code, repo.authReads, repo.actorID, repo.authURN, repo.role)
						}
						if repo.listReads != 1 || repo.listKind != route.key || repo.listURN != "verified-school" || repo.studentRef != tc.ref {
							t.Errorf("wrong record read: calls=%d kind=%q urn=%q ref=%q want=%q", repo.listReads, repo.listKind, repo.listURN, repo.studentRef, tc.ref)
						}
						var body map[string][]struct {
							ID string `json:"id"`
						}
						if err := json.Unmarshal(res.Body.Bytes(), &body); err != nil || len(body) != 1 || len(body[route.key]) != 1 || body[route.key][0].ID != "saved-record" {
							t.Errorf("saved-list response changed: %s err=%v", res.Body.String(), err)
						}
						assertSchoolAccessPrivate(t, res)
					})
				}
			})
		}
	}
}

func TestSchoolRecordReadsRejectAmbiguousOrMalformedPupilScope(t *testing.T) {
	for _, route := range schoolRecordRoutes {
		t.Run(route.path, func(t *testing.T) {
			for _, query := range []string{
				"?studentId", "?studentId=", "?studentId=+", "?studentId=%09%0A", "?studentId=%C2%A0",
				"?studentId=&studentId=child-a", "?studentId=child-a&studentId=",
				"?studentId=child-a&studentId=child-b", "?studentId=child-a&studentId=child-a",
				"?studentId=child-a&student%49d=child-b", "?studentId=%ZZ", "?student%ZZId=child-a",
				"?studentId=child-a;other=value", "?studentId=child-a&bad=%ZZ",
				"?studentId=%ZZ&studentId=child-a",
			} {
				t.Run(query, func(t *testing.T) {
					repo := &schoolRecordReadRepository{fakeRepository: schoolStudentHandlerFake("teacher"), allowed: true}
					srv, token := schoolStudentHandlerSession(t, repo, "teacher")
					res := schoolAccessRequest(srv, token, route.path+query)
					if res.Code != http.StatusBadRequest || repo.listReads != 0 {
						t.Errorf("invalid scope reached records: status=%d calls=%d ref=%q body=%s", res.Code, repo.listReads, repo.studentRef, res.Body.String())
					}
					assertSchoolAccessPrivate(t, res)
				})
			}
		})
	}
}

func TestSchoolRecordReadsFailClosedOnLiveAuthorization(t *testing.T) {
	for _, route := range schoolRecordRoutes {
		for _, tc := range []struct {
			name    string
			allowed bool
			err     error
			status  int
		}{
			{"revoked", false, nil, http.StatusUnauthorized},
			{"lookup failed", true, errors.New("private database failure"), http.StatusInternalServerError},
		} {
			t.Run(route.path+"/"+tc.name, func(t *testing.T) {
				for _, query := range []string{"", "?studentId=child-a", "?studentId="} {
					repo := &schoolRecordReadRepository{fakeRepository: schoolStudentHandlerFake("teacher"), allowed: tc.allowed, authErr: tc.err}
					srv, token := schoolStudentHandlerSession(t, repo, "teacher")
					res := schoolAccessRequest(srv, token, route.path+query)
					if res.Code != tc.status || repo.authReads != 1 || repo.listReads != 0 || strings.Contains(res.Body.String(), "private database failure") {
						t.Errorf("authorization did not fail closed: query=%s status=%d auth=%d lists=%d body=%s", query, res.Code, repo.authReads, repo.listReads, res.Body.String())
					}
					assertSchoolAccessPrivate(t, res)
				}
			})
		}
	}
}

func TestSchoolRecordReadsDenyInvalidSessionsAndNonSchoolRoles(t *testing.T) {
	for _, role := range []string{"parent", "pupil", "platform_admin", "content_editor", "content_reviewer"} {
		for _, route := range schoolRecordRoutes {
			t.Run(role+route.path, func(t *testing.T) {
				repo := &schoolRecordReadRepository{fakeRepository: schoolStudentHandlerFake(role), allowed: true}
				srv, token := schoolStudentHandlerSession(t, repo, role)
				for _, tc := range []struct {
					token  string
					status int
				}{{"", 401}, {"invalid", 401}, {token, 403}} {
					res := schoolAccessRequest(srv, tc.token, route.path+"?studentId=child-a")
					if res.Code != tc.status || repo.authReads+repo.listReads != 0 {
						t.Errorf("unauthorized read: status=%d want=%d auth=%d lists=%d", res.Code, tc.status, repo.authReads, repo.listReads)
					}
					assertSchoolAccessPrivate(t, res)
				}
			})
		}
	}
}

func TestSchoolRecordReadFailuresStayPrivate(t *testing.T) {
	for _, route := range schoolRecordRoutes {
		t.Run(route.path, func(t *testing.T) {
			repo := &schoolRecordReadRepository{fakeRepository: schoolStudentHandlerFake("teacher"), allowed: true, listErr: errors.New("private record query failure")}
			srv, token := schoolStudentHandlerSession(t, repo, "teacher")
			res := schoolAccessRequest(srv, token, route.path+"?studentId=child-a")
			if res.Code != http.StatusInternalServerError || repo.listReads != 1 || strings.Contains(res.Body.String(), "private record query failure") || strings.Contains(res.Body.String(), "saved-record") {
				t.Errorf("read failure exposed records or internals: status=%d body=%s", res.Code, res.Body.String())
			}
			assertSchoolAccessPrivate(t, res)
		})
	}
}
