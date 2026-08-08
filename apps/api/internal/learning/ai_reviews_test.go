package learning

import (
	"os"
	"strings"
	"testing"
)

func TestAIReviewMigrationContainsImmutableIdentityAndQueueIndexes(t *testing.T) {
	raw, err := os.ReadFile("../../migrations/0038_ai_review_evidence.up.sql")
	if err != nil {
		t.Fatal(err)
	}

	sql := string(raw)
	for _, required := range []string{
		"CREATE TABLE IF NOT EXISTS ai_review_evidence",
		"content_hash text NOT NULL",
		"lane_id text NOT NULL",
		"reviewer_implementation text NOT NULL",
		"UNIQUE(content_id, content_hash, lane_id, rubric_revision, source_set_revision, reviewer_implementation)",
		"CREATE TABLE IF NOT EXISTS ai_review_findings",
		"ai_review_evidence_queue_idx",
		"ai_review_evidence_pack_idx",
		"ai_review_evidence_identity_idx",
	} {
		if !strings.Contains(sql, required) {
			t.Fatalf("migration missing %q", required)
		}
	}
}
