// Package server is the composition root: it wires every context onto one chi router.
// It is the only package allowed to import all contexts (monolith-breakdown §2).
package server

import (
	"log/slog"
	"net/http"
	"os"
	"time"

	"github.com/faazio/server/gateway/internal/cartstock"
	"github.com/faazio/server/gateway/internal/catalog"
	"github.com/faazio/server/gateway/internal/checkout"
	"github.com/faazio/server/gateway/internal/directory"
	"github.com/faazio/server/gateway/internal/platform/auth"
	"github.com/faazio/server/gateway/internal/platform/cache"
	"github.com/faazio/server/gateway/internal/platform/config"
	"github.com/faazio/server/gateway/internal/platform/db"
	"github.com/faazio/server/gateway/internal/platform/httpx"
	"github.com/faazio/server/gateway/internal/reco"
	"github.com/faazio/server/gateway/internal/reviews"
	"github.com/faazio/server/gateway/internal/sdui"
	"github.com/faazio/server/gateway/internal/search"
	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	gomongo "go.mongodb.org/mongo-driver/mongo"
)

// Deps are the shared platform dependencies.
type Deps struct {
	Config config.Config
	Pool   *db.Pool
	Cache  *cache.Cache
	Mongo  *gomongo.Database
}

// NewRouter builds the HTTP router with all contexts mounted.
func NewRouter(d Deps) http.Handler {
	r := chi.NewRouter()
	r.Use(middleware.RequestID)
	r.Use(middleware.RealIP)
	r.Use(middleware.Recoverer)
	r.Use(middleware.Timeout(10 * time.Second))
	r.Use(middleware.Throttle(100))
	r.Use(httpx.MaxBytes(httpx.DefaultMaxBodyBytes))
	r.Use(corsMiddleware(d.Config.AllowedOrigins))
	if d.Config.OTelEnabled {
		r.Use(requestLogger())
	}

	catalogRepo := catalog.New(d.Pool)
	directoryRepo := directory.New(d.Pool)
	cartRepo := cartstock.New(d.Pool)
	checkoutRepo := checkout.New(d.Pool)
	reviewsRepo := reviews.New(d.Pool)
	recoRepo := reco.New(d.Mongo)

	// Auth: checkout resolves the auth subject → app user slug.
	r.Use(auth.Middleware(auth.Config{
		Disabled:  d.Config.AuthDisabled,
		DevUserID: d.Config.DevUserID,
		JWTSecret: []byte(d.Config.SupabaseJWTSecret),
		Resolver:  checkoutRepo,
	}))

	r.Get("/health", func(w http.ResponseWriter, _ *http.Request) {
		httpx.JSON(w, http.StatusOK, map[string]any{
			"status": "ok",
			"db":     d.Pool != nil,
			"cache":  d.Cache.Enabled(),
			"mongo":  d.Mongo != nil,
			"time":   time.Now().UTC().Format(time.RFC3339),
		})
	})

	// Contexts. Each owns its routes; cross-context calls use contracts interfaces.
	checkoutService := checkout.NewService(checkoutRepo, cartRepo, d.Cache)
	reviewsService := reviews.NewService(reviewsRepo, checkoutRepo, d.Cache)
	sduiService := sdui.NewService(recoRepo, catalogRepo, directoryRepo, d.Cache)

	catalog.NewHandler(catalogRepo, d.Cache).Register(r)
	search.NewHandler(catalogRepo, d.Cache).Register(r)
	directory.NewHandler(directoryRepo, d.Cache).Register(r)
	cartstock.NewHandler(cartRepo, d.Cache).Register(r)
	checkout.NewHandler(checkoutRepo, checkoutService, d.Cache).Register(r)
	reviews.NewHandler(reviewsRepo, reviewsService, d.Cache).Register(r)
	reco.NewHandler(recoRepo).Register(r)
	sdui.NewHandler(sduiService).Register(r)

	return r
}

// requestLogger emits one structured slog line per request. It is gated by OTEL_ENABLED
// so local dev (and tests) stay quiet; never logs request bodies or auth headers.
func requestLogger() func(http.Handler) http.Handler {
	logger := slog.New(slog.NewJSONHandler(os.Stdout, nil))
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			start := time.Now()
			ww := middleware.NewWrapResponseWriter(w, r.ProtoMajor)
			next.ServeHTTP(ww, r)
			logger.Info("request",
				"method", r.Method,
				"path", r.URL.Path,
				"status", ww.Status(),
				"bytes", ww.BytesWritten(),
				"request_id", middleware.GetReqID(r.Context()),
				"duration_ms", time.Since(start).Milliseconds(),
			)
		})
	}
}

func corsMiddleware(origins []string) func(http.Handler) http.Handler {
	allowed := map[string]struct{}{}
	for _, o := range origins {
		allowed[o] = struct{}{}
	}
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if origin := r.Header.Get("Origin"); origin != "" {
				if _, ok := allowed[origin]; ok {
					w.Header().Set("Access-Control-Allow-Origin", origin)
					w.Header().Set("Vary", "Origin")
					w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
					w.Header().Set("Access-Control-Allow-Headers", "Authorization, Content-Type, X-Dev-User")
				}
			}
			if r.Method == http.MethodOptions {
				w.WriteHeader(http.StatusNoContent)
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}
