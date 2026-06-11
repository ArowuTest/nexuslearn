package main

import (
	"context"
	"log/slog"
	"net/http"
	"os"

	"github.com/ArowuTest/nexuslearn/apps/api/internal/database"
	"github.com/ArowuTest/nexuslearn/apps/api/internal/learning"
	"github.com/ArowuTest/nexuslearn/apps/api/internal/server"
)

func main() {
	logger := slog.New(slog.NewJSONHandler(os.Stdout, nil))
	slog.SetDefault(logger)

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	db, err := database.Connect(context.Background())
	if err != nil {
		slog.Error("database connection failed", "error", err)
		os.Exit(1)
	}
	if db != nil {
		defer db.Close()
	}
	if db != nil && os.Getenv("AUTO_MIGRATE") == "true" {
		if err := database.RunMigrations(context.Background(), db, "migrations"); err != nil {
			slog.Error("auto migration failed", "error", err)
			os.Exit(1)
		}
	}

	persistence := "memory"
	if db != nil {
		persistence = "postgres"
	}

	repo := learning.NewRepository(db)
	srv := server.New(repo, persistence)
	slog.Info("nexuslearn api starting", "port", port, "persistence", persistence)
	if err := http.ListenAndServe(":"+port, srv); err != nil {
		slog.Error("server exited", "error", err)
		os.Exit(1)
	}
}
