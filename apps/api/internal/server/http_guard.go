package server

import (
	"bytes"
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"net"
	"net/http"
	"os"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/ArowuTest/nexuslearn/apps/api/internal/observe"
	"github.com/ArowuTest/nexuslearn/apps/api/internal/platformenv"
)

func NewHTTPServer(addr string, handler http.Handler) *http.Server {
	return &http.Server{
		Addr:              addr,
		Handler:           observe.Recover(handler),
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       30 * time.Second,
		WriteTimeout:      60 * time.Second,
		IdleTimeout:       120 * time.Second,
	}
}

func (s *Server) serve(w http.ResponseWriter, r *http.Request) {
	started := time.Now()
	recorder := &statusRecorder{ResponseWriter: w, status: http.StatusOK}
	applySecurityHeaders(recorder)
	if !applyCORS(recorder, r) {
		return
	}
	s.mux.ServeHTTP(recorder, r)
	slog.Info("request", "method", r.Method, "route", routeLabel(r.URL.Path), "status", recorder.status, "duration_ms", time.Since(started).Milliseconds())
}

func routeLabel(path string) string {
	parts := strings.Split(path, "/")
	for i, part := range parts {
		if part != "" && !routeLiterals[part] {
			parts[i] = "{id}"
		}
	}
	return strings.Join(parts, "/")
}

var routeLiterals = map[string]bool{
	"healthz": true, "readyz": true, "v1": true, "version": true, "system": true, "persistence": true,
	"diagnostics": true, "privacy": true, "policy": true, "curriculum": true, "region": true, "runtime": true,
	"narration-approvals": true, "auth": true, "review-access": true, "pupil-login": true, "admin-login": true,
	"school-login": true, "parent-login": true, "logout": true, "parents": true, "signup": true, "parent": true,
	"consent": true, "children": true, "export": true, "invitations": true, "accept": true, "config": true,
	"evidence": true, "mock-assessments": true, "engagement": true, "admin": true, "platform-users": true,
	"feature-flags": true, "feature-flag-directory": true, "worlds": true, "world-directory": true,
	"content": true, "activities": true, "activity-directory": true, "questions": true, "question-directory": true,
	"objective-directory": true, "readiness": true, "narration-readiness": true, "narration-queue": true,
	"narration-reviews": true, "audio": true, "manifests": true, "import": true, "assets": true,
	"rerecord-request": true, "ai-reviews": true, "summary": true, "reviews": true, "reports": true,
	"versions": true, "restore": true, "promote": true, "releases": true, "preflight": true, "packs": true,
	"activate": true, "reward-rules": true, "reward-directory": true, "learner-directory": true, "students": true,
	"progress": true, "schools": true, "organisation-directory": true, "school-users": true, "users": true,
	"classes": true, "credentials": true, "student-credentials": true, "groups": true, "group-directory": true,
	"parent-links": true, "parent-directory": true, "parent-invitations": true, "access-requests": true,
	"access-request-directory": true, "status": true, "convert": true, "audit": true, "objectives": true,
	"map": true, "release-status": true, "flags": true, "school": true, "directory": true, "assignments": true,
	"interventions": true, "intervention-reviews": true, "learning": true, "profile": true, "mastery": true,
	"attempts": true, "world": true, "sessions": true, "baseline": true, "warm-up": true, "next": true,
	"mission": true, "lesson-step": true, "event": true, "attempt": true, "purge": true, "pack-approvals": true,
}

func applySecurityHeaders(w http.ResponseWriter) {
	w.Header().Set("X-Content-Type-Options", "nosniff")
	w.Header().Set("X-Frame-Options", "DENY")
	w.Header().Set("Referrer-Policy", "no-referrer")
	w.Header().Set("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=()")
}

func applyCORS(w http.ResponseWriter, r *http.Request) bool {
	w.Header().Set("Vary", "Origin")
	w.Header().Add("Vary", "Access-Control-Request-Headers")
	origin := strings.TrimSpace(r.Header.Get("Origin"))
	if origin != "" && originAllowed(origin) {
		w.Header().Set("Access-Control-Allow-Origin", origin)
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Authorization, Content-Type, Idempotency-Key, X-Admin-Key, X-School-URN, X-School-Login, X-School-Password, X-Parent-Login, X-Parent-Password, X-Pupil-Session")
	}
	if r.Method == http.MethodOptions {
		if origin != "" && !originAllowed(origin) {
			writeJSON(w, http.StatusForbidden, map[string]string{"error": "this origin is not allowed"})
			return false
		}
		w.WriteHeader(http.StatusNoContent)
		return false
	}
	return true
}

func originAllowed(origin string) bool {
	for _, allowed := range allowedOrigins() {
		if strings.EqualFold(allowed, origin) {
			return true
		}
	}
	if platformenv.Production() {
		return false
	}
	return strings.HasPrefix(origin, "http://localhost:") || origin == "http://localhost" || strings.HasPrefix(origin, "http://127.0.0.1:") || origin == "http://127.0.0.1"
}

func allowedOrigins() []string {
	raw := strings.TrimSpace(os.Getenv("CORS_ALLOWED_ORIGINS"))
	if extra := strings.TrimSpace(os.Getenv("WEB_ORIGIN")); extra != "" {
		if raw == "" {
			raw = extra
		} else {
			raw += "," + extra
		}
	}
	if raw == "" {
		return nil
	}
	parts := strings.Split(raw, ",")
	origins := make([]string, 0, len(parts))
	for _, part := range parts {
		if trimmed := strings.TrimSpace(part); trimmed != "" {
			origins = append(origins, trimmed)
		}
	}
	return origins
}

type attemptLimiter struct {
	mu          sync.Mutex
	failures    map[string][]time.Time
	lockedUntil map[string]time.Time
	now         func() time.Time
	max         int
	window      time.Duration
	lockFor     time.Duration
	maxKeys     int
}

func newAttemptLimiter() *attemptLimiter {
	return &attemptLimiter{
		failures:    map[string][]time.Time{},
		lockedUntil: map[string]time.Time{},
		now:         time.Now,
		max:         5,
		window:      15 * time.Minute,
		lockFor:     15 * time.Minute,
		maxKeys:     4096,
	}
}

func (l *attemptLimiter) blocked(key string) bool {
	l.mu.Lock()
	defer l.mu.Unlock()
	l.prune(l.now())
	until, ok := l.lockedUntil[key]
	return ok && l.now().Before(until)
}

func (l *attemptLimiter) fail(key string) {
	l.mu.Lock()
	defer l.mu.Unlock()
	now := l.now()
	l.prune(now)
	recent := l.failures[key][:0]
	for _, when := range l.failures[key] {
		if now.Sub(when) < l.window {
			recent = append(recent, when)
		}
	}
	recent = append(recent, now)
	l.failures[key] = recent
	if len(recent) >= l.max {
		l.lockedUntil[key] = now.Add(l.lockFor)
	}
	l.prune(now)
}

func (l *attemptLimiter) success(key string) {
	l.mu.Lock()
	defer l.mu.Unlock()
	delete(l.failures, key)
	delete(l.lockedUntil, key)
}

func (l *attemptLimiter) prune(now time.Time) {
	for key, until := range l.lockedUntil {
		if !now.Before(until) {
			delete(l.lockedUntil, key)
		}
	}
	for key, times := range l.failures {
		kept := times[:0]
		for _, when := range times {
			if now.Sub(when) < l.window {
				kept = append(kept, when)
			}
		}
		if len(kept) == 0 {
			delete(l.failures, key)
		} else {
			l.failures[key] = kept
		}
	}
	if l.maxKeys <= 0 || len(l.failures) <= l.maxKeys {
		return
	}
	overflow := len(l.failures) - l.maxKeys
	for key := range l.failures {
		if overflow == 0 {
			return
		}
		delete(l.failures, key)
		delete(l.lockedUntil, key)
		overflow--
	}
}

func (s *Server) limitLogin(loginField string, next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		r.Body = http.MaxBytesReader(w, r.Body, 16<<10)
		body, err := io.ReadAll(r.Body)
		if err != nil {
			var tooLarge *http.MaxBytesError
			if errors.As(err, &tooLarge) {
				writeJSON(w, http.StatusRequestEntityTooLarge, map[string]string{"error": "sign-in details are too large"})
				return
			}
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid body"})
			return
		}
		r.Body = io.NopCloser(bytes.NewReader(body))
		key := clientIP(r) + "|" + r.URL.Path + "|" + loginIdentity(body, loginField)
		if s.loginAttempts.blocked(key) {
			w.Header().Set("Retry-After", strconv.Itoa(int(s.loginAttempts.lockFor.Seconds())))
			writeJSON(w, http.StatusTooManyRequests, map[string]string{"error": "too many sign-in attempts, please wait"})
			return
		}
		recorder := &statusRecorder{ResponseWriter: w, status: http.StatusOK}
		next(recorder, r)
		if recorder.status == http.StatusUnauthorized {
			s.loginAttempts.fail(key)
			return
		}
		if recorder.status >= 200 && recorder.status < 300 {
			s.loginAttempts.success(key)
		}
	}
}

func loginIdentity(body []byte, field string) string {
	var payload map[string]any
	if err := json.Unmarshal(body, &payload); err != nil {
		return ""
	}
	value, _ := payload[field].(string)
	return strings.ToLower(strings.TrimSpace(value))
}

func (s *Server) limitSignup(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		r.Body = http.MaxBytesReader(w, r.Body, 16<<10)
		body, err := io.ReadAll(r.Body)
		if err != nil {
			var tooLarge *http.MaxBytesError
			if errors.As(err, &tooLarge) {
				writeJSON(w, http.StatusRequestEntityTooLarge, map[string]string{"error": "sign-up details are too large"})
				return
			}
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid body"})
			return
		}
		r.Body = io.NopCloser(bytes.NewReader(body))
		email := loginIdentity(body, "email")
		ipKey := "signup|ip|" + clientIP(r)
		accountKey := "signup|account|" + email
		if s.loginAttempts.blocked(ipKey) || (email != "" && s.loginAttempts.blocked(accountKey)) {
			w.Header().Set("Retry-After", strconv.Itoa(int(s.loginAttempts.lockFor.Seconds())))
			writeJSON(w, http.StatusTooManyRequests, map[string]string{"error": "too many sign-up attempts, please wait"})
			return
		}
		recorder := &statusRecorder{ResponseWriter: w, status: http.StatusOK}
		next(recorder, r)
		s.loginAttempts.fail(ipKey)
		if email != "" {
			s.loginAttempts.fail(accountKey)
		}
	}
}

func trustProxy() bool {
	switch strings.ToLower(strings.TrimSpace(os.Getenv("NEXUSLEARN_TRUST_PROXY"))) {
	case "1", "true", "yes", "on":
		return true
	case "0", "false", "no", "off":
		return false
	default:
		return platformenv.Production()
	}
}

func clientIP(r *http.Request) string {
	remote := remoteHost(r.RemoteAddr)
	explicit := strings.ToLower(strings.TrimSpace(os.Getenv("NEXUSLEARN_TRUST_PROXY")))
	forced := explicit == "1" || explicit == "true" || explicit == "yes" || explicit == "on"
	if !forced && (!trustProxy() || !trustedProxyAddress(remote)) {
		return remote
	}
	parts := strings.Split(r.Header.Get("X-Forwarded-For"), ",")
	for i := len(parts) - 1; i >= 0; i-- {
		ip := net.ParseIP(strings.TrimSpace(parts[i]))
		if ip != nil {
			return ip.String()
		}
	}
	return remote
}

func remoteHost(remoteAddr string) string {
	host, _, err := net.SplitHostPort(remoteAddr)
	if err != nil {
		return remoteAddr
	}
	return host
}

func trustedProxyAddress(host string) bool {
	ip := net.ParseIP(host)
	if ip == nil {
		return false
	}
	return ip.IsPrivate() || ip.IsLoopback() || ip.IsLinkLocalUnicast()
}

type statusRecorder struct {
	http.ResponseWriter
	status int
	wrote  bool
}

func (s *statusRecorder) WriteHeader(status int) {
	if s.wrote {
		return
	}
	s.status = status
	s.wrote = true
	s.ResponseWriter.WriteHeader(status)
}

func (s *statusRecorder) Write(body []byte) (int, error) {
	if !s.wrote {
		s.WriteHeader(http.StatusOK)
	}
	return s.ResponseWriter.Write(body)
}

func pupilSessionsRequired() bool {
	if strings.TrimSpace(os.Getenv("REQUIRE_PUPIL_SESSION")) != "" {
		return envBool("REQUIRE_PUPIL_SESSION")
	}
	return platformenv.Production()
}

// ValidateProductionEnvironment refuses to boot a live service on memory storage
// or without the secrets that keep adult and child sessions unforgeable.
func ValidateProductionEnvironment() error {
	if !platformenv.Production() {
		return nil
	}
	problems := []string{}
	if strings.TrimSpace(os.Getenv("DATABASE_URL")) == "" {
		problems = append(problems, "DATABASE_URL")
	}
	for _, key := range []string{"ACCOUNT_SESSION_SECRET", "PUPIL_SESSION_SECRET"} {
		if len(strings.TrimSpace(os.Getenv(key))) < 32 {
			problems = append(problems, key+" (32+ characters)")
		}
	}
	if strings.TrimSpace(os.Getenv("CORS_ALLOWED_ORIGINS")) == "" && strings.TrimSpace(os.Getenv("WEB_ORIGIN")) == "" {
		problems = append(problems, "CORS_ALLOWED_ORIGINS")
	}
	if envBool("ALLOW_LEGACY_CREDENTIAL_HEADERS") {
		problems = append(problems, "ALLOW_LEGACY_CREDENTIAL_HEADERS must be off")
	}
	if _, err := platformenv.RetentionDays(); err != nil {
		return err
	}
	if len(problems) > 0 {
		return errors.New("production is missing " + strings.Join(problems, ", "))
	}
	return nil
}

func decodeLimited(w http.ResponseWriter, r *http.Request, dest any) error {
	r.Body = http.MaxBytesReader(w, r.Body, 256<<10)
	if err := json.NewDecoder(r.Body).Decode(dest); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid body"})
		return err
	}
	return nil
}
