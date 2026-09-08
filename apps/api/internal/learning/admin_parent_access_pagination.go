package learning

import (
	"encoding/base64"
	"encoding/json"
	"strings"
	"time"
)

const (
	adminParentDefaultPageLimit = 25
	adminParentPageLimit        = 100
	adminAccessDefaultPageLimit = 25
	adminAccessPageLimit        = 100
)

// AdminParentPageQuery keeps the parent relationship and invitation cursor
// families separate from every other admin directory.
type AdminParentPageQuery struct {
	Limit  int
	Cursor string
}

type ParentLinkPage struct {
	ParentLinks []ParentLinkConfig `json:"parent_links"`
	NextCursor  string             `json:"next_cursor,omitempty"`
}

type ParentInvitationPage struct {
	ParentInvitations []ParentInvitation `json:"parent_invitations"`
	NextCursor        string             `json:"next_cursor,omitempty"`
}

// AdminAccessRequestPageQuery carries the optional status filter so a cursor
// cannot accidentally be replayed against a different filtered collection.
type AdminAccessRequestPageQuery struct {
	Limit  int
	Cursor string
	Status string
}

type AccessRequestPage struct {
	AccessRequests []AccessRequestConfig `json:"access_requests"`
	NextCursor     string                `json:"next_cursor,omitempty"`
}

type adminParentBounds struct {
	Limit      int
	QueryLimit int
	Cursor     *adminParentCursor
}

type adminParentCursor struct {
	Kind         string `json:"kind"`
	StudentID    string `json:"student_id,omitempty"`
	ParentUserID string `json:"parent_user_id,omitempty"`
	CreatedAt    string `json:"created_at,omitempty"`
	ID           string `json:"id"`
}

type adminAccessRequestBounds struct {
	Limit      int
	QueryLimit int
	Status     string
	Cursor     *adminAccessRequestCursor
}

type adminAccessRequestCursor struct {
	Kind      string `json:"kind"`
	Status    string `json:"status,omitempty"`
	CreatedAt string `json:"created_at"`
	ID        string `json:"id"`
}

func newAdminParentBounds(query AdminParentPageQuery, kind string) (adminParentBounds, error) {
	limit := query.Limit
	if limit <= 0 {
		limit = adminParentDefaultPageLimit
	}
	if limit > adminParentPageLimit {
		limit = adminParentPageLimit
	}
	bounds := adminParentBounds{Limit: limit, QueryLimit: limit + 1}
	if strings.TrimSpace(query.Cursor) == "" {
		return bounds, nil
	}
	cursor, err := decodeAdminParentCursor(query.Cursor, kind)
	if err != nil {
		return adminParentBounds{}, err
	}
	bounds.Cursor = &cursor
	return bounds, nil
}

func encodeAdminParentCursor(cursor adminParentCursor) (string, error) {
	raw, err := json.Marshal(cursor)
	if err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(raw), nil
}

func decodeAdminParentCursor(value string, kind string) (adminParentCursor, error) {
	raw, err := base64.RawURLEncoding.DecodeString(strings.TrimSpace(value))
	if err != nil {
		return adminParentCursor{}, invalidConfig("invalid admin parent cursor")
	}
	var cursor adminParentCursor
	if err := json.Unmarshal(raw, &cursor); err != nil || cursor.Kind != kind || strings.TrimSpace(cursor.ID) == "" {
		return adminParentCursor{}, invalidConfig("invalid admin parent cursor")
	}
	switch kind {
	case "parent_links":
		if strings.TrimSpace(cursor.StudentID) == "" || strings.TrimSpace(cursor.ParentUserID) == "" {
			return adminParentCursor{}, invalidConfig("invalid admin parent cursor")
		}
	case "parent_invitations":
		if strings.TrimSpace(cursor.CreatedAt) == "" {
			return adminParentCursor{}, invalidConfig("invalid admin parent cursor")
		}
		if _, err := time.Parse(time.RFC3339Nano, cursor.CreatedAt); err != nil {
			return adminParentCursor{}, invalidConfig("invalid admin parent cursor")
		}
	default:
		return adminParentCursor{}, invalidConfig("invalid admin parent cursor")
	}
	return cursor, nil
}

func newAdminAccessRequestBounds(query AdminAccessRequestPageQuery) (adminAccessRequestBounds, error) {
	limit := query.Limit
	if limit <= 0 {
		limit = adminAccessDefaultPageLimit
	}
	if limit > adminAccessPageLimit {
		limit = adminAccessPageLimit
	}
	status := strings.ToLower(strings.TrimSpace(query.Status))
	if status != "" && !validAccessRequestStatus(status) {
		return adminAccessRequestBounds{}, invalidConfig("access request status is not valid")
	}
	bounds := adminAccessRequestBounds{Limit: limit, QueryLimit: limit + 1, Status: status}
	if strings.TrimSpace(query.Cursor) == "" {
		return bounds, nil
	}
	cursor, err := decodeAdminAccessRequestCursor(query.Cursor)
	if err != nil {
		return adminAccessRequestBounds{}, err
	}
	if cursor.Status != status {
		return adminAccessRequestBounds{}, invalidConfig("access request cursor does not match the status filter")
	}
	bounds.Cursor = &cursor
	return bounds, nil
}

func encodeAdminAccessRequestCursor(cursor adminAccessRequestCursor) (string, error) {
	raw, err := json.Marshal(cursor)
	if err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(raw), nil
}

func decodeAdminAccessRequestCursor(value string) (adminAccessRequestCursor, error) {
	raw, err := base64.RawURLEncoding.DecodeString(strings.TrimSpace(value))
	if err != nil {
		return adminAccessRequestCursor{}, invalidConfig("invalid admin access request cursor")
	}
	var cursor adminAccessRequestCursor
	if err := json.Unmarshal(raw, &cursor); err != nil || cursor.Kind != "access_requests" || strings.TrimSpace(cursor.ID) == "" || strings.TrimSpace(cursor.CreatedAt) == "" {
		return adminAccessRequestCursor{}, invalidConfig("invalid admin access request cursor")
	}
	if _, err := time.Parse(time.RFC3339Nano, cursor.CreatedAt); err != nil {
		return adminAccessRequestCursor{}, invalidConfig("invalid admin access request cursor")
	}
	if cursor.Status != "" && !validAccessRequestStatus(cursor.Status) {
		return adminAccessRequestCursor{}, invalidConfig("invalid admin access request cursor")
	}
	return cursor, nil
}
