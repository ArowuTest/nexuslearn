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
	"strings"
	"testing"
	"time"

	"github.com/ArowuTest/nexuslearn/apps/api/internal/learning"
)

const schoolCurriculumPath = "/v1/school/curriculum/objectives"

type schoolCurriculumHTTPPage struct {
	Year       int    `json:"year"`
	Subject    string `json:"subject"`
	Query      string `json:"query"`
	Limit      int    `json:"limit"`
	ReleaseID  string `json:"release_id"`
	Objectives []struct {
		ID              string `json:"id"`
		Year            int    `json:"year"`
		Subject         string `json:"subject"`
		Strand          string `json:"strand"`
		Topic           string `json:"topic"`
		Statement       string `json:"statement"`
		TeacherEvidence string `json:"teacher_evidence"`
	} `json:"objectives"`
	HasMore    bool   `json:"has_more"`
	NextCursor string `json:"next_cursor"`
}

func schoolCurriculumResponse(t *testing.T, res *httptest.ResponseRecorder) schoolCurriculumHTTPPage {
	t.Helper()
	assertSchoolAccessPrivate(t, res)
	if res.Code != http.StatusOK {
		t.Fatalf("catalogue status=%d body=%s", res.Code, res.Body.String())
	}
	var page schoolCurriculumHTTPPage
	if err := json.Unmarshal(res.Body.Bytes(), &page); err != nil || page.Objectives == nil {
		t.Fatalf("invalid catalogue response: %s err=%v", res.Body.String(), err)
	}
	var body map[string]any
	if err := json.Unmarshal(res.Body.Bytes(), &body); err != nil || len(body) != 8 {
		t.Fatalf("unexpected page fields: %s", res.Body.String())
	}
	for _, key := range []string{"subject", "query", "release_id", "next_cursor"} {
		if _, ok := body[key].(string); !ok {
			t.Fatalf("%s must be a string: %s", key, res.Body.String())
		}
	}
	for _, raw := range body["objectives"].([]any) {
		item := raw.(map[string]any)
		if len(item) != 7 {
			t.Fatalf("unexpected objective fields: %+v", item)
		}
		for _, key := range []string{"id", "subject", "strand", "topic", "statement", "teacher_evidence"} {
			if _, ok := item[key].(string); !ok {
				t.Fatalf("%s must be a string: %+v", key, item)
			}
		}
	}
	if page.HasMore != (page.NextCursor != "") {
		t.Fatalf("inconsistent continuation: %+v", page)
	}
	for _, private := range []string{"PRIVATE-CHILD", "PRIVATE-MARKING", "login_code", "parent_explanation", "expected_mastery", "secure_mastery", "retention_days", "required_formats", "misconceptions", "prerequisites"} {
		if strings.Contains(res.Body.String(), private) {
			t.Fatalf("catalogue disclosed %q", private)
		}
	}
	return page
}

func TestSchoolCurriculumMissingCapabilityAndNonSchoolDenial(t *testing.T) {
	for _, role := range []string{"teacher", "school_admin", "parent", "pupil", "platform_admin", "content_editor", "content_reviewer"} {
		t.Run(role, func(t *testing.T) {
			repo := &schoolAccessLegacyRepository{fakeRepository: schoolStudentHandlerFake(role)}
			srv, token := schoolStudentHandlerSession(t, repo, role)
			want := http.StatusForbidden
			if role == "teacher" || role == "school_admin" {
				want = http.StatusServiceUnavailable
			}
			for _, tc := range []struct {
				token string
				want  int
			}{{token, want}, {"", 401}, {"bogus", 401}} {
				res := schoolAccessRequest(srv, tc.token, schoolCurriculumPath+"?year=3")
				if res.Code != tc.want {
					t.Errorf("role=%s status=%d want=%d body=%s", role, res.Code, tc.want, res.Body.String())
				}
				assertSchoolAccessPrivate(t, res)
			}
			if repo.portalReads+repo.credentialReads+repo.generations != 0 {
				t.Fatal("catalogue used legacy private reads or generated credentials")
			}
		})
	}
}

func TestSchoolCurriculumHTTPPostgres(t *testing.T) {
	srv, repo, pool := parentChildSecurityServer(t)
	ctx := context.Background()
	const live = "61000000-0000-0000-0000-000000000001"
	for _, sql := range []string{
		`INSERT INTO content_releases(id,schema_version,channel,manifest_sha256,expected_pack_count,expected_objective_count,expected_activity_count,expected_question_count,expected_reward_rule_count,status,applied_at)
		 VALUES('61000000-0000-0000-0000-000000000001','1','live','catalogue-live',1,27,0,0,0,'applied','2025-01-01'),
		 ('61000000-0000-0000-0000-000000000002','1','live','catalogue-old',1,1,0,0,0,'superseded','2026-01-01'),
		 ('61000000-0000-0000-0000-000000000003','1','pilot','catalogue-pilot',1,1,0,0,0,'applied','2027-01-01'),
		 ('61000000-0000-0000-0000-000000000004','1','review','catalogue-review',1,1,0,0,0,'applied','2028-01-01'),
		 ('61000000-0000-0000-0000-000000000005','1','live','catalogue-staged',1,1,0,0,0,'staged','2029-01-01')`,
		`INSERT INTO curriculum_objectives(id,year_group,subject,strand,topic,statement,teacher_evidence,parent_explanation,content_release_id)
		 SELECT 'catalogue-'||lpad(n::text,3,'0'),3,'Mathematics','Number','Fractions','Recognise a fraction','Observe explanation','PRIVATE-MARKING','61000000-0000-0000-0000-000000000001' FROM generate_series(1,27) n`,
		`INSERT INTO curriculum_objectives(id,year_group,subject,strand,topic,statement,content_release_id)
		 SELECT 'hidden-'||id,3,'Mathematics','Number','Fractions','Unreleased fraction',id FROM content_releases WHERE id<>'61000000-0000-0000-0000-000000000001'`,
		`INSERT INTO curriculum_objectives(id,year_group,subject,strand,topic,statement) VALUES('hidden-legacy',3,'Mathematics','Number','Fractions','Legacy fraction')`,
		`INSERT INTO curriculum_objectives(id,year_group,subject,strand,topic,statement,content_release_id) VALUES
		 ('outside-subject',3,'History','Other','Other','Fraction','61000000-0000-0000-0000-000000000001'),
		 ('outside-year',4,'Mathematics','Number','Fractions','Fraction','61000000-0000-0000-0000-000000000001'),
		 ('science-001',3,'Science','Plants','Growth','Observe roots','61000000-0000-0000-0000-000000000001')`,
		`INSERT INTO students(external_ref,display_name,year_group) VALUES('PRIVATE-CHILD','PRIVATE-CHILD',3)`,
	} {
		if _, err := pool.Exec(ctx, sql); err != nil {
			t.Fatal(err)
		}
	}
	newSession := func(urn, role string) (string, string) {
		t.Helper()
		if _, err := repo.UpsertSchool(ctx, learning.SchoolConfig{URN: urn, Name: urn, Status: "active"}); err != nil {
			t.Fatal(err)
		}
		user, err := repo.UpsertSchoolUser(ctx, learning.SchoolUserConfig{SchoolURN: urn, Email: role + "-" + urn + "@example.test", LoginID: role + "-" + urn, DisplayName: "Teacher", Role: role, Status: "active", TemporaryPassword: "test-only-password"})
		if err != nil {
			t.Fatal(err)
		}
		session, err := srv.createAccountSession(ctx, user.ID, user.LoginID, role, urn, time.Hour)
		if err != nil {
			t.Fatal(err)
		}
		return session.Token, user.ID
	}
	teacher, teacherID := newSession("catalogue-school-a", "teacher")
	admin, _ := newSession("catalogue-school-a", "school_admin")
	foreign, _ := newSession("catalogue-school-b", "teacher")
	read := func(token, query string) schoolCurriculumHTTPPage {
		t.Helper()
		return schoolCurriculumResponse(t, schoolAccessRequest(srv, token, schoolCurriculumPath+query))
	}
	denied := func(token, query string, want int) {
		t.Helper()
		res := schoolAccessRequest(srv, token, schoolCurriculumPath+query)
		if res.Code != want {
			t.Fatalf("query=%q status=%d want=%d body=%s", query, res.Code, want, res.Body.String())
		}
		assertSchoolAccessPrivate(t, res)
	}
	filter := "?year=3&subject=Mathematics&q=fraction"
	first := read(teacher, filter)
	if first.Year != 3 || first.Subject != "Mathematics" || first.Query != "fraction" || first.Limit != 12 || first.ReleaseID != live || len(first.Objectives) != 12 || !first.HasMore {
		t.Fatalf("first page: %+v", first)
	}
	// Renaming both sides of a page boundary must not move identities.
	if _, err := pool.Exec(ctx, `UPDATE curriculum_objectives SET strand='ZZ fraction',topic='AA fraction',statement='Renamed fraction' WHERE id IN ('catalogue-001','catalogue-013')`); err != nil {
		t.Fatal(err)
	}
	page, count := first, 0
	for {
		for _, item := range page.Objectives {
			count++
			if item.ID != fmt.Sprintf("catalogue-%03d", count) || item.Year != 3 || item.Subject != "Mathematics" {
				t.Fatalf("duplicate, skipped or leaked objective at %d: %+v", count, item)
			}
		}
		if !page.HasMore {
			break
		}
		if count > 27 {
			t.Fatal("nonterminating catalogue")
		}
		page = read(teacher, filter+"&cursor="+url.QueryEscape(page.NextCursor))
	}
	if count != 27 || len(page.Objectives) != 3 {
		t.Fatalf("lost objectives: total=%d final=%d", count, len(page.Objectives))
	}
	exact := read(admin, filter+"&limit=27")
	if len(exact.Objectives) != 27 || exact.HasMore {
		t.Fatalf("exact page: %+v", exact)
	}
	empty := read(teacher, "?year=7&subject=English")
	if len(empty.Objectives) != 0 || empty.HasMore || empty.ReleaseID != live {
		t.Fatalf("empty page: %+v", empty)
	}
	all := read(teacher, "?year=3&subject=all&limit=50")
	if all.Subject != "" || len(all.Objectives) != 28 || all.HasMore {
		t.Fatalf("MVP all-subject filter: %+v", all)
	}
	trimmed := read(teacher, "?year=3&subject=Mathematics&q=%20FrAcTiOn%20&limit=1")
	if trimmed.Query != "FrAcTiOn" || len(trimmed.Objectives) != 1 {
		t.Fatalf("trimmed/case-insensitive query: %+v", trimmed)
	}
	for _, query := range []string{"?year=4&subject=Mathematics&q=fraction", "?year=3&subject=Science&q=fraction", "?year=3&subject=Mathematics&q=other"} {
		denied(teacher, query+"&cursor="+url.QueryEscape(first.NextCursor), 400)
	}
	denied(foreign, filter+"&cursor="+url.QueryEscape(first.NextCursor), 400)
	// Current membership and role must be checked again even on continuation.
	for _, change := range []struct{ name, deny, restore string }{
		{"role changed", `UPDATE school_users SET role='school_admin' WHERE user_id=$1`, `UPDATE school_users SET role='teacher' WHERE user_id=$1`},
		{"user paused", `UPDATE app_users SET status='paused' WHERE id=$1`, `UPDATE app_users SET status='active' WHERE id=$1`},
		{"school paused", `UPDATE schools SET status='paused' WHERE urn='catalogue-school-a' AND EXISTS(SELECT 1 FROM app_users WHERE id=$1)`, `UPDATE schools SET status='active' WHERE urn='catalogue-school-a' AND EXISTS(SELECT 1 FROM app_users WHERE id=$1)`},
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
			denied(teacher, filter, 401)
			denied(teacher, filter+"&cursor="+url.QueryEscape(first.NextCursor), 401)
		})
	}
	// A signed teacher role for an actor belonging only to another school is not authority.
	foreignScope, err := srv.createAccountSession(ctx, teacherID, "teacher-catalogue-school-a", "teacher", "catalogue-school-b", time.Hour)
	if err != nil {
		t.Fatal(err)
	}
	denied(foreignScope.Token, filter, 401)
	if _, err := pool.Exec(ctx, `UPDATE content_releases SET status='applied' WHERE id='61000000-0000-0000-0000-000000000005'`); err != nil {
		t.Fatal(err)
	}
	denied(teacher, filter+"&cursor="+url.QueryEscape(first.NextCursor), 400)
	switched := read(teacher, filter)
	if switched.ReleaseID != "61000000-0000-0000-0000-000000000005" || len(switched.Objectives) != 1 || switched.Objectives[0].ID != "hidden-61000000-0000-0000-0000-000000000005" {
		t.Fatalf("release switch leaked old objectives: %+v", switched)
	}
	if _, err := pool.Exec(ctx, `DELETE FROM school_users WHERE user_id=$1`, teacherID); err != nil {
		t.Fatal(err)
	}
	denied(teacher, filter, 401)
}

func schoolCurriculumEncoded(raw string) string {
	return base64.RawURLEncoding.EncodeToString([]byte(raw))
}

type schoolCurriculumHandlerRepository struct {
	fakeRepository
	authReads, catalogReads, legacyReads int
	actorID, schoolURN, role             string
	query                                learning.SchoolCurriculumQuery
	allowed                              bool
	authErr, readErr                     error
	page                                 learning.SchoolCurriculumPage
}

func (f *schoolCurriculumHandlerRepository) SchoolUserCanRead(_ context.Context, actor, urn, role string) (bool, error) {
	f.authReads++
	f.actorID, f.schoolURN, f.role = actor, urn, role
	return f.allowed, f.authErr
}

func (f *schoolCurriculumHandlerRepository) ListSchoolCurriculumObjectives(_ context.Context, urn string, query learning.SchoolCurriculumQuery) (learning.SchoolCurriculumPage, error) {
	f.catalogReads++
	f.schoolURN, f.query = urn, query
	page := f.page
	page.Year, page.Subject, page.Query, page.Limit, page.ReleaseID = query.Year, query.Subject, query.Query, query.Limit, "legacy"
	return page, f.readErr
}

func (f *schoolCurriculumHandlerRepository) ListObjectives(context.Context) ([]learning.Objective, error) {
	f.legacyReads++
	return nil, errors.New("unbounded objective directory must not be used")
}

func TestSchoolCurriculumMalformedQueriesNeverReadCatalogue(t *testing.T) {
	repo := &schoolCurriculumHandlerRepository{fakeRepository: schoolStudentHandlerFake("teacher"), allowed: true}
	srv, token := schoolStudentHandlerSession(t, repo, "teacher")
	queries := []string{
		"", "?year", "?year=", "?year=0", "?year=8", "?year=-1", "?year=3.0", "?year=bad", "?year=%2B3", "?year=999999999999999999999999", "?year=3&year=4",
		"?year=3&subject=maths", "?year=3&subject=mathematics", "?year=3&subject=History", "?year=3&subject=%20Mathematics", "?year=3&subject=Science&subject=English",
		"?year=3&limit=", "?year=3&limit=0", "?year=3&limit=-1", "?year=3&limit=51", "?year=3&limit=bad", "?year=3&limit=1.5", "?year=3&limit=%2B1", "?year=3&limit=999999999999999999999", "?year=3&limit=12&limit=12",
		"?year=3&q=a&q=b", "?year=3&q=" + strings.Repeat("a", 121), "?year=3&q=" + url.QueryEscape(strings.Repeat("界", 121)), "?year=3&q=%00", "?year=3&q=%FF",
		"?year=3&cursor=a&cursor=b", "?year=3&cursor=", "?year=3&cursor", "?year=3&cursor=%20", "?year=3&cursor=bogus", "?year=3&cursor=" + strings.Repeat("A", 2049),
		"?year=%ZZ", "?year=3&subject=%ZZ", "?year=3&q=%ZZ", "?year=3&cursor=%ZZ", "?year=3;subject=Science", "?year=3&unknown=value", "?year=3&q", "?year=3&subject",
	}
	valid := `{"v":1,"school_urn":"verified-school","year":3,"subject":"","query":"","release_id":"legacy","objective_id":"objective-001"}`
	for _, raw := range []string{
		`{}`, `null`, `[]`, valid + `{}`, strings.Replace(valid, `"v":1`, `"v":2`, 1), strings.Replace(valid, `"v":1`, `"v":1,"v":1`, 1), strings.Replace(valid, `"v":1`, `"V":1`, 1),
		strings.Replace(valid, `"query":""`, `"query":null`, 1), strings.Replace(valid, `"query":"",`, ``, 1), strings.Replace(valid, `"v":1`, `"v":1,"extra":true`, 1),
		strings.Replace(valid, `verified-school`, `foreign-school`, 1), strings.Replace(valid, `"year":3`, `"year":4`, 1), strings.Replace(valid, `"subject":""`, `"subject":"Science"`, 1),
		strings.Replace(valid, `"query":""`, `"query":"other"`, 1), strings.Replace(valid, `"release_id":"legacy"`, `"release_id":""`, 1), strings.Replace(valid, `objective-001`, ``, 1),
		strings.Replace(valid, `objective-001`, `\u0000`, 1),
	} {
		queries = append(queries, "?year=3&cursor="+url.QueryEscape(schoolCurriculumEncoded(raw)))
	}
	queries = append(queries, "?year=3&cursor="+url.QueryEscape(schoolCurriculumEncoded(valid)+"="), "?year=3&cursor="+url.QueryEscape(schoolCurriculumEncoded(valid)+"\n"))
	for i, query := range queries {
		res := schoolAccessRequest(srv, token, schoolCurriculumPath+query)
		if res.Code != 400 || repo.catalogReads != 0 || repo.legacyReads != 0 || repo.authReads != i+1 {
			t.Errorf("malformed query reached catalogue or skipped authentication: %q status=%d auth=%d catalog=%d legacy=%d", query, res.Code, repo.authReads, repo.catalogReads, repo.legacyReads)
		}
		assertSchoolAccessPrivate(t, res)
	}
}

func TestSchoolCurriculumHandlerNormalizesAndRechecksAccess(t *testing.T) {
	for _, role := range []string{"teacher", "school_admin"} {
		repo := &schoolCurriculumHandlerRepository{fakeRepository: schoolStudentHandlerFake(role), allowed: true}
		srv, token := schoolStudentHandlerSession(t, repo, role)
		for _, tc := range []struct {
			query, subject, search string
			limit                  int
		}{{"?year=3", "", "", 12}, {"?year=3&subject=", "", "", 12}, {"?year=3&subject=all", "", "", 12}, {"?year=3&subject=Mathematics&q=%20FrAcTiOn%20&limit=1", "Mathematics", "FrAcTiOn", 1}, {"?year=3&subject=English&limit=50", "English", "", 50}, {"?year=3&subject=Science&q=" + url.QueryEscape(strings.Repeat("界", 120)), "Science", strings.Repeat("界", 120), 12}} {
			page := schoolCurriculumResponse(t, schoolAccessRequest(srv, token, schoolCurriculumPath+tc.query))
			if page.Subject != tc.subject || page.Query != tc.search || page.Year != 3 || page.Limit != tc.limit || len(page.Objectives) != 0 || page.HasMore || repo.schoolURN != "verified-school" || repo.actorID != "verified-school-user" || repo.role != role {
				t.Fatalf("wrong normalized/authenticated request: page=%+v repo=%+v", page, repo)
			}
		}
		before := repo.catalogReads
		repo.allowed = false
		res := schoolAccessRequest(srv, token, schoolCurriculumPath+"?year=3")
		if res.Code != 401 || repo.catalogReads != before {
			t.Fatal("revoked user reached catalogue")
		}
		assertSchoolAccessPrivate(t, res)
		repo.authErr = errors.New("PRIVATE-MARKING database error")
		res = schoolAccessRequest(srv, token, schoolCurriculumPath+"?year=3")
		if res.Code != 500 || repo.catalogReads != before || strings.Contains(res.Body.String(), "PRIVATE-MARKING") {
			t.Fatal("authentication error granted access or leaked details")
		}
		assertSchoolAccessPrivate(t, res)
		repo.allowed, repo.authErr = true, nil
		for _, tc := range []struct {
			err  error
			want int
		}{{learning.ErrInvalidConfiguration, 400}, {errors.New("PRIVATE-MARKING database error"), 500}} {
			repo.readErr = tc.err
			res = schoolAccessRequest(srv, token, schoolCurriculumPath+"?year=3")
			if res.Code != tc.want || strings.Contains(res.Body.String(), "PRIVATE-MARKING") {
				t.Fatalf("catalogue error leaked or misclassified: %d %s", res.Code, res.Body.String())
			}
			assertSchoolAccessPrivate(t, res)
		}
		if repo.legacyReads != 0 {
			t.Fatal("catalogue used unbounded directory")
		}
	}
}
