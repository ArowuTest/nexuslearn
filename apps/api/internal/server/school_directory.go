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

// Directory reads require an account session even if legacy header auth is
// enabled for old clients. Live membership is checked on every continuation.
func (s *Server) requireSchoolDirectoryUser(w http.ResponseWriter, r *http.Request) (learning.SchoolUserConfig, bool) {
	if bearerToken(r) == "" {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "school session required"})
		return learning.SchoolUserConfig{}, false
	}
	return s.requireSchoolReadUser(w, r)
}

func (s *Server) schoolDirectoryRepository(w http.ResponseWriter) (learning.SchoolDirectoryRepository, bool) {
	repo, ok := s.repo.(learning.SchoolDirectoryRepository)
	_, live := s.repo.(learning.SchoolReadAuthorizationRepository)
	if !ok || !live {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": "bounded school directory is unavailable"})
		return nil, false
	}
	return repo, true
}

func (s *Server) handleSchoolDirectory(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Cache-Control", "private, no-store")
	user, ok := s.requireSchoolDirectoryUser(w, r)
	if !ok {
		return
	}
	query, err := schoolDirectoryPageQuery(r, user.SchoolURN)
	if err != nil {
		s.writeSchoolDirectoryError(w, learning.ErrInvalidConfiguration)
		return
	}
	repo, ok := s.schoolDirectoryRepository(w)
	if !ok {
		return
	}
	page, err := repo.ListSchoolDirectory(r.Context(), user.SchoolURN, query)
	if err != nil {
		s.writeSchoolDirectoryError(w, err)
		return
	}
	if page.Items == nil {
		page.Items = []learning.SchoolDirectoryItem{}
	}
	writeJSON(w, http.StatusOK, page)
}

func (s *Server) handleSchoolDirectoryOverview(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Cache-Control", "private, no-store")
	user, ok := s.requireSchoolDirectoryUser(w, r)
	if !ok {
		return
	}
	values, err := strictSchoolDirectoryValues(r, "view", "include_credentials")
	if err != nil || values.Get("view") != "directory" || (values.Has("include_credentials") && values.Get("include_credentials") != "false") {
		s.writeSchoolDirectoryError(w, learning.ErrInvalidConfiguration)
		return
	}
	repo, ok := s.schoolDirectoryRepository(w)
	if !ok {
		return
	}
	overview, err := repo.SchoolDirectoryOverview(r.Context(), user.SchoolURN)
	if err != nil {
		s.writeSchoolDirectoryError(w, err)
		return
	}
	if overview.Classes == nil {
		overview.Classes = []learning.SchoolDirectoryClass{}
	}
	if overview.Groups == nil {
		overview.Groups = []learning.SchoolDirectoryGroup{}
	}
	if overview.Students == nil {
		overview.Students = []learning.SchoolDirectoryStudent{}
	}
	user.TemporaryPassword = ""
	writeJSON(w, http.StatusOK, struct {
		learning.SchoolDirectoryOverview
		CurrentUser learning.SchoolUserConfig `json:"current_user"`
	}{overview, user})
}

func (s *Server) writeSchoolDirectoryError(w http.ResponseWriter, err error) {
	if errors.Is(err, learning.ErrInvalidConfiguration) {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid school directory query or cursor; restart pagination"})
		return
	}
	slog.Warn("failed to read school directory", "error", err)
	writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "could not read school directory"})
}

func strictSchoolDirectoryValues(r *http.Request, allowed ...string) (url.Values, error) {
	values, err := url.ParseQuery(r.URL.RawQuery)
	if err != nil {
		return nil, err
	}
	for _, flag := range strings.Split(r.URL.RawQuery, "&") {
		if !strings.Contains(flag, "=") {
			return nil, learning.ErrInvalidConfiguration
		}
	}
	for key, raw := range values {
		known := false
		for _, candidate := range allowed {
			if key == candidate {
				known = true
				break
			}
		}
		if !known || len(raw) != 1 {
			return nil, learning.ErrInvalidConfiguration
		}
	}
	return values, nil
}

func schoolDirectoryPageQuery(r *http.Request, urn string) (learning.SchoolDirectoryQuery, error) {
	invalid := func() (learning.SchoolDirectoryQuery, error) {
		return learning.SchoolDirectoryQuery{}, learning.ErrInvalidConfiguration
	}
	values, err := strictSchoolDirectoryValues(r, "kind", "limit", "cursor", "search", "ref")
	if err != nil {
		return invalid()
	}
	q := learning.SchoolDirectoryQuery{Kind: values.Get("kind"), Limit: learning.DefaultSchoolDirectoryLimit, Cursor: values.Get("cursor"), Search: values.Get("search"), Ref: values.Get("ref")}
	if values.Has("limit") {
		raw := values.Get("limit")
		if raw == "" || strings.IndexFunc(raw, func(r rune) bool { return r < '0' || r > '9' }) >= 0 {
			return invalid()
		}
		q.Limit, err = strconv.Atoi(raw)
		if err != nil || q.Limit < 1 || q.Limit > learning.MaxSchoolDirectoryLimit {
			return invalid()
		}
	}
	if values.Has("cursor") && q.Cursor == "" {
		return invalid()
	}
	// Presence matters: ref+search= is invalid too, even after normalization.
	if values.Has("ref") && (q.Ref == "" || values.Has("cursor") || values.Has("search")) {
		return invalid()
	}
	return learning.PrepareSchoolDirectoryQuery(urn, q)
}
