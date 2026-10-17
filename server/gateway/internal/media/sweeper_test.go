package media

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/faazio/server/gateway/internal/contracts"
)

type fakeStore struct {
	drafts    []contracts.MediaAsset
	before    time.Time
	limit     int
	deleted   []string
	deleteErr error
	listErr   error
}

func (f *fakeStore) StaleDrafts(_ context.Context, before time.Time, limit int) ([]contracts.MediaAsset, error) {
	f.before, f.limit = before, limit
	return f.drafts, f.listErr
}

func (f *fakeStore) Delete(_ context.Context, id, _ string, _ bool) (bool, error) {
	if f.deleteErr != nil {
		return false, f.deleteErr
	}
	f.deleted = append(f.deleted, id)
	return true, nil
}

type fakeSigner struct {
	enabled bool
	deleted []string
	err     error
}

func (f *fakeSigner) Enabled() bool { return f.enabled }

func (f *fakeSigner) DeleteObject(_ context.Context, _ string, key string) error {
	if f.err != nil {
		return f.err
	}
	f.deleted = append(f.deleted, key)
	return nil
}

func TestSweeperDisabled(t *testing.T) {
	if NewSweeper(nil, nil, nil).Enabled() {
		t.Fatal("sweeper with nil repo/signer must be disabled")
	}
	if _, err := NewSweeper(nil, nil, nil).SweepOnce(context.Background()); !errors.Is(err, ErrGCUnavailable) {
		t.Fatalf("SweepOnce err = %v, want ErrGCUnavailable", err)
	}
	if _, err := NewSweeper(&fakeStore{}, &fakeSigner{enabled: false}, nil).SweepOnce(context.Background()); !errors.Is(err, ErrGCUnavailable) {
		t.Fatalf("disabled signer err = %v, want ErrGCUnavailable", err)
	}
}

func TestSweeperDeletesObjectsAndRows(t *testing.T) {
	store := &fakeStore{drafts: []contracts.MediaAsset{
		{ID: "img_1", Bucket: "faazio-public", Key: "media/aa/1.jpg"},
		{ID: "img_2", Bucket: "faazio-public", Key: "media/bb/2.jpg"},
	}}
	signer := &fakeSigner{enabled: true}
	s := NewSweeper(store, signer, nil)
	fixed := time.Date(2026, 2, 1, 0, 0, 0, 0, time.UTC)
	s.now = func() time.Time { return fixed }

	n, err := s.SweepOnce(context.Background())
	if err != nil {
		t.Fatalf("SweepOnce: %v", err)
	}
	if n != 2 {
		t.Fatalf("deleted = %d, want 2", n)
	}
	if len(signer.deleted) != 2 || len(store.deleted) != 2 {
		t.Fatalf("signer=%v store=%v", signer.deleted, store.deleted)
	}
	if want := fixed.Add(-DefaultDraftTTL); !store.before.Equal(want) {
		t.Fatalf("cutoff = %s, want %s", store.before, want)
	}
	if store.limit != gcBatch {
		t.Fatalf("limit = %d, want %d", store.limit, gcBatch)
	}
}

func TestSweeperSkipsRowWhenObjectDeleteFails(t *testing.T) {
	store := &fakeStore{drafts: []contracts.MediaAsset{{ID: "img_1", Bucket: "b", Key: "k"}}}
	signer := &fakeSigner{enabled: true, err: errors.New("r2 down")}
	n, err := NewSweeper(store, signer, nil).SweepOnce(context.Background())
	if err != nil {
		t.Fatalf("SweepOnce: %v", err)
	}
	if n != 0 || len(store.deleted) != 0 {
		t.Fatalf("expected no row delete when object delete fails; n=%d rows=%v", n, store.deleted)
	}
}

func TestSweeperListErrorAborts(t *testing.T) {
	store := &fakeStore{listErr: errors.New("db down")}
	if _, err := NewSweeper(store, &fakeSigner{enabled: true}, nil).SweepOnce(context.Background()); err == nil {
		t.Fatal("expected listing error to propagate")
	}
}
