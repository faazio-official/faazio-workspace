package notifications

import (
	"os"
	"testing"
)

// TestNewAPNSenderLiveCredentials builds the VoIP sender against the real APNS_KEY_ID /
// APNS_TEAM_ID / APNS_PRIVATE_KEY_PEM environment (server/gateway/.env, gitignored, or the Render
// dashboard). It skips when the credentials are unset so CI and a fresh clone still pass; it is the
// one-liner to confirm a (re)downloaded .p8 still parses before a deploy. Never prints the key.
func TestNewAPNSenderLiveCredentials(t *testing.T) {
	keyID := os.Getenv("APNS_KEY_ID")
	teamID := os.Getenv("APNS_TEAM_ID")
	pem := os.Getenv("APNS_PRIVATE_KEY_PEM")
	if keyID == "" || teamID == "" || pem == "" {
		t.Skip("APNS_KEY_ID / APNS_TEAM_ID / APNS_PRIVATE_KEY_PEM not set — skipping live-key parse check")
	}
	s, err := NewAPNSender(keyID, teamID, []byte(pem), os.Getenv("APNS_TOPIC"), os.Getenv("APNS_ENVIRONMENT"))
	if err != nil {
		t.Fatalf("live APNs key must parse: %v", err)
	}
	if s == nil {
		t.Fatal("live APNs credentials must produce a non-nil Sender")
	}
}
