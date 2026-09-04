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
		ExactAudioReleaseApproved:      true,
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
			"audio_release_id":          "narration-release-v2-111111111111111111111111",
			"audio_release_sha256":      stringOf('1', 64),
			"audio_catalogue_id":        "variant-audio-catalog-v1-222222222222222222222222",
			"audio_catalogue_sha256":    stringOf('2', 64),
			"audio_licence_id":          "provider_terms",
			"required_audio_assets": []map[string]any{{
				"asset_id": "narration-v1-eeeeeeeeeeeeeeeeeeeeeeee", "text_sha256": stringOf('c', 64), "audio_sha256": stringOf('d', 64),
				"production_identity_sha256": stringOf('e', 64), "production_profile_sha256": stringOf('f', 64),
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

func TestReleaseEvidenceMetadataRequiresExactBoundedReviewEvidence(t *testing.T) {
	manifest := validReleaseEvidenceManifest()

	extraIdentity := map[string]any{
		"content_id": "pack-not-in-release", "content_hash": stringOf('9', 64),
		"rubric_revision": "curriculum-send-v1", "source_set_revision": "sources-v1",
		"reviewer_implementation": "nexuslearn-ai-curriculum-send-review-v1",
	}
	manifest.Metadata["ai_review_identities"] = append(
		manifest.Metadata["ai_review_identities"].([]map[string]any),
		extraIdentity,
	)
	if _, err := releaseEvidenceMetadata(manifest); !errors.Is(err, ErrInvalidConfiguration) {
		t.Fatalf("AI evidence must contain exactly one identity per released pack: %v", err)
	}

	manifest = validReleaseEvidenceManifest()
	manifest.Metadata["audit"] = map[string]any{"providerApiKey": "must-never-be-persisted"}
	if _, err := releaseEvidenceMetadata(manifest); !errors.Is(err, ErrInvalidConfiguration) {
		t.Fatalf("nested camel-case credential metadata must fail closed: %v", err)
	}

	manifest = validReleaseEvidenceManifest()
	assets := make([]map[string]any, maxAudioManifestAssets+1)
	for index := range assets {
		identity := sha256.Sum256([]byte(string(rune(index))))
		identitySHA := hex.EncodeToString(identity[:])
		assets[index] = map[string]any{
			"asset_id": "narration-v1-" + identitySHA[:24], "text_sha256": stringOf('c', 64), "audio_sha256": stringOf('d', 64),
			"production_identity_sha256": identitySHA, "production_profile_sha256": stringOf('f', 64),
		}
	}
	manifest.Metadata["required_audio_assets"] = assets
	if _, err := releaseEvidenceMetadata(manifest); !errors.Is(err, ErrInvalidConfiguration) {
		t.Fatalf("release audio evidence must enforce the import batch bound: %v", err)
	}
}

func TestReleaseEvidenceMetadataRequiresOneReviewPolicy(t *testing.T) {
	manifest := validReleaseEvidenceManifest()
	manifest.Packs = append(manifest.Packs, ContentReleasePackDescriptor{PackID: "pack-2", PayloadSHA256: stringOf('9', 64)})
	manifest.Metadata["ai_review_identities"] = append(
		manifest.Metadata["ai_review_identities"].([]map[string]any),
		map[string]any{
			"content_id": "pack-2", "content_hash": stringOf('9', 64),
			"rubric_revision": "curriculum-send-v2", "source_set_revision": "sources-v1",
			"reviewer_implementation": "nexuslearn-ai-curriculum-send-review-v1",
		},
	)
	if _, err := releaseEvidenceMetadata(manifest); !errors.Is(err, ErrInvalidConfiguration) {
		t.Fatalf("one release cannot mix AI review policies: %v", err)
	}
}

func TestReleaseEvidenceMetadataRejectsIncompleteExactAudioRelease(t *testing.T) {
	base := map[string]any{
		"ai_review_identities": []map[string]any{{
			"content_id": "pack-1", "content_hash": stringOf('a', 64),
			"rubric_revision": "rubric-v1", "source_set_revision": "sources-v1", "reviewer_implementation": "reviewer-v1",
		}},
		"human_review_batch_id": "batch-1", "human_review_batch_sha256": stringOf('b', 64),
		"audio_release_id": "narration-release-v2-111111111111111111111111", "audio_release_sha256": stringOf('1', 64),
		"audio_catalogue_id": "variant-audio-catalog-v1-222222222222222222222222", "audio_catalogue_sha256": stringOf('2', 64),
		"audio_licence_id": "provider_terms",
		"required_audio_assets": []map[string]any{{
			"asset_id": "narration-v1-eeeeeeeeeeeeeeeeeeeeeeee", "text_sha256": stringOf('c', 64), "audio_sha256": stringOf('d', 64),
			"production_identity_sha256": stringOf('e', 64), "production_profile_sha256": stringOf('f', 64),
		}},
	}
	manifest := ContentReleaseManifest{Channel: "live", Packs: []ContentReleasePackDescriptor{{PackID: "pack-1", PayloadSHA256: stringOf('a', 64)}}, Metadata: base}

	for _, field := range []string{"audio_release_id", "audio_release_sha256", "audio_catalogue_id", "audio_catalogue_sha256", "audio_licence_id"} {
		copyMetadata := map[string]any{}
		for key, value := range base {
			copyMetadata[key] = value
		}
		delete(copyMetadata, field)
		manifest.Metadata = copyMetadata
		if _, err := releaseEvidenceMetadata(manifest); !errors.Is(err, ErrInvalidConfiguration) {
			t.Fatalf("missing %s must fail closed: %v", field, err)
		}
	}

	copyMetadata := map[string]any{}
	for key, value := range base {
		copyMetadata[key] = value
	}
	copyMetadata["audio_licence_id"] = "unsupported_terms"
	manifest.Metadata = copyMetadata
	if _, err := releaseEvidenceMetadata(manifest); !errors.Is(err, ErrInvalidConfiguration) {
		t.Fatalf("unsupported audio licence must fail closed: %v", err)
	}

	copyMetadata = map[string]any{}
	for key, value := range base {
		copyMetadata[key] = value
	}
	copyMetadata["required_audio_assets"] = []map[string]any{{
		"asset_id": "narration-v1-ffffffffffffffffffffffff", "text_sha256": stringOf('c', 64), "audio_sha256": stringOf('d', 64),
		"production_identity_sha256": stringOf('e', 64), "production_profile_sha256": stringOf('f', 64),
	}}
	manifest.Metadata = copyMetadata
	if _, err := releaseEvidenceMetadata(manifest); !errors.Is(err, ErrInvalidConfiguration) {
		t.Fatalf("asset ID must bind the exact production identity: %v", err)
	}
}

func TestEvaluateExactAudioReleaseEvidenceRejectsLedgerDrift(t *testing.T) {
	assetID := "narration-v1-cccccccccccccccccccccccc"
	metadata := ReleaseEvidenceMetadata{
		AudioReleaseID: "narration-release-v2-111111111111111111111111", AudioReleaseSHA256: stringOf('1', 64),
		AudioCatalogueID: "variant-audio-catalog-v1-222222222222222222222222", AudioCatalogueSHA256: stringOf('2', 64), AudioLicenceID: "provider_terms",
		RequiredAudioAssets: []ReleaseAudioEvidenceIdentity{{
			AssetID: assetID, TextSHA256: stringOf('a', 64), AudioSHA256: stringOf('b', 64),
			ProductionIdentitySHA256: stringOf('c', 64), ProductionProfileSHA256: stringOf('d', 64),
		}},
	}
	release := audioReleaseLedgerEvidence{
		ReleaseID: metadata.AudioReleaseID, ReleaseSHA256: metadata.AudioReleaseSHA256,
		CatalogueID: metadata.AudioCatalogueID, CatalogueSHA256: metadata.AudioCatalogueSHA256,
		LicenceID: "provider_terms", Status: "generated_pending_human_listening",
		ExpectedAssets: 1, ProducedAssets: 1, SpecialistRequired: 0, Unresolved: 0,
	}
	asset := audioAssetLedgerEvidence{
		AssetID: assetID, TextSHA256: stringOf('a', 64), AudioSHA256: stringOf('b', 64),
		ProductionIdentitySHA256: stringOf('c', 64), ProductionProfileSHA256: stringOf('d', 64),
		ProductionStatus: "human_listening_approved", TechnicalPass: true,
	}
	review := audioReviewLedgerEvidence{
		AssetID: assetID, TextSHA256: stringOf('a', 64), AudioSHA256: stringOf('b', 64),
		ProductionProfileSHA256: stringOf('d', 64), Decision: "approved",
	}
	result := evaluateExactAudioReleaseEvidence(metadata, release, []audioAssetLedgerEvidence{asset}, []audioReviewLedgerEvidence{review})
	if !result.ExactAudioReleaseApproved || !result.RequiredAudioListeningApproved {
		t.Fatalf("exact current release should pass: %#v", result)
	}

	driftedRelease := release
	driftedRelease.CatalogueSHA256 = stringOf('e', 64)
	result = evaluateExactAudioReleaseEvidence(metadata, driftedRelease, []audioAssetLedgerEvidence{asset}, []audioReviewLedgerEvidence{review})
	if result.ExactAudioReleaseApproved {
		t.Fatal("catalogue drift must invalidate the exact audio release")
	}

	driftedAsset := asset
	driftedAsset.TechnicalPass = false
	result = evaluateExactAudioReleaseEvidence(metadata, release, []audioAssetLedgerEvidence{driftedAsset}, []audioReviewLedgerEvidence{review})
	if result.ExactAudioReleaseApproved {
		t.Fatal("technical failure must invalidate the exact audio release")
	}

	driftedAsset = asset
	driftedAsset.ProductionStatus = "re_record_required"
	result = evaluateExactAudioReleaseEvidence(metadata, release, []audioAssetLedgerEvidence{driftedAsset}, []audioReviewLedgerEvidence{review})
	if result.ExactAudioReleaseApproved || result.RequiredAudioListeningApproved {
		t.Fatal("an asset awaiting re-record must invalidate exact release and listening approval")
	}

	driftedReview := review
	driftedReview.ProductionProfileSHA256 = stringOf('f', 64)
	result = evaluateExactAudioReleaseEvidence(metadata, release, []audioAssetLedgerEvidence{asset}, []audioReviewLedgerEvidence{driftedReview})
	if result.RequiredAudioListeningApproved {
		t.Fatal("stale production-profile review must invalidate listening approval")
	}
}

func validReleaseEvidenceManifest() ContentReleaseManifest {
	packHash := stringOf('a', 64)
	return ContentReleaseManifest{
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
			"audio_release_id":          "narration-release-v2-111111111111111111111111",
			"audio_release_sha256":      stringOf('1', 64),
			"audio_catalogue_id":        "variant-audio-catalog-v1-222222222222222222222222",
			"audio_catalogue_sha256":    stringOf('2', 64),
			"audio_licence_id":          "provider_terms",
			"required_audio_assets": []map[string]any{{
				"asset_id": "narration-v1-eeeeeeeeeeeeeeeeeeeeeeee", "text_sha256": stringOf('c', 64), "audio_sha256": stringOf('d', 64),
				"production_identity_sha256": stringOf('e', 64), "production_profile_sha256": stringOf('f', 64),
			}},
		},
	}
}

func stringOf(value rune, count int) string {
	items := make([]rune, count)
	for index := range items {
		items[index] = value
	}
	return string(items)
}
