package notifications

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestWebhookSenderEmptyDisables(t *testing.T) {
	if NewWebhookSender("") != nil {
		t.Fatal("empty url must disable the sender (worker not started)")
	}
}

func TestWebhookSenderPostsMessage(t *testing.T) {
	var got map[string]any
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_ = json.NewDecoder(r.Body).Decode(&got)
		w.WriteHeader(http.StatusOK)
	}))
	defer srv.Close()

	s := NewWebhookSender(srv.URL)
	if err := s.Send(context.Background(), "device-token", "Rx ready", "Your quote is ready", []byte(`{"prescriptionId":"rx-1"}`)); err != nil {
		t.Fatalf("Send: %v", err)
	}
	if got["token"] != "device-token" || got["title"] != "Rx ready" || got["body"] != "Your quote is ready" {
		t.Fatalf("unexpected payload: %v", got)
	}
}

func TestWebhookSenderRejectsNon2xx(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
	}))
	defer srv.Close()

	if err := NewWebhookSender(srv.URL).Send(context.Background(), "t", "a", "b", nil); err == nil {
		t.Fatal("non-2xx must be an error so the row becomes FAILED")
	}
}

func TestWorkerDisabledWithoutSender(t *testing.T) {
	w := NewWorker(nil, nil, nil)
	if w.Enabled() {
		t.Fatal("a worker without repo+sender must be disabled")
	}
}