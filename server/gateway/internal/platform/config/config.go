// Package config loads gateway configuration from the environment. Secrets are
// never committed; .env files are templates only (AGENTS.md security posture).
package config

import (
	"os"
	"strconv"
	"strings"
)

// Config holds environment-derived settings.
type Config struct {
	Addr              string
	DatabaseURL       string
	ValkeyURL         string
	MongoURI          string
	MongoDatabase     string
	SupabaseJWTSecret string
	// PortalJWTSecret signs/verifies the gateway-native SUPER_ADMIN portal session (HS256). Kept
	// distinct from SupabaseJWTSecret so a portal token can never be minted/verified by the legacy
	// GoTrue path (blast-radius isolation). Empty disables portal login.
	PortalJWTSecret string
	// PortalPepper is the server-side HMAC pepper applied before Argon2id. Empty is allowed for
	// local dev; production must set it (see docs/RUNBOOKS/PORTAL_AUTH.md).
	PortalPepper      string
	FirebaseProjectID string
	// GoogleRoutesAPIKey backs the road-aware dispatch matrix (Routes API, server-side only).
	// The mobile Maps SDK key is a separate, app-restricted client key. Empty = straight-line
	// fallback for local/dev. Push delivery reuses the notifications outbox, so no service-account
	// JSON lives in the gateway.
	GoogleRoutesAPIKey string
	// DeliveryMaxDispatchAttempts caps the reject→reassign fallback chain (initial offer + retries).
	DeliveryMaxDispatchAttempts int
	SupabaseURL                 string
	SupabaseServiceKey          string
	PrescriptionBucket          string
	// Cloudflare R2 (media bytes). When AccountID/AccessKeyID/SecretKey are unset the media context is
	// disabled (write endpoints return 503) and public URLs resolve empty — never an unsigned URL.
	R2AccountID     string
	R2AccessKeyID   string
	R2SecretKey     string
	R2PublicBucket  string
	R2PrivateBucket string
	// R2CDNBase is the public CDN custom domain in front of the public bucket (e.g. https://img.faazio.in).
	// Optional: when unset, public objects are served through the gateway's own /assets/{key} route,
	// which 302-redirects to a short-lived presigned GET (no custom domain / r2.dev needed).
	R2CDNBase string
	// PublicBaseURL is the gateway's own public origin (e.g. https://gateway.faazio.com) used to build
	// those stable /assets/{key} URLs when R2CDNBase is unset. Empty = public objects resolve to "".
	PublicBaseURL string
	// Cloudflare purge (media GC/moderation). When ZoneID or APIToken is unset, CDN purge is disabled
	// (content expires via its Cache Rule instead) — never a broken call.
	CFZoneID   string
	CFAPIToken string
	// Razorpay (bookings): secrets are env-only and never committed. When KeyID/KeySecret are empty
	// the bookings context stays in mock mode (orders are simulated; no network calls).
	RazorpayKeyID         string
	RazorpayKeySecret     string
	RazorpayWebhookSecret string
	// Razorpay Route (seller split payments). Falls back to the main Razorpay key pair when the
	// dedicated Route envs are unset, so one merchant account works out of the box.
	RazorpayRouteKeyID         string
	RazorpayRouteKeySecret     string
	RazorpayRouteWebhookSecret string
	// BookingFeePaisa is the fixed per-seat platform fee (₹50). A deploy constant — a restaurant can
	// never set its own fee (client-supplied amounts are ignored; the gateway derives it).
	BookingFeePaisa int64
	AuthDisabled    bool
	DevUserID       string
	// PushWebhookURL enables the notification outbox drain worker. Empty = worker not started
	// (notifications stay durable + readable in-app). See internal/notifications/worker.go.
	PushWebhookURL string
	AllowedOrigins []string
	OTelEnabled    bool
}

// Load reads config from the environment with safe local-dev defaults.
func Load() Config {
	return Config{
		Addr:                        env("GATEWAY_ADDR", ":"+env("PORT", "8080")),
		DatabaseURL:                 env("DATABASE_URL", ""),
		ValkeyURL:                   env("VALKEY_URL", ""),
		MongoURI:                    env("MONGO_URI", ""),
		MongoDatabase:               env("MONGO_DATABASE", "faazio"),
		SupabaseJWTSecret:           env("SUPABASE_JWT_SECRET", ""),
		PortalJWTSecret:             env("PORTAL_JWT_SECRET", ""),
		PortalPepper:                env("PORTAL_PEPPER", ""),
		FirebaseProjectID:           env("FIREBASE_PROJECT_ID", ""),
		GoogleRoutesAPIKey:          env("GOOGLE_ROUTES_API_KEY", ""),
		DeliveryMaxDispatchAttempts: envInt("DELIVERY_MAX_DISPATCH_ATTEMPTS", 5),
		SupabaseURL:                 env("SUPABASE_URL", ""),
		SupabaseServiceKey:          env("SUPABASE_SERVICE_KEY", ""),
		PrescriptionBucket:          env("PRESCRIPTION_BUCKET", "prescriptions"),
		R2AccountID:                 env("R2_ACCOUNT_ID", ""),
		R2AccessKeyID:               env("R2_ACCESS_KEY_ID", ""),
		R2SecretKey:                 env("R2_SECRET_ACCESS_KEY", ""),
		R2PublicBucket:              env("R2_PUBLIC_BUCKET", "faazio-public"),
		R2PrivateBucket:             env("R2_PRIVATE_BUCKET", "faazio-private"),
		R2CDNBase:                   env("R2_CDN_BASE", ""),
		PublicBaseURL:               envFirst("PUBLIC_BASE_URL", "RENDER_EXTERNAL_URL"),
		CFZoneID:                    env("CF_ZONE_ID", ""),
		CFAPIToken:                  env("CF_API_TOKEN", ""),
		RazorpayKeyID:               env("RAZORPAY_KEY_ID", ""),
		RazorpayKeySecret:           env("RAZORPAY_KEY_SECRET", ""),
		RazorpayWebhookSecret:       env("RAZORPAY_WEBHOOK_SECRET", ""),
		// Route defaults to the main key pair; a separate Route webhook secret is optional.
		RazorpayRouteKeyID:         envFirst("RAZORPAY_ROUTE_KEY_ID", "RAZORPAY_KEY_ID"),
		RazorpayRouteKeySecret:     envFirst("RAZORPAY_ROUTE_KEY_SECRET", "RAZORPAY_KEY_SECRET"),
		RazorpayRouteWebhookSecret: envFirst("RAZORPAY_ROUTE_WEBHOOK_SECRET", "RAZORPAY_WEBHOOK_SECRET"),
		BookingFeePaisa:            envInt64("BOOKING_FEE_PAISA", 5000),
		AuthDisabled:               envBool("AUTH_DISABLED", false),
		DevUserID:                  env("DEV_USER_ID", "user-1"),
		PushWebhookURL:             env("PUSH_WEBHOOK_URL", ""),
		AllowedOrigins:             splitCSV(env("ALLOWED_ORIGINS", "")),
		OTelEnabled:                envBool("OTEL_ENABLED", false),
	}
}

func env(key, fallback string) string {
	if v, ok := os.LookupEnv(key); ok && strings.TrimSpace(v) != "" {
		return v
	}
	return fallback
}

// envFirst returns the first non-empty value among keys. Used where a platform injects its own
// public origin (e.g. Render's RENDER_EXTERNAL_URL) as a fallback for an explicit override.
func envFirst(keys ...string) string {
	for _, key := range keys {
		if v, ok := os.LookupEnv(key); ok && strings.TrimSpace(v) != "" {
			return v
		}
	}
	return ""
}

func envBool(key string, fallback bool) bool {
	v, ok := os.LookupEnv(key)
	if !ok || v == "" {
		return fallback
	}
	b, err := strconv.ParseBool(v)
	if err != nil {
		return fallback
	}
	return b
}

func envInt(key string, fallback int) int {
	v, ok := os.LookupEnv(key)
	if !ok || strings.TrimSpace(v) == "" {
		return fallback
	}
	n, err := strconv.Atoi(strings.TrimSpace(v))
	if err != nil || n < 1 {
		return fallback
	}
	return n
}

func envInt64(key string, fallback int64) int64 {
	v, ok := os.LookupEnv(key)
	if !ok || strings.TrimSpace(v) == "" {
		return fallback
	}
	n, err := strconv.ParseInt(strings.TrimSpace(v), 10, 64)
	if err != nil || n < 0 {
		return fallback
	}
	return n
}

func splitCSV(v string) []string {
	if v == "" {
		return nil
	}
	parts := strings.Split(v, ",")
	out := make([]string, 0, len(parts))
	for _, p := range parts {
		if p = strings.TrimSpace(p); p != "" {
			out = append(out, p)
		}
	}
	return out
}
