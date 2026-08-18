package learning

import (
	"encoding/base64"
	"encoding/json"
	"fmt"
	"strings"
	"time"
)

const adminPageLimit = 100

type AdminPageQuery struct {
	Limit           int
	BeforeCreatedAt time.Time
	BeforeID        string
}

type AuditLogPage struct {
	AuditLogs  []AuditLog `json:"audit_logs"`
	NextCursor string     `json:"next_cursor,omitempty"`
}

type ContentVersionPage struct {
	ContentVersions []ContentVersion `json:"content_versions"`
	NextCursor      string           `json:"next_cursor,omitempty"`
}

type ContentReleasePage struct {
	ContentReleases []ContentReleaseManifest `json:"content_releases"`
	NextCursor      string                   `json:"next_cursor,omitempty"`
	LiveApplied     bool                     `json:"live_applied"`
}

type adminPageBounds struct {
	Limit           int
	QueryLimit      int
	BeforeCreatedAt time.Time
	BeforeID        string
}

func EncodeAdminCursor(createdAt time.Time, id string) string {
	payload, _ := json.Marshal(map[string]string{
		"created_at": createdAt.UTC().Format(time.RFC3339Nano),
		"id":         id,
	})
	return base64.RawURLEncoding.EncodeToString(payload)
}

func DecodeAdminCursor(cursor string) (time.Time, string, error) {
	raw, err := base64.RawURLEncoding.DecodeString(strings.TrimSpace(cursor))
	if err != nil {
		return time.Time{}, "", invalidConfig("invalid admin page cursor")
	}
	var value struct {
		CreatedAt string `json:"created_at"`
		ID        string `json:"id"`
	}
	if err := json.Unmarshal(raw, &value); err != nil || strings.TrimSpace(value.ID) == "" || strings.TrimSpace(value.CreatedAt) == "" {
		return time.Time{}, "", invalidConfig("invalid admin page cursor")
	}
	createdAt, err := time.Parse(time.RFC3339Nano, value.CreatedAt)
	if err != nil {
		return time.Time{}, "", invalidConfig("invalid admin page cursor")
	}
	return createdAt, value.ID, nil
}

func newAdminPageBounds(query AdminPageQuery) (adminPageBounds, error) {
	if query.BeforeCreatedAt.IsZero() != (strings.TrimSpace(query.BeforeID) == "") {
		return adminPageBounds{}, invalidConfig("admin page cursor must include a timestamp and id")
	}
	if query.Limit <= 0 {
		query.Limit = adminPageLimit
	} else if query.Limit > adminPageLimit {
		query.Limit = adminPageLimit
	}
	return adminPageBounds{
		Limit:           query.Limit,
		QueryLimit:      query.Limit + 1,
		BeforeCreatedAt: query.BeforeCreatedAt.UTC(),
		BeforeID:        strings.TrimSpace(query.BeforeID),
	}, nil
}

func newAuditLogPage(items []AuditLog, limit int) (AuditLogPage, error) {
	page := AuditLogPage{AuditLogs: items}
	if len(items) <= limit {
		return page, nil
	}
	last := items[limit-1]
	cursor, err := cursorForAdminRow(last.CreatedAt, last.ID)
	if err != nil {
		return AuditLogPage{}, err
	}
	page.AuditLogs = items[:limit]
	page.NextCursor = cursor
	return page, nil
}

func newContentVersionPage(items []ContentVersion, limit int) (ContentVersionPage, error) {
	page := ContentVersionPage{ContentVersions: items}
	if len(items) <= limit {
		return page, nil
	}
	last := items[limit-1]
	cursor, err := cursorForAdminRow(last.CreatedAt, last.ID)
	if err != nil {
		return ContentVersionPage{}, err
	}
	page.ContentVersions = items[:limit]
	page.NextCursor = cursor
	return page, nil
}

func newContentReleasePage(items []ContentReleaseManifest, limit int) (ContentReleasePage, error) {
	page := ContentReleasePage{ContentReleases: items}
	if len(items) <= limit {
		return page, nil
	}
	last := items[limit-1]
	cursor, err := cursorForAdminRow(last.CreatedAt, last.ID)
	if err != nil {
		return ContentReleasePage{}, err
	}
	page.ContentReleases = items[:limit]
	page.NextCursor = cursor
	return page, nil
}

func cursorForAdminRow(createdAt string, id string) (string, error) {
	timestamp, err := time.Parse(time.RFC3339Nano, createdAt)
	if err != nil {
		return "", fmt.Errorf("invalid admin row timestamp: %w", err)
	}
	return EncodeAdminCursor(timestamp, id), nil
}

func formatAdminTimestamp(value time.Time) string {
	return value.UTC().Format(time.RFC3339Nano)
}
