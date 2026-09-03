package learning

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"strings"
	"testing"
)

func TestValidateAudioManifestImportRecomputesProductionIdentity(t *testing.T) {
	manifest := validAudioManifestImport(t)
	if err := ValidateAudioManifestImport(manifest); err != nil {
		t.Fatalf("valid audio import should pass: %v", err)
	}
	manifest.Assets[0].Text = "A changed transcript."
	if err := ValidateAudioManifestImport(manifest); err == nil {
		t.Fatal("transcript drift must fail even when caller-supplied hashes are unchanged")
	}
}

func TestValidateAudioManifestImportEnforcesBoundedBatch(t *testing.T) {
	manifest := validAudioManifestImport(t)
	manifest.Assets = make([]AudioManifestAsset, maxAudioManifestAssets+1)
	manifest.ProducedAssets = len(manifest.Assets)
	manifest.ExpectedAssets = len(manifest.Assets)
	if err := ValidateAudioManifestImport(manifest); err == nil {
		t.Fatal("oversized audio import must fail before persistence")
	}
}

func TestValidateAudioManifestImportRejectsDatabaseIncompatibleHashes(t *testing.T) {
	manifest := validAudioManifestImport(t)
	manifest.ReleaseSHA256 = manifest.ReleaseSHA256[:24] + strings.ToUpper(manifest.ReleaseSHA256[24:])
	if err := ValidateAudioManifestImport(manifest); err == nil {
		t.Fatal("uppercase release hashes must fail before the PostgreSQL transaction")
	}
	manifest = validAudioManifestImport(t)
	manifest.Assets[0].AudioSHA256 = " " + manifest.Assets[0].AudioSHA256
	if err := ValidateAudioManifestImport(manifest); err == nil {
		t.Fatal("whitespace-padded audio hashes must fail before the PostgreSQL transaction")
	}
}

func TestValidateAudioManifestImportRequiresSupportedLicence(t *testing.T) {
	manifest := validAudioManifestImport(t)
	manifest.LicenceID = ""
	if err := ValidateAudioManifestImport(manifest); err == nil {
		t.Fatal("missing provider licence must fail before persistence")
	}
	manifest.LicenceID = "unsupported_terms"
	if err := ValidateAudioManifestImport(manifest); err == nil {
		t.Fatal("unsupported provider licence must fail before persistence")
	}
}

func TestValidateAudioManifestImportRejectsUnknownReleaseStatus(t *testing.T) {
	manifest := validAudioManifestImport(t)
	manifest.Status = "trust_me_its_ready"
	if err := ValidateAudioManifestImport(manifest); err == nil {
		t.Fatal("unknown release status must fail before persistence")
	}
}

func TestValidateAudioRerecordRequestRequiresGovernedReasonAndNotes(t *testing.T) {
	request := AudioRerecordRequest{
		ReleaseID: "narration-release-v2-" + strings.Repeat("a", 24),
		AssetID:   "narration-v1-" + strings.Repeat("b", 24),
		Reason:    "pronunciation", Notes: "The final consonant needs a clearer take.",
	}
	if err := ValidateAudioRerecordRequest(request); err != nil {
		t.Fatalf("valid rerecord request should pass: %v", err)
	}
	request.Reason = "delete-everything"
	if err := ValidateAudioRerecordRequest(request); err == nil {
		t.Fatal("ungoverned rerecord reasons must fail")
	}
}

func validAudioManifestImport(t *testing.T) AudioManifestImport {
	t.Helper()
	text := "Blend the sounds."
	textSHA := audioTestSHA(text)
	settings := map[string]any{
		"similarity_boost": 0.75, "speed": 0.92, "stability": 0.5,
		"style": 0.15, "use_speaker_boost": true,
	}
	profile := map[string]any{
		"provider": "ElevenLabs", "voice_id": "alice-test", "model_id": "eleven_multilingual_v2",
		"output_format": "mp3_44100_128", "voice_settings": settings,
	}
	profileSHA := audioTestCanonicalSHA(t, profile)
	identitySHA := audioTestCanonicalSHA(t, map[string]any{
		"version": 1, "text_sha256": textSHA, "production_profile_sha256": profileSHA,
	})
	assetID := "narration-v1-" + identitySHA[:24]
	releaseSHA := strings.Repeat("a", 64)
	catalogueSHA := strings.Repeat("b", 64)
	return AudioManifestImport{
		ReleaseID: "narration-release-v2-" + releaseSHA[:24], ReleaseSHA256: releaseSHA,
		CatalogueID: "variant-audio-catalog-v1-" + catalogueSHA[:24], CatalogueSHA256: catalogueSHA,
		Provider: "ElevenLabs", LicenceID: "provider_terms", Status: "generated_pending_human_listening",
		ExpectedAssets: 1, ProducedAssets: 1, ReferenceIDs: 1,
		Assets: []AudioManifestAsset{{
			AssetID: assetID, Text: text, TextSHA256: textSHA, AudioSHA256: strings.Repeat("d", 64),
			ProductionIdentitySHA256: identitySHA, ProductionProfileSHA256: profileSHA,
			PackID: "en-y1-phonics", Year: 1, Kind: "variant",
			File:     "/audio/narration/alice/canonical/variant/" + assetID + ".mp3",
			Provider: "ElevenLabs", VoiceID: "alice-test", ModelID: "eleven_multilingual_v2",
			OutputFormat: "mp3_44100_128", VoiceSettings: settings,
			ProductionStatus: "required_human_listening_review", ReuseCount: 1, Bytes: 1234, TechnicalPass: true,
		}},
		References: []AudioManifestReference{{
			ReferenceID: "narration-en-y1-phonics--blend", Status: "production_required", ProductionAssetID: assetID,
			TextSHA256: textSHA, ProductionIdentitySHA256: identitySHA, ProductionProfileSHA256: profileSHA,
		}},
	}
}

func audioTestCanonicalSHA(t *testing.T, value any) string {
	t.Helper()
	body, err := json.Marshal(value)
	if err != nil {
		t.Fatal(err)
	}
	return audioTestSHA(string(body))
}

func audioTestSHA(value string) string {
	digest := sha256.Sum256([]byte(value))
	return hex.EncodeToString(digest[:])
}
