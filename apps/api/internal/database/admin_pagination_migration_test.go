package database

import (
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strings"
	"testing"
)

func TestAdminPaginationMigrationHasMatchingIndexRollback(t *testing.T) {
	migrationsDir := filepath.Join("..", "..", "migrations")
	up := readMigration(t, filepath.Join(migrationsDir, "0042_admin_ledger_pagination_indexes.up.sql"))
	down := readMigration(t, filepath.Join(migrationsDir, "0042_admin_ledger_pagination_indexes.down.sql"))

	created := migrationIndexNames(t, up, `(?i)CREATE\s+INDEX(?:\s+IF\s+NOT\s+EXISTS)?\s+([a-z0-9_]+)`)
	dropped := migrationIndexNames(t, down, `(?i)DROP\s+INDEX(?:\s+IF\s+EXISTS)?\s+([a-z0-9_]+)`)
	want := []string{
		"audit_logs_created_id_idx",
		"content_releases_created_id_idx",
		"content_versions_created_id_idx",
	}
	if strings.Join(created, ",") != strings.Join(want, ",") {
		t.Fatalf("unexpected pagination indexes: got %v want %v", created, want)
	}
	if strings.Join(dropped, ",") != strings.Join(want, ",") {
		t.Fatalf("rollback does not remove the same indexes: created=%v dropped=%v", created, dropped)
	}
	for _, table := range []string{"audit_logs", "content_versions", "content_releases"} {
		if !regexp.MustCompile(`(?i)ON\s+` + table + `\s*\(\s*created_at\s+DESC\s*,\s*id\s+DESC\s*\)`).MatchString(up) {
			t.Fatalf("%s is missing a descending timestamp-and-id pagination index", table)
		}
	}
}

func readMigration(t *testing.T, path string) string {
	t.Helper()
	raw, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	return string(raw)
}

func migrationIndexNames(t *testing.T, sql string, pattern string) []string {
	t.Helper()
	matches := regexp.MustCompile(pattern).FindAllStringSubmatch(sql, -1)
	result := make([]string, 0, len(matches))
	for _, match := range matches {
		result = append(result, strings.ToLower(match[1]))
	}
	sort.Strings(result)
	return result
}
