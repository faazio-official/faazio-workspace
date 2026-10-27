package appconfig

import (
	"bytes"
	"encoding/json"
	"regexp"
)

// MaxValueBytes caps a config value (matching the admins.app_config 4 KiB DB check).
const MaxValueBytes = 4096

// MaxDescriptionLen caps the human-readable description (matching the DB check).
const MaxDescriptionLen = 300

// categories is the allowlist served to the portal (admins.app_config.category).
var categories = map[string]bool{
	"brand": true, "maps": true, "region": true,
	"feature": true, "maintenance": true, "limits": true,
}

// variants is the allowlist for the app a value applies to (admins.app_config.app_variant).
// "all" is the "every product" wildcard the mobile apps always match.
var variants = map[string]bool{
	"customer": true, "delivery": true, "seller": true, "all": true,
}

// keyRe mirrors the DB primary-key check constraint.
var keyRe = regexp.MustCompile(`^[a-z0-9][a-z0-9._-]{0,63}$`)

// validKey reports whether key is a slug-like config key.
func validKey(key string) bool { return keyRe.MatchString(key) }

// validCategory reports whether category is on the allowlist.
func validCategory(category string) bool { return categories[category] }

// validVariant reports whether app_variant is on the allowlist.
func validVariant(variant string) bool { return variants[variant] }

// isJSONNull reports whether raw is a JSON `null` (the masked/keep sentinel used by the portal for
// secret values: "leave blank to keep the stored value").
func isJSONNull(raw json.RawMessage) bool {
	return len(raw) == 0 || string(bytes.TrimSpace(raw)) == "null"
}