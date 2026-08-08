package server

import (
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"net/http"
	"strconv"
	"strings"

	"github.com/ArowuTest/nexuslearn/apps/api/internal/learning"
)

func (s *Server) requireAIReviewRole(w http.ResponseWriter, r *http.Request) (accountSessionPayload, bool) {
	return s.requireAccountSession(w, r, "platform_admin", "content_editor", "content_reviewer")
}

func (s *Server) aiReviewStore(w http.ResponseWriter) (learning.AIReviewStore, bool) {
	repository, ok := s.repo.(learning.AIReviewStore)
	if !ok {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": "AI review persistence is not available"})
		return nil, false
	}
	return repository, true
}

func (s *Server) handleListAIReviews(w http.ResponseWriter, r *http.Request) {
	if _, ok := s.requireAIReviewRole(w, r); !ok {
		return
	}
	repository, ok := s.aiReviewStore(w)
	if !ok {
		return
	}
	query := learning.AIReviewQuery{
		LaneID:   strings.TrimSpace(r.URL.Query().Get("lane_id")),
		Status:   strings.TrimSpace(r.URL.Query().Get("status")),
		RiskTier: strings.TrimSpace(r.URL.Query().Get("risk_tier")),
		Subject:  strings.TrimSpace(r.URL.Query().Get("subject")),
		PackID:   strings.TrimSpace(r.URL.Query().Get("pack_id")),
		Limit:    100,
	}
	if raw := strings.TrimSpace(r.URL.Query().Get("limit")); raw != "" {
		limit, err := strconv.Atoi(raw)
		if err != nil || limit < 1 {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "limit must be a positive integer"})
			return
		}
		if limit > 200 {
			limit = 200
		}
		query.Limit = limit
	}
	if raw := strings.TrimSpace(r.URL.Query().Get("year_group")); raw != "" {
		yearGroup, err := strconv.Atoi(raw)
		if err != nil || yearGroup < 1 || yearGroup > 7 {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "year_group must be between 1 and 7"})
			return
		}
		query.YearGroup = yearGroup
	}
	if cursor := strings.TrimSpace(r.URL.Query().Get("cursor")); cursor != "" {
		createdAt, id, err := learning.DecodeAIReviewCursor(cursor)
		if err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
			return
		}
		query.BeforeCreatedAt = createdAt
		query.BeforeID = id
	}
	page, err := repository.ListAIReviewEvidence(r.Context(), query)
	if err != nil {
		if errors.Is(err, learning.ErrInvalidConfiguration) {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
			return
		}
		slog.Warn("failed to list AI review evidence", "error", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "could not load AI review evidence"})
		return
	}
	writeJSON(w, http.StatusOK, page)
}

func (s *Server) handleAIReviewSummary(w http.ResponseWriter, r *http.Request) {
	if _, ok := s.requireAIReviewRole(w, r); !ok {
		return
	}
	repository, ok := s.aiReviewStore(w)
	if !ok {
		return
	}
	summary, err := repository.SummariseAIReviews(r.Context())
	if err != nil {
		slog.Warn("failed to summarise AI review evidence", "error", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "could not summarise AI review evidence"})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"packs":                      summary.PackCount,
		"variants":                   summary.VariantCount,
		"current_ai_curriculum_lead": summary.ByLane[learning.AIReviewLaneCurriculum],
		"current_ai_send_lead":       summary.ByLane[learning.AIReviewLaneSEND],
		"stale":                      summary.Stale,
		"revision_required":          summary.ByStatus["revision_required"],
		"escalation_required":        summary.ByStatus["escalation_required"],
		"blocking_findings":          summary.BlockingFindings,
		"escalation_findings":        summary.EscalationFindings,
		"controlled_pilot_allowed":   summary.ControlledPilotAllowed,
	})
}

func (s *Server) handleSaveAIReview(w http.ResponseWriter, r *http.Request) {
	if _, ok := s.requireAIReviewRole(w, r); !ok {
		return
	}
	repository, ok := s.aiReviewStore(w)
	if !ok {
		return
	}
	idempotencyKey := strings.TrimSpace(r.Header.Get("Idempotency-Key"))
	if idempotencyKey == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Idempotency-Key header is required"})
		return
	}
	var review learning.AIReviewEvidence
	decoder := json.NewDecoder(http.MaxBytesReader(w, r.Body, 4<<20))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(&review); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid AI review body"})
		return
	}
	if err := decoder.Decode(&struct{}{}); !errors.Is(err, io.EOF) {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "AI review body must contain one JSON object"})
		return
	}
	if err := learning.ValidateAIReviewEvidence(review); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}
	saved, err := repository.SaveAIReviewEvidence(r.Context(), review, idempotencyKey)
	if err != nil {
		switch {
		case errors.Is(err, learning.ErrIdempotencyConflict):
			writeJSON(w, http.StatusConflict, map[string]string{"error": "idempotency key was reused with a different request"})
		case errors.Is(err, learning.ErrAIReviewIdentityConflict):
			writeJSON(w, http.StatusConflict, map[string]string{"error": "the immutable review identity already has different evidence"})
		case errors.Is(err, learning.ErrInvalidConfiguration):
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		default:
			slog.Warn("failed to save AI review evidence", "error", err)
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "could not save AI review evidence"})
		}
		return
	}
	writeJSON(w, http.StatusOK, saved)
}
