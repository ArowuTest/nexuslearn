// Package contentgate decides which authored material may be shown to a child.
// AI review and a technical "approved" flag are not human approval.
package contentgate

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
)

var runtimeStatuses = map[string]bool{"approved": true, "published": true, "live": true}
var humanLaneValues = map[string]bool{"approved": true, "complete": true}
var releasedAudio = map[string]bool{
	"human_listening_approved": true,
	"approved":                 true,
	"production_approved":      true,
	"released":                 true,
}

var humanLanes = []string{"curriculum_review", "teacher_review", "accessibility_review", "safeguarding_review"}

type PackSummary struct {
	PackID         string `json:"pack_id"`
	Year           int    `json:"year"`
	Subject        string `json:"subject"`
	Variants       int    `json:"variants"`
	ChildServable  int    `json:"child_servable"`
	Blocked        int    `json:"blocked"`
	HumanLanesDone bool   `json:"human_lanes_done"`
}

type Report struct {
	CatalogueAvailable                bool          `json:"catalogue_available"`
	Packs                             int           `json:"packs"`
	Variants                          int           `json:"variants"`
	ChildServableVariants             int           `json:"child_servable_variants"`
	BlockedVariants                   int           `json:"blocked_variants"`
	RuntimeStatusWithoutHumanApproval int           `json:"runtime_status_without_human_approval"`
	Narrations                        int           `json:"narrations"`
	NarrationsServable                int           `json:"narrations_servable"`
	NarrationsBlocked                 int           `json:"narrations_blocked"`
	PackSummaries                     []PackSummary `json:"pack_summaries,omitempty"`
	Rule                              string        `json:"rule"`
}

func Rule() string {
	return "A child can only be shown a variant when its pack has completed human curriculum, teacher, accessibility and safeguarding review, the variant itself is approved for runtime, and every narration it uses has been human-listened and released. AI review does not unlock content."
}

type packFile struct {
	PackID          string `json:"pack_id"`
	Status          string `json:"status"`
	SourceAlignment struct {
		Year    int    `json:"year"`
		Subject string `json:"subject"`
	} `json:"source_alignment"`
	QA               map[string]any    `json:"qa"`
	QuestionVariants []questionVariant `json:"question_variants"`
}

type questionVariant struct {
	Status string         `json:"status"`
	Body   map[string]any `json:"body"`
}

type narrationManifest struct {
	Items []struct {
		ID               string `json:"id"`
		ProductionStatus string `json:"production_status"`
		TechnicalPass    bool   `json:"technical_pass"`
	} `json:"items"`
}

func Scan(packDir, manifestPath string) (Report, error) {
	report := Report{Rule: Rule()}
	entries, err := os.ReadDir(packDir)
	if err != nil {
		if os.IsNotExist(err) {
			return report, nil
		}
		return report, err
	}
	report.CatalogueAvailable = true
	approvedAudio := map[string]bool{}
	if raw, err := os.ReadFile(manifestPath); err == nil {
		var manifest narrationManifest
		if err := json.Unmarshal(raw, &manifest); err != nil {
			return report, err
		}
		for _, item := range manifest.Items {
			report.Narrations++
			if item.TechnicalPass && releasedAudio[item.ProductionStatus] {
				report.NarrationsServable++
				approvedAudio[item.ID] = true
			} else {
				report.NarrationsBlocked++
			}
		}
	}
	for _, entry := range entries {
		if entry.IsDir() || !strings.HasSuffix(entry.Name(), ".json") {
			continue
		}
		raw, err := os.ReadFile(filepath.Join(packDir, entry.Name()))
		if err != nil {
			return report, err
		}
		var pack packFile
		if err := json.Unmarshal(raw, &pack); err != nil {
			return report, err
		}
		lanesDone := humanLanesApproved(pack.QA)
		summary := PackSummary{PackID: pack.PackID, Year: pack.SourceAlignment.Year, Subject: pack.SourceAlignment.Subject, HumanLanesDone: lanesDone}
		report.Packs++
		for _, variant := range pack.QuestionVariants {
			report.Variants++
			summary.Variants++
			runtime := runtimeStatuses[strings.ToLower(strings.TrimSpace(variant.Status))]
			if runtime && !lanesDone {
				report.RuntimeStatusWithoutHumanApproval++
			}
			if childServable(variant, lanesDone, approvedAudio) {
				report.ChildServableVariants++
				summary.ChildServable++
			} else {
				report.BlockedVariants++
				summary.Blocked++
			}
		}
		report.PackSummaries = append(report.PackSummaries, summary)
	}
	return report, nil
}

func humanLanesApproved(qa map[string]any) bool {
	if qa == nil {
		return false
	}
	for _, lane := range humanLanes {
		value, _ := qa[lane].(string)
		if !humanLaneValues[strings.ToLower(strings.TrimSpace(value))] {
			return false
		}
	}
	return true
}

func childServable(variant questionVariant, lanesDone bool, approvedAudio map[string]bool) bool {
	if !lanesDone || !runtimeStatuses[strings.ToLower(strings.TrimSpace(variant.Status))] {
		return false
	}
	for _, ref := range audioReferences(variant.Body) {
		if !approvedAudio[ref] {
			return false
		}
	}
	return true
}

func audioReferences(body map[string]any) []string {
	if body == nil {
		return nil
	}
	refs := []string{}
	for _, key := range []string{"audio_asset_id", "audio_ref", "whole_audio_asset_id"} {
		if value, ok := body[key].(string); ok && strings.TrimSpace(value) != "" {
			refs = append(refs, strings.TrimSpace(value))
		}
	}
	if ids, ok := body["audio_asset_ids"].([]any); ok {
		for _, item := range ids {
			if value, ok := item.(string); ok && strings.TrimSpace(value) != "" {
				refs = append(refs, strings.TrimSpace(value))
			}
		}
	}
	return refs
}

// CatalogueAudioPath is a file the public narration catalogue serves.
// Direct links to those files are blocked unless that exact file was released.
func CatalogueAudioPath(value string) bool {
	value = strings.TrimSpace(value)
	return strings.HasPrefix(value, "/audio/")
}
