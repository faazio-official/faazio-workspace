// Package portal owns the gateway-native Partner Portal sign-in: the SUPER_ADMIN credential store
// (admins.portal_users), rotating refresh sessions, short-lived access tokens, lockout and the
// /auth/portal routes. Future service: Go + Postgres (monolith-breakdown.md §1) — same shape as the
// admins context.
package portal

import (
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/base64"
	"errors"
	"fmt"
	"strconv"
	"strings"
	"sync"

	"golang.org/x/crypto/argon2"
)

// Argon2id parameters (OWASP interactive-login baseline): memory-hard, 64 MiB, 3 passes, 1 lane.
const (
	argonTime    uint32 = 3
	argonMemory  uint32 = 64 * 1024 // KiB
	argonThreads uint8  = 1
	argonKeyLen  uint32 = 32
	saltLen             = 16
	// maxConcurrentHashes bounds peak Argon2id memory (4 × 64 MiB per instance). Login is public,
	// so without this a spray of requests could exhaust the gateway container.
	maxConcurrentHashes = 4
)

// Hasher applies the server-side pepper then Argon2id. A per-password random salt makes the stored
// PHC string unique; the pepper means a stolen DB alone (without the env secret) is not crackable
// with a precomputed table.
type Hasher struct {
	pepper []byte
	sem    chan struct{}
}

// NewHasher builds a hasher. An empty pepper is allowed for local dev only (production sets
// PORTAL_PEPPER; see docs/RUNBOOKS/PORTAL_AUTH.md).
func NewHasher(pepper string) *Hasher {
	return &Hasher{pepper: []byte(pepper), sem: make(chan struct{}, maxConcurrentHashes)}
}

func (h *Hasher) acquire() { h.sem <- struct{}{} }
func (h *Hasher) release() { <-h.sem }

// Hash returns a PHC-format Argon2id string: $argon2id$v=19$m=...,t=...,p=...$salt$hash.
func (h *Hasher) Hash(password string) (string, error) {
	if len(password) == 0 {
		return "", errors.New("portal: empty password")
	}
	salt := make([]byte, saltLen)
	if _, err := rand.Read(salt); err != nil {
		return "", fmt.Errorf("portal: salt: %w", err)
	}
	h.acquire()
	sum := argon2.IDKey(h.withPepper(password), salt, argonTime, argonMemory, argonThreads, argonKeyLen)
	h.release()
	return fmt.Sprintf("$argon2id$v=%d$m=%d,t=%d,p=%d$%s$%s",
		argon2.Version, argonMemory, argonTime, argonThreads,
		base64.RawStdEncoding.EncodeToString(salt),
		base64.RawStdEncoding.EncodeToString(sum)), nil
}

// Verify reports whether password matches encoded. It is constant-time on the derived key and
// always runs one Argon2id derivation when encoded is parseable.
func (h *Hasher) Verify(password, encoded string) bool {
	params, salt, want, err := parsePHC(encoded)
	if err != nil {
		return false
	}
	h.acquire()
	got := argon2.IDKey(h.withPepper(password), salt, params.time, params.memory, params.threads, uint32(len(want)))
	h.release()
	return subtle.ConstantTimeCompare(got, want) == 1
}

// VerifyDummy burns the same Argon2id work for an unknown email so a missing account cannot be
// distinguished from a wrong password by response timing (user-enumeration defence).
func (h *Hasher) VerifyDummy(password string) {
	h.Verify(password, dummyPHC())
}

func (h *Hasher) withPepper(password string) []byte {
	if len(h.pepper) == 0 {
		return []byte(password)
	}
	mac := hmac.New(sha256.New, h.pepper)
	mac.Write([]byte(password))
	return mac.Sum(nil)
}

type argonParams struct {
	memory  uint32
	time    uint32
	threads uint8
}

func parsePHC(encoded string) (argonParams, []byte, []byte, error) {
	// "$argon2id$v=19$m=65536,t=3,p=1$<salt>$<hash>"
	parts := strings.Split(encoded, "$")
	if len(parts) != 6 || parts[1] != "argon2id" {
		return argonParams{}, nil, nil, errors.New("portal: not an argon2id PHC string")
	}
	version, err := strconv.Atoi(strings.TrimPrefix(parts[2], "v="))
	if err != nil || version != argon2.Version {
		return argonParams{}, nil, nil, errors.New("portal: unsupported argon2 version")
	}
	var p argonParams
	for _, item := range strings.Split(parts[3], ",") {
		kv := strings.SplitN(item, "=", 2)
		if len(kv) != 2 {
			return argonParams{}, nil, nil, errors.New("portal: bad argon2 params")
		}
		n, err := strconv.Atoi(kv[1])
		if err != nil || n <= 0 {
			return argonParams{}, nil, nil, errors.New("portal: bad argon2 param value")
		}
		switch kv[0] {
		case "m":
			p.memory = uint32(n)
		case "t":
			p.time = uint32(n)
		case "p":
			p.threads = uint8(n)
		default:
			return argonParams{}, nil, nil, errors.New("portal: unknown argon2 param")
		}
	}
	if p.memory == 0 || p.time == 0 || p.threads == 0 {
		return argonParams{}, nil, nil, errors.New("portal: incomplete argon2 params")
	}
	salt, err := base64.RawStdEncoding.DecodeString(parts[4])
	if err != nil || len(salt) < 8 {
		return argonParams{}, nil, nil, errors.New("portal: bad salt")
	}
	sum, err := base64.RawStdEncoding.DecodeString(parts[5])
	if err != nil || len(sum) < 16 {
		return argonParams{}, nil, nil, errors.New("portal: bad hash")
	}
	return p, salt, sum, nil
}

var (
	dummyOnce sync.Once
	dummyHash string
)

// dummyPHC lazily derives a throwaway hash with the same cost parameters. It never matches a real
// password; its only job is to make the unknown-email path cost the same as a real verification.
func dummyPHC() string {
	dummyOnce.Do(func() {
		salt := []byte("faazio-dummy-salt")
		sum := argon2.IDKey([]byte("faazio-dummy-password"), salt, argonTime, argonMemory, argonThreads, argonKeyLen)
		dummyHash = fmt.Sprintf("$argon2id$v=%d$m=%d,t=%d,p=%d$%s$%s",
			argon2.Version, argonMemory, argonTime, argonThreads,
			base64.RawStdEncoding.EncodeToString(salt),
			base64.RawStdEncoding.EncodeToString(sum))
	})
	return dummyHash
}
