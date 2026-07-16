package learning

import "testing"

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
