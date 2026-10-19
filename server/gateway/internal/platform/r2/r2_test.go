package r2

import (
	"context"
	"encoding/hex"
	"errors"
	"strings"
	"testing"
	"time"
)

// TestDeriveSigningKeyAWSDocVector validates the SigV4 HMAC chain against the AWS documentation
// example (secret/date/region/service → signing key), so the signing math is not self-referential.
func TestDeriveSigningKeyAWSDocVector(t *testing.T) {
	key := deriveSigningKey("wJalrXUtnFEMI/K7MDENG+bPxRfiCYEXAMPLEKEY", "20150830", "us-east-1", "iam")
	got := hex.EncodeToString(key)
	want := "c4afb1cc5771d871763a393e44b703571b55cc28424d1a5e86da6ed3c154a4b9"
	if got != want {
		t.Fatalf("signing key = %s, want %s", got, want)
	}
}

func testSigner() *Signer {
	s := New(Config{
		AccountID:     "acct123",
		AccessKeyID:   "AKIAEXAMPLE",
		SecretKey:     "secret",
		PublicBucket:  "faazio-public",
		PrivateBucket: "faazio-private",
		CDNBase:       "https://img.faazio.in/",
	})
	s.now = func() time.Time { return time.Date(2026, 1, 2, 3, 4, 5, 0, time.UTC) }
	return s
}

func TestNewDisabledWithoutCredentials(t *testing.T) {
	if New(Config{AccountID: "a"}) != nil {
		t.Fatal("expected nil signer when secret is unset")
	}
	var nilSigner *Signer
	if nilSigner.Enabled() {
		t.Fatal("nil signer must be disabled")
	}
	if _, err := nilSigner.PresignGet(context.Background(), "b", "k", time.Minute); !errors.Is(err, ErrDisabled) {
		t.Fatalf("nil presign err = %v, want ErrDisabled", err)
	}
}

func TestPublicURL(t *testing.T) {
	s := testSigner()
	if got := s.PublicURL("/media/ab/abcd.jpg"); got != "https://img.faazio.in/media/ab/abcd.jpg" {
		t.Fatalf("PublicURL = %q", got)
	}
	if got := s.PublicURL(""); got != "" {
		t.Fatalf("empty key PublicURL = %q, want empty", got)
	}
	if got := s.MediaBase(); got != "https://img.faazio.in" {
		t.Fatalf("MediaBase = %q", got)
	}
	if got := s.PublicOrigin(); got != "https://img.faazio.in" {
		t.Fatalf("PublicOrigin = %q", got)
	}
}

// TestPublicURLGatewayBase covers the no-CDN path: with only PublicBase set, public objects resolve to
// the gateway's own /assets route (presigned redirect) instead of a custom domain.
func TestPublicURLGatewayBase(t *testing.T) {
	s := New(Config{
		AccountID:   "acct123",
		AccessKeyID: "AKIAEXAMPLE",
		SecretKey:   "secret",
		PublicBase:  "https://gateway.faazio.com/",
	})
	if got := s.PublicURL("media/ab/abcd.jpg"); got != "https://gateway.faazio.com/assets/media/ab/abcd.jpg" {
		t.Fatalf("PublicURL = %q", got)
	}
	if got := s.MediaBase(); got != "https://gateway.faazio.com/assets" {
		t.Fatalf("MediaBase = %q", got)
	}
	if got := s.PublicOrigin(); got != "https://gateway.faazio.com" {
		t.Fatalf("PublicOrigin = %q", got)
	}
}

// TestPublicURLDisabledWithoutOrigin covers media-enabled credentials with no public origin configured:
// keys still sign, but public URLs are empty (callers fall back to the legacy image_url / fixtures).
func TestPublicURLDisabledWithoutOrigin(t *testing.T) {
	s := New(Config{AccountID: "acct123", AccessKeyID: "AKIAEXAMPLE", SecretKey: "secret"})
	if got := s.PublicURL("media/ab/abcd.jpg"); got != "" {
		t.Fatalf("PublicURL = %q, want empty", got)
	}
	if got := s.MediaBase(); got != "" {
		t.Fatalf("MediaBase = %q, want empty", got)
	}
	if got := s.PublicOrigin(); got != "" {
		t.Fatalf("PublicOrigin = %q, want empty", got)
	}
	var nilSigner *Signer
	if nilSigner.MediaBase() != "" || nilSigner.PublicOrigin() != "" {
		t.Fatal("nil signer must return empty media base/origin")
	}
}

func TestPresignPutShapeAndDeterminism(t *testing.T) {
	s := testSigner()
	got, err := s.PresignPut(context.Background(), "faazio-public", "media/ab/abcd.jpg", time.Minute)
	if err != nil {
		t.Fatalf("PresignPut: %v", err)
	}
	for _, want := range []string{
		"https://acct123.r2.cloudflarestorage.com/faazio-public/media/ab/abcd.jpg?",
		"X-Amz-Algorithm=AWS4-HMAC-SHA256",
		"X-Amz-Credential=AKIAEXAMPLE%2F20260102%2Fauto%2Fs3%2Faws4_request",
		"X-Amz-Date=20260102T030405Z",
		"X-Amz-Expires=60",
		"X-Amz-SignedHeaders=host",
		"&X-Amz-Signature=",
	} {
		if !strings.Contains(got, want) {
			t.Fatalf("presigned URL missing %q:\n%s", want, got)
		}
	}
	again, _ := s.PresignPut(context.Background(), "faazio-public", "media/ab/abcd.jpg", time.Minute)
	if got != again {
		t.Fatalf("presign not deterministic for fixed clock:\n%s\n%s", got, again)
	}
}

func TestPresignExpiryCap(t *testing.T) {
	s := testSigner()
	got, _ := s.PresignGet(context.Background(), "faazio-private", "rx/1.jpg", time.Hour)
	if !strings.Contains(got, "X-Amz-Expires=300") {
		t.Fatalf("expected expiry capped at 300:\n%s", got)
	}
	if Expiry(0) != 300 || Expiry(-time.Second) != 300 || Expiry(45*time.Second) != 45 {
		t.Fatalf("Expiry caps wrong: %d %d %d", Expiry(0), Expiry(-time.Second), Expiry(45*time.Second))
	}
}

func TestURIEncode(t *testing.T) {
	if got := uriEncode("a b/c~-_.", true); got != "a%20b%2Fc~-_." {
		t.Fatalf("uriEncode encodeSlash = %q", got)
	}
	if got := uriEncode("a/b", false); got != "a/b" {
		t.Fatalf("uriEncode keepSlash = %q", got)
	}
}

func TestPresignDeleteShape(t *testing.T) {
	s := testSigner()
	got, err := s.PresignDelete(context.Background(), "faazio-public", "media/ab/abcd.jpg", time.Minute)
	if err != nil {
		t.Fatalf("PresignDelete: %v", err)
	}
	for _, want := range []string{
		"https://acct123.r2.cloudflarestorage.com/faazio-public/media/ab/abcd.jpg?",
		"X-Amz-Credential=AKIAEXAMPLE%2F20260102%2Fauto%2Fs3%2Faws4_request",
		"&X-Amz-Signature=",
	} {
		if !strings.Contains(got, want) {
			t.Fatalf("presigned DELETE missing %q:\n%s", want, got)
		}
	}
}

func TestDeleteObjectDisabledSigner(t *testing.T) {
	var nilSigner *Signer
	if err := nilSigner.DeleteObject(context.Background(), "b", "k"); !errors.Is(err, ErrDisabled) {
		t.Fatalf("nil DeleteObject err = %v, want ErrDisabled", err)
	}
}
