package server

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"net/url"
	"reflect"
	"strings"
	"testing"
	"time"

	"github.com/ArowuTest/nexuslearn/apps/api/internal/learning"
	"github.com/jackc/pgx/v5/pgxpool"
)

const directoryOverviewPath = "/v1/school/config?include_credentials=false&view=directory"

func directoryJSON(t *testing.T, res *httptest.ResponseRecorder, want int) map[string]any {
	t.Helper()
	assertSchoolAccessPrivate(t, res)
	if res.Code != want {
		t.Fatalf("status=%d want=%d body=%s", res.Code, want, res.Body.String())
	}
	var body map[string]any
	if err := json.Unmarshal(res.Body.Bytes(), &body); err != nil {
		t.Fatal(err)
	}
	return body
}

// Real migrated PostgreSQL, with membership deliberately inconsistent at the
// group boundary: a group row alone must not disclose a foreign/home pupil.
func schoolDirectoryFixture(t *testing.T) (*Server, *pgxpool.Pool, string, string, string) {
	t.Helper()
	srv, repo, pool := parentChildSecurityServer(t)
	ctx := context.Background()
	for _, sql := range []string{
		`INSERT INTO schools(id,urn,name,status) VALUES ('11000000-0000-0000-0000-000000000001','directory-a','School A','active'),('11000000-0000-0000-0000-000000000002','directory-b','School B','trial')`,
		`INSERT INTO classes(id,school_id,name,year_group) SELECT ('21000000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid,'11000000-0000-0000-0000-000000000001','Class '||n,3 FROM generate_series(1,53) n`,
		`INSERT INTO classes(id,school_id,name,year_group) VALUES ('21000000-0000-0000-0000-000000000054','11000000-0000-0000-0000-000000000002','Class 1',3),('21000000-0000-0000-0000-000000000055',NULL,'Home',3)`,
		`INSERT INTO learning_groups(id,class_id,name,purpose) SELECT ('31000000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid,('21000000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid,'Same group','intervention' FROM generate_series(1,55) n`,
		`INSERT INTO students(id,external_ref,display_name,year_group) SELECT ('41000000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid,'directory-child-'||lpad(n::text,3,'0'),'Same pupil',3 FROM generate_series(1,56) n`,
		`INSERT INTO class_students(class_id,student_id) SELECT '21000000-0000-0000-0000-000000000001',id FROM students WHERE external_ref<='directory-child-053'`,
		`INSERT INTO class_students(class_id,student_id) SELECT '21000000-0000-0000-0000-000000000002',id FROM students WHERE external_ref IN ('directory-child-001','directory-child-002')`,
		`INSERT INTO class_students(class_id,student_id) SELECT '21000000-0000-0000-0000-000000000054',id FROM students WHERE external_ref='directory-child-054'`,
		`INSERT INTO class_students(class_id,student_id) SELECT '21000000-0000-0000-0000-000000000055',id FROM students WHERE external_ref='directory-child-055'`,
		`INSERT INTO learning_group_students(group_id,student_id) SELECT '31000000-0000-0000-0000-000000000001',id FROM students`,
	} {
		if _, err := pool.Exec(ctx, sql); err != nil {
			t.Fatal(err)
		}
	}
	newSession := func(urn, role string) (string, string) {
		u, err := repo.UpsertSchoolUser(ctx, learning.SchoolUserConfig{SchoolURN: urn, Email: role + urn + "@example.test", LoginID: role + urn, DisplayName: "Directory actor", Role: role, Status: "active", TemporaryPassword: "test-only-password"})
		if err != nil {
			t.Fatal(err)
		}
		session, err := srv.createAccountSession(ctx, u.ID, u.LoginID, role, urn, time.Hour)
		if err != nil {
			t.Fatal(err)
		}
		return session.Token, u.ID
	}
	teacher, actor := newSession("directory-a", "teacher")
	admin, _ := newSession("directory-a", "school_admin")
	return srv, pool, teacher, admin, actor
}

func assertDirectoryItems(t *testing.T, kind string, raw any, count int) []any {
	t.Helper()
	items, ok := raw.([]any)
	if !ok || len(items) != count {
		t.Fatalf("%s items=%v want length=%d", kind, raw, count)
	}
	keys := map[string][]string{"classes": {"id", "name", "year_group", "student_count"}, "groups": {"id", "class_id", "name", "purpose", "student_count"}, "students": {"external_ref", "display_name", "year_group"}}[kind]
	for _, raw := range items {
		item := raw.(map[string]any)
		if len(item) != len(keys) {
			t.Fatalf("unexpected nested/private fields: %+v", item)
		}
		for _, k := range keys {
			if _, ok := item[k]; !ok {
				t.Fatalf("missing %s: %+v", k, item)
			}
		}
	}
	return items
}

func TestSchoolDirectoryOverviewAndPagingPostgres(t *testing.T) {
	srv, pool, teacher, admin, _ := schoolDirectoryFixture(t)
	// No new read may require the private credential relation at all.
	if _, err := pool.Exec(context.Background(), `ALTER TABLE student_credentials RENAME TO unavailable_directory_credentials`); err != nil {
		t.Fatal(err)
	}
	for _, token := range []string{teacher, admin} {
		body := directoryJSON(t, schoolAccessRequest(srv, token, directoryOverviewPath), 200)
		if len(body) != 6 || body["school"].(map[string]any)["urn"] != "directory-a" || body["current_user"].(map[string]any)["school_urn"] != "directory-a" {
			t.Fatalf("overview contract: %+v", body)
		}
		meta, ok := body["directory"].(map[string]any)
		if !ok || meta["version"] != float64(1) {
			t.Fatalf("missing directory version: %+v", body)
		}
		counts := meta["counts"].(map[string]any)
		for _, kind := range []string{"classes", "groups", "students"} {
			if counts[kind] != float64(53) {
				t.Fatalf("%s count=%v want=53", kind, counts[kind])
			}
			initial := assertDirectoryItems(t, kind, body[kind], 20)
			if kind == "classes" && (initial[0].(map[string]any)["student_count"] != float64(53) || initial[1].(map[string]any)["student_count"] != float64(2)) {
				t.Fatalf("class counts: %+v", initial[:2])
			}
			if kind == "groups" && initial[0].(map[string]any)["student_count"] != float64(53) {
				t.Fatal("group counted foreign/home/unassigned pupils")
			}
			first := directoryJSON(t, schoolAccessRequest(srv, token, "/v1/school/directory?kind="+kind), 200)
			if !reflect.DeepEqual(first["items"], initial) || first["next_cursor"] != meta[kind+"_next_cursor"] || first["school_urn"] != "directory-a" || first["kind"] != kind {
				t.Fatalf("overview and endpoint disagree: %+v", first)
			}
			cursor, ok := first["next_cursor"].(string)
			if !ok || cursor == "" {
				t.Fatal("missing first cursor")
			}
			all := append([]any{}, initial...)
			for _, want := range []int{20, 13} {
				page := directoryJSON(t, schoolAccessRequest(srv, token, "/v1/school/directory?kind="+kind+"&cursor="+url.QueryEscape(cursor)), 200)
				all = append(all, assertDirectoryItems(t, kind, page["items"], want)...)
				cursor, _ = page["next_cursor"].(string)
			}
			if cursor != "" {
				t.Fatal("extra continuation")
			}
			seen := map[any]bool{}
			for _, raw := range all {
				item := raw.(map[string]any)
				id := item["id"]
				if kind == "students" {
					id = item["external_ref"]
				}
				if seen[id] {
					t.Fatalf("duplicate identity: %v", id)
				}
				seen[id] = true
			}
			max := directoryJSON(t, schoolAccessRequest(srv, token, "/v1/school/directory?kind="+kind+"&limit=50"), 200)
			assertDirectoryItems(t, kind, max["items"], 50)
		}
	}
}

func TestSchoolDirectorySearchRefAndStableNamesPostgres(t *testing.T) {
	srv, pool, teacher, _, _ := schoolDirectoryFixture(t)
	ctx := context.Background()
	for _, kind := range []string{"classes", "groups", "students"} {
		first := directoryJSON(t, schoolAccessRequest(srv, teacher, "/v1/school/directory?kind="+kind+"&limit=1"), 200)
		var sql string
		switch kind {
		case "classes":
			sql = `UPDATE classes SET name='Literal %_\ match' WHERE id='21000000-0000-0000-0000-000000000001'`
		case "groups":
			sql = `UPDATE learning_groups SET name='Literal %_\ match' WHERE id='31000000-0000-0000-0000-000000000001'`
		case "students":
			sql = `UPDATE students SET display_name='Literal %_\ match',year_group=7 WHERE external_ref='directory-child-001'`
		}
		if _, err := pool.Exec(ctx, sql); err != nil {
			t.Fatal(err)
		}
		for _, search := range []string{"%", "_", `\`, "  LiTeRaL  "} {
			page := directoryJSON(t, schoolAccessRequest(srv, teacher, "/v1/school/directory?kind="+kind+"&search="+url.QueryEscape(search)), 200)
			assertDirectoryItems(t, kind, page["items"], 1)
			if _, ok := page["next_cursor"]; ok {
				t.Fatal("exact page should omit cursor")
			}
		}
		second := directoryJSON(t, schoolAccessRequest(srv, teacher, "/v1/school/directory?kind="+kind+"&limit=1&cursor="+url.QueryEscape(first["next_cursor"].(string))), 200)
		if reflect.DeepEqual(first["items"], second["items"]) {
			t.Fatal("rename repeated boundary")
		}
		directoryJSON(t, schoolAccessRequest(srv, teacher, "/v1/school/directory?kind="+kind+"&search=changed&cursor="+url.QueryEscape(first["next_cursor"].(string))), 400)
	}
	for _, ref := range []string{"directory-child-001", "directory-child-054", "directory-child-055", "directory-child-056", "not-found"} {
		page := directoryJSON(t, schoolAccessRequest(srv, teacher, "/v1/school/directory?kind=students&ref="+ref), 200)
		want := 0
		if ref == "directory-child-001" {
			want = 1
		}
		items := assertDirectoryItems(t, "students", page["items"], want)
		if want == 1 && items[0].(map[string]any)["year_group"] != float64(7) {
			t.Fatal("ref did not revalidate current pupil")
		}
	}
	page := directoryJSON(t, schoolAccessRequest(srv, teacher, "/v1/school/directory?kind=students&search=CHILD-053"), 200)
	assertDirectoryItems(t, "students", page["items"], 1)
	for _, ref := range []string{"21000000-0000-0000-0000-000000000053", "21000000-0000-0000-0000-000000000054", "21000000-0000-0000-0000-000000000055", "21000000-0000-0000-0000-000000000099"} {
		page := directoryJSON(t, schoolAccessRequest(srv, teacher, "/v1/school/directory?kind=classes&ref="+ref), 200)
		want := 0
		if strings.HasSuffix(ref, "053") {
			want = 1
		}
		items := assertDirectoryItems(t, "classes", page["items"], want)
		if want == 1 && (items[0].(map[string]any)["name"] != "Class 53" || items[0].(map[string]any)["year_group"] != float64(3)) {
			t.Fatal("class ref invented parent metadata")
		}
		if _, ok := page["next_cursor"]; ok {
			t.Fatal("ref must not paginate")
		}
	}
	if _, err := pool.Exec(ctx, `DELETE FROM class_students WHERE student_id=(SELECT id FROM students WHERE external_ref='directory-child-001')`); err != nil {
		t.Fatal(err)
	}
	page = directoryJSON(t, schoolAccessRequest(srv, teacher, "/v1/school/directory?kind=students&ref=directory-child-001"), 200)
	assertDirectoryItems(t, "students", page["items"], 0)
}

func TestSchoolDirectoryLiveAuthorizationPostgres(t *testing.T) {
	srv, pool, token, _, actor := schoolDirectoryFixture(t)
	ctx := context.Background()
	first := directoryJSON(t, schoolAccessRequest(srv, token, "/v1/school/directory?kind=students"), 200)
	paths := []string{directoryOverviewPath, "/v1/school/directory?kind=students", "/v1/school/directory?kind=students&cursor=" + url.QueryEscape(first["next_cursor"].(string))}
	for _, tc := range []struct{ name, deny, restore string }{
		{"role", `UPDATE school_users SET role='school_admin' WHERE user_id=$1`, `UPDATE school_users SET role='teacher' WHERE user_id=$1`},
		{"inactive", `UPDATE app_users SET status='paused' WHERE id=$1`, `UPDATE app_users SET status='active' WHERE id=$1`},
		{"school", `UPDATE schools SET status='paused' WHERE urn='directory-a' AND EXISTS(SELECT 1 FROM app_users WHERE id=$1)`, `UPDATE schools SET status='active' WHERE urn='directory-a' AND EXISTS(SELECT 1 FROM app_users WHERE id=$1)`},
	} {
		t.Run(tc.name, func(t *testing.T) {
			if _, err := pool.Exec(ctx, tc.deny, actor); err != nil {
				t.Fatal(err)
			}
			defer func() {
				if _, err := pool.Exec(ctx, tc.restore, actor); err != nil {
					t.Error(err)
				}
			}()
			for _, path := range paths {
				directoryJSON(t, schoolAccessRequest(srv, token, path), 401)
			}
		})
	}
	forged, err := srv.createAccountSession(ctx, actor, "teacherdirectory-a", "teacher", "directory-b", time.Hour)
	if err != nil {
		t.Fatal(err)
	}
	for _, path := range paths {
		directoryJSON(t, schoolAccessRequest(srv, forged.Token, path), 401)
	}
	if _, err := pool.Exec(ctx, `DELETE FROM school_users WHERE user_id=$1`, actor); err != nil {
		t.Fatal(err)
	}
	for _, path := range paths {
		directoryJSON(t, schoolAccessRequest(srv, token, path), 401)
	}
}

func TestSchoolDirectoryUnsupportedAndNonSchoolDenied(t *testing.T) {
	for _, role := range []string{"teacher", "school_admin", "parent", "pupil", "platform_admin", "content_editor", "content_reviewer"} {
		repo := &schoolAccessLegacyRepository{fakeRepository: schoolStudentHandlerFake(role)}
		srv, token := schoolStudentHandlerSession(t, repo, role)
		want := 403
		if role == "teacher" || role == "school_admin" {
			want = 503
		}
		for _, path := range []string{directoryOverviewPath, "/v1/school/directory?kind=classes"} {
			for _, tc := range []struct {
				token string
				want  int
			}{{token, want}, {"", 401}, {"bogus", 401}} {
				t.Run(fmt.Sprintf("%s/%s/%d", role, path, tc.want), func(t *testing.T) { directoryJSON(t, schoolAccessRequest(srv, tc.token, path), tc.want) })
			}
		}
		if repo.portalReads+repo.credentialReads+repo.generations != 0 {
			t.Fatal("directory fell back to legacy hydration")
		}
	}
}

func TestSchoolDirectoryStrictQueries(t *testing.T) {
	repo := &schoolAccessLegacyRepository{fakeRepository: schoolStudentHandlerFake("teacher")}
	srv, token := schoolStudentHandlerSession(t, repo, "teacher")
	queries := []string{"", "?kind", "?kind=", "?kind=staff", "?kind=students&kind=students", "?kind=students&limit=0", "?kind=students&limit=51", "?kind=students&limit=%2B1", "?kind=students&limit=1.0", "?kind=students&limit=999999999999999999999", "?kind=students&limit=1&limit=2", "?kind=students&cursor=", "?kind=students&cursor=garbage", "?kind=students&cursor=x&cursor=y", "?kind=students&search=x&search=x", "?kind=students&search=%00", "?kind=students&search=%FF", "?kind=students&search=" + url.QueryEscape(strings.Repeat("界", 101)), "?kind=students&ref=", "?kind=classes&ref=x", "?kind=groups&ref=x", "?kind=students&ref=x&search=", "?kind=students&ref=x&cursor=", "?kind=students&ref=x&ref=x", "?kind=students&ref=" + strings.Repeat("x", 201), "?kind=students&ref=%00", "?kind=students&ref=%FF", "?kind=students&school_urn=directory-b", "?kind=students&role=school_admin", "?kind=students&search", "?kind=students&", "?kind=students;limit=1", "?kind=students&search=%ZZ"}
	valid := `{"v":1,"school_urn":"verified-school","kind":"students","search":"","ref":"","id":"41000000-0000-0000-0000-000000000001","class_id":""}`
	for _, raw := range []string{`{}`, `null`, `[]`, valid + `{}`, strings.Replace(valid, `"v":1`, `"v":2`, 1), strings.Replace(valid, `"v":1`, `"v":1,"v":1`, 1), strings.Replace(valid, `"v":1`, `"V":1`, 1), strings.Replace(valid, `"ref":""`, `"ref":null`, 1), strings.Replace(valid, `"ref":"",`, "", 1), strings.Replace(valid, `verified-school`, `foreign-school`, 1), strings.Replace(valid, `"kind":"students"`, `"kind":"classes"`, 1), strings.Replace(valid, `"search":""`, `"search":"different"`, 1), strings.Replace(valid, `"ref":""`, `"ref":"other"`, 1), strings.Replace(valid, `41000000-0000-0000-0000-000000000001`, `not-a-uuid`, 1)} {
		queries = append(queries, "?kind=students&cursor="+base64.RawURLEncoding.EncodeToString([]byte(raw)))
	}
	for _, query := range queries {
		t.Run(query, func(t *testing.T) {
			directoryJSON(t, schoolAccessRequest(srv, token, "/v1/school/directory"+query), 400)
		})
	}
	for _, query := range []string{"?view=unknown", "?view=", "?view=directory&view=directory", "?view=directory&include_credentials=true", "?view=directory&include_credentials=false&include_credentials=false", "?view=directory&include_credentials=false&school_urn=other", "?view=directory&include_credentials=false&"} {
		t.Run(query, func(t *testing.T) { directoryJSON(t, schoolAccessRequest(srv, token, "/v1/school/config"+query), 400) })
	}
}

type directoryHandlerRepository struct {
	schoolAccessLegacyRepository
	allowed          bool
	authErr, readErr error
	reads            int
	query            learning.SchoolDirectoryQuery
}

func (f *directoryHandlerRepository) SchoolUserCanRead(_ context.Context, actor, urn, role string) (bool, error) {
	return f.allowed && actor == "verified-school-user" && urn == "verified-school" && role == "teacher", f.authErr
}
func (f *directoryHandlerRepository) ListSchoolDirectory(_ context.Context, urn string, q learning.SchoolDirectoryQuery) (learning.SchoolDirectoryPage, error) {
	f.reads++
	f.query = q
	return learning.SchoolDirectoryPage{SchoolURN: urn, Kind: q.Kind}, f.readErr
}
func (f *directoryHandlerRepository) SchoolDirectoryOverview(context.Context, string) (learning.SchoolDirectoryOverview, error) {
	f.reads++
	return learning.SchoolDirectoryOverview{Directory: learning.SchoolDirectoryMetadata{Version: 1}}, f.readErr
}
func TestSchoolDirectoryHandlerErrorsAndHeaderSpoofs(t *testing.T) {
	repo := &directoryHandlerRepository{schoolAccessLegacyRepository: schoolAccessLegacyRepository{fakeRepository: schoolStudentHandlerFake("teacher")}, allowed: true}
	srv, token := schoolStudentHandlerSession(t, repo, "teacher")
	srv.allowLegacyAuth = true
	for _, path := range []string{directoryOverviewPath, "/v1/school/directory?kind=classes"} {
		for _, tc := range []struct {
			allowed          bool
			authErr, readErr error
			want             int
			read             bool
		}{
			{true, nil, nil, 200, true}, {false, nil, nil, 401, false}, {true, errors.New("PRIVATE-DATABASE-DETAIL"), nil, 500, false}, {true, nil, learning.ErrInvalidConfiguration, 400, true}, {true, nil, errors.New("PRIVATE-DATABASE-DETAIL"), 500, true},
		} {
			repo.allowed, repo.authErr, repo.readErr = tc.allowed, tc.authErr, tc.readErr
			before := repo.reads
			res := schoolAccessRequest(srv, token, path)
			directoryJSON(t, res, tc.want)
			if strings.Contains(res.Body.String(), "PRIVATE-DATABASE-DETAIL") || (repo.reads > before) != tc.read {
				t.Fatal("error leaked details or bypassed access")
			}
		}
		req := httptest.NewRequest(http.MethodGet, path, nil)
		req.Header.Set("X-School-URN", "verified-school")
		req.Header.Set("X-School-Login", "school-login")
		req.Header.Set("X-School-Password", "synthetic-test-only")
		res := httptest.NewRecorder()
		srv.ServeHTTP(res, req)
		directoryJSON(t, res, 401)
	}
	repo.allowed, repo.authErr, repo.readErr = true, nil, nil
	before := repo.reads
	for _, query := range []string{"?kind=classes&ref=21000000-0000-0000-0000-000000000001&search=", "?kind=classes&ref=21000000-0000-0000-0000-000000000001&cursor=", "?kind=groups&ref=21000000-0000-0000-0000-000000000001", "?kind=students&cursor=forged", "?kind=students&role=teacher"} {
		directoryJSON(t, schoolAccessRequest(srv, token, "/v1/school/directory"+query), 400)
	}
	if repo.reads != before {
		t.Fatal("invalid query reached directory repository")
	}
	res := schoolAccessRequest(srv, token, "/v1/school/directory?kind=students&search="+url.QueryEscape("  "+strings.Repeat("界", 100)+"  "))
	page := directoryJSON(t, res, 200)
	assertDirectoryItems(t, "students", page["items"], 0)
	if repo.query.Search != strings.Repeat("界", 100) || repo.query.Limit != 20 {
		t.Fatal("search or limit normalization changed")
	}
	if repo.portalReads+repo.credentialReads+repo.generations != 0 {
		t.Fatal("handler used legacy directory")
	}
}

func TestSchoolDirectoryCrossScopeAndEmptyPostgres(t *testing.T) {
	srv, pool, token, _, _ := schoolDirectoryFixture(t)
	ctx := context.Background()
	if _, err := pool.Exec(ctx, `INSERT INTO app_users(id,display_name,user_type,status) VALUES('51000000-0000-0000-0000-000000000001','Other teacher','teacher','active'); INSERT INTO school_users(school_id,user_id,role) VALUES('11000000-0000-0000-0000-000000000002','51000000-0000-0000-0000-000000000001','teacher')`); err != nil {
		t.Fatal(err)
	}
	foreign, err := srv.createAccountSession(ctx, "51000000-0000-0000-0000-000000000001", "other-teacher", "teacher", "directory-b", time.Hour)
	if err != nil {
		t.Fatal(err)
	}
	for _, kind := range []string{"classes", "groups", "students"} {
		path := "/v1/school/directory?kind=" + kind
		page := directoryJSON(t, schoolAccessRequest(srv, token, path), 200)
		cursor := url.QueryEscape(page["next_cursor"].(string))
		directoryJSON(t, schoolAccessRequest(srv, foreign.Token, path+"&cursor="+cursor), 400)
		otherKind := "students"
		if kind == "students" {
			otherKind = "classes"
		}
		directoryJSON(t, schoolAccessRequest(srv, token, "/v1/school/directory?kind="+otherKind+"&cursor="+cursor), 400)
		foreignPage := directoryJSON(t, schoolAccessRequest(srv, foreign.Token, path), 200)
		assertDirectoryItems(t, kind, foreignPage["items"], 1)
		if _, ok := foreignPage["next_cursor"]; ok {
			t.Fatal("one-row trial school emitted continuation")
		}
	}
	// Exact student refs are byte bounded, not trimmed or case-folded.
	ref := " " + strings.Repeat("界", 66) + " "
	if _, err := pool.Exec(ctx, `UPDATE students SET external_ref=$1 WHERE external_ref='directory-child-003'`, ref); err != nil {
		t.Fatal(err)
	}
	page := directoryJSON(t, schoolAccessRequest(srv, token, "/v1/school/directory?kind=students&ref="+url.QueryEscape(ref)), 200)
	assertDirectoryItems(t, "students", page["items"], 1)
	page = directoryJSON(t, schoolAccessRequest(srv, token, "/v1/school/directory?kind=students&ref="+url.QueryEscape(strings.TrimSpace(ref))), 200)
	assertDirectoryItems(t, "students", page["items"], 0)
	if _, err := pool.Exec(ctx, `UPDATE classes SET school_id=NULL WHERE school_id='11000000-0000-0000-0000-000000000002'`); err != nil {
		t.Fatal(err)
	}
	page = directoryJSON(t, schoolAccessRequest(srv, foreign.Token, directoryOverviewPath), 200)
	meta := page["directory"].(map[string]any)
	if len(meta) != 2 {
		t.Fatal("empty overview emitted cursors")
	}
	for _, kind := range []string{"classes", "groups", "students"} {
		assertDirectoryItems(t, kind, page[kind], 0)
		if meta["counts"].(map[string]any)[kind] != float64(0) {
			t.Fatal("empty school has nonzero counts")
		}
	}
}
