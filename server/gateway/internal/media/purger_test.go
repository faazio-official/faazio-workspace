package media

import (
	"context"
	"testing"

	"github.com/faazio/server/gateway/internal/platform/db"
)

type fakePurger struct {
	enabled  bool
	urlCalls [][]string
}

func (f *fakePurger) Enabled() bool { return f.enabled }

func (f *fakePurger) PurgeURLs(_ context.Context, urls []string) error {
	f.urlCalls = append(f.urlCalls, urls)
	return nil
}

func TestPurgeWorkerHandlePublicPurgesURL(t *testing.T) {
	p := &fakePurger{enabled: true}
	w := NewPurgeWorker(nil, enabledSigner(), p, nil, nil)
	w.handle(context.Background(), `{"id":"img_1","status":"REJECTED","r2_key":"media/ab/abcd.jpg","kind":"PUBLIC"}`)
	if len(p.urlCalls) != 1 || len(p.urlCalls[0]) != 1 {
		t.Fatalf("expected one purge call, got %v", p.urlCalls)
	}
	if got := p.urlCalls[0][0]; got != "https://img.faazio.in/media/ab/abcd.jpg" {
		t.Fatalf("purged URL = %q", got)
	}
}

func TestPurgeWorkerHandlePrivateSkipped(t *testing.T) {
	p := &fakePurger{enabled: true}
	w := NewPurgeWorker(nil, enabledSigner(), p, nil, nil)
	w.handle(context.Background(), `{"id":"img_2","status":"ACTIVE","r2_key":"rx/1.jpg","kind":"PRIVATE"}`)
	if len(p.urlCalls) != 0 {
		t.Fatalf("PRIVATE asset must not be purged publicly, got %v", p.urlCalls)
	}
}

func TestPurgeWorkerHandleDraftSkipsPurge(t *testing.T) {
	p := &fakePurger{enabled: true}
	w := NewPurgeWorker(nil, enabledSigner(), p, nil, nil)
	w.handle(context.Background(), `{"id":"img_3","status":"DRAFT","r2_key":"media/ab/draft.jpg","kind":"PUBLIC"}`)
	if len(p.urlCalls) != 0 {
		t.Fatalf("DRAFT asset was never cached — must not trigger a purge, got %v", p.urlCalls)
	}
}

func TestPurgeWorkerHandleBadJSON(t *testing.T) {
	w := NewPurgeWorker(nil, enabledSigner(), &fakePurger{enabled: true}, nil, nil)
	w.handle(context.Background(), "not-json") // must not panic
}

func TestPurgeWorkerDisabled(t *testing.T) {
	if NewPurgeWorker(nil, enabledSigner(), &fakePurger{enabled: true}, nil, nil).Enabled() {
		t.Fatal("worker without a DB pool must be disabled")
	}
	if NewPurgeWorker(nil, enabledSigner(), &fakePurger{enabled: false}, nil, nil).Enabled() {
		t.Fatal("worker with a disabled purger must be disabled")
	}
	if NewPurgeWorker(&db.Pool{}, enabledSigner(), &fakePurger{enabled: true}, nil, nil).Enabled() {
		t.Fatal("worker without a cache must be disabled")
	}
}
