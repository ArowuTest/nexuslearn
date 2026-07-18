package server

import (
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
}
