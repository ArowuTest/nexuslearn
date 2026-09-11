package learning

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"strings"
	"testing"

	"github.com/jackc/pgx/v5/pgxpool"
)

func TestSchoolDirectoryClassRefValidation(t *testing.T) {
	const id = "21000000-0000-0000-0000-000000000001"
	q, err := PrepareSchoolDirectoryQuery("directory-a", SchoolDirectoryQuery{Kind: "classes", Ref: id})
	if err != nil || q.Ref != id || q.Limit != 20 {
		t.Fatalf("owned class ID lookup must be valid: %+v %v", q, err)
	}
	for _, q := range []SchoolDirectoryQuery{{Kind: "classes", Ref: "bad"}, {Kind: "classes", Ref: id, Search: "x"}, {Kind: "classes", Ref: id, Cursor: "x"}, {Kind: "groups", Ref: id}} {
		if _, err := PrepareSchoolDirectoryQuery("directory-a", q); !errors.Is(err, ErrInvalidConfiguration) {
			t.Errorf("invalid ref query accepted: %+v %v", q, err)
		}
	}
}

func TestSchoolDirectoryClassRefReportsUnsetYearPostgres(t *testing.T) {
	pool, repo := openPaginationIntegrationRepository(t)
	ctx := context.Background()
	if _, err := pool.Exec(ctx, `INSERT INTO schools(urn,name) VALUES('missing-year','Missing year'); INSERT INTO classes(id,school_id,name) SELECT '23000000-0000-0000-0000-000000000001',id,'Persisted class' FROM schools WHERE urn='missing-year'`); err != nil {
		t.Fatal(err)
	}
	page, err := repo.ListSchoolDirectory(ctx, "missing-year", SchoolDirectoryQuery{Kind: "classes", Ref: "23000000-0000-0000-0000-000000000001"})
	if err != nil || len(page.Items) != 1 {
		t.Fatalf("nullable legacy class year must not reject the school: %+v err=%v", page, err)
	}
	if item := page.Items[0].(SchoolDirectoryClass); item.YearGroup != 0 || item.Name != "Persisted class" {
		t.Fatalf("NULL year must be the explicit unset sentinel, never an invented teaching year: %+v", item)
	}
	overview, err := repo.SchoolDirectoryOverview(ctx, "missing-year")
	if err != nil || len(overview.Classes) != 1 || overview.Classes[0].YearGroup != 0 {
		t.Fatalf("nullable class broke bounded overview: %+v %v", overview, err)
	}
}

func TestSchoolDirectoryQueryValidationBeforeSQL(t *testing.T) {
	store, ok := any(&PostgresRepository{}).(SchoolDirectoryRepository)
	if !ok {
		t.Fatal("school directory repository capability missing")
	}
	raw := `{"v":1,"school_urn":"directory-a","kind":"students","search":"","ref":"","id":"41000000-0000-0000-0000-000000000001","class_id":""}`
	valid := base64.RawURLEncoding.EncodeToString([]byte(raw))
	for _, q := range []SchoolDirectoryQuery{{}, {Kind: "students", Limit: -1}, {Kind: "students", Limit: 51}, {Kind: "students", Search: strings.Repeat("界", 101)}, {Kind: "students", Search: "\x00"}, {Kind: "students", Ref: strings.Repeat("界", 67)}, {Kind: "students", Ref: "x", Search: "y"}, {Kind: "classes", Ref: "invalid"}, {Kind: "groups", Ref: "x"}, {Kind: "students", Cursor: valid + "="}, {Kind: "students", Cursor: valid + "\n"}, {Kind: "students", Cursor: strings.Repeat("A", 2049)}, {Kind: "classes", Cursor: valid}, {Kind: "students", Search: "x", Cursor: valid}, {Kind: "students", Cursor: base64.RawURLEncoding.EncodeToString([]byte(strings.Replace(raw, "directory-a", "directory-b", 1)))}} {
		if _, err := store.ListSchoolDirectory(context.Background(), "directory-a", q); !errors.Is(err, ErrInvalidConfiguration) {
			t.Errorf("invalid query reached SQL: %+v %v", q, err)
		}
	}
}

func TestSchoolDirectoryBoundedQueriesPostgres(t *testing.T) {
	pool, repo := openPaginationIntegrationRepository(t)
	store, ok := any(repo).(SchoolDirectoryRepository)
	if !ok {
		t.Fatal("school directory repository capability missing")
	}
	ctx := context.Background()
	for _, sql := range []string{
		`INSERT INTO schools(urn,name,status) VALUES('directory-scale','Scale','active')`,
		`INSERT INTO classes(id,school_id,name,year_group) SELECT ('22000000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid,(SELECT id FROM schools WHERE urn='directory-scale'),'Scale '||n,3 FROM generate_series(1,1200) n`,
		`INSERT INTO learning_groups(id,class_id,name) SELECT ('32000000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid,('22000000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid,'Repeated group name' FROM generate_series(1,1200) n`,
		`INSERT INTO students(id,external_ref,display_name,year_group) SELECT ('42000000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid,'scale-'||lpad(n::text,4,'0'),'Same name',3 FROM generate_series(1,2500) n`,
		`INSERT INTO class_students(class_id,student_id) SELECT '22000000-0000-0000-0000-000000000001',id FROM students WHERE external_ref LIKE 'scale-%'`,
		`INSERT INTO learning_group_students(group_id,student_id) SELECT '32000000-0000-0000-0000-000000000001',id FROM students WHERE external_ref LIKE 'scale-%'`,
		`ANALYZE classes`, `ANALYZE learning_groups`, `ANALYZE class_students`, `ANALYZE students`,
	} {
		if _, err := pool.Exec(ctx, sql); err != nil {
			t.Fatal(err)
		}
	}
	trace := &schoolAccessQueryTrace{}
	config := pool.Config()
	config.ConnConfig.Tracer = trace
	traced, err := pgxpool.NewWithConfig(ctx, config)
	if err != nil {
		t.Fatal(err)
	}
	defer traced.Close()
	store = any(&PostgresRepository{db: traced}).(SchoolDirectoryRepository)
	overview, err := store.SchoolDirectoryOverview(ctx, "directory-scale")
	if err != nil {
		t.Fatal(err)
	}
	if overview.Directory.Counts != (SchoolDirectoryCounts{Classes: 1200, Groups: 1200, Students: 2500}) || len(overview.Classes) != 20 || len(overview.Groups) != 20 || len(overview.Students) != 20 {
		t.Fatalf("counts depend on loaded page: %+v", overview.Directory)
	}
	trace.Lock()
	for _, count := range trace.rows {
		if count > 21 {
			t.Fatalf("overview hydrated %d SQL rows", count)
		}
	}
	if len(trace.queries) > 8 {
		t.Fatalf("overview per-item queries: %d", len(trace.queries))
	}
	for _, sql := range trace.queries {
		if strings.Contains(sql, "student_credentials") || strings.Contains(sql, "app_users") {
			t.Fatal("overview loaded private directory")
		}
	}
	trace.Unlock()
	for _, kind := range []string{"classes", "groups", "students"} {
		trace.Lock()
		trace.queries = nil
		trace.rows = nil
		trace.Unlock()
		page, err := store.ListSchoolDirectory(ctx, "directory-scale", SchoolDirectoryQuery{Kind: kind, Limit: 20})
		if err != nil {
			t.Fatal(err)
		}
		if len(page.Items) != 20 || page.NextCursor == "" {
			t.Fatalf("unbounded first %s page", kind)
		}
		trace.Lock()
		if len(trace.queries) != 1 || len(trace.rows) != 1 || trace.rows[0] != 21 {
			t.Fatalf("%s must issue one limit+1 query: rows=%v queries=%d", kind, trace.rows, len(trace.queries))
		}
		trace.Unlock()
		page, err = store.ListSchoolDirectory(ctx, "directory-scale", SchoolDirectoryQuery{Kind: kind, Limit: 20, Cursor: page.NextCursor})
		if err != nil || len(page.Items) != 20 {
			t.Fatalf("continuation %s: %v", kind, err)
		}
		q, c, err := prepareSchoolDirectoryQuery("directory-scale", SchoolDirectoryQuery{Kind: kind, Limit: 20, Cursor: page.NextCursor})
		if err != nil {
			t.Fatal(err)
		}
		sql, args := schoolDirectorySQL("directory-scale", q, c)
		var raw []byte
		if err := pool.QueryRow(ctx, "EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) "+sql, args...).Scan(&raw); err != nil {
			t.Fatal(err)
		}
		var plans []map[string]any
		if err := json.Unmarshal(raw, &plans); err != nil {
			t.Fatal(err)
		}
		t.Logf("%s continuation execution_ms=%v", kind, plans[0]["Execution Time"])
		var describe func(map[string]any, string)
		describe = func(node map[string]any, indent string) {
			t.Logf("%s%s rows=%v loops=%v index=%v", indent, node["Node Type"], node["Actual Rows"], node["Actual Loops"], node["Index Name"])
			if children, ok := node["Plans"].([]any); ok {
				for _, child := range children {
					describe(child.(map[string]any), indent+"  ")
				}
			}
		}
		describe(plans[0]["Plan"].(map[string]any), "")
		if kind != "students" {
			var check func(map[string]any, bool)
			check = func(node map[string]any, limited bool) {
				if limited && node["Node Type"] == "Sort" {
					t.Errorf("%s continuation sorts candidates before LIMIT; scoped keyset index required", kind)
				}
				if children, ok := node["Plans"].([]any); ok {
					for _, child := range children {
						check(child.(map[string]any), limited || node["Node Type"] == "Limit")
					}
				}
			}
			check(plans[0]["Plan"].(map[string]any), false)
		}
	}
}
