package learning

import (
	"testing"
	"time"
)

func TestAdminParentPageBoundsKeepCursorFamiliesSeparate(t *testing.T) {
	linkCursor, err := encodeAdminParentCursor(adminParentCursor{
		Kind: "parent_links", StudentID: "00000000-0000-0000-0000-000000000001", ParentUserID: "00000000-0000-0000-0000-000000000002", ID: "00000000-0000-0000-0000-000000000003",
	})
	if err != nil {
		t.Fatal(err)
	}
	if _, err := newAdminParentBounds(AdminParentPageQuery{Limit: 500, Cursor: linkCursor}, "parent_links"); err != nil {
		t.Fatalf("valid parent link cursor rejected: %v", err)
	}
	if _, err := newAdminParentBounds(AdminParentPageQuery{Cursor: linkCursor}, "parent_invitations"); err == nil {
		t.Fatal("parent link cursor was accepted by invitation collection")
	}

	invitationCursor, err := encodeAdminParentCursor(adminParentCursor{
		Kind: "parent_invitations", CreatedAt: time.Date(2026, time.August, 18, 12, 0, 0, 123456000, time.UTC).Format(time.RFC3339Nano), ID: "00000000-0000-0000-0000-000000000004",
	})
	if err != nil {
		t.Fatal(err)
	}
	if _, err := newAdminParentBounds(AdminParentPageQuery{Cursor: invitationCursor}, "parent_invitations"); err != nil {
		t.Fatalf("valid invitation cursor rejected: %v", err)
	}
}

func TestAdminAccessRequestBoundsBindCursorToStatusFilter(t *testing.T) {
	cursor, err := encodeAdminAccessRequestCursor(adminAccessRequestCursor{
		Kind: "access_requests", Status: "reviewing", CreatedAt: time.Date(2026, time.August, 18, 12, 0, 0, 123456000, time.UTC).Format(time.RFC3339Nano), ID: "00000000-0000-0000-0000-000000000005",
	})
	if err != nil {
		t.Fatal(err)
	}
	if _, err := newAdminAccessRequestBounds(AdminAccessRequestPageQuery{Limit: 500, Cursor: cursor, Status: "reviewing"}); err != nil {
		t.Fatalf("valid status-bound cursor rejected: %v", err)
	}
	if _, err := newAdminAccessRequestBounds(AdminAccessRequestPageQuery{Cursor: cursor, Status: "approved"}); err == nil {
		t.Fatal("cursor was accepted with a different status filter")
	}
	if _, err := newAdminAccessRequestBounds(AdminAccessRequestPageQuery{Status: "not-a-status"}); err == nil {
		t.Fatal("invalid status filter was accepted")
	}
}
