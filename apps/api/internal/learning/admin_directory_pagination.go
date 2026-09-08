package learning

import (
	"encoding/base64"
	"encoding/json"
	"strings"
)

const (
	adminDirectoryDefaultPageLimit = 25
	adminDirectoryPageLimit        = 100
)

// AdminDirectoryPageQuery is deliberately separate from the audit cursor.
// Directory rows are ordered by learner identity, not event time, so using an
// audit cursor here would make page boundaries unstable when names change.
type AdminDirectoryPageQuery struct {
	Limit  int
	Cursor string
}

type StudentProfilePage struct {
	Students   []StudentProfileConfig `json:"students"`
	NextCursor string                 `json:"next_cursor,omitempty"`
}

type StudentCredentialPage struct {
	StudentCredentials []StudentCredentialConfig `json:"student_credentials"`
	NextCursor         string                    `json:"next_cursor,omitempty"`
}

type adminDirectoryBounds struct {
	Limit      int
	QueryLimit int
	Cursor     *adminDirectoryCursor
}

type adminDirectoryCursor struct {
	YearGroup   int    `json:"year_group"`
	DisplayName string `json:"display_name"`
	ExternalRef string `json:"external_ref"`
}

func newAdminDirectoryBounds(query AdminDirectoryPageQuery) (adminDirectoryBounds, error) {
	limit := query.Limit
	if limit <= 0 {
		limit = adminDirectoryDefaultPageLimit
	}
	if limit > adminDirectoryPageLimit {
		limit = adminDirectoryPageLimit
	}
	bounds := adminDirectoryBounds{Limit: limit, QueryLimit: limit + 1}
	if strings.TrimSpace(query.Cursor) == "" {
		return bounds, nil
	}
	cursor, err := decodeAdminDirectoryCursor(query.Cursor)
	if err != nil {
		return adminDirectoryBounds{}, err
	}
	bounds.Cursor = &cursor
	return bounds, nil
}

func encodeAdminDirectoryCursor(cursor adminDirectoryCursor) (string, error) {
	raw, err := json.Marshal(cursor)
	if err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(raw), nil
}

func decodeAdminDirectoryCursor(value string) (adminDirectoryCursor, error) {
	raw, err := base64.RawURLEncoding.DecodeString(strings.TrimSpace(value))
	if err != nil {
		return adminDirectoryCursor{}, invalidConfig("invalid admin directory cursor")
	}
	var cursor adminDirectoryCursor
	if err := json.Unmarshal(raw, &cursor); err != nil || cursor.YearGroup < 0 || strings.TrimSpace(cursor.DisplayName) == "" || strings.TrimSpace(cursor.ExternalRef) == "" {
		return adminDirectoryCursor{}, invalidConfig("invalid admin directory cursor")
	}
	return cursor, nil
}

func newStudentProfilePage(items []StudentProfileConfig, limit int) (StudentProfilePage, error) {
	page := StudentProfilePage{Students: items}
	if len(items) <= limit {
		return page, nil
	}
	page.Students = items[:limit]
	cursor, err := encodeAdminDirectoryCursor(adminDirectoryCursorFromStudent(page.Students[len(page.Students)-1]))
	if err != nil {
		return StudentProfilePage{}, err
	}
	page.NextCursor = cursor
	return page, nil
}

func newStudentCredentialPage(items []StudentCredentialConfig, limit int) (StudentCredentialPage, error) {
	page := StudentCredentialPage{StudentCredentials: items}
	if len(items) <= limit {
		return page, nil
	}
	page.StudentCredentials = items[:limit]
	cursor, err := encodeAdminDirectoryCursor(adminDirectoryCursorFromCredential(page.StudentCredentials[len(page.StudentCredentials)-1]))
	if err != nil {
		return StudentCredentialPage{}, err
	}
	page.NextCursor = cursor
	return page, nil
}

func adminDirectoryCursorFromStudent(student StudentProfileConfig) adminDirectoryCursor {
	return adminDirectoryCursor{YearGroup: student.YearGroup, DisplayName: student.DisplayName, ExternalRef: student.ExternalRef}
}

func adminDirectoryCursorFromCredential(credential StudentCredentialConfig) adminDirectoryCursor {
	return adminDirectoryCursor{YearGroup: credential.YearGroup, DisplayName: credential.DisplayName, ExternalRef: credential.StudentExternalRef}
}
