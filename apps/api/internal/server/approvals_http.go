package server

import (
	"context"
	"net/http"
	"strings"
	"sync"
	"time"
	"unicode/utf8"

	"github.com/ArowuTest/nexuslearn/apps/api/internal/learning"
	"github.com/ArowuTest/nexuslearn/apps/api/internal/platformenv"
)

type approvalMemory struct {
	mu    sync.Mutex
	items []learning.HumanContentApproval
}

func newApprovalMemory() *approvalMemory {
	return &approvalMemory{}
}

func (s *Server) handleReviewAccess(w http.ResponseWriter, r *http.Request) {
	payload, ok := s.requireAccountSession(w, r, "platform_admin", "content_reviewer")
	if !ok {
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "role": payload.Role})
}

func (s *Server) handleNarrationApprovals(w http.ResponseWriter, r *http.Request) {
	ids, err := s.approvedNarrationIDs(r)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "approved narrations could not be read"})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"narration_ids": ids})
}

func (s *Server) handlePackApproval(w http.ResponseWriter, r *http.Request) {
	// narration_reviews stays the per-clip listening ledger. It requires sha256
	// hashes, playback coverage and only approved|rejected. A pack-level hold
	// has none of those, and inventing hashes would record clips as heard.
	// human_content_approvals is the child-playback allowlist for a real pack.
	payload, ok := s.requireAccountSession(w, r, "platform_admin", "content_reviewer")
	if !ok {
		return
	}
	var in learning.HumanContentApproval
	if err := decodeLimited(w, r, &in); err != nil {
		return
	}
	in.PackID = strings.TrimSpace(in.PackID)
	in.Decision = strings.ToLower(strings.TrimSpace(in.Decision))
	in.Notes = strings.TrimSpace(in.Notes)
	in.Reviewer = payload.LoginID
	if !validExternalRef(in.PackID) || (in.Decision != "approved" && in.Decision != "hold") || utf8.RuneCountInString(in.Notes) < 20 {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "pack_id, a decision of approved or hold, and notes of at least 20 characters are required"})
		return
	}
	if !learning.KnownNarrationPack(in.PackID) {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "that pack is not in the narration catalogue"})
		return
	}
	if len(in.NarrationIDs) > 500 {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "approve one pack at a time"})
		return
	}
	clean := make([]string, 0, len(in.NarrationIDs))
	seen := map[string]bool{}
	for _, id := range in.NarrationIDs {
		id = strings.TrimSpace(id)
		if id == "" || strings.Contains(id, "/") || len(id) > 160 || seen[id] || !learning.NarrationBelongsToPack(in.PackID, id) {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "every recording must belong to this pack"})
			return
		}
		seen[id] = true
		clean = append(clean, id)
	}
	if in.Decision == "approved" && len(clean) == 0 {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "name the recordings you listened to before approving"})
		return
	}
	in.NarrationIDs = clean
	store, ok := s.repo.(interface {
		SaveHumanContentApproval(ctx context.Context, approval learning.HumanContentApproval) (learning.HumanContentApproval, error)
	})
	if !ok {
		s.approvalMemory.mu.Lock()
		in.ID = "memory-approval"
		in.CreatedAt = time.Now().UTC().Format(time.RFC3339)
		s.approvalMemory.items = append(s.approvalMemory.items, in)
		s.approvalMemory.mu.Unlock()
		writeJSON(w, http.StatusOK, map[string]any{"approval": in, "catalogue_changed": false})
		return
	}
	saved, err := store.SaveHumanContentApproval(r.Context(), in)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "the review decision could not be saved"})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"approval": saved, "catalogue_changed": false})
}

func (s *Server) approvedNarrationIDs(r *http.Request) ([]string, error) {
	store, ok := s.repo.(interface {
		ApprovedNarrationIDs(ctx context.Context) ([]string, error)
	})
	if ok {
		ids, err := store.ApprovedNarrationIDs(r.Context())
		if err != nil {
			return nil, err
		}
		if ids == nil {
			return []string{}, nil
		}
		return ids, nil
	}
	s.approvalMemory.mu.Lock()
	defer s.approvalMemory.mu.Unlock()
	latest := map[string]string{}
	for _, item := range s.approvalMemory.items {
		for _, id := range item.NarrationIDs {
			latest[id] = item.Decision
		}
	}
	ids := []string{}
	for id, decision := range latest {
		if decision == "approved" {
			ids = append(ids, id)
		}
	}
	return ids, nil
}

func (s *Server) handleReady(w http.ResponseWriter, r *http.Request) {
	if s.persistence != "postgres" {
		if platformenv.Production() {
			writeJSON(w, http.StatusServiceUnavailable, map[string]string{"status": "not_ready", "persistence": s.persistence})
			return
		}
		writeJSON(w, http.StatusOK, map[string]string{"status": "ready", "persistence": s.persistence})
		return
	}
	pinger, ok := s.repo.(interface {
		Ping(ctx context.Context) error
	})
	if !ok {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"status": "not_ready"})
		return
	}
	if err := pinger.Ping(r.Context()); err != nil {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"status": "not_ready"})
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "ready", "persistence": "postgres"})
}

func (s *Server) handleCurriculumRegion(w http.ResponseWriter, _ *http.Request) {
	w.Header().Set("Cache-Control", "no-store")
	writeJSON(w, http.StatusOK, map[string]any{
		"region":  learning.ActiveCurriculumRegion(),
		"mapping": learning.YearGroupMapping(),
	})
}
