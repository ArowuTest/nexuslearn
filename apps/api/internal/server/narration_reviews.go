package server

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
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
	ID                       string         `json:"id"`
	ProductionAssetID        string         `json:"production_asset_id"`
	ProductionIdentitySHA256 string         `json:"production_identity_sha256"`
	ProductionProfileSHA256  string         `json:"production_profile_sha256"`
	PackID                   string         `json:"pack_id"`
	PackIDs                  []string       `json:"pack_ids"`
	Year                     int            `json:"year"`
	Years                    []int          `json:"years"`
	Kind                     string         `json:"kind"`
	SourceID                 string         `json:"source_id"`
	Text                     string         `json:"text"`
	TextSHA256               string         `json:"text_sha256"`
	SHA256                   string         `json:"sha256"`
	Bytes                    int64          `json:"bytes"`
	File                     string         `json:"file"`
	RelativeFile             string         `json:"relative_file"`
	Provider                 string         `json:"provider"`
	VoiceName                string         `json:"voice_name"`
	VoiceID                  string         `json:"voice_id"`
	ModelID                  string         `json:"model_id"`
	OutputFormat             string         `json:"output_format"`
	VoiceSettings            map[string]any `json:"voice_settings"`
	ReferenceIDs             []string       `json:"reference_ids"`
	ReuseCount               int            `json:"reuse_count"`
	ProductionStatus         string         `json:"production_status"`
	TechnicalPass            bool           `json:"technical_pass"`
}

type narrationManifestReference struct {
	ReferenceID              string `json:"reference_id"`
	Status                   string `json:"status"`
	Text                     string `json:"text"`
	TextSHA256               string `json:"text_sha256"`
	ProductionAssetID        string `json:"production_asset_id"`
	ProductionIdentitySHA256 string `json:"production_identity_sha256"`
	ProductionProfileSHA256  string `json:"production_profile_sha256"`
}

type narrationManifestTotals struct {
	ExpectedAssets     int `json:"expected_assets"`
	ProducedAssets     int `json:"produced_assets"`
	ReferenceIDs       int `json:"reference_ids"`
	SpecialistRequired int `json:"specialist_required"`
	Unresolved         int `json:"unresolved"`
}

type narrationManifest struct {
	Schema          string `json:"schema"`
	Version         int    `json:"version"`
	CatalogueID     string `json:"catalogue_id"`
	CatalogueSHA256 string `json:"catalogue_sha256"`
	ReleaseID       string `json:"release_id"`
	ReleaseSHA256   string `json:"release_sha256"`
	Provider        string `json:"provider"`
	Status          string `json:"status"`
	Voice           struct {
		Name    string `json:"name"`
		ModelID string `json:"model_id"`
	} `json:"voice"`
	Items      []narrationManifestItem      `json:"items"`
	Assets     []narrationManifestItem      `json:"assets"`
	References []narrationManifestReference `json:"references"`
	Totals     narrationManifestTotals      `json:"totals"`
}

type narrationQueueItem struct {
	Rank                     int                       `json:"rank"`
	AssetID                  string                    `json:"asset_id"`
	PackID                   string                    `json:"pack_id"`
	Year                     int                       `json:"year"`
	Subject                  string                    `json:"subject"`
	Kind                     string                    `json:"kind"`
	SourceID                 string                    `json:"source_id"`
	TextPreview              string                    `json:"text_preview"`
	File                     string                    `json:"file"`
	TextSHA256               string                    `json:"text_sha256"`
	AudioSHA256              string                    `json:"audio_sha256"`
	ProductionIdentitySHA256 string                    `json:"production_identity_sha256,omitempty"`
	ProductionProfileSHA256  string                    `json:"production_profile_sha256,omitempty"`
	ReuseCount               int                       `json:"reuse_count,omitempty"`
	ReferenceCount           int                       `json:"reference_count,omitempty"`
	VoiceName                string                    `json:"voice_name,omitempty"`
	ModelID                  string                    `json:"model_id,omitempty"`
	Status                   string                    `json:"status"`
	Review                   *learning.NarrationReview `json:"review,omitempty"`
	Priority                 int                       `json:"priority"`
	Rationale                []string                  `json:"rationale"`
}

type narrationQueueYearSummary struct {
	Year     int            `json:"year"`
	Counts   map[string]int `json:"counts"`
	Reviewed int            `json:"reviewed"`
	Pending  int            `json:"pending"`
}

func (s *Server) handleNarrationReviewQueue(w http.ResponseWriter, r *http.Request) {
	if _, ok := s.requireNarrationReviewer(w, r); !ok {
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
			voiceName = asset.VoiceID
		}
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
			review.Stale = narrationReviewIsStale(review, asset)
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
			ProductionIdentitySHA256: asset.ProductionIdentitySHA256,
			ProductionProfileSHA256:  asset.ProductionProfileSHA256,
			ReuseCount:               asset.ReuseCount, ReferenceCount: len(asset.ReferenceIDs),
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
	if _, ok := s.requireNarrationReviewer(w, r); !ok {
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
			reviews[i].Stale = !exists || narrationReviewIsStale(reviews[i], binding)
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
		AssetID                 string          `json:"asset_id"`
		TextSHA256              string          `json:"text_sha256"`
		AudioSHA256             string          `json:"audio_sha256"`
		ProductionProfileSHA256 string          `json:"production_profile_sha256"`
		Decision                string          `json:"decision"`
		ReviewerName            string          `json:"reviewer_name"`
		Criteria                map[string]bool `json:"criteria"`
		RejectionReasons        []string        `json:"rejection_reasons"`
		Notes                   string          `json:"notes"`
	}
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid narration review body"})
		return
	}
	in.AssetID = strings.TrimSpace(in.AssetID)
	in.TextSHA256 = strings.ToLower(strings.TrimSpace(in.TextSHA256))
	in.AudioSHA256 = strings.ToLower(strings.TrimSpace(in.AudioSHA256))
	in.ProductionProfileSHA256 = strings.ToLower(strings.TrimSpace(in.ProductionProfileSHA256))
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
	if binding.TextSHA256 != in.TextSHA256 || binding.SHA256 != in.AudioSHA256 || (binding.ProductionProfileSHA256 != "" && binding.ProductionProfileSHA256 != in.ProductionProfileSHA256) {
		writeJSON(w, http.StatusConflict, map[string]any{
			"error":    "narration asset changed; refresh the review queue before saving",
			"asset_id": in.AssetID, "text_sha256": binding.TextSHA256, "audio_sha256": binding.SHA256,
			"production_profile_sha256": binding.ProductionProfileSHA256,
		})
		return
	}
	reviewInput := learning.NarrationReview{
		AssetID: in.AssetID, TextSHA256: in.TextSHA256, AudioSHA256: in.AudioSHA256,
		ProductionProfileSHA256: in.ProductionProfileSHA256,
		Decision:                in.Decision, ReviewerID: reviewerID, ReviewerName: in.ReviewerName,
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

func narrationReviewIsStale(review learning.NarrationReview, asset narrationManifestItem) bool {
	if review.TextSHA256 != asset.TextSHA256 || review.AudioSHA256 != asset.SHA256 {
		return true
	}
	return asset.ProductionProfileSHA256 != "" && review.ProductionProfileSHA256 != asset.ProductionProfileSHA256
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
		manifest, err := decodeNarrationManifest(body)
		if err != nil {
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

func decodeNarrationManifest(body []byte) (narrationManifest, error) {
	var manifest narrationManifest
	if err := json.Unmarshal(body, &manifest); err != nil {
		return narrationManifest{}, err
	}
	switch {
	case manifest.Schema == "" && (manifest.Version == 0 || manifest.Version == 1):
		return manifest, nil
	case manifest.Schema == "nexuslearn.narration-manifest.v2" && manifest.Version == 2:
		if err := validateNarrationManifestV2(body, &manifest); err != nil {
			return narrationManifest{}, err
		}
		manifest.Items = append([]narrationManifestItem(nil), manifest.Assets...)
		return manifest, nil
	default:
		return narrationManifest{}, fmt.Errorf("unsupported narration manifest schema %q version %d", manifest.Schema, manifest.Version)
	}
}

func validateNarrationManifestV2(body []byte, manifest *narrationManifest) error {
	if manifest.Schema != "nexuslearn.narration-manifest.v2" || manifest.Version != 2 {
		return errors.New("narration manifest v2 schema and version must match")
	}
	if !isLowerSHA256(manifest.CatalogueSHA256) || manifest.CatalogueID != "variant-audio-catalog-v1-"+manifest.CatalogueSHA256[:24] {
		return errors.New("narration manifest v2 catalogue identity is invalid")
	}
	if !isLowerSHA256(manifest.ReleaseSHA256) || manifest.ReleaseID != "narration-release-v2-"+manifest.ReleaseSHA256[:24] {
		return errors.New("narration manifest v2 release identity is invalid")
	}
	if len(manifest.Items) != 0 {
		return errors.New("narration manifest v2 cannot mix legacy items with canonical assets")
	}

	var raw map[string]any
	if err := json.Unmarshal(body, &raw); err != nil {
		return err
	}
	identity := map[string]any{}
	for _, key := range []string{"schema", "version", "catalogue_id", "catalogue_sha256", "provenance", "assets", "references", "blockers"} {
		value, exists := raw[key]
		if !exists {
			return fmt.Errorf("narration manifest v2 identity field %s is missing", key)
		}
		identity[key] = value
	}
	releaseSHA, err := canonicalSHA256(identity)
	if err != nil {
		return err
	}
	if releaseSHA != manifest.ReleaseSHA256 {
		return errors.New("narration manifest v2 release signature does not match its canonical payload")
	}
	if len(manifest.Assets) == 0 {
		return errors.New("narration manifest v2 has no produced assets")
	}
	if manifest.Totals.ProducedAssets != len(manifest.Assets) || manifest.Totals.ExpectedAssets < manifest.Totals.ProducedAssets {
		return errors.New("narration manifest v2 asset totals do not match")
	}
	if manifest.Totals.ReferenceIDs != len(manifest.References) {
		return errors.New("narration manifest v2 reference totals do not match")
	}

	assets := make(map[string]narrationManifestItem, len(manifest.Assets))
	declaredReferences := make(map[string]map[string]struct{}, len(manifest.Assets))
	for _, asset := range manifest.Assets {
		if err := validateNarrationManifestV2Asset(asset, manifest.Provider); err != nil {
			return err
		}
		if _, exists := assets[asset.ID]; exists {
			return fmt.Errorf("duplicate narration production asset %s", asset.ID)
		}
		assets[asset.ID] = asset
		declaredReferences[asset.ID] = stringSet(asset.ReferenceIDs)
		if len(declaredReferences[asset.ID]) != len(asset.ReferenceIDs) {
			return fmt.Errorf("%s: duplicate declared narration reference", asset.ID)
		}
	}

	aliases := make(map[string]string, len(manifest.References))
	boundReferences := make(map[string]map[string]struct{}, len(manifest.Assets))
	specialistRequired := 0
	unresolved := 0
	for _, reference := range manifest.References {
		reference.ReferenceID = strings.TrimSpace(reference.ReferenceID)
		if reference.ReferenceID == "" {
			return errors.New("narration manifest v2 reference id is required")
		}
		if _, exists := aliases[reference.ReferenceID]; exists {
			return fmt.Errorf("duplicate narration reference %s", reference.ReferenceID)
		}
		aliases[reference.ReferenceID] = reference.ProductionAssetID
		if reference.Status != "production_required" {
			if reference.Status != "specialist_required" && reference.Status != "unresolved" {
				return fmt.Errorf("%s: narration reference status is invalid", reference.ReferenceID)
			}
			if reference.ProductionAssetID != "" {
				return fmt.Errorf("%s: non-production narration reference cannot bind an asset", reference.ReferenceID)
			}
			if reference.Status == "specialist_required" {
				specialistRequired++
			} else {
				unresolved++
			}
			continue
		}
		asset, exists := assets[reference.ProductionAssetID]
		if !exists {
			if manifest.Totals.ProducedAssets == manifest.Totals.ExpectedAssets {
				return fmt.Errorf("%s: narration reference target is not produced", reference.ReferenceID)
			}
			continue
		}
		if reference.TextSHA256 != asset.TextSHA256 || reference.ProductionIdentitySHA256 != asset.ProductionIdentitySHA256 || reference.ProductionProfileSHA256 != asset.ProductionProfileSHA256 {
			return fmt.Errorf("%s: narration reference binding hashes do not match its production asset", reference.ReferenceID)
		}
		if reference.Text != "" && sha256String(reference.Text) != reference.TextSHA256 {
			return fmt.Errorf("%s: narration reference transcript hash does not match", reference.ReferenceID)
		}
		if boundReferences[asset.ID] == nil {
			boundReferences[asset.ID] = map[string]struct{}{}
		}
		boundReferences[asset.ID][reference.ReferenceID] = struct{}{}
	}
	for assetID, expected := range declaredReferences {
		if !equalStringSets(expected, boundReferences[assetID]) {
			return fmt.Errorf("%s: declared narration references do not match the signed alias bindings", assetID)
		}
	}
	if specialistRequired != manifest.Totals.SpecialistRequired || unresolved != manifest.Totals.Unresolved {
		return errors.New("narration manifest v2 blocker totals do not match its references")
	}
	return nil
}

func validateNarrationManifestV2Asset(asset narrationManifestItem, manifestProvider string) error {
	if strings.TrimSpace(asset.ID) == "" || asset.ID != asset.ProductionAssetID {
		return errors.New("narration manifest v2 production asset id is invalid")
	}
	for label, value := range map[string]string{
		"text": asset.TextSHA256, "audio": asset.SHA256,
		"production identity": asset.ProductionIdentitySHA256, "production profile": asset.ProductionProfileSHA256,
	} {
		if !isLowerSHA256(value) {
			return fmt.Errorf("%s: %s sha256 is invalid", asset.ID, label)
		}
	}
	if sha256String(asset.Text) != asset.TextSHA256 {
		return fmt.Errorf("%s: transcript hash does not match", asset.ID)
	}
	profile := map[string]any{
		"provider": asset.Provider, "voice_id": asset.VoiceID, "model_id": asset.ModelID,
		"output_format": asset.OutputFormat, "voice_settings": asset.VoiceSettings,
	}
	profileSHA, err := canonicalSHA256(profile)
	if err != nil {
		return err
	}
	if profileSHA != asset.ProductionProfileSHA256 {
		return fmt.Errorf("%s: production profile does not match its sha256", asset.ID)
	}
	identitySHA, err := canonicalSHA256(map[string]any{
		"version": 1, "text_sha256": asset.TextSHA256, "production_profile_sha256": profileSHA,
	})
	if err != nil {
		return err
	}
	if identitySHA != asset.ProductionIdentitySHA256 || asset.ID != "narration-v1-"+identitySHA[:24] {
		return fmt.Errorf("%s: production identity does not match transcript and profile", asset.ID)
	}
	if asset.Provider == "" || asset.Provider != manifestProvider || asset.VoiceID == "" || asset.ModelID == "" || asset.OutputFormat == "" || asset.VoiceSettings == nil {
		return fmt.Errorf("%s: production profile fields are incomplete", asset.ID)
	}
	if asset.Bytes <= 0 || !asset.TechnicalPass || !validNarrationProductionStatus(asset.ProductionStatus) {
		return fmt.Errorf("%s: produced audio is not technically reviewable", asset.ID)
	}
	expectedRelativeFile := "canonical/variant/" + asset.ID + ".mp3"
	unsafeFile := strings.Contains(asset.File, "..") || strings.ContainsAny(asset.File, "?#\\%") || strings.Contains(asset.RelativeFile, "..")
	if unsafeFile || asset.RelativeFile != expectedRelativeFile || !strings.HasSuffix(asset.File, "/"+expectedRelativeFile) || !strings.HasPrefix(asset.File, "/audio/narration/") {
		return fmt.Errorf("%s: canonical narration file binding is invalid", asset.ID)
	}
	return nil
}

func validNarrationProductionStatus(status string) bool {
	switch strings.TrimSpace(status) {
	case "required_human_listening_review", "human_listening_approved", "approved", "production_approved", "released", "rejected", "re_record_required":
		return true
	default:
		return false
	}
}

func canonicalSHA256(value any) (string, error) {
	body, err := json.Marshal(value)
	if err != nil {
		return "", err
	}
	return sha256String(string(body)), nil
}

func sha256String(value string) string {
	sum := sha256.Sum256([]byte(value))
	return hex.EncodeToString(sum[:])
}

func stringSet(values []string) map[string]struct{} {
	result := make(map[string]struct{}, len(values))
	for _, value := range values {
		result[value] = struct{}{}
	}
	return result
}

func equalStringSets(left, right map[string]struct{}) bool {
	if len(left) != len(right) {
		return false
	}
	for value := range left {
		if _, exists := right[value]; !exists {
			return false
		}
	}
	return true
}

func isLowerSHA256(value string) bool {
	if len(value) != 64 || value != strings.ToLower(value) {
		return false
	}
	decoded, err := hex.DecodeString(value)
	return err == nil && len(decoded) == 32
}
