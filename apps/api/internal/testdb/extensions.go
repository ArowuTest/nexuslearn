// Package testdb contains bootstrap helpers for disposable integration databases.
package testdb

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5/pgxpool"
)

// PrepareExtensions installs database-global objects outside disposable test
// schemas. Package test binaries run concurrently, so IF NOT EXISTS alone is
// insufficient: installation must be serialized across database sessions.
func PrepareExtensions(ctx context.Context, pool *pgxpool.Pool) error {
	tx, err := pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(context.Background())
	if _, err := tx.Exec(ctx, `SELECT pg_advisory_xact_lock(1818586222, 1702392948)`); err != nil {
		return err
	}
	if _, err := tx.Exec(ctx, `CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public`); err != nil {
		return err
	}
	var schema string
	if err := tx.QueryRow(ctx, `SELECT n.nspname FROM pg_extension e JOIN pg_namespace n ON n.oid=e.extnamespace WHERE e.extname='pgcrypto'`).Scan(&schema); err != nil {
		return err
	}
	if schema != "public" {
		return fmt.Errorf("test pgcrypto is installed in %q; use a fresh disposable database instead of moving shared extension objects", schema)
	}
	return tx.Commit(ctx)
}
