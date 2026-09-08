package learning

import (
	"context"
)

// ListProgressObjectives returns the bounded curriculum slice needed to build
// one learner's progress report. It keeps the learner's current/nearby years
// visible for progression and spaced revision, while also retaining any
// objective for which that learner already has mastery evidence. This avoids
// loading the entire curriculum catalogue for every parent, school or pupil
// report without hiding a mastered objective outside the local year window.
func (r *PostgresRepository) ListProgressObjectives(ctx context.Context, studentID string, yearGroup int) ([]Objective, error) {
	if studentID == "" {
		return []Objective{}, nil
	}
	if yearGroup < 1 {
		yearGroup = 1
	}
	if yearGroup > 7 {
		yearGroup = 7
	}
	lowerYear := maxInt(1, yearGroup-2)
	upperYear := yearGroup + 1
	if upperYear > 7 {
		upperYear = 7
	}
	rows, err := r.db.Query(ctx, `
		WITH active_release AS (
			SELECT id
			FROM content_releases
			WHERE channel='live' AND status='applied'
			ORDER BY applied_at DESC NULLS LAST, id DESC
			LIMIT 1
		), learner_mastery_objectives AS (
			SELECT m.objective_id
			FROM student_objective_mastery m
			JOIN students s ON s.id=m.student_id
			WHERE s.external_ref=$1
		), objective_scope AS (
			SELECT
				o.id, o.year_group, o.subject, o.strand, o.topic, o.statement,
				o.parent_explanation, o.teacher_evidence, o.expected_mastery, o.secure_mastery,
				array_to_json(o.retention_days)::text AS retention_days_json,
				array_to_json(o.required_formats)::text AS required_formats_json
			FROM curriculum_objectives o
			LEFT JOIN active_release ON TRUE
			WHERE (active_release.id IS NULL OR o.content_release_id=active_release.id)
			  AND (o.year_group BETWEEN $2 AND $3 OR o.id IN (SELECT objective_id FROM learner_mastery_objectives))
		), prerequisites AS (
			SELECT p.objective_id, json_agg(p.prerequisite_id ORDER BY p.prerequisite_id) AS items_json
			FROM objective_prerequisites p
			JOIN objective_scope scope ON scope.id=p.objective_id
			GROUP BY p.objective_id
		), misconceptions AS (
			SELECT m.objective_id, json_agg(m.description ORDER BY m.id) AS items_json
			FROM objective_misconceptions m
			JOIN objective_scope scope ON scope.id=m.objective_id
			GROUP BY m.objective_id
		)
		SELECT
			scope.id, scope.year_group, scope.subject, scope.strand, scope.topic, scope.statement,
			scope.parent_explanation, scope.teacher_evidence, scope.expected_mastery, scope.secure_mastery,
			scope.retention_days_json, scope.required_formats_json,
			COALESCE(prerequisites.items_json, '[]'::json)::text,
			COALESCE(misconceptions.items_json, '[]'::json)::text
		FROM objective_scope scope
		LEFT JOIN prerequisites ON prerequisites.objective_id=scope.id
		LEFT JOIN misconceptions ON misconceptions.objective_id=scope.id
		ORDER BY scope.year_group, scope.subject, scope.strand, scope.topic, scope.id
	`, studentID, lowerYear, upperYear)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	objectives := make([]Objective, 0)
	for rows.Next() {
		objective, err := scanObjective(rows)
		if err != nil {
			return nil, err
		}
		objectives = append(objectives, objective)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return objectives, nil
}

var _ interface {
	ListProgressObjectives(context.Context, string, int) ([]Objective, error)
} = (*PostgresRepository)(nil)
