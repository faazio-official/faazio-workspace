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
	AuthDisabled      bool
	DevUserID         string
	AllowedOrigins    []string
	OTelEnabled       bool
}

// Load reads config from the environment with safe local-dev defaults.
func Load() Config {
	return Config{
		Addr:              env("GATEWAY_ADDR", ":8080"),
		DatabaseURL:       env("DATABASE_URL", ""),
		ValkeyURL:         env("VALKEY_URL", ""),
		MongoURI:          env("MONGO_URI", ""),
		MongoDatabase:     env("MONGO_DATABASE", "faazio"),
		SupabaseJWTSecret: env("SUPABASE_JWT_SECRET", ""),
		AuthDisabled:      envBool("AUTH_DISABLED", false),
		DevUserID:         env("DEV_USER_ID", "user-1"),
		AllowedOrigins:    splitCSV(env("ALLOWED_ORIGINS", "")),
		OTelEnabled:       envBool("OTEL_ENABLED", false),
	}
}

func env(key, fallback string) string {
	if v, ok := os.LookupEnv(key); ok && strings.TrimSpace(v) != "" {
		return v
	}
	return fallback
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
