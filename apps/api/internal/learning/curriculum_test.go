package learning

import "testing"

func TestMasteryBandBoundaries(t *testing.T) {
	cases := []struct {
		name  string
		score int
		want  string
	}{
		{name: "unknown lower bound", score: 0, want: "Unknown"},
		{name: "introduced threshold", score: 20, want: "Introduced"},
		{name: "developing threshold", score: 40, want: "Developing"},
		{name: "nearly secure threshold", score: 60, want: "Nearly secure"},
		{name: "expected threshold", score: 80, want: "Expected standard"},
		{name: "secure threshold", score: 90, want: "Secure"},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := MasteryBand(tc.score); got != tc.want {
				t.Fatalf("MasteryBand(%d) = %q, want %q", tc.score, got, tc.want)
			}
		})
	}
}
