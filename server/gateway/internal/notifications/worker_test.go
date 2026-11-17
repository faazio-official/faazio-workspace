package notifications

import (
	"context"
	"testing"
	"time"
)

func TestWorkerDisabledWithoutSender(t *testing.T) {
	w := NewWorker(nil, nil, nil)
	if w.Enabled() {
		t.Fatal("a worker without repo+sender must be disabled")
	}
}

func TestDrainOnceWithoutSender(t *testing.T) {
	w := NewWorker(nil, nil, nil)
	if err := w.DrainOnce(context.Background()); err != ErrNoSender {
		t.Fatalf("DrainOnce without a sender must return ErrNoSender, got %v", err)
	}
}

func TestNudgeIsNonBlockingAndCoalesces(t *testing.T) {
	w := NewWorker(nil, nil, nil)
	// Many nudges must never block or queue up unboundedly: a burst of calls coalesces to one wake.
	done := make(chan struct{})
	go func() {
		for i := 0; i < 100; i++ {
			w.Nudge()
		}
		close(done)
	}()
	select {
	case <-done:
	case <-time.After(2 * time.Second):
		t.Fatal("Nudge blocked")
	}
	if len(w.nudge) != 1 {
		t.Fatalf("nudge channel holds %d, want 1 (coalesced)", len(w.nudge))
	}
}

// A nil worker is a valid no-op: the delivery handler may be constructed without one.
func TestNudgeNilWorkerIsSafe(t *testing.T) {
	var w *Worker
	w.Nudge()
}
