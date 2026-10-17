package server

import (
	"context"
	"errors"
	"net/http"
	"os"
	"strings"

	"github.com/ArowuTest/nexuslearn/apps/api/internal/learning"
	"github.com/ArowuTest/nexuslearn/apps/api/internal/platformenv"
)

func (s *Server) handlePrivacyPolicy(w http.ResponseWriter, _ *http.Request) {
	days, err := platformenv.RetentionDays()
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"version":         "2026-10-17",
		"region_default":  "england",
		"retention_days":  days,
		"sharing":         map[string]bool{"school": false, "marketing": false, "research": false},
		"purposes":        []string{"family_learning", "school_pilot"},
		"privacy_default": "Sharing stays off until a parent or school records a decision.",
	})
}

func (s *Server) handleParentConsent(w http.ResponseWriter, r *http.Request) {
	parent, ok := s.requireParentUser(w, r)
	if !ok {
		return
	}
	var in struct {
		StudentExternalRef string `json:"student_external_ref"`
		Purpose            string `json:"purpose"`
		PolicyVersion      string `json:"policy_version"`
		Region             string `json:"region"`
		Method             string `json:"method"`
	}
	if err := decodeLimited(w, r, &in); err != nil {
		return
	}
	ref := strings.TrimSpace(in.StudentExternalRef)
	if !validExternalRef(ref) || !s.parentOwnsChild(r.Context(), parent.LoginID, ref) {
		writeJSON(w, http.StatusForbidden, map[string]string{"error": "this child is not linked to this parent"})
		return
	}
	purpose := strings.TrimSpace(in.Purpose)
	if purpose == "" {
		purpose = "family_learning"
	}
	if !learning.AllowedConsentPurpose(purpose) {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "consent purpose is not recognised"})
		return
	}
	store, ok := s.repo.(interface {
		RecordConsent(ctx context.Context, record learning.ConsentRecord) (learning.ConsentRecord, error)
	})
	record := learning.ConsentRecord{
		ParentUserID: parent.ID, StudentExternalRef: ref, Purpose: purpose,
		PolicyVersion: strings.TrimSpace(in.PolicyVersion), Region: strings.TrimSpace(in.Region), Method: strings.TrimSpace(in.Method),
	}
	if record.PolicyVersion == "" {
		record.PolicyVersion = "2026-10-17"
	}
	if !ok {
		saved := s.rememberConsent(record)
		writeJSON(w, http.StatusOK, saved)
		return
	}
	saved, err := store.RecordConsent(r.Context(), record)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "consent could not be recorded"})
		return
	}
	writeJSON(w, http.StatusOK, saved)
}

func (s *Server) handleParentExportChild(w http.ResponseWriter, r *http.Request) {
	parent, ref, ok := s.ownedChild(w, r)
	if !ok {
		return
	}
	store, ok := s.repo.(interface {
		ExportFamilyChild(ctx context.Context, parentUserID string, externalRef string) (learning.FamilyExport, error)
	})
	if !ok {
		writeJSON(w, http.StatusOK, s.memoryExport(parent.ID, ref))
		return
	}
	exported, err := store.ExportFamilyChild(r.Context(), parent.ID, ref)
	if errors.Is(err, learning.ErrChildNotOwned) {
		writeJSON(w, http.StatusForbidden, map[string]string{"error": err.Error()})
		return
	}
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "the family export could not be prepared"})
		return
	}
	writeJSON(w, http.StatusOK, exported)
}

func (s *Server) handleParentDeleteChild(w http.ResponseWriter, r *http.Request) {
	parent, ref, ok := s.ownedChild(w, r)
	if !ok {
		return
	}
	var in struct {
		Confirm string `json:"confirm"`
	}
	if err := decodeLimited(w, r, &in); err != nil {
		return
	}
	if in.Confirm != "delete" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "confirm must be delete"})
		return
	}
	store, ok := s.repo.(interface {
		DeleteFamilyChild(ctx context.Context, parentUserID string, externalRef string) error
	})
	if !ok {
		s.markDeleted(ref)
		writeJSON(w, http.StatusOK, map[string]any{"deleted": true, "student_external_ref": ref})
		return
	}
	err := store.DeleteFamilyChild(r.Context(), parent.ID, ref)
	if errors.Is(err, learning.ErrChildHeldBySchool) {
		writeJSON(w, http.StatusConflict, map[string]string{"error": err.Error()})
		return
	}
	if errors.Is(err, learning.ErrChildNotOwned) {
		writeJSON(w, http.StatusForbidden, map[string]string{"error": err.Error()})
		return
	}
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "the child record could not be deleted"})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"deleted": true, "student_external_ref": ref})
}

func (s *Server) handlePrivacyPurge(w http.ResponseWriter, r *http.Request) {
	if !s.requireAdmin(w, r) {
		return
	}
	var in struct {
		Confirm string `json:"confirm"`
	}
	if err := decodeLimited(w, r, &in); err != nil {
		return
	}
	if in.Confirm != "purge" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "confirm must be purge"})
		return
	}
	days, err := platformenv.RetentionDays()
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}
	store, ok := s.repo.(interface {
		PurgeExpiredAttempts(ctx context.Context, days int, actor string) (int64, error)
	})
	if !ok {
		writeJSON(w, http.StatusOK, map[string]any{"deleted": 0, "retention_days": days, "persistence": s.persistence})
		return
	}
	deleted, err := store.PurgeExpiredAttempts(r.Context(), days, "platform_admin")
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "old learning attempts could not be removed"})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"deleted": deleted, "retention_days": days})
}

func (s *Server) ownedChild(w http.ResponseWriter, r *http.Request) (learning.ParentAccountConfig, string, bool) {
	parent, ok := s.requireParentUser(w, r)
	if !ok {
		return learning.ParentAccountConfig{}, "", false
	}
	ref := strings.TrimSpace(r.PathValue("externalRef"))
	if !validExternalRef(ref) || !s.parentOwnsChild(r.Context(), parent.LoginID, ref) {
		writeJSON(w, http.StatusForbidden, map[string]string{"error": "this child is not linked to this parent"})
		return learning.ParentAccountConfig{}, "", false
	}
	return parent, ref, true
}

func validExternalRef(value string) bool {
	if value == "" || len(value) > 80 {
		return false
	}
	for _, char := range value {
		if (char >= 'a' && char <= 'z') || (char >= 'A' && char <= 'Z') || (char >= '0' && char <= '9') || char == '-' || char == '_' {
			continue
		}
		return false
	}
	return true
}

func (s *Server) familyConsentAllows(w http.ResponseWriter, r *http.Request, externalRef string) bool {
	if !consentRequired() {
		return true
	}
	store, ok := s.repo.(interface {
		FamilyChildAccess(ctx context.Context, externalRef string) (bool, bool, bool, error)
	})
	if !ok {
		return true
	}
	schoolHeld, parentLinked, consentActive, err := store.FamilyChildAccess(r.Context(), externalRef)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "could not check parental consent"})
		return false
	}
	if parentLinked && !schoolHeld && !consentActive {
		writeJSON(w, http.StatusForbidden, map[string]string{"error": "a parent needs to record consent before this child can sign in"})
		return false
	}
	return true
}

func consentRequired() bool {
	raw := strings.TrimSpace(os.Getenv("REQUIRE_PARENTAL_CONSENT"))
	if raw != "" {
		return envBool("REQUIRE_PARENTAL_CONSENT")
	}
	return platformenv.Production()
}
