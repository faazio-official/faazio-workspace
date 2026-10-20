// Package server is the composition root: it wires every context onto one chi router.
// It is the only package allowed to import all contexts (monolith-breakdown §2).
package server

import (
	"context"
	"log/slog"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/faazio/server/gateway/internal/admins"
	"github.com/faazio/server/gateway/internal/ads"
	"github.com/faazio/server/gateway/internal/blood"
	"github.com/faazio/server/gateway/internal/bookings"
	"github.com/faazio/server/gateway/internal/cartstock"
	"github.com/faazio/server/gateway/internal/catalog"
	"github.com/faazio/server/gateway/internal/checkout"
	"github.com/faazio/server/gateway/internal/contracts"
	"github.com/faazio/server/gateway/internal/directory"
	"github.com/faazio/server/gateway/internal/favourites"
	"github.com/faazio/server/gateway/internal/media"
	"github.com/faazio/server/gateway/internal/notifications"
	"github.com/faazio/server/gateway/internal/pharma"
	"github.com/faazio/server/gateway/internal/platform/auth"
	"github.com/faazio/server/gateway/internal/platform/cache"
	"github.com/faazio/server/gateway/internal/platform/config"
	"github.com/faazio/server/gateway/internal/platform/db"
	"github.com/faazio/server/gateway/internal/platform/httpx"
	"github.com/faazio/server/gateway/internal/platform/r2"
	"github.com/faazio/server/gateway/internal/portal"
	"github.com/faazio/server/gateway/internal/promo"
	"github.com/faazio/server/gateway/internal/reco"
	"github.com/faazio/server/gateway/internal/reviews"
	"github.com/faazio/server/gateway/internal/rewards"
	"github.com/faazio/server/gateway/internal/sdui"
	"github.com/faazio/server/gateway/internal/search"
	"github.com/faazio/server/gateway/internal/sellers"
	"github.com/faazio/server/gateway/internal/settlement"
	"github.com/faazio/server/gateway/internal/support"
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
	// Drainer runs one synchronous notification-outbox drain for the manual admin trigger. Optional
	// (nil disables POST /notifications/drain).
	Drainer contracts.Drainer
	// Signer is the shared R2 presigner (nil when credentials are unset → media disabled). Built in
	// main so the media workers and every context share one signing path.
	Signer *r2.Signer
	// Sweeper runs one media GC pass for the manual admin trigger. Optional (nil disables POST /media/gc).
	Sweeper contracts.Sweeper
	// AuditPurger runs one audit-log retention pass for the SUPER_ADMIN manual trigger (nil disables
	// POST /audit-logs/purge; the nightly 00:00 IST pass is the gateway worker in main.go).
	AuditPurger contracts.AuditPurger
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
	r.Use(mediaBodyLimit())
	r.Use(sensitiveThrottle())
	r.Use(corsMiddleware(d.Config.AllowedOrigins, d.Config.AuthDisabled))
	if d.Config.OTelEnabled {
		r.Use(requestLogger())
	}

	catalogRepo := catalog.New(d.Pool, d.Signer.MediaBase())
	directoryRepo := directory.New(d.Pool, d.Signer.MediaBase())
	cartRepo := cartstock.New(d.Pool)
	favouritesRepo := favourites.New(d.Pool)
	checkoutRepo := checkout.NewWithCache(d.Pool, d.Cache)
	reviewsRepo := reviews.New(d.Pool)
	rewardsRepo := rewards.New(d.Pool)
	recoRepo := reco.New(d.Mongo)
	pharmaRepo := pharma.New(d.Pool)
	// R2 signer is built in main (shared with the media GC/purge workers); nil when credentials are
	// unset (media disabled). One signing path for the media registry, pharma Rx and seller KYC.
	r2Signer := d.Signer
	// Rx images prefer the R2 private bucket; fall back to Supabase Storage when R2 is off.
	pharmaStorage := pharma.NewR2Storage(r2Signer)
	if pharmaStorage == nil {
		pharmaStorage = pharma.NewStorage(d.Config.SupabaseURL, d.Config.SupabaseServiceKey, d.Config.PrescriptionBucket)
	}
	mediaRepo := media.New(d.Pool)
	notificationsRepo := notifications.New(d.Pool, d.Cache)
	bloodRepo := blood.New(d.Pool)
	bookingsRepo := bookings.New(d.Pool, d.Config.BookingFeePaisa)
	bookingsGateway := bookings.NewGateway(d.Config.RazorpayKeyID, d.Config.RazorpayKeySecret, d.Config.RazorpayWebhookSecret)

	// Partner control plane (0015). adminsRepo also implements contracts.AuditWriter so every
	// partner mutation is recorded.
	sellersRepo := sellers.New(d.Pool)
	adminsRepo := admins.New(d.Pool)
	promoRepo := promo.New(d.Pool)
	adsRepo := ads.New(d.Pool)
	settlementRepo := settlement.New(d.Pool)
	supportRepo := support.New(d.Pool)
	// Gateway-native portal credentials (0032 + 0033) and credential management. Audited through the admins context.
	portalRepo := portal.New(d.Pool)

	// Auth: Firebase ID tokens for the mobile app (phone OTP); portal HS256 tokens are verified
	// separately. The legacy Supabase/GoTrue path remains for older partner tokens during the
	// migration. checkout resolves the auth subject → app user slug.
	authConfig := auth.Config{
		Disabled:  d.Config.AuthDisabled,
		DevUserID: d.Config.DevUserID,
		JWTSecret: []byte(d.Config.SupabaseJWTSecret),
		Resolver:  checkoutRepo,
	}
	if d.Config.FirebaseProjectID != "" {
		authConfig.Firebase = auth.NewFirebaseVerifier(d.Config.FirebaseProjectID)
	}
	if d.Config.PortalJWTSecret != "" {
		authConfig.Portal = auth.NewPortalVerifier([]byte(d.Config.PortalJWTSecret), d.Cache)
	}
	r.Use(auth.Middleware(authConfig))

	r.Get("/health", healthHandler(d))

	// Contexts. Each owns its routes; cross-context calls use contracts interfaces.
	checkoutService := checkout.NewService(checkoutRepo, cartRepo, d.Cache, rewardsRepo, promoRepo, promoRepo, adsRepo)
	bookingsService := bookings.NewService(bookingsRepo, bookingsGateway, notificationsRepo, d.Cache)
	reviewsService := reviews.NewService(reviewsRepo, checkoutRepo, d.Cache)
	sduiService := sdui.NewService(recoRepo, recoRepo, catalogRepo, directoryRepo, d.Cache)
	recoService := reco.NewService(recoRepo, catalogRepo, d.Cache)

	catalog.NewHandler(catalogRepo, d.Cache, adminsRepo, mediaRepo).Register(r)
	search.NewHandler(catalogRepo, d.Cache).Register(r)
	directory.NewHandler(directoryRepo, d.Cache, adminsRepo, mediaRepo).Register(r)
	cartstock.NewHandler(cartRepo, d.Cache).Register(r)
	favourites.NewHandler(favouritesRepo, d.Cache).Register(r)
	rewards.NewHandler(rewardsRepo, d.Cache, adminsRepo).Register(r)
	pharma.NewHandler(pharmaRepo, pharmaStorage, d.Cache, adminsRepo, notificationsRepo).Register(r)
	notifications.NewHandler(notificationsRepo, d.Cache, d.Drainer).Register(r)
	blood.NewHandler(bloodRepo, d.Cache, adminsRepo, notificationsRepo).Register(r)
	bookings.NewHandler(bookingsRepo, bookingsService, d.Cache, adminsRepo).Register(r)
	checkout.NewHandler(checkoutRepo, checkoutService, d.Cache, adminsRepo, notificationsRepo, promoRepo).Register(r)
	reviews.NewHandler(reviewsRepo, reviewsService, d.Cache, adminsRepo).Register(r)
	reco.NewHandler(recoRepo, recoService).Register(r)
	sdui.NewHandler(sduiService, adminsRepo).Register(r)
	admins.NewHandler(adminsRepo, admins.NewProvisioner(d.Pool, portal.NewHasher(d.Config.PortalPepper)), d.AuditPurger).Register(r)
	portal.NewHandler(portalRepo, d.Cache, adminsRepo, d.Config.PortalJWTSecret, d.Config.PortalPepper).Register(r)
	sellers.NewHandler(sellersRepo, d.Cache, adminsRepo).Register(r)
	promo.NewHandler(promoRepo, d.Cache, adminsRepo).Register(r)
	ads.NewHandler(adsRepo, d.Cache, adminsRepo, d.Signer.PublicOrigin()).Register(r)
	settlement.NewHandler(settlementRepo, d.Cache, adminsRepo).Register(r)
	support.NewHandler(supportRepo, adminsRepo).Register(r)
	media.NewHandler(mediaRepo, r2Signer, d.Cache, adminsRepo, d.Sweeper).Register(r)
	// Public media without a CDN custom domain: a stable /assets/{key} URL that 302-redirects to a
	// short-lived presigned GET, so cached JSON can hold a non-expiring URL (R2_CDN_BASE unset).
	r.Get("/assets/*", publicAssetRedirect(d.Signer))

	return r
}

// publicAssetRedirect serves the gateway's own stable public-media path when no CDN custom domain is
// configured (R2_CDN_BASE unset). It presigns a short-lived GET for the public bucket and redirects;
// when a CDN base is set, PublicURL points straight at the CDN and this route is never used.
func publicAssetRedirect(signer *r2.Signer) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		key := strings.TrimLeft(chi.URLParam(r, "*"), "/")
		if signer == nil || !signer.Enabled() || key == "" || strings.Contains(key, "..") {
			http.NotFound(w, r)
			return
		}
		url, err := signer.PresignGet(r.Context(), signer.PublicBucket(), key, 300*time.Second)
		if err != nil {
			http.NotFound(w, r)
			return
		}
		w.Header().Set("Cache-Control", "public, max-age=300")
		http.Redirect(w, r, url, http.StatusFound)
	}
}

// healthHandler reports liveness plus per-dependency probes (latency + ok) so a Render
// health-check and uptime alert see a real signal, not just `status:"ok"`. Postgres is the core
// dependency: a configured-but-unreachable pool returns 503. Cache/Mongo are optional (the gateway
// degrades without them) and only mark the response `degraded`.
func healthHandler(d Deps) http.HandlerFunc {
	probe := func(ctx context.Context, fn func(context.Context) error) map[string]any {
		start := time.Now()
		err := fn(ctx)
		return map[string]any{"configured": true, "ok": err == nil, "ms": time.Since(start).Milliseconds()}
	}
	return func(w http.ResponseWriter, r *http.Request) {
		ctx, cancel := context.WithTimeout(r.Context(), 2*time.Second)
		defer cancel()

		deps := map[string]any{}
		healthy := true
		if d.Pool == nil {
			deps["db"] = map[string]any{"configured": false}
		} else {
			deps["db"] = probe(ctx, d.Pool.Ping)
			if deps["db"].(map[string]any)["ok"] != true {
				healthy = false
			}
		}
		if d.Cache == nil || !d.Cache.Enabled() {
			deps["cache"] = map[string]any{"configured": false}
		} else {
			deps["cache"] = probe(ctx, d.Cache.Ping)
		}
		if d.Mongo == nil {
			deps["mongo"] = map[string]any{"configured": false}
		} else {
			deps["mongo"] = probe(ctx, func(ctx context.Context) error { return d.Mongo.Client().Ping(ctx, nil) })
		}

		status, code := "ok", http.StatusOK
		if !healthy {
			status, code = "degraded", http.StatusServiceUnavailable
		}
		httpx.JSON(w, code, map[string]any{
			"status":       status,
			"db":           d.Pool != nil,
			"cache":        d.Cache.Enabled(),
			"mongo":        d.Mongo != nil,
			"dependencies": deps,
			"time":         time.Now().UTC().Format(time.RFC3339),
		})
	}
}

// mediaBodyLimit caps bodies on the R2 media routes at 256 KiB — well below the global 1 MiB — so
// an oversized presign/confirm body is rejected before it is read. Uploads stream directly to R2 via
// a presigned URL, so no media endpoint legitimately carries image bytes.
func mediaBodyLimit() func(http.Handler) http.Handler {
	const mediaMaxBodyBytes = 256 << 10
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if strings.HasPrefix(r.URL.Path, "/media/") && r.Body != nil {
				r.Body = http.MaxBytesReader(w, r.Body, mediaMaxBodyBytes)
			}
			next.ServeHTTP(w, r)
		})
	}
}

// sensitiveThrottle applies a tighter concurrency cap (10) to abuse-prone writes on top of the
// global Throttle(100): OTP/rating/booking/media bursts must not be able to consume the whole
// server's concurrency. The limiter is built once so the semaphore is shared across requests.
func sensitiveThrottle() func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		sensitive := middleware.Throttle(10)(next)
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if isSensitiveRequest(r) {
				sensitive.ServeHTTP(w, r)
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}

func isSensitiveRequest(r *http.Request) bool {
	path := r.URL.Path
	switch {
	case r.Method == http.MethodPost && path == "/ads/events":
		return true
	case r.Method == http.MethodPut && strings.HasPrefix(path, "/vendors/") && strings.HasSuffix(path, "/rating"):
		return true
	case strings.HasPrefix(path, "/bookings"):
		return true
	case strings.HasPrefix(path, "/media/"):
		return true
	case strings.HasPrefix(path, "/auth/portal/"):
		return true
	case strings.HasPrefix(path, "/admin/portal-users"):
		return true
	default:
		return false
	}
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

// corsMiddleware is an explicit allow-list: only a configured origin gets CORS headers (default
// deny). A literal `*` is honored **only** in dev (AUTH_DISABLED=true) so local tooling stays
// convenient; production (AUTH_DISABLED=false) never reflects an arbitrary origin. The dev-only
// `X-Dev-*` headers are likewise only advertised in dev — a prod preflight never invites them.
func corsMiddleware(origins []string, devMode bool) func(http.Handler) http.Handler {
	allowed := map[string]struct{}{}
	wildcard := false
	for _, o := range origins {
		o = strings.TrimSpace(o)
		switch o {
		case "":
			continue
		case "*":
			if devMode {
				wildcard = true
			}
		default:
			allowed[o] = struct{}{}
		}
	}
	allowHeaders := "Authorization, Content-Type"
	if devMode {
		allowHeaders += ", X-Dev-User, X-Dev-Role, X-Dev-Seller, X-Dev-State"
	}
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if origin := r.Header.Get("Origin"); origin != "" {
				_, ok := allowed[origin]
				if wildcard || ok {
					// Reflect the origin (rather than "*") so bearer/credentialed calls and Vary behave.
					w.Header().Set("Access-Control-Allow-Origin", origin)
					w.Header().Set("Vary", "Origin")
					w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
					w.Header().Set("Access-Control-Allow-Headers", allowHeaders)
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
