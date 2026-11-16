package delivery

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"strings"
	"testing"
	"time"
)

func TestCallConfigCanVoIP(t *testing.T) {
	cases := []struct {
		name string
		cfg  CallConfig
		want bool
	}{
		{
			name: "management token + template",
			cfg:  CallConfig{HMSAppAccessKey: "key", HMSAppSecret: "secret", HMSManagementToken: "mgmt", HMSTemplateID: "template"},
			want: true,
		},
		{
			name: "pre-provisioned room",
			cfg:  CallConfig{HMSAppAccessKey: "key", HMSAppSecret: "secret", HMSRoomID: "room"},
			want: true,
		},
		{
			name: "missing secret",
			cfg:  CallConfig{HMSAppAccessKey: "key", HMSRoomID: "room"},
			want: false,
		},
		{
			name: "room source missing",
			cfg:  CallConfig{HMSAppAccessKey: "key", HMSAppSecret: "secret"},
			want: false,
		},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := tc.cfg.CanVoIP(); got != tc.want {
				t.Fatalf("CanVoIP() = %v, want %v", got, tc.want)
			}
		})
	}
}

func TestSignVoIPTokenClaimsAndSignature(t *testing.T) {
	cfg := CallConfig{HMSAppAccessKey: "access", HMSAppSecret: "shh"}
	token, err := cfg.signVoIPToken("room-1", "rider-1", "guest", time.Hour)
	if err != nil {
		t.Fatalf("signVoIPToken: %v", err)
	}
	parts := strings.Split(token, ".")
	if len(parts) != 3 {
		t.Fatalf("token has %d parts, want 3", len(parts))
	}

	mac := hmac.New(sha256.New, []byte(cfg.HMSAppSecret))
	_, _ = mac.Write([]byte(parts[0] + "." + parts[1]))
	wantSig := base64.RawURLEncoding.EncodeToString(mac.Sum(nil))
	if parts[2] != wantSig {
		t.Fatal("token signature does not verify with the app secret")
	}

	raw, err := base64.RawURLEncoding.DecodeString(parts[1])
	if err != nil {
		t.Fatalf("decode payload: %v", err)
	}
	var payload map[string]any
	if err := json.Unmarshal(raw, &payload); err != nil {
		t.Fatalf("unmarshal payload: %v", err)
	}
	if payload["room_id"] != "room-1" || payload["user_id"] != "rider-1" {
		t.Fatalf("unexpected room/user claims: %+v", payload)
	}
	if payload["access_key"] != "access" || payload["role"] != "guest" {
		t.Fatalf("unexpected access/role claims: %+v", payload)
	}
	if payload["type"] != "app" || payload["version"] != float64(2) {
		t.Fatalf("unexpected type/version claims: %+v", payload)
	}
}

func TestManagementTokenMinted(t *testing.T) {
	cfg := CallConfig{HMSAppAccessKey: "access", HMSAppSecret: "shh"}
	token, err := cfg.managementToken()
	if err != nil {
		t.Fatalf("managementToken: %v", err)
	}
	parts := strings.Split(token, ".")
	if len(parts) != 3 {
		t.Fatalf("token has %d parts, want 3", len(parts))
	}
	raw, err := base64.RawURLEncoding.DecodeString(parts[1])
	if err != nil {
		t.Fatalf("decode payload: %v", err)
	}
	var payload map[string]any
	if err := json.Unmarshal(raw, &payload); err != nil {
		t.Fatalf("unmarshal payload: %v", err)
	}
	if payload["type"] != "management" || payload["access_key"] != "access" {
		t.Fatalf("unexpected management claims: %+v", payload)
	}
}

func TestSafeReason(t *testing.T) {
	cases := []struct {
		in   string
		want string
	}{
		{"", "ended"},
		{"  declined  ", "declined"},
		{"busy", "busy"},
		{"line\nbreak", "linebreak"},
	}
	for _, tc := range cases {
		if got := safeReason(tc.in, "ended"); got != tc.want {
			t.Fatalf("safeReason(%q) = %q, want %q", tc.in, got, tc.want)
		}
	}
	long := safeReason(strings.Repeat("a", 200), "ended")
	if len(long) != 80 {
		t.Fatalf("long reason length = %d, want 80", len(long))
	}
}
