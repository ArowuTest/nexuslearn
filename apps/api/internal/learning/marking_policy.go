package learning

import (
	"encoding/json"
	"math/big"
	"strconv"
	"strings"
)

// Policies are private authored marking data. Unknown keys/versions fail closed.
// No fuzzy matching, unit conversion or speech-mode inference is performed.
type markingPolicy struct {
	caseSensitive bool
	alternatives  []any
	tolerance     *big.Rat
}

func questionMarkingPolicy(q QuestionConfig, kind string) (markingPolicy, error) {
	p := markingPolicy{}
	raw, present := q.ExpectedAnswer["marking_policy"]
	spans, hasSpans := q.ExpectedAnswer["accepted_spans"]
	if !present {
		if hasSpans {
			if kind != "text" {
				return p, ErrQuestionNeedsReview
			}
			values, ok := spans.([]any)
			if !ok || !validAlternatives(values, kind) {
				return p, ErrQuestionNeedsReview
			}
			p.alternatives = values
		}
		return p, nil
	}
	if hasSpans {
		return p, ErrQuestionNeedsReview
	}
	obj, ok := raw.(map[string]any)
	if !ok || decimalText(obj["version"]) != "1" {
		return p, ErrQuestionNeedsReview
	}
	data, err := json.Marshal(obj)
	if err != nil || len(data) > 16384 {
		return p, ErrQuestionNeedsReview
	}
	mode, _ := obj["mode"].(string)
	if mode != "exact" && mode != "numeric" {
		return p, ErrQuestionNeedsReview
	}
	for key := range obj {
		if key == "version" || key == "mode" {
			continue
		}
		if mode == "exact" && (key == "accepted_values" || key == "case_sensitive") {
			continue
		}
		if mode == "numeric" && key == "absolute_tolerance" {
			continue
		}
		return p, ErrQuestionNeedsReview
	}
	if mode == "numeric" {
		if _, bounded := boundedDecimal(decimalText(q.ExpectedAnswer["value"])); !bounded {
			return p, ErrQuestionNeedsReview
		}
		p.tolerance, ok = boundedDecimal(decimalText(obj["absolute_tolerance"]))
		if kind != "number" || !ok || p.tolerance.Sign() < 0 {
			return p, ErrQuestionNeedsReview
		}
		return p, nil
	}
	if value, present := obj["case_sensitive"]; present {
		var ok bool
		p.caseSensitive, ok = value.(bool)
		if !ok || kind == "number" {
			return p, ErrQuestionNeedsReview
		}
	}
	if value, present := obj["accepted_values"]; present {
		values, ok := value.([]any)
		if !ok || !validAlternatives(values, kind) {
			return p, ErrQuestionNeedsReview
		}
		p.alternatives = values
		if q.Format == "investigation-planner" {
			_, primary, err := canonicalBaseAnswer(q)
			sequence, ok := primary.([]any)
			if err != nil || !ok {
				return p, ErrQuestionNeedsReview
			}
			for _, value := range values {
				alternative, ok := value.([]any)
				if !ok || len(alternative) != len(sequence) {
					return p, ErrQuestionNeedsReview
				}
			}
		}
	}
	return p, nil
}

func validAlternatives(values []any, kind string) bool {
	if len(values) == 0 || len(values) > 32 {
		return false
	}
	data, err := json.Marshal(values)
	if err != nil || len(data) > 16384 {
		return false
	}
	for _, v := range values {
		if !validResponseShape(kind, v) {
			return false
		}
	}
	return true
}

// Decimal boundary comparisons avoid binary-float subtraction error. Limits
// also prevent tiny adversarial JSON exponent strings allocating huge integers.
func boundedDecimal(text string) (*big.Rat, bool) {
	text = strings.TrimSpace(text)
	if len(text) == 0 || len(text) > 128 {
		return nil, false
	}
	if i := strings.IndexAny(text, "eE"); i >= 0 {
		exponent, err := strconv.Atoi(text[i+1:])
		if err != nil || exponent > 308 || exponent < -308 {
			return nil, false
		}
	}
	return new(big.Rat).SetString(text)
}

func decimalText(value any) string {
	switch v := value.(type) {
	case json.Number:
		return string(v)
	case float64:
		return strconv.FormatFloat(v, 'g', -1, 64)
	default:
		return ""
	}
}

func withinTolerance(expected any, raw json.RawMessage, tolerance *big.Rat) (bool, error) {
	want, ok := boundedDecimal(decimalText(expected))
	if !ok {
		return false, ErrQuestionNeedsReview
	}
	got, ok := boundedDecimal(string(raw))
	if !ok {
		return false, ErrInvalidResponse
	}
	difference := new(big.Rat).Sub(got, want)
	return difference.Abs(difference).Cmp(tolerance) <= 0, nil
}
