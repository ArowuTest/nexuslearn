package learning

import "context"

// Ping reports whether Postgres is accepting queries.
func (r *PostgresRepository) Ping(ctx context.Context) error {
	return r.db.Ping(ctx)
}
