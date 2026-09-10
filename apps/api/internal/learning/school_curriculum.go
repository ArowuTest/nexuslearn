package learning

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"strings"
	"unicode"
	"unicode/utf8"

	"github.com/jackc/pgx/v5"
)

const (
	DefaultSchoolCurriculumLimit = 12
	MaxSchoolCurriculumLimit     = 50
)

// SchoolCurriculumRepository is optional: private school reads must not fall
// back to the unbounded administrative objective directory.
type SchoolCurriculumRepository interface {
	ListSchoolCurriculumObjectives(context.Context, string, SchoolCurriculumQuery) (SchoolCurriculumPage, error)
}

type SchoolCurriculumQuery struct {
	Year    int
	Subject string
	Query   string
	Limit   int
	Cursor  string
}

// SchoolCurriculumObjective deliberately excludes child data, answers, marking
// policy, prerequisites and misconceptions. Selection is guidance, not approval.
type SchoolCurriculumObjective struct {
	ID              string `json:"id"`
	Year            int    `json:"year"`
	Subject         string `json:"subject"`
	Strand          string `json:"strand"`
	Topic           string `json:"topic"`
	Statement       string `json:"statement"`
	TeacherEvidence string `json:"teacher_evidence"`
}

type SchoolCurriculumPage struct {
	Year       int                         `json:"year"`
	Subject    string                      `json:"subject"`
	Query      string                      `json:"query"`
	Limit      int                         `json:"limit"`
	ReleaseID  string                      `json:"release_id"`
	Objectives []SchoolCurriculumObjective `json:"objectives"`
	HasMore    bool                        `json:"has_more"`
	NextCursor string                      `json:"next_cursor"`
}

var _ SchoolCurriculumRepository = (*PostgresRepository)(nil)

// Only the immutable objective ID is a position; labels never order pages.
// Cursors are not authority: school membership is rechecked by the handler.
type schoolCurriculumCursor struct {
	Version     int    `json:"v"`
	SchoolURN   string `json:"school_urn"`
	Year        int    `json:"year"`
	Subject     string `json:"subject"`
	Query       string `json:"query"`
	ReleaseID   string `json:"release_id"`
	ObjectiveID string `json:"objective_id"`
}

// PrepareSchoolCurriculumQuery also lets HTTP reject malformed cursors before
// invoking an optional repository capability. The repository validates again
// for direct callers, then checks the release binding before querying metadata.
func PrepareSchoolCurriculumQuery(schoolURN string, query SchoolCurriculumQuery) (SchoolCurriculumQuery, error) {
	prepared, _, err := prepareSchoolCurriculumQuery(schoolURN, query)
	return prepared, err
}

func prepareSchoolCurriculumQuery(schoolURN string, query SchoolCurriculumQuery) (SchoolCurriculumQuery, schoolCurriculumCursor, error) {
	invalid := func() (SchoolCurriculumQuery, schoolCurriculumCursor, error) {
		return SchoolCurriculumQuery{}, schoolCurriculumCursor{}, invalidConfig("invalid school curriculum query")
	}
	if !schoolCurriculumKey(schoolURN) || query.Year < 1 || query.Year > 7 {
		return invalid()
	}
	if query.Limit == 0 {
		query.Limit = DefaultSchoolCurriculumLimit
	}
	if query.Limit < 1 || query.Limit > MaxSchoolCurriculumLimit {
		return invalid()
	}
	switch query.Subject {
	case "", "all":
		query.Subject = ""
	case "English", "Mathematics", "Science":
	default:
		return invalid()
	}
	if !utf8.ValidString(query.Query) || strings.ContainsRune(query.Query, 0) {
		return invalid()
	}
	query.Query = strings.TrimSpace(query.Query)
	if utf8.RuneCountInString(query.Query) > 120 {
		return invalid()
	}
	var cursor schoolCurriculumCursor
	if query.Cursor != "" {
		var err error
		cursor, err = decodeSchoolCurriculumCursor(query.Cursor, schoolURN, query)
		if err != nil {
			return invalid()
		}
	}
	return query, cursor, nil
}

func schoolCurriculumKey(value string) bool {
	return value != "" && utf8.ValidString(value) && strings.TrimSpace(value) == value && strings.IndexFunc(value, unicode.IsControl) < 0
}

func decodeSchoolCurriculumCursor(value, schoolURN string, query SchoolCurriculumQuery) (schoolCurriculumCursor, error) {
	invalid := func() (schoolCurriculumCursor, error) {
		return schoolCurriculumCursor{}, invalidConfig("invalid school curriculum cursor")
	}
	if len(value) > 2048 {
		return invalid()
	}
	raw, err := base64.RawURLEncoding.Strict().DecodeString(value)
	if err != nil || base64.RawURLEncoding.EncodeToString(raw) != value || !utf8.Valid(raw) {
		return invalid()
	}
	var cursor schoolCurriculumCursor
	fields := map[string]any{
		"v": &cursor.Version, "school_urn": &cursor.SchoolURN,
		"year": &cursor.Year, "subject": &cursor.Subject, "query": &cursor.Query,
		"release_id": &cursor.ReleaseID, "objective_id": &cursor.ObjectiveID,
	}
	decoder := json.NewDecoder(strings.NewReader(string(raw)))
	if token, err := decoder.Token(); err != nil || token != json.Delim('{') {
		return invalid()
	}
	// Decode fields explicitly: encoding/json's ordinary struct decoder accepts
	// duplicate keys, case aliases and nulls. All seven exact fields are required.
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
	if err := decoder.Decode(new(any)); err != io.EOF || cursor.Version != 1 || cursor.SchoolURN != schoolURN || cursor.Year != query.Year || cursor.Subject != query.Subject || cursor.Query != query.Query || !schoolCurriculumKey(cursor.ReleaseID) || !schoolCurriculumKey(cursor.ObjectiveID) {
		return invalid()
	}
	return cursor, nil
}

// ListSchoolCurriculumObjectives pins the release lookup and bounded metadata
// query to one read-only snapshot. A release switch cannot mix generations within
// a response, and a stale release cursor is rejected before the catalogue query.
func (r *PostgresRepository) ListSchoolCurriculumObjectives(ctx context.Context, schoolURN string, query SchoolCurriculumQuery) (SchoolCurriculumPage, error) {
	query, cursor, err := prepareSchoolCurriculumQuery(schoolURN, query)
	if err != nil {
		return SchoolCurriculumPage{}, err
	}
	tx, err := r.db.BeginTx(ctx, pgx.TxOptions{IsoLevel: pgx.RepeatableRead, AccessMode: pgx.ReadOnly})
	if err != nil {
		return SchoolCurriculumPage{}, err
	}
	defer tx.Rollback(ctx)
	var releaseID *string
	// Keep this selector identical to ListObjectives/GetObjective.
	err = tx.QueryRow(ctx, `SELECT (
		SELECT id FROM content_releases
		WHERE channel='live' AND status='applied'
		ORDER BY applied_at DESC NULLS LAST, id DESC LIMIT 1
	)`).Scan(&releaseID)
	if err != nil {
		return SchoolCurriculumPage{}, err
	}
	page := SchoolCurriculumPage{Year: query.Year, Subject: query.Subject, Query: query.Query, Limit: query.Limit, ReleaseID: "legacy", Objectives: []SchoolCurriculumObjective{}}
	if releaseID != nil {
		// Release IDs are stored as text. Do not let a real release impersonate
		// the no-live-release sentinel and accept a cursor across that boundary.
		if *releaseID == "legacy" {
			return SchoolCurriculumPage{}, fmt.Errorf("active school curriculum release uses reserved legacy identifier")
		}
		page.ReleaseID = *releaseID
	}
	if cursor.ReleaseID != "" && cursor.ReleaseID != page.ReleaseID {
		return SchoolCurriculumPage{}, invalidConfig("school curriculum release changed; restart pagination")
	}
	args := []any{query.Year, query.Subject, query.Query, query.Limit + 1}
	where := ""
	if releaseID != nil {
		args = append(args, *releaseID)
		where += fmt.Sprintf(" AND o.content_release_id=$%d", len(args))
	}
	if cursor.ObjectiveID != "" {
		args = append(args, cursor.ObjectiveID)
		where += fmt.Sprintf(" AND o.id>$%d", len(args))
	}
	// strpos is literal, unlike LIKE: %, _ and backslash have no wildcard or
	// escape semantics. The DB returns only limit+1 rows and seven public fields.
	rows, err := tx.Query(ctx, `
		SELECT o.id,o.year_group,o.subject,o.strand,o.topic,o.statement,o.teacher_evidence
		FROM curriculum_objectives o
		WHERE o.year_group=$1 AND o.subject IN ('English','Mathematics','Science')
		  AND ($2='' OR o.subject=$2)
		  AND ($3='' OR strpos(lower(o.statement),lower($3))>0
		       OR strpos(lower(o.topic),lower($3))>0 OR strpos(lower(o.strand),lower($3))>0)
		`+where+` ORDER BY o.id LIMIT $4
	`, args...)
	if err != nil {
		return SchoolCurriculumPage{}, err
	}
	defer rows.Close()
	for rows.Next() {
		var item SchoolCurriculumObjective
		if err := rows.Scan(&item.ID, &item.Year, &item.Subject, &item.Strand, &item.Topic, &item.Statement, &item.TeacherEvidence); err != nil {
			return SchoolCurriculumPage{}, err
		}
		if len(page.Objectives) == query.Limit {
			page.HasMore = true
			continue
		}
		page.Objectives = append(page.Objectives, item)
	}
	if err := rows.Err(); err != nil {
		return SchoolCurriculumPage{}, err
	}
	rows.Close()
	if page.HasMore {
		raw, err := json.Marshal(schoolCurriculumCursor{Version: 1, SchoolURN: schoolURN, Year: query.Year, Subject: query.Subject, Query: query.Query, ReleaseID: page.ReleaseID, ObjectiveID: page.Objectives[len(page.Objectives)-1].ID})
		if err != nil {
			return SchoolCurriculumPage{}, err
		}
		page.NextCursor = base64.RawURLEncoding.EncodeToString(raw)
		if len(page.NextCursor) > 2048 {
			return SchoolCurriculumPage{}, fmt.Errorf("school curriculum cursor exceeds maximum length")
		}
	}
	if err := tx.Commit(ctx); err != nil {
		return SchoolCurriculumPage{}, err
	}
	return page, nil
}
