package learning

import "strings"

// Separate from the authoring DTO: new private fields must not become public.
type PupilQuestionConfig struct {
	ID              string         `json:"id"`
	ActivityID      string         `json:"activity_id"`
	ObjectiveID     string         `json:"objective_id"`
	Format          string         `json:"format"`
	QuestionVersion string         `json:"question_version"`
	ResponseKind    string         `json:"response_kind"`
	SelectionCount  int            `json:"selection_count,omitempty"`
	Body            map[string]any `json:"body"`
	Hints           []string       `json:"hints"`
	Difficulty      int            `json:"difficulty"`
	SelectionReason string         `json:"selection_reason,omitempty"`
}

// Authored stimuli and accessible controls, not marking metadata. Adding a
// renderer field requires explicitly admitting it at this boundary.
const pupilBodyFields = `prompt a b input response choices
 animal antecedent audience audio_assets audio_url audio_asset_id audio_ref whole_audio_asset_id
 audio_script narration_script narration_url prompt_audio_url audio_required
 available_cards base_noun calculation cards categories cell_type change changed chunks claim claims
 clause component components data data_points data_table day_3 day_7 diagram_task duration_minutes
 end environment equivalent_choices error_choices evidence evidence_icons evidence_record expression
 extract force_model formula generations given_part grid group_size groups hotspots inclusive_note
 inference intended_meaning intended_referent investigation_plan item key_path known_fact labels letter
 model model_features move number observation observations operands operation organism organism_card
 original parts pattern_columns plan planner_cards point prediction prediction_options quantity_cards
 question_target ratio reference relationship roles safety_context scale scale_factor select_count
 selectable_spans sentences shape shown_answer shown_steps sound_boxes sounds source_sentence
 source_sentences stage_cards start start_time starting_counts stated_purpose strategy_steps structures
 suggested_jumps table target target_inference target_mood target_shaded text text_model theme tiles
 total transfer_context variable_options versions whole words x_axis y_axis tolerance
 response_mode supported_interaction`

var pupilBodyKeys = pupilFieldSet(pupilBodyFields)

// Explicit observation/model record schema. Unknown nested metadata is private
// by default, just like unknown top-level fields. Dynamic audio keys use the
// separately constrained phoneme map below.
var pupilRecordKeys = pupilFieldSet(`value label tens ones x_max y_max x_min y_min quadrant
 origin_labelled unit_intervals model motion_or_state_labelled force_directions_text
 arrow_lengths_qualitative_unless_measured limitation_note change measure keep_same repeat_trials
 conclusion_scope generation trait_a trait_b total subject meaning sentence_clue result surface
 reflected_light_observation exchange_required day height description leaves start addends whole
 tool unit labelled_start interval_size pointer_interval_index magnification_available kind features
 x y picture_supported context_object ones_before_exchange exchange ten_ones new_tens ones_left
 quantity_conserved parts subtract number_line_direction strategy_steps type amount purpose name
 group category count time_h added backboneGroup number_line_jumps specimen input useful removed
 remaining first_change intermediate second_change percent expanded_form condition r1 r2 r3 pupils
 quantities difference known_part claimed estimate review_interval_days sentence minutes lunch club
 attendees week force distance work dissipated activity sensor_reading litres time temperature_c
 height_cm leaf_count circuit cells switch bulb word_parts visual_anchor non_example start_mark
 end_mark right up n interval shallow_root deep_root`)

func pupilFieldSet(fields string) map[string]bool {
	keys := map[string]bool{}
	for _, key := range strings.Fields(fields) {
		keys[key] = true
	}
	return keys
}

func PupilQuestion(q QuestionConfig) PupilQuestionConfig {
	kind, answer, _ := canonicalAnswer(q)
	body := map[string]any{}
	for key, value := range q.Body {
		if pupilBodyKeys[key] {
			body[key] = pupilStimulus(value)
		}
	}
	if assets, ok := q.Body["audio_assets"].(map[string]any); ok {
		publicAssets := map[string]any{}
		sounds, _ := q.Body["sounds"].([]any)
		for _, sound := range sounds {
			if label, ok := sound.(string); ok {
				for _, key := range []string{label, "phoneme-" + label} {
					if value, ok := assets[key].(string); ok {
						publicAssets[key] = value
					}
				}
			}
		}
		body["audio_assets"] = publicAssets
	}
	// Target features are the key, not the three model choices themselves.
	if q.Format == "model-sort" {
		delete(body, "model_features")
	}
	count := 0
	if q.Format == "investigation-planner" {
		if sequence, ok := answer.([]any); ok {
			count = len(sequence)
		}
	}
	return PupilQuestionConfig{ID: q.ID, ActivityID: q.ActivityID, ObjectiveID: q.ObjectiveID,
		Format: q.Format, QuestionVersion: questionContractVersion(q), ResponseKind: kind,
		SelectionCount: count, Body: body, Hints: q.Hints, Difficulty: q.Difficulty, SelectionReason: q.SelectionReason}
}

// Nested models/data can contain author annotations too. Copy rather than
// mutate so snapshots, marking and authenticated authoring retain the originals.
func pupilStimulus(value any) any {
	switch v := value.(type) {
	case map[string]any:
		out := map[string]any{}
		for key, item := range v {
			if !pupilRecordKeys[key] {
				continue
			}
			out[key] = pupilStimulus(item)
		}
		return out
	case []any:
		out := make([]any, len(v))
		for i, item := range v {
			out[i] = pupilStimulus(item)
		}
		return out
	default:
		return value
	}
}
