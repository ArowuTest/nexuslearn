package server

import (
	"testing"
	"time"

	"github.com/ArowuTest/nexuslearn/apps/api/internal/learning"
)

func TestChooseAdaptiveActivityIgnoresReviewsWithoutValidDueTime(t *testing.T) {
	activities := []learning.ActivityConfig{
		{ID: "review", ObjectiveID: "earlier-year", Status: "published"},
		{ID: "learning", ObjectiveID: "current-year", Status: "published"},
	}
	objectives := []learning.Objective{
		{ID: "earlier-year", Year: 2},
		{ID: "current-year", Year: 3},
	}
	for _, due := range []string{"", "not scheduled", "2026-02-30T12:00:00Z", "2000-01-01", "0001-01-01T00:00:00Z", time.Now().Add(24 * time.Hour).UTC().Format(time.RFC3339)} {
		for _, route := range []string{"learning", "assignment", "intervention"} {
			t.Run(route+"/"+due, func(t *testing.T) {
				var assignments []learning.Assignment
				var interventions []learning.InterventionPlan
				if route == "assignment" {
					assignments = []learning.Assignment{{ObjectiveID: "current-year", ActivityID: "learning", Status: "active"}}
				}
				if route == "intervention" {
					interventions = []learning.InterventionPlan{{ObjectiveID: "current-year", Status: "active"}}
				}
				choice, ok := chooseAdaptiveActivity(activities, objectives, nil,
					[]learning.WarmUpItem{{ObjectiveID: "earlier-year", DueAt: due}}, nil, interventions, assignments, nil, 3)
				if !ok || choice.Activity.ID != "learning" || choice.Review {
					t.Fatalf("invalid/not-yet-due review starved %s: %+v", route, choice)
				}
			})
		}
	}
}

func TestChooseAdaptiveActivitySkipsInvalidReviewBeforeLegitimateEarlierYearReview(t *testing.T) {
	activities := []learning.ActivityConfig{
		{ID: "invalid", ObjectiveID: "invalid", Status: "published"},
		{ID: "unavailable", ObjectiveID: "unavailable", Status: "archived"},
		{ID: "earlier-review", ObjectiveID: "earlier-year", Status: "approved"},
		{ID: "new-learning", ObjectiveID: "current-year", Status: "published"},
	}
	due := time.Now().Add(-time.Hour).In(time.FixedZone("test-offset", 3600)).Format(time.RFC3339Nano)
	choice, ok := chooseAdaptiveActivity(activities,
		[]learning.Objective{{ID: "earlier-year", Year: 2}, {ID: "current-year", Year: 3}}, nil,
		[]learning.WarmUpItem{{ObjectiveID: "invalid"}, {ObjectiveID: "unavailable", DueAt: due}, {ObjectiveID: "earlier-year", DueAt: due}}, nil,
		[]learning.InterventionPlan{{ObjectiveID: "current-year", Status: "active"}},
		[]learning.Assignment{{ObjectiveID: "current-year", Status: "active"}}, nil, 3)
	if !ok || choice.Activity.ID != "earlier-review" || !choice.Review {
		t.Fatalf("legitimate earlier-year due review lost priority: %+v", choice)
	}
}
