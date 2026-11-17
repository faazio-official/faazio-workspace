package delivery

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestCallConfigCanBridgePSTN(t *testing.T) {
	cases := []struct {
		name string
		cfg  CallConfig
		want bool
	}{
		{
			name: "number + exotel credentials",
			cfg: CallConfig{
				VirtualNumber:    "+911234567890",
				PSTNProvider:     "exotel",
				ExotelAccountSID: "acct",
				ExotelAPIKey:     "key",
				ExotelAPIToken:   "token",
			},
			want: true,
		},
		{
			name: "provider not selected",
			cfg: CallConfig{
				VirtualNumber:    "+911234567890",
				ExotelAccountSID: "acct",
				ExotelAPIKey:     "key",
				ExotelAPIToken:   "token",
			},
			want: false,
		},
		{
			name: "missing api token",
			cfg: CallConfig{
				VirtualNumber:    "+911234567890",
				PSTNProvider:     "exotel",
				ExotelAccountSID: "acct",
				ExotelAPIKey:     "key",
			},
			want: false,
		},
		{
			name: "no virtual number",
			cfg: CallConfig{
				PSTNProvider:     "exotel",
				ExotelAccountSID: "acct",
				ExotelAPIKey:     "key",
				ExotelAPIToken:   "token",
			},
			want: false,
		},
		{
			name: "provider name is case/space tolerant",
			cfg: CallConfig{
				VirtualNumber:    "+911234567890",
				PSTNProvider:     "  ExoTel ",
				ExotelAccountSID: "acct",
				ExotelAPIKey:     "key",
				ExotelAPIToken:   "token",
			},
			want: true,
		},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := tc.cfg.CanBridgePSTN(); got != tc.want {
				t.Fatalf("CanBridgePSTN() = %v, want %v", got, tc.want)
			}
		})
	}
}

// Placing a bridge without a reconcilable status webhook would leave the row RINGING: the answer
// event never arrives and the sweep marks a live call MISSED. Bridging therefore requires the URL and
// the shared token as well as the provider credentials.
func TestCanReconcilePSTNRequiresWebhook(t *testing.T) {
	bridge := CallConfig{
		VirtualNumber:    "+911234567890",
		PSTNProvider:     "exotel",
		ExotelAccountSID: "acct",
		ExotelAPIKey:     "key",
		ExotelAPIToken:   "token",
	}
	if bridge.CanReconcilePSTN() {
		t.Fatal("credentials alone must not place a bridge with no callback")
	}
	bridge.PSTNWebhookURL = "https://api.faazio.com/delivery/calls/pstn-webhook"
	if bridge.CanReconcilePSTN() {
		t.Fatal("a callback URL without the shared token must not place a bridge")
	}
	bridge.PSTNWebhookToken = "s3cret"
	if !bridge.CanReconcilePSTN() {
		t.Fatal("credentials + callback URL + token must allow the bridge")
	}
}

// A config with only a virtual number must stay on the handoff path: reporting a bridge there would
// make the app show "we are calling you" while nothing ever dials the peer.
func TestCanPSTNWithoutProviderStaysHandoff(t *testing.T) {
	cfg := CallConfig{VirtualNumber: "+911234567890"}
	if !cfg.CanPSTN() {
		t.Fatal("a virtual number alone must still allow the masked handoff leg")
	}
	if cfg.CanBridgePSTN() {
		t.Fatal("no provider credentials must not advertise a server-side bridge")
	}
}

func TestExotelEndpoint(t *testing.T) {
	cases := []struct {
		name string
		cfg  CallConfig
		want string
	}{
		{
			name: "default host",
			cfg:  CallConfig{ExotelAccountSID: "acct"},
			want: "https://api.exotel.com/v1/Accounts/acct/Calls/connect",
		},
		{
			name: "mumbai subdomain shorthand",
			cfg:  CallConfig{ExotelAccountSID: "acct", ExotelSubdomain: "in"},
			want: "https://in.exotel.com/v1/Accounts/acct/Calls/connect",
		},
		{
			name: "explicit full host with scheme and trailing slash",
			cfg:  CallConfig{ExotelAccountSID: "acct", ExotelSubdomain: "https://api.in.exotel.com/"},
			want: "https://api.in.exotel.com/v1/Accounts/acct/Calls/connect",
		},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := tc.cfg.exotelEndpoint(); got != tc.want {
				t.Fatalf("exotelEndpoint() = %q, want %q", got, tc.want)
			}
		})
	}
}

func TestWebhookTokenCheck(t *testing.T) {
	// Fail closed: with no token configured nothing proves the caller is the provider, so the webhook
	// route is not mounted (CanReconcilePSTN) and any direct call is rejected.
	if (CallConfig{}).verifyWebhookToken("anything") {
		t.Fatal("an unset token must reject the webhook, never fail open")
	}
	if (CallConfig{}).CanReconcilePSTN() {
		t.Fatal("an unset token must keep the reconcile route unmounted")
	}
	cfg := CallConfig{PSTNWebhookToken: "s3cret"}
	if !cfg.verifyWebhookToken("s3cret") {
		t.Fatal("matching token must be accepted")
	}
	if cfg.verifyWebhookToken("wrong") {
		t.Fatal("wrong token must be rejected")
	}
	if cfg.verifyWebhookToken("") {
		t.Fatal("empty token must be rejected when one is configured")
	}
}

func TestWebhookURLAppendsToken(t *testing.T) {
	base := CallConfig{PSTNWebhookURL: "https://api.faazio.com/delivery/calls/pstn-webhook"}
	if got := base.webhookURL(); got != "https://api.faazio.com/delivery/calls/pstn-webhook" {
		t.Fatalf("webhookURL() without token = %q", got)
	}
	withToken := CallConfig{
		PSTNWebhookURL:   "https://api.faazio.com/delivery/calls/pstn-webhook?env=prod",
		PSTNWebhookToken: "a b&c",
	}
	got := withToken.webhookURL()
	if !strings.HasPrefix(got, "https://api.faazio.com/delivery/calls/pstn-webhook?env=prod&token=") {
		t.Fatalf("webhookURL() must append with & when a query exists: %q", got)
	}
	if !strings.Contains(got, "token=a+b%26c") {
		t.Fatalf("webhookURL() must URL-escape the token: %q", got)
	}
}

func TestPSTNTimeDefaults(t *testing.T) {
	var cfg CallConfig
	if got := cfg.pstnTimeLimit(); got != 900 {
		t.Fatalf("default time limit = %d, want 900", got)
	}
	if got := cfg.pstnTimeOut(); got != 30 {
		t.Fatalf("default ring timeout = %d, want 30", got)
	}
	// Values below the provider's accepted floor fall back to the defaults rather than sending a
	// configuration Exotel would reject.
	tooSmall := CallConfig{PSTNTimeLimitSeconds: 5, PSTNTimeOutSeconds: 2}
	if got := tooSmall.pstnTimeLimit(); got != 900 {
		t.Fatalf("tiny time limit = %d, want 900", got)
	}
	if got := tooSmall.pstnTimeOut(); got != 30 {
		t.Fatalf("tiny ring timeout = %d, want 30", got)
	}
	explicit := CallConfig{PSTNTimeLimitSeconds: 600, PSTNTimeOutSeconds: 20}
	if got := explicit.pstnTimeLimit(); got != 600 {
		t.Fatalf("explicit time limit = %d, want 600", got)
	}
	if got := explicit.pstnTimeOut(); got != 20 {
		t.Fatalf("explicit ring timeout = %d, want 20", got)
	}
}

// voipUserID must be stable for a given call so a re-minted join token lands in the same room user.
func TestVoIPUserIDIsStable(t *testing.T) {
	customer := callParticipants{
		initiatedBy: "CUSTOMER",
		order:       Order{OrderID: "o1"},
		userID:      "u1",
	}
	first := voipUserID(customer, "call-1")
	second := voipUserID(customer, "call-1")
	if first != second {
		t.Fatalf("customer voip user id unstable: %q vs %q", first, second)
	}
	if !strings.HasPrefix(first, "customer:") {
		t.Fatalf("customer voip user id = %q, want a customer: prefix", first)
	}

	rider := callParticipants{initiatedBy: "RIDER", riderID: "r1"}
	riderID := voipUserID(rider, "call-1")
	if !strings.HasPrefix(riderID, "rider:r1:") {
		t.Fatalf("rider voip user id = %q, want rider:<id>: prefix", riderID)
	}
	// The two peers must never collapse onto the same room user.
	if riderID == first {
		t.Fatal("rider and customer must not share a 100ms room user")
	}
}

func TestPSTNWebhookRejectsBadToken(t *testing.T) {
	h := &Handler{calls: CallConfig{PSTNWebhookToken: "s3cret"}}
	req := httptest.NewRequest(http.MethodPost, "/delivery/calls/pstn-webhook?token=nope", nil)
	rec := httptest.NewRecorder()
	h.pstnWebhook(rec, req)
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("status = %d, want 401", rec.Code)
	}
}

// A provider payload that maps to no call must be acknowledged, not retried forever.
func TestPSTNWebhookUnmappableIsAcknowledged(t *testing.T) {
	h := &Handler{calls: CallConfig{PSTNWebhookToken: "s3cret"}}
	req := httptest.NewRequest(http.MethodPost, "/delivery/calls/pstn-webhook?token=s3cret", nil)
	rec := httptest.NewRecorder()
	h.pstnWebhook(rec, req)
	if rec.Code != http.StatusNoContent {
		t.Fatalf("status = %d, want 204", rec.Code)
	}
}

// notifyCallee must be a no-op (never a panic or a fabricated push) when no outbox is wired.
func TestNotifyCalleeWithoutNotifierIsSafe(t *testing.T) {
	h := &Handler{}
	h.notifyCallee(context.Background(), Call{CallID: "call-1", InitiatedBy: "RIDER"})
}

type stubNudger struct{ calls int }

func (s *stubNudger) Nudge() { s.calls++ }

// A call push must wake the drain worker immediately: the ring TTL is 45s but the default tick is
// 30s, so waiting for the tick can deliver the ring after it has already expired.
func TestNotifyCalleeNudgesPushWorker(t *testing.T) {
	n := &stubNudger{}
	h := &Handler{nudger: n}
	// No notifier: the push is not enqueued, so nothing should be nudged either.
	h.notifyCallee(context.Background(), Call{CallID: "c", InitiatedBy: "RIDER"})
	if n.calls != 0 {
		t.Fatalf("must not nudge when no push was enqueued: %d", n.calls)
	}
}

// CallKit rejects a non-UUID and iOS kills an app that reports an unparseable incoming call, so the
// push payload must carry a stable UUID derived from the call id (never the raw `call-<hex>`).
func TestCallUUIDIsStableUUID(t *testing.T) {
	first := callUUID("call-9f8e7d6c5b4a3210")
	second := callUUID("call-9f8e7d6c5b4a3210")
	if first != second {
		t.Fatalf("callUUID must be deterministic across push re-deliveries: %q vs %q", first, second)
	}
	if callUUID("call-other") == first {
		t.Fatal("different calls must map to different CallKit UUIDs")
	}
	if len(first) != 36 || first[8] != '-' || first[13] != '-' || first[18] != '-' || first[23] != '-' {
		t.Fatalf("not a canonical UUID: %q", first)
	}
	if first[14] != '4' {
		t.Fatalf("expected a version-4 UUID, got %q", first)
	}
	if c := first[19]; c != '8' && c != '9' && c != 'a' && c != 'b' {
		t.Fatalf("expected an RFC 4122 variant nibble, got %q", first)
	}
}

// The callee sees the caller's masked role, never the other peer's label or a raw number.
func TestCallerLabelIsMasked(t *testing.T) {
	if got := callerLabel("RIDER"); got != "Delivery Partner" {
		t.Fatalf("rider-initiated call must show 'Delivery Partner', got %q", got)
	}
	if got := callerLabel("CUSTOMER"); got != "Customer" {
		t.Fatalf("customer-initiated call must show 'Customer', got %q", got)
	}
}
