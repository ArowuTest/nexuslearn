package server

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/ArowuTest/nexuslearn/apps/api/internal/learning"
)

type fakeAdminParentAccessPageRepository struct {
	fakeRepository
	linkPage        learning.ParentLinkPage
	invitationPage  learning.ParentInvitationPage
	accessPage      learning.AccessRequestPage
	linkQuery       learning.AdminParentPageQuery
	invitationQuery learning.AdminParentPageQuery
	accessQuery     learning.AdminAccessRequestPageQuery
	linkCalls       int
	invitationCalls int
	accessCalls     int
}

func (f *fakeAdminParentAccessPageRepository) ListParentLinkPage(_ context.Context, query learning.AdminParentPageQuery) (learning.ParentLinkPage, error) {
	f.linkCalls++
	f.linkQuery = query
	return f.linkPage, nil
}

func (f *fakeAdminParentAccessPageRepository) ListParentInvitationPage(_ context.Context, query learning.AdminParentPageQuery) (learning.ParentInvitationPage, error) {
	f.invitationCalls++
	f.invitationQuery = query
	return f.invitationPage, nil
}

func (f *fakeAdminParentAccessPageRepository) ListAccessRequestPage(_ context.Context, query learning.AdminAccessRequestPageQuery) (learning.AccessRequestPage, error) {
	f.accessCalls++
	f.accessQuery = query
	return f.accessPage, nil
}

func TestAdminParentDirectoryHandlerUsesIndependentOpaqueCursors(t *testing.T) {
	t.Setenv("ADMIN_API_KEY", "test-admin")
	repo := &fakeAdminParentAccessPageRepository{
		linkPage: learning.ParentLinkPage{
			ParentLinks: []learning.ParentLinkConfig{{ID: "link-2", ParentEmail: "parent@example.test", StudentExternalRef: "learner-2"}},
			NextCursor:  "link-next",
		},
		invitationPage: learning.ParentInvitationPage{
			ParentInvitations: []learning.ParentInvitation{{ID: "invitation-2", ParentEmail: "parent@example.test", StudentExternalRef: "learner-2", Status: "pending"}},
			NextCursor:        "invitation-next",
		},
	}
	srv := New(repo, "postgres")
	req := httptest.NewRequest(http.MethodGet, "/v1/admin/parent-directory?limit=2&parent_link_cursor=link-cursor&parent_invitation_cursor=invitation-cursor", nil)
	req.Header.Set("X-Admin-Key", "test-admin")
	res := httptest.NewRecorder()
	srv.ServeHTTP(res, req)
	if res.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", res.Code, res.Body.String())
	}
	if repo.linkQuery.Limit != 2 || repo.linkQuery.Cursor != "link-cursor" || repo.invitationQuery.Limit != 2 || repo.invitationQuery.Cursor != "invitation-cursor" {
		t.Fatalf("parent cursors were not forwarded independently: links=%#v invitations=%#v", repo.linkQuery, repo.invitationQuery)
	}
	var body struct {
		Links          []learning.ParentLinkConfig `json:"parent_links"`
		LinkNext       string                      `json:"parent_link_next_cursor"`
		Invitations    []learning.ParentInvitation `json:"parent_invitations"`
		InvitationNext string                      `json:"parent_invitation_next_cursor"`
	}
	if err := json.NewDecoder(res.Body).Decode(&body); err != nil {
		t.Fatal(err)
	}
	if len(body.Links) != 1 || body.LinkNext != "link-next" || len(body.Invitations) != 1 || body.InvitationNext != "invitation-next" {
		t.Fatalf("unexpected parent directory page: %#v", body)
	}

	res = httptest.NewRecorder()
	terminalReq := httptest.NewRequest(http.MethodGet, "/v1/admin/parent-directory?parent_link_done=1&parent_invitation_done=1", nil)
	terminalReq.Header.Set("X-Admin-Key", "test-admin")
	srv.ServeHTTP(res, terminalReq)
	if res.Code != http.StatusOK || repo.linkCalls != 1 || repo.invitationCalls != 1 {
		t.Fatalf("exhausted parent collections were queried again: status=%d links=%d invitations=%d", res.Code, repo.linkCalls, repo.invitationCalls)
	}
}

func TestAdminAccessRequestDirectoryForwardsStatusAndCursor(t *testing.T) {
	t.Setenv("ADMIN_API_KEY", "test-admin")
	repo := &fakeAdminParentAccessPageRepository{
		accessPage: learning.AccessRequestPage{
			AccessRequests: []learning.AccessRequestConfig{{ID: "request-2", RequestType: "school", Status: "reviewing"}},
			NextCursor:     "request-next",
		},
	}
	srv := New(repo, "postgres")
	req := httptest.NewRequest(http.MethodGet, "/v1/admin/access-request-directory?limit=3&status=reviewing&cursor=request-cursor", nil)
	req.Header.Set("X-Admin-Key", "test-admin")
	res := httptest.NewRecorder()
	srv.ServeHTTP(res, req)
	if res.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", res.Code, res.Body.String())
	}
	if repo.accessQuery.Limit != 3 || repo.accessQuery.Status != "reviewing" || repo.accessQuery.Cursor != "request-cursor" {
		t.Fatalf("access request query was not forwarded: %#v", repo.accessQuery)
	}
	var body learning.AccessRequestPage
	if err := json.NewDecoder(res.Body).Decode(&body); err != nil {
		t.Fatal(err)
	}
	if len(body.AccessRequests) != 1 || body.NextCursor != "request-next" {
		t.Fatalf("unexpected access request page: %#v", body)
	}

	res = httptest.NewRecorder()
	srv.ServeHTTP(res, httptest.NewRequest(http.MethodGet, "/v1/admin/access-request-directory?done=1", nil))
	if res.Code != http.StatusUnauthorized {
		t.Fatalf("unauthenticated terminal access request page should be rejected, got %d", res.Code)
	}
}
