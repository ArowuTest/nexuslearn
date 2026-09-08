package database

import (
	"path/filepath"
	"regexp"
	"testing"
)

func TestNarrationPlaybackEvidenceMigrationAddsAuditableObjectColumn(t *testing.T) {
	migrationsDir := filepath.Join("..", "..", "migrations")
	up := readMigration(t, filepath.Join(migrationsDir, "0050_narration_playback_evidence.up.sql"))
	down := readMigration(t, filepath.Join(migrationsDir, "0050_narration_playback_evidence.down.sql"))

	for _, pattern := range []string{
		`(?i)ADD\s+COLUMN\s+IF\s+NOT\s+EXISTS\s+playback_evidence\s+jsonb\s+NOT\s+NULL\s+DEFAULT\s+'\{\}'::jsonb`,
		`(?i)jsonb_typeof\(playback_evidence\)\s*=\s*'object'`,
	} {
		if !regexp.MustCompile(pattern).MatchString(up) {
			t.Fatalf("playback evidence migration is missing %q", pattern)
		}
	}
	if !regexp.MustCompile(`(?i)DROP\s+COLUMN\s+IF\s+EXISTS\s+playback_evidence`).MatchString(down) {
		t.Fatal("playback evidence rollback must remove the added column")
	}
}
