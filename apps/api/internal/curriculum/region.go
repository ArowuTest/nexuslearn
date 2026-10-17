// Package curriculum labels the existing year numbers for a region.
// Content stays one England-authored catalogue. A region only changes the
// words shown to families and schools.
package curriculum

import (
	"encoding/json"
	"os"
	"strings"
)

type Region struct {
	Label      string            `json:"label"`
	Curriculum string            `json:"curriculum"`
	Labels     map[string]string `json:"labels"`
}

type Catalogue struct {
	DefaultRegion string            `json:"default_region"`
	Regions       map[string]Region `json:"regions"`
}

func Builtin() Catalogue {
	return Catalogue{
		DefaultRegion: "england",
		Regions: map[string]Region{
			"england": {
				Label: "England", Curriculum: "England national curriculum",
				Labels: map[string]string{"1": "Year 1", "2": "Year 2", "3": "Year 3", "4": "Year 4", "5": "Year 5", "6": "Year 6", "7": "Year 7"},
			},
			"nigeria": {
				Label: "Nigeria", Curriculum: "Nigeria primary and junior secondary labels for the same year numbers",
				Labels: map[string]string{"1": "Primary 1", "2": "Primary 2", "3": "Primary 3", "4": "Primary 4", "5": "Primary 5", "6": "Primary 6", "7": "JSS 1"},
			},
		},
	}
}

func LoadFile(path string) (Catalogue, error) {
	raw, err := os.ReadFile(path)
	if err != nil {
		return Catalogue{}, err
	}
	var catalogue Catalogue
	if err := json.Unmarshal(raw, &catalogue); err != nil {
		return Catalogue{}, err
	}
	return catalogue, nil
}

func Normalize(region string) string {
	switch strings.ToLower(strings.TrimSpace(region)) {
	case "nigeria", "ng":
		return "nigeria"
	default:
		return "england"
	}
}

func (c Catalogue) YearLabel(region string, year int) string {
	if c.Regions == nil {
		c = Builtin()
	}
	chosen := c.Regions[Normalize(region)]
	if chosen.Labels == nil {
		chosen = c.Regions["england"]
	}
	if label := chosen.Labels[itoa(year)]; label != "" {
		return label
	}
	if year <= 0 {
		return "Year not set"
	}
	return "Year " + itoa(year)
}

func itoa(year int) string {
	if year == 0 {
		return "0"
	}
	negative := year < 0
	if negative {
		year = -year
	}
	digits := []byte{}
	for year > 0 {
		digits = append([]byte{byte('0' + year%10)}, digits...)
		year /= 10
	}
	if negative {
		return "-" + string(digits)
	}
	return string(digits)
}
