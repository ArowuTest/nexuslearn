package learning

import (
	"encoding/json"
	"errors"
	"testing"
)

func TestCanonicalResponseContracts(t *testing.T) {
	tests := []struct {
		name, format, expected, kind, value string
		correct                             bool
		wantErr                             error
	}{
		{"decimal survives", "number-input", `{"value":1.25}`, "number", `1.25`, true, nil},
		{"decimal not truncated", "number-input", `{"value":1.25}`, "number", `1`, false, nil},
		{"numeric equivalent", "number-input", `{"value":1.25}`, "number", `1.250`, true, nil},
		{"null is not zero", "number-input", `{"value":0}`, "number", `null`, false, ErrInvalidResponse},
		{"wrong kind", "number-input", `{"value":5}`, "text", `"5"`, false, ErrInvalidResponse},
		{"text normalization", "audio-choice", `{"value":"cat"}`, "text", `" Cat "`, true, nil},
		{"no fuzzy grading", "audio-choice", `{"value":"cat"}`, "text", `"cats"`, false, nil},
		{"sequence ordered", "sentence-build", `{"sequence":["a","b"]}`, "sequence", `["b","a"]`, false, nil},
		{"sequence equal", "sentence-build", `{"sequence":["a","b"]}`, "sequence", `["a","b"]`, true, nil},
		{"coordinate typed", "coordinate-plot", `{"value":[1.5,-2]}`, "sequence", `[1.5,-2]`, true, nil},
		{"mapping independent keys", "fraction-wall", `{"value":{"numerator":1,"denominator":2}}`, "mapping", `{"denominator":2,"numerator":1}`, true, nil},
		{"mapping missing field", "fraction-wall", `{"value":{"numerator":1,"denominator":2}}`, "mapping", `{"numerator":1}`, false, nil},
		{"mapping extra field", "fraction-wall", `{"value":{"numerator":1}}`, "mapping", `{"numerator":1,"x":2}`, false, nil},
		{"word build joins letters", "word-build", `{"value":["c","a","t"]}`, "text", `"cat"`, true, nil},
		{"rubric is not binary evidence", "trace-path", `{"rubric":["follows_path"]}`, "text", `"trace-path-complete"`, false, ErrQuestionNeedsReview},
		{"letter token is not tracing evidence", "trace-path", `{"value":"c"}`, "text", `"c"`, false, ErrQuestionNeedsReview},
		{"moderated answers stay gated", "teach-back", `{"value":"cat","moderation_required":true}`, "text", `"cat"`, false, ErrQuestionNeedsReview},
		{"semantic review marker cannot award exact match", "evidence-link", `{"value":"Mina is cautious","accepted_semantic_equivalents":"teacher_review_required"}`, "text", `"Mina is cautious"`, false, ErrQuestionNeedsReview},
		{"semantic review marker cannot penalise alternative", "evidence-link", `{"value":"Mina is cautious","accepted_semantic_equivalents":"teacher_review_required"}`, "text", `"Mina is being careful"`, false, ErrQuestionNeedsReview},
		{"unsupported semantic policy fails closed", "evidence-link", `{"value":"Mina is cautious","accepted_semantic_equivalents":["Mina is careful"]}`, "text", `"Mina is cautious"`, false, ErrQuestionNeedsReview},
		{"authored controls unordered", "fair-test-plan", `{"change":"area","measure":"time","keep_same":["mass","height"]}`, "mapping", `{"measure":"time","keep_same":["height","mass"],"change":"area"}`, true, nil},
		{"duplicate controls rejected", "fair-test-plan", `{"change":"area","measure":"time","keep_same":["mass","height"]}`, "mapping", `{"measure":"time","keep_same":["mass","mass"],"change":"area"}`, false, nil},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			q := QuestionConfig{ID: "q", ObjectiveID: "o", Format: tt.format}
			if err := json.Unmarshal([]byte(tt.expected), &q.ExpectedAnswer); err != nil {
				t.Fatal(err)
			}
			a := Attempt{QuestionID: "q", ObjectiveID: "o", Format: tt.format, Expected: 99, ExpectedText: "forged", Response: &AnswerResponse{Kind: tt.kind, Value: json.RawMessage(tt.value)}}
			a.QuestionVersion = questionContractVersion(q)
			_, result, err := gradeCanonicalAttempt(a, q)
			if !errors.Is(err, tt.wantErr) {
				t.Fatalf("err=%v want=%v", err, tt.wantErr)
			}
			if err == nil && result.Correct != tt.correct {
				t.Fatalf("correct=%v want=%v", result.Correct, tt.correct)
			}
		})
	}
}

func TestTypedAnswerRequiresServedVersion(t *testing.T) {
	q := QuestionConfig{ID: "q", ObjectiveID: "o", Format: "number-input", ExpectedAnswer: map[string]any{"value": float64(5)}}
	a := Attempt{QuestionID: "q", ObjectiveID: "o", Response: &AnswerResponse{Kind: "number", Value: json.RawMessage(`5`)}}
	if _, _, err := gradeCanonicalAttempt(a, q); !errors.Is(err, ErrQuestionVersion) {
		t.Fatalf("unversioned typed evidence allowed: %v", err)
	}
}

func TestTypedSequenceNumericTilesRemainCompatible(t *testing.T) {
	q := QuestionConfig{ID: "q", ObjectiveID: "o", Format: "sequence-build", ExpectedAnswer: map[string]any{"value": []any{float64(1), float64(2)}}}
	a := Attempt{QuestionID: "q", ObjectiveID: "o", QuestionVersion: questionContractVersion(q), Response: &AnswerResponse{Kind: "sequence", Value: json.RawMessage(`["1","2"]`)}}
	if _, result, err := gradeCanonicalAttempt(a, q); err != nil || !result.Correct {
		t.Fatalf("numeric tiles lost: %+v %v", result, err)
	}
}

func TestCanonicalGradingNeverMutatesEvidenceSnapshot(t *testing.T) {
	q := QuestionConfig{ID: "q", ObjectiveID: "o", Format: "sequence-build", ExpectedAnswer: map[string]any{"value": []any{float64(1), float64(2)}}}
	before, _ := json.Marshal(q)
	a := Attempt{QuestionID: "q", ObjectiveID: "o", QuestionVersion: questionContractVersion(q), Response: &AnswerResponse{Kind: "sequence", Value: json.RawMessage(`["1","2"]`)}}
	marked, _, err := gradeCanonicalAttempt(a, q)
	if err != nil {
		t.Fatal(err)
	}
	after, _ := json.Marshal(q)
	if string(before) != string(after) {
		t.Fatal("grading mutated the canonical question snapshot")
	}
	if marked.QuestionVersion != questionContractVersion(q) {
		t.Fatal("persisted version differs from served version")
	}
}

func TestLegacyNumericEvidenceIsRetiredEvenWithExplicitZero(t *testing.T) {
	q := QuestionConfig{ID: "q", ObjectiveID: "o", Format: "number-input", ExpectedAnswer: map[string]any{"value": float64(0)}}
	for _, suffix := range []string{"", `,"given":null`, `,"given":0`} {
		var a Attempt
		if err := json.Unmarshal([]byte(`{"question_id":"q","objective_id":"o"`+suffix+`}`), &a); err != nil {
			t.Fatal(err)
		}
		_, result, err := gradeCanonicalAttempt(a, q)
		if !errors.Is(err, ErrQuestionVersion) || result.Correct {
			t.Fatalf("retired numeric evidence accepted %s: %+v %v", suffix, result, err)
		}
	}
}

func TestLegacyDecodingDoesNotChangeHistoricalReplayHash(t *testing.T) {
	var decoded Attempt
	if err := json.Unmarshal([]byte(`{"question_id":"q","objective_id":"o","given":0}`), &decoded); err != nil {
		t.Fatal(err)
	}
	old := Attempt{QuestionID: "q", ObjectiveID: "o", Given: 0}
	oldHash, _ := requestHash(old)
	newHash, _ := requestHash(decoded)
	if newHash != oldHash {
		t.Fatal("decoding changed existing retry hash")
	}
}

func TestCanonicalLegacyKeyCannotChangeResponseKind(t *testing.T) {
	q := QuestionConfig{ID: "q", ObjectiveID: "o", Format: "number-input", ExpectedAnswer: map[string]any{"value": float64(5)}}
	a := Attempt{QuestionID: "q", ObjectiveID: "o", Format: "number-input", Given: 99, Expected: 99, GivenText: "forged", ExpectedText: "forged"}
	a.QuestionVersion = questionContractVersion(q)
	a.Response = &AnswerResponse{Kind: "number", Value: json.RawMessage(`99`)}
	_, result, err := gradeCanonicalAttempt(a, q)
	if err != nil || result.Correct {
		t.Fatalf("legacy forged keys trusted: %+v %v", result, err)
	}
}
