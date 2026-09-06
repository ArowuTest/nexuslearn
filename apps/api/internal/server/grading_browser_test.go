package server

import (
	"context"
	"fmt"
	"net/http/httptest"
	"os"
	"os/exec"
	"path/filepath"
	"testing"
	"time"

	"github.com/ArowuTest/nexuslearn/apps/api/internal/database"
	"github.com/ArowuTest/nexuslearn/apps/api/internal/learning"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// Opt-in browser proof uses the real HTTP server and a disposable schema. It
// never connects to a hosted API and does not disable pupil authentication.
func TestBrowserCanonicalGrading(t *testing.T) {
	if os.Getenv("RUN_BROWSER_GRADING_QA") != "true" {
		t.Skip("set RUN_BROWSER_GRADING_QA=true and TEST_DATABASE_URL for real browser/database QA")
	}
	dsn := os.Getenv("TEST_DATABASE_URL")
	if dsn == "" {
		t.Fatal("TEST_DATABASE_URL is required")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
	defer cancel()
	admin, err := pgxpool.New(ctx, dsn)
	if err != nil {
		t.Fatal(err)
	}
	defer admin.Close()
	schema := fmt.Sprintf("browser_grading_%d", time.Now().UnixNano())
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
	if _, err := pool.Exec(ctx, `
  INSERT INTO students(external_ref,display_name,year_group) VALUES ('grading-desktop-chromium','QA pupil',3),('grading-mobile-chromium','QA pupil',3);
  INSERT INTO curriculum_objectives(id,year_group,subject,strand,topic,statement) VALUES ('grading-browser-objective',3,'Mathematics','Number','Decimal addition','Add decimals');
  INSERT INTO activities(id,objective_id,world_key,title,prompt,interaction,status) VALUES ('grading-browser-activity','grading-browser-objective','explorer-islands','Decimal discovery','Explore decimal addition','{}','published');
  INSERT INTO questions(id,activity_id,objective_id,format,body,expected_answer,status) VALUES ('grading-browser-question','grading-browser-activity','grading-browser-objective','number-input','{"prompt":"What is 1 + 0.25?","input":"number"}','{"value":1.25}','published');
 `); err != nil {
		t.Fatal(err)
	}
	t.Setenv("REQUIRE_PUPIL_SESSION", "true")
	t.Setenv("PUPIL_SESSION_SECRET", "local-disposable-grading-qa-only")
	srv := New(learning.NewRepository(pool), "postgres")
	httpServer := httptest.NewServer(srv)
	defer httpServer.Close()
	tokens := map[string]string{}
	for _, project := range []string{"desktop-chromium", "mobile-chromium"} {
		tokens[project] = srv.createPupilSession("grading-" + project).Token
	}
	cmd := exec.CommandContext(ctx, "node", "node_modules/@playwright/test/cli.js", "test", "tests/e2e/grading-backend.spec.ts", "--workers=1", "--retries=0")
	cmd.Dir = filepath.Join("..", "..", "..", "web")
	cmd.Env = append(os.Environ(), "PLAYWRIGHT_PORT=3109", "GRADING_API_URL="+httpServer.URL, "GRADING_TOKEN_DESKTOP="+tokens["desktop-chromium"], "GRADING_TOKEN_MOBILE="+tokens["mobile-chromium"])
	output, err := cmd.CombinedOutput()
	t.Log(string(output))
	if err != nil {
		t.Fatalf("browser/backend QA failed: %v", err)
	}
	for _, project := range []string{"desktop-chromium", "mobile-chromium"} {
		var count, score int
		if err := pool.QueryRow(ctx, `SELECT count(*) FROM question_attempts qa JOIN students s ON s.id=qa.student_id WHERE s.external_ref=$1`, "grading-"+project).Scan(&count); err != nil {
			t.Fatal(err)
		}
		if err := pool.QueryRow(ctx, `SELECT score FROM student_objective_mastery m JOIN students s ON s.id=m.student_id WHERE s.external_ref=$1 AND objective_id='grading-browser-objective'`, "grading-"+project).Scan(&score); err != nil {
			t.Fatal(err)
		}
		if count != 1 || score != 6 {
			t.Fatalf("%s lost acknowledgement awarded incorrectly: attempts=%d score=%d", project, count, score)
		}
	}
}
