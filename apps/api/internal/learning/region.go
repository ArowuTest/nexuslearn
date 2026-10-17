package learning

import (
	_ "embed"
	"encoding/json"
	"os"
	"strings"
)

//go:embed regiondata/year-groups.json
var yearGroupMapping []byte

// YearGroupMapping is the canonical England and Nigeria display map.
// The API embeds its own copy because a Render service rooted at apps/api
// cannot read packages/content at runtime. A test checks the copies match.
func YearGroupMapping() json.RawMessage {
	return json.RawMessage(yearGroupMapping)
}

// ActiveCurriculumRegion keeps England as the default.
func ActiveCurriculumRegion() string {
	value := strings.ToLower(strings.TrimSpace(os.Getenv("CURRICULUM_REGION")))
	if value == "nigeria" {
		return "nigeria"
	}
	return "england"
}
