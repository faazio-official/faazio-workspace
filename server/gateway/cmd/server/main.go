// Command server runs the Faazio MVP modular monolith: one chi binary hosting all
// six bounded contexts over Supabase (Postgres) + MongoDB + Aiven Valkey.
// See docs/architecture/mvp-backend.md and monolith-breakdown.md.
package main

import (
	"context"
	"errors"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/faazio/server/gateway/internal/notifications"
	"github.com/faazio/server/gateway/internal/platform/cache"
	"github.com/faazio/server/gateway/internal/platform/config"
	"github.com/faazio/server/gateway/internal/platform/db"
	"github.com/faazio/server/gateway/internal/platform/mongo"
	"github.com/faazio/server/gateway/internal/server"
)

func main() {
	cfg := config.Load()
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	pool, err := db.Connect(ctx, cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("db: %v", err)
	}
	if pool != nil {
		defer pool.Close()
	} else {
		log.Print("DATABASE_URL unset — starting without Postgres (health-only)")
	}

	valkey, err := cache.Connect(ctx, cfg.ValkeyURL)
	if err != nil {
		log.Fatalf("cache: %v", err)
	}
	defer func() { _ = valkey.Close() }()

	mongoDB, err := mongo.Connect(ctx, cfg.MongoURI, cfg.MongoDatabase)
	if err != nil {
		log.Fatalf("mongo: %v", err)
	}
	if mongoDB != nil {
		log.Printf("mongo connected (db=%s)", cfg.MongoDatabase)
	}

	if cfg.AuthDisabled {
		log.Print("AUTH_DISABLED=true — partner roles come from X-Dev-* headers. Never run this in production.")
	}

	// Notification outbox drain worker (provider-agnostic webhook). The worker is always constructed so
	// the admin manual trigger (POST /notifications/drain) works; the background loop only runs when a
	// provider is configured, so PENDING rows are never marked SENT without a real delivery attempt.
	workerCtx, stopWorkers := context.WithCancel(context.Background())
	defer stopWorkers()
	notifyWorker := notifications.NewWorker(notifications.New(pool, valkey), notifications.NewWebhookSender(cfg.PushWebhookURL), nil)
	if cfg.PushWebhookURL != "" && pool != nil {
		go notifyWorker.Run(workerCtx)
	}

	handler := server.NewRouter(server.Deps{
		Config:  cfg,
		Pool:    pool,
		Cache:   valkey,
		Mongo:   mongoDB,
		Drainer: notifyWorker,
	})

	srv := &http.Server{
		Addr:              cfg.Addr,
		Handler:           handler,
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       15 * time.Second,
		WriteTimeout:      30 * time.Second,
		IdleTimeout:       60 * time.Second,
	}

	go func() {
		log.Printf("faazio gateway listening on %s", cfg.Addr)
		if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			log.Fatalf("listen: %v", err)
		}
	}()

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, syscall.SIGINT, syscall.SIGTERM)
	<-stop

	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer shutdownCancel()
	if err := srv.Shutdown(shutdownCtx); err != nil {
		log.Printf("shutdown: %v", err)
	}
	log.Print("gateway stopped")
}
