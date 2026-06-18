// Package server wires HTTP routing, middleware and handlers.
// Layering: handlers -> services -> repositories. Slice 1 ships the
// walking skeleton: health, version, and the configured learning endpoints.
package server

import (
	"context"
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"net/http"
	"os"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/ArowuTest/nexuslearn/apps/api/internal/learning"
)

type Server struct {
	mux             *http.ServeMux
	repo            learning.Repository
	persistence     string
	adminKey        string
	accountSecret   string
	allowLegacyAuth bool
}

type strandBucket struct {
	topics map[string]bool
	count  int
}

type subjectBucket struct {
	strands map[string]*strandBucket
	count   int
}

type yearBucket struct {
	subjects map[string]*subjectBucket
	count    int
}

type contentReadinessReport struct {
	GeneratedAt string                 `json:"generated_at"`
	Totals      contentReadinessTotals `json:"totals"`
	Items       []contentReadinessItem `json:"items"`
}

type contentReadinessTotals struct {
	Objectives          int `json:"objectives"`
	Ready               int `json:"ready"`
	Pilot               int `json:"pilot"`
	Draft               int `json:"draft"`
	Blocked             int `json:"blocked"`
	PublishedActivities int `json:"published_activities"`
	PublishedQuestions  int `json:"published_questions"`
	Formats             int `json:"formats"`
}

type contentReadinessItem struct {
	ObjectiveID            string   `json:"objective_id"`
	Year                   int      `json:"year"`
	Subject                string   `json:"subject"`
	Strand                 string   `json:"strand"`
	Topic                  string   `json:"topic"`
	Statement              string   `json:"statement"`
	Status                 string   `json:"status"`
	Score                  int      `json:"score"`
	ActivityCount          int      `json:"activity_count"`
	PublishedActivityCount int      `json:"published_activity_count"`
	QuestionCount          int      `json:"question_count"`
	PublishedQuestionCount int      `json:"published_question_count"`
	FormatCount            int      `json:"format_count"`
	Formats                []string `json:"formats"`
	Missing                []string `json:"missing"`
	Warnings               []string `json:"warnings"`
}

type accessRequestConversionInput struct {
	SchoolURN          string `json:"school_urn"`
	SchoolName         string `json:"school_name"`
	StaffEmail         string `json:"staff_email"`
	StaffName          string `json:"staff_name"`
	StaffRole          string `json:"staff_role"`
	StaffStatus        string `json:"staff_status"`
	ClassName          string `json:"class_name"`
	ClassYearGroup     int    `json:"class_year_group"`
	CreateStarterClass bool   `json:"create_starter_class"`
}

type accessRequestConversionResult struct {
	AccessRequest learning.AccessRequestConfig `json:"access_request"`
	School        learning.SchoolConfig        `json:"school"`
	SchoolUser    learning.SchoolUserConfig    `json:"school_user,omitempty"`
	Class         learning.ClassConfig         `json:"class,omitempty"`
}

type pupilSession struct {
	Configured       bool   `json:"configured"`
	Token            string `json:"token,omitempty"`
	TokenType        string `json:"token_type"`
	ExpiresAt        string `json:"expires_at,omitempty"`
	ExpiresInSeconds int    `json:"expires_in_seconds,omitempty"`
}

type pupilSessionPayload struct {
	StudentExternalRef string `json:"student_external_ref"`
	Purpose            string `json:"purpose"`
	ExpiresAt          string `json:"expires_at"`
}

type accountSessionPayload struct {
	SessionID string `json:"session_id"`
	UserID    string `json:"user_id"`
	LoginID   string `json:"login_id"`
	Role      string `json:"role"`
	SchoolURN string `json:"school_urn,omitempty"`
	Purpose   string `json:"purpose"`
	ExpiresAt string `json:"expires_at"`
}

type accountSessionResult struct {
	Token            string `json:"token"`
	TokenType        string `json:"token_type"`
	Role             string `json:"role"`
	SchoolURN        string `json:"school_urn,omitempty"`
	ExpiresAt        string `json:"expires_at"`
	ExpiresInSeconds int    `json:"expires_in_seconds"`
}

type platformUserVerifier interface {
	VerifyPlatformUser(context.Context, string, string) (learning.PlatformUserConfig, bool, error)
}

type platformUserRepository interface {
	UpsertPlatformUser(context.Context, learning.PlatformUserConfig, string) (learning.PlatformUserConfig, error)
}

type accountSessionRepository interface {
	CreateAccountSession(context.Context, learning.AccountSession) (learning.AccountSession, error)
	AccountSessionByTokenHash(context.Context, string) (learning.AccountSession, bool, error)
	RevokeAccountSession(context.Context, string) error
}

type parentInvitationRepository interface {
	CreateParentInvitation(context.Context, learning.ParentInvitation) (learning.ParentInvitation, error)
	ListParentInvitations(context.Context) ([]learning.ParentInvitation, error)
	UpdateParentInvitationStatus(context.Context, string, string) (learning.ParentInvitation, error)
	ParentInvitationByTokenHash(context.Context, string) (learning.ParentInvitation, bool, error)
	AcceptParentInvitation(context.Context, string, string) (learning.ParentInvitation, error)
}

type contentPromotionRepository interface {
	PromoteContentVersion(context.Context, string, string) (learning.ContentVersion, error)
}

func New(repo learning.Repository, persistence string) *Server {
	if repo == nil {
		repo = learning.NoopRepository{}
	}
	if persistence == "" {
		persistence = "memory"
	}
	s := &Server{
		mux:             http.NewServeMux(),
		repo:            repo,
		persistence:     persistence,
		adminKey:        os.Getenv("ADMIN_API_KEY"),
		accountSecret:   strings.TrimSpace(os.Getenv("ACCOUNT_SESSION_SECRET")),
		allowLegacyAuth: envBoolDefault("ALLOW_LEGACY_CREDENTIAL_HEADERS", true),
	}

	s.mux.HandleFunc("GET /healthz", s.handleHealth)
	s.mux.HandleFunc("GET /v1/version", s.handleVersion)
	s.mux.HandleFunc("GET /v1/system/persistence", s.handlePersistence)
	s.mux.HandleFunc("GET /v1/system/diagnostics", s.handleDiagnostics)
	s.mux.HandleFunc("POST /v1/access-requests", s.handleCreateAccessRequest)
	s.mux.HandleFunc("POST /v1/auth/pupil-login", s.handlePupilLogin)
	s.mux.HandleFunc("POST /v1/auth/admin-login", s.handleAdminLogin)
	s.mux.HandleFunc("POST /v1/auth/school-login", s.handleSchoolLogin)
	s.mux.HandleFunc("POST /v1/auth/parent-login", s.handleParentLogin)
	s.mux.HandleFunc("POST /v1/auth/logout", s.handleAccountLogout)
	s.mux.HandleFunc("POST /v1/parents/signup", s.handleParentSignup)
	s.mux.HandleFunc("POST /v1/parent/invitations/accept", s.handleAcceptParentInvitation)
	s.mux.HandleFunc("GET /v1/parent/config", s.handleParentConfig)
	s.mux.HandleFunc("GET /v1/parent/children/{externalRef}/evidence", s.handleParentChildEvidence)
	s.mux.HandleFunc("PUT /v1/parent/children/{externalRef}", s.handleParentUpsertChild)
	s.mux.HandleFunc("PUT /v1/parent/children/{externalRef}/engagement", s.handleParentUpsertEngagement)
	s.mux.HandleFunc("GET /v1/admin/config", s.handleAdminConfig)
	s.mux.HandleFunc("PUT /v1/admin/platform-users/{email}", s.handleUpsertPlatformUser)
	s.mux.HandleFunc("GET /v1/admin/feature-flags", s.handleFeatureFlags)
	s.mux.HandleFunc("PUT /v1/admin/feature-flags/{key}", s.handleUpsertFeatureFlag)
	s.mux.HandleFunc("GET /v1/admin/worlds", s.handleWorlds)
	s.mux.HandleFunc("PUT /v1/admin/worlds/{key}", s.handleUpsertWorld)
	s.mux.HandleFunc("GET /v1/admin/content/activities", s.handleActivities)
	s.mux.HandleFunc("PUT /v1/admin/content/activities/{id}", s.handleUpsertActivity)
	s.mux.HandleFunc("GET /v1/admin/content/questions", s.handleQuestions)
	s.mux.HandleFunc("PUT /v1/admin/content/questions/{id}", s.handleUpsertQuestion)
	s.mux.HandleFunc("GET /v1/admin/content/readiness", s.handleContentReadiness)
	s.mux.HandleFunc("GET /v1/admin/content/versions", s.handleContentVersions)
	s.mux.HandleFunc("POST /v1/admin/content/versions", s.handleRestoreContentVersion)
	s.mux.HandleFunc("POST /v1/admin/content/versions/{id}/restore", s.handleRestoreContentVersion)
	s.mux.HandleFunc("POST /v1/admin/content/versions/{id}/promote", s.handlePromoteContentVersion)
	s.mux.HandleFunc("GET /v1/admin/reward-rules", s.handleRewardRules)
	s.mux.HandleFunc("PUT /v1/admin/reward-rules/{id}", s.handleUpsertRewardRule)
	s.mux.HandleFunc("GET /v1/admin/students", s.handleAdminStudents)
	s.mux.HandleFunc("PUT /v1/admin/students/{externalRef}", s.handleUpsertStudent)
	s.mux.HandleFunc("GET /v1/admin/schools", s.handleSchools)
	s.mux.HandleFunc("PUT /v1/admin/schools/{urn}", s.handleUpsertSchool)
	s.mux.HandleFunc("GET /v1/admin/school-users", s.handleSchoolUsers)
	s.mux.HandleFunc("PUT /v1/admin/schools/{urn}/users/{email}", s.handleUpsertSchoolUser)
	s.mux.HandleFunc("GET /v1/admin/classes", s.handleClasses)
	s.mux.HandleFunc("PUT /v1/admin/classes/{id}", s.handleUpsertClass)
	s.mux.HandleFunc("PUT /v1/admin/classes/{id}/students/{externalRef}", s.handleAssignStudentToClass)
	s.mux.HandleFunc("PUT /v1/admin/classes/{id}/credentials", s.handleGenerateClassCredentials)
	s.mux.HandleFunc("GET /v1/admin/student-credentials", s.handleStudentCredentials)
	s.mux.HandleFunc("PUT /v1/admin/student-credentials/{externalRef}", s.handleUpsertStudentCredential)
	s.mux.HandleFunc("GET /v1/admin/groups", s.handleGroups)
	s.mux.HandleFunc("PUT /v1/admin/groups/{id}", s.handleUpsertGroup)
	s.mux.HandleFunc("PUT /v1/admin/groups/{id}/students/{externalRef}", s.handleAssignStudentToGroup)
	s.mux.HandleFunc("GET /v1/admin/parent-links", s.handleParentLinks)
	s.mux.HandleFunc("PUT /v1/admin/parent-links/{studentExternalRef}", s.handleUpsertParentLink)
	s.mux.HandleFunc("GET /v1/admin/parent-invitations", s.handleParentInvitations)
	s.mux.HandleFunc("POST /v1/admin/parent-invitations", s.handleCreateParentInvitation)
	s.mux.HandleFunc("POST /v1/admin/parent-invitations/{id}/{action}", s.handleParentInvitationAction)
	s.mux.HandleFunc("GET /v1/admin/access-requests", s.handleAccessRequests)
	s.mux.HandleFunc("PUT /v1/admin/access-requests/{id}/status", s.handleUpdateAccessRequestStatus)
	s.mux.HandleFunc("POST /v1/admin/access-requests/{id}/convert", s.handleConvertAccessRequest)
	s.mux.HandleFunc("GET /v1/admin/audit", s.handleAuditLogs)
	s.mux.HandleFunc("PUT /v1/admin/curriculum/objectives/{id}", s.handleUpsertObjective)
	s.mux.HandleFunc("GET /v1/curriculum/objectives", s.handleObjectives)
	s.mux.HandleFunc("GET /v1/curriculum/objectives/{id}", s.handleObjective)
	s.mux.HandleFunc("GET /v1/curriculum/map", s.handleCurriculumMap)
	s.mux.HandleFunc("GET /v1/runtime/flags", s.handleRuntimeFlags)
	s.mux.HandleFunc("GET /v1/school/config", s.handleSchoolConfig)
	s.mux.HandleFunc("PUT /v1/school/students/{externalRef}", s.handleSchoolUpsertStudent)
	s.mux.HandleFunc("PUT /v1/school/classes/{id}", s.handleSchoolUpsertClass)
	s.mux.HandleFunc("PUT /v1/school/classes/{id}/students/{externalRef}", s.handleSchoolAssignStudentToClass)
	s.mux.HandleFunc("PUT /v1/school/classes/{id}/credentials", s.handleSchoolGenerateClassCredentials)
	s.mux.HandleFunc("PUT /v1/school/groups/{id}", s.handleSchoolUpsertGroup)
	s.mux.HandleFunc("PUT /v1/school/groups/{id}/students/{externalRef}", s.handleSchoolAssignStudentToGroup)
	s.mux.HandleFunc("GET /v1/learning/worlds", s.handlePublicWorlds)
	s.mux.HandleFunc("GET /v1/students/{studentId}/profile", s.handleStudentProfile)
	s.mux.HandleFunc("GET /v1/students/{studentId}/mastery", s.handleMastery)
	s.mux.HandleFunc("GET /v1/students/{studentId}/attempts", s.handleRecentAttempts)
	s.mux.HandleFunc("GET /v1/students/{studentId}/summary", s.handleEvidenceSummary)
	s.mux.HandleFunc("GET /v1/students/{studentId}/world", s.handleWorldState)
	s.mux.HandleFunc("POST /v1/students/{studentId}/sessions", s.handleStartSession)
	s.mux.HandleFunc("GET /v1/learning/warm-up", s.handleWarmUp)
	s.mux.HandleFunc("GET /v1/learning/next", s.handleNextActivity)
	s.mux.HandleFunc("GET /v1/learning/mission", s.handleConfiguredMission)
	s.mux.HandleFunc("POST /v1/learning/attempt", s.handleAttempt)

	return s
}

func (s *Server) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	withCORS(s.mux).ServeHTTP(w, r)
}

func withCORS(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Authorization, Content-Type, X-Admin-Key, X-School-URN, X-School-Login, X-School-Password, X-Parent-Login, X-Parent-Password, X-Pupil-Session")
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
		"version": "0.4.0",
		"slice":   "3-configurable-platform-closure",
	})
}

func (s *Server) handlePersistence(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{
		"mode": s.persistence,
	})
}

func (s *Server) requireAdmin(w http.ResponseWriter, r *http.Request) bool {
	if bearerToken(r) != "" {
		_, ok := s.requireAccountSession(w, r, "platform_admin", "content_editor", "content_reviewer")
		return ok
	}
	if !s.allowLegacyAuth {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "administrator session required"})
		return false
	}
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

func (s *Server) writeAdminSaveError(w http.ResponseWriter, err error, entity string) {
	if errors.Is(err, learning.ErrInvalidConfiguration) {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}
	slog.Warn("failed to save admin configuration", "entity", entity, "error", err)
	writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "could not save " + entity})
}

func (s *Server) handleUpsertPlatformUser(w http.ResponseWriter, r *http.Request) {
	if bearerToken(r) != "" {
		if !s.requireAdmin(w, r) {
			return
		}
	} else if !s.requireBootstrapAdmin(w, r) {
		return
	}
	repository, ok := s.repo.(platformUserRepository)
	if !ok {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": "platform user management is not available"})
		return
	}
	var in struct {
		DisplayName string   `json:"display_name"`
		LoginID     string   `json:"login_id"`
		Password    string   `json:"password"`
		Roles       []string `json:"roles"`
	}
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid body"})
		return
	}
	saved, err := repository.UpsertPlatformUser(r.Context(), learning.PlatformUserConfig{
		Email: r.PathValue("email"), DisplayName: in.DisplayName, LoginID: in.LoginID, Roles: in.Roles,
	}, in.Password)
	if err != nil {
		s.writeAdminSaveError(w, err, "platform user")
		return
	}
	writeJSON(w, http.StatusOK, saved)
}

func (s *Server) requireBootstrapAdmin(w http.ResponseWriter, r *http.Request) bool {
	if s.adminKey == "" {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": "bootstrap admin key is not configured"})
		return false
	}
	token := strings.TrimSpace(r.Header.Get("X-Admin-Key"))
	if subtle.ConstantTimeCompare([]byte(token), []byte(s.adminKey)) != 1 {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "bootstrap administrator access required"})
		return false
	}
	return true
}

func (s *Server) requireSchoolUser(w http.ResponseWriter, r *http.Request) (learning.SchoolUserConfig, bool) {
	if token := bearerToken(r); token != "" {
		payload, ok := s.requireAccountSession(w, r, "school_admin", "teacher")
		if !ok {
			return learning.SchoolUserConfig{}, false
		}
		return learning.SchoolUserConfig{
			ID: payload.UserID, SchoolURN: payload.SchoolURN, LoginID: payload.LoginID, Role: payload.Role,
		}, true
	}
	if !s.allowLegacyAuth {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "school session required"})
		return learning.SchoolUserConfig{}, false
	}
	schoolURN := strings.TrimSpace(r.Header.Get("X-School-URN"))
	loginID := strings.TrimSpace(r.Header.Get("X-School-Login"))
	password := r.Header.Get("X-School-Password")
	user, ok, err := s.repo.VerifySchoolUser(r.Context(), schoolURN, loginID, password)
	if err != nil {
		slog.Warn("failed to verify school user", "error", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "could not verify school access"})
		return learning.SchoolUserConfig{}, false
	}
	if !ok {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "school access required"})
		return learning.SchoolUserConfig{}, false
	}
	return user, true
}

func (s *Server) requireSchoolAdmin(w http.ResponseWriter, user learning.SchoolUserConfig) bool {
	if strings.EqualFold(strings.TrimSpace(user.Role), "school_admin") {
		return true
	}
	writeJSON(w, http.StatusForbidden, map[string]string{"error": "school admin access required"})
	return false
}

func (s *Server) requireParentUser(w http.ResponseWriter, r *http.Request) (learning.ParentAccountConfig, bool) {
	if token := bearerToken(r); token != "" {
		payload, ok := s.requireAccountSession(w, r, "parent")
		if !ok {
			return learning.ParentAccountConfig{}, false
		}
		return learning.ParentAccountConfig{ID: payload.UserID, LoginID: payload.LoginID, Email: payload.LoginID}, true
	}
	if !s.allowLegacyAuth {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "parent session required"})
		return learning.ParentAccountConfig{}, false
	}
	loginID := strings.TrimSpace(r.Header.Get("X-Parent-Login"))
	password := r.Header.Get("X-Parent-Password")
	parent, ok, err := s.repo.VerifyParentUser(r.Context(), loginID, password)
	if err != nil {
		slog.Warn("failed to verify parent user", "error", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "could not verify parent access"})
		return learning.ParentAccountConfig{}, false
	}
	if !ok {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "parent access required"})
		return learning.ParentAccountConfig{}, false
	}
	return parent, true
}

func (s *Server) handleAdminLogin(w http.ResponseWriter, r *http.Request) {
	var in struct {
		LoginID  string `json:"login_id"`
		Password string `json:"password"`
	}
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid body"})
		return
	}
	verifier, ok := s.repo.(platformUserVerifier)
	if !ok {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": "platform account login is not available"})
		return
	}
	user, verified, err := verifier.VerifyPlatformUser(r.Context(), in.LoginID, in.Password)
	if err != nil {
		slog.Warn("failed to verify platform user", "error", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "could not verify administrator"})
		return
	}
	if !verified || len(user.Roles) == 0 {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "administrator login failed"})
		return
	}
	role := preferredPlatformRole(user.Roles)
	session, err := s.createAccountSession(r.Context(), user.ID, user.LoginID, role, "", 2*time.Hour)
	if err != nil {
		s.writeAccountSessionError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"user": user, "session": session})
}

func (s *Server) handleSchoolLogin(w http.ResponseWriter, r *http.Request) {
	var in struct {
		SchoolURN string `json:"school_urn"`
		LoginID   string `json:"login_id"`
		Password  string `json:"password"`
	}
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid body"})
		return
	}
	user, verified, err := s.repo.VerifySchoolUser(r.Context(), strings.TrimSpace(in.SchoolURN), strings.TrimSpace(in.LoginID), in.Password)
	if err != nil {
		slog.Warn("failed to verify school user", "error", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "could not verify school access"})
		return
	}
	if !verified {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "school login failed"})
		return
	}
	session, err := s.createAccountSession(r.Context(), user.ID, user.LoginID, user.Role, user.SchoolURN, 8*time.Hour)
	if err != nil {
		s.writeAccountSessionError(w, err)
		return
	}
	user.TemporaryPassword = ""
	writeJSON(w, http.StatusOK, map[string]any{"user": user, "session": session})
}

func (s *Server) handleParentLogin(w http.ResponseWriter, r *http.Request) {
	var in struct {
		LoginID  string `json:"login_id"`
		Password string `json:"password"`
	}
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid body"})
		return
	}
	parent, verified, err := s.repo.VerifyParentUser(r.Context(), strings.TrimSpace(in.LoginID), in.Password)
	if err != nil {
		slog.Warn("failed to verify parent user", "error", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "could not verify parent access"})
		return
	}
	if !verified {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "parent login failed"})
		return
	}
	session, err := s.createAccountSession(r.Context(), parent.ID, parent.LoginID, "parent", "", 12*time.Hour)
	if err != nil {
		s.writeAccountSessionError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"parent": parent, "session": session})
}

func (s *Server) handleAccountLogout(w http.ResponseWriter, r *http.Request) {
	token := bearerToken(r)
	if token == "" {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "account session required"})
		return
	}
	if _, ok := s.verifyAccountToken(token); !ok {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "valid account session required"})
		return
	}
	repository, ok := s.repo.(accountSessionRepository)
	if !ok {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": "session revocation is not available"})
		return
	}
	if err := repository.RevokeAccountSession(r.Context(), tokenHash(token)); err != nil {
		s.writeAdminSaveError(w, err, "account session")
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"revoked": true})
}

func (s *Server) createAccountSession(ctx context.Context, userID string, loginID string, role string, schoolURN string, duration time.Duration) (accountSessionResult, error) {
	if s.accountSecret == "" {
		return accountSessionResult{}, errors.New("account session secret is not configured")
	}
	if strings.TrimSpace(userID) == "" {
		return accountSessionResult{}, errors.New("account session user id is missing")
	}
	sessionID, err := randomToken(16)
	if err != nil {
		return accountSessionResult{}, err
	}
	expiresAt := time.Now().UTC().Add(duration)
	payload := accountSessionPayload{
		SessionID: sessionID,
		UserID:    userID,
		LoginID:   strings.ToLower(strings.TrimSpace(loginID)),
		Role:      strings.ToLower(strings.TrimSpace(role)),
		SchoolURN: strings.TrimSpace(schoolURN),
		Purpose:   "account_session",
		ExpiresAt: expiresAt.Format(time.RFC3339),
	}
	payloadBytes, err := json.Marshal(payload)
	if err != nil {
		return accountSessionResult{}, err
	}
	payloadPart := base64.RawURLEncoding.EncodeToString(payloadBytes)
	mac := hmac.New(sha256.New, []byte(s.accountSecret))
	_, _ = mac.Write([]byte(payloadPart))
	token := payloadPart + "." + base64.RawURLEncoding.EncodeToString(mac.Sum(nil))
	repository, ok := s.repo.(accountSessionRepository)
	if !ok {
		return accountSessionResult{}, errors.New("account session persistence is not available")
	}
	_, err = repository.CreateAccountSession(ctx, learning.AccountSession{
		UserID: userID, LoginID: payload.LoginID, Role: payload.Role, SchoolURN: payload.SchoolURN,
		TokenHash: tokenHash(token), ExpiresAt: payload.ExpiresAt,
	})
	if err != nil {
		return accountSessionResult{}, err
	}
	return accountSessionResult{
		Token: token, TokenType: "Bearer", Role: payload.Role, SchoolURN: payload.SchoolURN,
		ExpiresAt: payload.ExpiresAt, ExpiresInSeconds: int(duration.Seconds()),
	}, nil
}

func (s *Server) requireAccountSession(w http.ResponseWriter, r *http.Request, roles ...string) (accountSessionPayload, bool) {
	token := bearerToken(r)
	payload, ok := s.verifyAccountToken(token)
	if !ok {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "valid account session required"})
		return accountSessionPayload{}, false
	}
	allowed := false
	for _, role := range roles {
		if payload.Role == role {
			allowed = true
			break
		}
	}
	if !allowed {
		writeJSON(w, http.StatusForbidden, map[string]string{"error": "account role is not permitted"})
		return accountSessionPayload{}, false
	}
	repository, ok := s.repo.(accountSessionRepository)
	if !ok {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": "account session persistence is not available"})
		return accountSessionPayload{}, false
	}
	stored, active, err := repository.AccountSessionByTokenHash(r.Context(), tokenHash(token))
	if err != nil {
		slog.Warn("failed to verify account session", "error", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "could not verify account session"})
		return accountSessionPayload{}, false
	}
	if !active || stored.UserID != payload.UserID || stored.Role != payload.Role || stored.SchoolURN != payload.SchoolURN {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "account session is expired or revoked"})
		return accountSessionPayload{}, false
	}
	return payload, true
}

func (s *Server) verifyAccountToken(token string) (accountSessionPayload, bool) {
	if s.accountSecret == "" || token == "" {
		return accountSessionPayload{}, false
	}
	parts := strings.Split(token, ".")
	if len(parts) != 2 {
		return accountSessionPayload{}, false
	}
	signature, err := base64.RawURLEncoding.DecodeString(parts[1])
	if err != nil {
		return accountSessionPayload{}, false
	}
	mac := hmac.New(sha256.New, []byte(s.accountSecret))
	_, _ = mac.Write([]byte(parts[0]))
	if !hmac.Equal(signature, mac.Sum(nil)) {
		return accountSessionPayload{}, false
	}
	payloadBytes, err := base64.RawURLEncoding.DecodeString(parts[0])
	if err != nil {
		return accountSessionPayload{}, false
	}
	var payload accountSessionPayload
	if err := json.Unmarshal(payloadBytes, &payload); err != nil {
		return accountSessionPayload{}, false
	}
	expiresAt, err := time.Parse(time.RFC3339, payload.ExpiresAt)
	if err != nil || !expiresAt.After(time.Now().UTC()) || payload.Purpose != "account_session" {
		return accountSessionPayload{}, false
	}
	return payload, true
}

func (s *Server) writeAccountSessionError(w http.ResponseWriter, err error) {
	slog.Warn("failed to create account session", "error", err)
	if strings.Contains(err.Error(), "not configured") || strings.Contains(err.Error(), "not available") {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "could not create account session"})
}

func preferredPlatformRole(roles []string) string {
	for _, preferred := range []string{"platform_admin", "content_reviewer", "content_editor"} {
		for _, role := range roles {
			if role == preferred {
				return role
			}
		}
	}
	return ""
}

func bearerToken(r *http.Request) string {
	token := strings.TrimSpace(r.Header.Get("Authorization"))
	if len(token) > 7 && strings.EqualFold(token[:7], "Bearer ") {
		return strings.TrimSpace(token[7:])
	}
	return ""
}

func tokenHash(token string) string {
	sum := sha256.Sum256([]byte(token))
	return hex.EncodeToString(sum[:])
}

func randomToken(bytesLength int) (string, error) {
	value := make([]byte, bytesLength)
	if _, err := rand.Read(value); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(value), nil
}

func (s *Server) handlePupilLogin(w http.ResponseWriter, r *http.Request) {
	var in struct {
		StudentExternalRef string   `json:"student_external_ref"`
		LoginCode          string   `json:"login_code"`
		PicturePassword    []string `json:"picture_password"`
		QRSecretHash       string   `json:"qr_secret_hash"`
	}
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid body"})
		return
	}
	studentRef := strings.TrimSpace(in.StudentExternalRef)
	loginCode := strings.ToUpper(strings.TrimSpace(in.LoginCode))
	if studentRef == "" || loginCode == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "student_external_ref and login_code are required"})
		return
	}

	credentials, err := s.repo.ListStudentCredentials(r.Context())
	if err != nil {
		slog.Warn("failed to read pupil credentials", "error", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "could not verify pupil login"})
		return
	}
	var credential learning.StudentCredentialConfig
	for _, item := range credentials {
		if strings.EqualFold(item.StudentExternalRef, studentRef) {
			credential = item
			break
		}
	}
	if credential.StudentExternalRef == "" || !strings.EqualFold(strings.TrimSpace(credential.LoginCode), loginCode) {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "login code did not match"})
		return
	}
	if in.QRSecretHash != "" && credential.QRSecretHash != "" && subtle.ConstantTimeCompare([]byte(in.QRSecretHash), []byte(credential.QRSecretHash)) != 1 {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "login card did not match"})
		return
	}
	if len(credential.PicturePassword) > 0 && !sameStringSequence(in.PicturePassword, credential.PicturePassword) {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "picture password did not match"})
		return
	}

	students, err := s.repo.ListStudents(r.Context())
	if err != nil {
		slog.Warn("failed to read pupil profile", "error", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "could not load pupil profile"})
		return
	}
	var student learning.StudentProfileConfig
	for _, item := range students {
		if strings.EqualFold(item.ExternalRef, credential.StudentExternalRef) {
			student = item
			break
		}
	}
	if student.ExternalRef == "" {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "pupil profile was not found"})
		return
	}
	decision, err := s.nextDecision(r.Context(), student.ExternalRef)
	session := s.createPupilSession(student.ExternalRef)
	if err != nil {
		slog.Warn("failed to build pupil next route", "student", student.ExternalRef, "error", err)
		writeJSON(w, http.StatusOK, map[string]any{
			"student": student,
			"session": session,
		})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"student":       student,
		"session":       session,
		"next_activity": decision,
	})
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
	questions, err := s.repo.ListQuestions(r.Context())
	if err != nil {
		slog.Warn("failed to read questions", "error", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "could not read questions"})
		return
	}
	rewardRules, err := s.repo.ListRewardRules(r.Context())
	if err != nil {
		slog.Warn("failed to read reward rules", "error", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "could not read reward rules"})
		return
	}
	students, err := s.repo.ListStudents(r.Context())
	if err != nil {
		slog.Warn("failed to read students", "error", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "could not read students"})
		return
	}
	schools, err := s.repo.ListSchools(r.Context())
	if err != nil {
		slog.Warn("failed to read schools", "error", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "could not read schools"})
		return
	}
	schoolUsers, err := s.repo.ListSchoolUsers(r.Context())
	if err != nil {
		slog.Warn("failed to read school users", "error", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "could not read school users"})
		return
	}
	classes, err := s.repo.ListClasses(r.Context())
	if err != nil {
		slog.Warn("failed to read classes", "error", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "could not read classes"})
		return
	}
	credentials, err := s.repo.ListStudentCredentials(r.Context())
	if err != nil {
		slog.Warn("failed to read student credentials", "error", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "could not read student credentials"})
		return
	}
	groups, err := s.repo.ListGroups(r.Context())
	if err != nil {
		slog.Warn("failed to read groups", "error", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "could not read groups"})
		return
	}
	parentLinks, err := s.repo.ListParentLinks(r.Context())
	if err != nil {
		slog.Warn("failed to read parent links", "error", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "could not read parent links"})
		return
	}
	accessRequests, err := s.repo.ListAccessRequests(r.Context(), "")
	if err != nil {
		slog.Warn("failed to read access requests", "error", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "could not read access requests"})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"feature_flags":       flags,
		"worlds":              worlds,
		"activities":          activities,
		"questions":           questions,
		"reward_rules":        rewardRules,
		"students":            students,
		"schools":             schools,
		"school_users":        schoolUsers,
		"classes":             classes,
		"student_credentials": credentials,
		"groups":              groups,
		"parent_links":        parentLinks,
		"access_requests":     accessRequests,
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

func (s *Server) handleRuntimeFlags(w http.ResponseWriter, r *http.Request) {
	flags, err := s.repo.ListFeatureFlags(r.Context())
	if err != nil {
		slog.Warn("failed to read runtime flags", "error", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "could not read runtime flags"})
		return
	}
	writeJSON(w, http.StatusOK, publicRuntimeFlags(flags))
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
		s.writeAdminSaveError(w, err, "feature flag")
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
		s.writeAdminSaveError(w, err, "world")
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
		s.writeAdminSaveError(w, err, "activity")
		return
	}
	writeJSON(w, http.StatusOK, saved)
}

func (s *Server) handleQuestions(w http.ResponseWriter, r *http.Request) {
	if !s.requireAdmin(w, r) {
		return
	}
	questions, err := s.repo.ListQuestions(r.Context())
	if err != nil {
		slog.Warn("failed to read questions", "error", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "could not read questions"})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"questions": questions})
}

func (s *Server) handleUpsertQuestion(w http.ResponseWriter, r *http.Request) {
	if !s.requireAdmin(w, r) {
		return
	}
	var question learning.QuestionConfig
	if err := json.NewDecoder(r.Body).Decode(&question); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid body"})
		return
	}
	question.ID = r.PathValue("id")
	saved, err := s.repo.UpsertQuestion(r.Context(), question)
	if err != nil {
		s.writeAdminSaveError(w, err, "question")
		return
	}
	writeJSON(w, http.StatusOK, saved)
}

func (s *Server) handleRewardRules(w http.ResponseWriter, r *http.Request) {
	if !s.requireAdmin(w, r) {
		return
	}
	rules, err := s.repo.ListRewardRules(r.Context())
	if err != nil {
		slog.Warn("failed to read reward rules", "error", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "could not read reward rules"})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"reward_rules": rules})
}

func (s *Server) handleUpsertRewardRule(w http.ResponseWriter, r *http.Request) {
	if !s.requireAdmin(w, r) {
		return
	}
	var rule learning.RewardRule
	if err := json.NewDecoder(r.Body).Decode(&rule); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid body"})
		return
	}
	rule.ID = r.PathValue("id")
	saved, err := s.repo.UpsertRewardRule(r.Context(), rule)
	if err != nil {
		s.writeAdminSaveError(w, err, "reward rule")
		return
	}
	writeJSON(w, http.StatusOK, saved)
}

func (s *Server) handleAdminStudents(w http.ResponseWriter, r *http.Request) {
	if !s.requireAdmin(w, r) {
		return
	}
	students, err := s.repo.ListStudents(r.Context())
	if err != nil {
		slog.Warn("failed to read students", "error", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "could not read students"})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"students": students})
}

func (s *Server) handleUpsertStudent(w http.ResponseWriter, r *http.Request) {
	if !s.requireAdmin(w, r) {
		return
	}
	var student learning.StudentProfileConfig
	if err := json.NewDecoder(r.Body).Decode(&student); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid body"})
		return
	}
	student.ExternalRef = r.PathValue("externalRef")
	saved, err := s.repo.UpsertStudent(r.Context(), student)
	if err != nil {
		s.writeAdminSaveError(w, err, "student")
		return
	}
	writeJSON(w, http.StatusOK, saved)
}

func (s *Server) handleSchools(w http.ResponseWriter, r *http.Request) {
	if !s.requireAdmin(w, r) {
		return
	}
	schools, err := s.repo.ListSchools(r.Context())
	if err != nil {
		slog.Warn("failed to read schools", "error", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "could not read schools"})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"schools": schools})
}

func (s *Server) handleUpsertSchool(w http.ResponseWriter, r *http.Request) {
	if !s.requireAdmin(w, r) {
		return
	}
	var school learning.SchoolConfig
	if err := json.NewDecoder(r.Body).Decode(&school); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid body"})
		return
	}
	school.URN = r.PathValue("urn")
	saved, err := s.repo.UpsertSchool(r.Context(), school)
	if err != nil {
		s.writeAdminSaveError(w, err, "school")
		return
	}
	writeJSON(w, http.StatusOK, saved)
}

func (s *Server) handleSchoolUsers(w http.ResponseWriter, r *http.Request) {
	if !s.requireAdmin(w, r) {
		return
	}
	users, err := s.repo.ListSchoolUsers(r.Context())
	if err != nil {
		slog.Warn("failed to read school users", "error", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "could not read school users"})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"school_users": users})
}

func (s *Server) handleUpsertSchoolUser(w http.ResponseWriter, r *http.Request) {
	if !s.requireAdmin(w, r) {
		return
	}
	var user learning.SchoolUserConfig
	if err := json.NewDecoder(r.Body).Decode(&user); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid body"})
		return
	}
	user.SchoolURN = r.PathValue("urn")
	user.Email = r.PathValue("email")
	if user.Status == "" {
		user.Status = "active"
	}
	saved, err := s.repo.UpsertSchoolUser(r.Context(), user)
	if err != nil {
		s.writeAdminSaveError(w, err, "school user")
		return
	}
	writeJSON(w, http.StatusOK, saved)
}

func (s *Server) handleClasses(w http.ResponseWriter, r *http.Request) {
	if !s.requireAdmin(w, r) {
		return
	}
	classes, err := s.repo.ListClasses(r.Context())
	if err != nil {
		slog.Warn("failed to read classes", "error", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "could not read classes"})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"classes": classes})
}

func (s *Server) handleUpsertClass(w http.ResponseWriter, r *http.Request) {
	if !s.requireAdmin(w, r) {
		return
	}
	var classConfig learning.ClassConfig
	if err := json.NewDecoder(r.Body).Decode(&classConfig); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid body"})
		return
	}
	classConfig.ID = r.PathValue("id")
	saved, err := s.repo.UpsertClass(r.Context(), classConfig)
	if err != nil {
		s.writeAdminSaveError(w, err, "class")
		return
	}
	writeJSON(w, http.StatusOK, saved)
}

func (s *Server) handleAssignStudentToClass(w http.ResponseWriter, r *http.Request) {
	if !s.requireAdmin(w, r) {
		return
	}
	saved, err := s.repo.AssignStudentToClass(r.Context(), r.PathValue("id"), r.PathValue("externalRef"))
	if err != nil {
		s.writeAdminSaveError(w, err, "class assignment")
		return
	}
	writeJSON(w, http.StatusOK, saved)
}

func (s *Server) handleGenerateClassCredentials(w http.ResponseWriter, r *http.Request) {
	if !s.requireAdmin(w, r) {
		return
	}
	var in struct {
		Overwrite   bool     `json:"overwrite"`
		PicturePool []string `json:"picture_pool"`
	}
	if r.Body != nil {
		_ = json.NewDecoder(r.Body).Decode(&in)
	}
	batch, err := s.repo.GenerateClassCredentials(r.Context(), r.PathValue("id"), in.Overwrite, in.PicturePool)
	if err != nil {
		s.writeAdminSaveError(w, err, "class credentials")
		return
	}
	writeJSON(w, http.StatusOK, batch)
}

func (s *Server) handleStudentCredentials(w http.ResponseWriter, r *http.Request) {
	if !s.requireAdmin(w, r) {
		return
	}
	credentials, err := s.repo.ListStudentCredentials(r.Context())
	if err != nil {
		slog.Warn("failed to read student credentials", "error", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "could not read student credentials"})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"student_credentials": credentials})
}

func (s *Server) handleUpsertStudentCredential(w http.ResponseWriter, r *http.Request) {
	if !s.requireAdmin(w, r) {
		return
	}
	var credential learning.StudentCredentialConfig
	if err := json.NewDecoder(r.Body).Decode(&credential); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid body"})
		return
	}
	credential.StudentExternalRef = r.PathValue("externalRef")
	saved, err := s.repo.UpsertStudentCredential(r.Context(), credential)
	if err != nil {
		s.writeAdminSaveError(w, err, "student credential")
		return
	}
	writeJSON(w, http.StatusOK, saved)
}

func (s *Server) handleSchoolConfig(w http.ResponseWriter, r *http.Request) {
	user, ok := s.requireSchoolUser(w, r)
	if !ok {
		return
	}
	config, err := s.repo.SchoolPortal(r.Context(), user.SchoolURN)
	if err != nil {
		s.writeAdminSaveError(w, err, "school config")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"school":              config.School,
		"users":               config.Users,
		"classes":             config.Classes,
		"groups":              config.Groups,
		"student_credentials": config.StudentCredentials,
		"current_user":        user,
	})
}

func (s *Server) handleSchoolUpsertStudent(w http.ResponseWriter, r *http.Request) {
	user, ok := s.requireSchoolUser(w, r)
	if !ok {
		return
	}
	if !s.requireSchoolAdmin(w, user) {
		return
	}
	var student learning.StudentProfileConfig
	if err := json.NewDecoder(r.Body).Decode(&student); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid body"})
		return
	}
	student.ExternalRef = r.PathValue("externalRef")
	saved, err := s.repo.UpsertStudent(r.Context(), student)
	if err != nil {
		s.writeAdminSaveError(w, err, "school learner")
		return
	}
	writeJSON(w, http.StatusOK, saved)
}

func (s *Server) handleSchoolUpsertClass(w http.ResponseWriter, r *http.Request) {
	user, ok := s.requireSchoolUser(w, r)
	if !ok {
		return
	}
	if !s.requireSchoolAdmin(w, user) {
		return
	}
	var classConfig learning.ClassConfig
	if err := json.NewDecoder(r.Body).Decode(&classConfig); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid body"})
		return
	}
	classConfig.ID = r.PathValue("id")
	classConfig.SchoolURN = user.SchoolURN
	saved, err := s.repo.UpsertClass(r.Context(), classConfig)
	if err != nil {
		s.writeAdminSaveError(w, err, "school class")
		return
	}
	writeJSON(w, http.StatusOK, saved)
}

func (s *Server) handleSchoolAssignStudentToClass(w http.ResponseWriter, r *http.Request) {
	user, ok := s.requireSchoolUser(w, r)
	if !ok {
		return
	}
	if !s.requireSchoolAdmin(w, user) {
		return
	}
	if !s.classBelongsToSchool(r.Context(), user.SchoolURN, r.PathValue("id")) {
		writeJSON(w, http.StatusForbidden, map[string]string{"error": "class is outside this school"})
		return
	}
	saved, err := s.repo.AssignStudentToClass(r.Context(), r.PathValue("id"), r.PathValue("externalRef"))
	if err != nil {
		s.writeAdminSaveError(w, err, "school class assignment")
		return
	}
	writeJSON(w, http.StatusOK, saved)
}

func (s *Server) handleSchoolGenerateClassCredentials(w http.ResponseWriter, r *http.Request) {
	user, ok := s.requireSchoolUser(w, r)
	if !ok {
		return
	}
	if !s.requireSchoolAdmin(w, user) {
		return
	}
	if !s.classBelongsToSchool(r.Context(), user.SchoolURN, r.PathValue("id")) {
		writeJSON(w, http.StatusForbidden, map[string]string{"error": "class is outside this school"})
		return
	}
	var in struct {
		Overwrite   bool     `json:"overwrite"`
		PicturePool []string `json:"picture_pool"`
	}
	if r.Body != nil {
		_ = json.NewDecoder(r.Body).Decode(&in)
	}
	batch, err := s.repo.GenerateClassCredentials(r.Context(), r.PathValue("id"), in.Overwrite, in.PicturePool)
	if err != nil {
		s.writeAdminSaveError(w, err, "school class credentials")
		return
	}
	writeJSON(w, http.StatusOK, batch)
}

func (s *Server) handleSchoolUpsertGroup(w http.ResponseWriter, r *http.Request) {
	user, ok := s.requireSchoolUser(w, r)
	if !ok {
		return
	}
	var group learning.LearningGroupConfig
	if err := json.NewDecoder(r.Body).Decode(&group); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid body"})
		return
	}
	group.ID = r.PathValue("id")
	if !s.classBelongsToSchool(r.Context(), user.SchoolURN, group.ClassID) {
		writeJSON(w, http.StatusForbidden, map[string]string{"error": "group class is outside this school"})
		return
	}
	saved, err := s.repo.UpsertGroup(r.Context(), group)
	if err != nil {
		s.writeAdminSaveError(w, err, "school group")
		return
	}
	writeJSON(w, http.StatusOK, saved)
}

func (s *Server) handleSchoolAssignStudentToGroup(w http.ResponseWriter, r *http.Request) {
	user, ok := s.requireSchoolUser(w, r)
	if !ok {
		return
	}
	if !s.groupBelongsToSchool(r.Context(), user.SchoolURN, r.PathValue("id")) {
		writeJSON(w, http.StatusForbidden, map[string]string{"error": "group is outside this school"})
		return
	}
	saved, err := s.repo.AssignStudentToGroup(r.Context(), r.PathValue("id"), r.PathValue("externalRef"))
	if err != nil {
		s.writeAdminSaveError(w, err, "school group assignment")
		return
	}
	writeJSON(w, http.StatusOK, saved)
}

func (s *Server) handleGroups(w http.ResponseWriter, r *http.Request) {
	if !s.requireAdmin(w, r) {
		return
	}
	groups, err := s.repo.ListGroups(r.Context())
	if err != nil {
		slog.Warn("failed to read groups", "error", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "could not read groups"})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"groups": groups})
}

func (s *Server) handleUpsertGroup(w http.ResponseWriter, r *http.Request) {
	if !s.requireAdmin(w, r) {
		return
	}
	var group learning.LearningGroupConfig
	if err := json.NewDecoder(r.Body).Decode(&group); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid body"})
		return
	}
	group.ID = r.PathValue("id")
	saved, err := s.repo.UpsertGroup(r.Context(), group)
	if err != nil {
		s.writeAdminSaveError(w, err, "group")
		return
	}
	writeJSON(w, http.StatusOK, saved)
}

func (s *Server) handleAssignStudentToGroup(w http.ResponseWriter, r *http.Request) {
	if !s.requireAdmin(w, r) {
		return
	}
	saved, err := s.repo.AssignStudentToGroup(r.Context(), r.PathValue("id"), r.PathValue("externalRef"))
	if err != nil {
		s.writeAdminSaveError(w, err, "group assignment")
		return
	}
	writeJSON(w, http.StatusOK, saved)
}

func (s *Server) handleParentLinks(w http.ResponseWriter, r *http.Request) {
	if !s.requireAdmin(w, r) {
		return
	}
	links, err := s.repo.ListParentLinks(r.Context())
	if err != nil {
		slog.Warn("failed to read parent links", "error", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "could not read parent links"})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"parent_links": links})
}

func (s *Server) handleUpsertParentLink(w http.ResponseWriter, r *http.Request) {
	if !s.requireAdmin(w, r) {
		return
	}
	var link learning.ParentLinkConfig
	if err := json.NewDecoder(r.Body).Decode(&link); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid body"})
		return
	}
	link.StudentExternalRef = r.PathValue("studentExternalRef")
	saved, err := s.repo.UpsertParentLink(r.Context(), link)
	if err != nil {
		s.writeAdminSaveError(w, err, "parent link")
		return
	}
	writeJSON(w, http.StatusOK, saved)
}

func (s *Server) handleParentInvitations(w http.ResponseWriter, r *http.Request) {
	if !s.requireAdmin(w, r) {
		return
	}
	repository, ok := s.repo.(parentInvitationRepository)
	if !ok {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": "parent invitations are not available"})
		return
	}
	invitations, err := repository.ListParentInvitations(r.Context())
	if err != nil {
		slog.Warn("failed to list parent invitations", "error", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "could not load parent invitations"})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"parent_invitations": invitations})
}

func (s *Server) handleCreateParentInvitation(w http.ResponseWriter, r *http.Request) {
	if !s.requireAdmin(w, r) {
		return
	}
	repository, ok := s.repo.(parentInvitationRepository)
	if !ok {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": "parent invitations are not available"})
		return
	}
	var invitation learning.ParentInvitation
	if err := json.NewDecoder(r.Body).Decode(&invitation); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid body"})
		return
	}
	token, err := randomToken(32)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "could not create invitation token"})
		return
	}
	if strings.TrimSpace(invitation.ExpiresAt) == "" {
		invitation.ExpiresAt = time.Now().UTC().Add(72 * time.Hour).Format(time.RFC3339)
	}
	invitation.TokenHash = tokenHash(token)
	saved, err := repository.CreateParentInvitation(r.Context(), invitation)
	if err != nil {
		s.writeAdminSaveError(w, err, "parent invitation")
		return
	}
	saved.Token = token
	writeJSON(w, http.StatusCreated, map[string]any{
		"parent_invitation": saved,
		"accept_url":        strings.TrimRight(envString("PUBLIC_WEB_URL", "https://nexuslearn-woad.vercel.app"), "/") + "/family?invitation=" + token,
		"delivery": map[string]any{
			"status": "manual",
			"reason": "No transactional email provider is configured; share the invitation URL through an approved channel.",
		},
	})
}

func (s *Server) handleParentInvitationAction(w http.ResponseWriter, r *http.Request) {
	if !s.requireAdmin(w, r) {
		return
	}
	repository, ok := s.repo.(parentInvitationRepository)
	if !ok {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": "parent invitations are not available"})
		return
	}
	id := strings.TrimSpace(r.PathValue("id"))
	action := strings.ToLower(strings.TrimSpace(r.PathValue("action")))
	if action == "resend" {
		invitations, err := repository.ListParentInvitations(r.Context())
		if err != nil {
			s.writeAdminSaveError(w, err, "parent invitations")
			return
		}
		var original learning.ParentInvitation
		for _, invitation := range invitations {
			if invitation.ID == id {
				original = invitation
				break
			}
		}
		if original.ID == "" {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "parent invitation was not found"})
			return
		}
		if original.Status == "accepted" {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "accepted invitations cannot be resent"})
			return
		}
		_, _ = repository.UpdateParentInvitationStatus(r.Context(), original.ID, "revoked")
		token, err := randomToken(32)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "could not rotate invitation token"})
			return
		}
		original.ID = ""
		original.Status = ""
		original.TokenHash = tokenHash(token)
		original.ExpiresAt = time.Now().UTC().Add(72 * time.Hour).Format(time.RFC3339)
		saved, err := repository.CreateParentInvitation(r.Context(), original)
		if err != nil {
			s.writeAdminSaveError(w, err, "parent invitation")
			return
		}
		saved.Token = token
		writeJSON(w, http.StatusOK, map[string]any{"parent_invitation": saved, "rotated": true})
		return
	}
	if action != "sent" && action != "revoke" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invitation action must be sent, resend or revoke"})
		return
	}
	status := action
	if action == "revoke" {
		status = "revoked"
	}
	saved, err := repository.UpdateParentInvitationStatus(r.Context(), id, status)
	if err != nil {
		s.writeAdminSaveError(w, err, "parent invitation")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"parent_invitation": saved})
}

func (s *Server) handleCreateAccessRequest(w http.ResponseWriter, r *http.Request) {
	var request learning.AccessRequestConfig
	if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid body"})
		return
	}
	saved, err := s.repo.CreateAccessRequest(r.Context(), request)
	if err != nil {
		if errors.Is(err, learning.ErrInvalidConfiguration) {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
			return
		}
		slog.Warn("failed to create access request", "error", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "could not create access request"})
		return
	}
	writeJSON(w, http.StatusCreated, saved)
}

func (s *Server) handleParentSignup(w http.ResponseWriter, r *http.Request) {
	var parent learning.ParentAccountConfig
	if err := json.NewDecoder(r.Body).Decode(&parent); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid body"})
		return
	}
	saved, err := s.repo.UpsertParentAccount(r.Context(), parent)
	if err != nil {
		if errors.Is(err, learning.ErrInvalidConfiguration) {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
			return
		}
		slog.Warn("failed to create parent account", "error", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "could not create parent account"})
		return
	}
	session, sessionErr := s.createAccountSession(r.Context(), saved.ID, saved.LoginID, "parent", "", 12*time.Hour)
	if sessionErr != nil {
		s.writeAccountSessionError(w, sessionErr)
		return
	}
	writeJSON(w, http.StatusCreated, map[string]any{"parent": saved, "session": session})
}

func (s *Server) handleAcceptParentInvitation(w http.ResponseWriter, r *http.Request) {
	repository, ok := s.repo.(parentInvitationRepository)
	if !ok {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": "parent invitations are not available"})
		return
	}
	var in struct {
		Token       string `json:"token"`
		DisplayName string `json:"display_name"`
		Password    string `json:"password"`
	}
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid body"})
		return
	}
	if len(in.Password) < 8 {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "password must be at least eight characters"})
		return
	}
	hash := tokenHash(strings.TrimSpace(in.Token))
	invitation, valid, err := repository.ParentInvitationByTokenHash(r.Context(), hash)
	if err != nil {
		slog.Warn("failed to verify parent invitation", "error", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "could not verify parent invitation"})
		return
	}
	if !valid {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "invitation is invalid, expired or revoked"})
		return
	}
	displayName := strings.TrimSpace(in.DisplayName)
	if displayName == "" {
		displayName = invitation.ParentDisplayName
	}
	parent, err := s.repo.UpsertParentAccount(r.Context(), learning.ParentAccountConfig{
		Email: invitation.ParentEmail, LoginID: invitation.ParentEmail, DisplayName: displayName,
		Password: in.Password, Status: "active",
	})
	if err != nil {
		s.writeAdminSaveError(w, err, "parent account")
		return
	}
	accepted, err := repository.AcceptParentInvitation(r.Context(), hash, parent.ID)
	if err != nil {
		s.writeAdminSaveError(w, err, "parent invitation acceptance")
		return
	}
	session, err := s.createAccountSession(r.Context(), parent.ID, parent.LoginID, "parent", "", 12*time.Hour)
	if err != nil {
		s.writeAccountSessionError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"parent": parent, "parent_invitation": accepted, "session": session})
}

func (s *Server) handleParentConfig(w http.ResponseWriter, r *http.Request) {
	parent, ok := s.requireParentUser(w, r)
	if !ok {
		return
	}
	portal, err := s.repo.ParentPortal(r.Context(), parent.LoginID)
	if err != nil {
		s.writeAdminSaveError(w, err, "parent config")
		return
	}
	writeJSON(w, http.StatusOK, portal)
}

func (s *Server) handleParentChildEvidence(w http.ResponseWriter, r *http.Request) {
	parent, ok := s.requireParentUser(w, r)
	if !ok {
		return
	}
	externalRef := r.PathValue("externalRef")
	portal, err := s.repo.ParentPortal(r.Context(), parent.LoginID)
	if err != nil {
		s.writeAdminSaveError(w, err, "parent child evidence")
		return
	}
	var child learning.ParentChildConfig
	for _, item := range portal.Children {
		if strings.EqualFold(item.Student.ExternalRef, externalRef) {
			child = item
			break
		}
	}
	if child.Student.ExternalRef == "" {
		writeJSON(w, http.StatusForbidden, map[string]string{"error": "child is outside this parent account"})
		return
	}
	mastery, err := s.repo.ListMastery(r.Context(), externalRef)
	if err != nil {
		slog.Warn("failed to read parent child mastery", "error", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "could not read mastery"})
		return
	}
	attempts, err := s.repo.RecentAttempts(r.Context(), externalRef, 10)
	if err != nil {
		slog.Warn("failed to read parent child attempts", "error", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "could not read attempts"})
		return
	}
	summary, err := s.repo.EvidenceSummary(r.Context(), externalRef)
	if err != nil {
		slog.Warn("failed to read parent child summary", "error", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "could not read summary"})
		return
	}
	var nextActivity any
	if decision, err := s.nextDecision(r.Context(), externalRef); err == nil {
		nextActivity = decision
	} else {
		slog.Warn("failed to build parent child next activity", "student", externalRef, "error", err)
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"child":         child,
		"mastery":       mastery,
		"attempts":      attempts,
		"summary":       summary,
		"next_activity": nextActivity,
	})
}

func (s *Server) handleParentUpsertChild(w http.ResponseWriter, r *http.Request) {
	parent, ok := s.requireParentUser(w, r)
	if !ok {
		return
	}
	var in struct {
		DisplayName string                            `json:"display_name"`
		YearGroup   int                               `json:"year_group"`
		Engagement  learning.StudentEngagementProfile `json:"engagement"`
	}
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid body"})
		return
	}
	externalRef := r.PathValue("externalRef")
	student, err := s.repo.UpsertStudent(r.Context(), learning.StudentProfileConfig{
		ExternalRef: externalRef,
		DisplayName: in.DisplayName,
		YearGroup:   in.YearGroup,
	})
	if err != nil {
		s.writeAdminSaveError(w, err, "parent child")
		return
	}
	_, err = s.repo.UpsertParentLink(r.Context(), learning.ParentLinkConfig{
		ParentEmail:        parent.Email,
		ParentDisplayName:  parent.DisplayName,
		StudentExternalRef: externalRef,
		Relationship:       "parent",
		Status:             "active",
	})
	if err != nil {
		s.writeAdminSaveError(w, err, "parent child link")
		return
	}
	credential, err := s.repo.UpsertStudentCredential(r.Context(), learning.StudentCredentialConfig{
		StudentExternalRef: externalRef,
		LoginCode:          homeLoginCode(externalRef),
		PicturePassword:    []string{"star", "book", "sun"},
	})
	if err != nil {
		s.writeAdminSaveError(w, err, "parent child credential")
		return
	}
	in.Engagement.StudentExternalRef = externalRef
	engagement, err := s.repo.UpsertStudentEngagement(r.Context(), in.Engagement)
	if err != nil {
		s.writeAdminSaveError(w, err, "parent child engagement")
		return
	}
	writeJSON(w, http.StatusOK, learning.ParentChildConfig{Student: student, Credential: credential, Engagement: engagement})
}

func (s *Server) handleParentUpsertEngagement(w http.ResponseWriter, r *http.Request) {
	parent, ok := s.requireParentUser(w, r)
	if !ok {
		return
	}
	externalRef := r.PathValue("externalRef")
	if !s.parentOwnsChild(r.Context(), parent.LoginID, externalRef) {
		writeJSON(w, http.StatusForbidden, map[string]string{"error": "child is outside this parent account"})
		return
	}
	var profile learning.StudentEngagementProfile
	if err := json.NewDecoder(r.Body).Decode(&profile); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid body"})
		return
	}
	profile.StudentExternalRef = externalRef
	saved, err := s.repo.UpsertStudentEngagement(r.Context(), profile)
	if err != nil {
		s.writeAdminSaveError(w, err, "parent child engagement")
		return
	}
	writeJSON(w, http.StatusOK, saved)
}

func (s *Server) handleAccessRequests(w http.ResponseWriter, r *http.Request) {
	if !s.requireAdmin(w, r) {
		return
	}
	requests, err := s.repo.ListAccessRequests(r.Context(), r.URL.Query().Get("status"))
	if err != nil {
		if errors.Is(err, learning.ErrInvalidConfiguration) {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
			return
		}
		slog.Warn("failed to read access requests", "error", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "could not read access requests"})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"access_requests": requests})
}

func (s *Server) handleUpdateAccessRequestStatus(w http.ResponseWriter, r *http.Request) {
	if !s.requireAdmin(w, r) {
		return
	}
	var in struct {
		Status string `json:"status"`
	}
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid body"})
		return
	}
	saved, err := s.repo.UpdateAccessRequestStatus(r.Context(), r.PathValue("id"), in.Status)
	if err != nil {
		s.writeAdminSaveError(w, err, "access request")
		return
	}
	writeJSON(w, http.StatusOK, saved)
}

func (s *Server) handleConvertAccessRequest(w http.ResponseWriter, r *http.Request) {
	if !s.requireAdmin(w, r) {
		return
	}
	var in accessRequestConversionInput
	if r.Body != nil {
		if err := json.NewDecoder(r.Body).Decode(&in); err != nil && !errors.Is(err, io.EOF) {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid body"})
			return
		}
	}
	request, ok, err := s.accessRequestByID(r.Context(), r.PathValue("id"))
	if err != nil {
		slog.Warn("failed to read access request for conversion", "error", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "could not read access request"})
		return
	}
	if !ok {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "access request was not found"})
		return
	}
	if request.RequestType != "school" && request.RequestType != "tutor_org" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "only school and tutoring organisation requests can be converted into organisations"})
		return
	}
	if request.Status != "approved" && request.Status != "converted" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "access request must be approved before conversion"})
		return
	}

	schoolName := strings.TrimSpace(in.SchoolName)
	if schoolName == "" {
		schoolName = strings.TrimSpace(request.OrganisationName)
	}
	schoolURN := safeSlug(in.SchoolURN)
	if schoolURN == "" {
		schoolURN = safeSlug(schoolName)
	}
	if schoolURN == "" || schoolName == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "school name and urn are required for conversion"})
		return
	}

	school, err := s.repo.UpsertSchool(r.Context(), learning.SchoolConfig{
		URN:    schoolURN,
		Name:   schoolName,
		Status: "trial",
	})
	if err != nil {
		s.writeAdminSaveError(w, err, "converted school")
		return
	}

	staffEmail := strings.ToLower(strings.TrimSpace(in.StaffEmail))
	if staffEmail == "" {
		staffEmail = strings.ToLower(strings.TrimSpace(request.ContactEmail))
	}
	staffName := strings.TrimSpace(in.StaffName)
	if staffName == "" {
		staffName = strings.TrimSpace(request.ContactName)
	}
	staffRole := strings.TrimSpace(in.StaffRole)
	if staffRole == "" {
		staffRole = "school_admin"
	}
	staffStatus := strings.TrimSpace(in.StaffStatus)
	if staffStatus == "" {
		staffStatus = "active"
	}
	var schoolUser learning.SchoolUserConfig
	if staffEmail != "" && staffName != "" {
		schoolUser, err = s.repo.UpsertSchoolUser(r.Context(), learning.SchoolUserConfig{
			SchoolURN:   schoolURN,
			Email:       staffEmail,
			DisplayName: staffName,
			Role:        staffRole,
			Status:      staffStatus,
		})
		if err != nil {
			s.writeAdminSaveError(w, err, "converted school user")
			return
		}
	}

	classYear := in.ClassYearGroup
	if classYear == 0 && len(request.YearGroups) > 0 {
		classYear = request.YearGroups[0]
	}
	if classYear == 0 && in.CreateStarterClass {
		classYear = 1
	}
	className := strings.TrimSpace(in.ClassName)
	if classYear == 0 && className != "" {
		classYear = 1
	}
	if className == "" && classYear > 0 {
		className = "Pilot Y" + yearText(classYear)
	}
	var classConfig learning.ClassConfig
	if in.CreateStarterClass || className != "" {
		classConfig, err = s.repo.UpsertClass(r.Context(), learning.ClassConfig{
			SchoolURN: schoolURN,
			Name:      className,
			YearGroup: classYear,
		})
		if err != nil {
			s.writeAdminSaveError(w, err, "converted starter class")
			return
		}
	}

	converted, err := s.repo.UpdateAccessRequestStatus(r.Context(), request.ID, "converted")
	if err != nil {
		s.writeAdminSaveError(w, err, "converted access request")
		return
	}
	writeJSON(w, http.StatusOK, accessRequestConversionResult{
		AccessRequest: converted,
		School:        school,
		SchoolUser:    schoolUser,
		Class:         classConfig,
	})
}

func (s *Server) handleAuditLogs(w http.ResponseWriter, r *http.Request) {
	if !s.requireAdmin(w, r) {
		return
	}
	logs, err := s.repo.ListAuditLogs(r.Context(), 50)
	if err != nil {
		slog.Warn("failed to read audit logs", "error", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "could not read audit logs"})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"audit_logs": logs})
}

func (s *Server) handleContentVersions(w http.ResponseWriter, r *http.Request) {
	if !s.requireAdmin(w, r) {
		return
	}
	versions, err := s.repo.ListContentVersions(r.Context(), 100)
	if err != nil {
		slog.Warn("failed to read content versions", "error", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "could not read content versions"})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"content_versions": versions})
}

func (s *Server) handleRestoreContentVersion(w http.ResponseWriter, r *http.Request) {
	if !s.requireAdmin(w, r) {
		return
	}
	id := strings.TrimSpace(r.PathValue("id"))
	if id == "" {
		id = strings.TrimSpace(r.URL.Query().Get("id"))
	}
	version, err := s.repo.RestoreContentVersion(r.Context(), id)
	if err != nil {
		s.writeAdminSaveError(w, err, "content version")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"content_version": version, "restored": true})
}

func (s *Server) handlePromoteContentVersion(w http.ResponseWriter, r *http.Request) {
	if !s.requireAdmin(w, r) {
		return
	}
	var in struct {
		Status string `json:"status"`
	}
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid body"})
		return
	}
	target := strings.ToLower(strings.TrimSpace(in.Status))
	if token := bearerToken(r); token != "" {
		payload, ok := s.verifyAccountToken(token)
		if !ok {
			writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "valid administrator session required"})
			return
		}
		if (target == "published" || target == "live" || target == "archived") && payload.Role != "platform_admin" {
			writeJSON(w, http.StatusForbidden, map[string]string{"error": "platform admin approval is required for this transition"})
			return
		}
		if target == "approved" && payload.Role == "content_editor" {
			writeJSON(w, http.StatusForbidden, map[string]string{"error": "content reviewer approval is required"})
			return
		}
	}
	repository, ok := s.repo.(contentPromotionRepository)
	if !ok {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": "content promotion is not available"})
		return
	}
	version, err := repository.PromoteContentVersion(r.Context(), r.PathValue("id"), target)
	if err != nil {
		s.writeAdminSaveError(w, err, "content promotion")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"content_version": version, "promoted": true})
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
		s.writeAdminSaveError(w, err, "objective")
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

func (s *Server) handleCurriculumMap(w http.ResponseWriter, r *http.Request) {
	objectives, err := s.repo.ListObjectives(r.Context())
	if err != nil {
		slog.Warn("failed to read curriculum map", "error", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "could not read curriculum map"})
		return
	}
	writeJSON(w, http.StatusOK, buildCurriculumMap(objectives))
}

func (s *Server) handleContentReadiness(w http.ResponseWriter, r *http.Request) {
	if !s.requireAdmin(w, r) {
		return
	}
	objectives, err := s.repo.ListObjectives(r.Context())
	if err != nil {
		slog.Warn("failed to read readiness objectives", "error", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "could not read objectives"})
		return
	}
	activities, err := s.repo.ListActivities(r.Context())
	if err != nil {
		slog.Warn("failed to read readiness activities", "error", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "could not read activities"})
		return
	}
	questions, err := s.repo.ListQuestions(r.Context())
	if err != nil {
		slog.Warn("failed to read readiness questions", "error", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "could not read questions"})
		return
	}
	writeJSON(w, http.StatusOK, buildContentReadinessReport(objectives, activities, questions))
}

func (s *Server) handlePublicWorlds(w http.ResponseWriter, r *http.Request) {
	worlds, err := s.repo.ListWorlds(r.Context())
	if err != nil {
		slog.Warn("failed to read public worlds", "error", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "could not read worlds"})
		return
	}
	enabled := []learning.WorldConfig{}
	for _, world := range worlds {
		if world.Enabled {
			enabled = append(enabled, world)
		}
	}
	writeJSON(w, http.StatusOK, map[string]any{"worlds": enabled})
}

func (s *Server) handleStudentProfile(w http.ResponseWriter, r *http.Request) {
	studentID := r.PathValue("studentId")
	if !s.requirePupilSession(w, r, studentID) {
		return
	}
	decision, err := s.nextDecision(r.Context(), studentID)
	if err != nil {
		slog.Warn("failed to build student profile", "error", err)
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "no configured learner profile available"})
		return
	}
	companionName := ""
	worlds, _ := s.repo.ListWorlds(r.Context())
	for _, world := range worlds {
		if world.Key == decision.WorldKey {
			companionName = mapString(world.Config, "companion", "")
			break
		}
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"student_id":         studentID,
		"display_name":       displayNameFromStudentID(studentID),
		"year_group":         worldYear(worlds, decision.WorldKey),
		"active_world":       decision.World,
		"active_realm":       decision.Realm,
		"active_world_key":   decision.WorldKey,
		"companion_name":     companionName,
		"accessibility_mode": "",
		"next_activity_id":   decision.ActivityID,
	})
}

func (s *Server) handleMastery(w http.ResponseWriter, r *http.Request) {
	studentID := r.PathValue("studentId")
	if !s.requirePupilSession(w, r, studentID) {
		return
	}
	mastery, err := s.repo.ListMastery(r.Context(), studentID)
	if err != nil {
		slog.Warn("failed to read mastery", "error", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "could not read mastery"})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"student_id": studentID,
		"mastery":    mastery,
	})
}

func (s *Server) handleRecentAttempts(w http.ResponseWriter, r *http.Request) {
	studentID := r.PathValue("studentId")
	if !s.requirePupilSession(w, r, studentID) {
		return
	}
	attempts, err := s.repo.RecentAttempts(r.Context(), studentID, 10)
	if err != nil {
		slog.Warn("failed to read recent attempts", "error", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "could not read attempts"})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"student_id": studentID,
		"attempts":   attempts,
	})
}

func (s *Server) handleEvidenceSummary(w http.ResponseWriter, r *http.Request) {
	studentID := r.PathValue("studentId")
	if !s.requirePupilSession(w, r, studentID) {
		return
	}
	summary, err := s.repo.EvidenceSummary(r.Context(), studentID)
	if err != nil {
		slog.Warn("failed to read evidence summary", "error", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "could not read summary"})
		return
	}
	writeJSON(w, http.StatusOK, summary)
}

func (s *Server) handleWorldState(w http.ResponseWriter, r *http.Request) {
	studentID := r.PathValue("studentId")
	if !s.requirePupilSession(w, r, studentID) {
		return
	}
	worldKey := r.URL.Query().Get("worldKey")
	state, err := s.repo.WorldState(r.Context(), studentID, worldKey)
	if err != nil {
		slog.Warn("failed to read world state", "error", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "could not read world state"})
		return
	}
	writeJSON(w, http.StatusOK, state)
}

func (s *Server) handleStartSession(w http.ResponseWriter, r *http.Request) {
	studentID := r.PathValue("studentId")
	if !s.requirePupilSession(w, r, studentID) {
		return
	}
	var in struct {
		Mode       string `json:"mode"`
		DeviceTier string `json:"device_tier"`
	}
	if r.Body != nil {
		_ = json.NewDecoder(r.Body).Decode(&in)
	}
	session, err := s.repo.StartSession(r.Context(), studentID, in.Mode, in.DeviceTier)
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
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "studentId is required"})
		return
	}
	if !s.requirePupilSession(w, r, studentID) {
		return
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
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "studentId is required"})
		return
	}
	if !s.requirePupilSession(w, r, studentID) {
		return
	}
	decision, err := s.nextDecision(r.Context(), studentID)
	if err != nil {
		slog.Warn("failed to build configured next activity", "error", err)
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "no configured activity available"})
		return
	}
	writeJSON(w, http.StatusOK, decision)
}

func (s *Server) handleConfiguredMission(w http.ResponseWriter, r *http.Request) {
	studentID := r.URL.Query().Get("studentId")
	if studentID == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "studentId is required"})
		return
	}
	if !s.requirePupilSession(w, r, studentID) {
		return
	}
	activityID := r.URL.Query().Get("activityId")
	worldKey := r.URL.Query().Get("world")
	activities, err := s.repo.ListActivities(r.Context())
	if err != nil {
		slog.Warn("failed to read mission activities", "error", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "could not read mission"})
		return
	}
	worlds, _ := s.repo.ListWorlds(r.Context())
	activity, ok := chooseActivity(activities, activityID, worldKey, worlds, s.preferredYear(r.Context(), studentID))
	if !ok {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "no configured mission available"})
		return
	}
	objective, _, _ := s.repo.GetObjective(r.Context(), activity.ObjectiveID)
	world := worldForActivity(worlds, activity)
	adaptations := s.runtimeAdaptations(r.Context(), studentID)
	questions, err := s.repo.ListQuestions(r.Context())
	if err != nil {
		slog.Warn("failed to read mission questions", "error", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "could not read questions"})
		return
	}
	flags, err := s.repo.ListFeatureFlags(r.Context())
	if err != nil {
		slog.Warn("failed to read mission release flags", "error", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "could not read release flags"})
		return
	}
	releaseFlags := publicRuntimeFlags(flags)
	filtered := []learning.QuestionConfig{}
	questionLimit := adaptations.QuestionLimit
	if questionLimit <= 0 {
		questionLimit = 10
	}
	for _, question := range questions {
		if !isRuntimeStatus(question.Status) {
			continue
		}
		if !s.questionAllowedByReleaseFlags(r.Context(), studentID, question, releaseFlags) {
			continue
		}
		if question.ActivityID == activity.ID || (question.ActivityID == "" && question.ObjectiveID == activity.ObjectiveID) {
			filtered = append(filtered, question)
		}
		if len(filtered) >= questionLimit {
			break
		}
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"student_id":          studentID,
		"activity":            activity,
		"objective":           objective,
		"world":               world,
		"questions":           filtered,
		"runtime_adaptations": adaptations,
	})
}

func (s *Server) questionAllowedByReleaseFlags(ctx context.Context, studentID string, question learning.QuestionConfig, flags learning.RuntimeFlags) bool {
	format := strings.ToLower(strings.TrimSpace(question.Format))
	if advancedInteractionFormat(format) && !s.runtimeFlagEnabledForStudent(ctx, studentID, flags, "advanced_interaction_renderers_enabled") {
		return false
	}
	if producedNarrationFormat(format) && !s.runtimeFlagEnabledForStudent(ctx, studentID, flags, "child_audio_narration_enabled") {
		return false
	}
	return true
}

func (s *Server) runtimeFlagEnabledForStudent(ctx context.Context, studentID string, flags learning.RuntimeFlags, key string) bool {
	enabled := flags.Flags[key]
	config := flags.Config[key]
	if config == nil {
		return enabled
	}
	if containsString(configStringList(config, "blocked_student_ids"), studentID) {
		return false
	}
	if containsString(configStringList(config, "pilot_student_ids"), studentID) || containsString(configStringList(config, "allowed_student_ids"), studentID) {
		return true
	}
	schoolURN, ok := s.studentSchoolURN(ctx, studentID)
	if ok {
		if containsString(configStringList(config, "blocked_school_urns"), schoolURN) {
			return false
		}
		if containsString(configStringList(config, "pilot_school_urns"), schoolURN) || containsString(configStringList(config, "allowed_school_urns"), schoolURN) {
			return true
		}
	}
	return enabled
}

func advancedInteractionFormat(format string) bool {
	switch format {
	case "circuit-builder", "scale-build", "symbol-build", "sentence-build", "short-response",
		"free-text", "table-input", "graph-input", "drag-drop", "canvas-stroke", "handwriting",
		"ratio-table-input":
		return true
	default:
		return false
	}
}

func producedNarrationFormat(format string) bool {
	switch format {
	case "audio-narration", "narrated-teach", "phonics-audio-production":
		return true
	default:
		return false
	}
}

func (s *Server) handleAttempt(w http.ResponseWriter, r *http.Request) {
	var in learning.Attempt
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid body"})
		return
	}
	if !s.requirePupilSession(w, r, in.StudentID) {
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

func (s *Server) nextDecision(ctx context.Context, studentID string) (learning.NextActivityDecision, error) {
	activities, err := s.repo.ListActivities(ctx)
	if err != nil {
		return learning.NextActivityDecision{}, err
	}
	worlds, _ := s.repo.ListWorlds(ctx)
	activity, ok := chooseActivity(activities, "", "", worlds, s.preferredYear(ctx, studentID))
	if !ok {
		return learning.NextActivityDecision{}, errors.New("no configured activity available")
	}
	objective, _, _ := s.repo.GetObjective(ctx, activity.ObjectiveID)
	world := worldForActivity(worlds, activity)
	interaction := mapString(activity.Interaction, "type", activity.TemplateID)
	if interaction == "" {
		interaction = "configured-activity"
	}
	animationHook := mapString(activity.AnimationHooks, "primary", "portal-open")
	rewardHook := mapString(activity.AnimationHooks, "reward", "world-growth")
	adaptations := s.runtimeAdaptations(ctx, studentID)
	realm := mapString(world.Config, "realm", "")
	if realm == "" {
		realm = world.Name
		if world.YearGroup > 0 {
			realm = "Year " + intString(world.YearGroup) + " " + world.Name
		}
	}
	explanation := mapString(activity.Feedback, "selection_reason", "")
	if explanation == "" {
		explanation = "This activity is selected from the configured curriculum and content layer."
	}
	companionPrompt := mapString(activity.Feedback, "companion_prompt", "Let's try this together, then you can teach the idea back to me.")
	return learning.NextActivityDecision{
		StudentID:          studentID,
		ObjectiveID:        activity.ObjectiveID,
		ActivityID:         activity.ID,
		WorldKey:           world.Key,
		World:              world.Name,
		Realm:              realm,
		Interaction:        interaction,
		Difficulty:         activity.Difficulty,
		Scaffold:           mapBool(activity.Interaction, "scaffold", false),
		Review:             mapBool(activity.Interaction, "review", true),
		PrerequisiteProbe:  mapBool(activity.Interaction, "prerequisite_probe", false),
		RewardHook:         rewardHook,
		AnimationHook:      animationHook,
		Explanation:        explanation,
		CompanionPrompt:    companionPrompt,
		RecommendedActions: recommendedActions(activity, objective),
		RuntimeAdaptations: adaptations,
	}, nil
}

func (s *Server) runtimeAdaptations(ctx context.Context, studentID string) learning.RuntimeAdaptations {
	profile, err := s.repo.StudentEngagement(ctx, studentID)
	if err != nil {
		slog.Warn("failed to read runtime engagement profile", "student_id", studentID, "error", err)
		profile = learning.StudentEngagementProfile{StudentExternalRef: studentID}
	}
	if profile.StudentExternalRef == "" {
		profile.StudentExternalRef = studentID
	}
	return runtimeAdaptationsFromProfile(profile)
}

func runtimeAdaptationsFromProfile(profile learning.StudentEngagementProfile) learning.RuntimeAdaptations {
	out := learning.RuntimeAdaptations{
		AnimationTier:        "standard",
		ReducedMotion:        false,
		CelebrationIntensity: profile.CelebrationIntensity,
		SessionLength:        profile.SessionLength,
		QuestionLimit:        10,
		ScaffoldLevel:        "standard",
		AudioSupport:         profile.AudioSupport,
		ReadingSupport:       profile.ReadingSupport,
		CompanionStyle:       profile.CompanionStyle,
		RewardStyle:          profile.RewardStyle,
		Reasons:              []string{},
	}
	if out.CelebrationIntensity == "" {
		out.CelebrationIntensity = "balanced"
	}
	if out.SessionLength == "" {
		out.SessionLength = "standard"
	}
	if out.CompanionStyle == "" {
		out.CompanionStyle = "friendly"
	}
	if out.RewardStyle == "" {
		out.RewardStyle = "world_building"
	}
	if profile.SensoryLoad == "low" || containsString(profile.LearningApproaches, "low_sensory") {
		out.AnimationTier = "low"
		out.ReducedMotion = true
		out.CelebrationIntensity = "quiet"
		out.Reasons = append(out.Reasons, "Low-sensory profile reduces motion and celebration intensity.")
	}
	if containsString(profile.LearningApproaches, "reduced_motion") {
		out.ReducedMotion = true
		out.AnimationTier = "low"
		out.Reasons = append(out.Reasons, "Reduced-motion preference is enabled.")
	}
	if profile.SessionLength == "short" || profile.AttentionSupport == "chunked" || containsString(profile.LearningApproaches, "short_bursts") {
		out.SessionLength = "short"
		out.QuestionLimit = 5
		out.ScaffoldLevel = "chunked"
		out.Reasons = append(out.Reasons, "Short-burst support keeps missions smaller and more predictable.")
	}
	if profile.SessionLength == "extended" && out.QuestionLimit > 5 {
		out.SessionLength = "extended"
		out.QuestionLimit = 12
	}
	if profile.AttentionSupport == "high_structure" {
		out.ScaffoldLevel = "high_structure"
		out.Reasons = append(out.Reasons, "High-structure attention support adds clearer steps.")
	}
	if profile.ProcessingSupport == "extra_time" || profile.ProcessingSupport == "step_by_step" || containsString(profile.LearningApproaches, "extra_processing_time") {
		out.ScaffoldLevel = "step_by_step"
		out.Reasons = append(out.Reasons, "Processing support favours step-by-step scaffolds and extra thinking time.")
	}
	if profile.AudioSupport || profile.CommunicationSupport == "audio_visual" || containsString(profile.LearningApproaches, "audio_read_aloud") {
		out.AudioSupport = true
		out.Reasons = append(out.Reasons, "Audio support is enabled for prompts and reinforcement.")
	}
	if profile.ReadingSupport || containsString(profile.DeclaredSupportNeeds, "dyslexia") {
		out.ReadingSupport = true
		out.Reasons = append(out.Reasons, "Reading support reduces text burden and adds visual anchors.")
	}
	if profile.ConfidenceSupport == "gentle" || containsString(profile.DeclaredSupportNeeds, "anxiety_confidence") || containsString(profile.LearningApproaches, "confidence_first") {
		out.CelebrationIntensity = "quiet"
		out.Reasons = append(out.Reasons, "Confidence support uses gentle feedback and repair-first language.")
	}
	if len(out.Reasons) == 0 {
		out.Reasons = append(out.Reasons, "Balanced default runtime profile.")
	}
	return out
}

func publicRuntimeFlags(flags []learning.FeatureFlag) learning.RuntimeFlags {
	defaults := map[string]bool{
		"child_play_enabled":                     true,
		"public_access_requests":                 true,
		"public_family_signup":                   true,
		"public_school_workspace":                true,
		"public_demo_learner_enabled":            false,
		"show_demo_badges":                       true,
		"child_visual_portals_enabled":           true,
		"child_world_ambient_motion_enabled":     true,
		"child_audio_narration_enabled":          false,
		"advanced_interaction_renderers_enabled": false,
		"configured_runtime_content":             true,
		"demo_mode_fallbacks":                    false,
		"low_sensory_default":                    false,
	}
	out := learning.RuntimeFlags{
		Flags:       map[string]bool{},
		Config:      map[string]map[string]any{},
		GeneratedAt: time.Now().UTC().Format(time.RFC3339),
	}
	for key, enabled := range defaults {
		out.Flags[key] = enabled
		out.Config[key] = map[string]any{}
	}
	for _, flag := range flags {
		key := strings.TrimSpace(flag.Key)
		if _, ok := defaults[key]; !ok {
			continue
		}
		out.Flags[key] = flag.Enabled
		if flag.Config == nil {
			out.Config[key] = map[string]any{}
		} else {
			out.Config[key] = flag.Config
		}
	}
	return out
}

func buildContentReadinessReport(objectives []learning.Objective, activities []learning.ActivityConfig, questions []learning.QuestionConfig) contentReadinessReport {
	activitiesByObjective := map[string][]learning.ActivityConfig{}
	activityObjectives := map[string]string{}
	for _, activity := range activities {
		activitiesByObjective[activity.ObjectiveID] = append(activitiesByObjective[activity.ObjectiveID], activity)
		activityObjectives[activity.ID] = activity.ObjectiveID
	}

	questionsByObjective := map[string][]learning.QuestionConfig{}
	for _, question := range questions {
		objectiveID := strings.TrimSpace(question.ObjectiveID)
		if objectiveID == "" {
			objectiveID = activityObjectives[question.ActivityID]
		}
		questionsByObjective[objectiveID] = append(questionsByObjective[objectiveID], question)
	}

	report := contentReadinessReport{
		GeneratedAt: time.Now().UTC().Format(time.RFC3339),
		Items:       []contentReadinessItem{},
	}
	allFormats := map[string]bool{}
	for _, objective := range objectives {
		item := buildContentReadinessItem(objective, activitiesByObjective[objective.ID], questionsByObjective[objective.ID])
		report.Items = append(report.Items, item)
		report.Totals.Objectives++
		report.Totals.PublishedActivities += item.PublishedActivityCount
		report.Totals.PublishedQuestions += item.PublishedQuestionCount
		for _, format := range item.Formats {
			allFormats[format] = true
		}
		switch item.Status {
		case "ready":
			report.Totals.Ready++
		case "pilot":
			report.Totals.Pilot++
		case "draft":
			report.Totals.Draft++
		default:
			report.Totals.Blocked++
		}
	}
	report.Totals.Formats = len(allFormats)
	sort.Slice(report.Items, func(i, j int) bool {
		if report.Items[i].Year != report.Items[j].Year {
			return report.Items[i].Year < report.Items[j].Year
		}
		if report.Items[i].Subject != report.Items[j].Subject {
			return report.Items[i].Subject < report.Items[j].Subject
		}
		if report.Items[i].Strand != report.Items[j].Strand {
			return report.Items[i].Strand < report.Items[j].Strand
		}
		return report.Items[i].ObjectiveID < report.Items[j].ObjectiveID
	})
	return report
}

func buildContentReadinessItem(objective learning.Objective, activities []learning.ActivityConfig, questions []learning.QuestionConfig) contentReadinessItem {
	item := contentReadinessItem{
		ObjectiveID:   objective.ID,
		Year:          objective.Year,
		Subject:       objective.Subject,
		Strand:        objective.Strand,
		Topic:         objective.Topic,
		Statement:     objective.Statement,
		ActivityCount: len(activities),
		QuestionCount: len(questions),
		Formats:       []string{},
		Missing:       []string{},
		Warnings:      []string{},
	}
	score := 0

	if strings.TrimSpace(objective.Statement) != "" {
		score += 10
	} else {
		item.Missing = append(item.Missing, "curriculum objective statement")
	}
	if strings.TrimSpace(objective.ParentExplanation) != "" && strings.TrimSpace(objective.TeacherEvidence) != "" {
		score += 10
	} else {
		item.Missing = append(item.Missing, "parent explanation and teacher evidence")
	}
	if len(objective.Prerequisites) > 0 && len(objective.Misconceptions) > 0 {
		score += 10
	} else {
		item.Missing = append(item.Missing, "prerequisite and misconception map")
	}
	if objective.Mastery.Expected > 0 && objective.Mastery.Secure >= objective.Mastery.Expected && len(objective.Mastery.RetentionDays) > 0 && len(objective.Mastery.RequiredFormats) > 0 {
		score += 10
	} else {
		item.Missing = append(item.Missing, "mastery thresholds, review cadence and required formats")
	}

	publishedActivities := []learning.ActivityConfig{}
	for _, activity := range activities {
		if isRuntimeStatus(activity.Status) {
			publishedActivities = append(publishedActivities, activity)
		}
	}
	item.PublishedActivityCount = len(publishedActivities)
	if len(publishedActivities) > 0 {
		score += 15
	} else {
		item.Missing = append(item.Missing, "published teaching activity")
	}

	if hasTeachingDesign(publishedActivities) {
		score += 15
	} else if len(publishedActivities) > 0 {
		item.Missing = append(item.Missing, "activity teaching design, feedback and animation hooks")
	}

	formats := map[string]bool{}
	publishedQuestions := []learning.QuestionConfig{}
	for _, question := range questions {
		if strings.TrimSpace(question.Format) != "" {
			formats[question.Format] = true
		}
		if isRuntimeStatus(question.Status) {
			publishedQuestions = append(publishedQuestions, question)
			if strings.TrimSpace(question.Format) != "" {
				formats[question.Format] = true
			}
		}
	}
	item.PublishedQuestionCount = len(publishedQuestions)
	item.Formats = sortedKeys(formats)
	item.FormatCount = len(item.Formats)
	if len(publishedQuestions) > 0 {
		score += 15
	} else {
		item.Missing = append(item.Missing, "published assessment questions")
	}

	if questionsHavePedagogy(publishedQuestions) {
		score += 10
	} else if len(publishedQuestions) > 0 {
		item.Missing = append(item.Missing, "question hints, explanations and expected answers")
	}

	missingFormats := missingRequiredFormats(objective.Mastery.RequiredFormats, formats)
	if len(missingFormats) == 0 && len(objective.Mastery.RequiredFormats) > 0 {
		score += 5
	} else if len(missingFormats) > 0 {
		item.Missing = append(item.Missing, "required formats: "+strings.Join(missingFormats, ", "))
	}

	if len(publishedQuestions) > 0 && len(publishedQuestions) < 3 {
		item.Warnings = append(item.Warnings, "fewer than 3 published question variants")
	}
	if len(item.Formats) == 1 {
		item.Warnings = append(item.Warnings, "only 1 interaction/question format covered")
	}
	if len(publishedActivities) > 0 && !hasAnimationHooks(publishedActivities) {
		item.Warnings = append(item.Warnings, "published activity has no animation hooks")
	}
	if len(questions) > 0 && len(publishedQuestions) == 0 {
		item.Warnings = append(item.Warnings, "questions exist but none are runtime-approved")
	}

	if score > 100 {
		score = 100
	}
	item.Score = score
	item.Status = readinessStatus(item.Score, len(item.Missing), item.PublishedActivityCount, item.PublishedQuestionCount)
	return item
}

func hasTeachingDesign(activities []learning.ActivityConfig) bool {
	for _, activity := range activities {
		if strings.TrimSpace(activity.Prompt) == "" || strings.TrimSpace(activity.TemplateID) == "" {
			continue
		}
		if strings.TrimSpace(mapString(activity.Interaction, "type", "")) == "" && len(activity.Interaction) == 0 {
			continue
		}
		if len(activity.Feedback) == 0 {
			continue
		}
		if len(activity.AnimationHooks) == 0 {
			continue
		}
		return true
	}
	return false
}

func hasAnimationHooks(activities []learning.ActivityConfig) bool {
	for _, activity := range activities {
		if len(activity.AnimationHooks) > 0 {
			return true
		}
	}
	return false
}

func questionsHavePedagogy(questions []learning.QuestionConfig) bool {
	if len(questions) == 0 {
		return false
	}
	for _, question := range questions {
		if len(question.ExpectedAnswer) == 0 || strings.TrimSpace(question.Explanation) == "" || len(question.Hints) == 0 {
			return false
		}
	}
	return true
}

func missingRequiredFormats(required []string, covered map[string]bool) []string {
	missing := []string{}
	for _, format := range required {
		key := strings.TrimSpace(format)
		if key == "" {
			continue
		}
		if !covered[key] {
			missing = append(missing, key)
		}
	}
	sort.Strings(missing)
	return missing
}

func sortedKeys(values map[string]bool) []string {
	keys := []string{}
	for value := range values {
		if strings.TrimSpace(value) != "" {
			keys = append(keys, value)
		}
	}
	sort.Strings(keys)
	return keys
}

func readinessStatus(score int, missingCount int, publishedActivities int, publishedQuestions int) string {
	if publishedActivities == 0 || publishedQuestions == 0 {
		return "blocked"
	}
	if score >= 85 && missingCount == 0 {
		return "ready"
	}
	if score >= 65 {
		return "pilot"
	}
	if score >= 35 {
		return "draft"
	}
	return "blocked"
}

func (s *Server) preferredYear(ctx context.Context, studentID string) int {
	year, ok, err := s.repo.StudentYear(ctx, studentID)
	if err != nil {
		slog.Warn("failed to read student year", "student_id", studentID, "error", err)
		return 0
	}
	if !ok {
		return 0
	}
	return year
}

func containsString(values []string, target string) bool {
	for _, value := range values {
		if strings.EqualFold(strings.TrimSpace(value), target) {
			return true
		}
	}
	return false
}

func sameStringSequence(got []string, want []string) bool {
	if len(got) != len(want) {
		return false
	}
	for i := range want {
		if !strings.EqualFold(strings.TrimSpace(got[i]), strings.TrimSpace(want[i])) {
			return false
		}
	}
	return true
}

func chooseActivity(activities []learning.ActivityConfig, requestedID, requestedWorld string, worlds []learning.WorldConfig, preferredYear int) (learning.ActivityConfig, bool) {
	for _, activity := range activities {
		if requestedID != "" && activity.ID == requestedID && isRuntimeStatus(activity.Status) {
			return activity, true
		}
	}
	for _, activity := range activities {
		if requestedID == "" && requestedWorld != "" && activity.WorldKey == requestedWorld && isRuntimeStatus(activity.Status) {
			return activity, true
		}
	}
	for _, activity := range activities {
		if requestedID == "" && preferredYear > 0 && isRuntimeStatus(activity.Status) && worldYear(worlds, activity.WorldKey) == preferredYear {
			return activity, true
		}
	}
	for _, activity := range activities {
		if requestedID == "" && isRuntimeStatus(activity.Status) {
			return activity, true
		}
	}
	return learning.ActivityConfig{}, false
}

func isRuntimeStatus(status string) bool {
	switch strings.ToLower(status) {
	case "live", "published", "approved":
		return true
	default:
		return false
	}
}

func worldForActivity(worlds []learning.WorldConfig, activity learning.ActivityConfig) learning.WorldConfig {
	for _, world := range worlds {
		if world.Key == activity.WorldKey {
			return world
		}
	}
	for _, world := range worlds {
		if world.Enabled {
			return world
		}
	}
	return learning.WorldConfig{
		Key:       activity.WorldKey,
		Name:      "Nexusverse",
		Theme:     "Configured learning world",
		Config:    map[string]any{},
		Enabled:   true,
		UpdatedAt: time.Now().UTC().Format(time.RFC3339),
	}
}

func worldYear(worlds []learning.WorldConfig, worldKey string) int {
	for _, world := range worlds {
		if world.Key == worldKey {
			return world.YearGroup
		}
	}
	return 0
}

func recommendedActions(activity learning.ActivityConfig, objective learning.Objective) []string {
	actions := []string{}
	if formats := objective.Mastery.RequiredFormats; len(formats) > 0 {
		actions = append(actions, "Use "+strings.Join(formats, ", ")+" across the mastery path.")
	}
	if activity.Prompt != "" {
		actions = append(actions, activity.Prompt)
	}
	if len(actions) == 0 {
		actions = append(actions, "Start with a short retrieval warm-up.", "Use scaffolding before speed.")
	}
	return actions
}

func (s *Server) classBelongsToSchool(ctx context.Context, schoolURN string, classID string) bool {
	config, err := s.repo.SchoolPortal(ctx, schoolURN)
	if err != nil {
		slog.Warn("failed to check school class scope", "school_urn", schoolURN, "class_id", classID, "error", err)
		return false
	}
	for _, classConfig := range config.Classes {
		if classConfig.ID == classID {
			return true
		}
	}
	return false
}

func (s *Server) groupBelongsToSchool(ctx context.Context, schoolURN string, groupID string) bool {
	config, err := s.repo.SchoolPortal(ctx, schoolURN)
	if err != nil {
		slog.Warn("failed to check school group scope", "school_urn", schoolURN, "group_id", groupID, "error", err)
		return false
	}
	for _, group := range config.Groups {
		if group.ID == groupID {
			return true
		}
	}
	return false
}

func (s *Server) parentOwnsChild(ctx context.Context, parentLoginID string, studentExternalRef string) bool {
	portal, err := s.repo.ParentPortal(ctx, parentLoginID)
	if err != nil {
		slog.Warn("failed to check parent child scope", "parent_login", parentLoginID, "student", studentExternalRef, "error", err)
		return false
	}
	for _, child := range portal.Children {
		if child.Student.ExternalRef == studentExternalRef {
			return true
		}
	}
	return false
}

func (s *Server) accessRequestByID(ctx context.Context, id string) (learning.AccessRequestConfig, bool, error) {
	id = strings.TrimSpace(id)
	if id == "" {
		return learning.AccessRequestConfig{}, false, nil
	}
	requests, err := s.repo.ListAccessRequests(ctx, "")
	if err != nil {
		return learning.AccessRequestConfig{}, false, err
	}
	for _, request := range requests {
		if request.ID == id {
			return request, true, nil
		}
	}
	return learning.AccessRequestConfig{}, false, nil
}

func (s *Server) studentSchoolURN(ctx context.Context, studentID string) (string, bool) {
	studentID = strings.TrimSpace(studentID)
	if studentID == "" {
		return "", false
	}
	classes, err := s.repo.ListClasses(ctx)
	if err != nil {
		slog.Warn("failed to resolve student school scope", "student_id", studentID, "error", err)
		return "", false
	}
	for _, classConfig := range classes {
		for _, student := range classConfig.Students {
			if strings.EqualFold(student.ExternalRef, studentID) {
				return classConfig.SchoolURN, classConfig.SchoolURN != ""
			}
		}
	}
	return "", false
}

func (s *Server) createPupilSession(studentExternalRef string) pupilSession {
	secret := strings.TrimSpace(os.Getenv("PUPIL_SESSION_SECRET"))
	session := pupilSession{Configured: false, TokenType: "pupil"}
	if secret == "" {
		return session
	}
	expiresAt := time.Now().UTC().Add(8 * time.Hour)
	payload := pupilSessionPayload{
		StudentExternalRef: studentExternalRef,
		Purpose:            "pupil_session",
		ExpiresAt:          expiresAt.Format(time.RFC3339),
	}
	payloadJSON, err := json.Marshal(payload)
	if err != nil {
		slog.Warn("failed to build pupil session payload", "student", studentExternalRef, "error", err)
		return session
	}
	encodedPayload := base64.RawURLEncoding.EncodeToString(payloadJSON)
	mac := hmac.New(sha256.New, []byte(secret))
	_, _ = mac.Write([]byte(encodedPayload))
	signature := base64.RawURLEncoding.EncodeToString(mac.Sum(nil))
	return pupilSession{
		Configured:       true,
		Token:            encodedPayload + "." + signature,
		TokenType:        "pupil",
		ExpiresAt:        expiresAt.Format(time.RFC3339),
		ExpiresInSeconds: int((8 * time.Hour).Seconds()),
	}
}

func (s *Server) requirePupilSession(w http.ResponseWriter, r *http.Request, studentExternalRef string) bool {
	if !envBool("REQUIRE_PUPIL_SESSION") {
		return true
	}
	secret := strings.TrimSpace(os.Getenv("PUPIL_SESSION_SECRET"))
	if secret == "" {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": "pupil session secret is not configured"})
		return false
	}
	token := strings.TrimSpace(r.Header.Get("X-Pupil-Session"))
	if token == "" {
		token = strings.TrimSpace(r.Header.Get("Authorization"))
		if strings.HasPrefix(strings.ToLower(token), "bearer ") {
			token = strings.TrimSpace(token[7:])
		}
	}
	payload, ok := verifyPupilSessionToken(token, secret)
	if !ok {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "valid pupil session required"})
		return false
	}
	if !strings.EqualFold(payload.StudentExternalRef, studentExternalRef) {
		writeJSON(w, http.StatusForbidden, map[string]string{"error": "pupil session does not match learner"})
		return false
	}
	return true
}

func verifyPupilSessionToken(token string, secret string) (pupilSessionPayload, bool) {
	parts := strings.Split(strings.TrimSpace(token), ".")
	if len(parts) != 2 || parts[0] == "" || parts[1] == "" || secret == "" {
		return pupilSessionPayload{}, false
	}
	mac := hmac.New(sha256.New, []byte(secret))
	_, _ = mac.Write([]byte(parts[0]))
	expected := mac.Sum(nil)
	got, err := base64.RawURLEncoding.DecodeString(parts[1])
	if err != nil || subtle.ConstantTimeCompare(got, expected) != 1 {
		return pupilSessionPayload{}, false
	}
	payloadBytes, err := base64.RawURLEncoding.DecodeString(parts[0])
	if err != nil {
		return pupilSessionPayload{}, false
	}
	var payload pupilSessionPayload
	if err := json.Unmarshal(payloadBytes, &payload); err != nil {
		return pupilSessionPayload{}, false
	}
	expiresAt, err := time.Parse(time.RFC3339, payload.ExpiresAt)
	if err != nil || time.Now().UTC().After(expiresAt) {
		return pupilSessionPayload{}, false
	}
	if payload.Purpose != "pupil_session" || strings.TrimSpace(payload.StudentExternalRef) == "" {
		return pupilSessionPayload{}, false
	}
	return payload, true
}

func homeLoginCode(externalRef string) string {
	base := strings.ToUpper(strings.ReplaceAll(externalRef, "-", ""))
	if len(base) > 5 {
		base = base[:5]
	}
	if base == "" {
		base = "HOME"
	}
	return base + "-" + time.Now().UTC().Format("150405")
}

func safeSlug(value string) string {
	value = strings.ToLower(strings.TrimSpace(value))
	if value == "" {
		return ""
	}
	var builder strings.Builder
	lastDash := false
	for _, char := range value {
		valid := (char >= 'a' && char <= 'z') || (char >= '0' && char <= '9')
		if valid {
			builder.WriteRune(char)
			lastDash = false
			continue
		}
		if !lastDash && builder.Len() > 0 {
			builder.WriteByte('-')
			lastDash = true
		}
	}
	return strings.Trim(builder.String(), "-")
}

func yearText(year int) string {
	if year < 1 || year > 7 {
		return "1"
	}
	return strconv.Itoa(year)
}

func mapString(values map[string]any, key string, fallback string) string {
	if values == nil {
		return fallback
	}
	value, ok := values[key]
	if !ok {
		return fallback
	}
	text, ok := value.(string)
	if !ok || text == "" {
		return fallback
	}
	return text
}

func mapBool(values map[string]any, key string, fallback bool) bool {
	if values == nil {
		return fallback
	}
	value, ok := values[key]
	if !ok {
		return fallback
	}
	out, ok := value.(bool)
	if !ok {
		return fallback
	}
	return out
}

func envBool(key string) bool {
	switch strings.ToLower(strings.TrimSpace(os.Getenv(key))) {
	case "1", "true", "yes", "on":
		return true
	default:
		return false
	}
}

func envBoolDefault(key string, fallback bool) bool {
	value := strings.TrimSpace(os.Getenv(key))
	if value == "" {
		return fallback
	}
	switch strings.ToLower(value) {
	case "1", "true", "yes", "on":
		return true
	case "0", "false", "no", "off":
		return false
	default:
		return fallback
	}
}

func envString(key string, fallback string) string {
	if value := strings.TrimSpace(os.Getenv(key)); value != "" {
		return value
	}
	return fallback
}

func configStringList(values map[string]any, key string) []string {
	if values == nil {
		return nil
	}
	raw, ok := values[key]
	if !ok || raw == nil {
		return nil
	}
	switch items := raw.(type) {
	case []string:
		return normalizeStringList(items)
	case []any:
		out := []string{}
		for _, item := range items {
			text, ok := item.(string)
			if ok {
				out = append(out, text)
			}
		}
		return normalizeStringList(out)
	default:
		return nil
	}
}

func normalizeStringList(values []string) []string {
	out := []string{}
	for _, value := range values {
		text := strings.ToLower(strings.TrimSpace(value))
		if text != "" {
			out = append(out, text)
		}
	}
	return out
}

func displayNameFromStudentID(studentID string) string {
	if studentID == "" {
		return "Learner"
	}
	name := strings.TrimSuffix(studentID, "-demo")
	name = strings.ReplaceAll(name, "-", " ")
	if name == "" {
		return "Learner"
	}
	return strings.ToUpper(name[:1]) + name[1:]
}

func intString(value int) string {
	return string(rune('0' + value))
}

func buildCurriculumMap(objectives []learning.Objective) learning.CurriculumMap {
	years := map[int]*yearBucket{}
	subjects := map[string]*subjectBucket{}
	for _, objective := range objectives {
		yb := years[objective.Year]
		if yb == nil {
			yb = &yearBucket{subjects: map[string]*subjectBucket{}}
			years[objective.Year] = yb
		}
		yb.count++
		ys := yb.subjects[objective.Subject]
		if ys == nil {
			ys = &subjectBucket{strands: map[string]*strandBucket{}}
			yb.subjects[objective.Subject] = ys
		}
		ys.count++
		yStrand := ys.strands[objective.Strand]
		if yStrand == nil {
			yStrand = &strandBucket{topics: map[string]bool{}}
			ys.strands[objective.Strand] = yStrand
		}
		yStrand.count++
		yStrand.topics[objective.Topic] = true

		subject := subjects[objective.Subject]
		if subject == nil {
			subject = &subjectBucket{strands: map[string]*strandBucket{}}
			subjects[objective.Subject] = subject
		}
		subject.count++
		strand := subject.strands[objective.Strand]
		if strand == nil {
			strand = &strandBucket{topics: map[string]bool{}}
			subject.strands[objective.Strand] = strand
		}
		strand.count++
		strand.topics[objective.Topic] = true
	}

	out := learning.CurriculumMap{GeneratedAt: time.Now().UTC().Format(time.RFC3339), Total: len(objectives)}
	for year := 1; year <= 7; year++ {
		bucket := years[year]
		item := learning.CurriculumYear{Year: year}
		if bucket != nil {
			item.Total = bucket.count
			item.Subjects = curriculumSubjects(bucket.subjects)
		}
		out.Years = append(out.Years, item)
	}
	out.Subjects = curriculumSubjects(subjects)
	return out
}

func curriculumSubjects(buckets map[string]*subjectBucket) []learning.CurriculumSubject {
	names := make([]string, 0, len(buckets))
	for name := range buckets {
		names = append(names, name)
	}
	sort.Strings(names)
	subjects := make([]learning.CurriculumSubject, 0, len(names))
	for _, name := range names {
		bucket := buckets[name]
		subjects = append(subjects, learning.CurriculumSubject{
			Name:    name,
			Strands: curriculumStrands(bucket.strands),
			Total:   bucket.count,
		})
	}
	return subjects
}

func curriculumStrands(buckets map[string]*strandBucket) []learning.CurriculumStrand {
	names := make([]string, 0, len(buckets))
	for name := range buckets {
		names = append(names, name)
	}
	sort.Strings(names)
	strands := make([]learning.CurriculumStrand, 0, len(names))
	for _, name := range names {
		bucket := buckets[name]
		topics := make([]string, 0, len(bucket.topics))
		for topic := range bucket.topics {
			topics = append(topics, topic)
		}
		sort.Strings(topics)
		strands = append(strands, learning.CurriculumStrand{
			Name:       name,
			Topics:     topics,
			Objectives: bucket.count,
		})
	}
	return strands
}
