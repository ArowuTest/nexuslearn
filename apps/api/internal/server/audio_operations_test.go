package server

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"

	"github.com/ArowuTest/nexuslearn/apps/api/internal/learning"
)

type fakeAudioOperationsRepository struct {
	*fakeRepository
	imports          []learning.AudioManifestImport
	importActors     []string
	importKeys       []string
	rerecordRequests []learning.AudioRerecordRequest
	rerecordActors   []string
	rerecordKeys     []string
	importErr        error
	rerecordErr      error
}

func (r *fakeAudioOperationsRepository) ImportAudioManifest(_ context.Context, manifest learning.AudioManifestImport, actor, key string) (learning.AudioManifestImportOutcome, error) {
	r.imports = append(r.imports, manifest)
	r.importActors = append(r.importActors, actor)
	r.importKeys = append(r.importKeys, key)
	if r.importErr != nil {
		return learning.AudioManifestImportOutcome{}, r.importErr
	}
	return learning.AudioManifestImportOutcome{
		ReleaseID: manifest.ReleaseID, AcceptedAssets: len(manifest.Assets),
		AcceptedReferences: len(manifest.References), Status: "imported", Replayed: false,
	}, nil
}

func (r *fakeAudioOperationsRepository) RequestAudioRerecord(_ context.Context, request learning.AudioRerecordRequest, actor, key string) (learning.AudioRerecordRequest, error) {
	r.rerecordRequests = append(r.rerecordRequests, request)
	r.rerecordActors = append(r.rerecordActors, actor)
	r.rerecordKeys = append(r.rerecordKeys, key)
	if r.rerecordErr != nil {
		return learning.AudioRerecordRequest{}, r.rerecordErr
	}
	request.ID = "rerecord-1"
	request.Status = "open"
	return request, nil
}

func TestAudioManifestImportAcceptsExactSignedV2Batch(t *testing.T) {
	t.Setenv("ADMIN_API_KEY", "test-admin")
	manifestPath := writeNarrationManifestV2Fixture(t, nil)
	body, err := os.ReadFile(manifestPath)
	if err != nil {
		t.Fatal(err)
	}
	repo := &fakeAudioOperationsRepository{fakeRepository: &fakeRepository{}}
	srv := New(repo, "postgres")

	request := httptest.NewRequest(http.MethodPost, "/v1/admin/audio/manifests/import", bytes.NewReader(body))
	request.Header.Set("X-Admin-Key", "test-admin")
	request.Header.Set("Idempotency-Key", "import-release-v2")
	response := httptest.NewRecorder()
	srv.ServeHTTP(response, request)

	if response.Code != http.StatusCreated {
		t.Fatalf("expected signed manifest import, got %d: %s", response.Code, response.Body.String())
	}
	if len(repo.imports) != 1 || repo.importKeys[0] != "import-release-v2" || len(repo.imports[0].Assets) != 1 || len(repo.imports[0].References) != 1 {
		t.Fatalf("expected one bounded import call, imports=%#v keys=%#v", repo.imports, repo.importKeys)
	}
	asset := repo.imports[0].Assets[0]
	if asset.ProductionProfileSHA256 == "" || asset.ProductionIdentitySHA256 == "" || asset.AudioSHA256 == "" {
		t.Fatalf("expected exact immutable production binding, got %#v", asset)
	}
	if repo.importActors[0] == "" {
		t.Fatal("import audit actor must never be empty")
	}
}

func TestAudioManifestImportRejectsMalformedBatchBeforePersistence(t *testing.T) {
	t.Setenv("ADMIN_API_KEY", "test-admin")
	repo := &fakeAudioOperationsRepository{fakeRepository: &fakeRepository{}}
	srv := New(repo, "postgres")

	request := httptest.NewRequest(http.MethodPost, "/v1/admin/audio/manifests/import", bytes.NewBufferString(`{"schema":"nexuslearn.narration-manifest.v2","version":2}`))
	request.Header.Set("X-Admin-Key", "test-admin")
	response := httptest.NewRecorder()
	srv.ServeHTTP(response, request)

	if response.Code != http.StatusBadRequest || len(repo.imports) != 0 {
		t.Fatalf("malformed manifest must roll back before persistence, status=%d imports=%d", response.Code, len(repo.imports))
	}
}

func TestAudioRerecordRequestIsImmutableAndIdempotent(t *testing.T) {
	t.Setenv("ADMIN_API_KEY", "test-admin")
	repo := &fakeAudioOperationsRepository{fakeRepository: &fakeRepository{}}
	srv := New(repo, "postgres")
	body, _ := json.Marshal(map[string]any{
		"release_id": "narration-release-v2-aaaaaaaaaaaaaaaaaaaaaaaa",
		"reason":     "pronunciation", "notes": "Final consonant is unclear.",
	})

	request := httptest.NewRequest(http.MethodPost, "/v1/admin/audio/assets/narration-v1-bbbbbbbbbbbbbbbbbbbbbbbb/rerecord-request", bytes.NewReader(body))
	request.Header.Set("X-Admin-Key", "test-admin")
	request.Header.Set("Idempotency-Key", "rerecord-final-consonant")
	response := httptest.NewRecorder()
	srv.ServeHTTP(response, request)

	if response.Code != http.StatusCreated || len(repo.rerecordRequests) != 1 || repo.rerecordKeys[0] != "rerecord-final-consonant" {
		t.Fatalf("expected immutable rerecord request, status=%d body=%s requests=%#v", response.Code, response.Body.String(), repo.rerecordRequests)
	}
	if repo.rerecordRequests[0].AssetID != "narration-v1-bbbbbbbbbbbbbbbbbbbbbbbb" || repo.rerecordActors[0] == "" {
		t.Fatalf("route asset and audit actor must bind the request, got %#v actors=%#v", repo.rerecordRequests[0], repo.rerecordActors)
	}
}

func TestAudioOperationsMapIdempotencyAndIdentityConflicts(t *testing.T) {
	t.Setenv("ADMIN_API_KEY", "test-admin")
	manifestPath := writeNarrationManifestV2Fixture(t, nil)
	body, _ := os.ReadFile(manifestPath)
	repo := &fakeAudioOperationsRepository{fakeRepository: &fakeRepository{}, importErr: learning.ErrAudioManifestConflict}
	srv := New(repo, "postgres")

	for _, operationErr := range []error{learning.ErrAudioManifestConflict, learning.ErrIdempotencyConflict} {
		repo.importErr = operationErr
		request := httptest.NewRequest(http.MethodPost, "/v1/admin/audio/manifests/import", bytes.NewReader(body))
		request.Header.Set("X-Admin-Key", "test-admin")
		request.Header.Set("Idempotency-Key", "conflicting-import")
		response := httptest.NewRecorder()
		srv.ServeHTTP(response, request)
		if response.Code != http.StatusConflict {
			t.Fatalf("expected conflict for %v, got %d: %s", operationErr, response.Code, response.Body.String())
		}
	}
	if !errors.Is(repo.importErr, learning.ErrIdempotencyConflict) {
		t.Fatal("test did not exercise the idempotency conflict")
	}
}

func TestAudioOperationsEnforceImporterAndReviewerRoles(t *testing.T) {
	srv, repo, token := newAudioOperationsTestServer(t, adminRoleReviewer)
	manifestPath := writeNarrationManifestV2Fixture(t, nil)
	manifestBody, _ := os.ReadFile(manifestPath)

	importRequest := httptest.NewRequest(http.MethodPost, "/v1/admin/audio/manifests/import", bytes.NewReader(manifestBody))
	importRequest.Header.Set("Authorization", "Bearer "+token)
	importResponse := httptest.NewRecorder()
	srv.ServeHTTP(importResponse, importRequest)
	if importResponse.Code != http.StatusForbidden || len(repo.imports) != 0 {
		t.Fatalf("content reviewer must not import releases, status=%d imports=%d", importResponse.Code, len(repo.imports))
	}

	rerecordBody := strings.NewReader(`{
		"release_id":"narration-release-v2-aaaaaaaaaaaaaaaaaaaaaaaa",
		"reason":"clarity","notes":"The instruction is difficult to hear."
	}`)
	rerecordRequest := httptest.NewRequest(http.MethodPost, "/v1/admin/audio/assets/narration-v1-bbbbbbbbbbbbbbbbbbbbbbbb/rerecord-request", rerecordBody)
	rerecordRequest.Header.Set("Authorization", "Bearer "+token)
	rerecordRequest.Header.Set("Idempotency-Key", "reviewer-rerecord")
	rerecordResponse := httptest.NewRecorder()
	srv.ServeHTTP(rerecordResponse, rerecordRequest)
	if rerecordResponse.Code != http.StatusCreated || len(repo.rerecordRequests) != 1 {
		t.Fatalf("content reviewer should request a rerecord, status=%d body=%s", rerecordResponse.Code, rerecordResponse.Body.String())
	}
}

func newAudioOperationsTestServer(t *testing.T, role string) (*Server, *fakeAudioOperationsRepository, string) {
	t.Helper()
	t.Setenv("ACCOUNT_SESSION_SECRET", "audio-operations-test-session-secret")
	t.Setenv("ALLOW_LEGACY_CREDENTIAL_HEADERS", "false")
	base := &fakeRepository{
		platformUser: learning.PlatformUserConfig{
			ID: "audio-user-1", LoginID: "audio@example.com", DisplayName: "Audio User",
			Roles: []string{role}, Status: "active",
		},
		accountSession: learning.AccountSession{
			UserID: "audio-user-1", LoginID: "audio@example.com", Role: role,
		},
	}
	repo := &fakeAudioOperationsRepository{fakeRepository: base}
	srv := New(repo, "postgres")
	loginRequest := httptest.NewRequest(http.MethodPost, "/v1/auth/admin-login", strings.NewReader(`{
		"login_id":"audio@example.com","password":"a-secure-password"
	}`))
	loginResponse := httptest.NewRecorder()
	srv.ServeHTTP(loginResponse, loginRequest)
	if loginResponse.Code != http.StatusOK {
		t.Fatalf("create audio operator session: status=%d body=%s", loginResponse.Code, loginResponse.Body.String())
	}
	var login struct {
		Session accountSessionResult `json:"session"`
	}
	if err := json.NewDecoder(loginResponse.Body).Decode(&login); err != nil {
		t.Fatal(err)
	}
	return srv, repo, login.Session.Token
}
