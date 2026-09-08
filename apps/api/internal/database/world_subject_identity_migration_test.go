package database

import (
	"path/filepath"
	"regexp"
	"strings"
	"testing"
)

func TestWorldSubjectIdentityMigrationHasSafeRollback(t *testing.T) {
	migrationsDir := filepath.Join("..", "..", "migrations")
	up := readMigration(t, filepath.Join(migrationsDir, "0058_world_subject_identity.up.sql"))
	down := readMigration(t, filepath.Join(migrationsDir, "0058_world_subject_identity.down.sql"))

	if !regexp.MustCompile(`(?i)UPDATE\s+worlds`).MatchString(up) {
		t.Fatal("subject identity migration must update existing worlds")
	}
	if !regexp.MustCompile(`(?i)jsonb_build_object\s*\(\s*'subject_lanes'`).MatchString(up) {
		t.Fatal("subject identity migration must store lanes in world config")
	}
	if !strings.Contains(up, "subject_identity_version") || !strings.Contains(down, "subject_identity_version") {
		t.Fatal("subject identity migration needs a version guard for rollback")
	}
	if !regexp.MustCompile(`(?i)WHERE\s+year_group\s+BETWEEN\s+1\s+AND\s+7`).MatchString(up) {
		t.Fatal("subject identity migration must cover Years 1 through 7")
	}
	if !regexp.MustCompile(`(?i)config\s*-\s*'subject_lanes'\s*-\s*'subject_identity_version'`).MatchString(down) {
		t.Fatal("rollback must remove only the subject identity metadata")
	}
	for _, subject := range []string{"English", "Mathematics", "Science"} {
		if !strings.Contains(up, `"key":"`+subject+`"`) {
			t.Fatalf("subject identity migration is missing %s", subject)
		}
	}
}
