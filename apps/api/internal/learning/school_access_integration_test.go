package learning

import (
	"context"
	"encoding/base64"
	"errors"
	"fmt"
	"strings"
	"sync"
	"testing"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// Optional capabilities keep older lightweight repository fakes source-compatible.
type testedSchoolAccessStore interface {
	SchoolOverview(context.Context, string) (SchoolPortalConfig, error)
	ListClassStudentCredentialPage(context.Context, string, string, int, string) (StudentCredentialPage, error)
	ClassBelongsToSchool(context.Context, string, string) (bool, error)
	GroupBelongsToSchool(context.Context, string, string) (bool, error)
	StudentBelongsToSchool(context.Context, string, string) (bool, error)
}

const (
	schoolAccessURN          = "school-read-501"
	schoolAccessClass        = "10000000-0000-0000-0000-000000000001"
	schoolAccessEmptyClass   = "10000000-0000-0000-0000-000000000002"
	schoolAccessForeignClass = "10000000-0000-0000-0000-000000000003"
	schoolAccessGroup        = "20000000-0000-0000-0000-000000000001"
)

func seedSchoolAccessRows(t *testing.T, pool *pgxpool.Pool) {
	t.Helper()
	ctx := context.Background()
	for _, query := range []string{
		`INSERT INTO schools(urn,name,status) SELECT 'school-read-'||n, 'Read school '||lpad(n::text,4,'0'), 'active' FROM generate_series(1,501) n`,
		`INSERT INTO classes(id,school_id,name,year_group) VALUES
		 ('10000000-0000-0000-0000-000000000001',(SELECT id FROM schools WHERE urn='school-read-501'),'Owned class',2),
		 ('10000000-0000-0000-0000-000000000002',(SELECT id FROM schools WHERE urn='school-read-501'),'Empty class',2),
		 ('10000000-0000-0000-0000-000000000003',(SELECT id FROM schools WHERE urn='school-read-1'),'Foreign class',2)`,
		`INSERT INTO learning_groups(id,class_id,name) VALUES ('20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','Owned group')`,
		`INSERT INTO students(id,external_ref,display_name,year_group)
		 SELECT ('30000000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid, 'read-child-'||lpad(n::text,3,'0'), 'Same name',2 FROM generate_series(1,54) n`,
		`INSERT INTO class_students(class_id,student_id) SELECT '10000000-0000-0000-0000-000000000001',id FROM students WHERE external_ref LIKE 'read-child-%' AND external_ref <> 'read-child-054'`,
		`INSERT INTO class_students(class_id,student_id) SELECT '10000000-0000-0000-0000-000000000003',id FROM students WHERE external_ref='read-child-054'`,
		`INSERT INTO student_credentials(student_id,login_code,picture_password,qr_secret_hash)
		 SELECT id, 'KEEP-'||external_ref, '["moon","key","tree"]'::jsonb, 'keep-qr' FROM students WHERE external_ref LIKE 'read-child-%' AND external_ref <> 'read-child-002'`,
	} {
		if _, err := pool.Exec(ctx, query); err != nil {
			t.Fatal(err)
		}
	}
}

func TestSchoolPortalFindsSchoolBeyondLegacyDirectoryPostgres(t *testing.T) {
	pool, repo := openPaginationIntegrationRepository(t)
	seedSchoolAccessRows(t, pool)
	portal, err := repo.SchoolPortal(context.Background(), schoolAccessURN)
	if err != nil || portal.School.URN != schoolAccessURN || len(portal.Classes) != 2 || len(portal.StudentCredentials) != 53 {
		t.Fatalf("school 501 is inaccessible or legacy credentials changed: urn=%q classes=%d credentials=%d err=%v", portal.School.URN, len(portal.Classes), len(portal.StudentCredentials), err)
	}
}

func TestSchoolAccessLoginCodeOnlyCredentialPostgres(t *testing.T) {
	pool, repo := openPaginationIntegrationRepository(t)
	seedSchoolAccessRows(t, pool)
	ctx := context.Background()
	if _, err := pool.Exec(ctx, `UPDATE student_credentials SET picture_password='null'::jsonb, qr_secret_hash='' WHERE student_id=(SELECT id FROM students WHERE external_ref='read-child-001')`); err != nil {
		t.Fatal(err)
	}
	page, err := repo.ListClassStudentCredentialPage(ctx, schoolAccessURN, schoolAccessClass, 12, "")
	if err != nil || len(page.StudentCredentials) != 12 {
		t.Fatalf("login-code-only page failed: rows=%d err=%v", len(page.StudentCredentials), err)
	}
	if item := page.StudentCredentials[0]; item.LoginCode != "KEEP-read-child-001" || item.PicturePassword == nil || len(item.PicturePassword) != 0 || item.QRSecretHash != "" {
		t.Fatalf("legacy login-code-only credential was not normalized: %+v", item)
	}
}

func TestSchoolAccessClassCredentialPagesPostgres(t *testing.T) {
	pool, repo := openPaginationIntegrationRepository(t)
	seedSchoolAccessRows(t, pool)
	store, ok := any(repo).(testedSchoolAccessStore)
	if !ok {
		t.Fatal("bounded school access capability is missing")
	}
	ctx := context.Background()
	var before string
	snapshot := `SELECT COALESCE(jsonb_agg(to_jsonb(c) ORDER BY student_id),'[]'::jsonb)::text FROM student_credentials c`
	if err := pool.QueryRow(ctx, snapshot).Scan(&before); err != nil {
		t.Fatal(err)
	}
	first, err := store.ListClassStudentCredentialPage(ctx, schoolAccessURN, schoolAccessClass, 12, "")
	if err != nil || len(first.StudentCredentials) != 12 || first.NextCursor == "" {
		t.Fatalf("first page: rows=%d cursor=%q err=%v", len(first.StudentCredentials), first.NextCursor, err)
	}
	if item := first.StudentCredentials[1]; item.StudentExternalRef != "read-child-002" || item.LoginCode != "" || item.QRSecretHash != "" || item.PicturePassword == nil || len(item.PicturePassword) != 0 {
		t.Fatalf("ungenerated member omitted or given credentials: %+v", item)
	}
	// Renaming/reyearing both sides of the boundary must not reorder identities.
	if _, err := pool.Exec(ctx, `UPDATE students SET display_name='Renamed',year_group=7 WHERE external_ref IN ('read-child-001','read-child-013')`); err != nil {
		t.Fatal(err)
	}
	seen := map[string]bool{}
	page, count := first, 0
	for {
		for _, item := range page.StudentCredentials {
			count++
			want := fmt.Sprintf("read-child-%03d", count)
			if seen[item.StudentExternalRef] || item.StudentExternalRef != want {
				t.Fatalf("unstable/foreign/duplicate member at %d: %q want=%q", count, item.StudentExternalRef, want)
			}
			seen[item.StudentExternalRef] = true
		}
		if page.NextCursor == "" {
			break
		}
		if count > 53 {
			t.Fatal("pagination did not terminate")
		}
		page, err = store.ListClassStudentCredentialPage(ctx, schoolAccessURN, schoolAccessClass, 12, page.NextCursor)
		if err != nil || len(page.StudentCredentials) == 0 || len(page.StudentCredentials) > 12 {
			t.Fatalf("continuation: rows=%d err=%v", len(page.StudentCredentials), err)
		}
	}
	if count != 53 || len(page.StudentCredentials) != 5 {
		t.Fatalf("lost members or wrong final page: total=%d final=%d", count, len(page.StudentCredentials))
	}
	for _, limit := range []int{0, 1, 50} {
		p, err := store.ListClassStudentCredentialPage(ctx, schoolAccessURN, schoolAccessClass, limit, "")
		want := limit
		if limit == 0 {
			want = 12
		}
		if err != nil || len(p.StudentCredentials) != want || p.NextCursor == "" {
			t.Errorf("limit=%d rows=%d cursor=%q err=%v", limit, len(p.StudentCredentials), p.NextCursor, err)
		}
	}
	for _, limit := range []int{-1, 51, 1000} {
		if _, err := store.ListClassStudentCredentialPage(ctx, schoolAccessURN, schoolAccessClass, limit, ""); !errors.Is(err, ErrInvalidConfiguration) {
			t.Errorf("invalid limit %d accepted: %v", limit, err)
		}
	}
	for _, cursor := range []string{"garbage", " ", base64.RawURLEncoding.EncodeToString([]byte(`{}`)), strings.Repeat("A", 4097)} {
		if _, err := store.ListClassStudentCredentialPage(ctx, schoolAccessURN, schoolAccessClass, 12, cursor); !errors.Is(err, ErrInvalidConfiguration) {
			t.Errorf("invalid cursor accepted: %v", err)
		}
	}
	for _, scope := range []struct{ urn, classID string }{{schoolAccessURN, schoolAccessEmptyClass}, {"school-read-1", schoolAccessForeignClass}} {
		if _, err := store.ListClassStudentCredentialPage(ctx, scope.urn, scope.classID, 12, first.NextCursor); !errors.Is(err, ErrInvalidConfiguration) {
			t.Errorf("cross-scope cursor accepted: %+v %v", scope, err)
		}
	}
	for _, classID := range []string{schoolAccessForeignClass, "00000000-0000-0000-0000-000000000000", "not-a-uuid"} {
		p, err := store.ListClassStudentCredentialPage(ctx, schoolAccessURN, classID, 12, "")
		if err == nil || len(p.StudentCredentials) != 0 {
			t.Errorf("foreign/missing class returned data: %q %+v %v", classID, p, err)
		}
	}
	empty, err := store.ListClassStudentCredentialPage(ctx, schoolAccessURN, schoolAccessEmptyClass, 12, "")
	if err != nil || empty.StudentCredentials == nil || len(empty.StudentCredentials) != 0 || empty.NextCursor != "" {
		t.Fatalf("owned empty class: %+v %v", empty, err)
	}
	var after string
	if err := pool.QueryRow(ctx, snapshot).Scan(&after); err != nil || before != after {
		t.Fatalf("read generated/rotated credentials: err=%v", err)
	}
}

type schoolAccessQueryTrace struct {
	sync.Mutex
	rows    []int64
	queries []string
}

func (s *schoolAccessQueryTrace) TraceQueryStart(ctx context.Context, _ *pgx.Conn, data pgx.TraceQueryStartData) context.Context {
	s.Lock()
	defer s.Unlock()
	s.queries = append(s.queries, data.SQL)
	return ctx
}

func (s *schoolAccessQueryTrace) TraceQueryEnd(_ context.Context, _ *pgx.Conn, data pgx.TraceQueryEndData) {
	s.Lock()
	defer s.Unlock()
	s.rows = append(s.rows, data.CommandTag.RowsAffected())
}

func TestSchoolAccessQueriesAreBoundedAndOverviewScopesAvoidCredentialsPostgres(t *testing.T) {
	pool, repo := openPaginationIntegrationRepository(t)
	seedSchoolAccessRows(t, pool)
	if _, ok := any(repo).(testedSchoolAccessStore); !ok {
		t.Fatal("bounded school access capability is missing")
	}
	ctx := context.Background()
	trace := &schoolAccessQueryTrace{}
	config := pool.Config()
	config.ConnConfig.Tracer = trace
	tracedPool, err := pgxpool.NewWithConfig(ctx, config)
	if err != nil {
		t.Fatal(err)
	}
	defer tracedPool.Close()
	store := any(&PostgresRepository{db: tracedPool}).(testedSchoolAccessStore)
	page, err := store.ListClassStudentCredentialPage(ctx, schoolAccessURN, schoolAccessClass, 12, "")
	if err != nil {
		t.Fatal(err)
	}
	if _, err := store.ListClassStudentCredentialPage(ctx, schoolAccessURN, schoolAccessClass, 12, page.NextCursor); err != nil {
		t.Fatal(err)
	}
	trace.Lock()
	counts := append([]int64{}, trace.rows...)
	trace.Unlock()
	for _, rows := range counts {
		if rows > 13 {
			t.Fatalf("page fetched %d rows before slicing; want at most limit+1", rows)
		}
	}
	// A broken credential table must not break overview or membership decisions.
	if _, err := pool.Exec(ctx, `ALTER TABLE student_credentials RENAME TO inaccessible_credentials`); err != nil {
		t.Fatal(err)
	}
	trace.Lock()
	trace.queries, trace.rows = nil, nil
	trace.Unlock()
	portal, err := store.SchoolOverview(ctx, schoolAccessURN)
	if err != nil || portal.School.URN != schoolAccessURN || len(portal.Classes) != 2 || len(portal.Groups) != 1 || portal.StudentCredentials == nil || len(portal.StudentCredentials) != 0 {
		t.Fatalf("lightweight school 501 overview: %+v %v", portal, err)
	}
	// The owned class/group/member must still authorize when more than 500
	// other classes precede it in the legacy portal ordering.
	if _, err := pool.Exec(ctx, `INSERT INTO classes(school_id,name,year_group)
		SELECT (SELECT id FROM schools WHERE urn=$1),'A prior class '||n,2 FROM generate_series(1,501) n`, schoolAccessURN); err != nil {
		t.Fatal(err)
	}
	trace.Lock()
	trace.rows = nil
	trace.Unlock()
	for _, tc := range []struct {
		name, id string
		check    func(context.Context, string, string) (bool, error)
	}{
		{"class", schoolAccessClass, store.ClassBelongsToSchool}, {"group", schoolAccessGroup, store.GroupBelongsToSchool}, {"student", "read-child-001", store.StudentBelongsToSchool},
	} {
		for _, urn := range []string{schoolAccessURN, "school-read-1", "", "missing-school"} {
			got, err := tc.check(ctx, urn, tc.id)
			if err != nil || got != (urn == schoolAccessURN) {
				t.Errorf("%s scope urn=%q got=%t err=%v", tc.name, urn, got, err)
			}
		}
		for _, id := range []string{"", "missing", "00000000-0000-0000-0000-000000000000"} {
			got, err := tc.check(ctx, schoolAccessURN, id)
			if err != nil || got {
				t.Errorf("%s missing target=%q got=%t err=%v", tc.name, id, got, err)
			}
		}
	}
	trace.Lock()
	defer trace.Unlock()
	for _, query := range trace.queries {
		if strings.Contains(query, "student_credentials") {
			t.Fatalf("overview/scope read credentials: %s", query)
		}
	}
	if len(trace.queries) == 0 {
		t.Fatal("no production queries traced")
	}
	for _, rows := range trace.rows {
		if rows > 1 {
			t.Fatalf("scope check loaded %d rows instead of bounded EXISTS", rows)
		}
	}
}

func TestSchoolCredentialCursorRejectsMalformedAndNoncanonicalPositions(t *testing.T) {
	raw := `{"v":1,"school_urn":"school-read-501","class_id":"10000000-0000-0000-0000-000000000001","student_id":"30000000-0000-0000-0000-000000000012"}`
	valid := base64.RawURLEncoding.EncodeToString([]byte(raw))
	if got, err := decodeSchoolCredentialCursor(valid, schoolAccessURN, schoolAccessClass); err != nil || got.StudentID != "30000000-0000-0000-0000-000000000012" {
		t.Fatalf("valid cursor: %+v %v", got, err)
	}
	for _, value := range []string{valid + "\n", "\r\n" + valid, valid + "=", base64.RawURLEncoding.EncodeToString([]byte(raw + `{}`)), base64.RawURLEncoding.EncodeToString([]byte(strings.Replace(raw, `"v":1`, `"v":2`, 1))), base64.RawURLEncoding.EncodeToString([]byte(strings.Replace(raw, `"student_id"`, `"unknown"`, 1)))} {
		if _, err := decodeSchoolCredentialCursor(value, schoolAccessURN, schoolAccessClass); !errors.Is(err, ErrInvalidConfiguration) {
			t.Errorf("malformed/noncanonical cursor accepted: %q err=%v", value, err)
		}
	}
}
