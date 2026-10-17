package learning

import (
	"os"
	"testing"
)

func TestYearGroupMappingMatchesContentPack(t *testing.T) {
	canonical, err := os.ReadFile("../../../../packages/content/regions/year-groups.json")
	if err != nil {
		t.Fatal(err)
	}
	if string(canonical) != string(YearGroupMapping()) {
		t.Fatal("apps/api year-group map drifted from packages/content/regions/year-groups.json")
	}
}

func TestActiveCurriculumRegionDefaultsToEngland(t *testing.T) {
	t.Setenv("CURRICULUM_REGION", "")
	if ActiveCurriculumRegion() != "england" {
		t.Fatal("England is the default region")
	}
	t.Setenv("CURRICULUM_REGION", "nigeria")
	if ActiveCurriculumRegion() != "nigeria" {
		t.Fatal("nigeria should select the Nigeria labels")
	}
	t.Setenv("CURRICULUM_REGION", "mars")
	if ActiveCurriculumRegion() != "england" {
		t.Fatal("unknown regions stay on England")
	}
}
