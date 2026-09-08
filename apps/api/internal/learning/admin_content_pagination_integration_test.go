package learning

import (
	"context"
	"fmt"
	"strings"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

const adminContentPaginationRows = 1000

func TestPostgresAdminContentDirectoriesTraverseStablePages(t *testing.T) {
	pool, repo := openPaginationIntegrationRepository(t)
	ctx, cancel := context.WithTimeout(context.Background(), 90*time.Second)
	defer cancel()
	updatedAt := time.Date(2026, time.August, 18, 12, 0, 0, 123456000, time.UTC)
	seedAdminContentRows(t, ctx, pool, updatedAt)

	activityIDs, activityCursors := traverseAdminActivityPages(t, ctx, repo, 137)
	questionIDs, questionCursors := traverseAdminQuestionPages(t, ctx, repo, 137)
	rewardIDs, rewardCursors := traverseAdminRewardPages(t, ctx, repo, 137)
	objectiveIDs, objectiveCursors := traverseAdminObjectivePages(t, ctx, repo, 137)

	assertContentTraversalStable(t, activityIDs, activityCursors, "admin-content-activity-")
	assertContentTraversalStable(t, questionIDs, questionCursors, "admin-content-question-")
	assertContentTraversalStable(t, rewardIDs, rewardCursors, "admin-content-reward-")
	assertContentTraversalStable(t, objectiveIDs, objectiveCursors, "admin-content-objective-")

	assertAdminContentPlanUsesIndex(t, ctx, pool, `
		EXPLAIN (FORMAT JSON)
		SELECT id, updated_at
		FROM activities
		WHERE (NOT $1::boolean OR updated_at < $2::timestamptz OR (updated_at = $2::timestamptz AND id > $3::text))
		ORDER BY updated_at DESC, id
		LIMIT $4
	`, "activities_admin_directory_order_idx", true, updatedAt, "admin-content-activity-00500", 137)
	assertAdminContentPlanUsesIndex(t, ctx, pool, `
		EXPLAIN (FORMAT JSON)
		SELECT id, updated_at
		FROM questions
		WHERE (NOT $1::boolean OR updated_at < $2::timestamptz OR (updated_at = $2::timestamptz AND id > $3::text))
		ORDER BY updated_at DESC, id
		LIMIT $4
	`, "questions_admin_directory_order_idx", true, updatedAt, "admin-content-question-00500", 137)
	assertAdminContentPlanUsesIndex(t, ctx, pool, `
		EXPLAIN (FORMAT JSON)
		SELECT id, updated_at
		FROM reward_rules
		WHERE (NOT $1::boolean OR updated_at < $2::timestamptz OR (updated_at = $2::timestamptz AND id > $3::text))
		ORDER BY updated_at DESC, id
		LIMIT $4
	`, "reward_rules_admin_directory_order_idx", true, updatedAt, "admin-content-reward-00500", 137)
	assertAdminContentPlanUsesIndex(t, ctx, pool, `
		EXPLAIN (FORMAT JSON)
		SELECT id, year_group, subject, strand, topic
		FROM curriculum_objectives
		WHERE (year_group, subject, strand, topic, id) > ($1::int, $2::text, $3::text, $4::text, $5::text)
		ORDER BY year_group, subject, strand, topic, id
		LIMIT $6
	`, "curriculum_objectives_admin_directory_order_idx|idx_curriculum_objectives_year_subject", 3, "English", "Reading", "Topic", "admin-content-objective-00500", 137)
}

func seedAdminContentRows(t *testing.T, ctx context.Context, pool *pgxpool.Pool, updatedAt time.Time) {
	t.Helper()
	var activeRelease string
	_ = pool.QueryRow(ctx, `
		SELECT id FROM content_releases
		WHERE channel='live' AND status='applied'
		ORDER BY applied_at DESC NULLS LAST, id DESC
		LIMIT 1
	`).Scan(&activeRelease)
	tx, err := pool.Begin(ctx)
	if err != nil {
		t.Fatal(err)
	}
	defer tx.Rollback(ctx)
	for index := 0; index < adminContentPaginationRows; index++ {
		objectiveID := fmt.Sprintf("admin-content-objective-%05d", index)
		activityID := fmt.Sprintf("admin-content-activity-%05d", index)
		questionID := fmt.Sprintf("admin-content-question-%05d", index)
		rewardID := fmt.Sprintf("admin-content-reward-%05d", index)
		if _, err := tx.Exec(ctx, `
			INSERT INTO curriculum_objectives (
				id, year_group, subject, strand, topic, statement, parent_explanation, teacher_evidence,
				expected_mastery, secure_mastery, retention_days, required_formats, content_release_id, updated_at
			) VALUES ($1, $2, 'English', 'Reading', 'Topic', $3, '', '', 80, 90, ARRAY[1,3,7], ARRAY['multiple_choice'], NULLIF($4,''), $5)
			ON CONFLICT (id) DO UPDATE SET updated_at=EXCLUDED.updated_at, content_release_id=EXCLUDED.content_release_id
		`, objectiveID, (index%7)+1, "Admin content objective", activeRelease, updatedAt); err != nil {
			t.Fatal(err)
		}
		if _, err := tx.Exec(ctx, `
			INSERT INTO activities (id, objective_id, world_key, title, prompt, difficulty, interaction, feedback, animation_hooks, status, updated_at)
			VALUES ($1, $2, '', $3, '', 1, '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, 'draft', $4)
			ON CONFLICT (id) DO UPDATE SET updated_at=EXCLUDED.updated_at, objective_id=EXCLUDED.objective_id
		`, activityID, objectiveID, "Admin content activity", updatedAt); err != nil {
			t.Fatal(err)
		}
		if _, err := tx.Exec(ctx, `
			INSERT INTO questions (id, activity_id, objective_id, format, body, expected_answer, hints, explanation, difficulty, status, updated_at)
			VALUES ($1, $2, $3, 'multiple_choice', '{}'::jsonb, '{}'::jsonb, '[]'::jsonb, '', 1, 'draft', $4)
			ON CONFLICT (id) DO UPDATE SET updated_at=EXCLUDED.updated_at, activity_id=EXCLUDED.activity_id, objective_id=EXCLUDED.objective_id
		`, questionID, activityID, objectiveID, updatedAt); err != nil {
			t.Fatal(err)
		}
		if _, err := tx.Exec(ctx, `
			INSERT INTO reward_rules (id, objective_id, trigger, reward_payload, enabled, updated_at)
			VALUES ($1, $2, 'attempt.correct', '{"reward_hook":"seed","animation_hook":"seed","feedback":"seed","explanation":"seed","evidence_event":"seed","companion_prompt":"seed"}'::jsonb, true, $3)
			ON CONFLICT (id) DO UPDATE SET updated_at=EXCLUDED.updated_at, objective_id=EXCLUDED.objective_id
		`, rewardID, objectiveID, updatedAt); err != nil {
			t.Fatal(err)
		}
	}
	if err := tx.Commit(ctx); err != nil {
		t.Fatal(err)
	}
}

func traverseAdminActivityPages(t *testing.T, ctx context.Context, repo *PostgresRepository, limit int) ([]string, []string) {
	var ids, cursors []string
	cursor := ""
	for {
		page, err := repo.ListActivityPage(ctx, AdminContentPageQuery{Limit: limit, Cursor: cursor})
		if err != nil {
			t.Fatal(err)
		}
		for _, item := range page.Activities {
			ids = append(ids, item.ID)
		}
		cursors = append(cursors, page.NextCursor)
		cursor = page.NextCursor
		if cursor == "" {
			return ids, cursors
		}
	}
}

func traverseAdminQuestionPages(t *testing.T, ctx context.Context, repo *PostgresRepository, limit int) ([]string, []string) {
	var ids, cursors []string
	cursor := ""
	for {
		page, err := repo.ListQuestionPage(ctx, AdminContentPageQuery{Limit: limit, Cursor: cursor})
		if err != nil {
			t.Fatal(err)
		}
		for _, item := range page.Questions {
			ids = append(ids, item.ID)
		}
		cursors = append(cursors, page.NextCursor)
		cursor = page.NextCursor
		if cursor == "" {
			return ids, cursors
		}
	}
}

func traverseAdminRewardPages(t *testing.T, ctx context.Context, repo *PostgresRepository, limit int) ([]string, []string) {
	var ids, cursors []string
	cursor := ""
	for {
		page, err := repo.ListRewardRulePage(ctx, AdminContentPageQuery{Limit: limit, Cursor: cursor})
		if err != nil {
			t.Fatal(err)
		}
		for _, item := range page.RewardRules {
			ids = append(ids, item.ID)
		}
		cursors = append(cursors, page.NextCursor)
		cursor = page.NextCursor
		if cursor == "" {
			return ids, cursors
		}
	}
}

func traverseAdminObjectivePages(t *testing.T, ctx context.Context, repo *PostgresRepository, limit int) ([]string, []string) {
	var ids, cursors []string
	cursor := ""
	for {
		page, err := repo.ListObjectivePage(ctx, AdminContentPageQuery{Limit: limit, Cursor: cursor})
		if err != nil {
			t.Fatal(err)
		}
		for _, item := range page.Objectives {
			ids = append(ids, item.ID)
		}
		cursors = append(cursors, page.NextCursor)
		cursor = page.NextCursor
		if cursor == "" {
			return ids, cursors
		}
	}
}

func assertContentTraversalStable(t *testing.T, ids, cursors []string, prefix string) {
	t.Helper()
	seen := make(map[string]bool)
	prefixed := 0
	for _, id := range ids {
		if seen[id] {
			t.Fatalf("content directory returned duplicate id %q", id)
		}
		seen[id] = true
		if strings.HasPrefix(id, prefix) {
			prefixed++
		}
	}
	if prefixed != adminContentPaginationRows {
		t.Fatalf("content directory returned %d seeded %s rows, want %d", prefixed, prefix, adminContentPaginationRows)
	}
	if len(cursors) < 2 || cursors[len(cursors)-1] != "" {
		t.Fatalf("content directory did not terminate with an empty cursor: %v", cursors)
	}
}

func assertAdminContentPlanUsesIndex(t *testing.T, ctx context.Context, pool *pgxpool.Pool, sql, indexName string, args ...any) {
	t.Helper()
	tx, err := pool.Begin(ctx)
	if err != nil {
		t.Fatal(err)
	}
	defer tx.Rollback(ctx)
	if _, err := tx.Exec(ctx, `SET LOCAL enable_seqscan=off; SET LOCAL enable_bitmapscan=off; SET LOCAL enable_incremental_sort=off`); err != nil {
		t.Fatal(err)
	}
	var plan []byte
	if err := tx.QueryRow(ctx, sql, args...).Scan(&plan); err != nil {
		t.Fatal(err)
	}
	indexNames := strings.Split(indexName, "|")
	for _, candidate := range indexNames {
		if strings.Contains(string(plan), candidate) {
			return
		}
	}
	t.Fatalf("content pagination query plan does not use any of %s: %s", indexNames, plan)
}
