package server

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"

	"github.com/ArowuTest/nexuslearn/apps/api/internal/learning"
)

// 5,000 audio identities require roughly 2 MB; allow bounded metadata overhead.
const maxReleaseManifestBytes = 4 << 20

type releasePreflightStore interface {
	PreflightContentRelease(context.Context, learning.ContentReleaseManifest) (learning.ContentReleasePreflight, error)
}

func (s *Server) handleReleasePreflight(w http.ResponseWriter, r *http.Request) {
	if !s.requireAdmin(w, r) {
		return
	}
	store, ok := s.repo.(releasePreflightStore)
	if !ok {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": "release preflight requires PostgreSQL persistence"})
		return
	}
	decoder := json.NewDecoder(http.MaxBytesReader(w, r.Body, maxReleaseManifestBytes))
	decoder.DisallowUnknownFields()
	var manifest learning.ContentReleaseManifest
	if err := decoder.Decode(&manifest); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid release preflight manifest"})
		return
	}
	if err := decoder.Decode(&struct{}{}); !errors.Is(err, io.EOF) {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "preflight requires one JSON document"})
		return
	}
	report, err := store.PreflightContentRelease(r.Context(), manifest)
	if err != nil {
		s.writeContentReleaseError(w, err)
		return
	}
	w.Header().Set("Cache-Control", "no-store")
	writeJSON(w, http.StatusOK, report)
}
