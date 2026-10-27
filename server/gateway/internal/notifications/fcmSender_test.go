package notifications

import (
	"context"
	"crypto/rand"
	"crypto/rsa"
	"crypto/x509"
	"encoding/json"
	"encoding/pem"
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
		t.Fatal("malformed service account must error so the caller can fall back")
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

// Regression: an empty FCM config yields a nil Sender interface (mirroring NewWebhookSender("")),
// so the worker stays disabled and an admin drain returns 503 instead of marking rows FAILED.
func TestWorkerDisabledWithEmptyFCM(t *testing.T) {
	s, err := NewFCMSender("", nil)
	if err != nil || s != nil {
		t.Fatalf("empty FCM config must be a nil sender, got %v, %v", s, err)
	}
	w := NewWorker(nil, s, nil)
	if w.Enabled() {
		t.Fatal("a nil FCM sender must leave the worker disabled")
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
