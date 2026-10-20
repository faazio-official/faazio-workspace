package portal

import (
	"strings"
	"testing"
)

func TestHasherRoundTrip(t *testing.T) {
	h := NewHasher("test-pepper")
	encoded, err := h.Hash("correct horse battery staple")
	if err != nil {
		t.Fatalf("hash: %v", err)
	}
	if !strings.HasPrefix(encoded, "$argon2id$v=19$m=65536,t=3,p=1$") {
		t.Fatalf("unexpected PHC: %s", encoded)
	}
	if !h.Verify("correct horse battery staple", encoded) {
		t.Fatal("correct password did not verify")
	}
	if h.Verify("wrong password", encoded) {
		t.Fatal("wrong password verified")
	}
	if NewHasher("other-pepper").Verify("correct horse battery staple", encoded) {
		t.Fatal("a different pepper verified the hash")
	}
}

func TestHasherUniqueSalt(t *testing.T) {
	h := NewHasher("")
	a, err := h.Hash("same-password")
	if err != nil {
		t.Fatal(err)
	}
	b, err := h.Hash("same-password")
	if err != nil {
		t.Fatal(err)
	}
	if a == b {
		t.Fatal("two hashes of the same password must differ (random salt)")
	}
}

func TestVerifyMalformed(t *testing.T) {
	h := NewHasher("")
	for _, bad := range []string{"", "not-a-hash", "$argon2id$v=19$m=65536,t=3,p=1$bad$bad"} {
		if h.Verify("x", bad) {
			t.Fatalf("malformed hash verified: %q", bad)
		}
	}
	h.VerifyDummy("anything")
}

func TestWeakPassword(t *testing.T) {
	cases := []struct {
		newPassword string
		old         string
		want        bool
	}{
		{"qwertyuiop", "", true},             // blocklisted common password
		{"password", "old-password", true},   // blocklist
		{"SamePassword12", "SamePassword12", true},
		{"a-perfectly-fine-passphrase", "", false},
	}
	for _, c := range cases {
		if got := weakPassword(c.newPassword, c.old); got != c.want {
			t.Fatalf("weakPassword(%q) = %v, want %v", c.newPassword, got, c.want)
		}
	}
}
