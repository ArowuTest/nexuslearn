package learning

import (
	"testing"
	"time"
)

func TestNormaliseAssistanceKeepsKnownSignalsAndDropsUnknownValues(t *testing.T) {
	got := normaliseAssistance([]string{" SWITCH_ACCESS ", "hint", "hint", "not-a-support", "audio-replay"}, false)
	want := []string{"switch_access", "hint", "audio_replay"}
	if len(got) != len(want) {
		t.Fatalf("normalised assistance=%v, want %v", got, want)
	}
	for i := range want {
		if got[i] != want[i] {
			t.Fatalf("normalised assistance=%v, want %v", got, want)
		}
	}
	if got = normaliseAssistance(nil, true); len(got) != 1 || got[0] != "hint" {
		t.Fatalf("hint flag was not preserved in assistance evidence: %v", got)
	}
}

func TestAccessSupportDoesNotReduceIndependentEvidence(t *testing.T) {
	withoutSupport := scoreCorrectness(Attempt{}, true)
	withAccessSupport := scoreCorrectness(Attempt{AssistanceUsed: []string{"audio_replay", "switch_access"}}, true)
	withAnswerHelp := scoreCorrectness(Attempt{AssistanceUsed: []string{"answer_model"}}, true)
	if withAccessSupport.MasteryGain != withoutSupport.MasteryGain {
		t.Fatalf("access support changed mastery gain: without=%d with=%d", withoutSupport.MasteryGain, withAccessSupport.MasteryGain)
	}
	if withAnswerHelp.MasteryGain >= withoutSupport.MasteryGain {
		t.Fatalf("answer-revealing help was treated as independent: without=%d with=%d", withoutSupport.MasteryGain, withAnswerHelp.MasteryGain)
	}
	if withAnswerDelta := cumulativeDelta(withAnswerHelpAttempt(), withAnswerHelp); withAnswerDelta >= cumulativeDelta(Attempt{}, withoutSupport) {
		t.Fatalf("answer-revealing help was not carried into mastery delta: without=%d with=%d", cumulativeDelta(Attempt{}, withoutSupport), withAnswerDelta)
	}
}

func withAnswerHelpAttempt() Attempt {
	return Attempt{AssistanceUsed: []string{"answer_model"}}
}

func TestEvidenceSummaryCountsOnlyIndependentCorrectAnswers(t *testing.T) {
	summary := summariseEvidence([]evidenceSignal{
		{Correct: true, AssistanceUsed: []string{"audio_replay"}, Format: "audio-choice"},
		{Correct: true, AssistanceUsed: []string{"answer_reveal_audio"}, Format: "audio-choice"},
		{Correct: true, HintUsed: true, Format: "word-build"},
	}, time.Now().UTC())
	if summary.IndependentCorrect != 1 {
		t.Fatalf("independent correct=%d, want 1", summary.IndependentCorrect)
	}
}
