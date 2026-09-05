package learning

import (
	"context"

	"github.com/jackc/pgx/v5"
)

// ReleaseEvidenceCheck is shared by preflight and activation. Messages describe
// the requirement; Passed states whether the current ledger satisfies it.
type ReleaseEvidenceCheck struct {
	Code    string `json:"code"`
	Passed  bool   `json:"passed"`
	Message string `json:"message"`
}

type ContentReleasePreflight struct {
	ReleaseID      string                 `json:"release_id"`
	ManifestSHA256 string                 `json:"manifest_sha256"`
	EvidenceReady  bool                   `json:"evidence_ready"`
	AI             AIReviewEligibility    `json:"ai"`
	Checks         []ReleaseEvidenceCheck `json:"checks"`
}

func releaseEvidenceChecks(channel string, ai AIReviewEligibility, human HumanReleaseEvidence) []ReleaseEvidenceCheck {
	checks := []ReleaseEvidenceCheck{}
	if channel == "review" {
		return checks
	}
	checks = append(checks, ReleaseEvidenceCheck{Code: "ai_review", Passed: ai.ControlledPilotAllowed, Message: "current approval from both AI review lanes"})
	if channel == "live" {
		checks = append(checks,
			ReleaseEvidenceCheck{Code: "safeguarding", Passed: human.SafeguardingApproved, Message: "independent human safeguarding approval"},
			ReleaseEvidenceCheck{Code: "audio_release", Passed: human.ExactAudioReleaseApproved, Message: "the exact technically valid audio release and catalogue"},
			ReleaseEvidenceCheck{Code: "audio_listening", Passed: human.RequiredAudioListeningApproved, Message: "human listening approval for every required audio asset"},
			ReleaseEvidenceCheck{Code: "child_pilot", Passed: human.ChildPilotEvidenceApproved, Message: "recorded real-child pilot evidence"},
		)
	}
	return checks
}

// PreflightContentRelease only evaluates evidence. Activation still verifies
// uploaded chunks and runtime eligibility, and rereads the ledgers at that time.
func (r *PostgresRepository) PreflightContentRelease(ctx context.Context, manifest ContentReleaseManifest) (ContentReleasePreflight, error) {
	result := ContentReleasePreflight{ReleaseID: manifest.ID, ManifestSHA256: manifest.ManifestSHA256}
	if manifest.Channel != "live" {
		return result, invalidConfig("evidence preflight requires a live manifest")
	}
	if err := validateReleaseManifest(manifest); err != nil {
		return result, err
	}
	metadata, err := releaseEvidenceMetadata(manifest)
	if err != nil {
		return result, err
	}
	tx, err := r.db.BeginTx(ctx, pgx.TxOptions{IsoLevel: pgx.RepeatableRead, AccessMode: pgx.ReadOnly})
	if err != nil {
		return result, err
	}
	defer tx.Rollback(ctx)
	ai, err := EvaluateAIReviewEligibility(ctx, tx, metadata.AIReviewIdentities)
	if err != nil {
		return result, err
	}
	human, err := loadHumanReleaseEvidence(ctx, tx, manifest, metadata)
	if err != nil {
		return result, err
	}
	result.AI = ai
	result.Checks = releaseEvidenceChecks("live", ai, human)
	result.EvidenceReady = ValidateReleaseEvidence("live", ai, human) == nil
	return result, tx.Commit(ctx)
}
