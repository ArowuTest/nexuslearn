package learning

import (
	"encoding/base64"
	"encoding/json"
	"strings"
	"time"
)

const (
	adminContentDefaultPageLimit = 25
	adminContentPageLimit        = 100
)

// AdminContentPageQuery keeps each content directory bounded while allowing
// the editor to resume from a stable, opaque keyset cursor.
type AdminContentPageQuery struct {
	Limit  int
	Cursor string
}

type ActivityPage struct {
	Activities []ActivityConfig `json:"activities"`
	NextCursor string           `json:"next_cursor,omitempty"`
}

type QuestionPage struct {
	Questions  []QuestionConfig `json:"questions"`
	NextCursor string           `json:"next_cursor,omitempty"`
}

type RewardRulePage struct {
	RewardRules []RewardRule `json:"reward_rules"`
	NextCursor  string       `json:"next_cursor,omitempty"`
}

type ObjectivePage struct {
	Objectives []Objective `json:"objectives"`
	NextCursor string      `json:"next_cursor,omitempty"`
}

type adminContentBounds struct {
	Limit      int
	QueryLimit int
	Cursor     *adminContentCursor
}

type adminContentCursor struct {
	Kind      string `json:"kind"`
	UpdatedAt string `json:"updated_at,omitempty"`
	Year      int    `json:"year,omitempty"`
	Subject   string `json:"subject,omitempty"`
	Strand    string `json:"strand,omitempty"`
	Topic     string `json:"topic,omitempty"`
	ID        string `json:"id"`
}

func newAdminContentBounds(query AdminContentPageQuery, kind string) (adminContentBounds, error) {
	limit := query.Limit
	if limit <= 0 {
		limit = adminContentDefaultPageLimit
	}
	if limit > adminContentPageLimit {
		limit = adminContentPageLimit
	}
	bounds := adminContentBounds{Limit: limit, QueryLimit: limit + 1}
	if strings.TrimSpace(query.Cursor) == "" {
		return bounds, nil
	}
	cursor, err := decodeAdminContentCursor(query.Cursor, kind)
	if err != nil {
		return adminContentBounds{}, err
	}
	bounds.Cursor = &cursor
	return bounds, nil
}

func encodeAdminContentCursor(cursor adminContentCursor) (string, error) {
	raw, err := json.Marshal(cursor)
	if err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(raw), nil
}

func decodeAdminContentCursor(value string, kind string) (adminContentCursor, error) {
	raw, err := base64.RawURLEncoding.DecodeString(strings.TrimSpace(value))
	if err != nil {
		return adminContentCursor{}, invalidConfig("invalid admin content cursor")
	}
	var cursor adminContentCursor
	if err := json.Unmarshal(raw, &cursor); err != nil || cursor.Kind != kind || strings.TrimSpace(cursor.ID) == "" {
		return adminContentCursor{}, invalidConfig("invalid admin content cursor")
	}
	if kind == "objectives" {
		if cursor.Year < 1 || cursor.Year > 7 || strings.TrimSpace(cursor.Subject) == "" || strings.TrimSpace(cursor.Strand) == "" || strings.TrimSpace(cursor.Topic) == "" {
			return adminContentCursor{}, invalidConfig("invalid admin content cursor")
		}
		return cursor, nil
	}
	if strings.TrimSpace(cursor.UpdatedAt) == "" {
		return adminContentCursor{}, invalidConfig("invalid admin content cursor")
	}
	if _, err := time.Parse(time.RFC3339Nano, cursor.UpdatedAt); err != nil {
		return adminContentCursor{}, invalidConfig("invalid admin content cursor")
	}
	return cursor, nil
}

func newActivityPage(items []ActivityConfig, limit int) (ActivityPage, error) {
	page := ActivityPage{Activities: items}
	if len(items) <= limit {
		return page, nil
	}
	page.Activities = items[:limit]
	last := page.Activities[len(page.Activities)-1]
	cursor, err := encodeAdminContentCursor(adminContentCursor{Kind: "activities", UpdatedAt: last.UpdatedAt, ID: last.ID})
	if err != nil {
		return ActivityPage{}, err
	}
	page.NextCursor = cursor
	return page, nil
}

func newQuestionPage(items []QuestionConfig, limit int) (QuestionPage, error) {
	page := QuestionPage{Questions: items}
	if len(items) <= limit {
		return page, nil
	}
	page.Questions = items[:limit]
	last := page.Questions[len(page.Questions)-1]
	cursor, err := encodeAdminContentCursor(adminContentCursor{Kind: "questions", UpdatedAt: last.UpdatedAt, ID: last.ID})
	if err != nil {
		return QuestionPage{}, err
	}
	page.NextCursor = cursor
	return page, nil
}

func newRewardRulePage(items []RewardRule, limit int) (RewardRulePage, error) {
	page := RewardRulePage{RewardRules: items}
	if len(items) <= limit {
		return page, nil
	}
	page.RewardRules = items[:limit]
	last := page.RewardRules[len(page.RewardRules)-1]
	cursor, err := encodeAdminContentCursor(adminContentCursor{Kind: "reward_rules", UpdatedAt: last.UpdatedAt, ID: last.ID})
	if err != nil {
		return RewardRulePage{}, err
	}
	page.NextCursor = cursor
	return page, nil
}

func newObjectivePage(items []Objective, limit int) (ObjectivePage, error) {
	page := ObjectivePage{Objectives: items}
	if len(items) <= limit {
		return page, nil
	}
	page.Objectives = items[:limit]
	last := page.Objectives[len(page.Objectives)-1]
	cursor, err := encodeAdminContentCursor(adminContentCursor{
		Kind: "objectives", Year: last.Year, Subject: last.Subject,
		Strand: last.Strand, Topic: last.Topic, ID: last.ID,
	})
	if err != nil {
		return ObjectivePage{}, err
	}
	page.NextCursor = cursor
	return page, nil
}
