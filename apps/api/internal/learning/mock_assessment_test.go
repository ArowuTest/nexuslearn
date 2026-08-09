package learning

import (
	"testing"
	"time"
)

func TestMockAssessmentCursorRoundTrip(t *testing.T) {
	createdAt := time.Date(2026, time.August, 9, 9, 30, 12, 456000000, time.UTC)
	cursor := EncodeMockAssessmentCursor(createdAt, "7b20d33f-10c4-4918-b53e-b95f2c28cb7c")
	decodedAt, decodedID, err := DecodeMockAssessmentCursor(cursor)
	if err != nil {
		t.Fatal(err)
	}
	if !decodedAt.Equal(createdAt) || decodedID != "7b20d33f-10c4-4918-b53e-b95f2c28cb7c" {
		t.Fatalf("unexpected cursor round trip: %s %s", decodedAt, decodedID)
	}
}

func TestMockAssessmentSummaryCarriesCompletionEvidence(t *testing.T) {
	assessment := MockAssessment{
		ID: "mock-1", Subject: "Mathematics", YearGroup: 3, Title: "Number check",
		Status: "completed", QuestionCount: 10, AnsweredCount: 10, CorrectCount: 8,
		Score: 80, CompletedAt: "2026-07-16T10:00:00Z",
	}
	summary := assessment.Summary()
	if summary.ID != assessment.ID || summary.Status != "completed" || summary.Score != 80 {
		t.Fatalf("summary lost assessment completion evidence: %#v", summary)
	}
	if summary.QuestionCount != 10 || summary.AnsweredCount != 10 || summary.CorrectCount != 8 {
		t.Fatalf("summary counts were not preserved: %#v", summary)
	}
}

func TestClassifyMockObjectiveResultUsesHonestSampleLanguage(t *testing.T) {
	tests := []struct {
		name       string
		result     MockObjectiveResult
		wantStatus string
		wantLabel  string
		wantScore  int
	}{
		{
			name:       "not sampled",
			result:     MockObjectiveResult{QuestionCount: 2},
			wantStatus: "not_sampled",
			wantLabel:  "Not sampled in this check yet.",
			wantScore:  0,
		},
		{
			name:       "review next",
			result:     MockObjectiveResult{QuestionCount: 2, AnsweredCount: 2, CorrectCount: 0},
			wantStatus: "review_next",
			wantLabel:  "Review this next with a different explanation and supported practice.",
			wantScore:  0,
		},
		{
			name:       "practising",
			result:     MockObjectiveResult{QuestionCount: 2, AnsweredCount: 2, CorrectCount: 1},
			wantStatus: "practising",
			wantLabel:  "Partly secure in this sample. Revisit a worked example, then try a fresh question.",
			wantScore:  50,
		},
		{
			name:       "incomplete sample cannot be secure",
			result:     MockObjectiveResult{QuestionCount: 5, AnsweredCount: 4, CorrectCount: 4},
			wantStatus: "practising",
			wantLabel:  "Partly secure in this sample. Revisit a worked example, then try a fresh question.",
			wantScore:  100,
		},
		{
			name:       "secure for now",
			result:     MockObjectiveResult{QuestionCount: 5, AnsweredCount: 5, CorrectCount: 4},
			wantStatus: "secure_for_now",
			wantLabel:  "Secure in this sample for now. Keep it in spaced revision.",
			wantScore:  80,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := classifyMockObjectiveResult(tt.result)
			if got.Status != tt.wantStatus || got.Guidance != tt.wantLabel || got.Score != tt.wantScore {
				t.Fatalf("classification = %#v, want status=%q guidance=%q score=%d", got, tt.wantStatus, tt.wantLabel, tt.wantScore)
			}
		})
	}
}

func TestMockAssessmentSummaryCarriesObjectiveResults(t *testing.T) {
	objective := MockObjectiveResult{
		ObjectiveID:   "ma-y3-number-recall-3-4-8-tables",
		YearGroup:     3,
		Strand:        "Number",
		Topic:         "Multiplication and division",
		Statement:     "Recall multiplication and division facts for the 3, 4 and 8 tables.",
		QuestionCount: 2,
		AnsweredCount: 2,
		CorrectCount:  1,
	}
	assessment := MockAssessment{ObjectiveResults: []MockObjectiveResult{objective}}

	summary := assessment.Summary()
	if len(summary.ObjectiveResults) != 1 || summary.ObjectiveResults[0].Status != "practising" {
		t.Fatalf("summary lost objective guidance: %#v", summary.ObjectiveResults)
	}
}

func TestDecodeMockObjectiveResultsClassifiesPersistedCounts(t *testing.T) {
	raw := []byte(`[{"objective_id":"ma-y3-number-recall-3-4-8-tables","year_group":3,"strand":"Number","topic":"Multiplication and division","statement":"Recall multiplication facts.","question_count":3,"answered_count":3,"correct_count":1}]`)

	results, err := decodeMockObjectiveResults(raw)
	if err != nil {
		t.Fatalf("decode objective results: %v", err)
	}
	if len(results) != 1 || results[0].Status != "review_next" || results[0].Score != 33 {
		t.Fatalf("decoded results were not classified: %#v", results)
	}
}
