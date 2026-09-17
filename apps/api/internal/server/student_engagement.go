package server

import (
	"bytes"
	"encoding/json"
	"errors"
	"io"
	"net/http"

	"github.com/ArowuTest/nexuslearn/apps/api/internal/learning"
)

// Exact field names avoid encoding/json's case-insensitive aliases and prevent
// omitted false flags/empty arrays from silently replacing saved support.
var engagementFields = []string{"declared_support_needs", "learning_approaches", "celebration_intensity", "audio_support", "reading_support", "session_length", "sensory_load", "attention_support", "communication_support", "processing_support", "confidence_support", "companion_style", "reward_style", "interests", "notes"}

func decodeEngagementSave(w http.ResponseWriter, r *http.Request, ref string) (learning.EngagementSave, error) {
	invalid := func() error {
		return errors.Join(learning.ErrInvalidConfiguration, errors.New("a complete valid support profile is required"))
	}
	dec := json.NewDecoder(http.MaxBytesReader(w, r.Body, 64<<10))
	token, err := dec.Token()
	if err != nil || token != json.Delim('{') {
		return learning.EngagementSave{}, invalid()
	}
	fields := make(map[string]json.RawMessage)
	for dec.More() {
		token, err := dec.Token()
		if err != nil {
			return learning.EngagementSave{}, invalid()
		}
		key, ok := token.(string)
		if !ok {
			return learning.EngagementSave{}, invalid()
		}
		if _, duplicate := fields[key]; duplicate {
			return learning.EngagementSave{}, invalid()
		}
		var raw json.RawMessage
		if err := dec.Decode(&raw); err != nil {
			return learning.EngagementSave{}, invalid()
		}
		fields[key] = raw
	}
	if token, err = dec.Token(); err != nil || token != json.Delim('}') {
		return learning.EngagementSave{}, invalid()
	}
	var trailing any
	if err := dec.Decode(&trailing); !errors.Is(err, io.EOF) {
		return learning.EngagementSave{}, invalid()
	}
	rawVersion, exists := fields["version"]
	if !exists {
		return learning.EngagementSave{}, learning.ErrEngagementVersionRequired
	}
	var version int64
	if bytes.Equal(bytes.TrimSpace(rawVersion), []byte("null")) || json.Unmarshal(rawVersion, &version) != nil || version < 0 || version > learning.MaxEngagementVersion {
		return learning.EngagementSave{}, invalid()
	}
	payload := map[string]json.RawMessage{"version": rawVersion}
	for _, key := range engagementFields {
		raw, exists := fields[key]
		if !exists || bytes.Equal(bytes.TrimSpace(raw), []byte("null")) {
			return learning.EngagementSave{}, invalid()
		}
		payload[key] = raw
	}
	raw, err := json.Marshal(payload)
	if err != nil {
		return learning.EngagementSave{}, invalid()
	}
	var profile learning.StudentEngagementProfile
	if err := json.Unmarshal(raw, &profile); err != nil {
		return learning.EngagementSave{}, invalid()
	}
	profile.StudentExternalRef = ref
	if len(r.Header.Values("Idempotency-Key")) != 1 {
		return learning.EngagementSave{}, invalid()
	}
	return learning.PrepareEngagementSave(learning.EngagementSave{Profile: profile, ExpectedVersion: version, IdempotencyKey: r.Header.Get("Idempotency-Key")})
}

func writeEngagementError(w http.ResponseWriter, err error) {
	w.Header().Set("Cache-Control", "private, no-store")
	var conflict *learning.EngagementConflict
	switch {
	case errors.As(err, &conflict):
		writeJSON(w, http.StatusConflict, map[string]any{"code": "support_profile_conflict", "error": "Support settings changed. Your draft has not replaced the newer settings.", "current_profile": conflict.CurrentProfile, "previously_saved": conflict.PreviouslySaved})
	case errors.Is(err, learning.ErrEngagementForbidden):
		writeJSON(w, http.StatusForbidden, map[string]string{"code": "support_forbidden", "error": "Pupil support is outside this account."})
	case errors.Is(err, learning.ErrEngagementVersionRequired):
		writeJSON(w, http.StatusPreconditionRequired, map[string]string{"code": "support_version_required", "error": "Load the latest support profile before saving. Refresh this page if needed."})
	case errors.Is(err, learning.ErrIdempotencyConflict):
		writeJSON(w, http.StatusConflict, map[string]string{"code": "idempotency_key_conflict", "error": "This save key was already used for different settings. Review your draft before saving again."})
	case errors.Is(err, learning.ErrInvalidConfiguration):
		writeJSON(w, http.StatusBadRequest, map[string]string{"code": "invalid_support_profile", "error": "A complete valid support profile, version and save key are required."})
	default:
		// Never include database errors or profile values in general logs/responses.
		writeJSON(w, http.StatusInternalServerError, map[string]string{"code": "support_unavailable", "error": "Pupil support could not be saved or loaded. Please retry."})
	}
}

func (s *Server) engagementRepository(w http.ResponseWriter) (learning.StudentEngagementRepository, bool) {
	repository, ok := s.repo.(learning.StudentEngagementRepository)
	if !ok {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"code": "support_unavailable", "error": "Version-checked support saves are not available. Please try again later."})
	}
	return repository, ok
}

func (s *Server) handleSchoolStudentEngagement(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Cache-Control", "private, no-store")
	user, ok := s.requireSchoolUser(w, r)
	if !ok {
		return
	}
	repository, ok := s.engagementRepository(w)
	if !ok {
		return
	}
	profile, err := repository.ReadStudentEngagement(r.Context(), learning.EngagementActor{Kind: "school", ID: user.ID, SchoolURN: user.SchoolURN}, r.PathValue("externalRef"))
	if err != nil {
		writeEngagementError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, profile)
}

func (s *Server) saveEngagement(w http.ResponseWriter, r *http.Request, actor learning.EngagementActor) {
	in, err := decodeEngagementSave(w, r, r.PathValue("externalRef"))
	if err != nil {
		writeEngagementError(w, err)
		return
	}
	repository, ok := s.engagementRepository(w)
	if !ok {
		return
	}
	saved, err := repository.SaveStudentEngagement(r.Context(), actor, in)
	if err != nil {
		writeEngagementError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, saved)
}

func (s *Server) handleSchoolUpsertStudentEngagement(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Cache-Control", "private, no-store")
	user, ok := s.requireSchoolUser(w, r)
	if !ok {
		return
	}
	s.saveEngagement(w, r, learning.EngagementActor{Kind: "school", ID: user.ID, SchoolURN: user.SchoolURN})
}

func (s *Server) handleParentUpsertEngagement(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Cache-Control", "private, no-store")
	parent, ok := s.requireParentUser(w, r)
	if !ok {
		return
	}
	s.saveEngagement(w, r, learning.EngagementActor{Kind: "parent", ID: parent.ID})
}
