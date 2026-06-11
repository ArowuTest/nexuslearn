// Package server wires HTTP routing, middleware and handlers.
// Layering: handlers -> services -> repositories. Slice 1 ships the
// walking skeleton: health, version, and the demo mission endpoints the
// frontend uses before PostgreSQL lands in Slice 2.
package server

import (
	"crypto/subtle"
	"encoding/json"
	"log/slog"
	"net/http"
	"os"
	"time"

	"github.com/ArowuTest/nexuslearn/apps/api/internal/learning"
)

type Server struct {
	mux         *http.ServeMux
	repo        learning.Repository
	persistence string
	adminKey    string
}

func New(repo learning.Repository, persistence string) *Server {
	if repo == nil {
		repo = learning.NoopRepository{}
	}
	if persistence == "" {
		persistence = "memory"
	}
	s := &Server{mux: http.NewServeMux(), repo: repo, persistence: persistence, adminKey: os.Getenv("ADMIN_API_KEY")}

	s.mux.HandleFunc("GET /healthz", s.handleHealth)
	s.mux.HandleFunc("GET /v1/version", s.handleVersion)
	s.mux.HandleFunc("GET /v1/system/persistence", s.handlePersistence)
	s.mux.HandleFunc("GET /v1/system/diagnostics", s.handleDiagnostics)
	s.mux.HandleFunc("GET /v1/admin/config", s.handleAdminConfig)
	s.mux.HandleFunc("GET /v1/admin/feature-flags", s.handleFeatureFlags)
	s.mux.HandleFunc("PUT /v1/admin/feature-flags/{key}", s.handleUpsertFeatureFlag)
	s.mux.HandleFunc("GET /v1/admin/worlds", s.handleWorlds)
	s.mux.HandleFunc("PUT /v1/admin/worlds/{key}", s.handleUpsertWorld)
	s.mux.HandleFunc("GET /v1/admin/content/activities", s.handleActivities)
	s.mux.HandleFunc("PUT /v1/admin/content/activities/{id}", s.handleUpsertActivity)
	s.mux.HandleFunc("PUT /v1/admin/curriculum/objectives/{id}", s.handleUpsertObjective)
	s.mux.HandleFunc("GET /v1/curriculum/objectives", s.handleObjectives)
	s.mux.HandleFunc("GET /v1/curriculum/objectives/{id}", s.handleObjective)
	s.mux.HandleFunc("GET /v1/students/{studentId}/mastery", s.handleMastery)
	s.mux.HandleFunc("GET /v1/students/{studentId}/attempts", s.handleRecentAttempts)
	s.mux.HandleFunc("GET /v1/students/{studentId}/summary", s.handleEvidenceSummary)
	s.mux.HandleFunc("GET /v1/students/{studentId}/world", s.handleWorldState)
	s.mux.HandleFunc("POST /v1/students/{studentId}/sessions", s.handleStartSession)
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
		"version": "0.3.0",
		"slice":   "2-persistence-foundation",
	})
}

func (s *Server) handlePersistence(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{
		"mode": s.persistence,
	})
}

func (s *Server) requireAdmin(w http.ResponseWriter, r *http.Request) bool {
	if s.adminKey == "" {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": "admin api key is not configured"})
		return false
	}
	token := r.Header.Get("X-Admin-Key")
	if token == "" {
		token = r.Header.Get("Authorization")
		if len(token) > 7 && token[:7] == "Bearer " {
			token = token[7:]
		}
	}
	if subtle.ConstantTimeCompare([]byte(token), []byte(s.adminKey)) != 1 {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "admin access required"})
		return false
	}
	return true
}

func (s *Server) handleDiagnostics(w http.ResponseWriter, r *http.Request) {
	if !s.requireAdmin(w, r) {
		return
	}
	diagnostics, err := s.repo.Diagnostics(r.Context())
	if err != nil {
		slog.Warn("failed to read diagnostics", "error", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "could not read diagnostics"})
		return
	}
	writeJSON(w, http.StatusOK, diagnostics)
}

func (s *Server) handleAdminConfig(w http.ResponseWriter, r *http.Request) {
	if !s.requireAdmin(w, r) {
		return
	}
	flags, err := s.repo.ListFeatureFlags(r.Context())
	if err != nil {
		slog.Warn("failed to read feature flags", "error", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "could not read feature flags"})
		return
	}
	worlds, err := s.repo.ListWorlds(r.Context())
	if err != nil {
		slog.Warn("failed to read worlds", "error", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "could not read worlds"})
		return
	}
	activities, err := s.repo.ListActivities(r.Context())
	if err != nil {
		slog.Warn("failed to read activities", "error", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "could not read activities"})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"feature_flags": flags,
		"worlds":        worlds,
		"activities":    activities,
	})
}

func (s *Server) handleFeatureFlags(w http.ResponseWriter, r *http.Request) {
	if !s.requireAdmin(w, r) {
		return
	}
	flags, err := s.repo.ListFeatureFlags(r.Context())
	if err != nil {
		slog.Warn("failed to read feature flags", "error", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "could not read feature flags"})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"feature_flags": flags})
}

func (s *Server) handleUpsertFeatureFlag(w http.ResponseWriter, r *http.Request) {
	if !s.requireAdmin(w, r) {
		return
	}
	var flag learning.FeatureFlag
	if err := json.NewDecoder(r.Body).Decode(&flag); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid body"})
		return
	}
	flag.Key = r.PathValue("key")
	saved, err := s.repo.UpsertFeatureFlag(r.Context(), flag)
	if err != nil {
		slog.Warn("failed to save feature flag", "error", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "could not save feature flag"})
		return
	}
	writeJSON(w, http.StatusOK, saved)
}

func (s *Server) handleWorlds(w http.ResponseWriter, r *http.Request) {
	if !s.requireAdmin(w, r) {
		return
	}
	worlds, err := s.repo.ListWorlds(r.Context())
	if err != nil {
		slog.Warn("failed to read worlds", "error", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "could not read worlds"})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"worlds": worlds})
}

func (s *Server) handleUpsertWorld(w http.ResponseWriter, r *http.Request) {
	if !s.requireAdmin(w, r) {
		return
	}
	var world learning.WorldConfig
	if err := json.NewDecoder(r.Body).Decode(&world); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid body"})
		return
	}
	world.Key = r.PathValue("key")
	saved, err := s.repo.UpsertWorld(r.Context(), world)
	if err != nil {
		slog.Warn("failed to save world", "error", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "could not save world"})
		return
	}
	writeJSON(w, http.StatusOK, saved)
}

func (s *Server) handleActivities(w http.ResponseWriter, r *http.Request) {
	if !s.requireAdmin(w, r) {
		return
	}
	activities, err := s.repo.ListActivities(r.Context())
	if err != nil {
		slog.Warn("failed to read activities", "error", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "could not read activities"})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"activities": activities})
}

func (s *Server) handleUpsertActivity(w http.ResponseWriter, r *http.Request) {
	if !s.requireAdmin(w, r) {
		return
	}
	var activity learning.ActivityConfig
	if err := json.NewDecoder(r.Body).Decode(&activity); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid body"})
		return
	}
	activity.ID = r.PathValue("id")
	saved, err := s.repo.UpsertActivity(r.Context(), activity)
	if err != nil {
		slog.Warn("failed to save activity", "error", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "could not save activity"})
		return
	}
	writeJSON(w, http.StatusOK, saved)
}

func (s *Server) handleUpsertObjective(w http.ResponseWriter, r *http.Request) {
	if !s.requireAdmin(w, r) {
		return
	}
	var objective learning.Objective
	if err := json.NewDecoder(r.Body).Decode(&objective); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid body"})
		return
	}
	objective.ID = r.PathValue("id")
	saved, err := s.repo.UpsertObjective(r.Context(), objective)
	if err != nil {
		slog.Warn("failed to save objective", "error", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "could not save objective"})
		return
	}
	writeJSON(w, http.StatusOK, saved)
}

func (s *Server) handleObjectives(w http.ResponseWriter, r *http.Request) {
	objectives, err := s.repo.ListObjectives(r.Context())
	if err != nil {
		slog.Warn("failed to read objectives", "error", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "could not read objectives"})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"objectives": objectives,
	})
}

func (s *Server) handleObjective(w http.ResponseWriter, r *http.Request) {
	objective, ok, err := s.repo.GetObjective(r.Context(), r.PathValue("id"))
	if err != nil {
		slog.Warn("failed to read objective", "error", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "could not read objective"})
		return
	}
	if !ok {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "objective not found"})
		return
	}
	writeJSON(w, http.StatusOK, objective)
}

func (s *Server) handleMastery(w http.ResponseWriter, r *http.Request) {
	mastery, err := s.repo.ListMastery(r.Context(), r.PathValue("studentId"))
	if err != nil {
		slog.Warn("failed to read mastery", "error", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "could not read mastery"})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"student_id": r.PathValue("studentId"),
		"mastery":    mastery,
	})
}

func (s *Server) handleRecentAttempts(w http.ResponseWriter, r *http.Request) {
	attempts, err := s.repo.RecentAttempts(r.Context(), r.PathValue("studentId"), 10)
	if err != nil {
		slog.Warn("failed to read recent attempts", "error", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "could not read attempts"})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"student_id": r.PathValue("studentId"),
		"attempts":   attempts,
	})
}

func (s *Server) handleEvidenceSummary(w http.ResponseWriter, r *http.Request) {
	summary, err := s.repo.EvidenceSummary(r.Context(), r.PathValue("studentId"))
	if err != nil {
		slog.Warn("failed to read evidence summary", "error", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "could not read summary"})
		return
	}
	writeJSON(w, http.StatusOK, summary)
}

func (s *Server) handleWorldState(w http.ResponseWriter, r *http.Request) {
	worldKey := r.URL.Query().Get("worldKey")
	state, err := s.repo.WorldState(r.Context(), r.PathValue("studentId"), worldKey)
	if err != nil {
		slog.Warn("failed to read world state", "error", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "could not read world state"})
		return
	}
	writeJSON(w, http.StatusOK, state)
}

func (s *Server) handleStartSession(w http.ResponseWriter, r *http.Request) {
	var in struct {
		Mode       string `json:"mode"`
		DeviceTier string `json:"device_tier"`
	}
	if r.Body != nil {
		_ = json.NewDecoder(r.Body).Decode(&in)
	}
	session, err := s.repo.StartSession(r.Context(), r.PathValue("studentId"), in.Mode, in.DeviceTier)
	if err != nil {
		slog.Warn("failed to start session", "error", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "could not start session"})
		return
	}
	writeJSON(w, http.StatusCreated, session)
}

func (s *Server) handleWarmUp(w http.ResponseWriter, r *http.Request) {
	studentID := r.URL.Query().Get("studentId")
	if studentID == "" {
		studentID = "demo-student"
	}
	items, err := s.repo.WarmUpItems(r.Context(), studentID, 3)
	if err != nil {
		slog.Warn("failed to read warm-up items", "error", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "could not read warm-up"})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"student_id": studentID,
		"items":      items,
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
	result := learning.ScoreAttempt(in)
	adjusted, err := s.repo.RecordAttempt(r.Context(), in, result)
	if err != nil {
		slog.Warn("failed to persist attempt", "error", err)
	} else {
		result = adjusted
	}
	writeJSON(w, http.StatusOK, result)
}
