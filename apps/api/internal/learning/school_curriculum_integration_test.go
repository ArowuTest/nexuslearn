package learning

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"testing"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

func schoolCurriculumStore(t *testing.T, repo *PostgresRepository) SchoolCurriculumRepository {
	t.Helper()
	store, ok := any(repo).(SchoolCurriculumRepository)
	if !ok {
		t.Fatal("bounded school curriculum capability is missing")
	}
	return store
}

func TestSchoolCurriculumBoundedPagesPostgres(t *testing.T) {
	pool, repo := openPaginationIntegrationRepository(t)
	store := schoolCurriculumStore(t, repo)
	ctx := context.Background()
	if _, err := pool.Exec(ctx, `INSERT INTO curriculum_objectives(id,year_group,subject,strand,topic,statement,teacher_evidence)
	 SELECT 'catalogue-'||lpad(n::text,3,'0'),3,'Mathematics','Number','Fractions','catalogue-marker fraction','Observe explanation' FROM generate_series(1,53) n`); err != nil {
		t.Fatal(err)
	}
	// These relations must never be needed for a metadata-only catalogue page.
	for _, sql := range []string{
		`ALTER TABLE objective_prerequisites RENAME TO unavailable_prerequisites`,
		`ALTER TABLE objective_misconceptions RENAME TO unavailable_misconceptions`,
		`ALTER TABLE questions RENAME TO unavailable_questions`,
		`ALTER TABLE students RENAME TO unavailable_students`,
		`ALTER TABLE student_credentials RENAME TO unavailable_credentials`,
	} {
		if _, err := pool.Exec(ctx, sql); err != nil {
			t.Fatal(err)
		}
	}
	trace := &schoolAccessQueryTrace{}
	config := pool.Config()
	config.ConnConfig.Tracer = trace
	tracedPool, err := pgxpool.NewWithConfig(ctx, config)
	if err != nil {
		t.Fatal(err)
	}
	defer tracedPool.Close()
	store = schoolCurriculumStore(t, &PostgresRepository{db: tracedPool})
	query := SchoolCurriculumQuery{Year: 3, Subject: "Mathematics", Query: "catalogue-marker"}
	var before string
	snapshot := `SELECT jsonb_build_object('objectives',(SELECT jsonb_agg(to_jsonb(o) ORDER BY id) FROM curriculum_objectives o),'releases',(SELECT jsonb_agg(to_jsonb(r) ORDER BY id) FROM content_releases r),'audit',(SELECT count(*) FROM audit_logs))::text`
	if err := pool.QueryRow(ctx, snapshot).Scan(&before); err != nil {
		t.Fatal(err)
	}
	first, err := store.ListSchoolCurriculumObjectives(ctx, "school-a", query)
	if err != nil || len(first.Objectives) != 12 || first.NextCursor == "" || !first.HasMore || first.ReleaseID != "legacy" || first.Limit != 12 {
		t.Fatalf("first page: %+v err=%v", first, err)
	}
	var after string
	if err := pool.QueryRow(ctx, snapshot).Scan(&after); err != nil || before != after {
		t.Fatalf("catalogue mutated curriculum/release/audit: %v", err)
	}
	if _, err := pool.Exec(ctx, `UPDATE curriculum_objectives SET strand='ZZZ',topic='AAA',statement='Renamed catalogue-marker' WHERE id IN ('catalogue-001','catalogue-013')`); err != nil {
		t.Fatal(err)
	}
	page, count := first, 0
	for {
		for _, item := range page.Objectives {
			count++
			if item.ID != fmt.Sprintf("catalogue-%03d", count) {
				t.Fatalf("unstable or duplicate objective at %d: %+v", count, item)
			}
		}
		if page.NextCursor == "" {
			break
		}
		if count > 53 {
			t.Fatal("nonterminating catalogue")
		}
		query.Cursor = page.NextCursor
		page, err = store.ListSchoolCurriculumObjectives(ctx, "school-a", query)
		if err != nil || len(page.Objectives) == 0 || len(page.Objectives) > 12 || page.HasMore != (page.NextCursor != "") {
			t.Fatalf("continuation: %+v err=%v", page, err)
		}
	}
	if count != 53 || len(page.Objectives) != 5 || page.HasMore {
		t.Fatalf("lost rows: count=%d final=%+v", count, page)
	}
	trace.Lock()
	counts := append([]int64{}, trace.rows...)
	trace.Unlock()
	if len(counts) == 0 {
		t.Fatal("no query trace captured")
	}
	for _, rows := range counts {
		if rows > 13 {
			t.Fatalf("SQL fetched %d rows before slicing; want <= limit+1", rows)
		}
	}
	query.Cursor = ""
	for _, limit := range []int{1, 50} {
		query.Limit = limit
		page, err := store.ListSchoolCurriculumObjectives(ctx, "school-a", query)
		if err != nil || len(page.Objectives) != limit || !page.HasMore {
			t.Fatalf("limit=%d page=%+v err=%v", limit, page, err)
		}
	}
}

func TestSchoolCurriculumLiteralFiltersAndLegacyTransitionPostgres(t *testing.T) {
	pool, repo := openPaginationIntegrationRepository(t)
	store := schoolCurriculumStore(t, repo)
	ctx := context.Background()
	for _, sql := range []string{
		`INSERT INTO curriculum_objectives(id,year_group,subject,strand,topic,statement,teacher_evidence,content_release_id) VALUES
		 ('literal-001',3,'Mathematics','Number','Share','A 100% share','',''),
		 ('literal-002',3,'Mathematics','Number','under_score','A share','',''),
		 ('literal-003',3,'Mathematics','slash\back','Share','A share','',''),
		 ('literal-004',3,'Mathematics','Number','Share','literal-fraction numerator','','71000000-0000-0000-0000-000000000001'),
		 ('literal-005',3,'Science','Matter','LITERAL-FRACTION','A share','',''),
		 ('literal-006',3,'English','Literal-Fraction','Share','A share','',''),
		 ('literal-007',3,'English','Reading','Share','A share','literal-fraction',''),
		 ('literal-008',3,'History','literal-fraction','Share','A share','',''),
		 ('literal-009',4,'Mathematics','literal-fraction','Share','A share','',''),
		 ('literal-010',1,'English','literal-boundary','Share','A share','',''),
		 ('literal-011',7,'Science','literal-boundary','Share','A share','','')`,
		`INSERT INTO content_releases(id,schema_version,channel,manifest_sha256,expected_pack_count,expected_objective_count,expected_activity_count,expected_question_count,expected_reward_rule_count,status,applied_at)
		 VALUES('71000000-0000-0000-0000-000000000001','1','pilot','literal-pilot',1,1,0,0,0,'applied',now())`,
	} {
		if _, err := pool.Exec(ctx, sql); err != nil {
			t.Fatal(err)
		}
	}
	for _, tc := range []struct {
		year           int
		subject, query string
		ids            string
	}{
		{3, "", "%", "literal-001"}, {3, "", "_", "literal-002"}, {3, "", `\`, "literal-003"},
		{3, "", "  literal-FrAcTiOn  ", "literal-004,literal-005,literal-006"}, {3, "all", "literal-fraction", "literal-004,literal-005,literal-006"},
		{3, "Mathematics", "literal-fraction", "literal-004"}, {3, "Science", "literal-fraction", "literal-005"}, {3, "English", "literal-fraction", "literal-006"},
		{4, "Mathematics", "literal-fraction", "literal-009"}, {1, "", "literal-boundary", "literal-010"}, {7, "", "literal-boundary", "literal-011"},
		{3, "", "' OR true --", ""}, {3, "English", "does-not-exist", ""}, {3, "", "literal-001", ""},
	} {
		page, err := store.ListSchoolCurriculumObjectives(ctx, "school-a", SchoolCurriculumQuery{Year: tc.year, Subject: tc.subject, Query: tc.query})
		if err != nil {
			t.Fatal(err)
		}
		ids := []string{}
		for _, objective := range page.Objectives {
			ids = append(ids, objective.ID)
		}
		if strings.Join(ids, ",") != tc.ids || page.Objectives == nil || page.ReleaseID != "legacy" || page.HasMore || page.Query != strings.TrimSpace(tc.query) {
			t.Errorf("filter=%+v page=%+v", tc, page)
		}
	}
	query := SchoolCurriculumQuery{Year: 3, Query: "literal-fraction", Limit: 1}
	legacy, err := store.ListSchoolCurriculumObjectives(ctx, "school-a", query)
	if err != nil || legacy.NextCursor == "" {
		t.Fatalf("legacy continuation missing: %+v %v", legacy, err)
	}
	if _, err := pool.Exec(ctx, `UPDATE content_releases SET channel='live'`); err != nil {
		t.Fatal(err)
	}
	query.Cursor = legacy.NextCursor
	if _, err := store.ListSchoolCurriculumObjectives(ctx, "school-a", query); !errors.Is(err, ErrInvalidConfiguration) {
		t.Fatalf("legacy cursor survived live release: %v", err)
	}
	query.Cursor = ""
	active, err := store.ListSchoolCurriculumObjectives(ctx, "school-a", query)
	if err != nil || len(active.Objectives) != 1 || active.Objectives[0].ID != "literal-004" || active.ReleaseID != "71000000-0000-0000-0000-000000000001" || active.HasMore {
		t.Fatalf("active release did not exclude legacy: %+v %v", active, err)
	}
}

func TestSchoolCurriculumRejectsInvalidInputBeforeSQL(t *testing.T) {
	// A nil database makes any accidental catalogue/release query fail loudly.
	store := schoolCurriculumStore(t, &PostgresRepository{})
	for _, query := range []SchoolCurriculumQuery{
		{}, {Year: 8}, {Year: -1}, {Year: 3, Limit: -1}, {Year: 3, Limit: 51},
		{Year: 3, Subject: "maths"}, {Year: 3, Subject: "Mathematics "}, {Year: 3, Query: strings.Repeat("界", 121)}, {Year: 3, Query: "\x00"}, {Year: 3, Query: "\xff"},
		{Year: 3, Cursor: "bad"}, {Year: 3, Cursor: " "}, {Year: 3, Cursor: strings.Repeat("A", 2049)},
	} {
		if _, err := store.ListSchoolCurriculumObjectives(context.Background(), "school-a", query); !errors.Is(err, ErrInvalidConfiguration) {
			t.Errorf("invalid query accepted: %+v err=%v", query, err)
		}
	}
	if _, err := store.ListSchoolCurriculumObjectives(context.Background(), "", SchoolCurriculumQuery{Year: 3}); !errors.Is(err, ErrInvalidConfiguration) {
		t.Fatalf("blank school scope accepted: %v", err)
	}
}

func TestSchoolCurriculumCursorReleaseMismatchDoesNotQueryObjectivesPostgres(t *testing.T) {
	pool, repo := openPaginationIntegrationRepository(t)
	store := schoolCurriculumStore(t, repo)
	ctx := context.Background()
	// A syntactically valid, but stale, release binding must fail before the
	// catalogue query. It must still fail when that table cannot be queried.
	if _, err := pool.Exec(ctx, `ALTER TABLE curriculum_objectives RENAME TO unavailable_objectives`); err != nil {
		t.Fatal(err)
	}
	raw, err := json.Marshal(map[string]any{"v": 1, "school_urn": "school-a", "year": 3, "subject": "", "query": "", "release_id": "81000000-0000-0000-0000-000000000001", "objective_id": "objective-001"})
	if err != nil {
		t.Fatal(err)
	}
	_, err = store.ListSchoolCurriculumObjectives(ctx, "school-a", SchoolCurriculumQuery{Year: 3, Cursor: base64.RawURLEncoding.EncodeToString(raw)})
	if !errors.Is(err, ErrInvalidConfiguration) {
		t.Fatalf("stale cursor queried objectives or was accepted: %v", err)
	}
	// The same independently encoded JSON with the current binding is valid;
	// only now should it reach the deliberately unavailable catalogue table.
	raw = []byte(strings.Replace(string(raw), "81000000-0000-0000-0000-000000000001", "legacy", 1))
	_, err = store.ListSchoolCurriculumObjectives(ctx, "school-a", SchoolCurriculumQuery{Year: 3, Cursor: base64.RawURLEncoding.EncodeToString(raw)})
	if err == nil || errors.Is(err, ErrInvalidConfiguration) {
		t.Fatalf("valid cursor was rejected before SQL: %v", err)
	}
}

type schoolCurriculumReleaseSwapTrace struct {
	swap func() error
	err  error
}

func (s *schoolCurriculumReleaseSwapTrace) TraceQueryStart(ctx context.Context, _ *pgx.Conn, data pgx.TraceQueryStartData) context.Context {
	// Switch from a second connection exactly between release selection and
	// metadata retrieval, without sleeps, fixed schemas or timing assumptions.
	if s.swap != nil && strings.Contains(data.SQL, "FROM curriculum_objectives") {
		s.err = s.swap()
		s.swap = nil
	}
	return ctx
}

func (*schoolCurriculumReleaseSwapTrace) TraceQueryEnd(context.Context, *pgx.Conn, pgx.TraceQueryEndData) {
}

func TestSchoolCurriculumReleaseSnapshotPostgres(t *testing.T) {
	pool, _ := openPaginationIntegrationRepository(t)
	ctx := context.Background()
	for _, sql := range []string{
		`INSERT INTO content_releases(id,schema_version,channel,manifest_sha256,expected_pack_count,expected_objective_count,expected_activity_count,expected_question_count,expected_reward_rule_count,status,applied_at) VALUES
		 ('catalogue-release-old','1','live','snapshot-old',1,2,0,0,0,'applied','2025-01-01'),
		 ('catalogue-release-new','1','live','snapshot-new',1,2,0,0,0,'staged','2026-01-01')`,
		`INSERT INTO curriculum_objectives(id,year_group,subject,strand,topic,statement,content_release_id) VALUES
		 ('snapshot-001',3,'Mathematics','Number','Fraction','Old label','catalogue-release-old'),
		 ('snapshot-002',3,'Mathematics','Number','Fraction','Old label','catalogue-release-old')`,
	} {
		if _, err := pool.Exec(ctx, sql); err != nil {
			t.Fatal(err)
		}
	}
	trace := &schoolCurriculumReleaseSwapTrace{swap: func() error {
		_, err := pool.Exec(ctx, `
		 UPDATE content_releases SET status='superseded' WHERE id='catalogue-release-old';
		 UPDATE content_releases SET status='applied' WHERE id='catalogue-release-new';
		 UPDATE curriculum_objectives SET content_release_id='catalogue-release-new',statement='New label' WHERE id IN ('snapshot-001','snapshot-002');`)
		return err
	}}
	config := pool.Config()
	config.ConnConfig.Tracer = trace
	tracedPool, err := pgxpool.NewWithConfig(ctx, config)
	if err != nil {
		t.Fatal(err)
	}
	defer tracedPool.Close()
	store := schoolCurriculumStore(t, &PostgresRepository{db: tracedPool})
	query := SchoolCurriculumQuery{Year: 3, Subject: "Mathematics", Limit: 1}
	page, err := store.ListSchoolCurriculumObjectives(ctx, "school-a", query)
	if trace.swap != nil || trace.err != nil {
		t.Fatalf("release switch hook failed: %v", trace.err)
	}
	if err != nil || page.ReleaseID != "catalogue-release-old" || len(page.Objectives) != 1 || page.Objectives[0].Statement != "Old label" || !page.HasMore {
		t.Fatalf("mixed release snapshots: %+v err=%v", page, err)
	}
	query.Cursor = page.NextCursor
	if _, err := store.ListSchoolCurriculumObjectives(ctx, "school-a", query); !errors.Is(err, ErrInvalidConfiguration) {
		t.Fatalf("old release continuation survived switch: %v", err)
	}
	query.Cursor, query.Limit = "", 12
	page, err = store.ListSchoolCurriculumObjectives(ctx, "school-a", query)
	if err != nil || page.ReleaseID != "catalogue-release-new" || len(page.Objectives) != 2 || page.Objectives[0].Statement != "New label" || page.HasMore {
		t.Fatalf("fresh page missed switched release: %+v err=%v", page, err)
	}
}

func TestSchoolCurriculumReservedLegacyReleaseFailsClosedPostgres(t *testing.T) {
	pool, repo := openPaginationIntegrationRepository(t)
	ctx := context.Background()
	if _, err := pool.Exec(ctx, `
	 INSERT INTO content_releases(id,schema_version,channel,manifest_sha256,expected_pack_count,expected_objective_count,expected_activity_count,expected_question_count,expected_reward_rule_count,status,applied_at)
	 VALUES('legacy','1','live','reserved-legacy',1,1,0,0,0,'applied',now());
	 INSERT INTO curriculum_objectives(id,year_group,subject,strand,topic,statement,content_release_id)
	 VALUES('reserved-001',3,'Mathematics','Number','Fraction','Reserved release','legacy');`); err != nil {
		t.Fatal(err)
	}
	page, err := schoolCurriculumStore(t, repo).ListSchoolCurriculumObjectives(ctx, "school-a", SchoolCurriculumQuery{Year: 3})
	if err == nil || errors.Is(err, ErrInvalidConfiguration) {
		t.Fatalf("reserved active release masqueraded as legacy or blamed valid input: %+v err=%v", page, err)
	}
}
