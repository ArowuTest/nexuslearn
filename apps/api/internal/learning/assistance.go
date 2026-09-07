package learning

import "strings"

// AssistancePolicyVersion identifies the evidence vocabulary used by adult
// reports. Access support is not a deficit and must not be confused with
// answer-revealing help.
const AssistancePolicyVersion = "assistance-policy-v1"

var assistanceAliases = map[string]string{
	"audio-replay": "audio_replay", "audio_replay": "audio_replay",
	"audio-support": "audio_support", "audio_support": "audio_support",
	"reading-support": "reading_support", "reading_support": "reading_support",
	"reduced-motion": "reduced_motion", "reduced_motion": "reduced_motion",
	"high-contrast": "high_contrast", "high_contrast": "high_contrast",
	"simple-text": "simple_text", "simple_text": "simple_text",
	"visual-guide": "visual_guide", "visual_guide": "visual_guide",
	"switch-access": "switch_access", "switch_access": "switch_access",
	"keyboard-response": "keyboard_response", "keyboard_response": "keyboard_response",
	"large-targets": "large_targets", "large_targets": "large_targets",
	"focus-mode": "focus_mode", "focus_mode": "focus_mode",
	"adult-operated": "adult_operated", "adult_operated": "adult_operated",
	"hint":         "hint",
	"answer-model": "answer_model", "answer_model": "answer_model", "model": "answer_model",
	"worked-example": "worked_example", "worked_example": "worked_example",
	"answer-reveal-audio": "answer_reveal_audio", "answer_reveal_audio": "answer_reveal_audio",
	"answer-revealing-audio": "answer_reveal_audio",
	"phoneme-audio":          "phoneme_audio", "phoneme_audio": "phoneme_audio",
}

var answerRevealingAssistance = map[string]bool{
	"hint": true, "answer_model": true, "worked_example": true,
	"answer_reveal_audio": true, "phoneme_audio": true,
}

// normaliseAssistance is deliberately allow-listed. Client telemetry can add
// context to an attempt, but it cannot create arbitrary report categories or
// change marking policy through an unrecognised string.
func normaliseAssistance(values []string, hintUsed bool) []string {
	out := make([]string, 0, len(values)+1)
	seen := map[string]bool{}
	for _, value := range values {
		key := strings.ToLower(strings.TrimSpace(value))
		canonical, ok := assistanceAliases[key]
		if !ok || seen[canonical] {
			continue
		}
		seen[canonical] = true
		out = append(out, canonical)
	}
	if hintUsed && !seen["hint"] {
		out = append(out, "hint")
	}
	return out
}

func containsAssistance(values []string, wanted string) bool {
	for _, value := range values {
		if value == wanted {
			return true
		}
	}
	return false
}

func usesAnswerRevealingAssistance(values []string, hintUsed bool) bool {
	for _, value := range normaliseAssistance(values, hintUsed) {
		if answerRevealingAssistance[value] {
			return true
		}
	}
	return false
}
