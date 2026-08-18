package server

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/ArowuTest/nexuslearn/apps/api/internal/learning"
)

type fakeContentReleaseRepository struct {
	fakeRepository
	staged      learning.ContentReleaseManifest
	uploaded    learning.ContentReleaseChunk
	activated   string
	activeLive  learning.ContentReleaseManifest
	activeCalls int
	listCalls   int
}

func (f *fakeContentReleaseRepository) StageContentRelease(_ context.Context, item learning.ContentReleaseManifest) (learning.ContentReleaseManifest, error) {
	f.staged = item
	item.Status = "staged"
	return item, nil
}
func (f *fakeContentReleaseRepository) PutContentReleaseChunk(_ context.Context, id string, item learning.ContentReleaseChunk) (learning.ContentReleaseManifest, error) {
	f.uploaded = item
	return learning.ContentReleaseManifest{ID: id, Status: "staged", UploadedPackCount: 1}, nil
}
func (f *fakeContentReleaseRepository) ApplyContentRelease(_ context.Context, id string) (learning.ContentReleaseManifest, error) {
	f.activated = id
	return learning.ContentReleaseManifest{ID: id, Status: "applied"}, nil
}
func (f *fakeContentReleaseRepository) ListContentReleases(context.Context, int) ([]learning.ContentReleaseManifest, error) {
	f.listCalls++
	return []learning.ContentReleaseManifest{f.staged}, nil
}

func (f *fakeContentReleaseRepository) ActiveContentRelease(_ context.Context, channel string) (learning.ContentReleaseManifest, bool, error) {
	f.activeCalls++
	if channel == "live" && f.activeLive.ID != "" {
		return f.activeLive, true, nil
	}
	return learning.ContentReleaseManifest{}, false, nil
}

func (f *fakeContentReleaseRepository) ListContentReleasePage(context.Context, learning.AdminPageQuery) (learning.ContentReleasePage, error) {
	return learning.ContentReleasePage{ContentReleases: []learning.ContentReleaseManifest{f.staged}}, nil
}

func TestContentReleaseRoutesUseTransactionalStore(t *testing.T) {
	t.Setenv("ADMIN_API_KEY", "release-secret")
	repo := &fakeContentReleaseRepository{}
	s := New(repo, "postgres")

	manifest := `{"id":"release-1","schema_version":"1.0","channel":"review","manifest_sha256":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","complete_snapshot":true,"expected_pack_count":1,"expected_objective_count":1,"expected_activity_count":1,"expected_question_count":3,"expected_reward_rule_count":1,"packs":[{"pack_id":"pack-1","pack_version":"1.0.0","payload_sha256":"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb","objective_count":1,"activity_count":1,"question_count":3,"reward_rule_count":1}]}`
	req := httptest.NewRequest(http.MethodPost, "/v1/admin/content/releases", strings.NewReader(manifest))
	req.Header.Set("X-Admin-Key", "release-secret")
	res := httptest.NewRecorder()
	s.ServeHTTP(res, req)
	if res.Code != http.StatusCreated || repo.staged.ID != "release-1" {
		t.Fatalf("stage failed: code=%d body=%s", res.Code, res.Body.String())
	}

	req = httptest.NewRequest(http.MethodPost, "/v1/admin/content/releases/release-1/activate", nil)
	req.Header.Set("X-Admin-Key", "release-secret")
	res = httptest.NewRecorder()
	s.ServeHTTP(res, req)
	if res.Code != http.StatusOK || repo.activated != "release-1" {
		t.Fatalf("activate failed: code=%d body=%s", res.Code, res.Body.String())
	}
}

func TestCurriculumReleaseStatusUsesActiveLiveTruthBeyondHistoryPage(t *testing.T) {
	repo := &fakeContentReleaseRepository{
		staged: learning.ContentReleaseManifest{ID: "recent-review", Channel: "review", Status: "staged"},
		activeLive: learning.ContentReleaseManifest{
			ID: "older-live", Channel: "live", Status: "applied", ExpectedPackCount: 87,
			ExpectedObjectiveCount: 87, ExpectedActivityCount: 87, ExpectedQuestionCount: 174,
			AppliedAt: "2026-08-01T09:00:00Z",
		},
	}
	srv := New(repo, "postgres")
	res := httptest.NewRecorder()
	srv.ServeHTTP(res, httptest.NewRequest(http.MethodGet, "/v1/curriculum/release-status", nil))
	if res.Code != http.StatusOK {
		t.Fatalf("expected public release status, got %d: %s", res.Code, res.Body.String())
	}
	if !strings.Contains(res.Body.String(), `"state":"live_release"`) || !strings.Contains(res.Body.String(), `"id":"older-live"`) {
		t.Fatalf("public status ignored the active live release beyond history: %s", res.Body.String())
	}
	if repo.activeCalls != 1 || repo.listCalls != 0 {
		t.Fatalf("public status must use direct active truth, active calls=%d list calls=%d", repo.activeCalls, repo.listCalls)
	}
}
