package server

import (
	"strings"
	"testing"

	"github.com/ArowuTest/nexuslearn/apps/api/internal/learning"
)

func TestBuildContentReviewGateRequiresCurrentApprovalForEveryRequiredLane(t *testing.T) {
	batch := contentReviewBatch{
		BatchID: "batch-1",
		Packs: []contentReviewPack{{
			PackID: "pack-1",
			Lanes: []contentReviewBatchLane{
				{ID: "curriculum_accuracy", Status: "required"},
				{ID: "send_accessibility", Status: "required"},
				{ID: "produced_audio_listening", Status: "conditional"},
			},
		}},
	}
	decisions := []learning.ContentReviewDecision{
		{BatchID: "batch-1", BatchSHA256: "hash-old", PackID: "pack-1", LaneID: "curriculum_accuracy", Decision: "approved"},
		{BatchID: "batch-1", BatchSHA256: "hash-current", PackID: "pack-1", LaneID: "send_accessibility", Decision: "approved"},
	}
	gate := buildContentReviewGate(batch, "hash-current", decisions)
	if gate["promotion_allowed"] != false {
		t.Fatal("stale approval must block promotion")
	}
	if gate["pending_required_lanes"] != 1 || gate["stale_decisions"] != 1 {
		t.Fatalf("unexpected stale gate: %#v", gate)
	}
	decisions[0].BatchSHA256 = "hash-current"
	decisions = append(decisions, learning.ContentReviewDecision{
		BatchID: "batch-1", BatchSHA256: "hash-current", PackID: "pack-1", LaneID: "produced_audio_listening", Decision: "hold",
	})
	gate = buildContentReviewGate(batch, "hash-current", decisions)
	if gate["promotion_allowed"] != false || gate["non_approved_decisions"] != 1 {
		t.Fatalf("conditional hold must block promotion: %#v", gate)
	}
	decisions[2].Decision = "approved"
	gate = buildContentReviewGate(batch, "hash-current", decisions)
	if gate["promotion_allowed"] != true {
		t.Fatalf("fully approved current gate should allow controlled pilot: %#v", gate)
	}
	if gate["status"] != "human_review_complete" || gate["scope"] != "human_evidence_only" {
		t.Fatalf("human ledger must not claim AI or public-release approval: %#v", gate)
	}
}

func TestContentReviewBatchHashIgnoresTimestampButNotMaterialChanges(t *testing.T) {
	first := []byte(`{"batch_id":"batch-1","generated_at":"2026-01-01T00:00:00Z","packs":[{"pack_id":"pack-1","lanes":[{"id":"safeguarding","status":"required"}]}]}`)
	second := []byte(`{"generated_at":"2026-08-08T20:00:00Z","packs":[{"lanes":[{"status":"required","id":"safeguarding"}],"pack_id":"pack-1"}],"batch_id":"batch-1"}`)
	firstHash, err := contentReviewBatchSHA256(first)
	if err != nil {
		t.Fatal(err)
	}
	secondHash, err := contentReviewBatchSHA256(second)
	if err != nil {
		t.Fatal(err)
	}
	if firstHash != secondHash || len(firstHash) != 64 {
		t.Fatalf("operational timestamps or key order changed semantic identity: %s %s", firstHash, secondHash)
	}
	changedHash, err := contentReviewBatchSHA256([]byte(strings.ReplaceAll(string(second), "safeguarding", "real_child_pilot_evidence")))
	if err != nil {
		t.Fatal(err)
	}
	if changedHash == firstHash {
		t.Fatal("material lane changes must invalidate prior human decisions")
	}
}
