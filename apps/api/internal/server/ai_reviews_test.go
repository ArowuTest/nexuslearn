package server

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/ArowuTest/nexuslearn/apps/api/internal/learning"
)

type aiReviewTestRepository struct {
	*fakeRepository
	page    learning.AIReviewPage
	summary learning.AIReviewSummary
	saved   []learning.AIReviewEvidence
	queries []learning.AIReviewQuery
	keys    []string
	saveErr error
}

func (r *aiReviewTestRepository) ListAIReviewEvidence(_ context.Context, query learning.AIReviewQuery) (learning.AIReviewPage, error) {
	r.queries = append(r.queries, query)
	return r.page, nil
}

func (r *aiReviewTestRepository) SummariseAIReviews(context.Context) (learning.AIReviewSummary, error) {
	return r.summary, nil
}

func (r *aiReviewTestRepository) SaveAIReviewEvidence(_ context.Context, review learning.AIReviewEvidence, key string) (learning.AIReviewEvidence, error) {
	if r.saveErr != nil {
		return review, r.saveErr
	}
	r.saved = append(r.saved, review)
	r.keys = append(r.keys, key)
	review.ID = "review-saved"
	return review, nil
}

func newAIReviewTestServer(t *testing.T, role string) (*Server, *aiReviewTestRepository, string) {
	t.Helper()
	t.Setenv("ACCOUNT_SESSION_SECRET", "ai-review-test-session-secret")
	t.Setenv("ALLOW_LEGACY_CREDENTIAL_HEADERS", "false")
	base := &fakeRepository{
		platformUser: learning.PlatformUserConfig{
			ID: "reviewer-1", LoginID: "reviewer@example.com", DisplayName: "Review User",
			Roles: []string{role}, Status: "active",
		},
		accountSession: learning.AccountSession{
			UserID: "reviewer-1", LoginID: "reviewer@example.com", Role: role,
		},
	}
	repo := &aiReviewTestRepository{fakeRepository: base}
	srv := New(repo, "postgres")
	request := httptest.NewRequest(http.MethodPost, "/v1/auth/admin-login", strings.NewReader(`{
		"login_id":"reviewer@example.com",
		"password":"a-secure-password"
	}`))
	response := httptest.NewRecorder()
	srv.ServeHTTP(response, request)
	if response.Code != http.StatusOK {
		t.Fatalf("create review session: status=%d body=%s", response.Code, response.Body.String())
	}
	var login struct {
		Session accountSessionResult `json:"session"`
	}
	if err := json.NewDecoder(response.Body).Decode(&login); err != nil {
		t.Fatalf("decode review login: %v", err)
	}
	return srv, repo, login.Session.Token
}

func validAIReviewRequest() learning.AIReviewEvidence {
	return learning.AIReviewEvidence{
		ContentID: "en-y1-phonics-family-1", ContentType: "variant_family", ContentRevision: "0.2.0",
		ContentHash: strings.Repeat("a", 64), PackID: "en-y1-phonics", YearGroup: 1, Subject: "English",
		LaneID: learning.AIReviewLaneSEND, Status: "approved", RiskTier: "tier_1",
		RubricRevision: "curriculum-send-v1", SourceSetRevision: "sources-v1",
		ReviewerImplementation: "nexuslearn-ai-curriculum-send-review-v1", ModelIdentifier: "gpt-5",
		Confidence: 0.97, CriterionResults: map[string]any{"instruction_clarity": map[string]any{"result": "met"}},
		SourceIDs: []string{"dfe-send-code-0-25"}, EvidenceNotes: "AI SEND review found the governed evidence suitable.",
		ReviewedVariantIDs: []string{"variant-1", "variant-2"}, Findings: []learning.AIReviewFinding{},
	}
}

func TestAIReviewListRequiresNamedReviewRoleAndReturnsCursorPage(t *testing.T) {
	srv, repo, token := newAIReviewTestServer(t, "content_reviewer")
	repo.page = learning.AIReviewPage{
		Items:      []learning.AIReviewEvidence{{ID: "review-1", LaneID: learning.AIReviewLaneSEND}},
		NextCursor: "cursor-2",
	}

	unauthorised := httptest.NewRecorder()
	srv.ServeHTTP(unauthorised, httptest.NewRequest(http.MethodGet, "/v1/admin/ai-reviews", nil))
	if unauthorised.Code != http.StatusUnauthorized {
		t.Fatalf("expected account session requirement, got %d", unauthorised.Code)
	}

	request := httptest.NewRequest(http.MethodGet, "/v1/admin/ai-reviews?lane_id=ai_send_lead&status=approved&risk_tier=tier_1&year_group=1&subject=English&pack_id=en-y1-phonics&limit=1", nil)
	request.Header.Set("Authorization", "Bearer "+token)
	response := httptest.NewRecorder()
	srv.ServeHTTP(response, request)
	if response.Code != http.StatusOK {
		t.Fatalf("status=%d body=%s", response.Code, response.Body.String())
	}
	var page learning.AIReviewPage
	if err := json.NewDecoder(response.Body).Decode(&page); err != nil {
		t.Fatal(err)
	}
	if page.NextCursor != "cursor-2" || len(page.Items) != 1 {
		t.Fatalf("unexpected page %#v", page)
	}
	if len(repo.queries) != 1 || repo.queries[0].LaneID != learning.AIReviewLaneSEND || repo.queries[0].Limit != 1 || repo.queries[0].YearGroup != 1 {
		t.Fatalf("filters were not forwarded: %#v", repo.queries)
	}
}

func TestAIReviewSummaryReturnsRepositoryCoverageAndReleaseState(t *testing.T) {
	srv, repo, token := newAIReviewTestServer(t, "content_editor")
	repo.summary = learning.AIReviewSummary{
		Total: 13228, PackCount: 87, VariantCount: 20210,
		ByLane:     map[string]int{learning.AIReviewLaneCurriculum: 6614, learning.AIReviewLaneSEND: 6614},
		ByStatus:   map[string]int{"approved": 12380, "approved_with_observation": 848},
		ByRiskTier: map[string]int{"tier_1": 14576, "tier_2": 4800, "tier_3": 834},
		Stale:      0, ControlledPilotAllowed: true,
	}
	request := httptest.NewRequest(http.MethodGet, "/v1/admin/ai-reviews/summary", nil)
	request.Header.Set("Authorization", "Bearer "+token)
	response := httptest.NewRecorder()
	srv.ServeHTTP(response, request)
	if response.Code != http.StatusOK {
		t.Fatalf("status=%d body=%s", response.Code, response.Body.String())
	}
	var body map[string]any
	if err := json.NewDecoder(response.Body).Decode(&body); err != nil {
		t.Fatal(err)
	}
	for key, expected := range map[string]float64{
		"packs": 87, "variants": 20210, "current_ai_curriculum_lead": 6614,
		"current_ai_send_lead": 6614, "stale": 0, "revision_required": 0, "escalation_required": 0,
	} {
		if body[key] != expected {
			t.Fatalf("%s=%v, expected %v; body=%#v", key, body[key], expected, body)
		}
	}
	if body["controlled_pilot_allowed"] != true {
		t.Fatalf("expected controlled pilot eligibility, body=%#v", body)
	}
}

func TestAIReviewSaveRequiresIdempotencyAndRejectsHumanClaim(t *testing.T) {
	srv, repo, token := newAIReviewTestServer(t, "content_reviewer")
	review := validAIReviewRequest()

	body, _ := json.Marshal(review)
	missingKey := httptest.NewRequest(http.MethodPost, "/v1/admin/ai-reviews", bytes.NewReader(body))
	missingKey.Header.Set("Authorization", "Bearer "+token)
	response := httptest.NewRecorder()
	srv.ServeHTTP(response, missingKey)
	if response.Code != http.StatusBadRequest || len(repo.saved) != 0 {
		t.Fatalf("missing idempotency key must fail, status=%d saved=%d", response.Code, len(repo.saved))
	}

	review.EvidenceNotes = "Human reviewed and approved this content."
	body, _ = json.Marshal(review)
	humanClaim := httptest.NewRequest(http.MethodPost, "/v1/admin/ai-reviews", bytes.NewReader(body))
	humanClaim.Header.Set("Authorization", "Bearer "+token)
	humanClaim.Header.Set("Idempotency-Key", "review-human-claim")
	response = httptest.NewRecorder()
	srv.ServeHTTP(response, humanClaim)
	if response.Code != http.StatusBadRequest || len(repo.saved) != 0 {
		t.Fatalf("human approval claim must fail, status=%d saved=%d", response.Code, len(repo.saved))
	}

	review = validAIReviewRequest()
	body, _ = json.Marshal(review)
	valid := httptest.NewRequest(http.MethodPost, "/v1/admin/ai-reviews", bytes.NewReader(body))
	valid.Header.Set("Authorization", "Bearer "+token)
	valid.Header.Set("Idempotency-Key", "review-valid-1")
	response = httptest.NewRecorder()
	srv.ServeHTTP(response, valid)
	if response.Code != http.StatusOK || len(repo.saved) != 1 || repo.keys[0] != "review-valid-1" {
		t.Fatalf("valid review was not saved, status=%d body=%s saved=%d keys=%#v", response.Code, response.Body.String(), len(repo.saved), repo.keys)
	}
}

func TestAIReviewSaveMapsImmutableAndIdempotencyConflicts(t *testing.T) {
	srv, repo, token := newAIReviewTestServer(t, "platform_admin")
	body, _ := json.Marshal(validAIReviewRequest())
	for _, test := range []struct {
		name string
		err  error
	}{
		{name: "idempotency", err: learning.ErrIdempotencyConflict},
		{name: "immutable identity", err: learning.ErrAIReviewIdentityConflict},
	} {
		repo.saveErr = test.err
		request := httptest.NewRequest(http.MethodPost, "/v1/admin/ai-reviews", bytes.NewReader(body))
		request.Header.Set("Authorization", "Bearer "+token)
		request.Header.Set("Idempotency-Key", "conflict-"+test.name)
		response := httptest.NewRecorder()
		srv.ServeHTTP(response, request)
		if response.Code != http.StatusConflict {
			t.Fatalf("%s: expected 409, got %d: %s", test.name, response.Code, response.Body.String())
		}
	}
	if !errors.Is(repo.saveErr, learning.ErrAIReviewIdentityConflict) {
		t.Fatal("test did not exercise immutable identity conflict")
	}
}
