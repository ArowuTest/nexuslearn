package narrationdata

import (
	_ "embed"
	"encoding/json"
)

//go:embed pack_clips.json
var packClipsJSON []byte

// PackClips maps a pack id to the narration ids published in that pack.
func PackClips() map[string][]string {
	clips := map[string][]string{}
	if err := json.Unmarshal(packClipsJSON, &clips); err != nil {
		return map[string][]string{}
	}
	return clips
}
