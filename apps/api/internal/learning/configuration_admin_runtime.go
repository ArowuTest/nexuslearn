package learning

import (
	"context"
	"encoding/json"
	"time"

	"github.com/jackc/pgx/v5"
)

func (r *PostgresRepository) ListWorldPage(ctx context.Context, query AdminRuntimePageQuery) (WorldPage, error) {
	bounds, err := newAdminRuntimeWorldBounds(query)
	if err != nil {
		return WorldPage{}, err
	}
	const selectSQL = `
		SELECT key, name, COALESCE(year_group, 0), theme, config, enabled, updated_at
		FROM worlds
	`
	var rows pgx.Rows
	if bounds.Cursor == nil {
		rows, err = r.db.Query(ctx, selectSQL+`ORDER BY COALESCE(year_group, 0), key LIMIT $1`, bounds.QueryLimit)
	} else {
		rows, err = r.db.Query(ctx, selectSQL+`
			WHERE COALESCE(year_group, 0) > $1
			   OR (COALESCE(year_group, 0) = $1 AND key > $2)
			ORDER BY COALESCE(year_group, 0), key
			LIMIT $3`, bounds.Cursor.YearGroup, bounds.Cursor.Key, bounds.QueryLimit)
	}
	if err != nil {
		return WorldPage{}, err
	}
	defer rows.Close()
	worlds := []WorldConfig{}
	for rows.Next() {
		world, err := scanWorld(rows)
		if err != nil {
			return WorldPage{}, err
		}
		worlds = append(worlds, world)
	}
	if err := rows.Err(); err != nil {
		return WorldPage{}, err
	}
	return newWorldPage(worlds, bounds.Limit)
}

func (r *PostgresRepository) ListFeatureFlagPage(ctx context.Context, query AdminRuntimePageQuery) (FeatureFlagPage, error) {
	bounds, err := newAdminRuntimeFlagBounds(query)
	if err != nil {
		return FeatureFlagPage{}, err
	}
	const selectSQL = `SELECT key, enabled, config, description, updated_at FROM feature_flags`
	var rows pgx.Rows
	if bounds.Cursor == nil {
		rows, err = r.db.Query(ctx, selectSQL+` ORDER BY key LIMIT $1`, bounds.QueryLimit)
	} else {
		rows, err = r.db.Query(ctx, selectSQL+` WHERE key > $1 ORDER BY key LIMIT $2`, bounds.Cursor.Key, bounds.QueryLimit)
	}
	if err != nil {
		return FeatureFlagPage{}, err
	}
	defer rows.Close()
	flags := []FeatureFlag{}
	for rows.Next() {
		var flag FeatureFlag
		var raw []byte
		var updatedAt time.Time
		if err := rows.Scan(&flag.Key, &flag.Enabled, &raw, &flag.Description, &updatedAt); err != nil {
			return FeatureFlagPage{}, err
		}
		flag.Config = map[string]any{}
		if err := json.Unmarshal(raw, &flag.Config); err != nil {
			return FeatureFlagPage{}, err
		}
		flag.UpdatedAt = updatedAt.UTC().Format(time.RFC3339Nano)
		flags = append(flags, flag)
	}
	if err := rows.Err(); err != nil {
		return FeatureFlagPage{}, err
	}
	return newFeatureFlagPage(flags, bounds.Limit)
}
