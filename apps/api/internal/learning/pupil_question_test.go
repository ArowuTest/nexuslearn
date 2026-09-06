package learning

import (
	"encoding/json"
	"testing"
)

func TestPupilPlannerHasSelectionShapeWithoutPrivateCards(t *testing.T) {
	q := QuestionConfig{Format: "investigation-planner", ExpectedAnswer: map[string]any{"value": []any{"change height", "measure distance"}}, Body: map[string]any{"planner_cards": []any{"change height", "change two things", "measure distance"}}}
	public := PupilQuestion(q)
	if public.ResponseKind != "sequence" || public.SelectionCount != 2 {
		t.Fatalf("planner cannot select its full response: %+v", public)
	}
	if len(public.Body["planner_cards"].([]any)) != 3 {
		t.Fatal("distractors were lost")
	}
}

func TestPupilProjectionPreservesStimuliAndCanonicalSnapshot(t *testing.T) {
	q := QuestionConfig{Format: "error-analysis", ExpectedAnswer: map[string]any{"value": "second step"},
		Body: map[string]any{"shown_answer": 5, "shown_steps": []any{"2+2=5"}, "choices": []any{"first step", "second step"}, "table": []any{map[string]any{"label": "A", "value": 2, "solution": "hidden"}}, "audio_assets": map[string]any{"phoneme-a": "audio-a"}, "correct_state": "hidden", "method_integrity": map[string]any{"expected_answer": "hidden"}}}
	q.Body["sounds"] = []any{"a"}
	before, _ := json.Marshal(q)
	p := PupilQuestion(q)
	if p.Body["shown_answer"] != 5 || len(p.Body["shown_steps"].([]any)) != 1 {
		t.Fatal("incorrect worked example removed from task")
	}
	if p.Body["audio_assets"].(map[string]any)["phoneme-a"] != "audio-a" {
		t.Fatal("produced audio reference lost")
	}
	if p.Body["correct_state"] != nil || p.Body["method_integrity"] != nil {
		t.Fatal("marking metadata leaked")
	}
	row := p.Body["table"].([]any)[0].(map[string]any)
	if row["solution"] != nil || row["value"] != 2 {
		t.Fatalf("invalid public table: %v", row)
	}
	row["value"] = 99
	after, _ := json.Marshal(q)
	if string(before) != string(after) {
		t.Fatal("projection mutated canonical grading snapshot")
	}
}

func TestPupilNestedObjectsDenyUnrecognisedAuthorFields(t *testing.T) {
	q := QuestionConfig{Body: map[string]any{"model": map[string]any{"label": "Diagram", "explanation": "secret", "private_author_note": "secret", "new_private_field": "secret"}}}
	p := PupilQuestion(q)
	model := p.Body["model"].(map[string]any)
	if len(model) != 1 || model["label"] != "Diagram" {
		t.Fatalf("nested author fields escaped: %v", model)
	}
}
