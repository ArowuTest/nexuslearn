package learning

import (
	"errors"
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

func TestAIReviewCoverageMigrationPersistsVariantMembership(t *testing.T) {
	raw, err := os.ReadFile("../../migrations/0039_ai_review_variant_coverage.up.sql")
	if err != nil {
		t.Fatal(err)
	}
	sql := string(raw)
	for _, required := range []string{"reviewed_variant_ids jsonb", "jsonb_typeof(reviewed_variant_ids) = 'array'", "ai_review_evidence_current_idx"} {
		if !strings.Contains(sql, required) {
			t.Fatalf("coverage migration missing %q", required)
		}
	}
}

func validAIReviewEvidence() AIReviewEvidence {
	return AIReviewEvidence{
		ContentID:              "year-3-maths-fractions",
		ContentType:            "pack",
		ContentRevision:        "curriculum-v1",
		ContentHash:            strings.Repeat("a", 64),
		PackID:                 "year-3-maths-fractions",
		YearGroup:              3,
		Subject:                "mathematics",
		LaneID:                 "ai_curriculum_lead",
		Status:                 "approved",
		RiskTier:               "tier_1",
		RubricRevision:         "curriculum-send-v1",
		SourceSetRevision:      "sources-v1",
		ReviewerImplementation: "nexuslearn-ai-curriculum-send-review-v1",
		ModelIdentifier:        "gpt-5",
		Confidence:             0.95,
		CriterionResults:       map[string]any{"curriculum_alignment": "met"},
		SourceIDs:              []string{"dfe-national-curriculum-framework"},
		EvidenceNotes:          "Evidence is aligned to the cited programme of study.",
	}
}

func TestValidateAIReviewEvidenceRejectsHumanClaimsAndIncompleteIdentity(t *testing.T) {
	item := validAIReviewEvidence()
	item.LaneID = "teacher_review"
	if err := ValidateAIReviewEvidence(item); !errors.Is(err, ErrInvalidConfiguration) {
		t.Fatalf("expected invalid lane, got %v", err)
	}

	item = validAIReviewEvidence()
	item.EvidenceNotes = "Teacher approved this pack"
	if err := ValidateAIReviewEvidence(item); !errors.Is(err, ErrInvalidConfiguration) {
		t.Fatalf("expected prohibited human claim, got %v", err)
	}

	item = validAIReviewEvidence()
	item.ContentRevision = ""
	if err := ValidateAIReviewEvidence(item); !errors.Is(err, ErrInvalidConfiguration) {
		t.Fatalf("expected incomplete identity to fail, got %v", err)
	}
}

func TestValidateAIReviewEvidenceRequiresExactVariantCoverage(t *testing.T) {
	item := validAIReviewEvidence()
	item.ContentType = "variant_family"
	if err := ValidateAIReviewEvidence(item); !errors.Is(err, ErrInvalidConfiguration) {
		t.Fatalf("expected missing variant coverage to fail, got %v", err)
	}
	item.ReviewedVariantIDs = []string{"variant-1", "variant-1"}
	if err := ValidateAIReviewEvidence(item); !errors.Is(err, ErrInvalidConfiguration) {
		t.Fatalf("expected duplicate variant coverage to fail, got %v", err)
	}
	item.ReviewedVariantIDs = []string{"variant-1", "variant-2"}
	if err := ValidateAIReviewEvidence(item); err != nil {
		t.Fatalf("expected governed variant coverage to pass, got %v", err)
	}
}

func TestReviewIdentityCurrentRequiresExactMaterialIdentity(t *testing.T) {
	review := validAIReviewEvidence()
	identity := ReviewIdentityFromEvidence(review)
	if !ReviewEvidenceCurrent(review, identity) {
		t.Fatal("exact identity should be current")
	}

	identity.ContentHash = strings.Repeat("b", 64)
	if ReviewEvidenceCurrent(review, identity) {
		t.Fatal("changed hash must be stale")
	}
}

func approvedReview(identity ReviewIdentity, laneID string) AIReviewEvidence {
	review := validAIReviewEvidence()
	review.ContentID = identity.ContentID
	review.ContentHash = identity.ContentHash
	review.RubricRevision = identity.RubricRevision
	review.SourceSetRevision = identity.SourceSetRevision
	review.ReviewerImplementation = identity.ReviewerImplementation
	review.LaneID = laneID
	return review
}

func TestEvaluateReviewSetRequiresBothCurrentAILanes(t *testing.T) {
	identity := ReviewIdentity{
		ContentID:              "pack-1",
		ContentHash:            strings.Repeat("a", 64),
		RubricRevision:         "curriculum-send-v1",
		SourceSetRevision:      "sources-v1",
		ReviewerImplementation: "nexuslearn-ai-curriculum-send-review-v1",
	}
	reviews := []AIReviewEvidence{
		approvedReview(identity, AIReviewLaneCurriculum),
		approvedReview(identity, AIReviewLaneSEND),
	}

	got := EvaluateReviewSet([]ReviewIdentity{identity}, reviews)
	if !got.ControlledPilotAllowed || got.MissingLaneCount != 0 {
		t.Fatalf("unexpected gate %#v", got)
	}

	reviews[1].ContentHash = strings.Repeat("b", 64)
	got = EvaluateReviewSet([]ReviewIdentity{identity}, reviews)
	if got.ControlledPilotAllowed || got.StaleCount != 1 {
		t.Fatalf("stale review must block %#v", got)
	}
}

func TestEvaluateReviewSetBlocksRevisionAndEscalationDecisions(t *testing.T) {
	identity := ReviewIdentity{
		ContentID:              "variant-1",
		ContentHash:            strings.Repeat("c", 64),
		RubricRevision:         "curriculum-send-v1",
		SourceSetRevision:      "sources-v1",
		ReviewerImplementation: "nexuslearn-ai-curriculum-send-review-v1",
	}
	reviews := []AIReviewEvidence{
		approvedReview(identity, AIReviewLaneCurriculum),
		approvedReview(identity, AIReviewLaneSEND),
	}
	reviews[0].Status = "revision_required"
	reviews[1].Status = "escalation_required"

	got := EvaluateReviewSet([]ReviewIdentity{identity}, reviews)
	if got.ControlledPilotAllowed || got.RevisionRequiredCount != 1 || got.EscalationRequiredCount != 1 {
		t.Fatalf("non-approval decisions must block %#v", got)
	}
}
