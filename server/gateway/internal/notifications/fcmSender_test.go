package notifications

import (
	"context"
	"crypto/rand"
	"crypto/rsa"
	"crypto/x509"
	"encoding/json"
	"encoding/pem"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"golang.org/x/oauth2"
)

// staticTokenSource lets tests fix the OAuth2 access token instead of hitting Google.
type staticTokenSource struct{ tok *oauth2.Token }

func (s staticTokenSource) Token() (*oauth2.Token, error) { return s.tok, nil }

// testServiceAccount builds a syntactically valid service-account JSON with a throwaway RSA key so
// the constructor path is exercised without any real credential or network call.
func testServiceAccount(t *testing.T) []byte {
	t.Helper()
	key, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatalf("generate key: %v", err)
	}
	sa, _ := json.Marshal(map[string]string{
		"type":         "service_account",
		"project_id":   "project-1",
		"client_email": "push@project-1.iam.gserviceaccount.com",
		"token_uri":    "https://oauth2.googleapis.com/token",
		"private_key":  string(pem.EncodeToMemory(&pem.Block{Type: "RSA PRIVATE KEY", Bytes: x509.MarshalPKCS1PrivateKey(key)})),
	})
	return sa
}

func TestNewFCMSenderEmptyDisables(t *testing.T) {
	if s, err := NewFCMSender("", nil); s != nil || err != nil {
		t.Fatalf("empty config must disable the sender (nil, nil), got %v, %v", s, err)
	}
	if s, err := NewFCMSender("project-1", nil); s != nil || err != nil {
		t.Fatalf("missing service account must disable the sender, got %v, %v", s, err)
	}
	if s, err := NewFCMSender("", []byte(`{}`)); s != nil || err != nil {
		t.Fatalf("missing project must disable the sender, got %v, %v", s, err)
	}
}

func TestNewFCMSenderMalformedServiceAccount(t *testing.T) {
	s, err := NewFCMSender("project-1", []byte(`not json`))
	if err == nil {
		t.Fatal("malformed service account must error so the caller can log and disable pushes")
	}
	if s != nil {
		t.Fatal("malformed service account must not produce a sender")
	}
}

func TestNewFCMSenderValidServiceAccount(t *testing.T) {
	s, err := NewFCMSender("project-1", testServiceAccount(t))
	if err != nil {
		t.Fatalf("valid service account must build: %v", err)
	}
	if s == nil {
		t.Fatal("valid service account must produce a non-nil Sender")
	}
}

func TestFCMSenderPostsToFCM(t *testing.T) {
	var got map[string]any
	var gotAuth string
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotAuth = r.Header.Get("Authorization")
		_ = json.NewDecoder(r.Body).Decode(&got)
		w.WriteHeader(http.StatusOK)
	}))
	defer srv.Close()

	s := &FCMSender{
		projectID:  "project-1",
		endpoint:   srv.URL,
		httpClient: srv.Client(),
		tokenSrc:   staticTokenSource{tok: &oauth2.Token{AccessToken: "t0k3n"}},
	}
	err := s.Send(context.Background(), "device-token", "Rx ready", "Your quote is ready",
		[]byte(`{"prescriptionId":"rx-1","count":3,"ok":true}`))
	if err != nil {
		t.Fatalf("Send: %v", err)
	}
	if gotAuth != "Bearer t0k3n" {
		t.Fatalf("unexpected auth header %q", gotAuth)
	}
	msg, ok := got["message"].(map[string]any)
	if !ok {
		t.Fatalf("missing message: %v", got)
	}
	if msg["token"] != "device-token" {
		t.Fatalf("unexpected token %v", msg["token"])
	}
	notif, ok := msg["notification"].(map[string]any)
	if !ok || notif["title"] != "Rx ready" || notif["body"] != "Your quote is ready" {
		t.Fatalf("unexpected notification %v", notif)
	}
	data, ok := msg["data"].(map[string]any)
	if !ok || data["prescriptionId"] != "rx-1" || data["count"] != "3" || data["ok"] != "true" {
		t.Fatalf("data must be string-only for FCM: %v", data)
	}
}

func TestFCMSenderOmitsEmptyNotification(t *testing.T) {
	var got map[string]any
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_ = json.NewDecoder(r.Body).Decode(&got)
		w.WriteHeader(http.StatusOK)
	}))
	defer srv.Close()

	s := &FCMSender{projectID: "project-1", endpoint: srv.URL, httpClient: srv.Client(),
		tokenSrc: staticTokenSource{tok: &oauth2.Token{AccessToken: "t"}}}
	if err := s.Send(context.Background(), "device-token", "", "", nil); err != nil {
		t.Fatalf("Send: %v", err)
	}
	msg, _ := got["message"].(map[string]any)
	if _, has := msg["notification"]; has {
		t.Fatalf("empty title/body must not send a notification block: %v", msg)
	}
}

func TestFCMSenderRejectsNon2xx(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusUnauthorized)
		_, _ = w.Write([]byte(`{"error":{"message":"bad credential"}}`))
	}))
	defer srv.Close()

	s := &FCMSender{projectID: "project-1", endpoint: srv.URL, httpClient: srv.Client(),
		tokenSrc: staticTokenSource{tok: &oauth2.Token{AccessToken: "t"}}}
	if err := s.Send(context.Background(), "t", "a", "b", nil); err == nil {
		t.Fatal("non-2xx must be an error so the row becomes FAILED")
	}
}

// Regression: FCM UNREGISTERED must surface as ErrTokenUnregistered so the drain worker expires the
// row and prunes the token instead of burning six retries on a dead device.
func TestFCMSenderUnregisteredIsTerminal(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusNotFound)
		_, _ = w.Write([]byte(`{"error":{"code":404,"message":"Requested entity was not found.","status":"NOT_FOUND","details":[{"@type":"type.googleapis.com/google.firebase.fcm.v1.FcmError","errorCode":"UNREGISTERED"}]}}`))
	}))
	defer srv.Close()

	s := &FCMSender{projectID: "project-1", endpoint: srv.URL, httpClient: srv.Client(),
		tokenSrc: staticTokenSource{tok: &oauth2.Token{AccessToken: "t"}}}
	err := s.Send(context.Background(), "t", "a", "b", nil)
	if !errors.Is(err, ErrTokenUnregistered) {
		t.Fatalf("UNREGISTERED must produce ErrTokenUnregistered, got %v", err)
	}
}

func TestFCMErrorCode(t *testing.T) {
	unregistered := []byte(`{"error":{"code":404,"message":"not found.","status":"NOT_FOUND","details":[{"@type":"type.googleapis.com/google.firebase.fcm.v1.FcmError","errorCode":"UNREGISTERED"}]}}`)
	if got := fcmErrorCode(unregistered); got != "UNREGISTERED" {
		t.Fatalf("expected UNREGISTERED from details[].errorCode, got %q", got)
	}
	legacy := []byte(`{"error":{"status":"UNREGISTERED"}}`)
	if got := fcmErrorCode(legacy); got != "UNREGISTERED" {
		t.Fatalf("expected UNREGISTERED from legacy error.status, got %q", got)
	}
	if got := fcmErrorCode([]byte(`not json`)); got != "" {
		t.Fatalf("malformed body must yield an empty code, got %q", got)
	}
	if got := fcmErrorCode(nil); got != "" {
		t.Fatalf("nil body must yield an empty code, got %q", got)
	}
}

// Regression: an empty FCM config yields a nil Sender interface, so the worker stays disabled and
// an admin drain returns 503 instead of marking rows FAILED.
func TestWorkerDisabledWithEmptyFCM(t *testing.T) {
	s, err := NewFCMSender("", nil)
	if err != nil || s != nil {
		t.Fatalf("empty FCM config must be a nil sender, got %v, %v", s, err)
	}
	if router := NewMultiSender(s, nil); router != nil {
		t.Fatalf("no transport must build a nil router, got %v", router)
	}
	w := NewWorker(nil, NewMultiSender(s, nil), nil)
	if w.Enabled() {
		t.Fatal("a nil router must leave the worker disabled")
	}
	if err := w.DrainOnce(context.Background()); err != ErrNoSender {
		t.Fatalf("DrainOnce without a sender must return ErrNoSender, got %v", err)
	}
}

func TestFCMStringData(t *testing.T) {
	got := fcmStringData([]byte(`{"s":"x","n":42,"b":true,"f":1.5,"nil":null,"obj":{"k":"v"}}`))
	if got["s"] != "x" || got["n"] != "42" || got["b"] != "true" || got["f"] != "1.5" || got["nil"] != "" || got["obj"] != `{"k":"v"}` {
		t.Fatalf("unexpected flattening: %v", got)
	}
	if fcmStringData(nil) != nil {
		t.Fatal("empty data must stay nil")
	}
	if fcmStringData([]byte("not json")) != nil {
		t.Fatal("malformed data must be dropped silently")
	}
}

// Regression: an incoming-call push MUST be data-only and high priority. FCM only runs the app's
// Android background handler for a data-only message; a `notification` block would deliver it to
// the tray and a killed/swiped app would never ring — the whole point of the call push.
func TestFCMSenderCallPushIsDataOnlyHighPriority(t *testing.T) {
	var got map[string]any
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_ = json.NewDecoder(r.Body).Decode(&got)
		w.WriteHeader(http.StatusOK)
	}))
	defer srv.Close()

	s := &FCMSender{projectID: "project-1", endpoint: srv.URL, httpClient: srv.Client(),
		tokenSrc: staticTokenSource{tok: &oauth2.Token{AccessToken: "t"}}}
	payload, _ := json.Marshal(map[string]string{
		"type":     "incoming_call",
		"callId":   "call-1",
		"orderId":  "o1",
		"peerRole": "CUSTOMER",
	})
	if err := s.Send(context.Background(), "device-token", "Incoming call", "Tap to answer", payload); err != nil {
		t.Fatalf("Send: %v", err)
	}
	msg, _ := got["message"].(map[string]any)
	if _, has := msg["notification"]; has {
		t.Fatalf("a call push must be data-only so the background handler runs: %v", msg)
	}
	android, ok := msg["android"].(map[string]any)
	if !ok || android["priority"] != "high" || android["ttl"] != callPushTTL {
		t.Fatalf("call push needs android priority=high + ttl: %v", msg["android"])
	}
	apns, ok := msg["apns"].(map[string]any)
	if !ok {
		t.Fatalf("call push needs an apns block: %v", msg)
	}
	headers, _ := apns["headers"].(map[string]any)
	if headers["apns-priority"] != "5" || headers["apns-push-type"] != "background" {
		t.Fatalf("apns headers must be a legal background push: %v", headers)
	}
	data, _ := msg["data"].(map[string]any)
	if data["type"] != "incoming_call" || data["callId"] != "call-1" {
		t.Fatalf("call identity must survive the string flattening: %v", data)
	}
}

// Every non-call push keeps its visible notification block.
func TestFCMSenderNonCallPushKeepsNotification(t *testing.T) {
	var got map[string]any
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_ = json.NewDecoder(r.Body).Decode(&got)
		w.WriteHeader(http.StatusOK)
	}))
	defer srv.Close()

	s := &FCMSender{projectID: "project-1", endpoint: srv.URL, httpClient: srv.Client(),
		tokenSrc: staticTokenSource{tok: &oauth2.Token{AccessToken: "t"}}}
	payload, _ := json.Marshal(map[string]string{"type": "order_offer", "orderId": "o1"})
	if err := s.Send(context.Background(), "t", "New order", "Tap to view", payload); err != nil {
		t.Fatalf("Send: %v", err)
	}
	msg, _ := got["message"].(map[string]any)
	if _, has := msg["notification"]; !has {
		t.Fatal("a non-call push must keep its notification block")
	}
	if _, has := msg["android"]; has {
		t.Fatalf("a non-call push must not be forced to high priority: %v", msg["android"])
	}
}
