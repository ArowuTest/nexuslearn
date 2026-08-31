package server

import (
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"strings"

	"github.com/ArowuTest/nexuslearn/apps/api/internal/learning"
)

type audioOperationsRepository interface {
	learning.AudioOperationsStore
}

func (s *Server) handleImportAudioManifest(w http.ResponseWriter, r *http.Request) {
	actor, ok := s.requireAudioManifestImporter(w, r)
	if !ok {
		return
	}
	repository, ok := s.repo.(audioOperationsRepository)
	if !ok {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": "audio release operations require PostgreSQL persistence"})
		return
	}
	r.Body = http.MaxBytesReader(w, r.Body, 32<<20)
	body := json.RawMessage{}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid narration manifest body"})
		return
	}
	manifest, err := decodeNarrationManifest(body)
	if err != nil || manifest.Schema != "nexuslearn.narration-manifest.v2" || manifest.Version != 2 {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid signed narration manifest v2"})
		return
	}
	operation := audioManifestImport(manifest)
	if err := learning.ValidateAudioManifestImport(operation); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}
	outcome, err := repository.ImportAudioManifest(r.Context(), operation, actor, requestIdempotencyKey(r, manifest.ReleaseID))
	if err != nil {
		s.writeAudioOperationError(w, err)
		return
	}
	status := http.StatusCreated
	if outcome.Replayed {
		status = http.StatusOK
	}
	writeJSON(w, status, outcome)
}

func (s *Server) handleRequestAudioRerecord(w http.ResponseWriter, r *http.Request) {
	actor, ok := s.requireAudioReviewer(w, r)
	if !ok {
		return
	}
	repository, ok := s.repo.(audioOperationsRepository)
	if !ok {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": "audio release operations require PostgreSQL persistence"})
		return
	}
	r.Body = http.MaxBytesReader(w, r.Body, 64<<10)
	var input struct {
		ReleaseID string `json:"release_id"`
		Reason    string `json:"reason"`
		Notes     string `json:"notes"`
	}
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid audio rerecord request"})
		return
	}
	request := learning.AudioRerecordRequest{
		ReleaseID: strings.TrimSpace(input.ReleaseID), AssetID: strings.TrimSpace(r.PathValue("id")),
		Reason: strings.TrimSpace(input.Reason), Notes: strings.TrimSpace(input.Notes),
	}
	if err := learning.ValidateAudioRerecordRequest(request); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}
	saved, err := repository.RequestAudioRerecord(r.Context(), request, actor, requestIdempotencyKey(r, request.ReleaseID+":"+request.AssetID+":"+request.Reason))
	if err != nil {
		s.writeAudioOperationError(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, saved)
}

func audioManifestImport(manifest narrationManifest) learning.AudioManifestImport {
	result := learning.AudioManifestImport{
		ReleaseID: manifest.ReleaseID, ReleaseSHA256: manifest.ReleaseSHA256,
		CatalogueID: manifest.CatalogueID, CatalogueSHA256: manifest.CatalogueSHA256,
		Provider: manifest.Provider, Status: manifest.Status,
		ExpectedAssets: manifest.Totals.ExpectedAssets, ProducedAssets: manifest.Totals.ProducedAssets,
		ReferenceIDs: manifest.Totals.ReferenceIDs, SpecialistRequired: manifest.Totals.SpecialistRequired,
		Unresolved: manifest.Totals.Unresolved,
		Assets:     make([]learning.AudioManifestAsset, 0, len(manifest.Assets)),
		References: make([]learning.AudioManifestReference, 0, len(manifest.References)),
	}
	for _, asset := range manifest.Assets {
		result.Assets = append(result.Assets, learning.AudioManifestAsset{
			AssetID: asset.ID, Text: asset.Text, TextSHA256: asset.TextSHA256, AudioSHA256: asset.SHA256,
			ProductionIdentitySHA256: asset.ProductionIdentitySHA256, ProductionProfileSHA256: asset.ProductionProfileSHA256,
			PackID: asset.PackID, Year: asset.Year, Kind: asset.Kind, File: asset.File,
			Provider: asset.Provider, VoiceID: asset.VoiceID, ModelID: asset.ModelID, OutputFormat: asset.OutputFormat,
			VoiceSettings: asset.VoiceSettings, ProductionStatus: asset.ProductionStatus,
			ReuseCount: asset.ReuseCount, Bytes: asset.Bytes, TechnicalPass: asset.TechnicalPass,
		})
	}
	for _, reference := range manifest.References {
		result.References = append(result.References, learning.AudioManifestReference{
			ReferenceID: reference.ReferenceID, Status: reference.Status,
			ProductionAssetID: reference.ProductionAssetID, TextSHA256: reference.TextSHA256,
			ProductionIdentitySHA256: reference.ProductionIdentitySHA256,
			ProductionProfileSHA256:  reference.ProductionProfileSHA256,
		})
	}
	return result
}

func (s *Server) requireAudioManifestImporter(w http.ResponseWriter, r *http.Request) (string, bool) {
	if bearerToken(r) != "" {
		payload, ok := s.requireAccountSession(w, r, adminRolePlatform)
		return payload.UserID, ok
	}
	if !s.requireAdmin(w, r) {
		return "", false
	}
	return "legacy-admin-api-key", true
}

func (s *Server) requireAudioReviewer(w http.ResponseWriter, r *http.Request) (string, bool) {
	if bearerToken(r) != "" {
		payload, ok := s.requireAccountSession(w, r, adminRolePlatform, adminRoleReviewer)
		return payload.UserID, ok
	}
	if !s.requireAdmin(w, r) {
		return "", false
	}
	return "legacy-admin-api-key", true
}

func (s *Server) writeAudioOperationError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, learning.ErrInvalidConfiguration):
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
	case errors.Is(err, learning.ErrAudioManifestConflict), errors.Is(err, learning.ErrIdempotencyConflict):
		writeJSON(w, http.StatusConflict, map[string]string{"error": err.Error()})
	case errors.Is(err, learning.ErrAudioAssetNotFound):
		writeJSON(w, http.StatusNotFound, map[string]string{"error": err.Error()})
	default:
		slog.Warn("audio operation failed", "error", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "audio operation failed"})
	}
}
