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

func TestPupilQuestionPromotesPluralWholeWordAudioAlias(t *testing.T) {
	q := QuestionConfig{Format: "word-build", Body: map[string]any{
		"audio_required":             true,
		"whole_word_audio_asset_ids": []any{"word-cat", "word-dog"},
		"words":                      []any{"cat", "dog"},
	}}
	public := PupilQuestion(q)
	if public.Body["whole_audio_asset_id"] != "word-cat" {
		t.Fatalf("plural whole-word audio was not promoted: %v", public.Body)
	}
	if !reflect.DeepEqual(public.Body["whole_word_audio_assets"], map[string]any{"cat": "word-cat", "dog": "word-dog"}) {
		t.Fatalf("plural whole-word controls were not projected: %v", public.Body)
	}
	if _, leaked := public.Body["whole_word_audio_asset_ids"]; leaked {
		t.Fatal("private plural audio references leaked to the pupil")
	}
}

func TestPupilQuestionMapsGeneratedPhonicsAudioListToSoundControls(t *testing.T) {
	q := QuestionConfig{Format: "audio_blend", Body: map[string]any{
		"sounds":          []any{"c", "a", "t"},
		"audio_asset_ids": []any{"phoneme-c", "phoneme-a", "phoneme-t", "word-cat"},
	}}
	public := PupilQuestion(q)
	if !reflect.DeepEqual(public.Body["audio_assets"], map[string]any{"c": "phoneme-c", "a": "phoneme-a", "t": "phoneme-t"}) {
		t.Fatalf("generated phonics clips did not reach sound controls: %v", public.Body)
	}
}
