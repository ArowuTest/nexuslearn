package learning

import (
	"encoding/json"
	"errors"
	"strings"
	"testing"
)

func TestAuthoredMarkingPolicies(t *testing.T) {
	for _, tc := range []struct {
		name, expected, kind, value string
		correct                     bool
		wantErr                     error
	}{
		{"exact alternative", `{"value":"colour","marking_policy":{"version":1,"mode":"exact","accepted_values":["color"]}}`, "text", `"color"`, true, nil},
		{"not fuzzy", `{"value":"colour","marking_policy":{"version":1,"mode":"exact","accepted_values":["color"]}}`, "text", `"colur"`, false, nil},
		{"capital required", `{"value":"London","marking_policy":{"version":1,"mode":"exact","case_sensitive":true}}`, "text", `"london"`, false, nil},
		{"capital correct", `{"value":"London","marking_policy":{"version":1,"mode":"exact","case_sensitive":true}}`, "text", `" London "`, true, nil},
		{"decimal tolerance boundary", `{"value":0.3,"marking_policy":{"version":1,"mode":"numeric","absolute_tolerance":0.1}}`, "number", `0.4`, true, nil},
		{"outside tolerance", `{"value":0.3,"marking_policy":{"version":1,"mode":"numeric","absolute_tolerance":0.1}}`, "number", `0.400001`, false, nil},
		{"no float rounding into boundary", `{"value":0.3,"marking_policy":{"version":1,"mode":"numeric","absolute_tolerance":0.1}}`, "number", `0.40000000000000001`, false, nil},
		{"authored tolerance not rounded", `{"value":0.3,"marking_policy":{"version":1,"mode":"numeric","absolute_tolerance":0.099999999999999999}}`, "number", `0.4`, false, nil},
		{"authored target not rounded", `{"value":0.30000000000000001,"marking_policy":{"version":1,"mode":"numeric","absolute_tolerance":0}}`, "number", `0.3`, false, nil},
		{"negative authored underflow", `{"value":0,"marking_policy":{"version":1,"mode":"numeric","absolute_tolerance":-1e-400}}`, "number", `0`, false, ErrQuestionNeedsReview},
		{"version not rounded", `{"value":"cat","marking_policy":{"version":1.00000000000000001,"mode":"exact"}}`, "text", `"cat"`, false, ErrQuestionNeedsReview},
		{"lower boundary", `{"value":-0.3,"marking_policy":{"version":1,"mode":"numeric","absolute_tolerance":0.1}}`, "number", `-4e-1`, true, nil},
		{"zero tolerance", `{"value":0.3,"marking_policy":{"version":1,"mode":"numeric","absolute_tolerance":0}}`, "number", `0.30000000000000001`, false, nil},
		{"bounded learner exponent", `{"value":0,"marking_policy":{"version":1,"mode":"numeric","absolute_tolerance":1}}`, "number", `1e-999999999`, false, ErrInvalidResponse},
		{"unsupported authored exponent", `{"value":1e-320,"marking_policy":{"version":1,"mode":"numeric","absolute_tolerance":1}}`, "number", `0`, false, ErrQuestionNeedsReview},
		{"unsupported tolerance exponent", `{"value":1,"marking_policy":{"version":1,"mode":"numeric","absolute_tolerance":1e-320}}`, "number", `1`, false, ErrQuestionNeedsReview},
		{"no inferred tolerance", `{"value":0.3}`, "number", `0.30001`, false, nil},
		{"authored evidence span", `{"value":"stopped, and read the sign for a third time","accepted_spans":["stopped","read the sign for a third time"]}`, "text", `"stopped"`, true, nil},
		{"no arbitrary span", `{"value":"stopped, and read the sign for a third time","accepted_spans":["stopped"]}`, "text", `"read"`, false, nil},
		{"oral exception not written punctuation", `{"value":"the small, spotted dog","acceptable_spoken_without_punctuation":"the small spotted dog"}`, "text", `"the small spotted dog"`, false, nil},
		{"semantic gate wins", `{"value":"cat","accepted_semantic_equivalents":"teacher_review_required","marking_policy":{"version":1,"mode":"exact"}}`, "text", `"cat"`, false, ErrQuestionNeedsReview},
		{"unknown version", `{"value":"cat","marking_policy":{"version":2,"mode":"exact"}}`, "text", `"cat"`, false, ErrQuestionNeedsReview},
		{"unknown mode", `{"value":"cat","marking_policy":{"version":1,"mode":"semantic"}}`, "text", `"cat"`, false, ErrQuestionNeedsReview},
		{"unknown field", `{"value":"cat","marking_policy":{"version":1,"mode":"exact","fuzzy":true}}`, "text", `"cat"`, false, ErrQuestionNeedsReview},
		{"null policy", `{"value":"cat","marking_policy":null}`, "text", `"cat"`, false, ErrQuestionNeedsReview},
		{"wrong alternative type", `{"value":"cat","marking_policy":{"version":1,"mode":"exact","accepted_values":[2]}}`, "text", `"cat"`, false, ErrQuestionNeedsReview},
		{"empty alternatives", `{"value":"cat","marking_policy":{"version":1,"mode":"exact","accepted_values":[]}}`, "text", `"cat"`, false, ErrQuestionNeedsReview},
		{"null alternative", `{"value":"cat","marking_policy":{"version":1,"mode":"exact","accepted_values":[null]}}`, "text", `"cat"`, false, ErrQuestionNeedsReview},
		{"invalid case flag", `{"value":"cat","marking_policy":{"version":1,"mode":"exact","case_sensitive":"true"}}`, "text", `"cat"`, false, ErrQuestionNeedsReview},
		{"numeric case flag", `{"value":3,"marking_policy":{"version":1,"mode":"exact","case_sensitive":false}}`, "number", `3`, false, ErrQuestionNeedsReview},
		{"sequence alternative", `{"sequence":["first","second"],"marking_policy":{"version":1,"mode":"exact","accepted_values":[[1,2]]}}`, "sequence", `["1","2"]`, true, nil},
		{"sequence order retained", `{"sequence":["first","second"],"marking_policy":{"version":1,"mode":"exact","accepted_values":[[1,2]]}}`, "sequence", `["2","1"]`, false, nil},
		{"mapping case retained", `{"value":{"city":"Paris"},"marking_policy":{"version":1,"mode":"exact","case_sensitive":true,"accepted_values":[{"city":"London"}]}}`, "mapping", `{"city":"london"}`, false, nil},
		{"mapping alternative", `{"value":{"city":"Paris"},"marking_policy":{"version":1,"mode":"exact","case_sensitive":true,"accepted_values":[{"city":"London"}]}}`, "mapping", `{"city":"London"}`, true, nil},
		{"negative tolerance", `{"value":3,"marking_policy":{"version":1,"mode":"numeric","absolute_tolerance":-1}}`, "number", `3`, false, ErrQuestionNeedsReview},
		{"missing tolerance", `{"value":3,"marking_policy":{"version":1,"mode":"numeric"}}`, "number", `3`, false, ErrQuestionNeedsReview},
		{"numeric policy on text", `{"value":"3","marking_policy":{"version":1,"mode":"numeric","absolute_tolerance":1}}`, "text", `"3"`, false, ErrQuestionNeedsReview},
		{"ambiguous span and policy", `{"value":"cat","accepted_spans":["cat"],"marking_policy":{"version":1,"mode":"exact"}}`, "text", `"cat"`, false, ErrQuestionNeedsReview},
	} {
		t.Run(tc.name, func(t *testing.T) {
			q := QuestionConfig{ID: "q", ObjectiveID: "o", Format: "text-choice"}
			if err := json.Unmarshal([]byte(tc.expected), &q.ExpectedAnswer); err != nil {
				t.Fatal(err)
			}
			if tc.kind == "number" {
				q.Format = "number-input"
			}
			a := Attempt{QuestionID: q.ID, ObjectiveID: q.ObjectiveID, QuestionVersion: questionContractVersion(q), Response: &AnswerResponse{Kind: tc.kind, Value: json.RawMessage(tc.value)}}
			_, result, err := gradeCanonicalAttempt(a, q)
			if !errors.Is(err, tc.wantErr) || result.Correct != tc.correct {
				t.Fatalf("result=%+v err=%v want=%v correct=%v", result, err, tc.wantErr, tc.correct)
			}
			public := PupilQuestion(q)
			if errors.Is(tc.wantErr, ErrQuestionNeedsReview) && public.ResponseKind != "review" {
				t.Fatalf("unsupported policy presented as answerable: %+v", public)
			}
			if !errors.Is(tc.wantErr, ErrQuestionNeedsReview) && public.ResponseKind != tc.kind {
				t.Fatalf("supported policy has wrong response kind: %+v", public)
			}
			raw, _ := json.Marshal(public)
			for _, key := range []string{"marking_policy", "accepted_values", "accepted_spans", "expected_answer"} {
				if strings.Contains(string(raw), key) {
					t.Fatalf("private marking data leaked: %s", raw)
				}
			}
		})
	}
}

func TestAuthoredAlternativeMatchesPublicCardinality(t *testing.T) {
	q := QuestionConfig{ID: "q", Format: "investigation-planner", Body: map[string]any{"planner_cards": []any{"A", "B", "C"}}}
	if err := json.Unmarshal([]byte(`{"sequence":["A","B"],"marking_policy":{"version":1,"mode":"exact","accepted_values":[["C"]]}}`), &q.ExpectedAnswer); err != nil {
		t.Fatal(err)
	}
	if got := PupilQuestion(q); got.ResponseKind != "review" {
		t.Fatalf("unreachable alternative offered to pupil: %+v", got)
	}
	if _, _, err := gradeCanonicalAttempt(Attempt{QuestionID: q.ID, QuestionVersion: questionContractVersion(q), Response: &AnswerResponse{Kind: "sequence", Value: json.RawMessage(`["C"]`)}}, q); !errors.Is(err, ErrQuestionNeedsReview) {
		t.Fatalf("unreachable alternative marked: %v", err)
	}
}

func TestAuthoredPolicyResourceBounds(t *testing.T) {
	for _, values := range [][]any{make([]any, 33), {strings.Repeat("a", 16385)}} {
		if validAlternatives(values, "text") {
			t.Fatal("oversized alternatives accepted")
		}
	}
	for _, raw := range []string{"1e-999999999", "1e309", strings.Repeat("1", 129)} {
		if _, ok := boundedDecimal(raw); ok {
			t.Fatalf("unbounded decimal accepted: %s", raw)
		}
	}
}
