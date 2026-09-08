package server

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/ArowuTest/nexuslearn/apps/api/internal/learning"
)

type fakeAdminContentPageRepository struct {
	fakeRepository
	activityPage   learning.ActivityPage
	questionPage   learning.QuestionPage
	rewardPage     learning.RewardRulePage
	objectivePage  learning.ObjectivePage
	activityQuery  learning.AdminContentPageQuery
	questionQuery  learning.AdminContentPageQuery
	rewardQuery    learning.AdminContentPageQuery
	objectiveQuery learning.AdminContentPageQuery
}

func (f *fakeAdminContentPageRepository) ListActivityPage(_ context.Context, query learning.AdminContentPageQuery) (learning.ActivityPage, error) {
	f.activityQuery = query
	return f.activityPage, nil
}

func (f *fakeAdminContentPageRepository) ListQuestionPage(_ context.Context, query learning.AdminContentPageQuery) (learning.QuestionPage, error) {
	f.questionQuery = query
	return f.questionPage, nil
}

func (f *fakeAdminContentPageRepository) ListRewardRulePage(_ context.Context, query learning.AdminContentPageQuery) (learning.RewardRulePage, error) {
	f.rewardQuery = query
	return f.rewardPage, nil
}

func (f *fakeAdminContentPageRepository) ListObjectivePage(_ context.Context, query learning.AdminContentPageQuery) (learning.ObjectivePage, error) {
	f.objectiveQuery = query
	return f.objectivePage, nil
}

func TestAdminContentDirectoryHandlersForwardOpaquePages(t *testing.T) {
	t.Setenv("ADMIN_API_KEY", "test-admin")
	repo := &fakeAdminContentPageRepository{
		activityPage:  learning.ActivityPage{Activities: []learning.ActivityConfig{{ID: "activity-1"}}, NextCursor: "activity-next"},
		questionPage:  learning.QuestionPage{Questions: []learning.QuestionConfig{{ID: "question-1"}}, NextCursor: "question-next"},
		rewardPage:    learning.RewardRulePage{RewardRules: []learning.RewardRule{{ID: "reward-1"}}, NextCursor: "reward-next"},
		objectivePage: learning.ObjectivePage{Objectives: []learning.Objective{{ID: "objective-1"}}, NextCursor: "objective-next"},
	}
	srv := New(repo, "postgres")
	tests := []struct {
		name      string
		path      string
		wantKey   string
		wantQuery func() learning.AdminContentPageQuery
	}{
		{name: "activities", path: "/v1/admin/content/activity-directory", wantKey: "activities", wantQuery: func() learning.AdminContentPageQuery { return repo.activityQuery }},
		{name: "questions", path: "/v1/admin/content/question-directory", wantKey: "questions", wantQuery: func() learning.AdminContentPageQuery { return repo.questionQuery }},
		{name: "rewards", path: "/v1/admin/content/reward-directory", wantKey: "reward_rules", wantQuery: func() learning.AdminContentPageQuery { return repo.rewardQuery }},
		{name: "objectives", path: "/v1/admin/content/objective-directory", wantKey: "objectives", wantQuery: func() learning.AdminContentPageQuery { return repo.objectiveQuery }},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			req := httptest.NewRequest(http.MethodGet, test.path+"?limit=37&cursor=opaque-content-cursor", nil)
			req.Header.Set("X-Admin-Key", "test-admin")
			res := httptest.NewRecorder()
			srv.ServeHTTP(res, req)
			if res.Code != http.StatusOK {
				t.Fatalf("expected 200, got %d: %s", res.Code, res.Body.String())
			}
			query := test.wantQuery()
			if query.Limit != 37 || query.Cursor != "opaque-content-cursor" {
				t.Fatalf("content query was not forwarded: %#v", query)
			}
			var body map[string]json.RawMessage
			if err := json.NewDecoder(res.Body).Decode(&body); err != nil {
				t.Fatal(err)
			}
			if _, ok := body[test.wantKey]; !ok {
				t.Fatalf("collection key %q is missing: %s", test.wantKey, res.Body.String())
			}
		})
	}

	for _, path := range []string{
		"/v1/admin/content/activity-directory?limit=2",
		"/v1/admin/content/question-directory?limit=2",
		"/v1/admin/content/reward-directory?limit=2",
		"/v1/admin/content/objective-directory?limit=2",
	} {
		res := httptest.NewRecorder()
		srv.ServeHTTP(res, httptest.NewRequest(http.MethodGet, path, nil))
		if res.Code != http.StatusUnauthorized {
			t.Fatalf("%s: expected 401, got %d", path, res.Code)
		}
	}
}
