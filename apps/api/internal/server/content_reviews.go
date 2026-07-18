package server

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"net/http"
	"os"
	"strings"

	"github.com/ArowuTest/nexuslearn/apps/api/internal/learning"
)

type contentReviewRepository interface {
	ListContentReviewDecisions(context.Context, string, int) ([]learning.ContentReviewDecision, error)
	SaveContentReviewDecision(context.Context, learning.ContentReviewDecision, string) (learning.ContentReviewDecision, error)
}

type contentReviewBatch struct {
	BatchID string              `json:"batch_id"`
	Packs   []contentReviewPack `json:"packs"`
}

type contentReviewPack struct {
	PackID string                   `json:"pack_id"`
	Lanes  []contentReviewBatchLane `json:"lanes"`
}

type contentReviewBatchLane struct {
	ID     string `json:"id"`
	Status string `json:"status"`
}

func (s *Server) handleContentReviewDecisions(w http.ResponseWriter, r *http.Request) {
	if _, ok := s.requireNarrationReviewer(w, r); !ok {
		return
	}
	repository, ok := s.repo.(contentReviewRepository)
	if !ok {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": "content review persistence is not available"})
		return
	}
	_, source, raw, err := readGeneratedContentReportRaw("pilot-review-batch")
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "pilot review batch is not available"})
			return
		}
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": "pilot review batch could not be read"})
		return
	}
	var batch contentReviewBatch
	if err := json.Unmarshal(raw, &batch); err != nil || strings.TrimSpace(batch.BatchID) == "" {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": "pilot review batch is invalid"})
		return
	}
	digest := sha256.Sum256(raw)
	batchSHA256 := hex.EncodeToString(digest[:])
	decisions, err := repository.ListContentReviewDecisions(r.Context(), batch.BatchID, 500)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "could not read content review decisions"})
		return
	}
	gate := buildContentReviewGate(batch, batchSHA256, decisions)
	writeJSON(w, http.StatusOK, map[string]any{
		"batch_id": batch.BatchID, "batch_sha256": batchSHA256,
		"reviews": decisions, "release_gate": gate,
		"served_by": "api", "source": source,
	})
}

func (s *Server) handleSaveContentReviewDecision(w http.ResponseWriter, r *http.Request) {
	reviewerID, ok := s.requireNarrationReviewer(w, r)
	if !ok {
		return
	}
	repository, ok := s.repo.(contentReviewRepository)
	if !ok {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": "content review persistence is not available"})
		return
	}
	_, _, raw, err := readGeneratedContentReportRaw("pilot-review-batch")
	if err != nil {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": "pilot review batch is not available"})
		return
	}
	var batch contentReviewBatch
	if err := json.Unmarshal(raw, &batch); err != nil || strings.TrimSpace(batch.BatchID) == "" {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": "pilot review batch is invalid"})
		return
	}
	digest := sha256.Sum256(raw)
	batchSHA256 := hex.EncodeToString(digest[:])
	var in struct {
		BatchID         string   `json:"batch_id"`
		BatchSHA256     string   `json:"batch_sha256"`
		PackID          string   `json:"pack_id"`
		LaneID          string   `json:"lane_id"`
		Decision        string   `json:"decision"`
		ReviewerName    string   `json:"reviewer_name"`
		EvidenceNotes   string   `json:"evidence_notes"`
		CandidateIDs    []string `json:"candidate_ids"`
		RevisionActions []string `json:"revision_actions"`
	}
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid content review body"})
		return
	}
	in.BatchID = strings.TrimSpace(in.BatchID)
	in.BatchSHA256 = strings.ToLower(strings.TrimSpace(in.BatchSHA256))
	in.PackID = strings.TrimSpace(in.PackID)
	in.LaneID = strings.TrimSpace(in.LaneID)
	in.Decision = strings.ToLower(strings.TrimSpace(in.Decision))
	in.ReviewerName = strings.TrimSpace(in.ReviewerName)
	in.EvidenceNotes = strings.TrimSpace(in.EvidenceNotes)
	if in.BatchID != batch.BatchID || in.BatchSHA256 != batchSHA256 {
		writeJSON(w, http.StatusConflict, map[string]any{
			"error":    "pilot review batch changed; refresh the review queue before saving",
			"batch_id": batch.BatchID, "batch_sha256": batchSHA256,
		})
		return
	}
	if !contentReviewLaneExists(batch, in.PackID, in.LaneID) {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "review pack or lane is not in the current pilot batch"})
		return
	}
	decision := learning.ContentReviewDecision{
		BatchID: in.BatchID, BatchSHA256: in.BatchSHA256, PackID: in.PackID, LaneID: in.LaneID,
		Decision: in.Decision, ReviewerID: reviewerID, ReviewerName: in.ReviewerName,
		EvidenceNotes: in.EvidenceNotes, CandidateIDs: cleanReviewStrings(in.CandidateIDs),
		RevisionActions: cleanReviewStrings(in.RevisionActions),
	}
	if err := learning.ValidateContentReviewDecision(decision); err != nil {
		s.writeAdminSaveError(w, err, "content review")
		return
	}
	saved, err := repository.SaveContentReviewDecision(r.Context(), decision, requestIdempotencyKey(r, ""))
	if err != nil {
		s.writeAdminSaveError(w, err, "content review")
		return
	}
	writeJSON(w, http.StatusOK, saved)
}

func contentReviewLaneExists(batch contentReviewBatch, packID string, laneID string) bool {
	for _, pack := range batch.Packs {
		if pack.PackID != packID {
			continue
		}
		for _, lane := range pack.Lanes {
			if lane.ID == laneID {
				return true
			}
		}
	}
	return false
}

func cleanReviewStrings(values []string) []string {
	cleaned := make([]string, 0, len(values))
	seen := map[string]bool{}
	for _, value := range values {
		value = strings.TrimSpace(value)
		if value != "" && !seen[value] {
			cleaned = append(cleaned, value)
			seen[value] = true
		}
	}
	return cleaned
}

func buildContentReviewGate(batch contentReviewBatch, batchSHA256 string, decisions []learning.ContentReviewDecision) map[string]any {
	latest := map[string]learning.ContentReviewDecision{}
	for _, decision := range decisions {
		latest[decision.PackID+"\x00"+decision.LaneID] = decision
	}
	required := 0
	approved := 0
	pending := 0
	conditionalPending := 0
	nonApproved := 0
	stale := 0
	for _, pack := range batch.Packs {
		for _, lane := range pack.Lanes {
			key := pack.PackID + "\x00" + lane.ID
			decision, found := latest[key]
			if lane.Status == "required" {
				required++
			}
			if !found {
				if lane.Status == "required" {
					pending++
				} else if lane.Status == "conditional" {
					conditionalPending++
				}
				continue
			}
			decision.Stale = decision.BatchSHA256 != batchSHA256
			if decision.Stale {
				stale++
			}
			if decision.Decision == "approved" && !decision.Stale {
				if lane.Status == "required" {
					approved++
				}
				continue
			}
			nonApproved++
			if lane.Status == "required" {
				pending++
			}
		}
	}
	allowed := required > 0 && pending == 0 && nonApproved == 0 && stale == 0
	status := "pending_human_review"
	if allowed {
		status = "approved_for_controlled_pilot"
	}
	return map[string]any{
		"status": status, "promotion_allowed": allowed,
		"required_lanes": required, "approved_required_lanes": approved,
		"pending_required_lanes": pending, "conditional_lanes_pending": conditionalPending,
		"non_approved_decisions": nonApproved, "stale_decisions": stale,
		"decision_count":  len(decisions),
		"promotion_guard": "Do not promote the batch until every required lane has a current approved decision; conditional holds and stale decisions also block release.",
	}
}

func readGeneratedContentReportRaw(name string) (any, string, []byte, error) {
	candidates, ok := generatedContentReportCandidates(name)
	if !ok {
		return nil, "", nil, os.ErrNotExist
	}
	var lastErr error
	for _, candidate := range candidates {
		raw, err := os.ReadFile(candidate)
		if err != nil {
			lastErr = err
			continue
		}
		var report any
		if err := json.Unmarshal(raw, &report); err != nil {
			return nil, candidate, nil, err
		}
		return report, candidate, raw, nil
	}
	if lastErr == nil {
		lastErr = os.ErrNotExist
	}
	return nil, "", nil, lastErr
}
