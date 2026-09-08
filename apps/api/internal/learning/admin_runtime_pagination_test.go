package learning

import "testing"

func TestAdminRuntimePagesUseBoundedOpaqueCursors(t *testing.T) {
	worlds := []WorldConfig{
		{Key: "alpha", YearGroup: 1},
		{Key: "beta", YearGroup: 2},
	}
	page, err := newWorldPage(append(worlds, WorldConfig{Key: "gamma", YearGroup: 3}), 2)
	if err != nil {
		t.Fatal(err)
	}
	if len(page.Worlds) != 2 || page.NextCursor == "" {
		t.Fatalf("expected bounded world page and cursor, got %#v", page)
	}
	worldCursor, err := decodeAdminRuntimeWorldCursor(page.NextCursor)
	if err != nil || worldCursor.Kind != "worlds" || worldCursor.YearGroup != 2 || worldCursor.Key != "beta" {
		t.Fatalf("expected stable world cursor, got %#v / %v", worldCursor, err)
	}
	if _, err := newAdminRuntimeFlagBounds(AdminRuntimePageQuery{Limit: 2, Cursor: page.NextCursor}); err == nil {
		t.Fatal("feature flag bounds must reject a world cursor")
	}

	flags := []FeatureFlag{{Key: "alpha"}, {Key: "beta"}, {Key: "gamma"}}
	flagPage, err := newFeatureFlagPage(flags, 2)
	if err != nil {
		t.Fatal(err)
	}
	flagCursor, err := decodeAdminRuntimeFlagCursor(flagPage.NextCursor)
	if err != nil || flagCursor.Kind != "feature_flags" || flagCursor.Key != "beta" {
		t.Fatalf("expected stable feature flag cursor, got %#v / %v", flagCursor, err)
	}
	if _, err := newAdminRuntimeWorldBounds(AdminRuntimePageQuery{Limit: 2, Cursor: flagPage.NextCursor}); err == nil {
		t.Fatal("world bounds must reject a feature flag cursor")
	}
}

func TestAdminRuntimePageBoundsClampDefaultAndRejectMalformedCursors(t *testing.T) {
	worlds, err := newAdminRuntimeWorldBounds(AdminRuntimePageQuery{})
	if err != nil || worlds.Limit != adminRuntimeDefaultPageLimit || worlds.QueryLimit != adminRuntimeDefaultPageLimit+1 {
		t.Fatalf("unexpected world defaults: %#v / %v", worlds, err)
	}
	flags, err := newAdminRuntimeFlagBounds(AdminRuntimePageQuery{Limit: 1000})
	if err != nil || flags.Limit != adminRuntimePageLimit || flags.QueryLimit != adminRuntimePageLimit+1 {
		t.Fatalf("unexpected feature flag clamp: %#v / %v", flags, err)
	}
	if _, err := newAdminRuntimeFlagBounds(AdminRuntimePageQuery{Cursor: "not-a-cursor"}); err == nil {
		t.Fatal("malformed feature flag cursor must be rejected")
	}
}
