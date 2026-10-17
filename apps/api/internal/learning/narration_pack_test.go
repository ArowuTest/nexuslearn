package learning

import (
	"encoding/json"
	"os"
	"path/filepath"
	"runtime"
	"testing"
)

func TestNarrationPackIndexMatchesThePublicManifest(t *testing.T) {
	_, file, _, _ := runtime.Caller(0)
	manifestPath := filepath.Join(filepath.Dir(file), "..", "..", "..", "..", "apps", "web", "public", "content", "narration-manifest.json")
	raw, err := os.ReadFile(manifestPath)
	if err != nil {
		t.Fatal(err)
	}
	var manifest struct {
		Items []struct {
			ID     string `json:"id"`
			PackID string `json:"pack_id"`
		} `json:"items"`
	}
	if err := json.Unmarshal(raw, &manifest); err != nil {
		t.Fatal(err)
	}
	if len(manifest.Items) == 0 {
		t.Fatal("manifest has no clips")
	}
	for _, item := range manifest.Items {
		if !NarrationBelongsToPack(item.PackID, item.ID) {
			t.Fatalf("clip %s is not indexed for pack %s", item.ID, item.PackID)
		}
	}
	if NarrationBelongsToPack(manifest.Items[0].PackID, "not-a-real-clip") || KnownNarrationPack("not-a-real-pack") {
		t.Fatal("unknown clips or packs were accepted")
	}
}
