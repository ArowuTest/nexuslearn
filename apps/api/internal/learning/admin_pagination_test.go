package learning

import (
	"strings"
	"testing"
	"time"
)

func TestAdminCursorRoundTripPreservesTimestampAndID(t *testing.T) {
	createdAt := time.Date(2026, time.August, 18, 14, 30, 12, 987654321, time.UTC)
	cursor := EncodeAdminCursor(createdAt, "7b20d33f-10c4-4918-b53e-b95f2c28cb7c")
	if strings.ContainsAny(cursor, "+/=") {
		t.Fatalf("cursor is not raw URL-safe base64: %q", cursor)
	}

	decodedAt, decodedID, err := DecodeAdminCursor(cursor)
	if err != nil {
		t.Fatal(err)
	}
	if !decodedAt.Equal(createdAt) || decodedID != "7b20d33f-10c4-4918-b53e-b95f2c28cb7c" {
		t.Fatalf("unexpected cursor round trip: %s %s", decodedAt, decodedID)
	}
}

func TestAdminCursorRejectsMalformedPayloads(t *testing.T) {
	for _, cursor := range []string{
		"not-base64!",
		"e30", // {}
		"eyJjcmVhdGVkX2F0IjoiMjAyNi0wOC0xOFQxNDozMDoxMloifQ", // missing id
		"eyJjcmVhdGVkX2F0Ijoibm90LWEtdGltZSIsImlkIjoicmVsZWFzZS0xIn0",
	} {
		t.Run(cursor, func(t *testing.T) {
			if _, _, err := DecodeAdminCursor(cursor); err == nil {
				t.Fatal("expected malformed cursor to be rejected")
			}
		})
	}
}

func TestAdminPageBoundsUseLimitPlusOneAndCompleteKeysetBoundary(t *testing.T) {
	createdAt := time.Date(2026, time.August, 18, 14, 30, 12, 0, time.UTC)
	bounds, err := newAdminPageBounds(AdminPageQuery{
		Limit:           2,
		BeforeCreatedAt: createdAt,
		BeforeID:        "7b20d33f-10c4-4918-b53e-b95f2c28cb7c",
	})
	if err != nil {
		t.Fatal(err)
	}
	if bounds.QueryLimit != 3 || bounds.BeforeCreatedAt != createdAt || bounds.BeforeID != "7b20d33f-10c4-4918-b53e-b95f2c28cb7c" {
		t.Fatalf("unexpected keyset bounds: %#v", bounds)
	}

	if _, err := newAdminPageBounds(AdminPageQuery{Limit: 2, BeforeCreatedAt: createdAt}); err == nil {
		t.Fatal("timestamp-only cursor must be rejected because same-timestamp rows would be omitted")
	}
	if _, err := newAdminPageBounds(AdminPageQuery{Limit: 2, BeforeID: "release-1"}); err == nil {
		t.Fatal("id-only cursor must be rejected because the page boundary is incomplete")
	}
}

func TestAdminTimestampPreservesSubsecondPageBoundary(t *testing.T) {
	createdAt := time.Date(2026, time.August, 18, 14, 30, 12, 987654000, time.UTC)
	formatted := formatAdminTimestamp(createdAt)
	parsed, err := time.Parse(time.RFC3339Nano, formatted)
	if err != nil {
		t.Fatal(err)
	}
	if !parsed.Equal(createdAt) {
		t.Fatalf("database timestamp precision was lost: got %s want %s", parsed, createdAt)
	}
}

func TestAuditLogPageCursorUsesLastReturnedSameTimestampRow(t *testing.T) {
	createdAt := "2026-08-18T14:30:12Z"
	page, err := newAuditLogPage([]AuditLog{
		{ID: "00000000-0000-0000-0000-000000000003", CreatedAt: createdAt},
		{ID: "00000000-0000-0000-0000-000000000002", CreatedAt: createdAt},
		{ID: "00000000-0000-0000-0000-000000000001", CreatedAt: createdAt},
	}, 2)
	if err != nil {
		t.Fatal(err)
	}
	if len(page.AuditLogs) != 2 || page.AuditLogs[1].ID != "00000000-0000-0000-0000-000000000002" {
		t.Fatalf("unexpected page rows: %#v", page.AuditLogs)
	}
	_, id, err := DecodeAdminCursor(page.NextCursor)
	if err != nil {
		t.Fatal(err)
	}
	if id != "00000000-0000-0000-0000-000000000002" {
		t.Fatalf("cursor must use the last returned tie-breaker id, got %q", id)
	}
}

func TestAdminPagesOmitCursorAtEndOfCollection(t *testing.T) {
	versions, err := newContentVersionPage([]ContentVersion{{
		ID: "00000000-0000-0000-0000-000000000001", CreatedAt: "2026-08-18T14:30:12Z",
	}}, 1)
	if err != nil {
		t.Fatal(err)
	}
	if versions.NextCursor != "" || len(versions.ContentVersions) != 1 {
		t.Fatalf("unexpected terminal versions page: %#v", versions)
	}

	releases, err := newContentReleasePage([]ContentReleaseManifest{{
		ID: "release-1", CreatedAt: "2026-08-18T14:30:12Z",
	}}, 1)
	if err != nil {
		t.Fatal(err)
	}
	if releases.NextCursor != "" || len(releases.ContentReleases) != 1 {
		t.Fatalf("unexpected terminal releases page: %#v", releases)
	}
}
