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

func stringOf(value rune, count int) string {
	items := make([]rune, count)
	for index := range items {
		items[index] = value
	}
	return string(items)
}
