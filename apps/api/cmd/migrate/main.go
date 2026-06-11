package main

import (
	"context"
	"flag"
	"log/slog"
	"os"
	"time"

	"github.com/ArowuTest/nexuslearn/apps/api/internal/database"
)

func main() {
	dir := flag.String("dir", "migrations", "directory containing .up.sql migration files")
	flag.Parse()

	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
	defer cancel()

	db, err := database.Connect(ctx)
	if err != nil {
		slog.Error("connect database", "error", err)
		os.Exit(1)
	}
	if db == nil {
		slog.Error("DATABASE_URL is required to run migrations")
		os.Exit(1)
	}
	defer db.Close()

	if err := database.RunMigrations(ctx, db, *dir); err != nil {
		slog.Error("migration failed", "error", err)
		os.Exit(1)
	}
	slog.Info("migrations complete")
}
