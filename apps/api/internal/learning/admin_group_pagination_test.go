package learning

import "testing"

func TestAdminGroupPageBoundsAndCursorValidation(t *testing.T) {
	tests := []struct {
		name  string
		query AdminGroupPageQuery
		limit int
	}{
		{name: "default", query: AdminGroupPageQuery{}, limit: adminGroupDefaultPageLimit},
		{name: "capped", query: AdminGroupPageQuery{Limit: adminGroupPageLimit + 50}, limit: adminGroupPageLimit},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			bounds, err := newAdminGroupBounds(test.query)
			if err != nil {
				t.Fatal(err)
			}
			if bounds.Limit != test.limit || bounds.QueryLimit != test.limit+1 {
				t.Fatalf("unexpected bounds: %#v", bounds)
			}
		})
	}

	page, err := newGroupPage([]LearningGroupConfig{
		{ID: "group-1", Name: "Blue"},
		{ID: "group-2", Name: "Green"},
	}, 1)
	if err != nil {
		t.Fatal(err)
	}
	if len(page.Groups) != 1 || page.NextCursor == "" {
		t.Fatalf("expected bounded group page: %#v", page)
	}
	if _, err := decodeAdminGroupCursor(page.NextCursor); err != nil {
		t.Fatalf("page cursor was not decodable: %v", err)
	}
	if _, err := decodeAdminGroupCursor("not-valid"); err == nil {
		t.Fatal("malformed group cursor should be rejected")
	}
}
