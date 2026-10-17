package curriculum

import (
	"path/filepath"
	"runtime"
	"testing"
)

func TestYearLabelsDefaultToEnglandAndMapNigeria(t *testing.T) {
	catalogue := Builtin()
	if catalogue.YearLabel("", 4) != "Year 4" || catalogue.YearLabel("england", 1) != "Year 1" {
		t.Fatalf("england labels changed: %q %q", catalogue.YearLabel("", 4), catalogue.YearLabel("england", 1))
	}
	if catalogue.YearLabel("nigeria", 1) != "Primary 1" || catalogue.YearLabel("NG", 6) != "Primary 6" || catalogue.YearLabel("nigeria", 7) != "JSS 1" {
		t.Fatalf("nigeria labels: 1=%q 6=%q 7=%q", catalogue.YearLabel("nigeria", 1), catalogue.YearLabel("nigeria", 6), catalogue.YearLabel("nigeria", 7))
	}
	if catalogue.YearLabel("nigeria", 0) != "Year not set" {
		t.Fatal("missing year should stay explicit")
	}
}

func TestRegionFileMatchesBuiltin(t *testing.T) {
	_, file, _, ok := runtime.Caller(0)
	if !ok {
		t.Fatal("caller")
	}
	path := filepath.Join(filepath.Dir(file), "../../../../packages/content/curriculum/regions.json")
	loaded, err := LoadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	builtin := Builtin()
	for _, region := range []string{"england", "nigeria"} {
		for year := 1; year <= 7; year++ {
			if loaded.YearLabel(region, year) != builtin.YearLabel(region, year) {
				t.Fatalf("%s year %d file %q builtin %q", region, year, loaded.YearLabel(region, year), builtin.YearLabel(region, year))
			}
		}
	}
	if loaded.DefaultRegion != "england" {
		t.Fatal(loaded.DefaultRegion)
	}
}
