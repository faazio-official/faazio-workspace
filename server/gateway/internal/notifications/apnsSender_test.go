package notifications

import (
	"context"
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"crypto/sha256"
	"crypto/x509"
	"encoding/base64"
	"encoding/json"
	"encoding/pem"
	"errors"
	"math/big"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

// testP8 builds a throwaway PKCS#8 P-256 key in the same PEM shape as an Apple .p8 file.
func testP8(t *testing.T) []byte {
	t.Helper()
	key, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		t.Fatalf("generate key: %v", err)
	}
	der, err := x509.MarshalPKCS8PrivateKey(key)
	if err != nil {
		t.Fatalf("marshal key: %v", err)
	}
	return pem.EncodeToMemory(&pem.Block{Type: "PRIVATE KEY", Bytes: der})
}

// newTestAPNS constructs a sender against an httptest host instead of Apple's endpoint.
func newTestAPNS(t *testing.T, endpoint string) *APNSender {
	t.Helper()
	sender, err := NewAPNSender("KEYID123", "TEAMID456", testP8(t), "com.faazio.customer.voip", "production")
	if err != nil {
		t.Fatalf("NewAPNSender: %v", err)
	}
	a := sender.(*APNSender)
	a.endpoint = endpoint
	return a
}

func TestNewAPNSenderEmptyDisables(t *testing.T) {
	if s, err := NewAPNSender("", "team", testP8(t), "", ""); s != nil || err != nil {
		t.Fatalf("missing key id must disable the sender, got %v, %v", s, err)
	}
	if s, err := NewAPNSender("kid", "", testP8(t), "", ""); s != nil || err != nil {
		t.Fatalf("missing team id must disable the sender, got %v, %v", s, err)
	}
	if s, err := NewAPNSender("kid", "team", nil, "", ""); s != nil || err != nil {
		t.Fatalf("missing key must disable the sender, got %v, %v", s, err)
	}
}

func TestNewAPNSenderMalformedKey(t *testing.T) {
	if _, err := NewAPNSender("kid", "team", []byte("not a key"), "", ""); err == nil {
		t.Fatal("malformed key must error so boot can log and stay disabled")
	}
}

func TestNewAPNSenderEnvironmentAndDefaults(t *testing.T) {
	sandbox, err := NewAPNSender("kid", "team", testP8(t), "", "sandbox")
	if err != nil {
		t.Fatalf("sandbox: %v", err)
	}
	if got := sandbox.(*APNSender).endpoint; got != apnsSandboxEndpoint {
		t.Fatalf("sandbox endpoint = %q", got)
	}
	prod, err := NewAPNSender("kid", "team", testP8(t), "", "")
	if err != nil {
		t.Fatalf("production: %v", err)
	}
	p := prod.(*APNSender)
	if p.endpoint != apnsProductionEndpoint {
		t.Fatalf("production endpoint = %q", p.endpoint)
	}
	if p.topic != apnsDefaultTopic {
		t.Fatalf("default topic = %q", p.topic)
	}
}

func TestAPNSenderSendShape(t *testing.T) {
	var gotPath, gotAuth, gotTopic, gotType, gotPriority, gotCollapse string
	var gotBody map[string]any
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotPath = r.URL.Path
		gotAuth = r.Header.Get("authorization")
		gotTopic = r.Header.Get("apns-topic")
		gotType = r.Header.Get("apns-push-type")
		gotPriority = r.Header.Get("apns-priority")
		gotCollapse = r.Header.Get("apns-collapse-id")
		_ = json.NewDecoder(r.Body).Decode(&gotBody)
		w.WriteHeader(http.StatusOK)
	}))
	defer srv.Close()

	s := newTestAPNS(t, srv.URL)
	data := []byte(`{"type":"incoming_call","callId":"call-abc","callUuid":"6f1c2d3e-4a5b-4c6d-8e9f-0a1b2c3d4e5f","callerLabel":"Delivery Partner"}`)
	if err := s.Send(context.Background(), "voiptoken", "Incoming call", "Tap to answer", data); err != nil {
		t.Fatalf("Send: %v", err)
	}
	if gotPath != "/3/device/voiptoken" {
		t.Fatalf("path = %q", gotPath)
	}
	if !strings.HasPrefix(gotAuth, "bearer ") || len(gotAuth) < 40 {
		t.Fatalf("authorization header missing a JWT: %q", gotAuth)
	}
	if gotTopic != "com.faazio.customer.voip" {
		t.Fatalf("apns-topic = %q", gotTopic)
	}
	if gotType != "voip" {
		t.Fatalf("apns-push-type = %q, want voip", gotType)
	}
	if gotPriority != "10" {
		t.Fatalf("apns-priority = %q, want 10", gotPriority)
	}
	if gotCollapse != "call-abc" {
		t.Fatalf("apns-collapse-id = %q, want the call id", gotCollapse)
	}
	// The outbox data must be merged at the top level: PushKit reads it verbatim.
	if gotBody["callId"] != "call-abc" || gotBody["callerLabel"] != "Delivery Partner" {
		t.Fatalf("payload did not carry the call data: %v", gotBody)
	}
	if _, ok := gotBody["aps"]; !ok {
		t.Fatalf("payload is missing aps: %v", gotBody)
	}
}

// The provider token must be a real ES256 JWT: kid in the header, iss/iat in the claims, and a
// 64-byte raw r||s signature that verifies against the key.
func TestAPNSenderJWTIsValidES256(t *testing.T) {
	s := newTestAPNS(t, "http://unused")
	tok, err := s.providerToken()
	if err != nil {
		t.Fatalf("providerToken: %v", err)
	}
	parts := strings.Split(tok, ".")
	if len(parts) != 3 {
		t.Fatalf("jwt has %d parts, want 3", len(parts))
	}
	header, err := base64.RawURLEncoding.DecodeString(parts[0])
	if err != nil {
		t.Fatalf("decode header: %v", err)
	}
	var h struct {
		Alg string `json:"alg"`
		Kid string `json:"kid"`
	}
	if err := json.Unmarshal(header, &h); err != nil {
		t.Fatalf("header json: %v", err)
	}
	if h.Alg != "ES256" || h.Kid != "KEYID123" {
		t.Fatalf("header = %+v", h)
	}
	claimsRaw, err := base64.RawURLEncoding.DecodeString(parts[1])
	if err != nil {
		t.Fatalf("decode claims: %v", err)
	}
	var c struct {
		Iss string `json:"iss"`
		Iat int64  `json:"iat"`
	}
	if err := json.Unmarshal(claimsRaw, &c); err != nil {
		t.Fatalf("claims json: %v", err)
	}
	if c.Iss != "TEAMID456" || c.Iat == 0 {
		t.Fatalf("claims = %+v", c)
	}
	sig, err := base64.RawURLEncoding.DecodeString(parts[2])
	if err != nil {
		t.Fatalf("decode signature: %v", err)
	}
	if len(sig) != 64 {
		t.Fatalf("signature is %d bytes, want the raw 64-byte JOSE form", len(sig))
	}
	pub := s.key.PublicKey
	r := new(big.Int).SetBytes(sig[:32])
	ss := new(big.Int).SetBytes(sig[32:])
	digest := sha256Sum(parts[0] + "." + parts[1])
	if !ecdsa.Verify(&pub, digest, r, ss) {
		t.Fatal("jwt signature does not verify against the .p8 key")
	}
}

func sha256Sum(input string) []byte {
	sum := sha256.Sum256([]byte(input))
	return sum[:]
}

// A cached token is reused while fresh and re-minted after the lifetime, so a long-lived process
// never sends an expired provider token.
func TestAPNSenderCachesProviderToken(t *testing.T) {
	s := newTestAPNS(t, "http://unused")
	base := time.Unix(0, 0)
	s.now = func() time.Time { return base }
	first, err := s.providerToken()
	if err != nil {
		t.Fatalf("providerToken: %v", err)
	}
	second, err := s.providerToken()
	if err != nil {
		t.Fatalf("providerToken: %v", err)
	}
	if first != second {
		t.Fatal("a fresh provider token must be reused, not re-minted per send")
	}
	s.now = func() time.Time { return base.Add(apnsTokenLifetime + time.Minute) }
	third, err := s.providerToken()
	if err != nil {
		t.Fatalf("providerToken after expiry: %v", err)
	}
	if third == first {
		t.Fatal("a stale provider token must be re-minted")
	}
}

func TestAPNSenderDeadTokenIsTerminal(t *testing.T) {
	for _, tc := range []struct {
		name   string
		status int
		body   string
	}{
		{"410 gone", http.StatusGone, `{"reason":"Unregistered"}`},
		{"400 bad device token", http.StatusBadRequest, `{"reason":"BadDeviceToken"}`},
		{"400 token not for topic", http.StatusBadRequest, `{"reason":"DeviceTokenNotForTopic"}`},
	} {
		t.Run(tc.name, func(t *testing.T) {
			srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
				w.WriteHeader(tc.status)
				_, _ = w.Write([]byte(tc.body))
			}))
			defer srv.Close()
			s := newTestAPNS(t, srv.URL)
			err := s.Send(context.Background(), "t", "Incoming call", "", nil)
			if !errors.Is(err, ErrTokenUnregistered) {
				t.Fatalf("want ErrTokenUnregistered, got %v", err)
			}
		})
	}
}

// A retryable APNs failure (e.g. 503, or a bad topic) must NOT prune the token.
func TestAPNSenderTransientErrorKeepsToken(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusServiceUnavailable)
		_, _ = w.Write([]byte(`{"reason":"ServiceUnavailable"}`))
	}))
	defer srv.Close()
	s := newTestAPNS(t, srv.URL)
	err := s.Send(context.Background(), "t", "Incoming call", "", nil)
	if err == nil {
		t.Fatal("non-2xx must be an error so the row retries")
	}
	if errors.Is(err, ErrTokenUnregistered) {
		t.Fatal("a transient failure must not prune the token")
	}
}

// A VoIP token must be routed to APNs, never to FCM (which cannot carry apns-push-type: voip).
func TestMultiSenderRoutesVoIPToAPNS(t *testing.T) {
	var apnsCalls, fcmCalls int
	apns := recordingSender{fn: func() { apnsCalls++ }}
	fcm := recordingSender{fn: func() { fcmCalls++ }}
	router := NewMultiSender(fcm, apns)
	if name := router.(*MultiSender).Configured(); name != "apns+fcm" {
		t.Fatalf("Configured() = %q", name)
	}
	if !SupportsVoIP(router) {
		t.Fatal("a router with APNs must report SupportsVoIP() = true")
	}
	if err := router.Send(context.Background(), RoutedMessage{
		Platform: "ios", TokenKind: TokenKindVoIP, Token: "voip",
	}); err != nil {
		t.Fatalf("Send voip: %v", err)
	}
	if apnsCalls != 1 || fcmCalls != 0 {
		t.Fatalf("voip → apns=%d fcm=%d, want apns only", apnsCalls, fcmCalls)
	}
	if err := router.Send(context.Background(), RoutedMessage{
		Platform: "android", TokenKind: TokenKindPush, Token: "fcm",
	}); err != nil {
		t.Fatalf("Send push: %v", err)
	}
	if apnsCalls != 1 || fcmCalls != 1 {
		t.Fatalf("push → apns=%d fcm=%d, want fcm only", apnsCalls, fcmCalls)
	}
}

// With no APNs key provisioned a PushKit token is undeliverable: it is not an FCM registration
// token, so handing it to FCM can only fail. The router must report that honestly (so the drain
// marks the row FAILED and logs a real cause) and must not consume an FCM send attempt.
func TestMultiSenderRejectsVoIPWithoutAPNs(t *testing.T) {
	fcmCalls := 0
	router := NewMultiSender(recordingSender{fn: func() { fcmCalls++ }}, nil)
	if SupportsVoIP(router) {
		t.Fatal("a router without APNs must report SupportsVoIP() = false")
	}
	if err := router.Send(context.Background(), RoutedMessage{
		Platform: "ios", TokenKind: TokenKindVoIP, Token: "voip",
	}); err == nil {
		t.Fatal("a voip token without an APNs transport must be an error")
	}
	if fcmCalls != 0 {
		t.Fatalf("fcm calls = %d, want 0 (an FCM send with a PushKit token cannot succeed)", fcmCalls)
	}
}

func TestMultiSenderNilWhenNothingConfigured(t *testing.T) {
	if router := NewMultiSender(nil, nil); router != nil {
		t.Fatalf("nil transports must build a nil router, got %v", router)
	}
}

// The fallback label keeps the CallKit screen from showing an empty caller.
func TestAPNSPayloadCallerLabelFallback(t *testing.T) {
	got := apnsPayload("Incoming call", "", []byte(`{"type":"incoming_call","callId":"c1"}`))
	if got["callerLabel"] != "Incoming call" {
		t.Fatalf("callerLabel = %v", got["callerLabel"])
	}
	explicit := apnsPayload("Incoming call", "", []byte(`{"callerLabel":"Customer"}`))
	if explicit["callerLabel"] != "Customer" {
		t.Fatalf("an explicit label must win, got %v", explicit["callerLabel"])
	}
}

type recordingSender struct{ fn func() }

func (s recordingSender) Send(_ context.Context, _, _, _ string, _ []byte) error {
	s.fn()
	return nil
}
