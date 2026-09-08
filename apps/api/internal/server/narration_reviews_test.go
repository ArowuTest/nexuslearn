package server

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/ArowuTest/nexuslearn/apps/api/internal/learning"
)

type narrationReviewTestRepository struct {
	*fakeRepository
	reviews []learning.NarrationReview
	saved   []learning.NarrationReview
	keys    []string
	limits  []int
	lookups [][]string
}

func (r *narrationReviewTestRepository) ListNarrationReviewsForAssets(_ context.Context, assetIDs []string) ([]learning.NarrationReview, error) {
	r.lookups = append(r.lookups, append([]string(nil), assetIDs...))
	ids := map[string]bool{}
	for _, id := range assetIDs {
		ids[id] = true
	}
	filtered := []learning.NarrationReview{}
	for _, review := range r.reviews {
		if ids[review.AssetID] {
			filtered = append(filtered, review)
		}
	}
	return filtered, nil
}

func (r *narrationReviewTestRepository) ListNarrationReviews(_ context.Context, assetID string, limit int) ([]learning.NarrationReview, error) {
	r.limits = append(r.limits, limit)
	if assetID != "" {
		filtered := []learning.NarrationReview{}
		for _, review := range r.reviews {
			if review.AssetID == assetID {
				filtered = append(filtered, review)
			}
		}
		return filtered, nil
	}
	end := len(r.reviews)
	if limit > 0 && end > limit {
		end = limit
	}
	return append([]learning.NarrationReview(nil), r.reviews[:end]...), nil
}

func (r *narrationReviewTestRepository) SaveNarrationReview(_ context.Context, review learning.NarrationReview, idempotencyKey string) (learning.NarrationReview, error) {
	r.saved = append(r.saved, review)
	r.keys = append(r.keys, idempotencyKey)
	r.reviews = append(r.reviews, review)
	return review, nil
}

func TestNarrationReviewQueuePaginatesAndFiltersTheWholeManifest(t *testing.T) {
	t.Setenv("ADMIN_API_KEY", "test-admin")
	manifestPath := filepath.Join(t.TempDir(), "narration-manifest.json")
	approvedTextHash := strings.Repeat("a", 64)
	approvedAudioHash := strings.Repeat("b", 64)
	rejectedTextHash := strings.Repeat("c", 64)
	rejectedAudioHash := strings.Repeat("d", 64)
	awaitingTextHash := strings.Repeat("e", 64)
	awaitingAudioHash := strings.Repeat("f", 64)
	manifest, err := json.Marshal(map[string]any{
		"provider": "ElevenLabs",
		"voice":    map[string]string{"name": "Alice", "model_id": "eleven_multilingual_v2"},
		"items": []map[string]any{
			{"id": "en-y1-phonics--lesson--blend", "pack_id": "en-y1-phonics", "kind": "lesson", "source_id": "blend", "text": "Blend the sounds.", "text_sha256": approvedTextHash, "sha256": approvedAudioHash, "file": "/audio/blend.mp3", "technical_pass": true},
			{"id": "ma-y3-number--lesson--place-value", "pack_id": "ma-y3-number", "kind": "lesson", "source_id": "place-value", "text": "Build the number.", "text_sha256": awaitingTextHash, "sha256": awaitingAudioHash, "file": "/audio/place-value.mp3", "technical_pass": true},
			{"id": "sc-y4-sound--vocabulary--pitch", "pack_id": "sc-y4-sound", "kind": "vocabulary", "source_id": "pitch", "text": "Pitch.", "text_sha256": rejectedTextHash, "sha256": rejectedAudioHash, "file": "/audio/pitch.mp3", "technical_pass": true},
		},
	})
	if err != nil {
		t.Fatalf("marshal manifest: %v", err)
	}
	if err := os.WriteFile(manifestPath, manifest, 0o600); err != nil {
		t.Fatalf("write manifest: %v", err)
	}
	t.Setenv("NARRATION_MANIFEST_PATH", manifestPath)

	repo := &narrationReviewTestRepository{
		fakeRepository: &fakeRepository{},
		reviews: []learning.NarrationReview{
			{AssetID: "en-y1-phonics--lesson--blend", TextSHA256: approvedTextHash, AudioSHA256: approvedAudioHash, Decision: "approved", ReviewerName: "A. Reviewer"},
			{AssetID: "sc-y4-sound--vocabulary--pitch", TextSHA256: rejectedTextHash, AudioSHA256: rejectedAudioHash, Decision: "rejected", ReviewerName: "A. Reviewer", Notes: "Pronunciation needs another take."},
		},
	}
	srv := New(repo, "postgres")

	request := httptest.NewRequest(http.MethodGet, "/v1/admin/content/narration-queue?status=awaiting&subject=Mathematics&year=3&limit=1&offset=0", nil)
	request.Header.Set("X-Admin-Key", "test-admin")
	response := httptest.NewRecorder()
	srv.ServeHTTP(response, request)
	if response.Code != http.StatusOK {
		t.Fatalf("expected queue to load, got %d: %s", response.Code, response.Body.String())
	}
	var payload struct {
		Items []struct {
			AssetID string `json:"asset_id"`
			Subject string `json:"subject"`
			Year    int    `json:"year"`
			Status  string `json:"status"`
		} `json:"items"`
		Total      int            `json:"total"`
		NextOffset *int           `json:"next_offset"`
		Counts     map[string]int `json:"counts"`
	}
	if err := json.Unmarshal(response.Body.Bytes(), &payload); err != nil {
		t.Fatalf("decode queue: %v", err)
	}
	if payload.Total != 1 || len(payload.Items) != 1 || payload.Items[0].AssetID != "ma-y3-number--lesson--place-value" {
		t.Fatalf("expected the filtered awaiting asset, got %#v", payload)
	}
	if payload.Items[0].Subject != "Mathematics" || payload.Items[0].Year != 3 || payload.Items[0].Status != "awaiting" {
		t.Fatalf("expected curriculum metadata and awaiting status, got %#v", payload.Items[0])
	}
	if payload.NextOffset != nil || payload.Counts["approved"] != 1 || payload.Counts["rejected"] != 1 || payload.Counts["awaiting"] != 1 {
		t.Fatalf("expected complete queue counts and no next page, got %#v", payload)
	}
	if len(repo.limits) != 0 || len(repo.lookups) != 1 || len(repo.lookups[0]) != 3 {
		t.Fatalf("expected one catalogue-scoped lookup for three assets, got lookups %#v and history limits %#v", repo.lookups, repo.limits)
	}
}

func TestNarrationQueueDoesNotLetRetiredAssetsDisplaceCurrentReview(t *testing.T) {
	t.Setenv("ADMIN_API_KEY", "test-admin")
	textHash, audioHash := strings.Repeat("a", 64), strings.Repeat("b", 64)
	manifest, err := json.Marshal(narrationManifest{Items: []narrationManifestItem{{
		ID: "active-recording", PackID: "en-y1-listening", Kind: "lesson", Text: "Listen carefully.",
		TextSHA256: textHash, SHA256: audioHash, File: "/audio/active.mp3", TechnicalPass: true,
	}}})
	if err != nil {
		t.Fatal(err)
	}
	manifestPath := filepath.Join(t.TempDir(), "manifest.json")
	if err := os.WriteFile(manifestPath, manifest, 0o600); err != nil {
		t.Fatal(err)
	}
	t.Setenv("NARRATION_MANIFEST_PATH", manifestPath)
	// The history endpoint legitimately lists newer retired assets first. The
	// active queue must scope its query before applying a result limit.
	repo := &narrationReviewTestRepository{fakeRepository: &fakeRepository{}, reviews: []learning.NarrationReview{
		{AssetID: "retired-recording", Decision: "rejected"},
		{AssetID: "active-recording", TextSHA256: textHash, AudioSHA256: audioHash, Decision: "approved", ReviewerName: "Synthetic reviewer"},
	}}
	request := httptest.NewRequest(http.MethodGet, "/v1/admin/content/narration-queue?status=all", nil)
	request.Header.Set("X-Admin-Key", "test-admin")
	response := httptest.NewRecorder()
	New(repo, "postgres").ServeHTTP(response, request)
	if response.Code != http.StatusOK {
		t.Fatalf("queue returned %d: %s", response.Code, response.Body.String())
	}
	var payload struct {
		Items  []narrationQueueItem `json:"items"`
		Counts map[string]int       `json:"counts"`
	}
	if err := json.Unmarshal(response.Body.Bytes(), &payload); err != nil {
		t.Fatal(err)
	}
	if len(payload.Items) != 1 || payload.Items[0].Status != "approved" || payload.Counts["approved"] != 1 || payload.Counts["awaiting"] != 0 {
		t.Fatalf("retired review displaced the active asset's decision: %#v", payload)
	}
	if len(repo.lookups) != 1 || len(repo.lookups[0]) != 1 || repo.lookups[0][0] != "active-recording" {
		t.Fatalf("queue must query only the active catalogue: %#v", repo.lookups)
	}
}

func TestNarrationReviewEndpointsEnforceAudioBindingAndCriteria(t *testing.T) {
	t.Setenv("ADMIN_API_KEY", "test-admin")
	manifestPath := filepath.Join(t.TempDir(), "narration-manifest.json")
	textHash := strings.Repeat("a", 64)
	audioHash := strings.Repeat("b", 64)
	manifest, err := json.Marshal(map[string]any{
		"items": []map[string]string{{
			"id":          "asset-1",
			"text_sha256": textHash,
			"sha256":      audioHash,
		}},
	})
	if err != nil {
		t.Fatalf("marshal manifest: %v", err)
	}
	if err := os.WriteFile(manifestPath, manifest, 0o600); err != nil {
		t.Fatalf("write manifest: %v", err)
	}
	t.Setenv("NARRATION_MANIFEST_PATH", manifestPath)

	repo := &narrationReviewTestRepository{fakeRepository: &fakeRepository{}}
	srv := New(repo, "postgres")

	get := httptest.NewRequest(http.MethodGet, "/v1/admin/content/narration-reviews?limit=20", nil)
	get.Header.Set("X-Admin-Key", "test-admin")
	getResponse := httptest.NewRecorder()
	srv.ServeHTTP(getResponse, get)
	if getResponse.Code != http.StatusOK {
		t.Fatalf("expected review list to be available, got %d", getResponse.Code)
	}

	missingCriteria := map[string]any{
		"asset_id": "asset-1", "text_sha256": textHash, "audio_sha256": audioHash,
		"decision": "approved", "reviewer_name": "A. Reviewer",
		"criteria": map[string]bool{"natural": true},
	}
	missingBody, _ := json.Marshal(missingCriteria)
	missingRequest := httptest.NewRequest(http.MethodPost, "/v1/admin/content/narration-reviews", bytes.NewReader(missingBody))
	missingRequest.Header.Set("X-Admin-Key", "test-admin")
	missingRequest.Header.Set("Idempotency-Key", "review-criteria-fail")
	missingResponse := httptest.NewRecorder()
	srv.ServeHTTP(missingResponse, missingRequest)
	if missingResponse.Code != http.StatusBadRequest {
		t.Fatalf("expected incomplete approval criteria to fail, got %d", missingResponse.Code)
	}
	if len(repo.saved) != 0 {
		t.Fatalf("incomplete approval should not be persisted")
	}

	workspaceWithoutPlayback := map[string]any{
		"asset_id": "asset-1", "text_sha256": textHash, "audio_sha256": audioHash,
		"decision": "approved", "reviewer_name": "A. Reviewer",
		"criteria": map[string]bool{
			"natural": true, "clear": true, "pronunciation": true, "age_suitable": true,
		},
		"playback_evidence": map[string]any{
			"surface": "admin_audio_workspace", "completed": false,
		},
	}
	workspaceWithoutPlaybackBody, _ := json.Marshal(workspaceWithoutPlayback)
	workspaceWithoutPlaybackRequest := httptest.NewRequest(http.MethodPost, "/v1/admin/content/narration-reviews", bytes.NewReader(workspaceWithoutPlaybackBody))
	workspaceWithoutPlaybackRequest.Header.Set("X-Admin-Key", "test-admin")
	workspaceWithoutPlaybackRequest.Header.Set("Idempotency-Key", "review-playback-fail")
	workspaceWithoutPlaybackResponse := httptest.NewRecorder()
	srv.ServeHTTP(workspaceWithoutPlaybackResponse, workspaceWithoutPlaybackRequest)
	if workspaceWithoutPlaybackResponse.Code != http.StatusBadRequest {
		t.Fatalf("workspace approval without playback completion should fail, got %d: %s", workspaceWithoutPlaybackResponse.Code, workspaceWithoutPlaybackResponse.Body.String())
	}

	approved := map[string]any{
		"asset_id": "asset-1", "text_sha256": textHash, "audio_sha256": audioHash,
		"decision": "approved", "reviewer_name": "A. Reviewer",
		"criteria": map[string]bool{
			"natural": true, "clear": true, "pronunciation": true, "age_suitable": true,
		},
		"playback_evidence": map[string]any{
			"surface": "admin_audio_workspace", "completed": true, "duration_ms": 7250,
		},
	}
	approvedBody, _ := json.Marshal(approved)
	approvedRequest := httptest.NewRequest(http.MethodPost, "/v1/admin/content/narration-reviews", bytes.NewReader(approvedBody))
	approvedRequest.Header.Set("X-Admin-Key", "test-admin")
	approvedRequest.Header.Set("Idempotency-Key", "review-asset-1")
	approvedResponse := httptest.NewRecorder()
	srv.ServeHTTP(approvedResponse, approvedRequest)
	if approvedResponse.Code != http.StatusOK {
		t.Fatalf("expected complete approval to persist, got %d: %s", approvedResponse.Code, approvedResponse.Body.String())
	}
	if len(repo.saved) != 1 || repo.keys[0] != "review-asset-1" || repo.saved[0].Decision != "approved" {
		t.Fatalf("expected one persisted approval with idempotency key, saved=%#v keys=%#v", repo.saved, repo.keys)
	}

	rejected := map[string]any{
		"asset_id": "asset-1", "text_sha256": textHash, "audio_sha256": audioHash,
		"decision": "rejected", "reviewer_name": "A. Reviewer",
		"criteria":          map[string]bool{"natural": true, "clear": false},
		"rejection_reasons": []string{"pronunciation"}, "notes": "Re-record the final consonant.",
	}
	rejectedBody, _ := json.Marshal(rejected)
	rejectedRequest := httptest.NewRequest(http.MethodPost, "/v1/admin/content/narration-reviews", bytes.NewReader(rejectedBody))
	rejectedRequest.Header.Set("X-Admin-Key", "test-admin")
	rejectedRequest.Header.Set("Idempotency-Key", "review-asset-1-rerecord")
	rejectedResponse := httptest.NewRecorder()
	srv.ServeHTTP(rejectedResponse, rejectedRequest)
	if rejectedResponse.Code != http.StatusOK || len(repo.saved) != 2 || len(repo.reviews) != 2 {
		t.Fatalf("expected an immutable rejected decision alongside the approval, status=%d saved=%d history=%d", rejectedResponse.Code, len(repo.saved), len(repo.reviews))
	}

	stale := map[string]any{
		"asset_id": "asset-1", "text_sha256": strings.Repeat("c", 64), "audio_sha256": audioHash,
		"decision": "approved", "reviewer_name": "A. Reviewer",
		"criteria": map[string]bool{
			"natural": true, "clear": true, "pronunciation": true, "age_suitable": true,
		},
	}
	staleBody, _ := json.Marshal(stale)
	staleRequest := httptest.NewRequest(http.MethodPost, "/v1/admin/content/narration-reviews", bytes.NewReader(staleBody))
	staleRequest.Header.Set("X-Admin-Key", "test-admin")
	staleResponse := httptest.NewRecorder()
	srv.ServeHTTP(staleResponse, staleRequest)
	if staleResponse.Code != http.StatusConflict {
		t.Fatalf("expected changed script hash to be rejected, got %d", staleResponse.Code)
	}
	if len(repo.saved) != 2 {
		t.Fatalf("stale review must not be persisted")
	}
}
