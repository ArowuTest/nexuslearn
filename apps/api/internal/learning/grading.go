package learning

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"math"
	"reflect"
	"sort"
	"strconv"
	"strings"

	"github.com/jackc/pgx/v5"
)

var ErrQuestionUnavailable = errors.New("question is not available for this objective")
var ErrQuestionVersion = errors.New("question changed; reload the mission before answering")
var ErrInvalidResponse = errors.New("answer does not match the question response contract")
var ErrQuestionNeedsReview = errors.New("this activity needs review before it can be marked automatically")
var ErrGradingUnavailable = errors.New("answer marking requires database persistence")

// Bump when matching/normalization semantics change. This identifies the
// correctness algorithm, not configurable rewards or mastery policy.
const canonicalGraderRevision = "canonical-policy-v4"

// AnswerResponse is learner evidence, never an answer key. New submissions must
// include this envelope and the served question version. Legacy fields remain
// decodable only so completed pre-upgrade requests keep their replay fingerprint.
type AnswerResponse struct {
	Kind  string          `json:"kind"`
	Value json.RawMessage `json:"value"`
}

func canonicalQuestion(ctx context.Context, tx pgx.Tx, id string) (QuestionConfig, error) {
	q, err := scanQuestion(tx.QueryRow(ctx, `
  WITH active_release AS (
   SELECT id FROM content_releases WHERE channel='live' AND status='applied'
   ORDER BY applied_at DESC NULLS LAST,id DESC LIMIT 1
  )
  SELECT q.id,COALESCE(q.activity_id,''),COALESCE(q.objective_id,''),q.format,q.body,q.expected_answer,
         q.hints,q.explanation,q.difficulty,q.status,q.updated_at
  FROM questions q JOIN curriculum_objectives o ON o.id=q.objective_id
  LEFT JOIN active_release ON TRUE
  WHERE q.id=$1 AND q.status IN ('approved','published','live')
    AND (active_release.id IS NULL OR (q.content_release_id=active_release.id AND o.content_release_id=active_release.id))
  FOR SHARE OF q,o
 `, id))
	if errors.Is(err, pgx.ErrNoRows) {
		return q, ErrQuestionUnavailable
	}
	if err == nil {
		questions := []QuestionConfig{q}
		err = resolveRequiredListening(ctx, tx, questions)
		q = questions[0]
	}
	return q, err
}

// Version includes the rendering and marking contract, not just a rounded
// timestamp. It changes even if two edits occur during the same second.
func questionContractVersion(q QuestionConfig) string {
	version, _ := requestHash(struct {
		ID, Objective, Format, Updated string
		Body, Answer                   map[string]any
		Hints                          []string
		Explanation, Grader            string
		Listening                      []RequiredListeningAsset
	}{q.ID, q.ObjectiveID, q.Format, q.UpdatedAt, q.Body, q.ExpectedAnswer, q.Hints, q.Explanation, canonicalGraderRevision, q.RequiredListening})
	return version
}

func canonicalAnswer(q QuestionConfig) (string, any, error) {
	kind, value, err := canonicalBaseAnswer(q)
	if err != nil {
		return kind, value, err
	}
	if _, err := questionMarkingPolicy(q, kind); err != nil {
		return "review", nil, err
	}
	return kind, value, nil
}

func canonicalBaseAnswer(q QuestionConfig) (string, any, error) {
	e := q.ExpectedAnswer
	if requiresListening(q) && !listeningReady(q) {
		return "review", nil, ErrQuestionNeedsReview
	}
	if q.Format == "trace-path" {
		return "review", nil, ErrQuestionNeedsReview
	}
	if required, _ := e["moderation_required"].(bool); required {
		return "review", nil, ErrQuestionNeedsReview
	}
	if _, rubric := e["rubric"]; rubric {
		return "review", nil, ErrQuestionNeedsReview
	}
	// Authored semantic-equivalence markers currently delegate judgement to a
	// reviewer. Matching the example verbatim does not remove that requirement;
	// unsupported future policy shapes must also fail closed, not be ignored.
	if _, semanticPolicy := e["accepted_semantic_equivalents"]; semanticPolicy {
		return "review", nil, ErrQuestionNeedsReview
	}
	if q.Format == "fair-test-plan" {
		change, c := e["change"].(string)
		measure, m := e["measure"].(string)
		controls, k := e["keep_same"].([]any)
		if c && m && k {
			return "mapping", map[string]any{"change": change, "measure": measure, "keep_same": controls}, nil
		}
	}
	if sequence, ok := e["sequence"].([]any); ok {
		return "sequence", sequence, nil
	}
	switch v := e["value"].(type) {
	case json.Number:
		if _, ok := boundedDecimal(string(v)); !ok {
			return "review", nil, ErrQuestionNeedsReview
		}
		return "number", v, nil
	case float64:
		if math.IsNaN(v) || math.IsInf(v, 0) {
			return "review", nil, ErrQuestionNeedsReview
		}
		return "number", v, nil
	case string:
		if strings.TrimSpace(v) == "" {
			return "review", nil, ErrQuestionNeedsReview
		}
		return "text", v, nil
	case []any:
		if q.Format == "word-build" {
			var b strings.Builder
			for _, item := range v {
				letter, ok := item.(string)
				if !ok {
					return "review", nil, ErrQuestionNeedsReview
				}
				b.WriteString(letter)
			}
			return "text", b.String(), nil
		}
		return "sequence", v, nil
	case map[string]any:
		return "mapping", v, nil
	default:
		return "review", nil, ErrQuestionNeedsReview
	}
}

func gradeCanonicalAttempt(a Attempt, q QuestionConfig) (Attempt, AttemptResult, error) {
	if a.ObjectiveID != q.ObjectiveID || a.QuestionID != q.ID || (a.Format != "" && a.Format != q.Format) {
		return a, AttemptResult{}, ErrQuestionUnavailable
	}
	if a.QuestionVersion == "" || a.QuestionVersion != questionContractVersion(q) {
		return a, AttemptResult{}, ErrQuestionVersion
	}
	if a.Response == nil {
		return a, AttemptResult{}, ErrInvalidResponse
	}
	kind, expected, err := canonicalBaseAnswer(q)
	if err != nil {
		return a, AttemptResult{}, err
	}
	policy, err := questionMarkingPolicy(q, kind)
	if err != nil {
		return a, AttemptResult{}, err
	}
	var given any
	if a.Response.Kind != kind || json.Unmarshal(a.Response.Value, &given) != nil {
		return a, AttemptResult{}, ErrInvalidResponse
	}
	if !validResponseShape(kind, given) {
		return a, AttemptResult{}, ErrInvalidResponse
	}
	if kind == "sequence" && q.Format != "coordinate-plot" {
		// Existing ordered builders serialize scalar tiles as strings.
		expected = normalizeSequenceTiles(expected)
		given = normalizeSequenceTiles(given)
	}
	expected = normalizeResponseWithCase(expected, q.Format, policy.caseSensitive)
	given = normalizeResponseWithCase(given, q.Format, policy.caseSensitive)
	a.Format = q.Format
	a.QuestionVersion = questionContractVersion(q)
	a.Expected, a.Given = 0, 0
	a.ExpectedText = responseEvidence(expected)
	a.GivenText = responseEvidence(given)
	correct := reflect.DeepEqual(expected, given)
	for _, alternative := range policy.alternatives {
		if kind == "sequence" && q.Format != "coordinate-plot" {
			alternative = normalizeSequenceTiles(alternative)
		}
		if reflect.DeepEqual(normalizeResponseWithCase(alternative, q.Format, policy.caseSensitive), given) {
			correct = true
		}
	}
	if policy.tolerance != nil {
		correct, err = withinTolerance(expected, a.Response.Value, policy.tolerance)
		if err != nil {
			return a, AttemptResult{}, err
		}
		// This is the decimal value actually compared, without float rounding.
		a.GivenText = strings.TrimSpace(string(a.Response.Value))
	}
	result := scoreCorrectness(a, correct)
	return a, result, nil
}

func normalizeSequenceTiles(value any) any {
	items, ok := value.([]any)
	if !ok {
		return value
	}
	out := make([]any, len(items))
	for i, item := range items {
		out[i] = item
		if number, ok := item.(float64); ok {
			out[i] = strconv.FormatFloat(number, 'f', -1, 64)
		}
	}
	return out
}

func validResponseShape(kind string, value any) bool {
	switch kind {
	case "number":
		v, ok := value.(float64)
		return ok && !math.IsNaN(v) && !math.IsInf(v, 0)
	case "text":
		v, ok := value.(string)
		return ok && strings.TrimSpace(v) != ""
	case "sequence":
		v, ok := value.([]any)
		return ok && len(v) > 0 && validStructured(v)
	case "mapping":
		v, ok := value.(map[string]any)
		return ok && len(v) > 0 && validStructured(v)
	}
	return false
}

func validStructured(value any) bool {
	switch v := value.(type) {
	case string:
		return strings.TrimSpace(v) != ""
	case float64:
		return !math.IsNaN(v) && !math.IsInf(v, 0)
	case []any:
		for _, item := range v {
			if !validStructured(item) {
				return false
			}
		}
		return true
	case map[string]any:
		for _, item := range v {
			if !validStructured(item) {
				return false
			}
		}
		return true
	default:
		return false
	}
}

func normalizeResponse(value any, format string) any {
	return normalizeResponseWithCase(value, format, false)
}

func normalizeResponseWithCase(value any, format string, caseSensitive bool) any {
	switch v := value.(type) {
	case string:
		if caseSensitive {
			return strings.TrimSpace(v)
		}
		return normalizeAnswer(v)
	case []any:
		out := make([]any, len(v))
		for i, item := range v {
			out[i] = normalizeResponseWithCase(item, format, caseSensitive)
		}
		return out
	case map[string]any:
		out := make(map[string]any, len(v))
		for key, item := range v {
			normalized := normalizeResponseWithCase(item, format, caseSensitive)
			// Only these authored contracts explicitly treat these lists as unordered.
			if format == "pattern-sort" || (format == "fair-test-plan" && key == "keep_same") {
				if items, ok := normalized.([]any); ok {
					sort.Slice(items, func(i, j int) bool { return responseEvidence(items[i]) < responseEvidence(items[j]) })
				}
			}
			out[key] = normalized
		}
		return out
	default:
		return value
	}
}

func responseEvidence(value any) string {
	if text, ok := value.(string); ok {
		return text
	}
	if number, ok := value.(float64); ok {
		return strconv.FormatFloat(number, 'f', -1, 64)
	}
	raw, _ := json.Marshal(value)
	return string(bytes.TrimSpace(raw))
}
