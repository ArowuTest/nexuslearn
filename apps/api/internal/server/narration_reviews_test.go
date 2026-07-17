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
}

func (r *narrationReviewTestRepository) ListNarrationReviews(context.Context, string, int) ([]learning.NarrationReview, error) {
	return append([]learning.NarrationReview(nil), r.reviews...), nil
}

func (r *narrationReviewTestRepository) SaveNarrationReview(_ context.Context, review learning.NarrationReview, idempotencyKey string) (learning.NarrationReview, error) {
	r.saved = append(r.saved, review)
	r.keys = append(r.keys, idempotencyKey)
	r.reviews = append([]learning.NarrationReview(nil), review)
	return review, nil
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

	approved := map[string]any{
		"asset_id": "asset-1", "text_sha256": textHash, "audio_sha256": audioHash,
		"decision": "approved", "reviewer_name": "A. Reviewer",
		"criteria": map[string]bool{
			"natural": true, "clear": true, "pronunciation": true, "age_suitable": true,
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
	if len(repo.saved) != 1 {
		t.Fatalf("stale review must not be persisted")
	}
}
