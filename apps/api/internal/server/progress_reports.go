package server

import (
	"net/http"

	"github.com/ArowuTest/nexuslearn/apps/api/internal/learning"
)

func (s *Server) handleAdminStudentProgress(w http.ResponseWriter, r *http.Request) {
	if !s.requireAdmin(w, r) {
		return
	}
	studentID := r.PathValue("externalRef")
	progress, err := s.buildProgressReport(r, studentID)
	if err != nil {
		writeProgressReportError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, progress)
}

func (s *Server) handleSchoolStudentProgress(w http.ResponseWriter, r *http.Request) {
	user, ok := s.requireSchoolUser(w, r)
	if !ok {
		return
	}
	studentID := r.PathValue("externalRef")
	if !s.studentBelongsToSchool(r.Context(), user.SchoolURN, studentID) {
		writeJSON(w, http.StatusForbidden, map[string]string{"error": "student is outside this school"})
		return
	}
	progress, err := s.buildProgressReport(r, studentID)
	if err != nil {
		writeProgressReportError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, progress)
}

func (s *Server) buildProgressReport(r *http.Request, studentID string) (learning.ProgressReport, error) {
	year, ok, err := s.repo.StudentYear(r.Context(), studentID)
	if err != nil {
		return learning.ProgressReport{}, err
	}
	if !ok {
		return learning.ProgressReport{}, learning.ErrStudentNotFound
	}
	objectives, err := s.repo.ListObjectives(r.Context())
	if err != nil {
		return learning.ProgressReport{}, err
	}
	mastery, err := s.repo.ListMastery(r.Context(), studentID)
	if err != nil {
		return learning.ProgressReport{}, err
	}
	return learning.BuildProgressReport(studentID, year, objectives, mastery), nil
}

func writeProgressReportError(w http.ResponseWriter, err error) {
	if err == learning.ErrStudentNotFound {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "student is not configured"})
		return
	}
	writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "could not load progress report"})
}
