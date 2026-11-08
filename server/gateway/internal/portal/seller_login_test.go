package portal

import (
	"context"
	"encoding/hex"
	"testing"
)

func TestProvisionSellerLoginSkipsWithoutValidEmail(t *testing.T) {
	p := NewSellerLoginProvisioner(New(nil), NewHasher("test-pepper"))
	for _, email := range []string{"", "   ", "not-an-email", "a@b"} {
		got, err := p.ProvisionSellerLogin(context.Background(), "sel-1", email, "Shop")
		if err != nil {
			t.Fatalf("email %q: unexpected error: %v", email, err)
		}
		if !got.Skipped || got.Created || got.TemporaryPassword != "" {
			t.Fatalf("email %q: want skipped, got %+v", email, got)
		}
	}
}

func TestTemporaryPasswordIsStrongHex(t *testing.T) {
	pw, err := temporaryPassword()
	if err != nil {
		t.Fatal(err)
	}
	if len(pw) != 36 {
		t.Fatalf("want 36 chars, got %d", len(pw))
	}
	if _, err := hex.DecodeString(pw); err != nil {
		t.Fatalf("not hex: %v", err)
	}
	if weakPassword(pw, "") {
		t.Fatal("generated password must not be weak")
	}
}
