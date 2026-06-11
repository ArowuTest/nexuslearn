// Package server wires HTTP routing, middleware and handlers.
// Layering: handlers -> services -> repositories. Slice 1 ships the
// walking skeleton: health, version, and the demo mission endpoints the
// frontend uses before PostgreSQL lands in Slice 2.
package server

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/ArowuTest/nexuslearn/apps/api/internal/learning"
)

type Server struct {
	mux *http.ServeMux
}

func New() *Server {
	s := &Server{mux: http.NewServeMux()}

	s.mux.HandleFunc("GET /healthz", s.handleHealth)
	s.mux.HandleFunc("GET /v1/version", s.handleVersion)
	s.mux.HandleFunc("GET /v1/curriculum/objectives", s.handleObjectives)
	s.mux.HandleFunc("GET /v1/curriculum/objectives/{id}", s.handleObjective)
	s.mux.HandleFunc("GET /v1/students/{studentId}/mastery", s.handleMastery)
	s.mux.HandleFunc("GET /v1/learning/warm-up", s.handleWarmUp)
	s.mux.HandleFunc("GET /v1/learning/next", s.handleNextActivity)
	s.mux.HandleFunc("GET /v1/learning/mission/demo", s.handleDemoMission)
	s.mux.HandleFunc("POST /v1/learning/attempt", s.handleAttempt)

	return s
}

func (s *Server) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	withCORS(s.mux).ServeHTTP(w, r)
}

func withCORS(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Authorization, Content-Type")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

func (s *Server) handleHealth(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]any{
		"status": "ok",
		"time":   time.Now().UTC().Format(time.RFC3339),
	})
}

func (s *Server) handleVersion(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{
		"name":    "nexuslearn-api",
		"version": "0.2.0",
		"slice":   "2-curriculum-adaptive-foundation",
	})
}

func (s *Server) handleObjectives(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]any{
		"objectives": learning.Objectives(),
	})
}

func (s *Server) handleObjective(w http.ResponseWriter, r *http.Request) {
	objective, ok := learning.ObjectiveByID(r.PathValue("id"))
	if !ok {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "objective not found"})
		return
	}
	writeJSON(w, http.StatusOK, objective)
}

func (s *Server) handleMastery(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]any{
		"student_id": r.PathValue("studentId"),
		"mastery":    learning.DemoMastery(r.PathValue("studentId")),
	})
}

func (s *Server) handleWarmUp(w http.ResponseWriter, r *http.Request) {
	studentID := r.URL.Query().Get("studentId")
	if studentID == "" {
		studentID = "demo-student"
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"student_id": studentID,
		"items":      learning.WarmUp(studentID),
	})
}

func (s *Server) handleNextActivity(w http.ResponseWriter, r *http.Request) {
	studentID := r.URL.Query().Get("studentId")
	if studentID == "" {
		studentID = "demo-student"
	}
	writeJSON(w, http.StatusOK, learning.NextActivity(studentID))
}

func (s *Server) handleDemoMission(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, learning.DemoMission())
}

func (s *Server) handleAttempt(w http.ResponseWriter, r *http.Request) {
	var in learning.Attempt
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid body"})
		return
	}
	writeJSON(w, http.StatusOK, learning.ScoreAttempt(in))
}
