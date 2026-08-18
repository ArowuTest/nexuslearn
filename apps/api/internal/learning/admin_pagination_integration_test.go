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
