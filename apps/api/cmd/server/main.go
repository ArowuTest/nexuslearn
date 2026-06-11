package main

import (
	"log/slog"
	"net/http"
	"os"

	"github.com/ArowuTest/nexuslearn/apps/api/internal/server"
)

func main() {
	logger := slog.New(slog.NewJSONHandler(os.Stdout, nil))
	slog.SetDefault(logger)

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	srv := server.New()
	slog.Info("nexuslearn api starting", "port", port)
	if err := http.ListenAndServe(":"+port, srv); err != nil {
		slog.Error("server exited", "error", err)
		os.Exit(1)
	}
}
