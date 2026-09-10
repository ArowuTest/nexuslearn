package server

import (
	"errors"
	"log/slog"
	"net/http"
	"net/url"
	"strconv"
	"strings"

	"github.com/ArowuTest/nexuslearn/apps/api/internal/learning"
)

func (s *Server) handleSchoolCurriculumObjectives(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Cache-Control", "private, no-store")
	user, ok := s.requireSchoolReadUser(w, r)
	if !ok {
		return
	}
	query, err := schoolCurriculumPageQuery(r, user.SchoolURN)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid school curriculum query"})
		return
	}
	repository, ok := s.repo.(learning.SchoolCurriculumRepository)
	if !ok {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": "bounded school curriculum catalogue is unavailable"})
		return
	}
	page, err := repository.ListSchoolCurriculumObjectives(r.Context(), user.SchoolURN, query)
	if err != nil {
		if errors.Is(err, learning.ErrInvalidConfiguration) {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid school curriculum query or cursor; restart pagination"})
		} else {
			slog.Warn("failed to read school curriculum catalogue", "error", err)
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "could not read school curriculum catalogue"})
		}
		return
	}
	if page.Objectives == nil {
		page.Objectives = []learning.SchoolCurriculumObjective{}
	}
	writeJSON(w, http.StatusOK, page)
}

func schoolCurriculumPageQuery(r *http.Request, schoolURN string) (learning.SchoolCurriculumQuery, error) {
	invalid := func() (learning.SchoolCurriculumQuery, error) {
		return learning.SchoolCurriculumQuery{}, learning.ErrInvalidConfiguration
	}
	values, err := url.ParseQuery(r.URL.RawQuery)
	if err != nil {
		return invalid()
	}
	// ParseQuery treats a bare flag as an empty value. Catalogue flags must be
	// explicit, single-valued and known; neither malformed escapes nor duplicate
	// filters may silently change the scope represented by a cursor.
	for _, flag := range strings.Split(r.URL.RawQuery, "&") {
		if !strings.Contains(flag, "=") {
			return invalid()
		}
	}
	for key, raw := range values {
		switch key {
		case "year", "subject", "q", "limit", "cursor":
		default:
			return invalid()
		}
		if len(raw) != 1 {
			return invalid()
		}
	}
	integer := func(value string) (int, error) {
		if value == "" || strings.IndexFunc(value, func(r rune) bool { return r < '0' || r > '9' }) >= 0 {
			return 0, learning.ErrInvalidConfiguration
		}
		return strconv.Atoi(value)
	}
	year, err := integer(values.Get("year"))
	if err != nil {
		return invalid()
	}
	query := learning.SchoolCurriculumQuery{Year: year, Subject: values.Get("subject"), Query: values.Get("q"), Limit: learning.DefaultSchoolCurriculumLimit, Cursor: values.Get("cursor")}
	if values.Has("limit") {
		query.Limit, err = integer(values.Get("limit"))
		if err != nil || query.Limit < 1 || query.Limit > learning.MaxSchoolCurriculumLimit {
			return invalid()
		}
	}
	if values.Has("cursor") && query.Cursor == "" {
		return invalid()
	}
	return learning.PrepareSchoolCurriculumQuery(schoolURN, query)
}
