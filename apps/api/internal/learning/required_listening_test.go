package learning

import (
	"encoding/json"
	"errors"
	"testing"
)

func TestRequiredListeningCannotBeMarkedWithoutLedgerEvidence(t *testing.T) {
	for _, body := range []map[string]any{
		{"audio_required": true},
		{"audio_required": "true"},
		{"audio_required": map[string]any{"malformed": true}},
		{"audio_asset_status": "required"},
		{"audio_asset_status": "required_before_pilot"},
		{"audio_required": true, "audio_url": "https://example.test/approved.mp3", "audio_approved": true},
		{"audio_required": true, "audio_asset_id": "narration-test", "production_status": "released"},
	} {
		q := QuestionConfig{ID: "q", ObjectiveID: "o", Format: "word-build", Body: body, ExpectedAnswer: AuthoredAnswer{"value": "cat"}}
		if p := PupilQuestion(q); p.ResponseKind != "review" || p.Body["audio_required"] != true {
			t.Fatalf("required listening offered: %+v", p)
		}
		a := Attempt{QuestionID: q.ID, ObjectiveID: q.ObjectiveID, QuestionVersion: questionContractVersion(q), Response: &AnswerResponse{Kind: "text", Value: json.RawMessage(`"cat"`)}}
		if _, result, err := gradeCanonicalAttempt(a, q); !errors.Is(err, ErrQuestionNeedsReview) || result.Correct || result.MasteryGain != 0 {
			t.Fatalf("unavailable audio marked: %+v %v", result, err)
		}
	}
}

func TestOptionalNarrationDoesNotBlockVisualAssessment(t *testing.T) {
	q := QuestionConfig{Format: "word-build", Body: map[string]any{"audio_asset_id": "pending-optional", "audio_required": false}, ExpectedAnswer: AuthoredAnswer{"value": "cat"}}
	if kind, _, err := canonicalAnswer(q); err != nil || kind != "text" {
		t.Fatalf("optional narration blocked marking: %s %v", kind, err)
	}
}
