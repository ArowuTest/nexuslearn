package learning

import "testing"

func TestObjectivesIncludeYearBreadth(t *testing.T) {
	var hasY1, hasY4 bool
	for _, objective := range Objectives() {
		if objective.Year == 1 {
			hasY1 = true
		}
		if objective.Year == 4 {
			hasY4 = true
		}
	}
	if !hasY1 || !hasY4 {
		t.Fatalf("expected sample objectives to cover Year 1 and Year 4, got y1=%v y4=%v", hasY1, hasY4)
	}
}

func TestNextActivityIsExplainable(t *testing.T) {
	decision := NextActivity("alex-demo")
	if decision.ObjectiveID == "" {
		t.Fatal("expected objective id")
	}
	if decision.Explanation == "" {
		t.Fatal("expected explanation")
	}
	if decision.CompanionPrompt == "" {
		t.Fatal("expected companion prompt")
	}
	if !decision.Scaffold {
		t.Fatal("expected scaffolded next activity for current demo state")
	}
}
