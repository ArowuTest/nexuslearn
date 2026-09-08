package database

import (
	"path/filepath"
	"regexp"
	"strings"
	"testing"
)

func TestNarrationLatestReviewOrderMigrationHasMatchingRollback(t *testing.T) {
	migrationsDir := filepath.Join("..", "..", "migrations")
	up := readMigration(t, filepath.Join(migrationsDir, "0057_narration_latest_review_order.up.sql"))
	down := readMigration(t, filepath.Join(migrationsDir, "0057_narration_latest_review_order.down.sql"))

	created := migrationIndexNames(t, up, `(?i)CREATE\s+INDEX(?:\s+IF\s+NOT\s+EXISTS)?\s+([a-z0-9_]+)`)
	dropped := migrationIndexNames(t, down, `(?i)DROP\s+INDEX(?:\s+IF\s+EXISTS)?\s+([a-z0-9_]+)`)
	want := []string{"narration_reviews_asset_updated_id_idx"}
	if strings.Join(created, ",") != strings.Join(want, ",") || strings.Join(dropped, ",") != strings.Join(want, ",") {
		t.Fatalf("rollback does not mirror latest-review index: created=%v dropped=%v", created, dropped)
	}
	if !regexp.MustCompile(`(?i)ON\s+narration_reviews\s*\(\s*asset_id\s*,\s*updated_at\s+DESC\s*,\s*id\s+DESC\s*\)`).MatchString(up) {
		t.Fatal("latest-review index must match the queue's DISTINCT ON ordering")
	}
}
