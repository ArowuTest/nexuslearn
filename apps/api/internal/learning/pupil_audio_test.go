package learning

import (
	"encoding/json"
	"reflect"
	"testing"
)

func TestPupilAuthoredPhonemeAudioAliases(t *testing.T) {
	q := QuestionConfig{Format: "sound-box-build", Body: map[string]any{
		"sounds": []any{"d", "o", "g"}, "whole_word_audio_asset_id": "word-dog",
		"phoneme_audio_asset_ids": []any{"phoneme-d", "phoneme-o", "phoneme-g"},
		"audio_assets":            map[string]any{"private_note": "secret"},
	}}
	before, _ := json.Marshal(q)
	public := PupilQuestion(q)
	if public.Body["whole_audio_asset_id"] != "word-dog" || !reflect.DeepEqual(public.Body["audio_assets"], map[string]any{"d": "phoneme-d", "o": "phoneme-o", "g": "phoneme-g"}) {
		t.Fatalf("authored clips cannot reach controls: %v", public.Body)
	}
	after, _ := json.Marshal(q)
	if string(before) != string(after) || public.Body["phoneme_audio_asset_ids"] != nil {
		t.Fatal("alias mapping changed canonical source or leaked raw author data")
	}
	q.Body["phoneme_audio_asset_ids"] = []any{"only-one-clip"}
	if got := PupilQuestion(q).Body["audio_assets"]; !reflect.DeepEqual(got, map[string]any{}) {
		t.Fatalf("misaligned clips guessed: %v", got)
	}
}
