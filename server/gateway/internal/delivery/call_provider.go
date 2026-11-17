package delivery

import (
	"bytes"
	"context"
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"github.com/faazio/server/gateway/internal/contracts"
)

// WithCalling attaches the server-side calling configuration. An empty config leaves calling
// disabled: initiate returns 503 instead of fabricating a room or number.
func (h *Handler) WithCalling(cfg CallConfig) *Handler {
	h.calls = cfg
	return h
}

// WithPushNudger attaches the outbox nudge so a ring push is delivered immediately. Without it a
// call still rings, but only when the next drain tick runs (up to 30s later) — longer than the ring
// TTL, so the call would be missed. Nil is safe (no-op).
func (h *Handler) WithPushNudger(n contracts.PushNudger) *Handler {
	h.nudger = n
	return h
}

// PSTNProviderExotel is the only supported PSTN bridge provider today.
const PSTNProviderExotel = "exotel"

// CallConfig is the server-side calling configuration. Secrets are env-only (see
// internal/platform/config) and never projected to a client.
//
// VOIP is enabled only when the 100ms credentials are present plus either a management token +
// template (per-call rooms, production) or an explicit room id (single pre-provisioned room, dev
// only). PSTN_BRIDGING is enabled when a virtual number is configured.
//
// Two PSTN shapes exist:
//   - Bridged (provider configured): the server places the call itself through the telephony
//     provider's Connect API and stores the provider call id, so neither peer ever dials. Answer and
//     hangup are reconciled from the provider status webhook.
//   - Handoff (no provider configured): the app dials the masked virtual number, which stays a
//     pure masked-number handoff. This is the honest degraded mode, not a fabricated bridge.
type CallConfig struct {
	// VirtualNumber is the platform's PSTN landline (ExoPhone) used as CallerId for bridged calls
	// and as the dialled number in handoff mode.
	VirtualNumber string
	// PSTNProvider selects the bridge implementation ("" | "exotel").
	PSTNProvider string
	// ExotelAccountSID / ExotelAPIKey / ExotelAPIToken authenticate the Connect API (Basic auth).
	ExotelAccountSID string
	ExotelAPIKey     string
	ExotelAPIToken   string
	// ExotelSubdomain overrides the API host (api.exotel.com | api.in.exotel.com).
	ExotelSubdomain string
	// PSTNWebhookURL is the absolute public URL the provider posts call events to.
	PSTNWebhookURL string
	// PSTNWebhookToken is a shared secret appended to PSTNWebhookURL and compared on every event.
	PSTNWebhookToken string
	// PSTNTimeLimitSeconds caps a bridged call (default 900); PSTNTimeOutSeconds caps each ringing
	// leg (default 30).
	PSTNTimeLimitSeconds int
	PSTNTimeOutSeconds   int
	// HMSAppAccessKey / HMSAppSecret sign the short-lived room auth token (HS256).
	HMSAppAccessKey string
	HMSAppSecret    string
	// HMSManagementToken + HMSTemplateID create a per-call room through the 100ms v2 API.
	// HMSManagementToken is optional; when empty, a short-lived management token is minted from the
	// app key/secret for the create-room call.
	HMSManagementToken string
	HMSTemplateID      string
	// HMSRoomID is a pre-provisioned room fallback for local/dev use.
	HMSRoomID string
	// HMSRole is the 100ms role both peers join with (default "guest").
	HMSRole string
	// HMSEndpoint overrides the 100ms API origin (empty = https://api.100ms.live).
	HMSEndpoint string
	// RingingAckSeconds is the window before a VOIP call may fall back to PSTN (default 3).
	RingingAckSeconds int
}

// CanVoIP reports whether both a token signer and a room source are configured.
func (c CallConfig) CanVoIP() bool {
	if c.HMSAppAccessKey == "" || c.HMSAppSecret == "" {
		return false
	}
	return c.HMSRoomID != "" || c.HMSTemplateID != ""
}

// CanPSTN reports whether the masked virtual number is configured. In this mode the app may dial
// the masked number itself (handoff) or the server may bridge through the provider.
func (c CallConfig) CanPSTN() bool { return c.VirtualNumber != "" }

// CanBridgePSTN reports whether the server can place the masked call itself through the telephony
// provider. When false the platform degrades to the dialled masked number (handoff) instead of
// pretending a bridge exists.
func (c CallConfig) CanBridgePSTN() bool {
	if c.VirtualNumber == "" || !strings.EqualFold(strings.TrimSpace(c.PSTNProvider), PSTNProviderExotel) {
		return false
	}
	return c.ExotelAccountSID != "" && c.ExotelAPIKey != "" && c.ExotelAPIToken != ""
}

// CanReconcilePSTN reports whether a bridged call can be reconciled end to end: the bridge is
// configured, the provider can reach a public callback URL, and a shared webhook token exists. The
// gate is fail-closed — without a token the webhook would be an unauthenticated state-machine write —
// and it also gates *placing* a bridge: a bridge whose answer/end events never arrive would leave the
// row RINGING until the sweep marks a live call MISSED.
func (c CallConfig) CanReconcilePSTN() bool {
	return c.CanBridgePSTN() &&
		strings.TrimSpace(c.PSTNWebhookURL) != "" &&
		strings.TrimSpace(c.PSTNWebhookToken) != ""
}

// pstnTimeLimit / pstnTimeOut are the provider-side call guards.
func (c CallConfig) pstnTimeLimit() int {
	if c.PSTNTimeLimitSeconds < 30 {
		return 900
	}
	return c.PSTNTimeLimitSeconds
}

func (c CallConfig) pstnTimeOut() int {
	if c.PSTNTimeOutSeconds < 5 {
		return 30
	}
	return c.PSTNTimeOutSeconds
}

func (c CallConfig) exotelEndpoint() string {
	host := strings.TrimSpace(c.ExotelSubdomain)
	if host == "" {
		host = "api.exotel.com"
	}
	host = strings.TrimRight(strings.TrimPrefix(strings.TrimPrefix(host, "https://"), "http://"), "/")
	if !strings.Contains(host, ".") {
		host = host + ".exotel.com"
	}
	return "https://" + host + "/v1/Accounts/" + c.ExotelAccountSID + "/Calls/connect"
}

// bridgePSTN places the masked PSTN call: the provider rings firstPhone, then secondPhone, and both
// talk through VirtualNumber. It returns the provider call id (stored as calls.provider_call_ref) so
// the status webhook can reconcile answer/end. A provider failure is returned, never swallowed — the
// caller falls back to the handoff mode (or fails the call) rather than claiming a bridge.
func (c CallConfig) bridgePSTN(ctx context.Context, callID, firstPhone, secondPhone string) (string, error) {
	if !c.CanBridgePSTN() {
		return "", errors.New("delivery: pstn bridge is not configured")
	}
	form := url.Values{}
	form.Set("From", firstPhone)
	form.Set("To", secondPhone)
	form.Set("CallerId", c.VirtualNumber)
	form.Set("CallType", "trans")
	form.Set("TimeLimit", strconv.Itoa(c.pstnTimeLimit()))
	form.Set("TimeOut", strconv.Itoa(c.pstnTimeOut()))
	form.Set("CustomField", callID)
	// JSON content type keeps the webhook parseable without multipart handling.
	form.Set("StatusCallbackContentType", "application/json")
	if c.PSTNWebhookURL != "" {
		form.Set("StatusCallback", c.webhookURL())
		form.Set("StatusCallbackEvents", "answered,terminal")
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.exotelEndpoint(), strings.NewReader(form.Encode()))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	req.SetBasicAuth(c.ExotelAPIKey, c.ExotelAPIToken)
	client := &http.Client{Timeout: 8 * time.Second}
	res, err := client.Do(req)
	if err != nil {
		return "", err
	}
	defer res.Body.Close()
	raw, _ := io.ReadAll(io.LimitReader(res.Body, 1<<16))
	if res.StatusCode < 200 || res.StatusCode >= 300 {
		return "", fmt.Errorf("delivery: pstn provider connect failed (%d)", res.StatusCode)
	}
	var payload struct {
		Call struct {
			Sid string `json:"Sid"`
		} `json:"Call"`
	}
	if err := json.Unmarshal(raw, &payload); err != nil || payload.Call.Sid == "" {
		return "", errors.New("delivery: pstn provider returned no call id")
	}
	return payload.Call.Sid, nil
}

// webhookURL is the absolute provider callback URL including the shared token.
func (c CallConfig) webhookURL() string {
	base := strings.TrimSpace(c.PSTNWebhookURL)
	if base == "" {
		return ""
	}
	if c.PSTNWebhookToken == "" {
		return base
	}
	sep := "?"
	if strings.Contains(base, "?") {
		sep = "&"
	}
	return base + sep + "token=" + url.QueryEscape(c.PSTNWebhookToken)
}

// verifyWebhookToken compares the shared webhook token in constant time. It fails closed: with no
// token configured nothing can prove the caller is the provider, so every request is rejected (the
// route is not even mounted unless CanReconcilePSTN is true).
func (c CallConfig) verifyWebhookToken(got string) bool {
	if strings.TrimSpace(c.PSTNWebhookToken) == "" {
		return false
	}
	return subtle.ConstantTimeCompare([]byte(got), []byte(c.PSTNWebhookToken)) == 1
}

// fallbackSeconds is the server-driven ringing-ack timeout.
func (c CallConfig) fallbackSeconds() int {
	if c.RingingAckSeconds < 1 {
		return 3
	}
	return c.RingingAckSeconds
}

func (c CallConfig) role() string {
	if c.HMSRole == "" {
		return "guest"
	}
	return c.HMSRole
}

func (c CallConfig) endpoint() string {
	if c.HMSEndpoint != "" {
		return strings.TrimRight(c.HMSEndpoint, "/")
	}
	return "https://api.100ms.live"
}

// newVoIPRoom returns the room both peers join. With a management token it creates a fresh room per
// call; otherwise it uses the configured dev room. A provider failure is returned to the caller so
// the handler can fall back to PSTN instead of handing out a broken token.
func (c CallConfig) newVoIPRoom(ctx context.Context, callID string) (string, error) {
	if c.HMSTemplateID == "" {
		if c.HMSRoomID == "" {
			return "", errors.New("delivery: no 100ms room source configured")
		}
		return c.HMSRoomID, nil
	}
	managementToken, err := c.managementToken()
	if err != nil {
		return "", err
	}
	body, _ := json.Marshal(map[string]any{
		"name":        "delivery-call-" + callID,
		"description": "Faazio delivery call",
		"template_id": c.HMSTemplateID,
	})
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.endpoint()+"/v2/rooms", bytes.NewReader(body))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+managementToken)
	client := &http.Client{Timeout: 6 * time.Second}
	res, err := client.Do(req)
	if err != nil {
		return "", err
	}
	defer res.Body.Close()
	raw, _ := io.ReadAll(io.LimitReader(res.Body, 1<<16))
	if res.StatusCode < 200 || res.StatusCode >= 300 {
		return "", fmt.Errorf("delivery: 100ms room create failed (%d)", res.StatusCode)
	}
	var room struct {
		ID string `json:"id"`
	}
	if err := json.Unmarshal(raw, &room); err != nil || room.ID == "" {
		return "", errors.New("delivery: 100ms room create returned no id")
	}
	return room.ID, nil
}

// signVoIPToken mints a 100ms app token (HS256, version 2). The token is short-lived and scoped to
// one room/user; it is never logged.
func (c CallConfig) signVoIPToken(roomID, userID, role string, ttl time.Duration) (string, error) {
	if c.HMSAppAccessKey == "" || c.HMSAppSecret == "" || roomID == "" || userID == "" {
		return "", errors.New("delivery: 100ms token config incomplete")
	}
	return c.signToken(map[string]any{
		"access_key": c.HMSAppAccessKey,
		"room_id":    roomID,
		"user_id":    userID,
		"role":       role,
		"type":       "app",
		"version":    2,
	}, ttl)
}

// managementToken returns the configured override or mints a short-lived management token. The
// create-room call needs it; the app secret never leaves the server.
func (c CallConfig) managementToken() (string, error) {
	if c.HMSManagementToken != "" {
		return c.HMSManagementToken, nil
	}
	if c.HMSAppAccessKey == "" || c.HMSAppSecret == "" {
		return "", errors.New("delivery: 100ms management token config incomplete")
	}
	return c.signToken(map[string]any{
		"access_key": c.HMSAppAccessKey,
		"type":       "management",
		"version":    2,
	}, 10*time.Minute)
}

func (c CallConfig) signToken(claims map[string]any, ttl time.Duration) (string, error) {
	now := time.Now().UTC()
	jti, err := randomHex(16)
	if err != nil {
		return "", err
	}
	claims["iat"] = now.Unix()
	claims["nbf"] = now.Unix()
	claims["exp"] = now.Add(ttl).Unix()
	claims["jti"] = jti
	header, _ := json.Marshal(map[string]string{"alg": "HS256", "typ": "JWT"})
	payload, err := json.Marshal(claims)
	if err != nil {
		return "", err
	}
	enc := base64.RawURLEncoding
	signingInput := enc.EncodeToString(header) + "." + enc.EncodeToString(payload)
	mac := hmac.New(sha256.New, []byte(c.HMSAppSecret))
	_, _ = mac.Write([]byte(signingInput))
	return signingInput + "." + enc.EncodeToString(mac.Sum(nil)), nil
}

func randomHex(n int) (string, error) {
	b := make([]byte, n)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return hex.EncodeToString(b), nil
}
