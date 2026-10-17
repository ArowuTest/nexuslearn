package learning

import "strings"

// ChildMaySeeQuestion is the production gate for a question a child can be shown.
// Seed questions that are live, published or approved stay available.
// Anything still marked as machine-written or waiting for a person is hidden,
// unless a person has already recorded human_approved on that question.
func ChildMaySeeQuestion(question QuestionConfig) bool {
	switch strings.ToLower(strings.TrimSpace(question.Status)) {
	case "live", "published", "approved":
	default:
		return false
	}
	if question.Body == nil {
		return true
	}
	if questionFlag(question.Body, "human_approved") || questionFlag(question.Body, "human_review_approved") {
		return true
	}
	if questionFlag(question.Body, "ai_generated") || questionFlag(question.Body, "review_candidate") || questionFlag(question.Body, "ai_only") {
		return false
	}
	switch strings.ToLower(strings.TrimSpace(questionText(question.Body, "origin"))) {
	case "ai", "llm":
		return false
	}
	switch strings.ToLower(strings.TrimSpace(questionText(question.Body, "review_state"))) {
	case "review_candidate", "technical_ready_human_hold", "ai_approved", "pending_human_review":
		return false
	}
	return true
}

func questionFlag(body map[string]any, key string) bool {
	value, ok := body[key]
	if !ok || value == nil {
		return false
	}
	switch typed := value.(type) {
	case bool:
		return typed
	case string:
		switch strings.ToLower(strings.TrimSpace(typed)) {
		case "1", "true", "yes", "on":
			return true
		}
	}
	return false
}

func questionText(body map[string]any, key string) string {
	value, ok := body[key]
	if !ok || value == nil {
		return ""
	}
	text, ok := value.(string)
	if !ok {
		return ""
	}
	return text
}
