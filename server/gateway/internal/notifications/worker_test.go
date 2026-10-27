package notifications

import (
	"context"
	"testing"
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
