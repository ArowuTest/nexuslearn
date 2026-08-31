package database

import (
	"path/filepath"
	"regexp"
	"testing"
)

func TestAudioOperationsMigrationCreatesImmutableReleaseLedger(t *testing.T) {
	migrationsDir := filepath.Join("..", "..", "migrations")
	up := readMigration(t, filepath.Join(migrationsDir, "0044_audio_release_operations.up.sql"))
	down := readMigration(t, filepath.Join(migrationsDir, "0044_audio_release_operations.down.sql"))

	for _, table := range []string{"audio_manifests", "audio_manifest_assets", "audio_manifest_references", "audio_rerecord_requests"} {
		if !regexp.MustCompile(`(?i)CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+` + table).MatchString(up) {
			t.Fatalf("audio operations migration does not create %s", table)
		}
		if !regexp.MustCompile(`(?i)DROP\s+TABLE\s+IF\s+EXISTS\s+` + table).MatchString(down) {
			t.Fatalf("audio operations rollback does not remove %s", table)
		}
	}
	for _, index := range []string{"audio_manifest_assets_review_idx", "audio_manifest_references_asset_idx", "audio_rerecord_requests_asset_created_idx"} {
		if !regexp.MustCompile(`(?i)CREATE\s+INDEX\s+IF\s+NOT\s+EXISTS\s+` + index).MatchString(up) {
			t.Fatalf("audio operations migration does not create %s", index)
		}
	}
	if regexp.MustCompile(`(?i)(api[_-]?key|provider[_-]?token|credential|secret)`).MatchString(up) {
		t.Fatal("audio operations schema must never include provider credential storage")
	}
}
