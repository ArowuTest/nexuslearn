package server

import (
	"context"
	"encoding/hex"
	"encoding/json"
	"errors"
	"net/http"
	"os"
	"sort"
	"strconv"
	"strings"

	"github.com/ArowuTest/nexuslearn/apps/api/internal/learning"
)

type narrationReviewRepository interface {
	ListNarrationReviews(context.Context, string, int) ([]learning.NarrationReview, error)
	SaveNarrationReview(context.Context, learning.NarrationReview, string) (learning.NarrationReview, error)
}

type narrationManifestItem struct {
	ID            string `json:"id"`
	PackID        string `json:"pack_id"`
	Kind          string `json:"kind"`
	SourceID      string `json:"source_id"`
	Text          string `json:"text"`
	TextSHA256    string `json:"text_sha256"`
	SHA256        string `json:"sha256"`
	File          string `json:"file"`
	RelativeFile  string `json:"relative_file"`
	VoiceName     string `json:"voice_name"`
	ModelID       string `json:"model_id"`
	TechnicalPass bool   `json:"technical_pass"`
}

type narrationManifest struct {
	Provider string `json:"provider"`
	Voice    struct {
		Name    string `json:"name"`
		ModelID string `json:"model_id"`
	} `json:"voice"`
	Items []narrationManifestItem `json:"items"`
}

type narrationQueueItem struct {
	Rank        int                       `json:"rank"`
	AssetID     string                    `json:"asset_id"`
	PackID      string                    `json:"pack_id"`
	Year        int                       `json:"year"`
	Subject     string                    `json:"subject"`
	Kind        string                    `json:"kind"`
	SourceID    string                    `json:"source_id"`
	TextPreview string                    `json:"text_preview"`
	File        string                    `json:"file"`
	TextSHA256  string                    `json:"text_sha256"`
	AudioSHA256 string                    `json:"audio_sha256"`
	VoiceName   string                    `json:"voice_name,omitempty"`
	ModelID     string                    `json:"model_id,omitempty"`
	Status      string                    `json:"status"`
	Review      *learning.NarrationReview `json:"review,omitempty"`
	Priority    int                       `json:"priority"`
	Rationale   []string                  `json:"rationale"`
}

type narrationQueueYearSummary struct {
	Year     int            `json:"year"`
	Counts   map[string]int `json:"counts"`
	Reviewed int            `json:"reviewed"`
	Pending  int            `json:"pending"`
}

func (s *Server) handleNarrationReviewQueue(w http.ResponseWriter, r *http.Request) {
	if !s.requireAdmin(w, r) {
		return
	}
	repository, ok := s.repo.(narrationReviewRepository)
	if !ok {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": "narration review persistence is not available"})
		return
	}
	manifest, _, err := readNarrationManifest()
	if err != nil {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": "narration manifest is not available"})
		return
	}
	reviews, err := repository.ListNarrationReviews(r.Context(), "", len(manifest.Items))
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "could not read narration reviews"})
		return
	}
	latestReview := make(map[string]learning.NarrationReview, len(reviews))
	for _, review := range reviews {
		if _, exists := latestReview[review.AssetID]; !exists {
			latestReview[review.AssetID] = review
		}
	}

	allItems := make([]narrationQueueItem, 0, len(manifest.Items))
	counts := map[string]int{"awaiting": 0, "approved": 0, "rejected": 0, "stale": 0}
	yearCounts := map[int]map[string]int{}
	for _, asset := range manifest.Items {
		if !asset.TechnicalPass {
			continue
		}
		year, subject := narrationCurriculumIdentity(asset.PackID)
		voiceName := asset.VoiceName
		if voiceName == "" {
			voiceName = manifest.Voice.Name
		}
		modelID := asset.ModelID
		if modelID == "" {
			modelID = manifest.Voice.ModelID
		}
		status := "awaiting"
		var currentReview *learning.NarrationReview
		if review, exists := latestReview[asset.ID]; exists {
			review.Stale = review.TextSHA256 != asset.TextSHA256 || review.AudioSHA256 != asset.SHA256
			currentReview = &review
			if review.Stale {
				status = "stale"
			} else {
				status = review.Decision
			}
		}
		counts[status]++
		if yearCounts[year] == nil {
			yearCounts[year] = map[string]int{"awaiting": 0, "approved": 0, "rejected": 0, "stale": 0}
		}
		yearCounts[year][status]++
		priority, rationale := narrationQueuePriority(year, asset.PackID, asset.Kind)
		allItems = append(allItems, narrationQueueItem{
			AssetID: asset.ID, PackID: asset.PackID, Year: year, Subject: subject,
			Kind: asset.Kind, SourceID: asset.SourceID, TextPreview: asset.Text, File: asset.File,
			TextSHA256: asset.TextSHA256, AudioSHA256: asset.SHA256, VoiceName: voiceName,
			ModelID: modelID, Status: status, Review: currentReview, Priority: priority, Rationale: rationale,
		})
	}
	sort.SliceStable(allItems, func(i, j int) bool {
		if allItems[i].Priority != allItems[j].Priority {
			return allItems[i].Priority > allItems[j].Priority
		}
		return allItems[i].AssetID < allItems[j].AssetID
	})
	for i := range allItems {
		allItems[i].Rank = i + 1
	}

	statusFilter := strings.ToLower(strings.TrimSpace(r.URL.Query().Get("status")))
	if statusFilter == "" {
		statusFilter = "awaiting"
	}
	subjectFilter := strings.TrimSpace(r.URL.Query().Get("subject"))
	kindFilter := strings.ToLower(strings.TrimSpace(r.URL.Query().Get("kind")))
	search := strings.ToLower(strings.TrimSpace(r.URL.Query().Get("search")))
	yearFilter := 0
	if raw := strings.TrimSpace(r.URL.Query().Get("year")); raw != "" {
		yearFilter, _ = strconv.Atoi(raw)
	}
	filtered := make([]narrationQueueItem, 0, len(allItems))
	for _, item := range allItems {
		if statusFilter != "all" && item.Status != statusFilter {
			continue
		}
		if subjectFilter != "" && !strings.EqualFold(item.Subject, subjectFilter) {
			continue
		}
		if yearFilter > 0 && item.Year != yearFilter {
			continue
		}
		if kindFilter != "" && !strings.EqualFold(item.Kind, kindFilter) {
			continue
		}
		if search != "" && !strings.Contains(strings.ToLower(strings.Join([]string{item.AssetID, item.PackID, item.SourceID, item.TextPreview}, " ")), search) {
			continue
		}
		filtered = append(filtered, item)
	}
	limit := queryBoundedInt(r, "limit", 20, 1, 100)
	offset := queryBoundedInt(r, "offset", 0, 0, len(filtered))
	end := offset + limit
	if end > len(filtered) {
		end = len(filtered)
	}
	page := filtered[offset:end]
	var nextOffset *int
	if end < len(filtered) {
		next := end
		nextOffset = &next
	}
	years := make([]narrationQueueYearSummary, 0, len(yearCounts))
	for year, statuses := range yearCounts {
		years = append(years, narrationQueueYearSummary{
			Year: year, Counts: statuses, Reviewed: statuses["approved"],
			Pending: statuses["awaiting"] + statuses["rejected"] + statuses["stale"],
		})
	}
	sort.Slice(years, func(i, j int) bool { return years[i].Year < years[j].Year })
	writeJSON(w, http.StatusOK, map[string]any{
		"items": page, "total": len(filtered), "counts": counts, "years": years, "limit": limit,
		"offset": offset, "next_offset": nextOffset, "served_by": "api", "manifest_available": true,
		"provider": manifest.Provider, "voice_name": manifest.Voice.Name, "model_id": manifest.Voice.ModelID,
	})
}

func queryBoundedInt(r *http.Request, key string, fallback, minimum, maximum int) int {
	value := fallback
	if raw := strings.TrimSpace(r.URL.Query().Get(key)); raw != "" {
		if parsed, err := strconv.Atoi(raw); err == nil {
			value = parsed
		}
	}
	if value < minimum {
		return minimum
	}
	if maximum >= minimum && value > maximum {
		return maximum
	}
	return value
}

func narrationCurriculumIdentity(packID string) (int, string) {
	prefixes := map[string]string{"en-": "English", "ma-": "Mathematics", "sc-": "Science"}
	subject := "Other"
	for prefix, name := range prefixes {
		if strings.HasPrefix(packID, prefix) {
			subject = name
			break
		}
	}
	year := 0
	parts := strings.Split(packID, "-")
	for _, part := range parts {
		if len(part) >= 2 && part[0] == 'y' {
			year, _ = strconv.Atoi(part[1:])
			break
		}
	}
	return year, subject
}

func narrationQueuePriority(year int, packID, kind string) (int, []string) {
	priority := 10_000 - year*100
	rationale := []string{}
	if year > 0 && year <= 2 {
		priority += 2_000
		rationale = append(rationale, "early-years audio clarity has the highest child-impact risk")
	}
	if containsAnyFold(packID, "phonics", "segmenting", "letter") {
		priority += 900
		rationale = append(rationale, "phonics and early-literacy pronunciation must be human-listened")
	}
	if containsAnyFold(packID, "listening", "fluency") {
		priority += 700
		rationale = append(rationale, "listening and fluency depend on warm, non-robotic narration")
	}
	if kind == "lesson" {
		priority += 140
		rationale = append(rationale, "lesson narration guides the learner before task attempts")
	} else {
		priority += 60
	}
	if len(rationale) == 0 {
		rationale = append(rationale, "human listening evidence is still required")
	}
	return priority, rationale
}

func containsAnyFold(value string, candidates ...string) bool {
	value = strings.ToLower(value)
	for _, candidate := range candidates {
		if strings.Contains(value, strings.ToLower(candidate)) {
			return true
		}
	}
	return false
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
	manifest, source, err := readNarrationManifest()
	if err != nil {
		return nil, source, err
	}
	bindings := make(map[string]narrationManifestItem, len(manifest.Items))
	for _, item := range manifest.Items {
		bindings[item.ID] = item
	}
	return bindings, source, nil
}

func readNarrationManifest() (narrationManifest, string, error) {
	candidates := []string{}
	if configured := strings.TrimSpace(os.Getenv("NARRATION_MANIFEST_PATH")); configured != "" {
		candidates = append(candidates, configured)
	}
	candidates = append(candidates,
		"packages/content/audio/narration-manifest.json",
		"../../packages/content/audio/narration-manifest.json",
		"apps/web/public/content/narration-manifest.json",
		"../../apps/web/public/content/narration-manifest.json",
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
			return narrationManifest{}, candidate, err
		}
		complete := len(manifest.Items) > 0
		for _, item := range manifest.Items {
			if strings.TrimSpace(item.ID) == "" || !isLowerSHA256(item.TextSHA256) || !isLowerSHA256(item.SHA256) {
				complete = false
				break
			}
		}
		if !complete {
			lastErr = errors.New("narration manifest is missing review binding hashes")
			continue
		}
		return manifest, candidate, nil
	}
	if lastErr == nil {
		lastErr = errors.New("narration manifest not found")
	}
	return narrationManifest{}, "", lastErr
}

func isLowerSHA256(value string) bool {
	if len(value) != 64 || value != strings.ToLower(value) {
		return false
	}
	decoded, err := hex.DecodeString(value)
	return err == nil && len(decoded) == 32
}
