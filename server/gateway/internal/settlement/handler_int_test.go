package settlement

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/faazio/server/gateway/internal/contracts"
	"github.com/faazio/server/gateway/internal/platform/auth"
	"github.com/faazio/server/gateway/internal/platform/cache"
	"github.com/faazio/server/gateway/internal/platform/razorpayroute"
	"github.com/faazio/server/gateway/internal/platform/testenv"
	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// routeStub is a deterministic razorpayroute.Gateway for HTTP-level tests: no network, ids are
// stable, release/reverse can be forced to fail, and the webhook signature is a fixed HMAC secret.
type routeStub struct {
	releaseErr    error
	reverseErr    error
	webhookSecret string
	releases      int
	reverses      int
}

func (s *routeStub) Enabled() bool                                 { return true }
func (s *routeStub) CreateLinkedAccount(context.Context, razorpayroute.LinkedAccountInput) (string, error) {
	return "acc_stub", nil
}
func (s *routeStub) CreateTransfer(context.Context, razorpayroute.TransferInput) (string, error) {
	return "trf_stub_" + strings.Repeat("a", 8), nil
}
func (s *routeStub) ReleaseTransfer(context.Context, string) error { s.releases++; return s.releaseErr }
func (s *routeStub) ReverseTransfer(context.Context, string) error { s.reverses++; return s.reverseErr }
func (s *routeStub) VerifyWebhook(body []byte, signature string) bool {
	if s.webhookSecret == "" {
		return false
	}
	mac := hmac.New(sha256.New, []byte(s.webhookSecret))
	mac.Write(body)
	return hmac.Equal([]byte(hex.EncodeToString(mac.Sum(nil))), []byte(signature))
}

// profileStub is a fixed SellerProfileReader so a test can decide per-test the fee + Route account.
type profileStub struct {
	pct     int
	account string
}

func (p profileStub) SettlementProfile(context.Context, string) (contracts.SellerSettlementProfile, error) {
	return contracts.SellerSettlementProfile{PlatformFeePct: p.pct, LinkedAccountID: p.account}, nil
}

func settlementRouter(t *testing.T, pool *pgxpool.Pool, route razorpayroute.Gateway, fees contracts.SellerProfileReader) http.Handler {
	t.Helper()
	c, err := cache.Connect(context.Background(), "")
	if err != nil {
		t.Fatal(err)
	}
	r := chi.NewRouter()
	r.Use(auth.Middleware(auth.Config{Disabled: true, DevUserID: "admin-1"}))
	NewHandler(New(pool), c, nil, route, fees).Register(r)
	return r
}

func seedSettlingSeller(t *testing.T, pool *pgxpool.Pool, sellerID, account string) {
	t.Helper()
	ctx := context.Background()
	if _, err := pool.Exec(ctx, `
		insert into sellers.sellers
		  (seller_id, business_name, owner_name, category, state_code, platform_fee_pct, razorpay_linked_account_id)
		values ($1,'Settle Handler','O','MART','KA',10,$2)
		on conflict (seller_id) do update set razorpay_linked_account_id=excluded.razorpay_linked_account_id`,
		sellerID, account); err != nil {
		t.Fatalf("seed seller: %v", err)
	}
	t.Cleanup(func() {
		_, _ = pool.Exec(ctx, `delete from payments.settlement_ledger where seller_id=$1`, sellerID)
		_, _ = pool.Exec(ctx, `delete from payments.payouts where seller_id=$1`, sellerID)
		_, _ = pool.Exec(ctx, `delete from sellers.sellers where seller_id=$1`, sellerID)
	})
}

func holdBody(sellerID string) map[string]any {
	return map[string]any{
		"sellerId": sellerID, "cycle": "2026-04", "paymentId": "pay_test",
		"grossAmount": 1000, "releaseAfter": time.Now().UTC().Add(96 * time.Hour).Format(time.RFC3339),
	}
}

func TestCreateHoldHandler(t *testing.T) {
	pool := testenv.Pool(t)
	sellerID := "sel-holdh-" + shortID()
	seedSettlingSeller(t, pool, sellerID, "acc_linked")
	h := settlementRouter(t, pool, &routeStub{webhookSecret: "wsec"}, profileStub{pct: 10, account: "acc_linked"})

	// A seller cannot create a hold (RequireRole SUPER_ADMIN).
	noRole := doReq(h, http.MethodPost, "/payouts/holds", holdBody(sellerID),
		map[string]string{"X-Dev-Role": "SELLER", "X-Dev-Seller": "sel-other"})
	if noRole.Code != http.StatusUnauthorized {
		t.Fatalf("seller hold status = %d, want 401", noRole.Code)
	}

	created := doReq(h, http.MethodPost, "/payouts/holds", holdBody(sellerID),
		map[string]string{"X-Dev-Role": "SUPER_ADMIN"})
	if created.Code != http.StatusCreated {
		t.Fatalf("create hold status = %d body=%s", created.Code, created.Body.String())
	}
	var resp holdResponse
	if err := json.Unmarshal(created.Body.Bytes(), &resp); err != nil {
		t.Fatal(err)
	}
	if resp.Gross != 1000 || resp.Commission != 100 || resp.Net != 900 {
		t.Fatalf("split wrong: gross=%d commission=%d net=%d", resp.Gross, resp.Commission, resp.Net)
	}
	if resp.Payout.Status != "ON_HOLD" || resp.Payout.RazorpayTransferID == "" {
		t.Fatalf("payout not held: %+v", resp.Payout)
	}

	// A seller without a linked account gets 409 kyc_incomplete. The profile reader returns an empty
	// account for them, so the handler must stop before creating any transfer.
	noAccount := "sel-holdh-" + shortID() + "b"
	seedSettlingSeller(t, pool, noAccount, "")
	hNo := settlementRouter(t, pool, &routeStub{webhookSecret: "wsec"}, profileStub{pct: 10, account: ""})
	conflict := doReq(hNo, http.MethodPost, "/payouts/holds", holdBody(noAccount),
		map[string]string{"X-Dev-Role": "SUPER_ADMIN"})
	if conflict.Code != http.StatusConflict {
		t.Fatalf("no linked account status = %d body=%s, want 409", conflict.Code, conflict.Body.String())
	}

	// Invalid body is 400 (no money-side effect).
	bad := doReq(h, http.MethodPost, "/payouts/holds", map[string]any{"sellerId": sellerID},
		map[string]string{"X-Dev-Role": "SUPER_ADMIN"})
	if bad.Code != http.StatusBadRequest {
		t.Fatalf("bad body status = %d, want 400", bad.Code)
	}
}

func TestReleaseHoldHandler(t *testing.T) {
	pool := testenv.Pool(t)
	sellerID := "sel-relh-" + shortID()
	seedSettlingSeller(t, pool, sellerID, "acc_linked")
	stub := &routeStub{webhookSecret: "wsec"}
	h := settlementRouter(t, pool, stub, profileStub{pct: 10, account: "acc_linked"})

	held, err := New(pool).CreateHoldPayout(context.Background(), Payout{
		SellerID: sellerID, Cycle: "2026-04", Amount: 900,
		ReleaseAfter: time.Now().UTC().Add(-time.Hour).Format(time.RFC3339),
		RazorpayTransferID: "trf_rel",
	})
	if err != nil {
		t.Fatalf("CreateHoldPayout: %v", err)
	}

	// SUPER_ADMIN release transitions ON_HOLD → PAID.
	released := doReq(h, http.MethodPost, "/payouts/"+held.PayoutID+"/release", nil,
		map[string]string{"X-Dev-Role": "SUPER_ADMIN"})
	if released.Code != http.StatusOK {
		t.Fatalf("release status = %d body=%s", released.Code, released.Body.String())
	}
	var got Payout
	if err := json.Unmarshal(released.Body.Bytes(), &got); err != nil {
		t.Fatal(err)
	}
	if got.Status != "PAID" || got.ReleasedAt == "" || stub.releases != 1 {
		t.Fatalf("release wrong: %+v releases=%d", got, stub.releases)
	}

	// Releasing again is a 409 (only ON_HOLD payouts release).
	again := doReq(h, http.MethodPost, "/payouts/"+held.PayoutID+"/release", nil,
		map[string]string{"X-Dev-Role": "SUPER_ADMIN"})
	if again.Code != http.StatusConflict {
		t.Fatalf("repeat release status = %d, want 409", again.Code)
	}

	// Unknown payout is 404.
	missing := doReq(h, http.MethodPost, "/payouts/pyt-missing/release", nil,
		map[string]string{"X-Dev-Role": "SUPER_ADMIN"})
	if missing.Code != http.StatusNotFound {
		t.Fatalf("missing payout status = %d, want 404", missing.Code)
	}
}

func TestReverseHoldHandler(t *testing.T) {
	pool := testenv.Pool(t)
	sellerID := "sel-revh-" + shortID()
	seedSettlingSeller(t, pool, sellerID, "acc_linked")
	ctx := context.Background()

	held, err := New(pool).CreateHoldPayout(ctx, Payout{
		SellerID: sellerID, Cycle: "2026-04", Amount: 900,
		ReleaseAfter: time.Now().UTC().Add(-time.Hour).Format(time.RFC3339),
		RazorpayTransferID: "trf_rev",
	})
	if err != nil {
		t.Fatalf("CreateHoldPayout: %v", err)
	}

	// Successful reverse: Route reverse called once, row REVERSED.
	stub := &routeStub{webhookSecret: "wsec"}
	h := settlementRouter(t, pool, stub, profileStub{pct: 10, account: "acc_linked"})
	reversed := doReq(h, http.MethodPost, "/payouts/"+held.PayoutID+"/reverse", nil,
		map[string]string{"X-Dev-Role": "SUPER_ADMIN"})
	if reversed.Code != http.StatusOK {
		t.Fatalf("reverse status = %d body=%s", reversed.Code, reversed.Body.String())
	}
	var got Payout
	if err := json.Unmarshal(reversed.Body.Bytes(), &got); err != nil {
		t.Fatal(err)
	}
	if got.Status != "REVERSED" || got.ReversedAt == "" || stub.reverses != 1 {
		t.Fatalf("reverse wrong: %+v reverses=%d", got, stub.reverses)
	}

	// A failing Route reverse surfaces as 502, not a silent flip.
	held2, err := New(pool).CreateHoldPayout(ctx, Payout{
		SellerID: sellerID, Cycle: "2026-04", Amount: 900,
		ReleaseAfter: time.Now().UTC().Add(-time.Hour).Format(time.RFC3339),
		RazorpayTransferID: "trf_rev_fail",
	})
	if err != nil {
		t.Fatalf("CreateHoldPayout: %v", err)
	}
	failStub := &routeStub{reverseErr: errors.New("route down")}
	h2 := settlementRouter(t, pool, failStub, profileStub{pct: 10, account: "acc_linked"})
	failed := doReq(h2, http.MethodPost, "/payouts/"+held2.PayoutID+"/reverse", nil,
		map[string]string{"X-Dev-Role": "SUPER_ADMIN"})
	if failed.Code != http.StatusBadGateway {
		t.Fatalf("failed reverse status = %d, want 502", failed.Code)
	}
}

func TestRouteWebhookHandler(t *testing.T) {
	pool := testenv.Pool(t)
	sellerID := "sel-wbh-" + shortID()
	seedSettlingSeller(t, pool, sellerID, "acc_linked")
	repo := New(pool)
	ctx := context.Background()

	webhook := func(repo *Repo, transferID, event string) *httptest.ResponseRecorder {
		stub := &routeStub{webhookSecret: "wsec"}
		body, _ := json.Marshal(map[string]any{
			"event": event,
			"payload": map[string]any{
				"transfer": map[string]any{"entity": map[string]any{"id": transferID, "status": "released"}},
			},
		})
		mac := hmac.New(sha256.New, []byte("wsec"))
		mac.Write(body)
		sig := hex.EncodeToString(mac.Sum(nil))
		return doReq(settlementRouter(t, pool, stub, profileStub{pct: 10, account: "acc_linked"}),
			http.MethodPost, "/webhooks/razorpay/route", body, map[string]string{"X-Razorpay-Signature": sig})
	}

	// Invalid HMAC is never processed (400).
	held, err := repo.CreateHoldPayout(ctx, Payout{SellerID: sellerID, Cycle: "2026-04", Amount: 900,
		ReleaseAfter: time.Now().UTC().Format(time.RFC3339), RazorpayTransferID: "trf_wb_bad"})
	if err != nil {
		t.Fatalf("CreateHoldPayout: %v", err)
	}
	stub := &routeStub{webhookSecret: "wsec"}
	inval := doReq(settlementRouter(t, pool, stub, profileStub{pct: 10, account: "acc_linked"}),
		http.MethodPost, "/webhooks/razorpay/route", []byte(`{"event":"transfer.released"}`),
		map[string]string{"X-Razorpay-Signature": "nope"})
	if inval.Code != http.StatusBadRequest {
		t.Fatalf("invalid signature status = %d, want 400", inval.Code)
	}

	// transfer.released reconciles ON_HOLD → PAID.
	held2, err := repo.CreateHoldPayout(ctx, Payout{SellerID: sellerID, Cycle: "2026-04", Amount: 900,
		ReleaseAfter: time.Now().UTC().Format(time.RFC3339), RazorpayTransferID: "trf_wb_rel"})
	if err != nil {
		t.Fatalf("CreateHoldPayout: %v", err)
	}
	if rec := webhook(repo, "trf_wb_rel", "transfer.released"); rec.Code != http.StatusOK {
		t.Fatalf("released webhook status = %d body=%s", rec.Code, rec.Body.String())
	}
	p, ok, _ := repo.PayoutByID(ctx, held2.PayoutID)
	if !ok || p.Status != "PAID" {
		t.Fatalf("webhook did not reconcile payout: %+v", p)
	}

	// transfer.reversed claws back a held transfer.
	held3, err := repo.CreateHoldPayout(ctx, Payout{SellerID: sellerID, Cycle: "2026-04", Amount: 900,
		ReleaseAfter: time.Now().UTC().Format(time.RFC3339), RazorpayTransferID: "trf_wb_rev"})
	if err != nil {
		t.Fatalf("CreateHoldPayout: %v", err)
	}
	if rec := webhook(repo, "trf_wb_rev", "transfer.reversed"); rec.Code != http.StatusOK {
		t.Fatalf("reversed webhook status = %d body=%s", rec.Code, rec.Body.String())
	}
	p, ok, _ = repo.PayoutByID(ctx, held3.PayoutID)
	if !ok || p.Status != "REVERSED" {
		t.Fatalf("webhook did not reverse payout: %+v", p)
	}

	// An unknown event is acknowledged without touching money state.
	if rec := webhook(repo, "trf_wb_x", "payment.captured"); rec.Code != http.StatusOK {
		t.Fatalf("unknown event status = %d", rec.Code)
	}

	// Sanity: the first hold is still untouched.
	p, ok, _ = repo.PayoutByID(ctx, held.PayoutID)
	if !ok || p.Status != "ON_HOLD" {
		t.Fatalf("unrelated payout changed: %+v", p)
	}
}

func doReq(h http.Handler, method, path string, body any, headers map[string]string) *httptest.ResponseRecorder {
	var reader *strings.Reader
	switch b := body.(type) {
	case nil:
		reader = strings.NewReader("")
	case []byte:
		reader = strings.NewReader(string(b))
	case string:
		reader = strings.NewReader(b)
	default:
		raw, _ := json.Marshal(b)
		reader = strings.NewReader(string(raw))
	}
	req := httptest.NewRequest(method, path, reader)
	for k, v := range headers {
		req.Header.Set(k, v)
	}
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	return rec
}