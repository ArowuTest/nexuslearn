package learning

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"io"
	"strings"
	"unicode/utf8"
)

const (
	DefaultSchoolDirectoryLimit = 20
	MaxSchoolDirectoryLimit     = 50
)

// Optional capability: legacy repositories must not emulate bounded reads by
// loading and slicing SchoolPortal, classes, staff or credentials.
type SchoolDirectoryRepository interface {
	SchoolDirectoryOverview(context.Context, string) (SchoolDirectoryOverview, error)
	ListSchoolDirectory(context.Context, string, SchoolDirectoryQuery) (SchoolDirectoryPage, error)
}

type SchoolDirectoryQuery struct {
	Kind   string
	Limit  int
	Cursor string
	Search string
	Ref    string
}

// The sealed item union prevents accidentally returning a hydrated admin model.
type SchoolDirectoryItem interface{ schoolDirectoryItem() }

type SchoolDirectoryClass struct {
	// YearGroup zero means a legacy SQL NULL (year not set), not a teaching year.
	ID           string `json:"id"`
	Name         string `json:"name"`
	YearGroup    int    `json:"year_group"`
	StudentCount int    `json:"student_count"`
}
type SchoolDirectoryGroup struct {
	ID           string `json:"id"`
	ClassID      string `json:"class_id"`
	Name         string `json:"name"`
	Purpose      string `json:"purpose"`
	StudentCount int    `json:"student_count"`
}
type SchoolDirectoryStudent struct {
	ExternalRef string `json:"external_ref"`
	DisplayName string `json:"display_name"`
	YearGroup   int    `json:"year_group"`
}

func (SchoolDirectoryClass) schoolDirectoryItem()   {}
func (SchoolDirectoryGroup) schoolDirectoryItem()   {}
func (SchoolDirectoryStudent) schoolDirectoryItem() {}

type SchoolDirectoryPage struct {
	SchoolURN  string                `json:"school_urn"`
	Kind       string                `json:"kind"`
	Items      []SchoolDirectoryItem `json:"items"`
	NextCursor string                `json:"next_cursor,omitempty"`
}
type SchoolDirectoryCounts struct {
	Classes  int `json:"classes"`
	Groups   int `json:"groups"`
	Students int `json:"students"`
}
type SchoolDirectoryMetadata struct {
	Version            int                   `json:"version"`
	Counts             SchoolDirectoryCounts `json:"counts"`
	ClassesNextCursor  string                `json:"classes_next_cursor,omitempty"`
	GroupsNextCursor   string                `json:"groups_next_cursor,omitempty"`
	StudentsNextCursor string                `json:"students_next_cursor,omitempty"`
}
type SchoolDirectoryOverview struct {
	School    SchoolConfig             `json:"school"`
	Classes   []SchoolDirectoryClass   `json:"classes"`
	Groups    []SchoolDirectoryGroup   `json:"groups"`
	Students  []SchoolDirectoryStudent `json:"students"`
	Directory SchoolDirectoryMetadata  `json:"directory"`
}

// Identity order (class ID, then group ID for groups) survives label/year edits.
// A cursor is a position, never authority. SQL independently scopes every read.
type schoolDirectoryCursor struct {
	Version   int    `json:"v"`
	SchoolURN string `json:"school_urn"`
	Kind      string `json:"kind"`
	Search    string `json:"search"`
	Ref       string `json:"ref"`
	ID        string `json:"id"`
	ClassID   string `json:"class_id"`
}

func PrepareSchoolDirectoryQuery(urn string, query SchoolDirectoryQuery) (SchoolDirectoryQuery, error) {
	prepared, _, err := prepareSchoolDirectoryQuery(urn, query)
	return prepared, err
}

func prepareSchoolDirectoryQuery(urn string, query SchoolDirectoryQuery) (SchoolDirectoryQuery, schoolDirectoryCursor, error) {
	invalid := func() (SchoolDirectoryQuery, schoolDirectoryCursor, error) {
		return SchoolDirectoryQuery{}, schoolDirectoryCursor{}, invalidConfig("invalid school directory query or cursor")
	}
	if !schoolCurriculumKey(urn) {
		return invalid()
	}
	switch query.Kind {
	case "classes", "groups", "students":
	default:
		return invalid()
	}
	if query.Limit == 0 {
		query.Limit = DefaultSchoolDirectoryLimit
	}
	if query.Limit < 1 || query.Limit > MaxSchoolDirectoryLimit {
		return invalid()
	}
	if !utf8.ValidString(query.Search) || strings.ContainsRune(query.Search, 0) {
		return invalid()
	}
	query.Search = strings.TrimSpace(query.Search)
	if utf8.RuneCountInString(query.Search) > 100 {
		return invalid()
	}
	if query.Ref != "" {
		if len(query.Ref) > 200 || !utf8.ValidString(query.Ref) || strings.ContainsRune(query.Ref, 0) || query.Search != "" || query.Cursor != "" {
			return invalid()
		}
		switch query.Kind {
		case "classes":
			if !validUUID(query.Ref) {
				return invalid()
			}
			query.Ref = strings.ToLower(query.Ref)
		case "students":
		default:
			return invalid()
		}
	}
	var cursor schoolDirectoryCursor
	if query.Cursor != "" {
		var err error
		cursor, err = decodeSchoolDirectoryCursor(query.Cursor)
		if err != nil || cursor.SchoolURN != urn || cursor.Kind != query.Kind || cursor.Search != query.Search || cursor.Ref != query.Ref {
			return invalid()
		}
	}
	return query, cursor, nil
}

func decodeSchoolDirectoryCursor(value string) (schoolDirectoryCursor, error) {
	invalid := func() (schoolDirectoryCursor, error) {
		return schoolDirectoryCursor{}, invalidConfig("invalid school directory cursor")
	}
	if len(value) > 2048 {
		return invalid()
	}
	raw, err := base64.RawURLEncoding.Strict().DecodeString(value)
	if err != nil || base64.RawURLEncoding.EncodeToString(raw) != value || !utf8.Valid(raw) {
		return invalid()
	}
	var cursor schoolDirectoryCursor
	fields := map[string]any{"v": &cursor.Version, "school_urn": &cursor.SchoolURN, "kind": &cursor.Kind, "search": &cursor.Search, "ref": &cursor.Ref, "id": &cursor.ID, "class_id": &cursor.ClassID}
	decoder := json.NewDecoder(strings.NewReader(string(raw)))
	if token, err := decoder.Token(); err != nil || token != json.Delim('{') {
		return invalid()
	}
	// Explicit fields reject duplicate keys, case aliases, missing fields/nulls.
	for decoder.More() {
		token, err := decoder.Token()
		key, ok := token.(string)
		if err != nil || !ok {
			return invalid()
		}
		destination, ok := fields[key]
		if !ok {
			return invalid()
		}
		var value json.RawMessage
		if err := decoder.Decode(&value); err != nil || string(value) == "null" {
			return invalid()
		}
		if err := json.Unmarshal(value, destination); err != nil {
			return invalid()
		}
		delete(fields, key)
	}
	if token, err := decoder.Token(); err != nil || token != json.Delim('}') || len(fields) != 0 {
		return invalid()
	}
	if err := decoder.Decode(new(any)); err != io.EOF || cursor.Version != 1 || !validUUID(cursor.ID) {
		return invalid()
	}
	if cursor.Kind == "groups" {
		if !validUUID(cursor.ClassID) {
			return invalid()
		}
	} else if cursor.ClassID != "" {
		return invalid()
	}
	return cursor, nil
}

func encodeSchoolDirectoryCursor(cursor schoolDirectoryCursor) (string, error) {
	raw, err := json.Marshal(cursor)
	return base64.RawURLEncoding.EncodeToString(raw), err
}
