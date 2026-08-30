package database

import (
	"path/filepath"
	"regexp"
	"testing"
)

func TestNarrationManifestV2MigrationPreservesAndIndexesProfileBindings(t *testing.T) {
	migrationsDir := filepath.Join("..", "..", "migrations")
	up := readMigration(t, filepath.Join(migrationsDir, "0043_narration_review_profile_binding.up.sql"))
	down := readMigration(t, filepath.Join(migrationsDir, "0043_narration_review_profile_binding.down.sql"))

	for _, pattern := range []string{
		`(?i)ADD\s+COLUMN\s+IF\s+NOT\s+EXISTS\s+production_profile_sha256\s+text`,
		`(?i)production_profile_sha256\s+IS\s+NULL\s+OR\s+production_profile_sha256\s*~\s*'\^\[0-9a-f\]\{64\}\$'`,
		`(?i)CREATE\s+INDEX\s+IF\s+NOT\s+EXISTS\s+narration_reviews_binding_updated_idx`,
	} {
		if !regexp.MustCompile(pattern).MatchString(up) {
			t.Fatalf("profile-binding migration is missing %q", pattern)
		}
	}
	if !regexp.MustCompile(`(?i)DROP\s+COLUMN\s+IF\s+EXISTS\s+production_profile_sha256`).MatchString(down) {
		t.Fatal("profile-binding rollback must remove the added column")
	}
	if !regexp.MustCompile(`(?i)DROP\s+INDEX\s+IF\s+EXISTS\s+narration_reviews_binding_updated_idx`).MatchString(down) {
		t.Fatal("profile-binding rollback must remove the added index")
	}
}
