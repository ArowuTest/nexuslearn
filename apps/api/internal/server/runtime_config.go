package server

import (
	"errors"
	"log/slog"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/ArowuTest/nexuslearn/apps/api/internal/observe"
	"github.com/ArowuTest/nexuslearn/apps/api/internal/security"
)

func Production() bool {
	switch strings.ToLower(strings.TrimSpace(os.Getenv("NEXUSLEARN_ENV"))) {
	case "production", "prod":
		return true
	}
	return strings.EqualFold(strings.TrimSpace(os.Getenv("RENDER")), "true")
}

// ValidateProductionConfig stops a production process from serving children's
// data out of memory or without the secrets that sign their sessions.
func ValidateProductionConfig() error {
	if !Production() {
		return nil
	}
	if strings.TrimSpace(os.Getenv("DATABASE_URL")) == "" {
		return errors.New("DATABASE_URL is required in production; refusing to start with an in-memory database")
	}
	if strings.TrimSpace(os.Getenv("ACCOUNT_SESSION_SECRET")) == "" {
		return errors.New("ACCOUNT_SESSION_SECRET is required in production")
	}
	if strings.TrimSpace(os.Getenv("PUPIL_SESSION_SECRET")) == "" {
		return errors.New("PUPIL_SESSION_SECRET is required in production")
	}
	if strings.TrimSpace(os.Getenv("CORS_ALLOWED_ORIGINS")) == "" {
		slog.Error("CORS_ALLOWED_ORIGINS is empty; browsers on another site cannot call this API until the family or school web address is listed")
	}
	return nil
}

func pupilSessionsRequired() bool {
	if envBool("ALLOW_ANONYMOUS_PUPIL_ROUTES") {
		return false
	}
	return envBool("REQUIRE_PUPIL_SESSION") || Production()
}

func trustProxy() bool {
	return envBool("TRUST_PROXY") || Production()
}

func NewHTTPServer(addr string, handler http.Handler) *http.Server {
	return &http.Server{
		Addr:              addr,
		Handler:           handler,
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       60 * time.Second,
		WriteTimeout:      60 * time.Second,
		IdleTimeout:       120 * time.Second,
		MaxHeaderBytes:    1 << 20,
	}
}

func (s *Server) beginLogin(w http.ResponseWriter, r *http.Request, identity string) bool {
	if s.loginLimiter == nil {
		return true
	}
	blocked, retry := s.loginLimiter.Blocked(s.loginKey(r, identity))
	if !blocked {
		return true
	}
	seconds := int(retry.Seconds()) + 1
	w.Header().Set("Retry-After", strconv.Itoa(seconds))
	writeJSON(w, http.StatusTooManyRequests, map[string]any{
		"error":               "too many login attempts; wait and try again",
		"retry_after_seconds": seconds,
	})
	return false
}

func (s *Server) noteLoginFailure(r *http.Request, identity string) {
	if s.loginLimiter != nil {
		s.loginLimiter.Fail(s.loginKey(r, identity))
	}
}

func (s *Server) noteLoginSuccess(r *http.Request, identity string) {
	if s.loginLimiter != nil {
		s.loginLimiter.Success(s.loginKey(r, identity))
	}
}

func (s *Server) loginKey(r *http.Request, identity string) string {
	return r.URL.Path + ":" + security.ClientIP(r, trustProxy()) + ":" + strings.ToLower(strings.TrimSpace(identity))
}

func (s *Server) logRequests(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		started := time.Now()
		recorder := &statusRecorder{ResponseWriter: w, status: http.StatusOK}
		next.ServeHTTP(recorder, r)
		level := slog.LevelInfo
		if r.URL.Path == "/healthz" || r.URL.Path == "/readyz" {
			level = slog.LevelDebug
		}
		slog.Log(r.Context(), level, "request",
			"method", r.Method,
			"path", r.URL.Path,
			"status", recorder.status,
			"duration_ms", time.Since(started).Milliseconds(),
		)
		if recorder.status >= 500 {
			_ = observe.Capture(r.Context(), observe.Event{
				Message: "api request failed",
				Tags:    map[string]string{"path": r.URL.Path, "status": strconv.Itoa(recorder.status)},
			})
		}
	})
}

type statusRecorder struct {
	http.ResponseWriter
	status int
}

func (s *statusRecorder) WriteHeader(status int) {
	s.status = status
	s.ResponseWriter.WriteHeader(status)
}

type corsPolicy struct {
	allowAnyLocal bool
	origins       map[string]bool
}

func loadCORS() corsPolicy {
	policy := corsPolicy{origins: map[string]bool{}}
	for _, origin := range strings.Split(os.Getenv("CORS_ALLOWED_ORIGINS"), ",") {
		origin = strings.TrimSpace(origin)
		if origin != "" {
			policy.origins[origin] = true
		}
	}
	policy.allowAnyLocal = len(policy.origins) == 0 && !Production()
	return policy
}

func (p corsPolicy) allows(origin string) bool {
	if origin == "" {
		return false
	}
	if p.origins[origin] {
		return true
	}
	if !p.allowAnyLocal {
		return false
	}
	return strings.HasPrefix(origin, "http://localhost:") || origin == "http://localhost" ||
		strings.HasPrefix(origin, "http://127.0.0.1:") || origin == "http://127.0.0.1"
}

func (s *Server) applyCORS(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := strings.TrimSpace(r.Header.Get("Origin"))
		if s.cors.allows(origin) {
			w.Header().Set("Access-Control-Allow-Origin", origin)
			w.Header().Set("Vary", "Origin")
		}
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Authorization, Content-Type, Idempotency-Key, X-Admin-Key, X-School-URN, X-School-Login, X-School-Password, X-Parent-Login, X-Parent-Password, X-Pupil-Session")
		if r.Method == http.MethodOptions {
			if origin != "" && !s.cors.allows(origin) {
				w.WriteHeader(http.StatusForbidden)
				return
			}
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}
