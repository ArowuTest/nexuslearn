package learning

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
)

const (
	AIReviewLaneCurriculum = "ai_curriculum_lead"
	AIReviewLaneSEND       = "ai_send_lead"
)

var ErrAIReviewIdentityConflict = errors.New("AI review identity conflicts with different evidence")

type AIReviewStore interface {
	SaveAIReviewEvidence(context.Context, AIReviewEvidence, string) (AIReviewEvidence, error)
	ListAIReviewEvidence(context.Context, AIReviewQuery) (AIReviewPage, error)
	SummariseAIReviews(context.Context) (AIReviewSummary, error)
}

type AIReviewFinding struct {
	ID                string   `json:"id,omitempty"`
	EvidenceID        string   `json:"evidence_id,omitempty"`
	CriterionID       string   `json:"criterion_id"`
	Severity          string   `json:"severity"`
	FindingCode       string   `json:"finding_code"`
	AffectedFields    []string `json:"affected_fields"`
	Rationale         string   `json:"rationale"`
	RequiredRevisions []string `json:"required_revisions"`
	CreatedAt         string   `json:"created_at,omitempty"`
}

type AIReviewEvidence struct {
	ID                     string            `json:"id,omitempty"`
	ContentID              string            `json:"content_id"`
	ContentType            string            `json:"content_type"`
	ContentRevision        string            `json:"content_revision"`
	ContentHash            string            `json:"content_hash"`
	PackID                 string            `json:"pack_id"`
	YearGroup              int               `json:"year_group"`
	Subject                string            `json:"subject"`
	LaneID                 string            `json:"lane_id"`
	Status                 string            `json:"status"`
	RiskTier               string            `json:"risk_tier"`
	RubricRevision         string            `json:"rubric_revision"`
	SourceSetRevision      string            `json:"source_set_revision"`
	ReviewerImplementation string            `json:"reviewer_implementation"`
	ModelIdentifier        string            `json:"model_identifier"`
	Confidence             float64           `json:"confidence"`
	CriterionResults       map[string]any    `json:"criterion_results"`
	SourceIDs              []string          `json:"source_ids"`
	ReviewedVariantIDs     []string          `json:"reviewed_variant_ids"`
	EvidenceNotes          string            `json:"evidence_notes"`
	SupersedesID           string            `json:"supersedes_id,omitempty"`
	Findings               []AIReviewFinding `json:"findings"`
	CreatedAt              string            `json:"created_at,omitempty"`
	Stale                  bool              `json:"stale"`
}

type ReviewIdentity struct {
	ContentID              string `json:"content_id"`
	ContentHash            string `json:"content_hash"`
	RubricRevision         string `json:"rubric_revision"`
	SourceSetRevision      string `json:"source_set_revision"`
	ReviewerImplementation string `json:"reviewer_implementation"`
}

type AIReviewQuery struct {
	LaneID          string
	Status          string
	RiskTier        string
	YearGroup       int
	Subject         string
	PackID          string
	Limit           int
	BeforeCreatedAt time.Time
	BeforeID        string
}

type AIReviewPage struct {
	Items      []AIReviewEvidence `json:"items"`
	NextCursor string             `json:"next_cursor,omitempty"`
}

type AIReviewSummary struct {
	Total                  int            `json:"total"`
	PackCount              int            `json:"packs"`
	VariantCount           int            `json:"variants"`
	ByLane                 map[string]int `json:"by_lane"`
	ByStatus               map[string]int `json:"by_status"`
	ByRiskTier             map[string]int `json:"by_risk_tier"`
	Stale                  int            `json:"stale"`
	BlockingFindings       int            `json:"blocking_findings"`
	EscalationFindings     int            `json:"escalation_findings"`
	ControlledPilotAllowed bool           `json:"controlled_pilot_allowed"`
	RubricRevision         string         `json:"rubric_revision"`
	SourceSetRevision      string         `json:"source_set_revision"`
	ReviewerImplementation string         `json:"reviewer_implementation"`
}

type AIReviewEligibility struct {
	ControlledPilotAllowed  bool `json:"controlled_pilot_allowed"`
	RequiredIdentityCount   int  `json:"required_identity_count"`
	ApprovedIdentityCount   int  `json:"approved_identity_count"`
	MissingLaneCount        int  `json:"missing_lane_count"`
	StaleCount              int  `json:"stale_count"`
	RevisionRequiredCount   int  `json:"revision_required_count"`
	EscalationRequiredCount int  `json:"escalation_required_count"`
}

func ReviewIdentityFromEvidence(review AIReviewEvidence) ReviewIdentity {
	return ReviewIdentity{
		ContentID:              review.ContentID,
		ContentHash:            review.ContentHash,
		RubricRevision:         review.RubricRevision,
		SourceSetRevision:      review.SourceSetRevision,
		ReviewerImplementation: review.ReviewerImplementation,
	}
}

func ReviewEvidenceCurrent(review AIReviewEvidence, identity ReviewIdentity) bool {
	return review.ContentID == identity.ContentID &&
		review.ContentHash == identity.ContentHash &&
		review.RubricRevision == identity.RubricRevision &&
		review.SourceSetRevision == identity.SourceSetRevision &&
		review.ReviewerImplementation == identity.ReviewerImplementation
}

func EvaluateReviewSet(identities []ReviewIdentity, reviews []AIReviewEvidence) AIReviewEligibility {
	result := AIReviewEligibility{RequiredIdentityCount: len(identities)}
	for _, identity := range identities {
		identityApproved := true
		for _, laneID := range []string{AIReviewLaneCurriculum, AIReviewLaneSEND} {
			var current *AIReviewEvidence
			hasHistoricalReview := false
			for index := range reviews {
				review := &reviews[index]
				if review.ContentID != identity.ContentID || review.LaneID != laneID {
					continue
				}
				hasHistoricalReview = true
				if ReviewEvidenceCurrent(*review, identity) {
					current = review
					break
				}
			}
			if current == nil {
				identityApproved = false
				if hasHistoricalReview {
					result.StaleCount++
				} else {
					result.MissingLaneCount++
				}
				continue
			}
			switch current.Status {
			case "approved", "approved_with_observation":
			case "revision_required":
				identityApproved = false
				result.RevisionRequiredCount++
			case "escalation_required":
				identityApproved = false
				result.EscalationRequiredCount++
			default:
				identityApproved = false
				result.MissingLaneCount++
			}
		}
		if identityApproved {
			result.ApprovedIdentityCount++
		}
	}
	result.ControlledPilotAllowed = result.RequiredIdentityCount > 0 &&
		result.ApprovedIdentityCount == result.RequiredIdentityCount &&
		result.MissingLaneCount == 0 && result.StaleCount == 0 &&
		result.RevisionRequiredCount == 0 && result.EscalationRequiredCount == 0
	return result
}

func EvaluateAIReviewEligibility(ctx context.Context, exec queryExecutor, identities []ReviewIdentity) (AIReviewEligibility, error) {
	reviews, err := queryReviewEvidence(ctx, exec, identities)
	if err != nil {
		return AIReviewEligibility{}, err
	}
	return EvaluateReviewSet(identities, reviews), nil
}

func ValidateAIReviewEvidence(review AIReviewEvidence) error {
	for name, value := range map[string]string{
		"content id":              review.ContentID,
		"content revision":        review.ContentRevision,
		"pack id":                 review.PackID,
		"subject":                 review.Subject,
		"rubric revision":         review.RubricRevision,
		"source-set revision":     review.SourceSetRevision,
		"reviewer implementation": review.ReviewerImplementation,
		"model identifier":        review.ModelIdentifier,
		"evidence notes":          review.EvidenceNotes,
	} {
		if strings.TrimSpace(value) == "" {
			return invalidConfig(name + " is required")
		}
	}
	if !narrationSHA256Pattern.MatchString(review.ContentHash) {
		return invalidConfig("content hash must be a lowercase sha256 value")
	}
	if review.ContentType != "pack" && review.ContentType != "variant" && review.ContentType != "variant_family" {
		return invalidConfig("content type is not supported")
	}
	if review.YearGroup < 1 || review.YearGroup > 7 {
		return invalidConfig("year group must be between 1 and 7")
	}
	if review.LaneID != AIReviewLaneCurriculum && review.LaneID != AIReviewLaneSEND {
		return invalidConfig("review lane must identify an AI curriculum or AI SEND lead")
	}
	if !oneOf(review.Status, "approved", "approved_with_observation", "revision_required", "escalation_required") {
		return invalidConfig("review status is not a terminal governed decision")
	}
	if !oneOf(review.RiskTier, "tier_1", "tier_2", "tier_3") {
		return invalidConfig("review risk tier is not supported")
	}
	if review.Confidence < 0 || review.Confidence > 1 {
		return invalidConfig("review confidence must be between 0 and 1")
	}
	if len(review.CriterionResults) == 0 {
		return invalidConfig("criterion results are required")
	}
	if len(review.SourceIDs) == 0 {
		return invalidConfig("at least one source id is required")
	}
	if review.ContentType == "pack" && len(review.ReviewedVariantIDs) != 0 {
		return invalidConfig("pack review evidence cannot claim variant coverage")
	}
	if review.ContentType != "pack" && len(review.ReviewedVariantIDs) == 0 {
		return invalidConfig("variant review evidence must identify covered variants")
	}
	seenVariants := map[string]bool{}
	for _, variantID := range review.ReviewedVariantIDs {
		variantID = strings.TrimSpace(variantID)
		if variantID == "" || seenVariants[variantID] {
			return invalidConfig("reviewed variant ids must be non-empty and unique")
		}
		seenVariants[variantID] = true
	}
	lowerNotes := strings.ToLower(review.EvidenceNotes)
	for _, claim := range []string{"teacher approved", "send specialist approved", "human reviewed", "safeguarding approved"} {
		if strings.Contains(lowerNotes, claim) {
			return invalidConfig("AI review evidence cannot claim human approval")
		}
	}
	for index, finding := range review.Findings {
		if err := validateAIReviewFinding(finding); err != nil {
			return fmt.Errorf("%w: finding %d: %v", ErrInvalidConfiguration, index+1, err)
		}
	}
	return nil
}

func validateAIReviewFinding(finding AIReviewFinding) error {
	if strings.TrimSpace(finding.CriterionID) == "" || strings.TrimSpace(finding.FindingCode) == "" || strings.TrimSpace(finding.Rationale) == "" {
		return errors.New("criterion id, finding code and rationale are required")
	}
	if !oneOf(finding.Severity, "observation", "blocking", "escalation") {
		return errors.New("finding severity is not supported")
	}
	if finding.Severity != "observation" && len(finding.RequiredRevisions) == 0 {
		return errors.New("blocking and escalation findings require revisions")
	}
	return nil
}

func oneOf(value string, allowed ...string) bool {
	for _, candidate := range allowed {
		if value == candidate {
			return true
		}
	}
	return false
}

func comparableAIReview(review AIReviewEvidence) AIReviewEvidence {
	review.ID = ""
	review.CreatedAt = ""
	review.Stale = false
	if review.CriterionResults == nil {
		review.CriterionResults = map[string]any{}
	}
	if review.SourceIDs == nil {
		review.SourceIDs = []string{}
	}
	if review.ReviewedVariantIDs == nil {
		review.ReviewedVariantIDs = []string{}
	}
	for index := range review.ReviewedVariantIDs {
		review.ReviewedVariantIDs[index] = strings.TrimSpace(review.ReviewedVariantIDs[index])
	}
	if review.Findings == nil {
		review.Findings = []AIReviewFinding{}
	}
	for index := range review.Findings {
		review.Findings[index].ID = ""
		review.Findings[index].EvidenceID = ""
		review.Findings[index].CreatedAt = ""
		if review.Findings[index].AffectedFields == nil {
			review.Findings[index].AffectedFields = []string{}
		}
		if review.Findings[index].RequiredRevisions == nil {
			review.Findings[index].RequiredRevisions = []string{}
		}
	}
	return review
}

func sameAIReviewBody(left AIReviewEvidence, right AIReviewEvidence) bool {
	leftHash, leftErr := requestHash(comparableAIReview(left))
	rightHash, rightErr := requestHash(comparableAIReview(right))
	return leftErr == nil && rightErr == nil && leftHash == rightHash
}

func (r *PostgresRepository) SaveAIReviewEvidence(ctx context.Context, review AIReviewEvidence, idempotencyKey string) (AIReviewEvidence, error) {
	if err := ValidateAIReviewEvidence(review); err != nil {
		return review, err
	}
	review = comparableAIReview(review)
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return review, err
	}
	defer tx.Rollback(ctx)

	actor := review.LaneID + ":" + review.ReviewerImplementation
	replay, err := beginIdempotency(ctx, tx, "ai.content-review", actor, idempotencyKey, review)
	if err != nil {
		return review, err
	}
	if replay.Found {
		if err := json.Unmarshal(replay.Response, &review); err != nil {
			return review, err
		}
		return review, nil
	}

	criterionResults, err := json.Marshal(review.CriterionResults)
	if err != nil {
		return review, err
	}
	sourceIDs, err := json.Marshal(review.SourceIDs)
	if err != nil {
		return review, err
	}
	reviewedVariantIDs, err := json.Marshal(review.ReviewedVariantIDs)
	if err != nil {
		return review, err
	}
	var createdAt time.Time
	err = tx.QueryRow(ctx, `
		INSERT INTO ai_review_evidence(
			content_id,content_type,content_revision,content_hash,pack_id,year_group,subject,
			lane_id,status,risk_tier,rubric_revision,source_set_revision,reviewer_implementation,
			model_identifier,confidence,criterion_results,source_ids,reviewed_variant_ids,evidence_notes,supersedes_id
		) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16::jsonb,$17::jsonb,$18::jsonb,$19,NULLIF($20,'')::uuid)
		ON CONFLICT(content_id,content_hash,lane_id,rubric_revision,source_set_revision,reviewer_implementation)
		DO NOTHING
		RETURNING id::text,created_at
	`, review.ContentID, review.ContentType, review.ContentRevision, review.ContentHash,
		review.PackID, review.YearGroup, review.Subject, review.LaneID, review.Status,
		review.RiskTier, review.RubricRevision, review.SourceSetRevision,
		review.ReviewerImplementation, review.ModelIdentifier, review.Confidence,
		criterionResults, sourceIDs, reviewedVariantIDs, review.EvidenceNotes, review.SupersedesID,
	).Scan(&review.ID, &createdAt)
	if errors.Is(err, pgx.ErrNoRows) {
		existing, findErr := r.aiReviewByIdentity(ctx, tx, ReviewIdentityFromEvidence(review), review.LaneID)
		if findErr != nil {
			return review, findErr
		}
		if !sameAIReviewBody(existing, review) {
			return review, ErrAIReviewIdentityConflict
		}
		if err := completeIdempotency(ctx, tx, "ai.content-review", actor, idempotencyKey, existing); err != nil {
			return review, err
		}
		if err := tx.Commit(ctx); err != nil {
			return review, err
		}
		return existing, nil
	}
	if err != nil {
		return review, err
	}
	review.CreatedAt = createdAt.UTC().Format(time.RFC3339Nano)

	for index := range review.Findings {
		finding := &review.Findings[index]
		affectedFields, marshalErr := json.Marshal(finding.AffectedFields)
		if marshalErr != nil {
			return review, marshalErr
		}
		requiredRevisions, marshalErr := json.Marshal(finding.RequiredRevisions)
		if marshalErr != nil {
			return review, marshalErr
		}
		var findingCreatedAt time.Time
		if err := tx.QueryRow(ctx, `
			INSERT INTO ai_review_findings(
				evidence_id,criterion_id,severity,finding_code,affected_fields,rationale,required_revisions
			) VALUES($1::uuid,$2,$3,$4,$5::jsonb,$6,$7::jsonb)
			RETURNING id::text,created_at
		`, review.ID, finding.CriterionID, finding.Severity, finding.FindingCode,
			affectedFields, finding.Rationale, requiredRevisions,
		).Scan(&finding.ID, &findingCreatedAt); err != nil {
			return review, err
		}
		finding.EvidenceID = review.ID
		finding.CreatedAt = findingCreatedAt.UTC().Format(time.RFC3339Nano)
	}
	if _, err := tx.Exec(ctx, `
		INSERT INTO audit_logs(action,entity_type,entity_id,payload)
		VALUES('review','ai_review_evidence',$1,$2::jsonb)
	`, review.ID, mustJSON(map[string]any{
		"content_id": review.ContentID, "content_hash": review.ContentHash,
		"pack_id": review.PackID, "lane_id": review.LaneID, "status": review.Status,
		"rubric_revision": review.RubricRevision, "source_set_revision": review.SourceSetRevision,
		"reviewer_implementation": review.ReviewerImplementation, "model_identifier": review.ModelIdentifier,
	})); err != nil {
		return review, err
	}
	if err := completeIdempotency(ctx, tx, "ai.content-review", actor, idempotencyKey, review); err != nil {
		return review, err
	}
	if err := tx.Commit(ctx); err != nil {
		return review, err
	}
	return review, nil
}

func (r *PostgresRepository) aiReviewByIdentity(ctx context.Context, exec queryExecutor, identity ReviewIdentity, laneID string) (AIReviewEvidence, error) {
	review, err := scanAIReviewEvidence(exec.QueryRow(ctx, `
		SELECT e.id::text,e.content_id,e.content_type,e.content_revision,e.content_hash,e.pack_id,e.year_group,
		       e.subject,e.lane_id,e.status,e.risk_tier,e.rubric_revision,e.source_set_revision,
		       e.reviewer_implementation,e.model_identifier,e.confidence,e.criterion_results,e.source_ids,
		       e.reviewed_variant_ids,e.evidence_notes,COALESCE(e.supersedes_id::text,''),e.created_at,
		       EXISTS(SELECT 1 FROM ai_review_evidence newer WHERE newer.supersedes_id=e.id)
		FROM ai_review_evidence e
		WHERE content_id=$1 AND content_hash=$2 AND lane_id=$3 AND rubric_revision=$4
		  AND source_set_revision=$5 AND reviewer_implementation=$6
	`, identity.ContentID, identity.ContentHash, laneID, identity.RubricRevision,
		identity.SourceSetRevision, identity.ReviewerImplementation))
	if err != nil {
		return review, err
	}
	reviews := []AIReviewEvidence{review}
	if err := loadAIReviewFindings(ctx, exec, reviews); err != nil {
		return review, err
	}
	return reviews[0], nil
}

func (r *PostgresRepository) ListAIReviewEvidence(ctx context.Context, query AIReviewQuery) (AIReviewPage, error) {
	if query.Limit <= 0 {
		query.Limit = 100
	}
	if query.Limit > 200 {
		query.Limit = 200
	}
	if query.YearGroup < 0 || query.YearGroup > 7 {
		return AIReviewPage{}, invalidConfig("review year-group filter must be between 1 and 7")
	}
	if query.LaneID != "" && !oneOf(query.LaneID, AIReviewLaneCurriculum, AIReviewLaneSEND) {
		return AIReviewPage{}, invalidConfig("review lane filter is not supported")
	}
	if query.Status != "" && !oneOf(query.Status, "approved", "approved_with_observation", "revision_required", "escalation_required") {
		return AIReviewPage{}, invalidConfig("review status filter is not supported")
	}
	if query.RiskTier != "" && !oneOf(query.RiskTier, "tier_1", "tier_2", "tier_3") {
		return AIReviewPage{}, invalidConfig("review risk filter is not supported")
	}
	if query.BeforeCreatedAt.IsZero() != (strings.TrimSpace(query.BeforeID) == "") {
		return AIReviewPage{}, invalidConfig("review cursor time and id must be supplied together")
	}
	var beforeCreatedAt any
	var beforeID any
	if !query.BeforeCreatedAt.IsZero() {
		beforeCreatedAt = query.BeforeCreatedAt
		beforeID = query.BeforeID
	}
	rows, err := r.db.Query(ctx, `
		SELECT e.id::text,e.content_id,e.content_type,e.content_revision,e.content_hash,e.pack_id,e.year_group,
		       e.subject,e.lane_id,e.status,e.risk_tier,e.rubric_revision,e.source_set_revision,
		       e.reviewer_implementation,e.model_identifier,e.confidence,e.criterion_results,e.source_ids,
		       e.reviewed_variant_ids,e.evidence_notes,COALESCE(e.supersedes_id::text,''),e.created_at,
		       EXISTS(SELECT 1 FROM ai_review_evidence newer WHERE newer.supersedes_id=e.id)
		FROM ai_review_evidence e
		WHERE ($1='' OR e.lane_id=$1)
		  AND ($2='' OR e.status=$2)
		  AND ($3='' OR e.risk_tier=$3)
		  AND ($4=0 OR e.year_group=$4)
		  AND ($5='' OR e.subject=$5)
		  AND ($6='' OR e.pack_id=$6)
		  AND ($7::timestamptz IS NULL OR (e.created_at,e.id) < ($7::timestamptz,$8::uuid))
		ORDER BY e.created_at DESC,e.id DESC
		LIMIT $9
	`, strings.TrimSpace(query.LaneID), strings.TrimSpace(query.Status), strings.TrimSpace(query.RiskTier),
		query.YearGroup, strings.TrimSpace(query.Subject), strings.TrimSpace(query.PackID),
		beforeCreatedAt, beforeID, query.Limit+1)
	if err != nil {
		return AIReviewPage{}, err
	}
	defer rows.Close()
	items := make([]AIReviewEvidence, 0, query.Limit+1)
	createdTimes := make([]time.Time, 0, query.Limit+1)
	for rows.Next() {
		item, scanErr := scanAIReviewEvidence(rows)
		if scanErr != nil {
			return AIReviewPage{}, scanErr
		}
		createdAt, parseErr := time.Parse(time.RFC3339Nano, item.CreatedAt)
		if parseErr != nil {
			return AIReviewPage{}, parseErr
		}
		items = append(items, item)
		createdTimes = append(createdTimes, createdAt)
	}
	if err := rows.Err(); err != nil {
		return AIReviewPage{}, err
	}
	page := AIReviewPage{Items: items}
	if len(page.Items) > query.Limit {
		page.Items = page.Items[:query.Limit]
		page.NextCursor = encodeAIReviewCursor(createdTimes[query.Limit-1], page.Items[query.Limit-1].ID)
	}
	if err := loadAIReviewFindings(ctx, r.db, page.Items); err != nil {
		return AIReviewPage{}, err
	}
	return page, nil
}

func loadAIReviewFindings(ctx context.Context, exec queryExecutor, reviews []AIReviewEvidence) error {
	if len(reviews) == 0 {
		return nil
	}
	indexes := make(map[string]int, len(reviews))
	evidenceIDs := make([]string, 0, len(reviews))
	for index := range reviews {
		reviews[index].Findings = []AIReviewFinding{}
		indexes[reviews[index].ID] = index
		evidenceIDs = append(evidenceIDs, reviews[index].ID)
	}
	rows, err := exec.Query(ctx, `
		SELECT id::text,evidence_id::text,criterion_id,severity,finding_code,
		       affected_fields,rationale,required_revisions,created_at
		FROM ai_review_findings
		WHERE evidence_id::text = ANY($1)
		ORDER BY evidence_id,created_at,id
	`, evidenceIDs)
	if err != nil {
		return err
	}
	defer rows.Close()
	for rows.Next() {
		var finding AIReviewFinding
		var affectedRaw, revisionsRaw []byte
		var createdAt time.Time
		if err := rows.Scan(&finding.ID, &finding.EvidenceID, &finding.CriterionID, &finding.Severity,
			&finding.FindingCode, &affectedRaw, &finding.Rationale, &revisionsRaw, &createdAt); err != nil {
			return err
		}
		finding.AffectedFields = []string{}
		if err := json.Unmarshal(affectedRaw, &finding.AffectedFields); err != nil {
			return err
		}
		finding.RequiredRevisions = []string{}
		if err := json.Unmarshal(revisionsRaw, &finding.RequiredRevisions); err != nil {
			return err
		}
		finding.CreatedAt = createdAt.UTC().Format(time.RFC3339Nano)
		if index, ok := indexes[finding.EvidenceID]; ok {
			reviews[index].Findings = append(reviews[index].Findings, finding)
		}
	}
	return rows.Err()
}

func (r *PostgresRepository) SummariseAIReviews(ctx context.Context) (AIReviewSummary, error) {
	summary := AIReviewSummary{
		ByLane:     map[string]int{},
		ByStatus:   map[string]int{},
		ByRiskTier: map[string]int{},
	}
	rows, err := r.db.Query(ctx, `
		WITH current_evidence AS (
			SELECT e.* FROM ai_review_evidence e
			WHERE NOT EXISTS (SELECT 1 FROM ai_review_evidence newer WHERE newer.supersedes_id=e.id)
		)
		SELECT lane_id,status,risk_tier,count(*)
		FROM current_evidence
		GROUP BY lane_id,status,risk_tier
		ORDER BY lane_id,status,risk_tier
	`)
	if err != nil {
		return summary, err
	}
	for rows.Next() {
		var laneID, status, riskTier string
		var count int
		if err := rows.Scan(&laneID, &status, &riskTier, &count); err != nil {
			rows.Close()
			return summary, err
		}
		summary.Total += count
		summary.ByLane[laneID] += count
		summary.ByStatus[status] += count
		summary.ByRiskTier[riskTier] += count
	}
	if err := rows.Err(); err != nil {
		rows.Close()
		return summary, err
	}
	rows.Close()
	if err := r.db.QueryRow(ctx, `
		WITH current_evidence AS (
			SELECT e.* FROM ai_review_evidence e
			WHERE NOT EXISTS (SELECT 1 FROM ai_review_evidence newer WHERE newer.supersedes_id=e.id)
		), identities AS (
			SELECT content_id,content_hash,rubric_revision,source_set_revision,reviewer_implementation,
			       count(*) FILTER (WHERE lane_id='ai_curriculum_lead' AND status IN ('approved','approved_with_observation')) AS curriculum_approved,
			       count(*) FILTER (WHERE lane_id='ai_send_lead' AND status IN ('approved','approved_with_observation')) AS send_approved
			FROM current_evidence
			GROUP BY content_id,content_hash,rubric_revision,source_set_revision,reviewer_implementation
		), covered_variants AS (
			SELECT DISTINCT jsonb_array_elements_text(reviewed_variant_ids) AS variant_id
			FROM current_evidence
		)
		SELECT
			(SELECT count(DISTINCT pack_id) FROM current_evidence),
			(SELECT count(*) FROM covered_variants),
			(SELECT count(*) FROM ai_review_evidence e WHERE EXISTS (SELECT 1 FROM ai_review_evidence newer WHERE newer.supersedes_id=e.id)),
			COALESCE((SELECT count(*) > 0 AND bool_and(curriculum_approved > 0 AND send_approved > 0) FROM identities),false),
			COALESCE((SELECT CASE WHEN count(DISTINCT rubric_revision)=1 THEN min(rubric_revision) ELSE '' END FROM current_evidence),''),
			COALESCE((SELECT CASE WHEN count(DISTINCT source_set_revision)=1 THEN min(source_set_revision) ELSE '' END FROM current_evidence),''),
			COALESCE((SELECT CASE WHEN count(DISTINCT reviewer_implementation)=1 THEN min(reviewer_implementation) ELSE '' END FROM current_evidence),'')
	`).Scan(&summary.PackCount, &summary.VariantCount, &summary.Stale, &summary.ControlledPilotAllowed,
		&summary.RubricRevision, &summary.SourceSetRevision, &summary.ReviewerImplementation); err != nil {
		return summary, err
	}
	if err := r.db.QueryRow(ctx, `
		SELECT count(*) FILTER (WHERE severity='blocking'),
		       count(*) FILTER (WHERE severity='escalation')
		FROM ai_review_findings
	`).Scan(&summary.BlockingFindings, &summary.EscalationFindings); err != nil {
		return summary, err
	}
	return summary, nil
}

func encodeAIReviewCursor(createdAt time.Time, id string) string {
	payload, _ := json.Marshal(map[string]string{"created_at": createdAt.UTC().Format(time.RFC3339Nano), "id": id})
	return base64.RawURLEncoding.EncodeToString(payload)
}

func DecodeAIReviewCursor(cursor string) (time.Time, string, error) {
	raw, err := base64.RawURLEncoding.DecodeString(strings.TrimSpace(cursor))
	if err != nil {
		return time.Time{}, "", invalidConfig("invalid review cursor")
	}
	var value struct {
		CreatedAt string `json:"created_at"`
		ID        string `json:"id"`
	}
	if err := json.Unmarshal(raw, &value); err != nil || strings.TrimSpace(value.ID) == "" {
		return time.Time{}, "", invalidConfig("invalid review cursor")
	}
	createdAt, err := time.Parse(time.RFC3339Nano, value.CreatedAt)
	if err != nil {
		return time.Time{}, "", invalidConfig("invalid review cursor")
	}
	return createdAt, value.ID, nil
}

// queryReviewEvidence is shared by repository reads and transactional release gates.
func queryReviewEvidence(ctx context.Context, exec queryExecutor, identities []ReviewIdentity) ([]AIReviewEvidence, error) {
	if len(identities) == 0 {
		return []AIReviewEvidence{}, nil
	}
	contentIDs := make([]string, 0, len(identities))
	for _, identity := range identities {
		contentIDs = append(contentIDs, identity.ContentID)
	}
	rows, err := exec.Query(ctx, `
		SELECT e.id::text,e.content_id,e.content_type,e.content_revision,e.content_hash,e.pack_id,e.year_group,
		       e.subject,e.lane_id,e.status,e.risk_tier,e.rubric_revision,e.source_set_revision,
		       e.reviewer_implementation,e.model_identifier,e.confidence,e.criterion_results,e.source_ids,
		       e.reviewed_variant_ids,e.evidence_notes,COALESCE(e.supersedes_id::text,''),e.created_at,
		       EXISTS(SELECT 1 FROM ai_review_evidence newer WHERE newer.supersedes_id=e.id)
		FROM ai_review_evidence e
		WHERE e.content_id = ANY($1)
		ORDER BY e.created_at DESC,e.id DESC
	`, contentIDs)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	reviews := []AIReviewEvidence{}
	for rows.Next() {
		review, err := scanAIReviewEvidence(rows)
		if err != nil {
			return nil, err
		}
		reviews = append(reviews, review)
	}
	return reviews, rows.Err()
}

func scanAIReviewEvidence(row pgx.Row) (AIReviewEvidence, error) {
	var review AIReviewEvidence
	var criterionRaw, sourceRaw, reviewedVariantRaw []byte
	var createdAt time.Time
	err := row.Scan(
		&review.ID, &review.ContentID, &review.ContentType, &review.ContentRevision, &review.ContentHash,
		&review.PackID, &review.YearGroup, &review.Subject, &review.LaneID, &review.Status,
		&review.RiskTier, &review.RubricRevision, &review.SourceSetRevision,
		&review.ReviewerImplementation, &review.ModelIdentifier, &review.Confidence,
		&criterionRaw, &sourceRaw, &reviewedVariantRaw, &review.EvidenceNotes, &review.SupersedesID, &createdAt, &review.Stale,
	)
	if err != nil {
		return review, err
	}
	review.CriterionResults = map[string]any{}
	if err := json.Unmarshal(criterionRaw, &review.CriterionResults); err != nil {
		return review, err
	}
	review.SourceIDs = []string{}
	if err := json.Unmarshal(sourceRaw, &review.SourceIDs); err != nil {
		return review, err
	}
	review.ReviewedVariantIDs = []string{}
	if err := json.Unmarshal(reviewedVariantRaw, &review.ReviewedVariantIDs); err != nil {
		return review, err
	}
	review.Findings = []AIReviewFinding{}
	review.CreatedAt = createdAt.UTC().Format(time.RFC3339Nano)
	return review, nil
}
