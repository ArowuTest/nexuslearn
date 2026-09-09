package server

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"
	"time"

	"github.com/ArowuTest/nexuslearn/apps/api/internal/learning"
)

func TestSchoolAccessHTTPPostgres(t *testing.T) {
	srv, repo, pool := parentChildSecurityServer(t)
	ctx := context.Background()
	for _, urn := range []string{"access-school-a", "access-school-b"} {
		if _, err := repo.UpsertSchool(ctx, learning.SchoolConfig{URN: urn, Name: urn, Status: "active"}); err != nil {
			t.Fatal(err)
		}
	}
	makeClass := func(urn, name string) learning.ClassConfig {
		t.Helper()
		c, err := repo.UpsertClass(ctx, learning.ClassConfig{SchoolURN: urn, Name: name, YearGroup: 2})
		if err != nil {
			t.Fatal(err)
		}
		return c
	}
	owned, empty, foreign := makeClass("access-school-a", "Owned"), makeClass("access-school-a", "Empty"), makeClass("access-school-b", "Foreign")
	for _, query := range []string{
		`INSERT INTO students(id,external_ref,display_name,year_group) SELECT ('40000000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid,'http-child-'||lpad(n::text,2,'0'),'Learner',2 FROM generate_series(1,27) n`,
		`INSERT INTO student_credentials(student_id,login_code,picture_password,qr_secret_hash) SELECT id,'KEEP-'||external_ref,'["book","moon"]'::jsonb,'keep-qr' FROM students WHERE external_ref LIKE 'http-child-%' AND external_ref <> 'http-child-02'`,
	} {
		if _, err := pool.Exec(ctx, query); err != nil {
			t.Fatal(err)
		}
	}
	if _, err := pool.Exec(ctx, `INSERT INTO class_students(class_id,student_id) SELECT $1,id FROM students WHERE external_ref LIKE 'http-child-%' AND external_ref <> 'http-child-27'`, owned.ID); err != nil {
		t.Fatal(err)
	}
	if _, err := pool.Exec(ctx, `INSERT INTO class_students(class_id,student_id) SELECT $1,id FROM students WHERE external_ref='http-child-27'`, foreign.ID); err != nil {
		t.Fatal(err)
	}
	newSession := func(urn, role string) (string, string) {
		t.Helper()
		user, err := repo.UpsertSchoolUser(ctx, learning.SchoolUserConfig{SchoolURN: urn, Email: role + "-" + urn + "@example.test", LoginID: role + "-" + urn, DisplayName: "School user", Role: role, Status: "active", TemporaryPassword: "test-only-password"})
		if err != nil {
			t.Fatal(err)
		}
		session, err := srv.createAccountSession(ctx, user.ID, user.LoginID, role, urn, time.Hour)
		if err != nil {
			t.Fatal(err)
		}
		return session.Token, user.ID
	}
	teacher, teacherID := newSession("access-school-a", "teacher")
	admin, _ := newSession("access-school-a", "school_admin")
	otherTeacher, _ := newSession("access-school-b", "teacher")
	path := func(id string) string { return "/v1/school/classes/" + id + "/credentials" }
	request := func(token, target string, want int) *httptest.ResponseRecorder {
		t.Helper()
		res := schoolAccessRequest(srv, token, target)
		if res.Code != want {
			t.Fatalf("%s: status=%d want=%d body=%s", target, res.Code, want, res.Body.String())
		}
		assertSchoolAccessPrivate(t, res)
		return res
	}
	type credentialPage struct {
		ClassID     string                             `json:"class_id"`
		Credentials []learning.StudentCredentialConfig `json:"student_credentials"`
		Limit       int                                `json:"limit"`
		HasMore     bool                               `json:"has_more"`
		NextCursor  *string                            `json:"next_cursor"`
	}
	readPage := func(token, target string) credentialPage {
		t.Helper()
		res := request(token, target, http.StatusOK)
		var page credentialPage
		if err := json.Unmarshal(res.Body.Bytes(), &page); err != nil || page.Credentials == nil || page.NextCursor == nil {
			t.Fatalf("invalid page contract: %s err=%v", res.Body.String(), err)
		}
		return page
	}
	var before string
	snapshot := `SELECT jsonb_build_object('credentials',(SELECT jsonb_agg(to_jsonb(c) ORDER BY student_id) FROM student_credentials c),'audit',(SELECT count(*) FROM audit_logs))::text`
	if err := pool.QueryRow(ctx, snapshot).Scan(&before); err != nil {
		t.Fatal(err)
	}
	first := readPage(teacher, path(owned.ID)+"?school_urn=access-school-b")
	if first.ClassID != owned.ID || first.Limit != 12 || len(first.Credentials) != 12 || !first.HasMore || *first.NextCursor == "" {
		t.Fatalf("first page: %+v", first)
	}
	if item := first.Credentials[1]; item.StudentExternalRef != "http-child-02" || item.LoginCode != "" || item.QRSecretHash != "" || item.PicturePassword == nil || len(item.PicturePassword) != 0 {
		t.Fatalf("ungenerated learner: %+v", item)
	}
	count := 0
	page := first
	for {
		for _, item := range page.Credentials {
			count++
			if item.StudentExternalRef != fmt.Sprintf("http-child-%02d", count) {
				t.Fatalf("duplicate/skipped/foreign member at %d: %+v", count, item)
			}
		}
		if !page.HasMore {
			if *page.NextCursor != "" {
				t.Fatal("final page retained cursor")
			}
			break
		}
		if *page.NextCursor == "" || count > 26 {
			t.Fatal("nonterminating page")
		}
		page = readPage(teacher, path(owned.ID)+"?cursor="+url.QueryEscape(*page.NextCursor))
	}
	if count != 26 || len(page.Credentials) != 2 {
		t.Fatalf("lost members: total=%d final=%d", count, len(page.Credentials))
	}
	emptyPage := readPage(teacher, path(empty.ID))
	if emptyPage.ClassID != empty.ID || len(emptyPage.Credentials) != 0 || emptyPage.HasMore || *emptyPage.NextCursor != "" {
		t.Fatalf("empty page: %+v", emptyPage)
	}
	exactPage := readPage(admin, path(owned.ID)+"?limit=26")
	if exactPage.HasMore || *exactPage.NextCursor != "" || len(exactPage.Credentials) != 26 {
		t.Fatalf("exact-size page: %+v", exactPage)
	}
	for _, classID := range []string{foreign.ID, "00000000-0000-0000-0000-000000000000", "not-a-class-id"} {
		request(teacher, path(classID), 403)
	}
	request(otherTeacher, path(owned.ID)+"?school_urn=access-school-a", 403)
	request("", path(owned.ID), 401)
	for _, raw := range []string{"bogus", " ", base64.RawURLEncoding.EncodeToString([]byte(`{}`)), strings.Repeat("A", 4097)} {
		request(teacher, path(owned.ID)+"?cursor="+url.QueryEscape(raw), 400)
	}
	request(teacher, path(empty.ID)+"?cursor="+url.QueryEscape(*first.NextCursor), 400)
	request(otherTeacher, path(foreign.ID)+"?cursor="+url.QueryEscape(*first.NextCursor), 400)
	for _, limit := range []string{"0", "-1", "51", "invalid", ""} {
		request(teacher, path(owned.ID)+"?limit="+limit, 400)
	}
	res := schoolStudentRequest(srv, teacher, path(owned.ID), `{}`)
	if res.Code != 403 {
		t.Fatalf("teacher generated credentials: %d", res.Code)
	}
	var after string
	if err := pool.QueryRow(ctx, snapshot).Scan(&after); err != nil || before != after {
		t.Fatalf("GET/denied PUT mutated credentials or audit: %v", err)
	}
	// Only private read routes recheck live school access here. The existing
	// atomic write tests still exercise authorization under their own locks.
	for _, change := range []struct{ name, deny, restore string }{
		{"role changed", `UPDATE school_users SET role='school_admin' WHERE user_id=$1`, `UPDATE school_users SET role='teacher' WHERE user_id=$1`},
		{"user paused", `UPDATE app_users SET status='paused' WHERE id=$1`, `UPDATE app_users SET status='active' WHERE id=$1`},
		{"school paused", `UPDATE schools SET status='paused' WHERE id=(SELECT school_id FROM school_users WHERE user_id=$1)`, `UPDATE schools SET status='active' WHERE id=(SELECT school_id FROM school_users WHERE user_id=$1)`},
	} {
		t.Run(change.name, func(t *testing.T) {
			if _, err := pool.Exec(ctx, change.deny, teacherID); err != nil {
				t.Fatal(err)
			}
			defer func() {
				if _, err := pool.Exec(ctx, change.restore, teacherID); err != nil {
					t.Error(err)
				}
			}()
			for _, target := range []string{path(owned.ID), "/v1/school/config?include_credentials=false"} {
				res := schoolAccessRequest(srv, teacher, target)
				if res.Code != 401 {
					t.Errorf("revoked school read: status=%d want=401", res.Code)
				}
				assertSchoolAccessPrivate(t, res)
			}
		})
	}
	// The new overview must still work when eager credential queries cannot.
	if _, err := pool.Exec(ctx, `ALTER TABLE student_credentials RENAME TO inaccessible_credentials`); err != nil {
		t.Fatal(err)
	}
	res = request(teacher, "/v1/school/config?include_credentials=false", 200)
	if strings.Contains(res.Body.String(), "KEEP-") {
		t.Fatal("overview exposed credentials")
	}
	// Existing sessions must not retain private reads after membership revocation.
	if _, err := pool.Exec(ctx, `DELETE FROM school_users WHERE user_id=$1`, teacherID); err != nil {
		t.Fatal(err)
	}
	request(teacher, path(owned.ID), 401)
	request(teacher, "/v1/school/config?include_credentials=false", 401)
}
