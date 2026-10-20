package auth

import (
	"context"
	"crypto"
	"crypto/rsa"
	"crypto/sha256"
	"crypto/x509"
	"encoding/base64"
	"encoding/json"
	"encoding/pem"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"
)

// firebaseKeysURL is Google's rotating x509 key set for Firebase ID tokens.
const firebaseKeysURL = "https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com"

const (
	firebaseClockSkew = 60 * time.Second
	firebaseMinTTL    = 5 * time.Minute
	firebaseMaxTTL    = 24 * time.Hour
)

// FirebaseVerifier verifies Firebase Authentication ID tokens (RS256) against Google's
// published certificate set. It keeps the standard library only: no service account JSON,
// no firebase-admin SDK, no extra dependency in the gateway binary.
//
// Checks: RS256 signature, kid lookup, iss = https://securetoken.google.com/<project>,
// aud = <project>, exp, iat, and a non-empty subject (Firebase `user_id`).
type FirebaseVerifier struct {
	projectID string
	keysURL   string
	client    *http.Client

	mu          sync.RWMutex
	keys        map[string]*rsa.PublicKey
	keysExpiry  time.Time
	lastAttempt time.Time
}

// NewFirebaseVerifier returns a verifier for the given Firebase project ID. An empty
// project ID is rejected at verify time, so a misconfigured deploy fails closed.
func NewFirebaseVerifier(projectID string) *FirebaseVerifier {
	return &FirebaseVerifier{
		projectID: strings.TrimSpace(projectID),
		keysURL:   firebaseKeysURL,
		client:    &http.Client{Timeout: 5 * time.Second},
	}
}

type firebaseHeader struct {
	Alg string `json:"alg"`
	Kid string `json:"kid"`
}

type firebaseClaims struct {
	Issuer      string `json:"iss"`
	Audience    string `json:"aud"`
	Subject     string `json:"sub"`
	UserID      string `json:"user_id"`
	IssuedAt    int64  `json:"iat"`
	ExpiresAt   int64  `json:"exp"`
	Phone       string `json:"phone_number"`
	Email       string `json:"email"`
	Name        string `json:"name"`
	AppRole     string `json:"app_role"`
	SellerID    string `json:"seller_id"`
	StateCode   string `json:"state_code"`
	AppMetadata struct {
		AppRole   string `json:"app_role"`
		Role      string `json:"role"`
		SellerID  string `json:"seller_id"`
		StateCode string `json:"state_code"`
	} `json:"app_metadata"`
}

// Verify validates a Firebase ID token and returns the subset of claims the gateway uses.
func (v *FirebaseVerifier) Verify(ctx context.Context, token string) (jwtClaims, error) {
	if v == nil || v.projectID == "" {
		return jwtClaims{}, errors.New("firebase project id not configured")
	}
	parts := strings.Split(token, ".")
	if len(parts) != 3 {
		return jwtClaims{}, errors.New("malformed token")
	}

	rawHeader, err := base64.RawURLEncoding.DecodeString(parts[0])
	if err != nil {
		return jwtClaims{}, errors.New("bad header encoding")
	}
	var header firebaseHeader
	if err := json.Unmarshal(rawHeader, &header); err != nil {
		return jwtClaims{}, errors.New("bad header")
	}
	if header.Alg != "RS256" || header.Kid == "" {
		return jwtClaims{}, errors.New("unsupported token algorithm")
	}

	sig, err := base64.RawURLEncoding.DecodeString(parts[2])
	if err != nil {
		return jwtClaims{}, errors.New("bad signature encoding")
	}
	key, err := v.key(ctx, header.Kid)
	if err != nil {
		return jwtClaims{}, err
	}
	hashed := sha256.Sum256([]byte(parts[0] + "." + parts[1]))
	if err := rsa.VerifyPKCS1v15(key, crypto.SHA256, hashed[:], sig); err != nil {
		return jwtClaims{}, errors.New("signature mismatch")
	}

	payload, err := base64.RawURLEncoding.DecodeString(parts[1])
	if err != nil {
		return jwtClaims{}, errors.New("bad payload encoding")
	}
	var fc firebaseClaims
	if err := json.Unmarshal(payload, &fc); err != nil {
		return jwtClaims{}, errors.New("bad claims")
	}

	now := time.Now()
	issuer := "https://securetoken.google.com/" + v.projectID
	if fc.Issuer != issuer {
		return jwtClaims{}, errors.New("wrong issuer")
	}
	if fc.Audience != v.projectID {
		return jwtClaims{}, errors.New("wrong audience")
	}
	if fc.ExpiresAt == 0 || now.After(time.Unix(fc.ExpiresAt, 0).Add(firebaseClockSkew)) {
		return jwtClaims{}, errors.New("token expired")
	}
	if fc.IssuedAt != 0 && time.Unix(fc.IssuedAt, 0).After(now.Add(firebaseClockSkew)) {
		return jwtClaims{}, errors.New("token issued in the future")
	}
	subject := fc.Subject
	if subject == "" {
		subject = fc.UserID
	}
	if subject == "" {
		return jwtClaims{}, errors.New("no subject")
	}

	claims := jwtClaims{
		Sub:       subject,
		Exp:       fc.ExpiresAt,
		Phone:     fc.Phone,
		Email:     fc.Email,
		AppRole:   fc.AppRole,
		SellerID:  fc.SellerID,
		StateCode: fc.StateCode,
	}
	claims.AppMetadata.AppRole = fc.AppMetadata.AppRole
	claims.AppMetadata.Role = fc.AppMetadata.Role
	claims.AppMetadata.SellerID = fc.AppMetadata.SellerID
	claims.AppMetadata.StateCode = fc.AppMetadata.StateCode
	return claims, nil
}

// key returns the RSA public key for kid, refreshing Google's certificate set when the
// cached copy is absent or expired.
func (v *FirebaseVerifier) key(ctx context.Context, kid string) (*rsa.PublicKey, error) {
	now := time.Now()
	v.mu.RLock()
	key := v.keys[kid]
	fresh := now.Before(v.keysExpiry)
	lastAttempt := v.lastAttempt
	v.mu.RUnlock()
	if key != nil && fresh {
		return key, nil
	}
	// A fresh cache that lacks the kid is either a rotated key or an attacker-supplied kid.
	// Refresh once per 30 s at most so random kids cannot turn every request into a Google fetch.
	if fresh && now.Sub(lastAttempt) < 30*time.Second {
		return nil, errors.New("unknown signing key")
	}
	if err := v.refreshKeys(ctx); err != nil {
		if key != nil {
			return key, nil
		}
		return nil, err
	}
	v.mu.RLock()
	key = v.keys[kid]
	v.mu.RUnlock()
	if key == nil {
		return nil, errors.New("unknown signing key")
	}
	return key, nil
}

// refreshKeys fetches and caches Google's x509 certificate map, honouring Cache-Control max-age.
func (v *FirebaseVerifier) refreshKeys(ctx context.Context) error {
	v.mu.Lock()
	v.lastAttempt = time.Now()
	v.mu.Unlock()

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, v.keysURL, nil)
	if err != nil {
		return err
	}
	res, err := v.client.Do(req)
	if err != nil {
		return fmt.Errorf("firebase keys: %w", err)
	}
	defer res.Body.Close()
	if res.StatusCode != http.StatusOK {
		return fmt.Errorf("firebase keys: status %d", res.StatusCode)
	}
	body, err := io.ReadAll(io.LimitReader(res.Body, 1<<20))
	if err != nil {
		return fmt.Errorf("firebase keys: %w", err)
	}
	var raw map[string]string
	if err := json.Unmarshal(body, &raw); err != nil {
		return fmt.Errorf("firebase keys: %w", err)
	}
	keys := make(map[string]*rsa.PublicKey, len(raw))
	for kid, certPEM := range raw {
		key, err := parseCertificateKey(certPEM)
		if err != nil {
			continue
		}
		keys[kid] = key
	}
	if len(keys) == 0 {
		return errors.New("firebase keys: empty key set")
	}
	v.mu.Lock()
	v.keys = keys
	v.keysExpiry = time.Now().Add(cacheTTL(res.Header.Get("Cache-Control")))
	v.mu.Unlock()
	return nil
}

func parseCertificateKey(certPEM string) (*rsa.PublicKey, error) {
	block, _ := pem.Decode([]byte(certPEM))
	if block == nil {
		return nil, errors.New("bad certificate")
	}
	cert, err := x509.ParseCertificate(block.Bytes)
	if err != nil {
		return nil, err
	}
	key, ok := cert.PublicKey.(*rsa.PublicKey)
	if !ok {
		return nil, errors.New("certificate key is not RSA")
	}
	return key, nil
}

// cacheTTL parses Cache-Control max-age, clamped to a safe range.
func cacheTTL(header string) time.Duration {
	for _, part := range strings.Split(header, ",") {
		part = strings.TrimSpace(part)
		if !strings.HasPrefix(strings.ToLower(part), "max-age=") {
			continue
		}
		raw := strings.TrimPrefix(part, "max-age=")
		if seconds, err := strconv.Atoi(strings.TrimSpace(raw)); err == nil && seconds > 0 {
			ttl := time.Duration(seconds) * time.Second
			if ttl < firebaseMinTTL {
				return firebaseMinTTL
			}
			if ttl > firebaseMaxTTL {
				return firebaseMaxTTL
			}
			return ttl
		}
	}
	return time.Hour
}
