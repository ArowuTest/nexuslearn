package learning

import (
	"encoding/json"
	"errors"
	"testing"
)

func TestNewAttemptsRequireTypedVersionedEvidence(t *testing.T) {
	q := QuestionConfig{ID: "q", ObjectiveID: "o", Format: "number-input", ExpectedAnswer: map[string]any{"value": float64(0)}}
	for _, tc := range []struct {
		name     string
		version  string
		response *AnswerResponse
		want     error
	}{
		{"legacy zero cannot earn mastery", "", nil, ErrQuestionVersion},
		{"version alone cannot revive legacy grading", questionContractVersion(q), nil, ErrInvalidResponse},
		{"typed evidence still needs served version", "", &AnswerResponse{Kind: "number", Value: json.RawMessage(`0`)}, ErrQuestionVersion},
	} {
		t.Run(tc.name, func(t *testing.T) {
			a := Attempt{QuestionID: "q", ObjectiveID: "o", QuestionVersion: tc.version, Response: tc.response, Given: 0, Expected: 0}
			_, result, err := gradeCanonicalAttempt(a, q)
			if !errors.Is(err, tc.want) || result.MasteryGain != 0 {
				t.Fatalf("retired submission marked: result=%+v err=%v want=%v", result, err, tc.want)
			}
		})
	}
}
