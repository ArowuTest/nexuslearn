package learning

import "testing"

func TestBuildProgressReportUnlocksNextYearOnlyWithCrossSubjectEvidence(t *testing.T) {
	objectives := []Objective{
		{ID: "en-y3-reading", Year: 3, Subject: "English", Strand: "Reading", Topic: "Inference", Statement: "Use clues to infer meaning.", Mastery: MasteryRule{Expected: 80, Secure: 90}},
		{ID: "ma-y3-number", Year: 3, Subject: "Mathematics", Strand: "Number", Topic: "Place value", Statement: "Explain the value of each digit.", Mastery: MasteryRule{Expected: 80, Secure: 90}},
		{ID: "sc-y3-plants", Year: 3, Subject: "Science", Strand: "Plants", Topic: "Functions", Statement: "Explain what a plant needs.", Mastery: MasteryRule{Expected: 80, Secure: 90}},
		{ID: "en-y4-reading", Year: 4, Subject: "English", Strand: "Reading", Topic: "Evidence", Statement: "Select evidence for an inference.", Mastery: MasteryRule{Expected: 80, Secure: 90}},
	}
	mastery := []StudentMastery{
		{ObjectiveID: "en-y3-reading", Score: 94, EvidenceCount: 3, FormatCount: 2, EvidenceConfidence: "strong", EvidenceFreshness: "current"},
		{ObjectiveID: "ma-y3-number", Score: 92, EvidenceCount: 3, FormatCount: 2, EvidenceConfidence: "supported", EvidenceFreshness: "current"},
		{ObjectiveID: "sc-y3-plants", Score: 91, EvidenceCount: 3, FormatCount: 2, EvidenceConfidence: "supported", EvidenceFreshness: "current"},
		{ObjectiveID: "en-y4-reading", Score: 84, EvidenceCount: 2, FormatCount: 2, EvidenceConfidence: "emerging", EvidenceFreshness: "current"},
	}

	report := BuildProgressReport("ava-y3", 3, objectives, mastery)
	if !report.StretchAllowed || report.WorkingYear != 4 || report.StretchYear != 4 {
		t.Fatalf("expected cross-subject evidence to unlock Year 4 stretch, got %#v", report)
	}
	if len(report.Subjects) != 3 || len(report.Strengths) != 3 {
		t.Fatalf("expected three subject reports and strengths, got %#v", report)
	}
	if report.Subjects[0].Years[0].Year != 3 {
		t.Fatalf("expected sorted subject year rows, got %#v", report.Subjects[0].Years)
	}

	mastery[2].Score = 62
	mastery[2].EvidenceConfidence = "emerging"
	report = BuildProgressReport("ava-y3", 3, objectives, mastery)
	if report.StretchAllowed || report.WorkingYear != 3 {
		t.Fatalf("expected weak Science evidence to keep the learner on the core route, got %#v", report)
	}
}

func TestProgressReportDoesNotCallUnsampledWorkBehind(t *testing.T) {
	objectives := []Objective{{ID: "ma-y3-fractions", Year: 3, Subject: "Mathematics", Strand: "Number", Topic: "Fractions", Statement: "Recognise unit fractions.", Mastery: MasteryRule{Expected: 80, Secure: 90}}}
	report := BuildProgressReport("ava-y3", 3, objectives, nil)
	if report.StretchAllowed || len(report.Subjects) != 1 {
		t.Fatalf("expected no stretch and one visible subject, got %#v", report)
	}
	if report.Subjects[0].Status != "not_sampled" || report.Subjects[0].Years[0].Status != "not_sampled" {
		t.Fatalf("expected unsampled work to be explicit rather than behind, got %#v", report.Subjects[0])
	}
}

func TestCanStretchToYearRequiresEvidenceQuality(t *testing.T) {
	objectives := []Objective{
		{ID: "en", Year: 3, Subject: "English", Mastery: MasteryRule{Secure: 90}},
		{ID: "ma", Year: 3, Subject: "Mathematics", Mastery: MasteryRule{Secure: 90}},
	}
	mastery := []StudentMastery{
		{ObjectiveID: "en", Score: 95, EvidenceCount: 3, FormatCount: 2, EvidenceConfidence: "strong", EvidenceFreshness: "stale"},
		{ObjectiveID: "ma", Score: 95, EvidenceCount: 3, FormatCount: 2, EvidenceConfidence: "strong", EvidenceFreshness: "current"},
	}
	if CanStretchToYear(3, objectives, mastery) {
		t.Fatal("stale evidence must not unlock a next-year stretch")
	}
}
