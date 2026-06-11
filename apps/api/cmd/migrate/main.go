package main

import (
	"context"
	"errors"
	"flag"
	"fmt"
	"log/slog"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

func main() {
	dir := flag.String("dir", "migrations", "directory containing .up.sql migration files")
	flag.Parse()

	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		slog.Error("DATABASE_URL is required to run migrations")
		os.Exit(1)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
	defer cancel()

	db, err := pgxpool.New(ctx, dsn)
	if err != nil {
		slog.Error("connect database", "error", err)
		os.Exit(1)
	}
	defer db.Close()

	if err := run(ctx, db, *dir); err != nil {
		slog.Error("migration failed", "error", err)
		os.Exit(1)
	}
	slog.Info("migrations complete")
}

func run(ctx context.Context, db *pgxpool.Pool, dir string) error {
	if _, err := db.Exec(ctx, `
		CREATE TABLE IF NOT EXISTS schema_migrations (
			version text PRIMARY KEY,
			applied_at timestamptz NOT NULL DEFAULT now()
		)
	`); err != nil {
		return err
	}

	files, err := migrationFiles(dir)
	if err != nil {
		return err
	}
	for _, file := range files {
		version := strings.TrimSuffix(filepath.Base(file), ".up.sql")
		applied, err := isApplied(ctx, db, version)
		if err != nil {
			return err
		}
		if applied {
			slog.Info("migration already applied", "version", version)
			continue
		}

		sqlBytes, err := os.ReadFile(file)
		if err != nil {
			return err
		}
		tx, err := db.Begin(ctx)
		if err != nil {
			return err
		}
		if _, err := tx.Exec(ctx, string(sqlBytes)); err != nil {
			_ = tx.Rollback(ctx)
			return fmt.Errorf("%s: %w", version, err)
		}
		if _, err := tx.Exec(ctx, `INSERT INTO schema_migrations (version) VALUES ($1)`, version); err != nil {
			_ = tx.Rollback(ctx)
			return err
		}
		if err := tx.Commit(ctx); err != nil {
			return err
		}
		slog.Info("migration applied", "version", version)
	}
	return nil
}

func migrationFiles(dir string) ([]string, error) {
	entries, err := os.ReadDir(dir)
	if err != nil {
		return nil, err
	}
	var files []string
	for _, entry := range entries {
		if entry.IsDir() || !strings.HasSuffix(entry.Name(), ".up.sql") {
			continue
		}
		files = append(files, filepath.Join(dir, entry.Name()))
	}
	sort.Strings(files)
	if len(files) == 0 {
		return nil, errors.New("no .up.sql migrations found")
	}
	return files, nil
}

func isApplied(ctx context.Context, db *pgxpool.Pool, version string) (bool, error) {
	var exists bool
	err := db.QueryRow(ctx, `SELECT EXISTS (SELECT 1 FROM schema_migrations WHERE version=$1)`, version).Scan(&exists)
	return exists, err
}
