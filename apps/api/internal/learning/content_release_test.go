package learning

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"testing"
)

func TestValidateReleaseManifestVerifiesDescriptorDigestAndTotals(t *testing.T) {
	packs := []ContentReleasePackDescriptor{{
		PackID: "ma-y5-example", PackVersion: "1.0.0", PayloadSHA256: stringOf('a', 64),
		ObjectiveCount: 1, ActivityCount: 1, QuestionCount: 240, RewardRuleCount: 1,
	}}
	raw, _ := json.Marshal(packs)
	canonical, _ := canonicalJSON(raw)
	digest := sha256.Sum256(canonical)
	manifestDigest := hex.EncodeToString(digest[:])
	manifest := ContentReleaseManifest{
		ID: "nexuslearn-review-" + manifestDigest[:16], SchemaVersion: "1.0", Channel: "review",
		ManifestSHA256: manifestDigest, CompleteSnapshot: true,
		ExpectedPackCount: 1, ExpectedObjectiveCount: 1, ExpectedActivityCount: 1,
		ExpectedQuestionCount: 240, ExpectedRewardRuleCount: 1, Packs: packs,
	}
	if err := validateReleaseManifest(manifest); err != nil {
		t.Fatalf("expected valid manifest: %v", err)
	}
	manifest.ExpectedQuestionCount = 239
	if err := validateReleaseManifest(manifest); !errors.Is(err, ErrInvalidConfiguration) {
		t.Fatalf("expected total validation error, got %v", err)
	}
	manifest.ExpectedQuestionCount = 240
	manifest.ManifestSHA256 = stringOf('0', 64)
	manifest.ID = "nexuslearn-review-0000000000000000"
	if err := validateReleaseManifest(manifest); !errors.Is(err, ErrContentReleaseDigest) {
		t.Fatalf("expected digest error, got %v", err)
	}
}

func TestValidateReleaseChannelRequiresRuntimeContentOutsideReview(t *testing.T) {
	payload := ContentReleasePackPayload{
		PackID:     "ma-y5-example",
		Activities: []ActivityConfig{{Status: "review"}},
		Questions:  []QuestionConfig{{Status: "review"}, {Status: "review"}, {Status: "review"}},
	}
	if err := validateReleaseChannelPayloads("review", []ContentReleasePackPayload{payload}); err != nil {
		t.Fatalf("review should allow staged content: %v", err)
	}
	if err := validateReleaseChannelPayloads("pilot", []ContentReleasePackPayload{payload}); !errors.Is(err, ErrInvalidConfiguration) {
		t.Fatalf("pilot should reject review content: %v", err)
	}
	payload.Activities[0].Status = "approved"
	for index := range payload.Questions {
		payload.Questions[index].Status = "approved"
	}
	if err := validateReleaseChannelPayloads("pilot", []ContentReleasePackPayload{payload}); err != nil {
		t.Fatalf("pilot should accept runtime content: %v", err)
	}
}

func TestValidateReleaseEvidenceMatrix(t *testing.T) {
	ai := AIReviewEligibility{ControlledPilotAllowed: true}
	human := HumanReleaseEvidence{}
	if err := ValidateReleaseEvidence("review", ai, human); err != nil {
		t.Fatalf("review should remain available for governed work: %v", err)
	}
	if err := ValidateReleaseEvidence("pilot", ai, human); err != nil {
		t.Fatalf("controlled pilot should require current dual AI evidence only: %v", err)
	}
	if err := ValidateReleaseEvidence("live", ai, human); !errors.Is(err, ErrContentReleaseIncomplete) {
		t.Fatalf("live must require human gates: %v", err)
	}

	human = HumanReleaseEvidence{
		SafeguardingApproved:           true,
		RequiredAudioListeningApproved: true,
		ChildPilotEvidenceApproved:     true,
	}
	if err := ValidateReleaseEvidence("live", ai, human); err != nil {
		t.Fatalf("complete AI and human evidence should allow live validation: %v", err)
	}

	ai.ControlledPilotAllowed = false
	for _, channel := range []string{"pilot", "live"} {
		if err := ValidateReleaseEvidence(channel, ai, human); !errors.Is(err, ErrContentReleaseIncomplete) {
			t.Fatalf("%s must fail closed without dual current AI evidence: %v", channel, err)
		}
	}
}

func TestReleaseEvidenceMetadataBindsEveryPackAndAudioHash(t *testing.T) {
	packHash := stringOf('a', 64)
	manifest := ContentReleaseManifest{
		Channel: "live",
		Packs:   []ContentReleasePackDescriptor{{PackID: "pack-1", PayloadSHA256: packHash}},
		Metadata: map[string]any{
			"ai_review_identities": []map[string]any{{
				"content_id": "pack-1", "content_hash": packHash,
				"rubric_revision": "curriculum-send-v1", "source_set_revision": "sources-v1",
				"reviewer_implementation": "nexuslearn-ai-curriculum-send-review-v1",
			}},
			"human_review_batch_id":     "batch-1",
			"human_review_batch_sha256": stringOf('b', 64),
			"required_audio_assets": []map[string]any{{
				"asset_id": "audio-1", "text_sha256": stringOf('c', 64), "audio_sha256": stringOf('d', 64),
			}},
		},
	}
	metadata, err := releaseEvidenceMetadata(manifest)
	if err != nil || len(metadata.AIReviewIdentities) != 1 || len(metadata.RequiredAudioAssets) != 1 {
		t.Fatalf("expected exact release evidence metadata, metadata=%#v err=%v", metadata, err)
	}

	manifest.Packs[0].PayloadSHA256 = stringOf('e', 64)
	if _, err := releaseEvidenceMetadata(manifest); !errors.Is(err, ErrInvalidConfiguration) {
		t.Fatalf("changed pack payload must invalidate review identity: %v", err)
	}
}

func stringOf(value rune, count int) string {
	items := make([]rune, count)
	for index := range items {
		items[index] = value
	}
	return string(items)
}
