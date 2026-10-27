package notifications

import (
	"os"
	"testing"
)

// TestNewFCMSenderLiveCredentials builds the sender against the real FCM_SERVICE_ACCOUNT_JSON /
// FCM_PROJECT_ID environment (server/gateway/.env, gitignored, or the Render dashboard). It skips
// when the secret is unset so CI and a fresh clone still pass; it is the one-liner to confirm a
// (re)generated Firebase service account still parses before a deploy. Never prints the key or the
// access token.
func TestNewFCMSenderLiveCredentials(t *testing.T) {
	sa := os.Getenv("FCM_SERVICE_ACCOUNT_JSON")
	project := os.Getenv("FCM_PROJECT_ID")
	if sa == "" || project == "" {
		t.Skip("FCM_PROJECT_ID / FCM_SERVICE_ACCOUNT_JSON not set — skipping live-key parse check")
	}
	s, err := NewFCMSender(project, []byte(sa))
	if err != nil {
		t.Fatalf("live service account must parse: %v", err)
	}
	if s == nil {
		t.Fatal("live FCM credentials must produce a non-nil Sender")
	}
}
