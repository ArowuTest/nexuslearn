package learning

import (
	"encoding/base64"
	"encoding/json"
	"strings"
)

const (
	adminGroupDefaultPageLimit = 25
	adminGroupPageLimit        = 100
)

// AdminGroupPageQuery keeps the group directory cursor separate from the
// learner, organisation and ledger cursor families.
type AdminGroupPageQuery struct {
	Limit  int
	Cursor string
}

type GroupPage struct {
	Groups     []LearningGroupConfig `json:"groups"`
	NextCursor string                `json:"next_cursor,omitempty"`
}

type adminGroupBounds struct {
	Limit      int
	QueryLimit int
	Cursor     *adminGroupCursor
}

type adminGroupCursor struct {
	Kind      string `json:"kind"`
	YearGroup int    `json:"year_group"`
	ClassName string `json:"class_name,omitempty"`
	GroupName string `json:"group_name"`
	ID        string `json:"id"`
}

func newAdminGroupBounds(query AdminGroupPageQuery) (adminGroupBounds, error) {
	limit := query.Limit
	if limit <= 0 {
		limit = adminGroupDefaultPageLimit
	}
	if limit > adminGroupPageLimit {
		limit = adminGroupPageLimit
	}
	bounds := adminGroupBounds{Limit: limit, QueryLimit: limit + 1}
	if strings.TrimSpace(query.Cursor) == "" {
		return bounds, nil
	}
	cursor, err := decodeAdminGroupCursor(query.Cursor)
	if err != nil {
		return adminGroupBounds{}, err
	}
	bounds.Cursor = &cursor
	return bounds, nil
}

func encodeAdminGroupCursor(cursor adminGroupCursor) (string, error) {
	raw, err := json.Marshal(cursor)
	if err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(raw), nil
}

func decodeAdminGroupCursor(value string) (adminGroupCursor, error) {
	raw, err := base64.RawURLEncoding.DecodeString(strings.TrimSpace(value))
	if err != nil {
		return adminGroupCursor{}, invalidConfig("invalid admin group cursor")
	}
	var cursor adminGroupCursor
	if err := json.Unmarshal(raw, &cursor); err != nil || cursor.Kind != "groups" || strings.TrimSpace(cursor.ID) == "" || strings.TrimSpace(cursor.GroupName) == "" {
		return adminGroupCursor{}, invalidConfig("invalid admin group cursor")
	}
	if cursor.YearGroup < 0 || cursor.YearGroup > 7 {
		return adminGroupCursor{}, invalidConfig("invalid admin group cursor")
	}
	return cursor, nil
}

func newGroupPage(items []LearningGroupConfig, limit int) (GroupPage, error) {
	page := GroupPage{Groups: items}
	if len(items) <= limit {
		return page, nil
	}
	page.Groups = items[:limit]
	cursor, err := encodeAdminGroupCursor(adminGroupCursorFromGroup(page.Groups[len(page.Groups)-1]))
	if err != nil {
		return GroupPage{}, err
	}
	page.NextCursor = cursor
	return page, nil
}

func adminGroupCursorFromGroup(group LearningGroupConfig) adminGroupCursor {
	return adminGroupCursor{Kind: "groups", GroupName: group.Name, ID: group.ID}
}
