package learning

import "testing"

func TestAdminOrganisationBoundsDefaultsAndCaps(t *testing.T) {
	for _, test := range []struct {
		name  string
		query AdminOrganisationPageQuery
		limit int
	}{
		{name: "default", limit: 25},
		{name: "cap", query: AdminOrganisationPageQuery{Limit: 999}, limit: 100},
	} {
		t.Run(test.name, func(t *testing.T) {
			bounds, err := newAdminOrganisationBounds(test.query, "schools")
			if err != nil {
				t.Fatal(err)
			}
			if bounds.Limit != test.limit || bounds.QueryLimit != test.limit+1 {
				t.Fatalf("unexpected bounds: %#v", bounds)
			}
		})
	}
}

func TestAdminOrganisationPagesMintCollectionSpecificCursors(t *testing.T) {
	schools, err := newSchoolPage([]SchoolConfig{
		{ID: "school-1", Name: "Alpha", URN: "alpha"},
		{ID: "school-2", Name: "Beta", URN: "beta"},
	}, 1)
	if err != nil {
		t.Fatal(err)
	}
	if len(schools.Schools) != 1 || schools.NextCursor == "" {
		t.Fatalf("expected a bounded school page: %#v", schools)
	}
	if _, err := newAdminOrganisationBounds(AdminOrganisationPageQuery{Limit: 1, Cursor: schools.NextCursor}, "school_users"); err == nil {
		t.Fatal("a school cursor must not be accepted for school users")
	}

	users, err := newSchoolUserPage([]SchoolUserConfig{
		{ID: "user-1", SchoolName: "Alpha", Role: "teacher", DisplayName: "A Teacher"},
		{ID: "user-2", SchoolName: "Alpha", Role: "teacher", DisplayName: "B Teacher"},
	}, 1)
	if err != nil {
		t.Fatal(err)
	}
	if len(users.SchoolUsers) != 1 || users.NextCursor == "" {
		t.Fatalf("expected a bounded user page: %#v", users)
	}

	classes, err := newClassPage([]ClassConfig{
		{ID: "class-1", SchoolName: "Alpha", Name: "One", YearGroup: 1},
		{ID: "class-2", SchoolName: "Alpha", Name: "Two", YearGroup: 1},
	}, 1)
	if err != nil {
		t.Fatal(err)
	}
	if len(classes.Classes) != 1 || classes.NextCursor == "" {
		t.Fatalf("expected a bounded class page: %#v", classes)
	}
}
