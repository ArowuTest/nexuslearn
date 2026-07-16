package learning

import (
	"sort"
	"strconv"
)

// ProgressReport is the parent/teacher-safe view of learning evidence. It
// deliberately separates sampled evidence from unsampled curriculum so a
// missing attempt is never presented as a deficit.
type ProgressReport struct {
	StudentID      string            `json:"student_id"`
	YearGroup      int               `json:"year_group"`
	WorkingYear    int               `json:"working_year"`
	StretchYear    int               `json:"stretch_year"`
	StretchAllowed bool              `json:"stretch_allowed"`
	Summary        string            `json:"summary"`
	Subjects       []ProgressSubject `json:"subjects"`
	Strengths      []ProgressTopic   `json:"strengths"`
	Practice       []ProgressTopic   `json:"practice"`
	UpdatedAt      string            `json:"updated_at,omitempty"`
}

type ProgressSubject struct {
	Subject           string          `json:"subject"`
	CurrentYear       int             `json:"current_year"`
	Status            string          `json:"status"`
	AverageScore      int             `json:"average_score"`
	SampledObjectives int             `json:"sampled_objectives"`
	ObjectiveCount    int             `json:"objective_count"`
	SecureObjectives  int             `json:"secure_objectives"`
	Years             []ProgressYear  `json:"years"`
	Strengths         []ProgressTopic `json:"strengths"`
	Practice          []ProgressTopic `json:"practice"`
}

type ProgressYear struct {
	Year              int    `json:"year"`
	Status            string `json:"status"`
	AverageScore      int    `json:"average_score"`
	SampledObjectives int    `json:"sampled_objectives"`
	ObjectiveCount    int    `json:"objective_count"`
	SecureObjectives  int    `json:"secure_objectives"`
}

type ProgressTopic struct {
	ObjectiveID        string `json:"objective_id"`
	Subject            string `json:"subject"`
	Year               int    `json:"year"`
	Strand             string `json:"strand"`
	Topic              string `json:"topic"`
	Statement          string `json:"statement"`
	Score              int    `json:"score"`
	Status             string `json:"status"`
	EvidenceConfidence string `json:"evidence_confidence"`
}

type progressBucket struct {
	year              int
	subject           string
	objectiveCount    int
	sampledObjectives int
	secureObjectives  int
	totalScore        int
	strengths         []ProgressTopic
	practice          []ProgressTopic
}

// BuildProgressReport converts objective-level evidence into a stable report
// contract shared by the parent view and the adaptive engine. It uses the
// curriculum's expected/secure thresholds rather than inventing a percentage
// threshold in the UI.
func BuildProgressReport(studentID string, yearGroup int, objectives []Objective, mastery []StudentMastery) ProgressReport {
	if yearGroup < 1 {
		yearGroup = 1
	}
	if yearGroup > 7 {
		yearGroup = 7
	}
	masteryByID := map[string]StudentMastery{}
	for _, item := range mastery {
		masteryByID[item.ObjectiveID] = item
	}
	buckets := map[string]*progressBucket{}
	for _, objective := range objectives {
		key := progressBucketKey(objective.Subject, objective.Year)
		bucket := buckets[key]
		if bucket == nil {
			bucket = &progressBucket{year: objective.Year, subject: objective.Subject}
			buckets[key] = bucket
		}
		bucket.objectiveCount++
		if current, ok := masteryByID[objective.ID]; ok {
			bucket.sampledObjectives++
			bucket.totalScore += current.Score
			topic := progressTopic(objective, current)
			if topic.Status == "secure" || topic.Status == "strong" {
				bucket.secureObjectives++
				bucket.strengths = append(bucket.strengths, topic)
			} else if topic.Status == "needs_practice" || topic.Status == "building" {
				bucket.practice = append(bucket.practice, topic)
			}
		}
	}

	bySubject := map[string][]ProgressYear{}
	progressSubjects := map[string]*ProgressSubject{}
	for _, bucket := range buckets {
		yearProgress := progressYearFromBucket(*bucket, yearGroup)
		bySubject[bucket.subject] = append(bySubject[bucket.subject], yearProgress)
		subject := progressSubjects[bucket.subject]
		if subject == nil {
			subject = &ProgressSubject{Subject: bucket.subject, CurrentYear: yearGroup}
			progressSubjects[bucket.subject] = subject
		}
		if bucket.year == yearGroup {
			subject.Status = yearProgress.Status
			subject.AverageScore = yearProgress.AverageScore
			subject.SampledObjectives = yearProgress.SampledObjectives
			subject.ObjectiveCount = yearProgress.ObjectiveCount
			subject.SecureObjectives = yearProgress.SecureObjectives
		}
		subject.Strengths = append(subject.Strengths, bucket.strengths...)
		subject.Practice = append(subject.Practice, bucket.practice...)
	}

	for subjectName, subject := range progressSubjects {
		for _, year := range bySubject[subjectName] {
			subject.Years = append(subject.Years, year)
		}
		sort.Slice(subject.Years, func(i, j int) bool { return subject.Years[i].Year < subject.Years[j].Year })
		if subject.Status == "" {
			subject.Status = "not_sampled"
		}
		sort.Slice(subject.Strengths, func(i, j int) bool { return subject.Strengths[i].Score > subject.Strengths[j].Score })
		sort.Slice(subject.Practice, func(i, j int) bool { return subject.Practice[i].Score < subject.Practice[j].Score })
	}

	subjects := make([]ProgressSubject, 0, len(progressSubjects))
	for _, subject := range progressSubjects {
		subjects = append(subjects, *subject)
	}
	sort.Slice(subjects, func(i, j int) bool { return subjects[i].Subject < subjects[j].Subject })
	strengths, practice := progressHighlights(objectives, masteryByID, yearGroup)
	stretchAllowed := CanStretchToYear(yearGroup, objectives, mastery)
	workingYear := yearGroup
	stretchYear := 0
	if stretchAllowed && yearGroup < 7 {
		workingYear = yearGroup + 1
		stretchYear = yearGroup + 1
	}

	summary := "Keep building evidence across the current year."
	if stretchAllowed {
		summary = "Current-year evidence is secure across the active subjects. The next-year pathway is now available alongside spaced review."
	} else if len(strengths) > 0 {
		summary = "Strengths are visible. The next focus is the smallest set of skills that will make progress more secure."
	}
	return ProgressReport{
		StudentID: studentID, YearGroup: yearGroup, WorkingYear: workingYear,
		StretchYear: stretchYear, StretchAllowed: stretchAllowed, Summary: summary,
		Subjects: subjects, Strengths: strengths, Practice: practice,
	}
}

// CanStretchToYear is intentionally conservative: every active subject in
// the learner's current year needs at least the smaller of two secure,
// multi-format evidence points. This supports a next-year stretch without
// confusing one lucky answer with readiness.
func CanStretchToYear(yearGroup int, objectives []Objective, mastery []StudentMastery) bool {
	if yearGroup < 1 || yearGroup >= 7 {
		return false
	}
	masteryByID := map[string]StudentMastery{}
	for _, item := range mastery {
		masteryByID[item.ObjectiveID] = item
	}
	type subjectGate struct{ total, secure int }
	gates := map[string]*subjectGate{}
	for _, objective := range objectives {
		if objective.Year != yearGroup {
			continue
		}
		gate := gates[objective.Subject]
		if gate == nil {
			gate = &subjectGate{}
			gates[objective.Subject] = gate
		}
		gate.total++
		if current, ok := masteryByID[objective.ID]; ok && secureEvidence(objective, current) {
			gate.secure++
		}
	}
	if len(gates) == 0 {
		return false
	}
	for _, gate := range gates {
		required := gate.total
		if required > 2 {
			required = 2
		}
		if gate.secure < required {
			return false
		}
	}
	return true
}

func secureEvidence(objective Objective, current StudentMastery) bool {
	confidence := current.EvidenceConfidence == "supported" || current.EvidenceConfidence == "strong"
	return current.Score >= secureThreshold(objective) && current.EvidenceCount >= 3 && current.FormatCount >= 2 && confidence && current.EvidenceFreshness != "stale"
}

func secureThreshold(objective Objective) int {
	if objective.Mastery.Secure > 0 {
		return objective.Mastery.Secure
	}
	return 90
}

func progressBucketKey(subject string, year int) string { return subject + "\x00" + strconv.Itoa(year) }

func progressYearFromBucket(bucket progressBucket, currentYear int) ProgressYear {
	average := 0
	if bucket.sampledObjectives > 0 {
		average = bucket.totalScore / bucket.sampledObjectives
	}
	status := "not_sampled"
	if bucket.sampledObjectives > 0 {
		switch {
		case bucket.year > currentYear && average >= 80:
			status = "ahead"
		case bucket.secureObjectives > 0 && average >= 90:
			status = "secure"
		case average >= 80:
			status = "on_track"
		default:
			status = "needs_practice"
		}
	}
	return ProgressYear{Year: bucket.year, Status: status, AverageScore: average, SampledObjectives: bucket.sampledObjectives, ObjectiveCount: bucket.objectiveCount, SecureObjectives: bucket.secureObjectives}
}

func progressTopic(objective Objective, current StudentMastery) ProgressTopic {
	status := "building"
	if current.Score >= secureThreshold(objective) && (current.EvidenceConfidence == "supported" || current.EvidenceConfidence == "strong") {
		status = "secure"
	} else if current.Score >= expectedThreshold(objective) {
		status = "on_track"
	} else {
		status = "needs_practice"
	}
	return ProgressTopic{ObjectiveID: objective.ID, Subject: objective.Subject, Year: objective.Year, Strand: objective.Strand, Topic: objective.Topic, Statement: objective.Statement, Score: current.Score, Status: status, EvidenceConfidence: current.EvidenceConfidence}
}

func expectedThreshold(objective Objective) int {
	if objective.Mastery.Expected > 0 {
		return objective.Mastery.Expected
	}
	return 80
}

func progressHighlights(objectives []Objective, mastery map[string]StudentMastery, yearGroup int) ([]ProgressTopic, []ProgressTopic) {
	strengths := []ProgressTopic{}
	practice := []ProgressTopic{}
	for _, objective := range objectives {
		current, ok := mastery[objective.ID]
		if !ok {
			continue
		}
		topic := progressTopic(objective, current)
		if topic.Status == "secure" && len(strengths) < 12 {
			strengths = append(strengths, topic)
		}
		if (topic.Status == "needs_practice" || (objective.Year == yearGroup && topic.Status == "building")) && len(practice) < 12 {
			practice = append(practice, topic)
		}
	}
	sort.Slice(strengths, func(i, j int) bool { return strengths[i].Score > strengths[j].Score })
	sort.Slice(practice, func(i, j int) bool { return practice[i].Score < practice[j].Score })
	return strengths, practice
}
