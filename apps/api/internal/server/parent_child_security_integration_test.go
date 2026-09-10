package server

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/ArowuTest/nexuslearn/apps/api/internal/database"
	"github.com/ArowuTest/nexuslearn/apps/api/internal/learning"
	"github.com/ArowuTest/nexuslearn/apps/api/internal/testdb"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

func parentChildSecurityServer(t *testing.T) (*Server, learning.Repository, *pgxpool.Pool) {
	t.Helper()
	dsn := strings.TrimSpace(os.Getenv("TEST_DATABASE_URL"))
	if dsn == "" {
		t.Skip("set TEST_DATABASE_URL for isolated parent-child PostgreSQL tests")
	}
	ctx := context.Background()
	admin, err := pgxpool.New(ctx, dsn)
	if err != nil {
		t.Fatal(err)
	}
	if err := testdb.PrepareExtensions(ctx, admin); err != nil {
		admin.Close()
		t.Fatal(err)
	}
	schema := fmt.Sprintf("parent_child_security_%d", time.Now().UnixNano())
	ident := pgx.Identifier{schema}.Sanitize()
	if _, err := admin.Exec(ctx, "CREATE SCHEMA "+ident); err != nil {
		admin.Close()
		t.Fatal(err)
	}
	config, err := pgxpool.ParseConfig(dsn)
	if err != nil {
		t.Fatal(err)
	}
	config.ConnConfig.RuntimeParams["search_path"] = schema
	config.AfterConnect = func(ctx context.Context, conn *pgx.Conn) error {
		_, err := conn.Exec(ctx, "SET search_path TO "+ident)
		return err
	}
	pool, err := pgxpool.NewWithConfig(ctx, config)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		pool.Close()
		ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
		defer cancel()
		if _, err := admin.Exec(ctx, "DROP SCHEMA "+ident+" CASCADE"); err != nil {
			t.Error(err)
		}
		admin.Close()
	})
	if err := database.RunMigrations(ctx, pool, filepath.Join("..", "..", "migrations")); err != nil {
		t.Fatal(err)
	}
	t.Setenv("ACCOUNT_SESSION_SECRET", "parent-child-security-test-secret")
	t.Setenv("ALLOW_LEGACY_CREDENTIAL_HEADERS", "false")
	repo := learning.NewRepository(pool)
	return New(repo, "postgres"), repo, pool
}

func parentChildSecuritySession(t *testing.T, srv *Server, repo learning.Repository, name string) (learning.ParentAccountConfig, string) {
	t.Helper()
	parent, err := repo.UpsertParentAccount(context.Background(), learning.ParentAccountConfig{
		Email: name + "@example.test", LoginID: name + "@example.test", DisplayName: name, Password: "test-only-password", Status: "active",
	})
	if err != nil {
		t.Fatal(err)
	}
	session, err := srv.createAccountSession(context.Background(), parent.ID, parent.LoginID, "parent", "", time.Hour)
	if err != nil {
		t.Fatal(err)
	}
	return parent, session.Token
}

func putParentChild(srv *Server, token, ref, body string) *httptest.ResponseRecorder {
	req := httptest.NewRequest(http.MethodPut, "/v1/parent/children/"+ref, strings.NewReader(body))
	req.Header.Set("Authorization", "Bearer "+token)
	res := httptest.NewRecorder()
	srv.ServeHTTP(res, req)
	return res
}

func TestParentChildSecurityRejectsTakeoverPostgres(t *testing.T) {
	srv, repo, pool := parentChildSecurityServer(t)
	owner, _ := parentChildSecuritySession(t, srv, repo, "owner")
	attacker, token := parentChildSecuritySession(t, srv, repo, "attacker")
	ctx := context.Background()
	_, err := repo.UpsertStudent(ctx, learning.StudentProfileConfig{ExternalRef: "protected-child", DisplayName: "Original", YearGroup: 3})
	if err != nil {
		t.Fatal(err)
	}
	_, err = repo.UpsertParentLink(ctx, learning.ParentLinkConfig{ParentEmail: owner.Email, StudentExternalRef: "protected-child", Relationship: "parent", Status: "active"})
	if err != nil {
		t.Fatal(err)
	}
	_, err = repo.UpsertStudentCredential(ctx, learning.StudentCredentialConfig{StudentExternalRef: "protected-child", LoginCode: "SCHOOL-SECRET", PicturePassword: []string{"tree", "moon", "key"}, QRSecretHash: "existing-qr"})
	if err != nil {
		t.Fatal(err)
	}
	res := putParentChild(srv, token, "protected-child", `{"display_name":"Taken over","year_group":7}`)
	if res.Code != http.StatusForbidden {
		t.Errorf("takeover must be forbidden, got %d: %s", res.Code, res.Body.String())
	}
	if strings.Contains(res.Body.String(), "login_code") {
		t.Error("denied response leaked a credential")
	}
	var name, code string
	var links int
	if err := pool.QueryRow(ctx, `SELECT s.display_name,c.login_code FROM students s JOIN student_credentials c ON c.student_id=s.id WHERE s.external_ref='protected-child'`).Scan(&name, &code); err != nil {
		t.Fatal(err)
	}
	if name != "Original" || code != "SCHOOL-SECRET" {
		t.Errorf("unrelated child mutated: name=%q code=%q", name, code)
	}
	if err := pool.QueryRow(ctx, `SELECT count(*) FROM parent_student_links WHERE parent_user_id=$1`, attacker.ID).Scan(&links); err != nil {
		t.Fatal(err)
	}
	if links != 0 {
		t.Errorf("attacker gained %d links", links)
	}
}

func TestParentChildSecurityInvalidSupportLeavesNoWritesPostgres(t *testing.T) {
	srv, repo, pool := parentChildSecurityServer(t)
	_, token := parentChildSecuritySession(t, srv, repo, "invalid-support-parent")
	res := putParentChild(srv, token, "invalid-support-child", `{"display_name":"New child","year_group":2,"engagement":{"sensory_load":"invalid"}}`)
	if res.Code != http.StatusBadRequest {
		t.Errorf("invalid support must fail, got %d: %s", res.Code, res.Body.String())
	}
	var count int
	if err := pool.QueryRow(context.Background(), `SELECT count(*) FROM students WHERE external_ref='invalid-support-child'`).Scan(&count); err != nil {
		t.Fatal(err)
	}
	if count != 0 {
		t.Errorf("invalid support left %d partially created children", count)
	}
}

func TestParentChildSecurityRetryPreservesCredentialsPostgres(t *testing.T) {
	srv, repo, pool := parentChildSecurityServer(t)
	_, token := parentChildSecuritySession(t, srv, repo, "retry-parent")
	body := `{"display_name":"Child","year_group":2}`
	res := putParentChild(srv, token, "retry-child", body)
	if res.Code != http.StatusOK {
		t.Fatalf("create: %d %s", res.Code, res.Body.String())
	}
	var first learning.ParentChildConfig
	if err := json.Unmarshal(res.Body.Bytes(), &first); err != nil {
		t.Fatal(err)
	}
	if first.Credential.LoginCode == homeLoginCode("retry-child") || strings.Join(first.Credential.PicturePassword, ",") == "star,book,sun" {
		t.Error("new credentials use the predictable legacy defaults")
	}
	_, err := pool.Exec(context.Background(), `UPDATE student_credentials SET login_code='UNCHANGED-SCHOOL-CODE', picture_password='["key","tree","moon"]', qr_secret_hash='preserve-qr' WHERE student_id=$1`, first.Student.ID)
	if err != nil {
		t.Fatal(err)
	}
	res = putParentChild(srv, token, "retry-child", body)
	if res.Code != http.StatusOK {
		t.Fatalf("retry: %d %s", res.Code, res.Body.String())
	}
	var retry learning.ParentChildConfig
	if err := json.Unmarshal(res.Body.Bytes(), &retry); err != nil {
		t.Fatal(err)
	}
	if retry.Credential.LoginCode != "UNCHANGED-SCHOOL-CODE" || strings.Join(retry.Credential.PicturePassword, ",") != "key,tree,moon" || retry.Credential.QRSecretHash != "preserve-qr" {
		t.Errorf("retry reset existing credentials: %+v", retry.Credential)
	}
}

func TestParentChildSecuritySessionIdentityLoginAndRevocationPostgres(t *testing.T) {
	srv, repo, pool := parentChildSecurityServer(t)
	parent, _ := parentChildSecuritySession(t, srv, repo, "identity-parent")
	ctx := context.Background()
	if _, err := pool.Exec(ctx, `UPDATE app_users SET login_id='not-an-email',display_name='Keep parent identity' WHERE id=$1`, parent.ID); err != nil {
		t.Fatal(err)
	}
	session, err := srv.createAccountSession(ctx, parent.ID, "not-an-email", "parent", "", time.Hour)
	if err != nil {
		t.Fatal(err)
	}
	var usersBefore int
	if err := pool.QueryRow(ctx, `SELECT count(*) FROM app_users`).Scan(&usersBefore); err != nil {
		t.Fatal(err)
	}
	res := putParentChild(srv, session.Token, "identity-child", `{"display_name":"Child","year_group":2}`)
	if res.Code != http.StatusOK {
		t.Fatalf("non-email login failed: %d %s", res.Code, res.Body.String())
	}
	if res.Header().Get("Cache-Control") != "private, no-store" {
		t.Fatal("credential response is cacheable")
	}
	var child learning.ParentChildConfig
	if err := json.Unmarshal(res.Body.Bytes(), &child); err != nil {
		t.Fatal(err)
	}
	var owner, displayName string
	var usersAfter int
	if err := pool.QueryRow(ctx, `SELECT l.parent_user_id::text,u.display_name,(SELECT count(*) FROM app_users) FROM parent_student_links l JOIN app_users u ON u.id=l.parent_user_id WHERE student_id=$1`, child.Student.ID).Scan(&owner, &displayName, &usersAfter); err != nil {
		t.Fatal(err)
	}
	if owner != parent.ID || displayName != "Keep parent identity" || usersBefore != usersAfter {
		t.Fatal("parent login was used as a mutable email identity")
	}

	// The generated six-picture credential works through the real pupil handler.
	loginBody, err := json.Marshal(map[string]any{"student_external_ref": child.Student.ExternalRef, "login_code": child.Credential.LoginCode, "picture_password": child.Credential.PicturePassword})
	if err != nil {
		t.Fatal(err)
	}
	loginReq := httptest.NewRequest(http.MethodPost, "/v1/auth/pupil-login", strings.NewReader(string(loginBody)))
	loginRes := httptest.NewRecorder()
	srv.ServeHTTP(loginRes, loginReq)
	if loginRes.Code != http.StatusOK {
		t.Fatalf("generated credential cannot log in: %d %s", loginRes.Code, loginRes.Body.String())
	}
	if _, err := pool.Exec(ctx, `UPDATE parent_student_links SET status='revoked' WHERE parent_user_id=$1 AND student_id=$2`, parent.ID, child.Student.ID); err != nil {
		t.Fatal(err)
	}
	res = putParentChild(srv, session.Token, child.Student.ExternalRef, `{"display_name":"Denied","year_group":7}`)
	if res.Code != http.StatusForbidden || strings.Contains(res.Body.String(), "login_code") {
		t.Fatalf("revoked link update leaked data: %d %s", res.Code, res.Body.String())
	}
	var storedName, storedCode string
	if err := pool.QueryRow(ctx, `SELECT s.display_name,c.login_code FROM students s JOIN student_credentials c ON c.student_id=s.id WHERE s.id=$1`, child.Student.ID).Scan(&storedName, &storedCode); err != nil {
		t.Fatal(err)
	}
	if storedName != "Child" || storedCode != child.Credential.LoginCode {
		t.Fatal("revoked parent mutated child")
	}
	if err := repo.(accountSessionRepository).RevokeAccountSession(ctx, tokenHash(session.Token)); err != nil {
		t.Fatal(err)
	}
	res = putParentChild(srv, session.Token, "revoked-session-child", `{"display_name":"Denied","year_group":2}`)
	if res.Code != http.StatusUnauthorized {
		t.Fatalf("revoked session allowed: %d %s", res.Code, res.Body.String())
	}
}
