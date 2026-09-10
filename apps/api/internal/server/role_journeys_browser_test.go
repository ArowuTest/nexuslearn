package server

import (
	"context"
	"fmt"
	"net/http/httptest"
	"net/url"
	"os"
	"os/exec"
	"path/filepath"
	"testing"
	"time"

	"github.com/ArowuTest/nexuslearn/apps/api/internal/database"
	"github.com/ArowuTest/nexuslearn/apps/api/internal/learning"
	"github.com/ArowuTest/nexuslearn/apps/api/internal/testdb"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// This opt-in suite signs in through the real UI/API, never hosted services.
// Every run owns and removes its own schema, including all disposable accounts.
func TestBrowserRoleJourneys(t *testing.T) {
	if os.Getenv("RUN_BROWSER_ROLE_QA") != "true" {
		t.Skip("set RUN_BROWSER_ROLE_QA=true and a local TEST_DATABASE_URL")
	}
	dsn := os.Getenv("TEST_DATABASE_URL")
	u, err := url.Parse(dsn)
	if err != nil || (u.Hostname() != "127.0.0.1" && u.Hostname() != "localhost" && !(os.Getenv("CI") == "true" && u.Hostname() == "grading-postgres")) {
		t.Fatal("role browser QA requires a loopback PostgreSQL URL")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Minute)
	defer cancel()
	admin, err := pgxpool.New(ctx, dsn)
	if err != nil {
		t.Fatal(err)
	}
	defer admin.Close()
	if err := testdb.PrepareExtensions(ctx, admin); err != nil {
		t.Fatal(err)
	}
	schema := fmt.Sprintf("browser_roles_%d", time.Now().UnixNano())
	identifier := pgx.Identifier{schema}.Sanitize()
	if _, err := admin.Exec(ctx, "CREATE SCHEMA "+identifier); err != nil {
		t.Fatal(err)
	}
	defer func() {
		cleanup, cancel := context.WithTimeout(context.Background(), 30*time.Second)
		defer cancel()
		if _, err := admin.Exec(cleanup, "DROP SCHEMA "+identifier+" CASCADE"); err != nil {
			t.Error(err)
		}
	}()
	config, err := pgxpool.ParseConfig(dsn)
	if err != nil {
		t.Fatal(err)
	}
	config.ConnConfig.RuntimeParams["search_path"] = schema
	pool, err := pgxpool.NewWithConfig(ctx, config)
	if err != nil {
		t.Fatal(err)
	}
	defer pool.Close()
	if err := database.RunMigrations(ctx, pool, filepath.Join("..", "..", "migrations")); err != nil {
		t.Fatal(err)
	}
	repo := learning.NewRepository(pool)
	const password = "local-disposable-password-only"
	if _, err := repo.UpsertSchool(ctx, learning.SchoolConfig{URN: "qa-school", Name: "Local QA school", Status: "active"}); err != nil {
		t.Fatal(err)
	}
	if _, err := repo.UpsertSchoolUser(ctx, learning.SchoolUserConfig{SchoolURN: "qa-school", Email: "school@example.test", LoginID: "qa-teacher", DisplayName: "QA teacher", Role: "school_admin", Status: "active", TemporaryPassword: password}); err != nil {
		t.Fatal(err)
	}
	if _, err := repo.(platformUserRepository).UpsertPlatformUser(ctx, learning.PlatformUserConfig{Email: "admin@example.test", LoginID: "qa-admin", DisplayName: "QA administrator", Roles: []string{"platform_admin"}}, password); err != nil {
		t.Fatal(err)
	}
	t.Setenv("REQUIRE_PUPIL_SESSION", "true")
	t.Setenv("PUPIL_SESSION_SECRET", "local-disposable-role-qa-only")
	t.Setenv("ACCOUNT_SESSION_SECRET", "local-disposable-role-qa-only")
	httpServer := httptest.NewServer(New(repo, "postgres"))
	defer httpServer.Close()
	args := []string{"node_modules/@playwright/test/cli.js", "test", "tests/e2e/roles-backend.spec.ts", "--workers=1", "--retries=0"}
	cmd := exec.CommandContext(ctx, "node", args...)
	cmd.Dir = filepath.Join("..", "..", "..", "web")
	cmd.Env = append(os.Environ(), "PLAYWRIGHT_PORT=3110", "ROLE_API_URL="+httpServer.URL)
	cmd.Stdout, cmd.Stderr = os.Stdout, os.Stderr
	if err := cmd.Run(); err != nil {
		t.Fatalf("role browser QA failed: %v", err)
	}
}
