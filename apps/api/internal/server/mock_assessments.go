package server

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"sort"
	"strings"

	"github.com/ArowuTest/nexuslearn/apps/api/internal/learning"
)

type mockAssessmentRequest struct {
	StudentExternalRef string         `json:"student_external_ref,omitempty"`
	Subject            string         `json:"subject"`
	YearGroup          int            `json:"year_group"`
	Topics             []string       `json:"topics"`
	QuestionCount      int            `json:"question_count"`
	DurationMinutes    int            `json:"duration_minutes"`
	IncludeRevision    bool           `json:"include_revision"`
	IncludeStretch     bool           `json:"include_stretch"`
	Title              string         `json:"title"`
	Accessibility      map[string]any `json:"accessibility"`
	IdempotencyKey     string         `json:"idempotency_key,omitempty"`
}

type mockAssessmentStore interface {
	learning.MockAssessmentStore
}

func (s *Server) handlePupilCreateMockAssessment(w http.ResponseWriter, r *http.Request) {
	studentID := r.PathValue("studentId")
	if !s.requirePupilSession(w, r, studentID) {
		return
	}
	var in mockAssessmentRequest
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid body"})
		return
	}
	in.StudentExternalRef = studentID
	assessment, err := s.createMockAssessment(r, in, studentID, "pupil", studentID, "")
	s.writeMockAssessmentResult(w, assessment, err)
}

func (s *Server) handlePupilMockAssessments(w http.ResponseWriter, r *http.Request) {
	studentID := r.PathValue("studentId")
	if !s.requirePupilSession(w, r, studentID) {
		return
	}
	store, ok := s.repo.(mockAssessmentStore)
	if !ok {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": "mock assessments are not available"})
		return
	}
	items, err := store.ListMockAssessments(r.Context(), studentID, "", 50)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "could not load mock assessments"})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"mock_assessments": items})
}

func (s *Server) handleParentCreateMockAssessment(w http.ResponseWriter, r *http.Request) {
	parent, ok := s.requireParentUser(w, r)
	if !ok {
		return
	}
	studentID := r.PathValue("externalRef")
	if !s.parentOwnsChild(r.Context(), parent.LoginID, studentID) {
		writeJSON(w, http.StatusForbidden, map[string]string{"error": "child is outside this parent account"})
		return
	}
	var in mockAssessmentRequest
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid body"})
		return
	}
	in.StudentExternalRef = studentID
	assessment, err := s.createMockAssessment(r, in, studentID, "parent", parent.LoginID, "")
	s.writeMockAssessmentResult(w, assessment, err)
}

func (s *Server) handleParentMockAssessments(w http.ResponseWriter, r *http.Request) {
	parent, ok := s.requireParentUser(w, r)
	if !ok {
		return
	}
	studentID := r.PathValue("externalRef")
	if !s.parentOwnsChild(r.Context(), parent.LoginID, studentID) {
		writeJSON(w, http.StatusForbidden, map[string]string{"error": "child is outside this parent account"})
		return
	}
	store, ok := s.repo.(mockAssessmentStore)
	if !ok {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": "mock assessments are not available"})
		return
	}
	items, err := store.ListMockAssessments(r.Context(), studentID, "", 50)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "could not load mock assessments"})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"mock_assessments": items})
}

func (s *Server) handleSchoolCreateMockAssessment(w http.ResponseWriter, r *http.Request) {
	user, ok := s.requireSchoolUser(w, r)
	if !ok {
		return
	}
	var in mockAssessmentRequest
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid body"})
		return
	}
	studentID := strings.TrimSpace(in.StudentExternalRef)
	if studentID == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "student_external_ref is required"})
		return
	}
	if !s.studentBelongsToSchool(r.Context(), user.SchoolURN, studentID) {
		writeJSON(w, http.StatusForbidden, map[string]string{"error": "student is outside this school"})
		return
	}
	assessment, err := s.createMockAssessment(r, in, studentID, user.Role, user.LoginID, user.SchoolURN)
	s.writeMockAssessmentResult(w, assessment, err)
}

func (s *Server) handleSchoolMockAssessments(w http.ResponseWriter, r *http.Request) {
	user, ok := s.requireSchoolUser(w, r)
	if !ok {
		return
	}
	studentID := strings.TrimSpace(r.URL.Query().Get("studentId"))
	if studentID == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "studentId is required"})
		return
	}
	if !s.studentBelongsToSchool(r.Context(), user.SchoolURN, studentID) {
		writeJSON(w, http.StatusForbidden, map[string]string{"error": "student is outside this school"})
		return
	}
	store, ok := s.repo.(mockAssessmentStore)
	if !ok {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": "mock assessments are not available"})
		return
	}
	items, err := store.ListMockAssessments(r.Context(), studentID, user.SchoolURN, 50)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "could not load mock assessments"})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"mock_assessments": items})
}

func (s *Server) writeMockAssessmentResult(w http.ResponseWriter, assessment learning.MockAssessment, err error) {
	if err == nil {
		writeJSON(w, http.StatusCreated, assessment)
		return
	}
	switch {
	case errors.Is(err, learning.ErrIdempotencyConflict):
		writeJSON(w, http.StatusConflict, map[string]string{"error": "idempotency key was reused with a different assessment"})
	case errors.Is(err, learning.ErrStudentNotFound):
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "student is not configured"})
	case errors.Is(err, learning.ErrInvalidConfiguration):
		writeJSON(w, http.StatusUnprocessableEntity, map[string]string{"error": err.Error()})
	default:
		if strings.Contains(err.Error(), "not available") {
			writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": err.Error()})
			return
		}
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "could not generate mock assessment"})
	}
}

func (s *Server) createMockAssessment(r *http.Request, in mockAssessmentRequest, studentID string, role string, createdBy string, schoolURN string) (learning.MockAssessment, error) {
	store, ok := s.repo.(mockAssessmentStore)
	if !ok {
		return learning.MockAssessment{}, errors.New("mock assessments are not available")
	}
	subject := normaliseMockSubject(in.Subject)
	if subject == "" {
		return learning.MockAssessment{}, fmt.Errorf("%w: subject is required and must be English, Mathematics or Science", learning.ErrInvalidConfiguration)
	}
	targetYear := in.YearGroup
	if targetYear == 0 {
		targetYear = s.preferredYear(r.Context(), studentID)
	}
	if targetYear < 1 || targetYear > 7 {
		return learning.MockAssessment{}, fmt.Errorf("%w: target year must be between Year 1 and Year 7", learning.ErrInvalidConfiguration)
	}
	questionCount := in.QuestionCount
	if questionCount == 0 {
		questionCount = 10
	}
	if questionCount < 5 || questionCount > 40 {
		return learning.MockAssessment{}, fmt.Errorf("%w: question count must be between 5 and 40", learning.ErrInvalidConfiguration)
	}
	duration := in.DurationMinutes
	if duration < 0 || duration > 120 {
		return learning.MockAssessment{}, fmt.Errorf("%w: duration must be between 0 and 120 minutes", learning.ErrInvalidConfiguration)
	}
	if in.Accessibility == nil {
		in.Accessibility = map[string]any{}
	}
	adaptations := s.runtimeAdaptations(r.Context(), studentID)
	adaptationJSON, _ := json.Marshal(adaptations)
	var adaptationMap map[string]any
	_ = json.Unmarshal(adaptationJSON, &adaptationMap)
	in.Accessibility["runtime_adaptations"] = adaptationMap

	yearFrom, yearTo := targetYear, targetYear
	if in.IncludeRevision && yearFrom > 1 {
		yearFrom--
	}
	if in.IncludeStretch && yearTo < 7 {
		yearTo++
	}
	objectives, err := s.repo.ListObjectives(r.Context())
	if err != nil {
		return learning.MockAssessment{}, err
	}
	questions, err := s.repo.ListQuestions(r.Context())
	if err != nil {
		return learning.MockAssessment{}, err
	}
	allowedTopics := map[string]struct{}{}
	for _, topic := range in.Topics {
		if value := normaliseMockTopic(topic); value != "" {
			allowedTopics[value] = struct{}{}
		}
	}
	objectiveByID := map[string]learning.Objective{}
	objectiveOrder := []learning.Objective{}
	for _, objective := range objectives {
		if objective.Year < yearFrom || objective.Year > yearTo || !sameMockSubject(objective.Subject, subject) {
			continue
		}
		if len(allowedTopics) > 0 {
			if _, ok := allowedTopics[normaliseMockTopic(objective.Topic)]; !ok {
				if _, ok := allowedTopics[normaliseMockTopic(objective.Strand)]; !ok {
					continue
				}
			}
		}
		objectiveByID[objective.ID] = objective
		objectiveOrder = append(objectiveOrder, objective)
	}
	if len(objectiveOrder) == 0 {
		return learning.MockAssessment{}, fmt.Errorf("%w: no objectives are available for the selected subject and year", learning.ErrInvalidConfiguration)
	}
	sort.Slice(objectiveOrder, func(i, j int) bool {
		left, right := objectiveOrder[i], objectiveOrder[j]
		leftRank, rightRank := mockYearRank(left.Year, targetYear), mockYearRank(right.Year, targetYear)
		if leftRank != rightRank {
			return leftRank < rightRank
		}
		return left.ID < right.ID
	})
	questionsByObjective := map[string][]learning.QuestionConfig{}
	for _, question := range questions {
		if !isRuntimeStatus(question.Status) || question.ObjectiveID == "" {
			continue
		}
		if _, ok := objectiveByID[question.ObjectiveID]; !ok {
			continue
		}
		if containsString(adaptations.AvoidFormats, question.Format) {
			continue
		}
		questionsByObjective[question.ObjectiveID] = append(questionsByObjective[question.ObjectiveID], question)
	}
	for objectiveID := range questionsByObjective {
		sort.Slice(questionsByObjective[objectiveID], func(i, j int) bool {
			left, right := questionsByObjective[objectiveID][i], questionsByObjective[objectiveID][j]
			if left.Difficulty != right.Difficulty {
				return left.Difficulty < right.Difficulty
			}
			return left.ID < right.ID
		})
	}
	items := []learning.MockAssessmentItem{}
	indices := map[string]int{}
	for len(items) < questionCount {
		added := false
		for _, objective := range objectiveOrder {
			pool := questionsByObjective[objective.ID]
			index := indices[objective.ID]
			if index >= len(pool) {
				continue
			}
			question := pool[index]
			indices[objective.ID] = index + 1
			reason := "Balanced subject coverage across runtime-approved variants."
			if objective.Year < targetYear {
				reason = "Spaced revision from an earlier year keeps secure knowledge available."
			} else if objective.Year > targetYear {
				reason = "Stretch evidence checks readiness for the next year without changing the core route."
			}
			items = append(items, learning.MockAssessmentItem{
				Position: len(items) + 1, QuestionID: question.ID, ObjectiveID: question.ObjectiveID,
				ActivityID: question.ActivityID, SelectionReason: reason,
			})
			added = true
			if len(items) >= questionCount {
				break
			}
		}
		if !added {
			break
		}
	}
	if len(items) < 5 {
		return learning.MockAssessment{}, fmt.Errorf("%w: fewer than five runtime-approved questions are available for the selected scope", learning.ErrInvalidConfiguration)
	}
	if len(items) < questionCount {
		questionCount = len(items)
	}
	title := strings.TrimSpace(in.Title)
	if title == "" {
		title = subject + " practice mission"
	}
	assessment := learning.MockAssessment{
		IdempotencyKey:     in.IdempotencyKey,
		StudentExternalRef: studentID,
		SchoolURN:          schoolURN,
		CreatedByRole:      role,
		CreatedBy:          createdBy,
		Subject:            subject,
		YearGroup:          targetYear,
		YearFrom:           yearFrom,
		YearTo:             yearTo,
		Title:              title,
		Status:             "ready",
		QuestionCount:      questionCount,
		DurationMinutes:    duration,
		IncludeRevision:    in.IncludeRevision,
		IncludeStretch:     in.IncludeStretch,
		Accessibility:      in.Accessibility,
		Items:              items,
	}
	return store.CreateMockAssessment(r.Context(), assessment)
}

func normaliseMockSubject(value string) string {
	switch strings.ToLower(strings.TrimSpace(value)) {
	case "math", "maths", "mathematics":
		return "Mathematics"
	case "english", "literacy", "reading", "writing":
		return "English"
	case "science":
		return "Science"
	default:
		return ""
	}
}

func sameMockSubject(left string, right string) bool {
	return normaliseMockSubject(left) == normaliseMockSubject(right)
}

func normaliseMockTopic(value string) string {
	return strings.ToLower(strings.TrimSpace(value))
}

func mockYearRank(year int, target int) int {
	if year == target {
		return 0
	}
	if year < target {
		return 1
	}
	return 2
}

func mockAssessmentBlueprint(questions []learning.QuestionConfig, assessment learning.MockAssessment) learning.AssessmentBlueprint {
	formats := []string{}
	seenFormats := map[string]struct{}{}
	totalDifficulty := 0
	for _, question := range questions {
		if _, ok := seenFormats[question.Format]; !ok && question.Format != "" {
			seenFormats[question.Format] = struct{}{}
			formats = append(formats, question.Format)
		}
		totalDifficulty += question.Difficulty
	}
	targetDifficulty := 0
	if len(questions) > 0 {
		targetDifficulty = totalDifficulty / len(questions)
	}
	rationale := []string{
		"Questions are balanced across the selected subject objectives.",
		"Only runtime-approved variants are included.",
		"The assessment can be paused and revisited without changing the learner's subject route.",
	}
	if assessment.IncludeRevision {
		rationale = append(rationale, "Earlier-year retrieval is interleaved to protect long-term retention.")
	}
	if assessment.IncludeStretch {
		rationale = append(rationale, "Next-year items are labelled as stretch evidence rather than used as a penalty.")
	}
	return learning.AssessmentBlueprint{
		Mode: "assessment", QuestionCount: len(questions), TargetDifficulty: targetDifficulty,
		Formats: formats, Rationale: rationale,
	}
}
