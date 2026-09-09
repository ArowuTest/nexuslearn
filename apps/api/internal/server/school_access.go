package server

import (
	"errors"
	"log/slog"
	"net/http"
	"net/url"
	"strconv"

	"github.com/ArowuTest/nexuslearn/apps/api/internal/learning"
)

func (s *Server) handleSchoolClassCredentials(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Cache-Control", "private, no-store")
	user, ok := s.requireSchoolReadUser(w, r)
	if !ok {
		return
	}
	repository, ok := s.repo.(learning.SchoolClassCredentialRepository)
	if !ok {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": "bounded school class credentials are unavailable"})
		return
	}
	limit := learning.DefaultSchoolCredentialPageLimit
	values, err := url.ParseQuery(r.URL.RawQuery)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid school class credential query"})
		return
	}
	if raw, present := values["limit"]; present {
		if len(raw) != 1 {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "limit must be between 1 and 50"})
			return
		}
		var err error
		limit, err = strconv.Atoi(raw[0])
		if err != nil || limit < 1 || limit > learning.MaxSchoolCredentialPageLimit {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "limit must be between 1 and 50"})
			return
		}
	}
	if len(values["cursor"]) > 1 {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid school class credential cursor"})
		return
	}
	classID := r.PathValue("id")
	page, err := repository.ListClassStudentCredentialPage(r.Context(), user.SchoolURN, classID, limit, values.Get("cursor"))
	if err != nil {
		switch {
		case errors.Is(err, learning.ErrSchoolClassForbidden):
			writeJSON(w, http.StatusForbidden, map[string]string{"error": "class is outside this school"})
		case errors.Is(err, learning.ErrInvalidConfiguration):
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		default:
			slog.Warn("failed to read school class credentials", "error", err)
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "could not read school class credentials"})
		}
		return
	}
	if page.StudentCredentials == nil {
		page.StudentCredentials = []learning.StudentCredentialConfig{}
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"class_id":            classID,
		"student_credentials": page.StudentCredentials,
		"limit":               limit,
		"has_more":            page.NextCursor != "",
		"next_cursor":         page.NextCursor,
	})
}

func (s *Server) requireSchoolReadUser(w http.ResponseWriter, r *http.Request) (learning.SchoolUserConfig, bool) {
	user, ok := s.requireSchoolUser(w, r)
	if !ok {
		return learning.SchoolUserConfig{}, false
	}
	// Older fakes retain their existing session semantics; PostgreSQL always
	// rechecks membership, role and school state with a bounded EXISTS query.
	if repository, ok := s.repo.(learning.SchoolReadAuthorizationRepository); ok {
		allowed, err := repository.SchoolUserCanRead(r.Context(), user.ID, user.SchoolURN, user.Role)
		if err != nil {
			slog.Warn("failed to verify school read access", "error", err)
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "could not verify school access"})
			return learning.SchoolUserConfig{}, false
		}
		if !allowed {
			writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "school access is expired or revoked"})
			return learning.SchoolUserConfig{}, false
		}
	}
	return user, true
}
