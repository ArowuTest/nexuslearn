package database

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
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
	if !strings.Contains(statement, "jsonb_array_elements") || !strings.Contains(statement, "jsonb_agg") {
		t.Fatal("migration does not rewrite credentials array elements")
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

func TestAuditCredentialScrubRemovesNestedSecrets(t *testing.T) {
	dsn := strings.TrimSpace(os.Getenv("TEST_DATABASE_URL"))
	if dsn == "" {
		dsn = strings.TrimSpace(os.Getenv("DATABASE_URL"))
	}
	if dsn == "" {
		t.Skip("PostgreSQL integration test skipped: set TEST_DATABASE_URL or DATABASE_URL")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	admin, err := pgxpool.New(ctx, dsn)
	if err != nil {
		t.Fatal(err)
	}
	schema := fmt.Sprintf("audit_scrub_%d", time.Now().UnixNano())
	identifier := pgx.Identifier{schema}.Sanitize()
	if _, err := admin.Exec(ctx, "CREATE SCHEMA "+identifier); err != nil {
		admin.Close()
		t.Fatal(err)
	}
	config, err := pgxpool.ParseConfig(dsn)
	if err != nil {
		admin.Close()
		t.Fatal(err)
	}
	config.ConnConfig.RuntimeParams["search_path"] = schema
	config.AfterConnect = func(ctx context.Context, conn *pgx.Conn) error {
		_, err := conn.Exec(ctx, "SET search_path TO "+identifier)
		return err
	}
	pool, err := pgxpool.NewWithConfig(ctx, config)
	if err != nil {
		admin.Close()
		t.Fatal(err)
	}
	t.Cleanup(func() {
		pool.Close()
		dropCtx, dropCancel := context.WithTimeout(context.Background(), 15*time.Second)
		defer dropCancel()
		_, _ = admin.Exec(dropCtx, "DROP SCHEMA "+identifier+" CASCADE")
		admin.Close()
	})
	if _, err := pool.Exec(ctx, `
		CREATE TABLE audit_logs (
			id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
			action text NOT NULL,
			entity_type text NOT NULL,
			entity_id text NOT NULL,
			payload jsonb NOT NULL DEFAULT '{}'::jsonb
		)
	`); err != nil {
		t.Fatal(err)
	}
	nested := `{
		"class_id":"class-1",
		"generated_count":1,
		"credentials":[
			{
				"login_code":"LOGIN-SECRET",
				"picture_password":["PICTURE-SECRET"],
				"qr_secret_hash":"QR-SECRET",
				"password":"PASSWORD-SECRET",
				"temporary_password":"TEMP-SECRET",
				"password_hash":"HASH-SECRET",
				"display_name":"Ava",
				"student_external_ref":"ada"
			},
			"not-an-object"
		]
	}`
	if _, err := pool.Exec(ctx, `
		INSERT INTO audit_logs (action, entity_type, entity_id, payload)
		VALUES
			('generate', 'class_credentials', 'class-1', $1::jsonb),
			('upsert', 'student_credential', 'bea', '{"login_code":"TOP-SECRET","display_name":"Bea","student_external_ref":"bea"}'::jsonb),
			('generate', 'class_credentials', 'class-2', '{"class_id":"class-2","generated_count":0}'::jsonb),
			('generate', 'class_credentials', 'class-3', '{"credentials":[{"display_name":"Cara","student_external_ref":"cara"}]}'::jsonb)
	`, nested); err != nil {
		t.Fatal(err)
	}
	statement, err := os.ReadFile("../../migrations/0062_scrub_audit_credential_payloads.up.sql")
	if err != nil {
		t.Fatal(err)
	}
	tag, err := pool.Exec(ctx, string(statement))
	if err != nil {
		t.Fatal(err)
	}
	if tag.RowsAffected() != 2 {
		t.Fatalf("first scrub updated %d rows, want the nested row and the top-level row", tag.RowsAffected())
	}
	var payload []byte
	if err := pool.QueryRow(ctx, `SELECT payload FROM audit_logs WHERE entity_id = 'class-1'`).Scan(&payload); err != nil {
		t.Fatal(err)
	}
	var body map[string]any
	if err := json.Unmarshal(payload, &body); err != nil {
		t.Fatal(err)
	}
	if body["class_id"] != "class-1" {
		t.Fatalf("class id = %#v", body["class_id"])
	}
	credentials, _ := body["credentials"].([]any)
	if len(credentials) != 2 {
		t.Fatalf("credentials = %#v", body["credentials"])
	}
	element, _ := credentials[0].(map[string]any)
	if element["display_name"] != "Ava" || element["student_external_ref"] != "ada" {
		t.Fatalf("kept fields = %#v", element)
	}
	for _, key := range []string{"login_code", "picture_password", "qr_secret_hash", "password", "temporary_password", "password_hash"} {
		if _, ok := element[key]; ok {
			t.Fatalf("nested %s survived: %#v", key, element)
		}
	}
	if credentials[1] != "not-an-object" {
		t.Fatalf("non-object element = %#v", credentials[1])
	}
	var leaked int
	if err := pool.QueryRow(ctx, `
		SELECT count(*) FROM audit_logs
		WHERE payload::text LIKE '%SECRET%'
	`).Scan(&leaked); err != nil {
		t.Fatal(err)
	}
	if leaked != 0 {
		t.Fatalf("%d audit rows still contain a secret", leaked)
	}
	var clean, alreadyClean, nestedBefore string
	if err := pool.QueryRow(ctx, `SELECT payload::text FROM audit_logs WHERE entity_id = 'class-2'`).Scan(&clean); err != nil {
		t.Fatal(err)
	}
	if err := pool.QueryRow(ctx, `SELECT payload::text FROM audit_logs WHERE entity_id = 'class-3'`).Scan(&alreadyClean); err != nil {
		t.Fatal(err)
	}
	if err := pool.QueryRow(ctx, `SELECT payload::text FROM audit_logs WHERE entity_id = 'class-1'`).Scan(&nestedBefore); err != nil {
		t.Fatal(err)
	}
	again, err := pool.Exec(ctx, string(statement))
	if err != nil {
		t.Fatal(err)
	}
	if again.RowsAffected() != 0 {
		t.Fatalf("second scrub updated %d rows", again.RowsAffected())
	}
	var cleanAfter, alreadyCleanAfter, nestedAfter string
	if err := pool.QueryRow(ctx, `SELECT payload::text FROM audit_logs WHERE entity_id = 'class-2'`).Scan(&cleanAfter); err != nil {
		t.Fatal(err)
	}
	if err := pool.QueryRow(ctx, `SELECT payload::text FROM audit_logs WHERE entity_id = 'class-3'`).Scan(&alreadyCleanAfter); err != nil {
		t.Fatal(err)
	}
	if err := pool.QueryRow(ctx, `SELECT payload::text FROM audit_logs WHERE entity_id = 'class-1'`).Scan(&nestedAfter); err != nil {
		t.Fatal(err)
	}
	if cleanAfter != clean || alreadyCleanAfter != alreadyClean || nestedAfter != nestedBefore {
		t.Fatal("running the scrub twice changed an already-clean payload")
	}
	var topLevelGone bool
	if err := pool.QueryRow(ctx, `SELECT NOT (payload ? 'login_code') AND payload->>'display_name' = 'Bea' FROM audit_logs WHERE entity_id = 'bea'`).Scan(&topLevelGone); err != nil {
		t.Fatal(err)
	}
	if !topLevelGone {
		t.Fatal("top-level login code was not removed")
	}
}
