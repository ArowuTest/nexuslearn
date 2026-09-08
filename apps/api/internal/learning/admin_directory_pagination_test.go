package learning

import "testing"

func TestAdminDirectoryPageBoundsAndOpaqueCursor(t *testing.T) {
	query, err := newAdminDirectoryBounds(AdminDirectoryPageQuery{Limit: 999})
	if err != nil {
		t.Fatalf("bounded directory query should validate: %v", err)
	}
	if query.Limit != adminDirectoryPageLimit || query.QueryLimit != adminDirectoryPageLimit+1 {
		t.Fatalf("unexpected bounded directory query: %#v", query)
	}

	cursor, err := encodeAdminDirectoryCursor(adminDirectoryCursor{YearGroup: 3, DisplayName: "Ava", ExternalRef: "ava-y3"})
	if err != nil {
		t.Fatal(err)
	}
	decoded, err := decodeAdminDirectoryCursor(cursor)
	if err != nil {
		t.Fatalf("opaque cursor should round-trip: %v", err)
	}
	if decoded.YearGroup != 3 || decoded.DisplayName != "Ava" || decoded.ExternalRef != "ava-y3" {
		t.Fatalf("cursor changed ordering key: %#v", decoded)
	}

	if _, err := newAdminDirectoryBounds(AdminDirectoryPageQuery{Cursor: "not-a-valid-cursor"}); err == nil {
		t.Fatal("malformed directory cursors must fail closed")
	}
}

func TestAdminDirectoryPagesEmitCursorOnlyWhenMoreRowsExist(t *testing.T) {
	items := []StudentProfileConfig{
		{YearGroup: 1, DisplayName: "Ava", ExternalRef: "ava-y1"},
		{YearGroup: 1, DisplayName: "Ben", ExternalRef: "ben-y1"},
		{YearGroup: 2, DisplayName: "Cleo", ExternalRef: "cleo-y2"},
	}

	page, err := newStudentProfilePage(items, 2)
	if err != nil {
		t.Fatal(err)
	}
	if len(page.Students) != 2 || page.NextCursor == "" || page.Students[1].ExternalRef != "ben-y1" {
		t.Fatalf("expected bounded first page with cursor: %#v", page)
	}

	lastPage, err := newStudentProfilePage(items[:2], 2)
	if err != nil {
		t.Fatal(err)
	}
	if len(lastPage.Students) != 2 || lastPage.NextCursor != "" {
		t.Fatalf("last page should not expose a cursor: %#v", lastPage)
	}
}
