package database

import (
	"os"
	"strings"
	"testing"
)

func TestAuditCredentialScrubMigration(t *testing.T) {
	up, err := os.ReadFile("../../migrations/0062_scrub_audit_credential_payloads.up.sql")
	if err != nil {
		t.Fatal(err)
	}
	statement := string(up)
	for _, key := range []string{"login_code", "picture_password", "qr_secret_hash", "password", "temporary_password", "password_hash"} {
		if !strings.Contains(statement, "'"+key+"'") {
			t.Fatalf("migration does not remove %s", key)
		}
	}
	if !strings.Contains(statement, "UPDATE audit_logs") {
		t.Fatal("migration does not update audit_logs")
	}
	down, err := os.ReadFile("../../migrations/0062_scrub_audit_credential_payloads.down.sql")
	if err != nil {
		t.Fatal(err)
	}
	lower := strings.ToLower(string(down))
	for _, forbidden := range []string{"insert", "update", "login_code"} {
		if strings.Contains(lower, forbidden) {
			t.Fatalf("down migration must not restore secrets, found %s", forbidden)
		}
	}
}
