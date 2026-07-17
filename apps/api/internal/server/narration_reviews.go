package server

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"os"
	"strconv"
	"strings"

	"github.com/ArowuTest/nexuslearn/apps/api/internal/learning"
)

type narrationReviewRepository interface {
	ListNarrationReviews(context.Context, string, int) ([]learning.NarrationReview, error)
	SaveNarrationReview(context.Context, learning.NarrationReview, string) (learning.NarrationReview, error)
}

type narrationManifestItem struct {
	ID         string `json:"id"`
	TextSHA256 string `json:"text_sha256"`
	SHA256     string `json:"sha256"`
}

type narrationManifest struct {
	Items []narrationManifestItem `json:"items"`
}

func (s *Server) handleNarrationReviews(w http.ResponseWriter, r *http.Request) {
	if !s.requireAdmin(w, r) {
		return
	}
	repository, ok := s.repo.(narrationReviewRepository)
	if !ok {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": "narration review persistence is not available"})
		return
	}
	limit := 100
	if raw := strings.TrimSpace(r.URL.Query().Get("limit")); raw != "" {
		if parsed, err := strconv.Atoi(raw); err == nil {
			limit = parsed
		}
	}
	reviews, err := repository.ListNarrationReviews(r.Context(), strings.TrimSpace(r.URL.Query().Get("asset_id")), limit)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "could not read narration reviews"})
		return
	}
	bindings, _, manifestErr := readNarrationBindings()
	if manifestErr == nil {
		for i := range reviews {
			binding, exists := bindings[reviews[i].AssetID]
			reviews[i].Stale = !exists || binding.TextSHA256 != reviews[i].TextSHA256 || binding.SHA256 != reviews[i].AudioSHA256
		}
	}
	writeJSON(w, http.StatusOK, map[string]any{"reviews": reviews, "served_by": "api", "manifest_available": manifestErr == nil})
}

func (s *Server) handleSaveNarrationReview(w http.ResponseWriter, r *http.Request) {
	reviewerID, ok := s.requireNarrationReviewer(w, r)
	if !ok {
		return
	}
	repository, ok := s.repo.(narrationReviewRepository)
	if !ok {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": "narration review persistence is not available"})
		return
	}
	var in struct {
		AssetID          string          `json:"asset_id"`
		TextSHA256       string          `json:"text_sha256"`
		AudioSHA256      string          `json:"audio_sha256"`
		Decision         string          `json:"decision"`
		ReviewerName     string          `json:"reviewer_name"`
		Criteria         map[string]bool `json:"criteria"`
		RejectionReasons []string        `json:"rejection_reasons"`
		Notes            string          `json:"notes"`
	}
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid narration review body"})
		return
	}
	in.AssetID = strings.TrimSpace(in.AssetID)
	in.TextSHA256 = strings.ToLower(strings.TrimSpace(in.TextSHA256))
	in.AudioSHA256 = strings.ToLower(strings.TrimSpace(in.AudioSHA256))
	in.Decision = strings.ToLower(strings.TrimSpace(in.Decision))
	in.ReviewerName = strings.TrimSpace(in.ReviewerName)
	bindings, _, err := readNarrationBindings()
	if err != nil {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": "narration manifest is not available"})
		return
	}
	binding, found := bindings[in.AssetID]
	if !found {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "narration asset is not registered"})
		return
	}
	if binding.TextSHA256 != in.TextSHA256 || binding.SHA256 != in.AudioSHA256 {
		writeJSON(w, http.StatusConflict, map[string]any{
			"error":    "narration asset changed; refresh the review queue before saving",
			"asset_id": in.AssetID, "text_sha256": binding.TextSHA256, "audio_sha256": binding.SHA256,
		})
		return
	}
	reviewInput := learning.NarrationReview{
		AssetID: in.AssetID, TextSHA256: in.TextSHA256, AudioSHA256: in.AudioSHA256,
		Decision: in.Decision, ReviewerID: reviewerID, ReviewerName: in.ReviewerName,
		Criteria: in.Criteria, RejectionReasons: in.RejectionReasons, Notes: strings.TrimSpace(in.Notes),
	}
	if err := learning.ValidateNarrationReview(reviewInput); err != nil {
		s.writeAdminSaveError(w, err, "narration review")
		return
	}
	review, err := repository.SaveNarrationReview(r.Context(), reviewInput, requestIdempotencyKey(r, ""))
	if err != nil {
		s.writeAdminSaveError(w, err, "narration review")
		return
	}
	writeJSON(w, http.StatusOK, review)
}

func (s *Server) requireNarrationReviewer(w http.ResponseWriter, r *http.Request) (string, bool) {
	if bearerToken(r) != "" {
		payload, ok := s.requireAccountSession(w, r, "platform_admin", "content_reviewer")
		return payload.UserID, ok
	}
	if !s.requireAdmin(w, r) {
		return "", false
	}
	return "", true
}

func readNarrationBindings() (map[string]narrationManifestItem, string, error) {
	candidates := []string{}
	if configured := strings.TrimSpace(os.Getenv("NARRATION_MANIFEST_PATH")); configured != "" {
		candidates = append(candidates, configured)
	}
	candidates = append(candidates,
		"apps/web/public/content/narration-manifest.json",
		"../../apps/web/public/content/narration-manifest.json",
		"packages/content/audio/narration-manifest.json",
		"../../packages/content/audio/narration-manifest.json",
	)
	var lastErr error
	for _, candidate := range candidates {
		body, err := os.ReadFile(candidate)
		if err != nil {
			lastErr = err
			continue
		}
		var manifest narrationManifest
		if err := json.Unmarshal(body, &manifest); err != nil {
			return nil, candidate, err
		}
		bindings := make(map[string]narrationManifestItem, len(manifest.Items))
		for _, item := range manifest.Items {
			if strings.TrimSpace(item.ID) != "" {
				bindings[item.ID] = item
			}
		}
		return bindings, candidate, nil
	}
	if lastErr == nil {
		lastErr = errors.New("narration manifest not found")
	}
	return nil, "", lastErr
}
