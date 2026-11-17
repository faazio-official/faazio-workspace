// APNSender delivers VoIP pushes straight from the gateway to Apple Push Notification service over
// HTTP/2, authenticated with an ES256 provider-token JWT minted from the .p8 auth key. Only a direct
// APNs connection can deliver a PushKit wake-up (`apns-push-type: voip`); FCM cannot, so an iOS
// customer would otherwise never ring. It never logs the device token or the payload.
package notifications

import (
	"bytes"
	"context"
	"crypto/ecdsa"
	"crypto/rand"
	"crypto/sha256"
	"crypto/x509"
	"encoding/base64"
	"encoding/json"
	"encoding/pem"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
	"sync"
	"time"
)

const (
	// apnsProductionEndpoint / apnsSandboxEndpoint are the HTTP/2 hosts. A token minted for the
	// development environment is rejected by production (and vice versa), so the caller picks one
	// from APNS_ENVIRONMENT.
	apnsProductionEndpoint = "https://api.push.apple.com"
	apnsSandboxEndpoint    = "https://api.sandbox.push.apple.com"
	// apnsDefaultTopic is the app bundle id. A PushKit push uses the same topic as every other push;
	// only the `apns-push-type: voip` header distinguishes it. A `.voip` suffix is not a topic APNs
	// will accept (the notification is rejected with `TopicDisallowed`).
	apnsDefaultTopic = "com.faazio.customer"
	// apnsMaxErrorBody caps how much of a non-2xx body reaches the error string.
	apnsMaxErrorBody = 1024
	// apnsTokenLifetime is how long a minted provider token is reused. Apple accepts up to 1h and
	// rejects tokens older than that; 50 min leaves room for clock skew.
	apnsTokenLifetime = 50 * time.Minute
	// apnsCallExpiration matches the Android call TTL: a ring delivered later than this is useless
	// because the call row has already been swept to MISSED.
	apnsCallExpiration = 45 * time.Second
)

// APNSender is a Sender for PushKit VoIP pushes. Safe for concurrent use: the signing key is
// read-only and the cached JWT is guarded by a mutex.
type APNSender struct {
	keyID      string
	teamID     string
	topic      string
	endpoint   string
	httpClient *http.Client
	key        *ecdsa.PrivateKey

	mu       sync.Mutex
	jwt      string
	jwtUntil time.Time
	now      func() time.Time
}

// NewAPNSender builds a VoIP sender. Any missing credential yields a nil Sender (push stays
// disabled, the drain worker never picks a voip token). A non-nil error means the key material is
// malformed — the caller should log one loud line rather than silently dropping iOS rings.
func NewAPNSender(keyID, teamID string, p8PEM []byte, topic, environment string) (Sender, error) {
	if strings.TrimSpace(keyID) == "" || strings.TrimSpace(teamID) == "" ||
		len(bytes.TrimSpace(p8PEM)) == 0 {
		return nil, nil
	}
	key, err := parseAPNsKey(p8PEM)
	if err != nil {
		return nil, err
	}
	if strings.TrimSpace(topic) == "" {
		topic = apnsDefaultTopic
	}
	endpoint := apnsProductionEndpoint
	if strings.EqualFold(strings.TrimSpace(environment), "sandbox") ||
		strings.EqualFold(strings.TrimSpace(environment), "development") {
		endpoint = apnsSandboxEndpoint
	}
	return &APNSender{
		keyID:      strings.TrimSpace(keyID),
		teamID:     strings.TrimSpace(teamID),
		topic:      strings.TrimSpace(topic),
		endpoint:   endpoint,
		httpClient: &http.Client{Timeout: 10 * time.Second},
		key:        key,
		now:        time.Now,
	}, nil
}

// parseAPNsKey decodes the PEM .p8 file downloaded from the Apple Developer portal (PKCS#8 EC key).
// A bare base64 body (no PEM armour) is accepted too, so an env var can hold either form.
func parseAPNsKey(raw []byte) (*ecdsa.PrivateKey, error) {
	body := bytes.TrimSpace(raw)
	der := body
	if block, _ := pem.Decode(body); block != nil {
		der = block.Bytes
	} else {
		decoded, err := base64.StdEncoding.DecodeString(string(body))
		if err != nil {
			return nil, fmt.Errorf("apns: parse private key: not PEM or base64")
		}
		der = decoded
	}
	parsed, err := x509.ParsePKCS8PrivateKey(der)
	if err != nil {
		return nil, fmt.Errorf("apns: parse private key: %w", err)
	}
	key, ok := parsed.(*ecdsa.PrivateKey)
	if !ok {
		return nil, errors.New("apns: private key is not an ECDSA (ES256) key")
	}
	if key.Curve.Params().Name != "P-256" {
		return nil, fmt.Errorf("apns: private key curve %s is not P-256", key.Curve.Params().Name)
	}
	return key, nil
}

// Send delivers one VoIP push. `data` is the outbox JSON object; its keys are merged at the top
// level of the APNs payload because PushKit hands the whole dictionary to the app delegate (unlike
// an alert push, where custom keys nest under aps).
func (s *APNSender) Send(ctx context.Context, token, title, body string, data []byte) error {
	if s == nil || s.key == nil {
		return errors.New("apns: sender not configured")
	}
	payload := apnsPayload(title, body, data)
	b, err := json.Marshal(payload)
	if err != nil {
		return err
	}
	jwt, err := s.providerToken()
	if err != nil {
		return err
	}

	url := s.endpoint + "/3/device/" + token
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(b))
	if err != nil {
		return err
	}
	req.Header.Set("authorization", "bearer "+jwt)
	req.Header.Set("apns-topic", s.topic)
	req.Header.Set("apns-push-type", "voip")
	req.Header.Set("apns-priority", "10")
	req.Header.Set("apns-expiration", fmt.Sprintf("%d", s.now().Add(apnsCallExpiration).Unix()))
	req.Header.Set("content-type", "application/json")
	if callID := apnsStringField(data, "callId"); callID != "" {
		// Collapse a re-delivered ring for the same call instead of stacking duplicate CallKit
		// incoming calls on the device.
		req.Header.Set("apns-collapse-id", callID)
	}

	res, err := s.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("apns: request: %w", err)
	}
	defer func() { _ = res.Body.Close() }()
	if res.StatusCode >= 200 && res.StatusCode < 300 {
		_, _ = io.Copy(io.Discard, res.Body)
		return nil
	}
	errBody, _ := io.ReadAll(io.LimitReader(res.Body, apnsMaxErrorBody))
	if apnsDeadToken(res.StatusCode, errBody) {
		return fmt.Errorf("%w: status %d", ErrTokenUnregistered, res.StatusCode)
	}
	return fmt.Errorf("apns: status %d: %s", res.StatusCode, string(errBody))
}

// providerToken returns a cached ES256 JWT, minting a fresh one when the cache is cold or stale.
func (s *APNSender) providerToken() (string, error) {
	now := s.now()
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.jwt != "" && now.Before(s.jwtUntil) {
		return s.jwt, nil
	}
	minted, err := s.signJWT(now)
	if err != nil {
		return "", err
	}
	s.jwt = minted
	s.jwtUntil = now.Add(apnsTokenLifetime)
	return minted, nil
}

// signJWT builds the provider authentication token: header {alg: ES256, kid}, claims
// {iss: teamID, iat}. APNs signs with ES256 and expects the JOSE raw r||s signature, not DER.
func (s *APNSender) signJWT(now time.Time) (string, error) {
	header, err := json.Marshal(map[string]string{"alg": "ES256", "kid": s.keyID})
	if err != nil {
		return "", err
	}
	claims, err := json.Marshal(map[string]any{
		"iss": s.teamID,
		"iat": now.Unix(),
		"exp": now.Add(time.Hour).Unix(),
	})
	if err != nil {
		return "", err
	}
	signingInput := base64.RawURLEncoding.EncodeToString(header) + "." +
		base64.RawURLEncoding.EncodeToString(claims)
	digest := sha256.Sum256([]byte(signingInput))
	r, ss, err := ecdsa.Sign(rand.Reader, s.key, digest[:])
	if err != nil {
		return "", fmt.Errorf("apns: sign jwt: %w", err)
	}
	// JOSE requires the fixed-width concatenation of r and s (32 bytes each for P-256).
	sig := make([]byte, 64)
	r.FillBytes(sig[:32])
	ss.FillBytes(sig[32:])
	return signingInput + "." + base64.RawURLEncoding.EncodeToString(sig), nil
}

// apnsDeadToken reports whether a non-2xx response means the device token is permanently invalid,
// so the drain worker expires the row and prunes the token instead of retrying.
func apnsDeadToken(status int, body []byte) bool {
	if status == http.StatusGone {
		return true
	}
	if status != http.StatusBadRequest {
		return false
	}
	var env struct {
		Reason string `json:"reason"`
	}
	if err := json.Unmarshal(body, &env); err != nil {
		return false
	}
	switch env.Reason {
	case "BadDeviceToken", "DeviceTokenNotForTopic", "Unregistered":
		return true
	}
	return false
}

// apnsPayload merges the outbox data object into the top level of the VoIP payload. A VoIP payload
// is not rendered by the system: PushKit hands it to the app verbatim, so no alert text is needed
// (and an alert key would be ignored). content-available keeps the payload valid for older readers.
func apnsPayload(title, body string, data []byte) map[string]any {
	payload := map[string]any{"aps": map[string]any{"content-available": 1}}
	if len(data) > 0 {
		var extra map[string]any
		if err := json.Unmarshal(data, &extra); err == nil {
			for k, v := range extra {
				if k == "aps" {
					continue
				}
				payload[k] = v
			}
		}
	}
	// Fall back to the outbox copy only when the payload carries no caller label, so the CallKit
	// screen never shows an empty name.
	if _, ok := payload["callerLabel"]; !ok {
		if label := strings.TrimSpace(title); label != "" {
			payload["callerLabel"] = label
		} else if label := strings.TrimSpace(body); label != "" {
			payload["callerLabel"] = label
		}
	}
	return payload
}

// apnsStringField reads one string field out of the raw outbox data object.
func apnsStringField(data []byte, key string) string {
	if len(data) == 0 {
		return ""
	}
	var obj map[string]any
	if err := json.Unmarshal(data, &obj); err != nil {
		return ""
	}
	if v, ok := obj[key].(string); ok {
		return v
	}
	return ""
}
