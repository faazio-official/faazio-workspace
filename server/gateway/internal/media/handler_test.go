package media

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/faazio/server/gateway/internal/contracts"
	"github.com/faazio/server/gateway/internal/platform/auth"
	"github.com/faazio/server/gateway/internal/platform/r2"
	"github.com/faazio/server/gateway/internal/platform/testenv"
)

// withSeller injects a seller identity into an in-process request (the media routes are auth-gated).
func withSeller(req *http.Request, actor string) *http.Request {
	return req.WithContext(auth.WithIdentity(req.Context(), auth.Identity{
		UserID: actor, Role: auth.RoleSeller, SellerID: "sel-test",
	}))
}

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
	h := NewHandler(New(nil), nil, nil, nil, nil)
	req := httptest.NewRequest(http.MethodPost, "/media/upload-url", strings.NewReader(`{}`))
	rec := httptest.NewRecorder()
	h.uploadURL(rec, req)
	if rec.Code != http.StatusServiceUnavailable {
		t.Fatalf("disabled signer status = %d, want 503", rec.Code)
	}
}

func TestUploadURLRejectsBadMime(t *testing.T) {
	h := NewHandler(New(nil), enabledSigner(), nil, nil, nil)
	req := httptest.NewRequest(http.MethodPost, "/media/upload-url",
		strings.NewReader(`{"kind":"PUBLIC","mime":"application/pdf","bytes":10}`))
	rec := httptest.NewRecorder()
	h.uploadURL(rec, req)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("bad mime status = %d, want 400", rec.Code)
	}
}

func TestUploadURLRejectsOversize(t *testing.T) {
	h := NewHandler(New(nil), enabledSigner(), nil, nil, nil)
	req := httptest.NewRequest(http.MethodPost, "/media/upload-url",
		strings.NewReader(`{"kind":"PUBLIC","mime":"image/jpeg","bytes":10485760}`))
	rec := httptest.NewRecorder()
	h.uploadURL(rec, req)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("oversize status = %d, want 400", rec.Code)
	}
}

func TestConfirmRejectsBadOwnerType(t *testing.T) {
	h := NewHandler(New(nil), nil, nil, nil, nil)
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

type fakeSweeper struct {
	n   int
	err error
}

func (f fakeSweeper) SweepOnce(context.Context) (int, error) { return f.n, f.err }

func TestGCUnconfiguredWithoutSweeper(t *testing.T) {
	h := NewHandler(New(nil), nil, nil, nil, nil)
	rec := httptest.NewRecorder()
	h.gc(rec, httptest.NewRequest(http.MethodPost, "/media/gc", nil))
	if rec.Code != http.StatusServiceUnavailable {
		t.Fatalf("gc status = %d, want 503", rec.Code)
	}
}

func TestGCRunsSweep(t *testing.T) {
	h := NewHandler(New(nil), nil, nil, nil, fakeSweeper{n: 3})
	rec := httptest.NewRecorder()
	h.gc(rec, httptest.NewRequest(http.MethodPost, "/media/gc", nil))
	if rec.Code != http.StatusOK {
		t.Fatalf("gc status = %d, want 200", rec.Code)
	}
	if !strings.Contains(rec.Body.String(), `"deleted":3`) {
		t.Fatalf("gc body = %s", rec.Body.String())
	}
}

func TestGCMapsUnavailableTo503(t *testing.T) {
	h := NewHandler(New(nil), nil, nil, nil, fakeSweeper{err: ErrGCUnavailable})
	rec := httptest.NewRecorder()
	h.gc(rec, httptest.NewRequest(http.MethodPost, "/media/gc", nil))
	if rec.Code != http.StatusServiceUnavailable {
		t.Fatalf("gc status = %d, want 503", rec.Code)
	}
}

// TestUploadURLHappyPath mints a DRAFT asset + presigned PUT against a real DB. The signer is the
// local SigV4 presigner (no R2 network call); only media.assets is touched.
func TestUploadURLHappyPath(t *testing.T) {
	pool := testenv.Pool(t)
	c := testenv.Cache(t)
	h := NewHandler(New(pool), enabledSigner(), c, nil, nil)

	req := withSeller(httptest.NewRequest(http.MethodPost, "/media/upload-url",
		strings.NewReader(`{"kind":"PUBLIC","ownerType":"PRODUCT","mime":"image/jpeg","bytes":2048}`)), "actor-1")
	rec := httptest.NewRecorder()
	h.uploadURL(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200; body=%s", rec.Code, rec.Body.String())
	}
	var resp struct {
		AssetID   string `json:"assetId"`
		Key       string `json:"key"`
		UploadURL string `json:"uploadUrl"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatalf("decode: %v (%s)", err, rec.Body.String())
	}
	if !strings.HasPrefix(resp.AssetID, "img_") || resp.Key == "" {
		t.Fatalf("unexpected response: %+v", resp)
	}
	if !strings.Contains(resp.UploadURL, "X-Amz-Signature") {
		t.Fatalf("uploadUrl not presigned: %s", resp.UploadURL)
	}
	t.Cleanup(func() {
		_, _ = pool.Exec(context.Background(), `delete from media.assets where id=$1`, resp.AssetID)
	})

	var status, kind, createdBy string
	if err := pool.QueryRow(context.Background(),
		`select status::text, kind::text, coalesce(created_by,'') from media.assets where id=$1`, resp.AssetID).
		Scan(&status, &kind, &createdBy); err != nil {
		t.Fatalf("asset row missing: %v", err)
	}
	if status != "DRAFT" || kind != "PUBLIC" || createdBy != "actor-1" {
		t.Fatalf("asset row = status %q kind %q createdBy %q", status, kind, createdBy)
	}
}

func TestConfirmHappyPath(t *testing.T) {
	pool := testenv.Pool(t)
	c := testenv.Cache(t)
	repo := New(pool)
	ctx := context.Background()

	asset, err := repo.Create(ctx, contracts.MediaAsset{
		ID: mintID(), Kind: "PUBLIC", Bucket: "faazio-public",
		Key: "media/ct/" + mintID() + ".jpg", Mime: "image/jpeg", Bytes: 10, CreatedBy: "actor-1",
	})
	if err != nil {
		t.Fatalf("seed asset: %v", err)
	}
	t.Cleanup(func() { _, _ = pool.Exec(context.Background(), `delete from media.assets where id=$1`, asset.ID) })

	h := NewHandler(repo, enabledSigner(), c, nil, nil)
	req := withSeller(httptest.NewRequest(http.MethodPost, "/media/confirm",
		strings.NewReader(`{"assetId":"`+asset.ID+`","ownerType":"PRODUCT","ownerId":"store-1"}`)), "actor-1")
	rec := httptest.NewRecorder()
	h.confirm(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200; body=%s", rec.Code, rec.Body.String())
	}
	var got contracts.MediaAsset
	if err := json.Unmarshal(rec.Body.Bytes(), &got); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if got.Status != "ACTIVE" || got.OwnerType != "PRODUCT" || got.OwnerID != "store-1" {
		t.Fatalf("confirm projection = %+v", got)
	}

	var status, ownerID string
	if err := pool.QueryRow(context.Background(),
		`select status::text, coalesce(owner_id,'') from media.assets where id=$1`, asset.ID).
		Scan(&status, &ownerID); err != nil {
		t.Fatalf("read asset: %v", err)
	}
	if status != "ACTIVE" || ownerID != "store-1" {
		t.Fatalf("persisted = status %q ownerID %q", status, ownerID)
	}
}

func TestConfirmRejectsUnknownAsset(t *testing.T) {
	pool := testenv.Pool(t)
	h := NewHandler(New(pool), enabledSigner(), testenv.Cache(t), nil, nil)
	req := withSeller(httptest.NewRequest(http.MethodPost, "/media/confirm",
		strings.NewReader(`{"assetId":"img_does_not_exist","ownerType":"PRODUCT"}`)), "actor-1")
	rec := httptest.NewRecorder()
	h.confirm(rec, req)
	if rec.Code != http.StatusNotFound {
		t.Fatalf("status = %d, want 404; body=%s", rec.Code, rec.Body.String())
	}
}
