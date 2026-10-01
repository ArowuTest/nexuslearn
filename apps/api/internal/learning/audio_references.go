package learning

import "strings"

// audioReferenceValues accepts the JSON shapes used by authored packs while
// keeping the runtime contract independent of the decoder's concrete slice
// type. Empty and non-string values are deliberately ignored.
func audioReferenceValues(value any) []string {
	refs := []string{}
	switch typed := value.(type) {
	case string:
		if ref := strings.TrimSpace(typed); ref != "" {
			refs = append(refs, ref)
		}
	case []any:
		for _, item := range typed {
			if ref, ok := item.(string); ok {
				if ref = strings.TrimSpace(ref); ref != "" {
					refs = append(refs, ref)
				}
			}
		}
	case []string:
		for _, item := range typed {
			if ref := strings.TrimSpace(item); ref != "" {
				refs = append(refs, ref)
			}
		}
	}
	return refs
}

func appendUniqueAudioReferences(dst *[]string, seen map[string]bool, refs []string) {
	for _, ref := range refs {
		if !seen[ref] {
			*dst = append(*dst, ref)
			seen[ref] = true
		}
	}
}

func appendUniqueAudioField(dst *[]string, seen map[string]bool, body map[string]any, key string) {
	appendUniqueAudioReferences(dst, seen, audioReferenceValues(body[key]))
}

func isWholeWordAudioReference(ref string) bool {
	return strings.HasPrefix(ref, "word-") || strings.HasPrefix(ref, "whole-") || strings.HasPrefix(ref, "narration-")
}

func appendGenericAudioReferences(dst *[]string, seen map[string]bool, body map[string]any) {
	refs := audioReferenceValues(body["audio_asset_ids"])
	// Phonics banks store phoneme clips followed by the whole-word clip in the
	// same array. Put the whole-word clip first so the primary replay control is
	// useful, then retain every clip for required-listening approval.
	wholeWord := []string{}
	other := []string{}
	for _, ref := range refs {
		if isWholeWordAudioReference(ref) {
			wholeWord = append(wholeWord, ref)
		} else {
			other = append(other, ref)
		}
	}
	appendUniqueAudioReferences(dst, seen, wholeWord)
	appendUniqueAudioReferences(dst, seen, other)
}

// authoredAudioReferences is the single ordering contract used by both the
// release gate and the pupil projection. Explicit whole-word fields win,
// followed by direct prompt references, then plural phonics/prompt fields.
func authoredAudioReferences(body map[string]any) []string {
	refs := []string{}
	seen := map[string]bool{}
	for _, key := range []string{"whole_audio_asset_id", "whole_word_audio_asset_id", "whole_word_audio_asset_ids", "audio_asset_id", "audio_ref"} {
		appendUniqueAudioField(&refs, seen, body, key)
	}
	appendGenericAudioReferences(&refs, seen, body)
	appendUniqueAudioField(&refs, seen, body, "phoneme_audio_asset_ids")
	return refs
}

func primaryWholeWordAudioReference(body map[string]any) string {
	for _, key := range []string{"whole_audio_asset_id", "whole_word_audio_asset_id", "whole_word_audio_asset_ids"} {
		if refs := audioReferenceValues(body[key]); len(refs) > 0 {
			return refs[0]
		}
	}
	for _, ref := range audioReferenceValues(body["audio_asset_ids"]) {
		if isWholeWordAudioReference(ref) {
			return ref
		}
	}
	return ""
}
