package media

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/faazio/server/gateway/internal/platform/r2"
)

func TestMintKeyContentAddressed(t *testing.T) {
	hash := strings.Repeat("ab", 32) // 64 hex chars
	got := mintKey("img_x", hash, "jpg")
	want := "media/ab/" + hash + ".jpg"
	if got != want {
		t.Fatalf("mintKey = %q, want %q", got, want)
	}
}

func TestMintKeyDateScoped(t *testing.T) {
	got := mintKey("img_abc", "", "webp")
	if !strings.HasPrefix(got, "media/") || !strings.HasSuffix(got, "img_abc.webp") {
		t.Fatalf("mintKey = %q", got)
	}
}

func TestIsSHA256Hex(t *testing.T) {
	valid := strings.Repeat("0f", 32)
	if !isSHA256Hex(valid) {
		t.Fatal("expected valid sha256 hex")
	}
	for _, bad := range []string{"", "abc", strings.Repeat("Z", 64), strings.Repeat("a", 63)} {
		if isSHA256Hex(bad) {
			t.Fatalf("expected invalid: %q", bad)
		}
	}
}

func TestParseIDs(t *testing.T) {
	got := parseIDs(" a , b ,a,, c ", 10)
	want := []string{"a", "b", "c"}
	if len(got) != len(want) {
		t.Fatalf("parseIDs = %v", got)
	}
	for i := range want {
		if got[i] != want[i] {
			t.Fatalf("parseIDs = %v, want %v", got, want)
		}
	}
	capped := parseIDs("a,b,c,d,e", 2)
	if len(capped) != 2 {
		t.Fatalf("cap = %v", capped)
	}
}

func TestUploadURLDisabledSigner(t *testing.T) {
	h := NewHandler(New(nil), nil, nil, nil)
	req := httptest.NewRequest(http.MethodPost, "/media/upload-url", strings.NewReader(`{}`))
	rec := httptest.NewRecorder()
	h.uploadURL(rec, req)
	if rec.Code != http.StatusServiceUnavailable {
		t.Fatalf("disabled signer status = %d, want 503", rec.Code)
	}
}

func TestUploadURLRejectsBadMime(t *testing.T) {
	h := NewHandler(New(nil), enabledSigner(), nil, nil)
	req := httptest.NewRequest(http.MethodPost, "/media/upload-url",
		strings.NewReader(`{"kind":"PUBLIC","mime":"application/pdf","bytes":10}`))
	rec := httptest.NewRecorder()
	h.uploadURL(rec, req)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("bad mime status = %d, want 400", rec.Code)
	}
}

func TestUploadURLRejectsOversize(t *testing.T) {
	h := NewHandler(New(nil), enabledSigner(), nil, nil)
	req := httptest.NewRequest(http.MethodPost, "/media/upload-url",
		strings.NewReader(`{"kind":"PUBLIC","mime":"image/jpeg","bytes":10485760}`))
	rec := httptest.NewRecorder()
	h.uploadURL(rec, req)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("oversize status = %d, want 400", rec.Code)
	}
}

func TestConfirmRejectsBadOwnerType(t *testing.T) {
	h := NewHandler(New(nil), nil, nil, nil)
	req := httptest.NewRequest(http.MethodPost, "/media/confirm",
		strings.NewReader(`{"assetId":"img_x","ownerType":"NOPE"}`))
	rec := httptest.NewRecorder()
	h.confirm(rec, req)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("bad owner type status = %d, want 400", rec.Code)
	}
}

func enabledSigner() *r2.Signer {
	return r2.New(r2.Config{
		AccountID: "acct", AccessKeyID: "key", SecretKey: "secret",
		PublicBucket: "faazio-public", PrivateBucket: "faazio-private",
		CDNBase: "https://img.faazio.in",
	})
}
