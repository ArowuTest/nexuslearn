package learning

import (
	"encoding/base64"
	"encoding/json"
	"strings"
)

const (
	adminOrganisationDefaultPageLimit = 25
	adminOrganisationPageLimit        = 100
)

// AdminOrganisationPageQuery is separate from learner and ledger cursors so
// each admin collection can evolve its own stable ordering without accepting
// a cursor minted for another data family.
type AdminOrganisationPageQuery struct {
	Limit  int
	Cursor string
}

type SchoolPage struct {
	Schools    []SchoolConfig `json:"schools"`
	NextCursor string         `json:"next_cursor,omitempty"`
}

type SchoolUserPage struct {
	SchoolUsers []SchoolUserConfig `json:"school_users"`
	NextCursor  string             `json:"next_cursor,omitempty"`
}

type ClassPage struct {
	Classes    []ClassConfig `json:"classes"`
	NextCursor string        `json:"next_cursor,omitempty"`
}

type adminOrganisationBounds struct {
	Limit      int
	QueryLimit int
	Cursor     *adminOrganisationCursor
}

type adminOrganisationCursor struct {
	Kind        string `json:"kind"`
	SchoolName  string `json:"school_name,omitempty"`
	URN         string `json:"urn,omitempty"`
	Role        string `json:"role,omitempty"`
	DisplayName string `json:"display_name,omitempty"`
	Email       string `json:"email,omitempty"`
	YearGroup   int    `json:"year_group,omitempty"`
	Name        string `json:"name,omitempty"`
	ID          string `json:"id"`
}

func newAdminOrganisationBounds(query AdminOrganisationPageQuery, kind string) (adminOrganisationBounds, error) {
	limit := query.Limit
	if limit <= 0 {
		limit = adminOrganisationDefaultPageLimit
	}
	if limit > adminOrganisationPageLimit {
		limit = adminOrganisationPageLimit
	}
	bounds := adminOrganisationBounds{Limit: limit, QueryLimit: limit + 1}
	if strings.TrimSpace(query.Cursor) == "" {
		return bounds, nil
	}
	cursor, err := decodeAdminOrganisationCursor(query.Cursor, kind)
	if err != nil {
		return adminOrganisationBounds{}, err
	}
	bounds.Cursor = &cursor
	return bounds, nil
}

func encodeAdminOrganisationCursor(cursor adminOrganisationCursor) (string, error) {
	raw, err := json.Marshal(cursor)
	if err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(raw), nil
}

func decodeAdminOrganisationCursor(value string, kind string) (adminOrganisationCursor, error) {
	raw, err := base64.RawURLEncoding.DecodeString(strings.TrimSpace(value))
	if err != nil {
		return adminOrganisationCursor{}, invalidConfig("invalid admin organisation cursor")
	}
	var cursor adminOrganisationCursor
	if err := json.Unmarshal(raw, &cursor); err != nil || cursor.Kind != kind || strings.TrimSpace(cursor.ID) == "" {
		return adminOrganisationCursor{}, invalidConfig("invalid admin organisation cursor")
	}
	switch kind {
	case "schools":
		if strings.TrimSpace(cursor.SchoolName) == "" {
			return adminOrganisationCursor{}, invalidConfig("invalid admin organisation cursor")
		}
	case "school_users":
		if strings.TrimSpace(cursor.Role) == "" || strings.TrimSpace(cursor.DisplayName) == "" {
			return adminOrganisationCursor{}, invalidConfig("invalid admin organisation cursor")
		}
	case "classes":
		if strings.TrimSpace(cursor.Name) == "" || cursor.YearGroup < 1 || cursor.YearGroup > 7 {
			return adminOrganisationCursor{}, invalidConfig("invalid admin organisation cursor")
		}
	default:
		return adminOrganisationCursor{}, invalidConfig("invalid admin organisation cursor")
	}
	return cursor, nil
}

func newSchoolPage(items []SchoolConfig, limit int) (SchoolPage, error) {
	page := SchoolPage{Schools: items}
	if len(items) <= limit {
		return page, nil
	}
	page.Schools = items[:limit]
	cursor, err := encodeAdminOrganisationCursor(adminOrganisationCursorFromSchool(page.Schools[len(page.Schools)-1]))
	if err != nil {
		return SchoolPage{}, err
	}
	page.NextCursor = cursor
	return page, nil
}

func newSchoolUserPage(items []SchoolUserConfig, limit int) (SchoolUserPage, error) {
	page := SchoolUserPage{SchoolUsers: items}
	if len(items) <= limit {
		return page, nil
	}
	page.SchoolUsers = items[:limit]
	cursor, err := encodeAdminOrganisationCursor(adminOrganisationCursorFromSchoolUser(page.SchoolUsers[len(page.SchoolUsers)-1]))
	if err != nil {
		return SchoolUserPage{}, err
	}
	page.NextCursor = cursor
	return page, nil
}

func newClassPage(items []ClassConfig, limit int) (ClassPage, error) {
	page := ClassPage{Classes: items}
	if len(items) <= limit {
		return page, nil
	}
	page.Classes = items[:limit]
	cursor, err := encodeAdminOrganisationCursor(adminOrganisationCursorFromClass(page.Classes[len(page.Classes)-1]))
	if err != nil {
		return ClassPage{}, err
	}
	page.NextCursor = cursor
	return page, nil
}

func adminOrganisationCursorFromSchool(school SchoolConfig) adminOrganisationCursor {
	return adminOrganisationCursor{Kind: "schools", SchoolName: school.Name, URN: school.URN, ID: school.ID}
}

func adminOrganisationCursorFromSchoolUser(user SchoolUserConfig) adminOrganisationCursor {
	return adminOrganisationCursor{
		Kind: "school_users", SchoolName: user.SchoolName, Role: user.Role,
		DisplayName: user.DisplayName, Email: user.Email, ID: user.ID,
	}
}

func adminOrganisationCursorFromClass(classConfig ClassConfig) adminOrganisationCursor {
	return adminOrganisationCursor{Kind: "classes", SchoolName: classConfig.SchoolName, YearGroup: classConfig.YearGroup, Name: classConfig.Name, ID: classConfig.ID}
}
