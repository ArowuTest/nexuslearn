package learning

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"testing"
)

func TestReleasePreflightReportsAllEvidenceBlockers(t *testing.T) {
	checks := releaseEvidenceChecks("live", AIReviewEligibility{}, HumanReleaseEvidence{})
	if len(checks) != 5 {
		t.Fatalf("expected all five evidence checks, got %v", checks)
	}
	for _, check := range checks {
		if check.Passed || check.Code == "" || check.Message == "" {
			t.Fatalf("missing evidence must have an actionable blocker: %+v", check)
		}
	}
	ai := AIReviewEligibility{ControlledPilotAllowed: true}
	human := HumanReleaseEvidence{SafeguardingApproved: true, ExactAudioReleaseApproved: true, RequiredAudioListeningApproved: true, ChildPilotEvidenceApproved: true}
	for _, check := range releaseEvidenceChecks("live", ai, human) {
		if !check.Passed {
			t.Fatalf("complete evidence failed: %+v", check)
		}
	}
}

func TestPostgresReleasePreflightReadsEvidenceWithoutStaging(t *testing.T) {
	pool, repo := openPaginationIntegrationRepository(t)
	manifest := validReleaseEvidenceManifest()
	manifest.SchemaVersion = "1.0"
	manifest.SourceRevision = "preflight-test"
	manifest.ExpectedPackCount = 1
	manifest.Packs[0].PackVersion = "1.0.0"
	raw, _ := json.Marshal(manifest.Packs)
	canonical, _ := canonicalJSON(raw)
	digest := sha256.Sum256(canonical)
	manifest.ManifestSHA256 = hex.EncodeToString(digest[:])
	manifest.ID = "nexuslearn-live-" + manifest.ManifestSHA256[:16]
	ctx := context.Background()
	result, err := repo.PreflightContentRelease(ctx, manifest)
	if err != nil {
		t.Fatal(err)
	}
	if result.EvidenceReady || result.ReleaseID != manifest.ID || len(result.Checks) != 5 {
		t.Fatalf("missing ledgers must return all blockers: %+v", result)
	}
	if result.AI.MissingLaneCount != 2 {
		t.Fatalf("expected two missing AI lanes: %+v", result.AI)
	}
	var count int
	if err := pool.QueryRow(ctx, "SELECT count(*) FROM content_releases").Scan(&count); err != nil {
		t.Fatal(err)
	}
	if count != 0 {
		t.Fatalf("preflight staged %d releases", count)
	}
	manifest.Channel = "review"
	if _, err := repo.PreflightContentRelease(ctx, manifest); err == nil {
		t.Fatal("review cannot claim live readiness")
	}
}
