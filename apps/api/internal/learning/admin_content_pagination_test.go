package learning

import (
	"testing"
	"time"
)

func TestAdminContentPageBoundsRejectCrossCollectionCursors(t *testing.T) {
	cursor, err := encodeAdminContentCursor(adminContentCursor{
		Kind: "activities", UpdatedAt: time.Date(2026, time.August, 18, 12, 0, 0, 123456000, time.UTC).Format(time.RFC3339Nano), ID: "activity-1",
	})
	if err != nil {
		t.Fatal(err)
	}
	if _, err := newAdminContentBounds(AdminContentPageQuery{Cursor: cursor}, "questions"); err == nil {
		t.Fatal("expected a cursor minted for another content collection to be rejected")
	}
	if _, err := newAdminContentBounds(AdminContentPageQuery{Limit: 1000}, "activities"); err != nil {
		t.Fatal(err)
	}
	bounds, err := newAdminContentBounds(AdminContentPageQuery{}, "activities")
	if err != nil || bounds.Limit != 25 || bounds.QueryLimit != 26 {
		t.Fatalf("unexpected default content bounds: %#v err=%v", bounds, err)
	}
}

func TestAdminContentPagesExposeStableOpaqueCursors(t *testing.T) {
	updatedAt := time.Date(2026, time.August, 18, 12, 0, 0, 123456000, time.UTC).Format(time.RFC3339Nano)
	activities, err := newActivityPage([]ActivityConfig{{ID: "activity-1", UpdatedAt: updatedAt}, {ID: "activity-2", UpdatedAt: updatedAt}}, 1)
	if err != nil {
		t.Fatal(err)
	}
	decoded, err := decodeAdminContentCursor(activities.NextCursor, "activities")
	if err != nil || decoded.ID != "activity-1" || decoded.UpdatedAt != updatedAt {
		t.Fatalf("activity cursor lost ordering precision: %#v err=%v", decoded, err)
	}

	objectives, err := newObjectivePage([]Objective{
		{ID: "objective-1", Year: 3, Subject: "English", Strand: "Reading", Topic: "Inference"},
		{ID: "objective-2", Year: 3, Subject: "English", Strand: "Reading", Topic: "Inference"},
	}, 1)
	if err != nil {
		t.Fatal(err)
	}
	decoded, err = decodeAdminContentCursor(objectives.NextCursor, "objectives")
	if err != nil || decoded.ID != "objective-1" || decoded.Year != 3 || decoded.Topic != "Inference" {
		t.Fatalf("objective cursor lost catalogue ordering: %#v err=%v", decoded, err)
	}
}
