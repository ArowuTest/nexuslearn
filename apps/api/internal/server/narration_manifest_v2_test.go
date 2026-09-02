package server

import (
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/ArowuTest/nexuslearn/apps/api/internal/learning"
)

func TestNarrationV2ReviewRequiresExactProfileBinding(t *testing.T) {
	t.Setenv("ADMIN_API_KEY", "test-admin")
	manifestPath := writeNarrationManifestV2Fixture(t, nil)
	t.Setenv("NARRATION_MANIFEST_PATH", manifestPath)
	manifest, _, err := readNarrationManifest()
	if err != nil {
		t.Fatal(err)
	}
	asset := manifest.Items[0]
	repo := &narrationReviewTestRepository{
		fakeRepository: &fakeRepository{},
		reviews: []learning.NarrationReview{{
			AssetID: asset.ID, TextSHA256: asset.TextSHA256, AudioSHA256: asset.SHA256,
			Decision: "approved", ReviewerName: "Legacy Reviewer",
		}},
	}
	srv := New(repo, "postgres")

	queueRequest := httptest.NewRequest(http.MethodGet, "/v1/admin/content/narration-queue?status=all&limit=1", nil)
	queueRequest.Header.Set("X-Admin-Key", "test-admin")
	queueResponse := httptest.NewRecorder()
	srv.ServeHTTP(queueResponse, queueRequest)
	if queueResponse.Code != http.StatusOK {
		t.Fatalf("expected v2 queue, got %d: %s", queueResponse.Code, queueResponse.Body.String())
	}
	var queue struct {
		ReleaseID   string           `json:"release_id"`
		CatalogueID string           `json:"catalogue_id"`
		Items       []map[string]any `json:"items"`
	}
	if err := json.Unmarshal(queueResponse.Body.Bytes(), &queue); err != nil {
		t.Fatal(err)
	}
	if len(queue.Items) != 1 || queue.Items[0]["production_profile_sha256"] != asset.ProductionProfileSHA256 || queue.Items[0]["production_identity_sha256"] != asset.ProductionIdentitySHA256 || queue.Items[0]["reuse_count"] != float64(1) {
		t.Fatalf("expected safe v2 production metadata in queue, got %#v", queue.Items)
	}
	if queue.ReleaseID != manifest.ReleaseID || queue.CatalogueID != manifest.CatalogueID {
		t.Fatalf("expected queue to bind release %q and catalogue %q, got %#v", manifest.ReleaseID, manifest.CatalogueID, queue)
	}
	if queue.Items[0]["status"] != "stale" {
		t.Fatalf("expected a legacy approval without the v2 profile hash to be stale, got %#v", queue.Items[0])
	}

	baseReview := map[string]any{
		"asset_id": asset.ID, "text_sha256": asset.TextSHA256, "audio_sha256": asset.SHA256,
		"decision": "approved", "reviewer_name": "A. Reviewer",
		"criteria": map[string]bool{"natural": true, "clear": true, "pronunciation": true, "age_suitable": true},
	}
	missingBody, _ := json.Marshal(baseReview)
	missingRequest := httptest.NewRequest(http.MethodPost, "/v1/admin/content/narration-reviews", bytes.NewReader(missingBody))
	missingRequest.Header.Set("X-Admin-Key", "test-admin")
	missingResponse := httptest.NewRecorder()
	srv.ServeHTTP(missingResponse, missingRequest)
	if missingResponse.Code != http.StatusConflict || len(repo.saved) != 0 {
		t.Fatalf("expected missing v2 profile binding to fail closed, status=%d saved=%d", missingResponse.Code, len(repo.saved))
	}

	baseReview["production_profile_sha256"] = asset.ProductionProfileSHA256
	approvedBody, _ := json.Marshal(baseReview)
	approvedRequest := httptest.NewRequest(http.MethodPost, "/v1/admin/content/narration-reviews", bytes.NewReader(approvedBody))
	approvedRequest.Header.Set("X-Admin-Key", "test-admin")
	approvedRequest.Header.Set("Idempotency-Key", "v2-review-asset")
	approvedResponse := httptest.NewRecorder()
	srv.ServeHTTP(approvedResponse, approvedRequest)
	if approvedResponse.Code != http.StatusOK || len(repo.saved) != 1 {
		t.Fatalf("expected exact v2 profile binding to save, status=%d body=%s", approvedResponse.Code, approvedResponse.Body.String())
	}
	var saved map[string]any
	if err := json.Unmarshal(approvedResponse.Body.Bytes(), &saved); err != nil {
		t.Fatal(err)
	}
	if saved["production_profile_sha256"] != asset.ProductionProfileSHA256 {
		t.Fatalf("expected persisted profile binding, got %#v", saved)
	}
}

func TestReadNarrationManifestAcceptsSignedV2ProductionBindings(t *testing.T) {
	manifestPath := writeNarrationManifestV2Fixture(t, nil)
	t.Setenv("NARRATION_MANIFEST_PATH", manifestPath)

	manifest, source, err := readNarrationManifest()
	if err != nil {
		t.Fatalf("expected signed v2 manifest to load: %v", err)
	}
	if source != manifestPath {
		t.Fatalf("expected configured manifest source, got %q", source)
	}
	if manifest.Schema != "nexuslearn.narration-manifest.v2" || manifest.Version != 2 {
		t.Fatalf("expected v2 identity to be preserved, got schema=%q version=%d", manifest.Schema, manifest.Version)
	}
	if len(manifest.Items) != 1 || !strings.HasPrefix(manifest.Items[0].ID, "narration-v1-") {
		t.Fatalf("expected one canonical v2 asset to become a review binding, got %#v", manifest.Items)
	}
	if len(manifest.References) != 1 || manifest.References[0].ReferenceID != "narration-en-y1-phonics--blend" {
		t.Fatalf("expected the governed runtime alias to remain available, got %#v", manifest.References)
	}
}

func TestReadNarrationManifestRejectsV2ProfileHashDrift(t *testing.T) {
	manifestPath := writeNarrationManifestV2Fixture(t, func(identity map[string]any) {
		assets := identity["assets"].([]map[string]any)
		assets[0]["production_profile_sha256"] = strings.Repeat("f", 64)
	})
	t.Setenv("NARRATION_MANIFEST_PATH", manifestPath)

	_, _, err := readNarrationManifest()
	if err == nil || !strings.Contains(err.Error(), "production profile") {
		t.Fatalf("expected profile drift to fail closed, got %v", err)
	}
}

func TestReadNarrationManifestRejectsDuplicateV2ReferenceAlias(t *testing.T) {
	manifestPath := writeNarrationManifestV2Fixture(t, func(identity map[string]any) {
		references := identity["references"].([]map[string]any)
		identity["references"] = append(references, cloneMap(references[0]))
	})
	t.Setenv("NARRATION_MANIFEST_PATH", manifestPath)

	_, _, err := readNarrationManifest()
	if err == nil || !strings.Contains(err.Error(), "duplicate narration reference") {
		t.Fatalf("expected duplicate alias to fail closed, got %v", err)
	}
}

func TestReadNarrationManifestRejectsUnsafeSignedV2FileURL(t *testing.T) {
	manifestPath := writeNarrationManifestV2Fixture(t, func(identity map[string]any) {
		assets := identity["assets"].([]map[string]any)
		assets[0]["file"] = "/audio/narration/../../private/canonical/variant/" + assets[0]["id"].(string) + ".mp3"
	})
	t.Setenv("NARRATION_MANIFEST_PATH", manifestPath)

	_, _, err := readNarrationManifest()
	if err == nil || !strings.Contains(err.Error(), "file binding") {
		t.Fatalf("expected unsafe audio URL to fail closed, got %v", err)
	}
}

func TestReadNarrationManifestRejectsSecretShapedSignedFields(t *testing.T) {
	manifestPath := writeNarrationManifestV2Fixture(t, func(identity map[string]any) {
		provenance := identity["provenance"].(map[string]any)
		provenance["provider_api_key"] = "must-never-be-persisted"
	})
	t.Setenv("NARRATION_MANIFEST_PATH", manifestPath)

	_, _, err := readNarrationManifest()
	if err == nil || !strings.Contains(err.Error(), "credential-shaped") {
		t.Fatalf("expected credential-shaped manifest data to fail closed, got %v", err)
	}
}

func TestReadNarrationManifestRejectsUnsupportedSchemaVersion(t *testing.T) {
	manifestPath := filepath.Join(t.TempDir(), "unsupported-manifest.json")
	body, err := json.Marshal(map[string]any{
		"schema": "nexuslearn.narration-manifest.v3", "version": 3,
		"items": []map[string]any{{
			"id": "legacy-shaped-asset", "text_sha256": strings.Repeat("a", 64),
			"sha256": strings.Repeat("b", 64), "technical_pass": true,
		}},
	})
	if err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(manifestPath, body, 0o600); err != nil {
		t.Fatal(err)
	}
	t.Setenv("NARRATION_MANIFEST_PATH", manifestPath)

	_, _, err = readNarrationManifest()
	if err == nil || !strings.Contains(err.Error(), "unsupported narration manifest") {
		t.Fatalf("expected unsupported schema to fail closed, got %v", err)
	}
}

func TestReadNarrationManifestAcceptsSignedPartialV2Batch(t *testing.T) {
	manifestPath := writeNarrationManifestV2Fixture(t, func(identity map[string]any) {
		references := identity["references"].([]map[string]any)
		pending := cloneMap(references[0])
		pending["reference_id"] = "narration-ma-y2-number--pending"
		pending["production_asset_id"] = "narration-v1-" + strings.Repeat("b", 24)
		pending["production_identity_sha256"] = strings.Repeat("b", 64)
		pending["production_profile_sha256"] = strings.Repeat("c", 64)
		identity["references"] = append(references, pending)
	})
	t.Setenv("NARRATION_MANIFEST_PATH", manifestPath)

	manifest, _, err := readNarrationManifest()
	if err != nil {
		t.Fatalf("expected a signed resumable partial batch to load: %v", err)
	}
	if manifest.Totals.ExpectedAssets != 2 || manifest.Totals.ProducedAssets != 1 {
		t.Fatalf("expected one produced and one pending asset, got %#v", manifest.Totals)
	}
}

func writeNarrationManifestV2Fixture(t *testing.T, mutate func(map[string]any)) string {
	t.Helper()
	text := "Blend the sounds."
	textSHA := testSHA256(text)
	profile := map[string]any{
		"provider":      "ElevenLabs",
		"voice_id":      "alice-test",
		"model_id":      "eleven_multilingual_v2",
		"output_format": "mp3_44100_128",
		"voice_settings": map[string]any{
			"similarity_boost":  0.75,
			"speed":             0.92,
			"stability":         0.5,
			"style":             0.15,
			"use_speaker_boost": true,
		},
	}
	profileSHA := testCanonicalSHA256(t, profile)
	productionIdentity := map[string]any{
		"version": 1, "text_sha256": textSHA, "production_profile_sha256": profileSHA,
	}
	identitySHA := testCanonicalSHA256(t, productionIdentity)
	assetID := "narration-v1-" + identitySHA[:24]
	referenceID := "narration-en-y1-phonics--blend"
	asset := map[string]any{
		"id": assetID, "production_asset_id": assetID,
		"production_identity_sha256": identitySHA, "production_profile_sha256": profileSHA,
		"kind": "variant", "source_id": assetID, "pack_id": "en-y1-phonics", "pack_ids": []string{"en-y1-phonics"},
		"year": 1, "years": []int{1}, "text": text, "text_sha256": textSHA,
		"provider": profile["provider"], "voice_id": profile["voice_id"], "model_id": profile["model_id"],
		"output_format": profile["output_format"], "voice_settings": profile["voice_settings"],
		"reference_ids": []string{referenceID}, "reuse_count": 1,
		"relative_file":     "canonical/variant/" + assetID + ".mp3",
		"file":              "/audio/narration/alice/canonical/variant/" + assetID + ".mp3",
		"production_status": "required_human_listening_review",
		"sha256":            strings.Repeat("d", 64), "bytes": 1234, "technical_pass": true,
	}
	reference := map[string]any{
		"reference_id": referenceID, "status": "production_required", "text": text, "text_sha256": textSHA,
		"text_sources": []string{"body.narration_text"},
		"occurrences": []map[string]any{{
			"pack_id": "en-y1-phonics", "year": 1, "subject": "English", "source_variant_id": "blend",
			"reference_field": "audio_asset_id", "reference_location": "body.audio_asset_id", "text_source": "body.narration_text",
		}},
		"production_asset_id": assetID, "production_identity_sha256": identitySHA, "production_profile_sha256": profileSHA,
	}
	identity := map[string]any{
		"schema": "nexuslearn.narration-manifest.v2", "version": 2,
		"catalogue_id":     "variant-audio-catalog-v1-" + strings.Repeat("a", 24),
		"catalogue_sha256": strings.Repeat("a", 64),
		"provenance":       map[string]any{"producer": "test"},
		"assets":           []map[string]any{asset}, "references": []map[string]any{reference}, "blockers": []map[string]any{},
	}
	if mutate != nil {
		mutate(identity)
	}
	releaseSHA := testCanonicalSHA256(t, identity)
	manifest := cloneMap(identity)
	manifest["release_id"] = "narration-release-v2-" + releaseSHA[:24]
	manifest["release_sha256"] = releaseSHA
	manifest["generated_at"] = "2026-08-30T00:00:00Z"
	manifest["status"] = "generated_pending_human_listening"
	manifest["provider"] = "ElevenLabs"
	productionTargets := map[string]struct{}{}
	for _, item := range identity["references"].([]map[string]any) {
		if target, ok := item["production_asset_id"].(string); ok && target != "" {
			productionTargets[target] = struct{}{}
		}
	}
	manifest["totals"] = map[string]any{
		"expected_assets": len(productionTargets), "produced_assets": len(identity["assets"].([]map[string]any)),
		"reference_ids": len(identity["references"].([]map[string]any)), "specialist_required": 0, "unresolved": 0,
	}

	body, err := json.Marshal(manifest)
	if err != nil {
		t.Fatalf("marshal v2 narration manifest: %v", err)
	}
	path := filepath.Join(t.TempDir(), "narration-manifest-v2.json")
	if err := os.WriteFile(path, body, 0o600); err != nil {
		t.Fatalf("write v2 narration manifest: %v", err)
	}
	return path
}

func testCanonicalSHA256(t *testing.T, value any) string {
	t.Helper()
	body, err := json.Marshal(value)
	if err != nil {
		t.Fatalf("marshal canonical test value: %v", err)
	}
	return testSHA256(string(body))
}

func testSHA256(value string) string {
	sum := sha256.Sum256([]byte(value))
	return hex.EncodeToString(sum[:])
}

func cloneMap(value map[string]any) map[string]any {
	body, _ := json.Marshal(value)
	var cloned map[string]any
	_ = json.Unmarshal(body, &cloned)
	return cloned
}
