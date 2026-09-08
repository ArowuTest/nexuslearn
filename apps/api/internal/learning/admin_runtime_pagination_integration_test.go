package learning

import (
	"context"
	"strings"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

const adminRuntimePaginationRows = 1000

func TestPostgresAdminRuntimeDirectoriesTraverseStablePages(t *testing.T) {
	pool, repo := openPaginationIntegrationRepository(t)
	ctx, cancel := context.WithTimeout(context.Background(), 90*time.Second)
	defer cancel()
	seedAdminRuntimeRows(t, ctx, pool)

	worldKeys, worldCursors := traverseAdminWorldPages(t, ctx, repo, 137)
	flagKeys, flagCursors := traverseAdminFeatureFlagPages(t, ctx, repo, 137)
	assertRuntimeTraversalStable(t, worldKeys, worldCursors, "admin-runtime-world-")
	assertRuntimeTraversalStable(t, flagKeys, flagCursors, "admin-runtime-flag-")

	assertAdminRuntimePlanUsesIndex(t, ctx, pool, `
		EXPLAIN (FORMAT JSON)
		SELECT key, year_group
		FROM worlds
		WHERE COALESCE(year_group, 0) > $1
		   OR (COALESCE(year_group, 0) = $1 AND key > $2)
		ORDER BY COALESCE(year_group, 0), key
		LIMIT $3
	`, "worlds_admin_directory_order_idx", 3, "admin-runtime-world-00010", 137)
	assertAdminRuntimePlanUsesIndex(t, ctx, pool, `
		EXPLAIN (FORMAT JSON)
		SELECT key
		FROM feature_flags
		WHERE key > $1
		ORDER BY key
		LIMIT $2
	`, "feature_flags_admin_directory_order_idx", "admin-runtime-flag-00010", 137)
}

func seedAdminRuntimeRows(t *testing.T, ctx context.Context, pool *pgxpool.Pool) {
	t.Helper()
	if _, err := pool.Exec(ctx, `
		INSERT INTO worlds (key, name, year_group, theme, config, enabled)
		SELECT 'admin-runtime-world-' || lpad(n::text, 5, '0'), 'Runtime world', (n % 7) + 1, 'Runtime theme', '{}'::jsonb, true
		FROM generate_series(0, $1 - 1) AS n
		ON CONFLICT (key) DO UPDATE SET year_group=EXCLUDED.year_group, updated_at=now()
	`, adminRuntimePaginationRows); err != nil {
		t.Fatal(err)
	}
	if _, err := pool.Exec(ctx, `
		INSERT INTO feature_flags (key, enabled, config, description)
		SELECT 'admin-runtime-flag-' || lpad(n::text, 5, '0'), (n % 2 = 0), '{}'::jsonb, 'Runtime flag'
		FROM generate_series(0, $1 - 1) AS n
		ON CONFLICT (key) DO UPDATE SET enabled=EXCLUDED.enabled, updated_at=now()
	`, adminRuntimePaginationRows); err != nil {
		t.Fatal(err)
	}
}

func traverseAdminWorldPages(t *testing.T, ctx context.Context, repo *PostgresRepository, limit int) ([]string, []string) {
	t.Helper()
	var keys, cursors []string
	cursor := ""
	for {
		page, err := repo.ListWorldPage(ctx, AdminRuntimePageQuery{Limit: limit, Cursor: cursor})
		if err != nil {
			t.Fatal(err)
		}
		for _, item := range page.Worlds {
			keys = append(keys, item.Key)
		}
		cursors = append(cursors, page.NextCursor)
		cursor = page.NextCursor
		if cursor == "" {
			return keys, cursors
		}
	}
}

func traverseAdminFeatureFlagPages(t *testing.T, ctx context.Context, repo *PostgresRepository, limit int) ([]string, []string) {
	t.Helper()
	var keys, cursors []string
	cursor := ""
	for {
		page, err := repo.ListFeatureFlagPage(ctx, AdminRuntimePageQuery{Limit: limit, Cursor: cursor})
		if err != nil {
			t.Fatal(err)
		}
		for _, item := range page.FeatureFlags {
			keys = append(keys, item.Key)
		}
		cursors = append(cursors, page.NextCursor)
		cursor = page.NextCursor
		if cursor == "" {
			return keys, cursors
		}
	}
}

func assertRuntimeTraversalStable(t *testing.T, keys, cursors []string, prefix string) {
	t.Helper()
	seen := make(map[string]bool)
	prefixed := 0
	for _, key := range keys {
		if seen[key] {
			t.Fatalf("runtime directory returned duplicate key %q", key)
		}
		seen[key] = true
		if strings.HasPrefix(key, prefix) {
			prefixed++
		}
	}
	if prefixed != adminRuntimePaginationRows {
		t.Fatalf("runtime directory returned %d seeded %s rows, want %d", prefixed, prefix, adminRuntimePaginationRows)
	}
	if len(cursors) < 2 || cursors[len(cursors)-1] != "" {
		t.Fatalf("runtime directory did not terminate with an empty cursor: %v", cursors)
	}
}

func assertAdminRuntimePlanUsesIndex(t *testing.T, ctx context.Context, pool *pgxpool.Pool, sql, indexName string, args ...any) {
	t.Helper()
	tx, err := pool.Begin(ctx)
	if err != nil {
		t.Fatal(err)
	}
	defer tx.Rollback(ctx)
	if _, err := tx.Exec(ctx, `SET LOCAL enable_seqscan=off`); err != nil {
		t.Fatal(err)
	}
	var plan []byte
	if err := tx.QueryRow(ctx, sql, args...).Scan(&plan); err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(string(plan), indexName) {
		t.Fatalf("runtime pagination query plan does not use %s: %s", indexName, plan)
	}
}
