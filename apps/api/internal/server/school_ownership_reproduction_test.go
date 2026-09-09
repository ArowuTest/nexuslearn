package server

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/ArowuTest/nexuslearn/apps/api/internal/learning"
)

// Before the school fix, both family and foreign-school upserts returned 200
// and overwrote the learner. Both assignments returned 200, attached the foreign
// learner and exposed their credentials through school/config. This regression
// now runs whenever TEST_DATABASE_URL is supplied, using a disposable schema.
func TestSchoolOwnershipReproductionPostgres(t *testing.T) {
	srv, repo, pool := parentChildSecurityServer(t)
	ctx := context.Background()
	parent, _ := parentChildSecuritySession(t, srv, repo, "school-repro-parent")
	for _, urn := range []string{"repro-school-a", "repro-school-b"} {
		if _, err := repo.UpsertSchool(ctx, learning.SchoolConfig{URN: urn, Name: urn, Status: "active"}); err != nil {
			t.Fatal(err)
		}
	}
	classA, err := repo.UpsertClass(ctx, learning.ClassConfig{SchoolURN: "repro-school-a", Name: "Class A", YearGroup: 2})
	if err != nil {
		t.Fatal(err)
	}
	classB, err := repo.UpsertClass(ctx, learning.ClassConfig{SchoolURN: "repro-school-b", Name: "Class B", YearGroup: 2})
	if err != nil {
		t.Fatal(err)
	}
	admin, err := repo.UpsertSchoolUser(ctx, learning.SchoolUserConfig{SchoolURN: "repro-school-a", Email: "school-repro-admin@example.test", LoginID: "school-repro-admin", DisplayName: "School A administrator", Role: "school_admin", Status: "active", TemporaryPassword: "test-only-password"})
	if err != nil {
		t.Fatal(err)
	}
	session, err := srv.createAccountSession(ctx, admin.ID, admin.LoginID, "school_admin", admin.SchoolURN, time.Hour)
	if err != nil {
		t.Fatal(err)
	}
	request := func(method, path, body string) *httptest.ResponseRecorder {
		req := httptest.NewRequest(method, path, strings.NewReader(body))
		req.Header.Set("Authorization", "Bearer "+session.Token)
		res := httptest.NewRecorder()
		srv.ServeHTTP(res, req)
		return res
	}
	for _, owner := range []string{"family", "other-school", "unassigned"} {
		for _, operation := range []string{"upsert", "assign"} {
			t.Run(owner+"-"+operation, func(t *testing.T) {
				ref := "school-repro-" + owner + "-" + operation
				student, err := repo.UpsertStudent(ctx, learning.StudentProfileConfig{ExternalRef: ref, DisplayName: "Protected learner", YearGroup: 2})
				if err != nil {
					t.Fatal(err)
				}
				if _, err := repo.UpsertStudentCredential(ctx, learning.StudentCredentialConfig{StudentExternalRef: ref, LoginCode: "PRIVATE-" + ref, PicturePassword: []string{"moon", "key", "tree"}}); err != nil {
					t.Fatal(err)
				}
				if owner == "family" {
					if _, err := repo.UpsertParentLink(ctx, learning.ParentLinkConfig{ParentEmail: parent.Email, StudentExternalRef: ref, Relationship: "parent", Status: "active"}); err != nil {
						t.Fatal(err)
					}
				} else if owner == "other-school" {
					if _, err := repo.AssignStudentToClass(ctx, classB.ID, ref); err != nil {
						t.Fatal(err)
					}
				}
				if operation == "upsert" {
					res := request(http.MethodPut, "/v1/school/students/"+ref, fmt.Sprintf(`{"display_name":"Overwritten by school A","year_group":7,"class_id":%q}`, classA.ID))
					var name string
					if err := pool.QueryRow(ctx, `SELECT display_name FROM students WHERE id=$1`, student.ID).Scan(&name); err != nil {
						t.Fatal(err)
					}
					if res.Code != http.StatusForbidden || name != "Protected learner" {
						t.Errorf("UNSAFE upsert: owner=%s status=%d persisted_name=%q (want 403 and unchanged)", owner, res.Code, name)
					}
				} else {
					res := request(http.MethodPut, "/v1/school/classes/"+classA.ID+"/students/"+ref, "")
					var attached bool
					if err := pool.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM class_students WHERE class_id=$1 AND student_id=$2)`, classA.ID, student.ID).Scan(&attached); err != nil {
						t.Fatal(err)
					}
					portalRes := request(http.MethodGet, "/v1/school/config", "")
					if portalRes.Code != http.StatusOK {
						t.Fatalf("read school portal: %d %s", portalRes.Code, portalRes.Body.String())
					}
					var portal struct {
						Credentials []learning.StudentCredentialConfig `json:"student_credentials"`
					}
					if err := json.Unmarshal(portalRes.Body.Bytes(), &portal); err != nil {
						t.Fatal(err)
					}
					leaked := false
					for _, credential := range portal.Credentials {
						if credential.StudentExternalRef == ref && credential.LoginCode == "PRIVATE-"+ref {
							leaked = true
						}
					}
					if res.Code != http.StatusForbidden || attached || leaked {
						t.Errorf("UNSAFE assignment: owner=%s status=%d foreign_membership=%t credential_exposed=%t (want 403,false,false)", owner, res.Code, attached, leaked)
					}
				}
			})
		}
	}
}

func TestSchoolStudentCreationAndExplicitAdminLinkingPostgres(t *testing.T) {
	srv, repo, pool := parentChildSecurityServer(t)
	ctx := context.Background()
	if _, err := repo.UpsertSchool(ctx, learning.SchoolConfig{URN: "enrol-school", Name: "Enrolment school", Status: "trial"}); err != nil {
		t.Fatal(err)
	}
	class, err := repo.UpsertClass(ctx, learning.ClassConfig{SchoolURN: "enrol-school", Name: "Owned class", YearGroup: 2})
	if err != nil {
		t.Fatal(err)
	}
	otherClass, err := repo.UpsertClass(ctx, learning.ClassConfig{SchoolURN: "enrol-school", Name: "Other owned class", YearGroup: 2})
	if err != nil {
		t.Fatal(err)
	}
	staff, err := repo.UpsertSchoolUser(ctx, learning.SchoolUserConfig{SchoolURN: class.SchoolURN, Email: "enrol-admin@example.test", LoginID: "enrol-admin", DisplayName: "Enrol admin", Role: "school_admin", Status: "active", TemporaryPassword: "test-only-password"})
	if err != nil {
		t.Fatal(err)
	}
	session, err := srv.createAccountSession(ctx, staff.ID, staff.LoginID, "school_admin", class.SchoolURN, time.Hour)
	if err != nil {
		t.Fatal(err)
	}
	res := schoolStudentRequest(srv, session.Token, "/v1/school/students/new-enrolled-child", fmt.Sprintf(`{"display_name":"New learner","year_group":2,"class_id":%q}`, class.ID))
	if res.Code != http.StatusOK {
		t.Fatalf("atomic creation failed: %d %s", res.Code, res.Body.String())
	}
	var saved learning.StudentProfileConfig
	if err := json.Unmarshal(res.Body.Bytes(), &saved); err != nil || saved.ID == "" {
		t.Fatalf("invalid learner response: %+v %v", saved, err)
	}
	req := httptest.NewRequest(http.MethodGet, "/v1/school/config", nil)
	req.Header.Set("Authorization", "Bearer "+session.Token)
	portalRes := httptest.NewRecorder()
	srv.ServeHTTP(portalRes, req)
	if portalRes.Code != http.StatusOK {
		t.Fatalf("portal: %d", portalRes.Code)
	}
	var portal struct {
		Classes []learning.ClassConfig `json:"classes"`
	}
	if err := json.Unmarshal(portalRes.Body.Bytes(), &portal); err != nil {
		t.Fatal(err)
	}
	found := false
	for _, c := range portal.Classes {
		for _, p := range c.Students {
			if c.ID == class.ID && p.ID == saved.ID {
				found = true
			}
		}
	}
	if !found {
		t.Fatal("HTTP-created learner is not immediately available in scoped class/learner selection")
	}

	unassigned, err := repo.UpsertStudent(ctx, learning.StudentProfileConfig{ExternalRef: "admin-links-unassigned", DisplayName: "Admin managed", YearGroup: 2})
	if err != nil {
		t.Fatal(err)
	}
	if _, err := repo.UpsertStudentCredential(ctx, learning.StudentCredentialConfig{StudentExternalRef: unassigned.ExternalRef, LoginCode: "KEEP-ADMIN-CODE", PicturePassword: []string{"key", "moon"}, QRSecretHash: "keep-qr"}); err != nil {
		t.Fatal(err)
	}
	var before string
	if err := pool.QueryRow(ctx, `SELECT to_jsonb(c)::text FROM student_credentials c WHERE student_id=$1`, unassigned.ID).Scan(&before); err != nil {
		t.Fatal(err)
	}
	res = schoolStudentRequest(srv, session.Token, "/v1/school/classes/"+class.ID+"/students/"+unassigned.ExternalRef, "")
	if res.Code != http.StatusForbidden {
		t.Fatalf("school claimed unassigned pupil: %d", res.Code)
	}
	platform, err := repo.(platformUserRepository).UpsertPlatformUser(ctx, learning.PlatformUserConfig{Email: "linking-admin@example.test", LoginID: "linking-admin", DisplayName: "Platform linking admin", Roles: []string{"platform_admin"}}, "test-only-password")
	if err != nil {
		t.Fatal(err)
	}
	adminSession, err := srv.createAccountSession(ctx, platform.ID, platform.LoginID, "platform_admin", "", time.Hour)
	if err != nil {
		t.Fatal(err)
	}
	res = schoolStudentRequest(srv, adminSession.Token, "/v1/admin/classes/"+class.ID+"/students/"+unassigned.ExternalRef, "")
	if res.Code != http.StatusOK {
		t.Fatalf("explicit platform-admin linking regressed: %d %s", res.Code, res.Body.String())
	}
	res = schoolStudentRequest(srv, session.Token, "/v1/school/students/"+unassigned.ExternalRef, fmt.Sprintf(`{"display_name":"Owned update","year_group":2,"class_id":%q}`, class.ID))
	if res.Code != http.StatusOK {
		t.Fatalf("explicitly linked learner cannot be updated: %d %s", res.Code, res.Body.String())
	}
	for i := 0; i < 2; i++ {
		res = schoolStudentRequest(srv, session.Token, "/v1/school/classes/"+otherClass.ID+"/students/"+unassigned.ExternalRef, "")
		if res.Code != http.StatusOK {
			t.Fatalf("owned assignment/replay failed: %d %s", res.Code, res.Body.String())
		}
	}
	var after string
	if err := pool.QueryRow(ctx, `SELECT to_jsonb(c)::text FROM student_credentials c WHERE student_id=$1`, unassigned.ID).Scan(&after); err != nil {
		t.Fatal(err)
	}
	if before != after {
		t.Fatal("admin linking or school writes rotated credentials")
	}
	// A still-valid signed school_admin session cannot outlive membership removal.
	if _, err := pool.Exec(ctx, `DELETE FROM school_users WHERE user_id=$1`, staff.ID); err != nil {
		t.Fatal(err)
	}
	res = schoolStudentRequest(srv, session.Token, "/v1/school/students/removed-member-child", fmt.Sprintf(`{"display_name":"Denied","year_group":2,"class_id":%q}`, class.ID))
	if res.Code != http.StatusForbidden {
		t.Fatalf("revoked school membership was accepted: %d %s", res.Code, res.Body.String())
	}
	var count int
	if err := pool.QueryRow(ctx, `SELECT count(*) FROM students WHERE external_ref='removed-member-child'`).Scan(&count); err != nil {
		t.Fatal(err)
	}
	if count != 0 {
		t.Fatal("removed school member created pupil")
	}
}
