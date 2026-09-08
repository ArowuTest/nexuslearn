package learning

import (
	"context"
	"strings"
	"testing"
)

const progressObjectiveScopeRows = 3500

func TestPostgresProgressObjectiveScopeKeepsReportsBoundedAndEvidenceComplete(t *testing.T) {
	pool, repo := openPaginationIntegrationRepository(t)
	ctx := context.Background()
	var studentID string
	if err := pool.QueryRow(ctx, `
		INSERT INTO students (external_ref, display_name, year_group)
		VALUES ('progress-scope-student', 'Progress scope pupil', 4)
		RETURNING id::text
	`).Scan(&studentID); err != nil {
		t.Fatal(err)
	}
	if _, err := pool.Exec(ctx, `
		INSERT INTO curriculum_objectives (
			id, year_group, subject, strand, topic, statement,
			expected_mastery, secure_mastery, retention_days, required_formats
		)
		SELECT
			'progress-scope-objective-' || lpad(n::text, 5, '0'),
			(n % 7) + 1,
			'Progress subject ' || (n % 3),
			'Progress strand',
			'Progress topic ' || n,
			'Progress objective ' || n,
			80, 90, ARRAY[1,3,7], ARRAY['multiple_choice']
		FROM generate_series(0, $1 - 1) AS n
	`, progressObjectiveScopeRows); err != nil {
		t.Fatal(err)
	}
	masteredIDs := []string{
		"progress-scope-objective-00006", // Year 7: outside the local Year 4 window.
		"progress-scope-objective-00013", // Year 7: outside the local Year 4 window.
	}
	for _, objectiveID := range masteredIDs {
		if _, err := pool.Exec(ctx, `
			INSERT INTO student_objective_mastery (student_id, objective_id, score, band)
			VALUES ($1, $2, 95, 'Secure')
		`, studentID, objectiveID); err != nil {
			t.Fatal(err)
		}
	}

	objectives, err := repo.ListProgressObjectives(ctx, "progress-scope-student", 4)
	if err != nil {
		t.Fatal(err)
	}
	if len(objectives) >= progressObjectiveScopeRows {
		t.Fatalf("progress report loaded the entire objective catalogue: %d rows", len(objectives))
	}
	if len(objectives) < progressObjectiveScopeRows*4/7 {
		t.Fatalf("progress report omitted the local Year 2-5 window: got %d rows", len(objectives))
	}
	seenMastery := map[string]bool{}
	for _, objective := range objectives {
		if objective.ID == masteredIDs[0] || objective.ID == masteredIDs[1] {
			seenMastery[objective.ID] = true
			continue
		}
		if strings.HasPrefix(objective.ID, "progress-scope-objective-") && (objective.Year < 2 || objective.Year > 5) {
			t.Fatalf("unmastered objective outside local report window was returned: %s (Year %d)", objective.ID, objective.Year)
		}
	}
	for _, objectiveID := range masteredIDs {
		if !seenMastery[objectiveID] {
			t.Fatalf("mastered objective %s was omitted from the progress scope", objectiveID)
		}
	}
}
