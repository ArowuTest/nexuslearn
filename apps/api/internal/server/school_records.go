package server

import (
	"net/http"
	"net/url"
	"strings"

	"github.com/ArowuTest/nexuslearn/apps/api/internal/learning"
)

func (s *Server) requireSchoolRecordRead(w http.ResponseWriter, r *http.Request) (learning.SchoolUserConfig, string, bool) {
	w.Header().Set("Cache-Control", "private, no-store")
	user, ok := s.requireSchoolReadUser(w, r)
	if !ok {
		return learning.SchoolUserConfig{}, "", false
	}
	// URL.Query silently drops malformed parameters. A lost or blank pupil
	// filter must never become the repository's school-wide empty filter.
	values, err := url.ParseQuery(r.URL.RawQuery)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid school record query"})
		return learning.SchoolUserConfig{}, "", false
	}
	if refs, present := values["studentId"]; present {
		if len(refs) != 1 || strings.TrimSpace(refs[0]) == "" {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "studentId must be a single non-blank value"})
			return learning.SchoolUserConfig{}, "", false
		}
		return user, strings.TrimSpace(refs[0]), true
	}
	// Omission remains supported for authorized school-wide consumers.
	return user, "", true
}
