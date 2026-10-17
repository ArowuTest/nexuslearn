package learning

import "github.com/ArowuTest/nexuslearn/apps/api/internal/learning/narrationdata"

var narrationPackClips = narrationdata.PackClips()

// NarrationBelongsToPack reports whether a clip id is published in that pack.
// Unknown packs and unknown clips are false so an approval cannot name audio
// the catalogue does not contain.
func NarrationBelongsToPack(packID, narrationID string) bool {
	for _, id := range narrationPackClips[packID] {
		if id == narrationID {
			return true
		}
	}
	return false
}

func KnownNarrationPack(packID string) bool {
	_, ok := narrationPackClips[packID]
	return ok
}
