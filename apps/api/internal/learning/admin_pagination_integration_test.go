package learning

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"reflect"
	"strings"
	"testing"
	"time"

	"github.com/ArowuTest/nexuslearn/apps/api/internal/database"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

const paginationIntegrationRows = 5000

func TestPostgresAdminLedgersTraverseStableSameTimestampPages(t *testing.T) {
	pool, repo := openPaginationIntegrationRepository(t)
	ctx, cancel := context.WithTimeout(context.Background(), 90*time.Second)
	defer cancel()
	createdAt := time.Date(2026, time.August, 18, 12, 0, 0, 123456000, time.UTC)
	seedAdminPaginationRows(t, ctx, pool, createdAt)

	t.Run("audit logs", func(t *testing.T) {
		firstIDs, firstCursors := traverseAuditLogPages(t, ctx, repo, 137)
		secondIDs, secondCursors := traverseAuditLogPages(t, ctx, repo, 137)
		assertStableCompleteTraversal(t, firstIDs, secondIDs, firstCursors, secondCursors)
		assertPaginationPlanUsesIndex(t, ctx, pool, `
			EXPLAIN (FORMAT JSON)
			SELECT id::text, action, entity_type, entity_id, payload, created_at
			FROM audit_logs
			WHERE ($1::timestamptz IS NULL OR (created_at, id) < ($1::timestamptz, $2::uuid))
			ORDER BY created_at DESC, id DESC
			LIMIT $3
		`, createdAt, paginationUUID(paginationIntegrationRows/2), 137, "audit_logs_created_id_idx")
	})

	t.Run("content versions", func(t *testing.T) {
		firstIDs, firstCursors := traverseContentVersionPages(t, ctx, repo, 137)
		secondIDs, secondCursors := traverseContentVersionPages(t, ctx, repo, 137)
		assertStableCompleteTraversal(t, firstIDs, secondIDs, firstCursors, secondCursors)
		assertPaginationPlanUsesIndex(t, ctx, pool, `
			EXPLAIN (FORMAT JSON)
			SELECT id::text, content_key, content_type, status, version, payload, created_at, published_at
			FROM content_versions
			WHERE ($1::timestamptz IS NULL OR (created_at, id) < ($1::timestamptz, $2::uuid))
			ORDER BY created_at DESC, id DESC
			LIMIT $3
		`, createdAt, paginationUUID(paginationIntegrationRows/2), 137, "content_versions_created_id_idx")
	})

	t.Run("content releases", func(t *testing.T) {
		firstPage, err := repo.ListContentReleasePage(ctx, AdminPageQuery{Limit: 137})
		if err != nil {
			t.Fatal(err)
		}
		if !firstPage.LiveApplied {
			t.Fatal("live_applied must remain true when the active live release is beyond the first history page")
		}
		for _, release := range firstPage.ContentReleases {
			if release.ID == "release-00001" {
				t.Fatal("test fixture error: active live release unexpectedly appeared on the first page")
			}
		}
		active, found, err := repo.ActiveContentRelease(ctx, "live")
		if err != nil || !found || active.ID != "release-00001" {
			t.Fatalf("active live lookup did not return the release beyond history: found=%v release=%#v err=%v", found, active, err)
		}
		firstIDs, firstCursors := traverseContentReleasePages(t, ctx, repo, 137)
		secondIDs, secondCursors := traverseContentReleasePages(t, ctx, repo, 137)
		assertStableCompleteTraversal(t, firstIDs, secondIDs, firstCursors, secondCursors)
		assertPaginationPlanUsesIndex(t, ctx, pool, `
			EXPLAIN (FORMAT JSON)
			SELECT r.id,r.schema_version,r.channel,r.source_revision,r.manifest_sha256,r.complete_snapshot,
			       r.expected_pack_count,r.expected_objective_count,r.expected_activity_count,
			       r.expected_question_count,r.expected_reward_rule_count,r.status,r.packs,r.metadata,
			       r.created_at,r.updated_at,r.applied_at,
			       (SELECT count(*) FROM content_release_chunks c WHERE c.release_id=r.id)
			FROM content_releases r
			WHERE ($1::timestamptz IS NULL OR (r.created_at, r.id) < ($1::timestamptz, $2::text))
			ORDER BY r.created_at DESC, r.id DESC
			LIMIT $3
		`, createdAt, fmt.Sprintf("release-%05d", paginationIntegrationRows/2), 137, "content_releases_created_id_idx")
	})
}

func TestPostgresAdminDirectoryPagesStayBoundedAndStable(t *testing.T) {
	pool, repo := openPaginationIntegrationRepository(t)
	ctx, cancel := context.WithTimeout(context.Background(), 90*time.Second)
	defer cancel()
	seedAdminDirectoryRows(t, ctx, pool)

	studentIDs, studentCursors := traverseStudentDirectoryPages(t, ctx, repo, 137)
	assertStableDirectoryTraversal(t, studentIDs, studentCursors)
	credentialIDs, credentialCursors := traverseStudentCredentialPages(t, ctx, repo, 137)
	assertStableDirectoryTraversal(t, credentialIDs, credentialCursors)

	var plan []byte
	if err := pool.QueryRow(ctx, `
		EXPLAIN (FORMAT JSON)
		SELECT id::text, external_ref, display_name, year_group, created_at, updated_at
		FROM students
		WHERE ($1::int = 0 OR (year_group, display_name, external_ref) > ($1::int, $2::text, $3::text))
		ORDER BY year_group, display_name, external_ref
		LIMIT $4
	`, 3, "Learner 02500", "directory-02500", 137).Scan(&plan); err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(string(plan), "students_directory_order_idx") {
		t.Fatalf("directory pagination query plan does not use the bounded ordering index: %s", plan)
	}
}

func TestPostgresAdminOrganisationDirectoryPagesStayBoundedAndStable(t *testing.T) {
	pool, repo := openPaginationIntegrationRepository(t)
	ctx, cancel := context.WithTimeout(context.Background(), 90*time.Second)
	defer cancel()
	seedAdminOrganisationRows(t, ctx, pool)

	schoolIDs, schoolCursors := traverseSchoolPages(t, ctx, repo, 137)
	secondSchoolIDs, secondSchoolCursors := traverseSchoolPages(t, ctx, repo, 137)
	assertStableOrganisationTraversal(t, schoolIDs, secondSchoolIDs, schoolCursors, secondSchoolCursors, paginationOrganisationRows)
	userIDs, userCursors := traverseSchoolUserPages(t, ctx, repo, 137)
	secondUserIDs, secondUserCursors := traverseSchoolUserPages(t, ctx, repo, 137)
	assertStableOrganisationTraversal(t, userIDs, secondUserIDs, userCursors, secondUserCursors, paginationOrganisationRows)
	classIDs, classCursors := traverseClassPages(t, ctx, repo, 137)
	secondClassIDs, secondClassCursors := traverseClassPages(t, ctx, repo, 137)
	assertStableOrganisationTraversal(t, classIDs, secondClassIDs, classCursors, secondClassCursors, paginationOrganisationRows)

	var plan []byte
	if err := pool.QueryRow(ctx, `
		EXPLAIN (FORMAT JSON)
		SELECT id::text, name, COALESCE(urn,''), status, created_at, updated_at
		FROM schools
		WHERE (name, COALESCE(urn,''), id::text) > ($1::text, $2::text, $3::text)
		ORDER BY name, COALESCE(urn,''), id::text
		LIMIT $4
	`, "Organisation School 00500", "organisation-00500", schoolIDs[len(schoolIDs)/2], 137).Scan(&plan); err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(string(plan), "schools_directory_order_idx") {
		t.Fatalf("organisation school pagination query plan does not use the bounded ordering index: %s", plan)
	}
}

func TestPostgresAdminGroupDirectoryPagesStayBoundedAndStable(t *testing.T) {
	pool, repo := openPaginationIntegrationRepository(t)
	ctx, cancel := context.WithTimeout(context.Background(), 90*time.Second)
	defer cancel()
	seedAdminGroupRows(t, ctx, pool)

	firstIDs, firstCursors := traverseGroupPages(t, ctx, repo, 137)
	secondIDs, secondCursors := traverseGroupPages(t, ctx, repo, 137)
	assertStableOrganisationTraversal(t, firstIDs, secondIDs, firstCursors, secondCursors, paginationGroupRows)
}

const paginationOrganisationRows = 1000
const paginationGroupRows = 1000

func seedAdminGroupRows(t *testing.T, ctx context.Context, pool *pgxpool.Pool) {
	t.Helper()
	if _, err := pool.Exec(ctx, `
		INSERT INTO classes (name, year_group)
		SELECT 'Group Class ' || lpad(n::text, 5, '0'), ((n - 1) % 7) + 1
		FROM generate_series(1, $1) AS n
	`, paginationGroupRows); err != nil {
		t.Fatal(err)
	}
	if _, err := pool.Exec(ctx, `
		INSERT INTO learning_groups (class_id, name, purpose)
		SELECT c.id, 'Learning Group ' || right(c.name, 5), CASE WHEN c.year_group % 2 = 0 THEN 'challenge' ELSE 'intervention' END
		FROM classes c
		WHERE c.name LIKE 'Group Class %'
	`); err != nil {
		t.Fatal(err)
	}
	if _, err := pool.Exec(ctx, "ANALYZE classes; ANALYZE learning_groups; ANALYZE learning_group_students"); err != nil {
		t.Fatal(err)
	}
}

func seedAdminOrganisationRows(t *testing.T, ctx context.Context, pool *pgxpool.Pool) {
	t.Helper()
	if _, err := pool.Exec(ctx, `
		INSERT INTO schools (name, urn, status)
		SELECT 'Organisation School ' || lpad(n::text, 5, '0'),
		       'organisation-' || lpad(n::text, 5, '0'), 'active'
		FROM generate_series(1, $1) AS n
	`, paginationOrganisationRows); err != nil {
		t.Fatal(err)
	}
	if _, err := pool.Exec(ctx, `
		INSERT INTO app_users (email, display_name, user_type, status, login_id, password_hash, temporary_password_required)
		SELECT 'organisation-teacher-' || lpad(n::text, 5, '0') || '@example.test',
		       'Organisation Teacher ' || lpad(n::text, 5, '0'), 'teacher', 'active',
		       'organisation-teacher-' || lpad(n::text, 5, '0'), '', true
		FROM generate_series(1, $1) AS n
	`, paginationOrganisationRows); err != nil {
		t.Fatal(err)
	}
	if _, err := pool.Exec(ctx, `
		INSERT INTO school_users (school_id, user_id, role)
		SELECT s.id, u.id, 'teacher'
		FROM schools s
		JOIN app_users u ON u.email = 'organisation-teacher-' || right(s.urn, 5) || '@example.test'
		WHERE s.urn LIKE 'organisation-%'
	`); err != nil {
		t.Fatal(err)
	}
	if _, err := pool.Exec(ctx, `
		INSERT INTO classes (school_id, name, year_group)
		SELECT s.id, 'Class Blue', ((right(s.urn, 5)::int - 1) % 7) + 1
		FROM schools s
		WHERE s.urn LIKE 'organisation-%'
	`); err != nil {
		t.Fatal(err)
	}
	if _, err := pool.Exec(ctx, "ANALYZE schools; ANALYZE app_users; ANALYZE school_users; ANALYZE classes"); err != nil {
		t.Fatal(err)
	}
}

func traverseSchoolPages(t *testing.T, ctx context.Context, repo *PostgresRepository, limit int) ([]string, []string) {
	t.Helper()
	ids, cursors := []string{}, []string{}
	query := AdminOrganisationPageQuery{Limit: limit}
	for {
		page, err := repo.ListSchoolPage(ctx, query)
		if err != nil {
			t.Fatal(err)
		}
		for _, item := range page.Schools {
			ids = append(ids, item.ID)
		}
		cursors = append(cursors, page.NextCursor)
		if page.NextCursor == "" {
			return ids, cursors
		}
		query.Cursor = page.NextCursor
	}
}

func traverseSchoolUserPages(t *testing.T, ctx context.Context, repo *PostgresRepository, limit int) ([]string, []string) {
	t.Helper()
	ids, cursors := []string{}, []string{}
	query := AdminOrganisationPageQuery{Limit: limit}
	for {
		page, err := repo.ListSchoolUserPage(ctx, query)
		if err != nil {
			t.Fatal(err)
		}
		for _, item := range page.SchoolUsers {
			ids = append(ids, item.ID)
		}
		cursors = append(cursors, page.NextCursor)
		if page.NextCursor == "" {
			return ids, cursors
		}
		query.Cursor = page.NextCursor
	}
}

func traverseClassPages(t *testing.T, ctx context.Context, repo *PostgresRepository, limit int) ([]string, []string) {
	t.Helper()
	ids, cursors := []string{}, []string{}
	query := AdminOrganisationPageQuery{Limit: limit}
	for {
		page, err := repo.ListClassPage(ctx, query)
		if err != nil {
			t.Fatal(err)
		}
		for _, item := range page.Classes {
			ids = append(ids, item.ID)
		}
		cursors = append(cursors, page.NextCursor)
		if page.NextCursor == "" {
			return ids, cursors
		}
		query.Cursor = page.NextCursor
	}
}

func traverseGroupPages(t *testing.T, ctx context.Context, repo *PostgresRepository, limit int) ([]string, []string) {
	t.Helper()
	ids, cursors := []string{}, []string{}
	query := AdminGroupPageQuery{Limit: limit}
	for {
		page, err := repo.ListGroupPage(ctx, query)
		if err != nil {
			t.Fatal(err)
		}
		for _, item := range page.Groups {
			ids = append(ids, item.ID)
		}
		cursors = append(cursors, page.NextCursor)
		if page.NextCursor == "" {
			return ids, cursors
		}
		query.Cursor = page.NextCursor
	}
}

func assertStableOrganisationTraversal(t *testing.T, firstIDs, secondIDs, firstCursors, secondCursors []string, wantRows int) {
	t.Helper()
	if len(firstIDs) != wantRows {
		t.Fatalf("organisation pagination omitted rows: got %d want %d", len(firstIDs), wantRows)
	}
	seen := make(map[string]struct{}, len(firstIDs))
	for _, id := range firstIDs {
		if _, duplicate := seen[id]; duplicate {
			t.Fatalf("organisation pagination returned duplicate id %q", id)
		}
		seen[id] = struct{}{}
	}
	if !reflect.DeepEqual(firstIDs, secondIDs) {
		t.Fatal("repeated organisation traversal returned a different row sequence")
	}
	if !reflect.DeepEqual(firstCursors, secondCursors) {
		t.Fatal("repeated organisation traversal returned unstable page cursors")
	}
	if len(firstCursors) < 2 || firstCursors[len(firstCursors)-1] != "" {
		t.Fatalf("organisation pagination did not end with an empty cursor: %v", firstCursors)
	}
}

func seedAdminDirectoryRows(t *testing.T, ctx context.Context, pool *pgxpool.Pool) {
	t.Helper()
	if _, err := pool.Exec(ctx, `
		INSERT INTO students (external_ref, display_name, year_group)
		SELECT 'directory-' || lpad(n::text, 5, '0'), 'Learner ' || lpad(n::text, 5, '0'), ((n - 1) % 7) + 1
		FROM generate_series(1, $1) AS n
	`, paginationIntegrationRows); err != nil {
		t.Fatal(err)
	}
	if _, err := pool.Exec(ctx, `
		INSERT INTO student_credentials (student_id, login_code, picture_password)
		SELECT id, 'LOGIN-' || external_ref, '["star","book","sun"]'::jsonb
		FROM students
		WHERE external_ref LIKE 'directory-%'
	`); err != nil {
		t.Fatal(err)
	}
	if _, err := pool.Exec(ctx, "ANALYZE students; ANALYZE student_credentials"); err != nil {
		t.Fatal(err)
	}
}

func traverseStudentDirectoryPages(t *testing.T, ctx context.Context, repo *PostgresRepository, limit int) ([]string, []string) {
	t.Helper()
	ids, cursors := []string{}, []string{}
	query := AdminDirectoryPageQuery{Limit: limit}
	for {
		page, err := repo.ListStudentPage(ctx, query)
		if err != nil {
			t.Fatal(err)
		}
		for _, item := range page.Students {
			ids = append(ids, item.ExternalRef)
		}
		cursors = append(cursors, page.NextCursor)
		if page.NextCursor == "" {
			return ids, cursors
		}
		query.Cursor = page.NextCursor
	}
}

func traverseStudentCredentialPages(t *testing.T, ctx context.Context, repo *PostgresRepository, limit int) ([]string, []string) {
	t.Helper()
	ids, cursors := []string{}, []string{}
	query := AdminDirectoryPageQuery{Limit: limit}
	for {
		page, err := repo.ListStudentCredentialPage(ctx, query)
		if err != nil {
			t.Fatal(err)
		}
		for _, item := range page.StudentCredentials {
			ids = append(ids, item.StudentExternalRef)
		}
		cursors = append(cursors, page.NextCursor)
		if page.NextCursor == "" {
			return ids, cursors
		}
		query.Cursor = page.NextCursor
	}
}

func assertStableDirectoryTraversal(t *testing.T, ids, cursors []string) {
	t.Helper()
	if len(ids) != paginationIntegrationRows {
		t.Fatalf("directory pagination omitted rows: got %d want %d", len(ids), paginationIntegrationRows)
	}
	seen := make(map[string]struct{}, len(ids))
	for _, id := range ids {
		if _, duplicate := seen[id]; duplicate {
			t.Fatalf("directory pagination returned duplicate id %q", id)
		}
		seen[id] = struct{}{}
	}
	if len(cursors) < 2 || cursors[len(cursors)-1] != "" {
		t.Fatalf("directory pagination did not end with an empty cursor: %v", cursors)
	}
}

func openPaginationIntegrationRepository(t *testing.T) (*pgxpool.Pool, *PostgresRepository) {
	t.Helper()
	dsn := strings.TrimSpace(os.Getenv("TEST_DATABASE_URL"))
	if dsn == "" {
		dsn = strings.TrimSpace(os.Getenv("DATABASE_URL"))
	}
	if dsn == "" {
		t.Skip("PostgreSQL integration test skipped: set TEST_DATABASE_URL or DATABASE_URL; CI supplies PostgreSQL")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 90*time.Second)
	t.Cleanup(cancel)
	adminPool, err := pgxpool.New(ctx, dsn)
	if err != nil {
		t.Fatal(err)
	}
	schema := fmt.Sprintf("admin_pagination_%d", time.Now().UnixNano())
	identifier := pgx.Identifier{schema}.Sanitize()
	if _, err := adminPool.Exec(ctx, "CREATE SCHEMA "+identifier); err != nil {
		adminPool.Close()
		t.Fatal(err)
	}
	config, err := pgxpool.ParseConfig(dsn)
	if err != nil {
		adminPool.Close()
		t.Fatal(err)
	}
	config.ConnConfig.RuntimeParams["search_path"] = schema
	// RuntimeParams are applied during startup, but the pool may create
	// additional connections after migrations begin. Re-assert the isolated
	// schema on every connection so integration queries cannot fall through to
	// a stale public/default relation.
	config.AfterConnect = func(ctx context.Context, conn *pgx.Conn) error {
		_, err := conn.Exec(ctx, "SET search_path TO "+identifier)
		return err
	}
	pool, err := pgxpool.NewWithConfig(ctx, config)
	if err != nil {
		adminPool.Close()
		t.Fatal(err)
	}
	t.Cleanup(func() {
		pool.Close()
		dropCtx, dropCancel := context.WithTimeout(context.Background(), 30*time.Second)
		defer dropCancel()
		_, _ = adminPool.Exec(dropCtx, "DROP SCHEMA "+identifier+" CASCADE")
		adminPool.Close()
	})
	if err := database.RunMigrations(ctx, pool, filepath.Join("..", "..", "migrations")); err != nil {
		t.Fatal(err)
	}
	return pool, &PostgresRepository{db: pool}
}

func seedAdminPaginationRows(t *testing.T, ctx context.Context, pool *pgxpool.Pool, createdAt time.Time) {
	t.Helper()
	if _, err := pool.Exec(ctx, `
		INSERT INTO audit_logs (id, action, entity_type, entity_id, payload, created_at)
		SELECT ('00000000-0000-0000-0000-' || lpad(to_hex(n), 12, '0'))::uuid,
		       'pagination-test', 'integration', n::text, '{}'::jsonb, $1
		FROM generate_series(1, $2) AS n
	`, createdAt, paginationIntegrationRows); err != nil {
		t.Fatal(err)
	}
	if _, err := pool.Exec(ctx, `
		INSERT INTO content_versions (id, content_key, content_type, status, version, payload, created_at)
		SELECT ('00000000-0000-0000-0000-' || lpad(to_hex(n), 12, '0'))::uuid,
		       'pagination-content-' || n::text, 'activity', 'draft', 1, '{}'::jsonb, $1
		FROM generate_series(1, $2) AS n
	`, createdAt, paginationIntegrationRows); err != nil {
		t.Fatal(err)
	}
	if _, err := pool.Exec(ctx, `
		INSERT INTO content_releases (
			id, schema_version, channel, source_revision, manifest_sha256, complete_snapshot,
			expected_pack_count, expected_objective_count, expected_activity_count,
			expected_question_count, expected_reward_rule_count, status, packs, metadata,
			created_at, updated_at
		)
		SELECT 'release-' || lpad(n::text, 5, '0'), '1.0', 'review', 'pagination-test',
		       lpad(to_hex(n), 64, '0'), true, 1, 0, 0, 0, 0, 'staged', '[]'::jsonb, '{}'::jsonb, $1, $1
		FROM generate_series(1, $2) AS n
	`, createdAt, paginationIntegrationRows); err != nil {
		t.Fatal(err)
	}
	if _, err := pool.Exec(ctx, `
		UPDATE content_releases
		SET channel='live', status='applied', applied_at=$1
		WHERE id='release-00001'
	`, createdAt); err != nil {
		t.Fatal(err)
	}
	if _, err := pool.Exec(ctx, "ANALYZE audit_logs; ANALYZE content_versions; ANALYZE content_releases"); err != nil {
		t.Fatal(err)
	}
}

func traverseAuditLogPages(t *testing.T, ctx context.Context, repo *PostgresRepository, limit int) ([]string, []string) {
	t.Helper()
	ids, cursors := []string{}, []string{}
	query := AdminPageQuery{Limit: limit}
	for {
		page, err := repo.ListAuditLogPage(ctx, query)
		if err != nil {
			t.Fatal(err)
		}
		for _, item := range page.AuditLogs {
			ids = append(ids, item.ID)
		}
		cursors = append(cursors, page.NextCursor)
		if page.NextCursor == "" {
			return ids, cursors
		}
		query.BeforeCreatedAt, query.BeforeID, err = DecodeAdminCursor(page.NextCursor)
		if err != nil {
			t.Fatal(err)
		}
	}
}

func traverseContentVersionPages(t *testing.T, ctx context.Context, repo *PostgresRepository, limit int) ([]string, []string) {
	t.Helper()
	ids, cursors := []string{}, []string{}
	query := AdminPageQuery{Limit: limit}
	for {
		page, err := repo.ListContentVersionPage(ctx, query)
		if err != nil {
			t.Fatal(err)
		}
		for _, item := range page.ContentVersions {
			ids = append(ids, item.ID)
		}
		cursors = append(cursors, page.NextCursor)
		if page.NextCursor == "" {
			return ids, cursors
		}
		query.BeforeCreatedAt, query.BeforeID, err = DecodeAdminCursor(page.NextCursor)
		if err != nil {
			t.Fatal(err)
		}
	}
}

func traverseContentReleasePages(t *testing.T, ctx context.Context, repo *PostgresRepository, limit int) ([]string, []string) {
	t.Helper()
	ids, cursors := []string{}, []string{}
	query := AdminPageQuery{Limit: limit}
	for {
		page, err := repo.ListContentReleasePage(ctx, query)
		if err != nil {
			t.Fatal(err)
		}
		if !page.LiveApplied {
			t.Fatal("live_applied changed across release history pages")
		}
		for _, item := range page.ContentReleases {
			ids = append(ids, item.ID)
		}
		cursors = append(cursors, page.NextCursor)
		if page.NextCursor == "" {
			return ids, cursors
		}
		query.BeforeCreatedAt, query.BeforeID, err = DecodeAdminCursor(page.NextCursor)
		if err != nil {
			t.Fatal(err)
		}
	}
}

func assertStableCompleteTraversal(t *testing.T, firstIDs, secondIDs, firstCursors, secondCursors []string) {
	t.Helper()
	if len(firstIDs) != paginationIntegrationRows {
		t.Fatalf("pagination omitted rows: got %d want %d", len(firstIDs), paginationIntegrationRows)
	}
	seen := make(map[string]struct{}, len(firstIDs))
	for _, id := range firstIDs {
		if _, duplicate := seen[id]; duplicate {
			t.Fatalf("pagination returned duplicate id %q", id)
		}
		seen[id] = struct{}{}
	}
	if !reflect.DeepEqual(firstIDs, secondIDs) {
		t.Fatal("repeated traversal returned a different row sequence")
	}
	if !reflect.DeepEqual(firstCursors, secondCursors) {
		t.Fatal("repeated traversal returned unstable page cursors")
	}
	if len(firstCursors) < 2 || firstCursors[len(firstCursors)-1] != "" {
		t.Fatalf("terminal page cursor is not stable and empty: %v", firstCursors)
	}
}

func assertPaginationPlanUsesIndex(t *testing.T, ctx context.Context, pool *pgxpool.Pool, sql string, createdAt time.Time, id any, limit int, indexName string) {
	t.Helper()
	var plan []byte
	if err := pool.QueryRow(ctx, sql, createdAt, id, limit).Scan(&plan); err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(string(plan), indexName) {
		t.Fatalf("pagination query plan does not use %s at representative volume: %s", indexName, plan)
	}
}

func paginationUUID(value int) string {
	return fmt.Sprintf("00000000-0000-0000-0000-%012x", value)
}
