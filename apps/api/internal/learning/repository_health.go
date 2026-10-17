package learning

import (
	"context"
	"time"
)

func (r *PostgresRepository) Ping(ctx context.Context) error {
	pingCtx, cancel := context.WithTimeout(ctx, 2*time.Second)
	defer cancel()
	return r.db.Ping(pingCtx)
}
