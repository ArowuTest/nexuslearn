package learning

import (
	"encoding/base64"
	"encoding/json"
	"strings"
)

const (
	adminRuntimeDefaultPageLimit = 25
	adminRuntimePageLimit        = 100
)

// AdminRuntimePageQuery is the bounded query contract for platform-runtime
// directories. Cursors are opaque to callers so the ordering can evolve
// without making the admin UI depend on database columns.
type AdminRuntimePageQuery struct {
	Limit  int
	Cursor string
}

type WorldPage struct {
	Worlds     []WorldConfig `json:"worlds"`
	NextCursor string        `json:"next_cursor,omitempty"`
}

type FeatureFlagPage struct {
	FeatureFlags []FeatureFlag `json:"feature_flags"`
	NextCursor   string        `json:"next_cursor,omitempty"`
}

type adminRuntimeWorldCursor struct {
	Kind      string `json:"kind"`
	YearGroup int    `json:"year_group"`
	Key       string `json:"key"`
}

type adminRuntimeFlagCursor struct {
	Kind string `json:"kind"`
	Key  string `json:"key"`
}

type adminRuntimeWorldBounds struct {
	Limit      int
	QueryLimit int
	Cursor     *adminRuntimeWorldCursor
}

type adminRuntimeFlagBounds struct {
	Limit      int
	QueryLimit int
	Cursor     *adminRuntimeFlagCursor
}

func newAdminRuntimeWorldBounds(query AdminRuntimePageQuery) (adminRuntimeWorldBounds, error) {
	limit := query.Limit
	if limit <= 0 {
		limit = adminRuntimeDefaultPageLimit
	}
	if limit > adminRuntimePageLimit {
		limit = adminRuntimePageLimit
	}
	bounds := adminRuntimeWorldBounds{Limit: limit, QueryLimit: limit + 1}
	if strings.TrimSpace(query.Cursor) == "" {
		return bounds, nil
	}
	cursor, err := decodeAdminRuntimeWorldCursor(query.Cursor)
	if err != nil {
		return adminRuntimeWorldBounds{}, err
	}
	bounds.Cursor = &cursor
	return bounds, nil
}

func newAdminRuntimeFlagBounds(query AdminRuntimePageQuery) (adminRuntimeFlagBounds, error) {
	limit := query.Limit
	if limit <= 0 {
		limit = adminRuntimeDefaultPageLimit
	}
	if limit > adminRuntimePageLimit {
		limit = adminRuntimePageLimit
	}
	bounds := adminRuntimeFlagBounds{Limit: limit, QueryLimit: limit + 1}
	if strings.TrimSpace(query.Cursor) == "" {
		return bounds, nil
	}
	cursor, err := decodeAdminRuntimeFlagCursor(query.Cursor)
	if err != nil {
		return adminRuntimeFlagBounds{}, err
	}
	bounds.Cursor = &cursor
	return bounds, nil
}

func encodeAdminRuntimeWorldCursor(cursor adminRuntimeWorldCursor) (string, error) {
	raw, err := json.Marshal(cursor)
	if err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(raw), nil
}

func decodeAdminRuntimeWorldCursor(value string) (adminRuntimeWorldCursor, error) {
	raw, err := base64.RawURLEncoding.DecodeString(strings.TrimSpace(value))
	if err != nil {
		return adminRuntimeWorldCursor{}, invalidConfig("invalid admin world cursor")
	}
	var cursor adminRuntimeWorldCursor
	if err := json.Unmarshal(raw, &cursor); err != nil || cursor.Kind != "worlds" || strings.TrimSpace(cursor.Key) == "" || cursor.YearGroup < 0 || cursor.YearGroup > 7 {
		return adminRuntimeWorldCursor{}, invalidConfig("invalid admin world cursor")
	}
	return cursor, nil
}

func encodeAdminRuntimeFlagCursor(cursor adminRuntimeFlagCursor) (string, error) {
	raw, err := json.Marshal(cursor)
	if err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(raw), nil
}

func decodeAdminRuntimeFlagCursor(value string) (adminRuntimeFlagCursor, error) {
	raw, err := base64.RawURLEncoding.DecodeString(strings.TrimSpace(value))
	if err != nil {
		return adminRuntimeFlagCursor{}, invalidConfig("invalid admin feature flag cursor")
	}
	var cursor adminRuntimeFlagCursor
	if err := json.Unmarshal(raw, &cursor); err != nil || cursor.Kind != "feature_flags" || strings.TrimSpace(cursor.Key) == "" {
		return adminRuntimeFlagCursor{}, invalidConfig("invalid admin feature flag cursor")
	}
	return cursor, nil
}

func newWorldPage(items []WorldConfig, limit int) (WorldPage, error) {
	page := WorldPage{Worlds: items}
	if len(items) <= limit {
		return page, nil
	}
	page.Worlds = items[:limit]
	last := page.Worlds[len(page.Worlds)-1]
	cursor, err := encodeAdminRuntimeWorldCursor(adminRuntimeWorldCursor{Kind: "worlds", YearGroup: last.YearGroup, Key: last.Key})
	if err != nil {
		return WorldPage{}, err
	}
	page.NextCursor = cursor
	return page, nil
}

func newFeatureFlagPage(items []FeatureFlag, limit int) (FeatureFlagPage, error) {
	page := FeatureFlagPage{FeatureFlags: items}
	if len(items) <= limit {
		return page, nil
	}
	page.FeatureFlags = items[:limit]
	last := page.FeatureFlags[len(page.FeatureFlags)-1]
	cursor, err := encodeAdminRuntimeFlagCursor(adminRuntimeFlagCursor{Kind: "feature_flags", Key: last.Key})
	if err != nil {
		return FeatureFlagPage{}, err
	}
	page.NextCursor = cursor
	return page, nil
}
