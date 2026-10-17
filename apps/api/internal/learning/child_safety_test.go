package learning

import "testing"

func TestChildMaySeeQuestion(t *testing.T) {
	published := QuestionConfig{Status: "published", Body: map[string]any{"prompt": "What is 2 + 2?"}}
	if !ChildMaySeeQuestion(published) {
		t.Fatal("a published seed question must stay available")
	}
	ai := QuestionConfig{Status: "published", Body: map[string]any{"ai_generated": true}}
	if ChildMaySeeQuestion(ai) {
		t.Fatal("unapproved AI content must be hidden")
	}
	held := QuestionConfig{Status: "approved", Body: map[string]any{"review_state": "pending_human_review"}}
	if ChildMaySeeQuestion(held) {
		t.Fatal("a question waiting for a person must be hidden")
	}
	released := QuestionConfig{Status: "approved", Body: map[string]any{"ai_generated": true, "human_approved": true}}
	if !ChildMaySeeQuestion(released) {
		t.Fatal("human approval must allow an otherwise AI-marked question")
	}
	draft := QuestionConfig{Status: "review", Body: map[string]any{}}
	if ChildMaySeeQuestion(draft) {
		t.Fatal("review status must stay off the child path")
	}
}
