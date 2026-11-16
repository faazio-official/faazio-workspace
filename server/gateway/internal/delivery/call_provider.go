package delivery

import (
	"bytes"
	"context"
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

// WithCalling attaches the server-side calling configuration. An empty config leaves calling
// disabled: initiate returns 503 instead of fabricating a room or number.
func (h *Handler) WithCalling(cfg CallConfig) *Handler {
	h.calls = cfg
	return h
}

// CallConfig is the server-side calling configuration. Secrets are env-only (see
// internal/platform/config) and never projected to a client.
//
// VOIP is enabled only when the 100ms credentials are present plus either a management token +
// template (per-call rooms, production) or an explicit room id (single pre-provisioned room, dev
// only). PSTN_BRIDGING is enabled when a virtual number is configured; the app dials that masked
// number, never the customer's raw phone.
type CallConfig struct {
	// VirtualNumber is the platform's PSTN landline shown to the rider (Edesy/Exotel).
	VirtualNumber string
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

// CanPSTN reports whether the masked virtual number is configured.
func (c CallConfig) CanPSTN() bool { return c.VirtualNumber != "" }

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
