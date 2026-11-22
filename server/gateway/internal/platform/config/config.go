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
	PortalPepper string
	// PickupHandoverSecret signs the seller→rider pickup QR tokens (0088). It defaults to
	// PortalJWTSecret (domain-separated in the delivery handler) so no extra secret is required;
	// set it explicitly to rotate the handover capability independently. Empty disables the flow.
	PickupHandoverSecret string
	FirebaseProjectID    string
	// GoogleRoutesAPIKey backs the road-aware dispatch matrix (Routes API, server-side only).
	// The mobile Maps SDK key is a separate, app-restricted client key. Empty is a hard config error:
	// dispatch fails closed instead of estimating a straight-line leg.
	GoogleRoutesAPIKey string
	// DeliveryMaxDispatchAttempts caps the reject→reassign fallback chain (initial offer + retries).
	DeliveryMaxDispatchAttempts int
	// Weather Union (Zomato giveback) powers the rain surge. BaseURL is optional (official endpoint
	// by default); an empty key fails the weather check, and delivery pricing fails closed rather
	// than assuming a dry zone.
	ZomatoWeatherUnionBaseURL string
	ZomatoWeatherUnionKey     string
	SupabaseURL               string
	SupabaseServiceKey        string
	PrescriptionBucket        string
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
	// AI gateway configuration
	AIBaseURL    string
	AIAPIKey     string
	AIModelID    string
	// Razorpay: secrets are env-only and never committed. Customer payments (UPI order creation +
	// webhook reconciliation) only — Razorpay Route/settlement was removed (manual payouts).
	// Empty keys mean the customer payment rail is unavailable (checkout returns 503); the gateway
	// never fabricates a paid order. Test mode is automatic: set these to the Razorpay TEST keys in
	// pre-prod and the same code drives test-mode orders/webhooks.
	RazorpayKeyID         string
	RazorpayKeySecret     string
	RazorpayWebhookSecret string
	// FCMProjectID + FCMServiceAccount enable the gateway's embedded FCM HTTP v1 sender (Android
	// push + iOS alert/background relay). FCMServiceAccount is the raw JSON of the Firebase service
	// account private key — a secret, never committed. When unset, push delivery stays disabled
	// (in-app inbox only).
	FCMProjectID      string
	FCMServiceAccount string
	// APNs is the direct provider connection used for PushKit VoIP pushes (an iOS incoming call
	// ring). FCM cannot deliver `apns-push-type: voip`, so this is a separate .p8 auth key. All
	// fields are env-only; APNsPrivateKeyPEM is the downloaded .p8 contents (PEM or bare base64)
	// and is never committed. APNsTopic is the app's **bundle id** (`com.faazio.customer`) — the same
	// topic every APNs push uses; a `.voip` suffix is not a valid topic and APNs rejects it.
	APNsKeyID         string
	APNsTeamID        string
	APNsPrivateKeyPEM string
	APNsTopic         string
	APNsEnvironment   string
	// Delivery calling (0104). VOIP is enabled when the 100ms app key/secret are set plus either a
	// management token + template (per-call rooms) or a pre-provisioned room id. PSTN_BRIDGING is
	// enabled when a masked virtual landline is set. Secrets are env-only and never projected.
	DeliveryCallVirtualNumber string
	HMSAppAccessKey           string
	HMSAppSecret              string
	HMSManagementToken        string
	HMSTemplateID             string
	HMSRoomID                 string
	HMSRole                   string
	HMSEndpoint               string
	HMSRingingAckSeconds      int
	// PSTN bridge (Exotel Connect API). When the account/key/token are set the server places the
	// masked call itself and reconciles answer/end from the status webhook; when they are empty the
	// PSTN leg degrades to the app dialling the masked virtual number. Secrets are env-only.
	PSTNProvider         string
	ExotelAccountSID     string
	ExotelAPIKey         string
	ExotelAPIToken       string
	ExotelSubdomain      string
	PSTNWebhookURL       string
	PSTNWebhookToken     string
	PSTNTimeLimitSeconds int
	PSTNTimeOutSeconds   int
	AllowedOrigins       []string
	OTelEnabled          bool
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
		PickupHandoverSecret:        env("PICKUP_HANDOVER_SECRET", env("PORTAL_JWT_SECRET", "")),
		FirebaseProjectID:           env("FIREBASE_PROJECT_ID", ""),
		GoogleRoutesAPIKey:          env("GOOGLE_ROUTES_API_KEY", ""),
		DeliveryMaxDispatchAttempts: envInt("DELIVERY_MAX_DISPATCH_ATTEMPTS", 5),
		ZomatoWeatherUnionBaseURL:   env("ZOMATO_WEATHER_UNION_BASE_URL", ""),
		ZomatoWeatherUnionKey:       env("ZOMATO_WEATHER_UNION_KEY", ""),
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
		FCMProjectID:                env("FCM_PROJECT_ID", ""),
		FCMServiceAccount:           env("FCM_SERVICE_ACCOUNT_JSON", ""),
		APNsKeyID:                   env("APNS_KEY_ID", ""),
		APNsTeamID:                  env("APNS_TEAM_ID", ""),
		APNsPrivateKeyPEM:           env("APNS_PRIVATE_KEY_PEM", ""),
		APNsTopic:                   env("APNS_TOPIC", "com.faazio.customer"),
		APNsEnvironment:             env("APNS_ENVIRONMENT", "production"),
		DeliveryCallVirtualNumber:   env("DELIVERY_CALL_VIRTUAL_NUMBER", ""),
		HMSAppAccessKey:             env("HMS_APP_ACCESS_KEY", ""),
		HMSAppSecret:                env("HMS_APP_SECRET", ""),
		HMSManagementToken:          env("HMS_MANAGEMENT_TOKEN", ""),
		HMSTemplateID:               env("HMS_TEMPLATE_ID", ""),
		HMSRoomID:                   env("HMS_ROOM_ID", ""),
		HMSRole:                     env("HMS_ROLE", "guest"),
		HMSEndpoint:                 env("HMS_ENDPOINT", ""),
		HMSRingingAckSeconds:        envInt("HMS_RINGING_ACK_SECONDS", 3),
		PSTNProvider:                env("PSTN_PROVIDER", ""),
		ExotelAccountSID:            env("EXOTEL_ACCOUNT_SID", ""),
		ExotelAPIKey:                env("EXOTEL_API_KEY", ""),
		ExotelAPIToken:              env("EXOTEL_API_TOKEN", ""),
		ExotelSubdomain:             env("EXOTEL_SUBDOMAIN", ""),
		PSTNWebhookURL:              env("PSTN_WEBHOOK_URL", ""),
		PSTNWebhookToken:            env("PSTN_WEBHOOK_TOKEN", ""),
		PSTNTimeLimitSeconds:        envInt("PSTN_TIME_LIMIT_SECONDS", 900),
		PSTNTimeOutSeconds:          envInt("PSTN_TIMEOUT_SECONDS", 30),
		AllowedOrigins:              splitCSV(env("ALLOWED_ORIGINS", "")),
		OTelEnabled:                 envBool("OTEL_ENABLED", false),
	AIBaseURL:                 env("AI_BASE_URL", ""),
	AIAPIKey:                  env("AI_API_KEY", ""),
	AIModelID:                 env("AI_MODEL_ID", ""),
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
