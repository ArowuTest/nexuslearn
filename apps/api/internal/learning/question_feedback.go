package learning

// Repair guidance comes from the saved question's task, not the request's
// claimed format or a world reward message. It gives a next step without
// revealing the answer or diagnosing a misconception from one attempt.
func applyQuestionRepairFeedback(q QuestionConfig, result AttemptResult) AttemptResult {
	if result.Correct {
		return result
	}
	guide := "Check the question and your answer. Take your time; you can use a hint if one is available."
	switch q.Format {
	case "word-build", "sound-box-build":
		guide = "Check the sounds one at a time, then blend them together."
	case "sentence-build":
		guide = "Read your sentence again. Check the word order and punctuation."
	case "evidence-link":
		guide = "Read the question again, then look for words in the text that support your answer."
	case "coordinate-plot":
		guide = "Check the horizontal position first, then the vertical position."
	case "fraction-wall":
		guide = "Check how many equal parts make the whole, then count the parts you need."
	case "fair-test-plan":
		guide = "Check what you change, what you measure and what you keep the same."
	case "pattern-sort":
		guide = "Check the rule for each group, then compare each item with that rule."
	case "sequence-build":
		guide = "Check what should come first, then check each step in order."
	case "number-input", "timed-recall":
		guide = "Check what the question asks. Work through one step at a time; a model may help."
	}
	result.Feedback = "Not yet. " + guide
	result.CompanionPrompt = guide
	result.Explanation = "This answer did not match the saved question's marking rule. " + guide
	return result
}
