package settlement

import "testing"

func TestRouteEvent(t *testing.T) {
	body := []byte(`{"event":"transfer.released","payload":{"transfer":{"entity":{"id":"trf_123","status":"released"}}}}`)
	event, transferID := routeEvent(body)
	if event != "transfer.released" || transferID != "trf_123" {
		t.Fatalf("routeEvent = %q %q", event, transferID)
	}

	if event, transferID := routeEvent([]byte(`not json`)); event != "" || transferID != "" {
		t.Fatalf("invalid body must map to empty, got %q %q", event, transferID)
	}
	if event, transferID := routeEvent([]byte(`{"event":"payment.captured"}`)); event != "payment.captured" || transferID != "" {
		t.Fatalf("missing transfer entity must map to empty id, got %q %q", event, transferID)
	}
}
