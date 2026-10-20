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

	"github.com/faazio/server/gateway/internal/media"
	"github.com/faazio/server/gateway/internal/notifications"
	"github.com/faazio/server/gateway/internal/platform/cache"
	"github.com/faazio/server/gateway/internal/platform/cloudflare"
	"github.com/faazio/server/gateway/internal/platform/config"
	"github.com/faazio/server/gateway/internal/platform/db"
	"github.com/faazio/server/gateway/internal/platform/mongo"
	"github.com/faazio/server/gateway/internal/platform/r2"
	"github.com/faazio/server/gateway/internal/portal"
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
	logPortalStartup(ctx, cfg, pool)

	// Notification outbox drain worker (provider-agnostic webhook). The worker is always constructed so
	// the admin manual trigger (POST /notifications/drain) works; the background loop only runs when a
	// provider is configured, so PENDING rows are never marked SENT without a real delivery attempt.
	workerCtx, stopWorkers := context.WithCancel(context.Background())
	defer stopWorkers()
	notifyWorker := notifications.NewWorker(notifications.New(pool, valkey), notifications.NewWebhookSender(cfg.PushWebhookURL), nil)
	if cfg.PushWebhookURL != "" && pool != nil {
		go notifyWorker.Run(workerCtx)
	}

	// Media plane: one R2 signer shared by the registry, the GC sweeper and the CDN purge worker.
	// The signer/purger are nil when their credentials are unset, so each worker is disabled rather than
	// making broken calls. GC reclaims orphaned DRAFT uploads; the purge worker LISTENs on media_updated
	// and purges CDN URLs (URL purge only when CF_ZONE_ID/CF_API_TOKEN are set).
	r2Signer := r2.New(r2.Config{
		AccountID:     cfg.R2AccountID,
		AccessKeyID:   cfg.R2AccessKeyID,
		SecretKey:     cfg.R2SecretKey,
		PublicBucket:  cfg.R2PublicBucket,
		PrivateBucket: cfg.R2PrivateBucket,
		CDNBase:       cfg.R2CDNBase,
		PublicBase:    cfg.PublicBaseURL,
	})
	mediaGC := media.NewSweeper(media.New(pool), r2Signer, nil)
	if mediaGC.Enabled() && pool != nil {
		go mediaGC.Run(workerCtx)
	}
	mediaPurge := media.NewPurgeWorker(pool, r2Signer, cloudflare.New(cloudflare.Config{
		ZoneID: cfg.CFZoneID, APIToken: cfg.CFAPIToken,
	}), valkey, nil)
	if mediaPurge.Enabled() {
		go mediaPurge.Run(workerCtx)
	}
	if mediaGC.Enabled() || mediaPurge.Enabled() {
		log.Print("media workers started (gc + cdn purge)")
	}

	handler := server.NewRouter(server.Deps{
		Config:  cfg,
		Pool:    pool,
		Cache:   valkey,
		Mongo:   mongoDB,
		Drainer: notifyWorker,
		Signer:  r2Signer,
		Sweeper: mediaGC,
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

// logPortalStartup emits the two facts that explain a portal 503 in the Render logs: whether the
// signing secret is set and whether the credential tables (0032 + 0033) are applied. Never logs the
// secret/pepper or the database URL.
func logPortalStartup(ctx context.Context, cfg config.Config, pool *db.Pool) {
	if cfg.PortalJWTSecret == "" {
		log.Print("portal_auth=disabled reason=jwt_secret_empty (set PORTAL_JWT_SECRET; docs/RUNBOOKS/PORTAL_AUTH.md)")
	} else {
		log.Print("portal_auth=enabled")
	}
	status := portal.CheckSchema(ctx, pool)
	switch {
	case pool == nil:
		log.Print("portal_tables=unknown reason=database_unconfigured")
	case !status.Tables:
		log.Print("portal_tables=missing hint=apply migrations 0032 + 0033")
	case !status.Scoped:
		log.Print("portal_tables=partial hint=apply migration 0033")
	default:
		log.Print("portal_tables=ok")
	}
}
