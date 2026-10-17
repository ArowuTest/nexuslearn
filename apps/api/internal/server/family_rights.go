package server

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"github.com/ArowuTest/nexuslearn/apps/api/internal/contentgate"
	"github.com/ArowuTest/nexuslearn/apps/api/internal/curriculum"
	"github.com/ArowuTest/nexuslearn/apps/api/internal/learning"
)

type consentGate interface {
	ChildConsentRequired(context.Context, string) (bool, error)
	CoreLearningConsentGranted(context.Context, string) (bool, error)
}

type privacyStore interface {
	RecordConsent(context.Context, string, learning.ConsentRecord) (learning.ConsentRecord, error)
	ListConsent(context.Context, string, string) ([]learning.ConsentRecord, error)
	FamilyPrivacy(context.Context, string) (learning.PrivacySettings, error)
	SaveFamilyPrivacy(context.Context, string, learning.PrivacySettings) (learning.PrivacySettings, error)
	ExportChild(context.Context, string, string) (learning.ChildExport, error)
	DeleteFamilyChild(context.Context, string, string) (learning.DeletionReceipt, error)
}

type readyChecker interface {
	Ping(context.Context) error
}

func (s *Server) handleReady(w http.ResponseWriter, r *http.Request) {
	if Production() && s.persistence != "postgres" {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"status": "not_ready", "persistence": s.persistence})
		return
	}
	if checker, ok := s.repo.(readyChecker); ok {
		if err := checker.Ping(r.Context()); err != nil {
			writeJSON(w, http.StatusServiceUnavailable, map[string]string{"status": "not_ready"})
			return
		}
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "ready", "persistence": s.persistence})
}

func (s *Server) handleYearLabels(w http.ResponseWriter, r *http.Request) {
	region := curriculum.Normalize(r.URL.Query().Get("region"))
	if strings.TrimSpace(r.URL.Query().Get("region")) == "" {
		region = curriculum.Normalize(os.Getenv("CURRICULUM_REGION"))
	}
	catalogue := curriculum.Builtin()
	labels := map[string]string{}
	for year := 1; year <= 7; year++ {
		labels[string(rune('0'+year))] = catalogue.YearLabel(region, year)
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"region": region, "default_region": "england", "labels": labels,
	})
}

func (s *Server) handleChildSafety(w http.ResponseWriter, r *http.Request) {
	if !s.requireAdmin(w, r) {
		return
	}
	packDir, manifest := contentCataloguePaths()
	report, err := contentgate.Scan(packDir, manifest)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "could not read the content safety catalogue"})
		return
	}
	writeJSON(w, http.StatusOK, report)
}

func contentCataloguePaths() (string, string) {
	for _, root := range []string{".", "apps/api", "../..", "../../.."} {
		packDir := filepath.Join(root, "packages/content/packs")
		if info, err := os.Stat(packDir); err == nil && info.IsDir() {
			return packDir, filepath.Join(root, "apps/web/public/content/narration-manifest.json")
		}
	}
	return filepath.Join("packages", "content", "packs"), filepath.Join("apps", "web", "public", "content", "narration-manifest.json")
}

func (s *Server) childLoginBlockedByConsent(ctx context.Context, studentExternalRef string) (bool, error) {
	gate, ok := s.repo.(consentGate)
	if !ok {
		return false, nil
	}
	required, err := gate.ChildConsentRequired(ctx, studentExternalRef)
	if err != nil || !required {
		return false, err
	}
	granted, err := gate.CoreLearningConsentGranted(ctx, studentExternalRef)
	if err != nil {
		return false, err
	}
	return !granted, nil
}

func (s *Server) handleParentRecordConsent(w http.ResponseWriter, r *http.Request) {
	parent, store, ok := s.parentPrivacy(w, r)
	if !ok {
		return
	}
	var in learning.ConsentRecord
	r.Body = http.MaxBytesReader(w, r.Body, 1<<16)
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid consent body"})
		return
	}
	in.StudentExternalRef = r.PathValue("externalRef")
	saved, err := store.RecordConsent(r.Context(), parent.ID, in)
	s.writePrivacyResult(w, saved, err)
}

func (s *Server) handleParentListConsent(w http.ResponseWriter, r *http.Request) {
	parent, store, ok := s.parentPrivacy(w, r)
	if !ok {
		return
	}
	records, err := store.ListConsent(r.Context(), parent.ID, r.PathValue("externalRef"))
	if err != nil {
		s.writePrivacyError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"consents": records})
}

func (s *Server) handleParentExportChild(w http.ResponseWriter, r *http.Request) {
	parent, store, ok := s.parentPrivacy(w, r)
	if !ok {
		return
	}
	w.Header().Set("Cache-Control", "private, no-store")
	export, err := store.ExportChild(r.Context(), parent.ID, r.PathValue("externalRef"))
	s.writePrivacyResult(w, export, err)
}

func (s *Server) handleParentDeleteChild(w http.ResponseWriter, r *http.Request) {
	parent, store, ok := s.parentPrivacy(w, r)
	if !ok {
		return
	}
	w.Header().Set("Cache-Control", "private, no-store")
	receipt, err := store.DeleteFamilyChild(r.Context(), parent.ID, r.PathValue("externalRef"))
	s.writePrivacyResult(w, receipt, err)
}

func (s *Server) handleParentPrivacy(w http.ResponseWriter, r *http.Request) {
	parent, store, ok := s.parentPrivacy(w, r)
	if !ok {
		return
	}
	settings, err := store.FamilyPrivacy(r.Context(), parent.ID)
	s.writePrivacyResult(w, settings, err)
}

func (s *Server) handleParentSavePrivacy(w http.ResponseWriter, r *http.Request) {
	parent, store, ok := s.parentPrivacy(w, r)
	if !ok {
		return
	}
	var in learning.PrivacySettings
	r.Body = http.MaxBytesReader(w, r.Body, 1<<16)
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid privacy body"})
		return
	}
	settings, err := store.SaveFamilyPrivacy(r.Context(), parent.ID, in)
	s.writePrivacyResult(w, settings, err)
}

func (s *Server) handleRetentionPolicy(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]any{
		"policies":           learning.DefaultRetentionPolicies(),
		"automatic_deletion": false,
		"note":               "These periods are the family promise. Nothing is deleted on a timer until a person turns that job on.",
	})
}

func (s *Server) parentPrivacy(w http.ResponseWriter, r *http.Request) (learning.ParentAccountConfig, privacyStore, bool) {
	parent, ok := s.requireParentUser(w, r)
	if !ok {
		return learning.ParentAccountConfig{}, nil, false
	}
	store, ok := s.repo.(privacyStore)
	if !ok {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": "family privacy tools need the database"})
		return learning.ParentAccountConfig{}, nil, false
	}
	return parent, store, true
}

func (s *Server) writePrivacyResult(w http.ResponseWriter, body any, err error) {
	if err != nil {
		s.writePrivacyError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, body)
}

func (s *Server) writePrivacyError(w http.ResponseWriter, err error) {
	if errors.Is(err, learning.ErrParentChildForbidden) {
		writeJSON(w, http.StatusForbidden, map[string]string{"error": "child is outside this parent account"})
		return
	}
	if errors.Is(err, learning.ErrChildDeletionBlocked) {
		writeJSON(w, http.StatusConflict, map[string]string{"error": err.Error()})
		return
	}
	s.writeAdminSaveError(w, err, "family privacy")
}
