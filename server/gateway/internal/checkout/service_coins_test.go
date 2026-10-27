package checkout

import (
	"context"
	"errors"
	"testing"
)

// fakeRewards implements both contracts.RewardsWriter and contracts.RewardsReader.
type fakeRewards struct {
	coins int64
	err   error
}

func (f fakeRewards) Earn(context.Context, string, string, int64, int64) error { return nil }

func (f fakeRewards) Coins(context.Context, string) (int64, error) { return f.coins, f.err }

func TestValidateCoins(t *testing.T) {
	service := NewService(nil, nil, nil, fakeRewards{coins: 500}, nil, nil, nil, nil, nil, nil)

	cases := []struct {
		name    string
		coins   int64
		wantErr error
	}{
		{"zero is always allowed", 0, nil},
		{"negative is ignored", -10, nil},
		{"exact balance", 500, nil},
		{"over balance is rejected", 501, ErrInsufficientCoins},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			err := service.ValidateCoins(context.Background(), "user-1", tc.coins)
			if !errors.Is(err, tc.wantErr) {
				t.Fatalf("ValidateCoins(%d) = %v, want %v", tc.coins, err, tc.wantErr)
			}
		})
	}
}

func TestValidateCoinsPropagatesReaderError(t *testing.T) {
	boom := errors.New("rewards unavailable")
	service := NewService(nil, nil, nil, fakeRewards{err: boom}, nil, nil, nil, nil, nil, nil)
	if err := service.ValidateCoins(context.Background(), "user-1", 1); !errors.Is(err, boom) {
		t.Fatalf("ValidateCoins error = %v, want %v", err, boom)
	}
}

// Without a wired rewards reader (unit contexts) validation is skipped rather than blocking orders.
func TestValidateCoinsWithoutReader(t *testing.T) {
	service := NewService(nil, nil, nil, nil, nil, nil, nil, nil, nil, nil)
	if err := service.ValidateCoins(context.Background(), "user-1", 999); err != nil {
		t.Fatalf("ValidateCoins without reader = %v, want nil", err)
	}
}
