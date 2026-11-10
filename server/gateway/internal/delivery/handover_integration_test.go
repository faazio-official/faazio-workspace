package delivery

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/faazio/server/gateway/internal/platform/authtest"
	"github.com/faazio/server/gateway/internal/platform/cache"
	"github.com/faazio/server/gateway/internal/platform/testenv"
	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// ---------------------------------------------------------------------------
// Workflows 2–6 — rider offer accept/reject, seller-QR pickup scan, the
// AT_PICKUP→PICKED_UP scan gate, COD payment-received gate, and the customer
// OTP delivery. These drive the real delivery HTTP handler + repo against a
// real Postgres (testenv.Pool skips when unconfigured). The handler is built
// in-package so tests can mint signed pickup tokens and OTP hashes with the
// same unexported helpers production uses.
// ---------------------------------------------------------------------------

func newDeliveryRouter(t *testing.T) (http.Handler, *pgxpool.Pool, *cache.Cache, *Handler) {
	t.Helper()
	pool := testenv.Pool(t)
	c := testenv.Cache(t)
	repo := New(pool)
	h := NewHandler(repo, c, nil, nil, nil, nil, 5).WithHandoverSecret("it-handover-secret")
	r := chi.NewRouter()
	r.Use(authtest.Middleware())
	h.Register(r)
	return r, pool, c, h
}

type deliverySeed struct {
	status          string
	riderAvailable  bool
	riderLoad       int
	paymentRequired bool
	paymentReceived bool
	otp             string
	otpExpired      bool
	pickupStatus    string
	pickupVerified  bool
	dropStatus      string
}

type riderFixture struct {
	riderID, phone, orderID, pickupStopID, dropStopID string
}

func seedDelivery(t *testing.T, pool *pgxpool.Pool, s deliverySeed) riderFixture {
	t.Helper()
	ctx := context.Background()
	if s.status == "" {
		s.status = OrderAssigned
	}
	if s.pickupStatus == "" {
		s.pickupStatus = StopPending
	}
	if s.dropStatus == "" {
		s.dropStatus = StopPending
	}
	sfx := fmt.Sprintf("%d", time.Now().UnixNano())
	f := riderFixture{
		riderID:      "rider-it-" + sfx,
		phone:        "+9190000" + sfx[len(sfx)-5:],
		orderID:      "dlv-it-" + sfx,
		pickupStopID: "stop-p-" + sfx,
		dropStopID:   "stop-d-" + sfx,
	}
	if _, err := pool.Exec(ctx, `
		insert into delivery.delivery_boys
		  (rider_id, user_id, phone, full_name, state_code, hub_zone, city, pincode,
		   vehicle_type, max_capacity, status, is_available, current_load)
		values ($1,'user-1',$2,'IT Rider','KA','HUB','Bengaluru','560001','TWO_WHEELER',2,$3,$4,$5)`,
		f.riderID, f.phone, StatusActive, s.riderAvailable, s.riderLoad); err != nil {
		t.Fatalf("seed rider: %v", err)
	}
	if _, err := pool.Exec(ctx, `
		insert into delivery.delivery_orders
		  (order_id, customer_order_id, store_id, rider_id, status, route_sequence,
		   payment_method, payment_required, payment_received)
		values ($1,$2,'store-it',$3,$4::delivery_order_status,'[]'::jsonb,'COD',$5,$6)`,
		f.orderID, "co-"+sfx, f.riderID, s.status, s.paymentRequired, s.paymentReceived); err != nil {
		pool.Exec(ctx, `delete from delivery.delivery_boys where rider_id=$1`, f.riderID)
		t.Fatalf("seed delivery order: %v", err)
	}
	var pickupVerifiedAt any
	if s.pickupVerified {
		pickupVerifiedAt = time.Now()
	}
	if _, err := pool.Exec(ctx, `
		insert into delivery.delivery_stops
		  (stop_id, delivery_order_id, sequence, stop_type, status, label, address, pickup_verified_at)
		values ($1,$2,1,'PICKUP',$3::delivery_stop_status,'Store','1 Store St',$4)`,
		f.pickupStopID, f.orderID, s.pickupStatus, pickupVerifiedAt); err != nil {
		t.Fatalf("seed pickup stop: %v", err)
	}
	var otpHash any
	var otpExpires any
	if s.otp != "" {
		otpHash = hashOTP(s.otp, f.dropStopID)
		if s.otpExpired {
			otpExpires = time.Now().Add(-time.Minute)
		} else {
			otpExpires = time.Now().Add(10 * time.Minute)
		}
	}
	if _, err := pool.Exec(ctx, `
		insert into delivery.delivery_stops
		  (stop_id, delivery_order_id, sequence, stop_type, status, label, address,
		   customer_otp_hash, otp_expires_at)
		values ($1,$2,2,'DROP',$3::delivery_stop_status,'Customer','2 Drop Rd',$4,$5)`,
		f.dropStopID, f.orderID, s.dropStatus, otpHash, otpExpires); err != nil {
		t.Fatalf("seed drop stop: %v", err)
	}
	t.Cleanup(func() {
		_, _ = pool.Exec(ctx, `delete from delivery.delivery_stops where delivery_order_id=$1`, f.orderID)
		_, _ = pool.Exec(ctx, `delete from delivery.delivery_orders where order_id=$1`, f.orderID)
		_, _ = pool.Exec(ctx, `delete from delivery.delivery_boys where rider_id=$1`, f.riderID)
	})
	return f
}

func riderCall(t *testing.T, h http.Handler, method, path, body, phone string) *httptest.ResponseRecorder {
	t.Helper()
	req := httptest.NewRequest(method, path, strings.NewReader(body))
	if body != "" {
		req.Header.Set("Content-Type", "application/json")
	}
	if phone != "" {
		req.Header.Set("X-Dev-Phone", phone)
	}
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	return rec
}

func validPickupToken(h *Handler, stopID string) string {
	return h.signPickupToken(stopID, time.Now().UTC().Add(2*time.Hour).Truncate(time.Second))
}

func orderStatus(t *testing.T, pool *pgxpool.Pool, orderID string) string {
	t.Helper()
	var s string
	if err := pool.QueryRow(context.Background(),
		`select status::text from delivery.delivery_orders where order_id=$1`, orderID).Scan(&s); err != nil {
		t.Fatalf("read order status: %v", err)
	}
	return s
}

// --- Workflow 2: offer accept / reject -------------------------------------

func TestDeliveryAcceptOrder(t *testing.T) {
	h, pool, _, _ := newDeliveryRouter(t)
	f := seedDelivery(t, pool, deliverySeed{status: OrderAssigned, riderAvailable: true})

	rec := riderCall(t, h, http.MethodPost, "/delivery/"+f.orderID+"/accept", "", f.phone)
	if rec.Code != http.StatusOK {
		t.Fatalf("accept status = %d body=%s", rec.Code, rec.Body.String())
	}
	if got := orderStatus(t, pool, f.orderID); got != OrderAccepted {
		t.Fatalf("order status = %q, want ACCEPTED", got)
	}
	var load int
	pool.QueryRow(context.Background(), `select current_load from delivery.delivery_boys where rider_id=$1`, f.riderID).Scan(&load)
	if load != 1 {
		t.Fatalf("rider load = %d, want 1", load)
	}
}

func TestDeliveryAcceptOrderNotAvailable(t *testing.T) {
	h, pool, _, _ := newDeliveryRouter(t)
	f := seedDelivery(t, pool, deliverySeed{status: OrderAssigned, riderAvailable: false})

	rec := riderCall(t, h, http.MethodPost, "/delivery/"+f.orderID+"/accept", "", f.phone)
	if rec.Code != http.StatusConflict || !strings.Contains(rec.Body.String(), "not_available") {
		t.Fatalf("status = %d body=%s, want 409 not_available", rec.Code, rec.Body.String())
	}
}

func TestDeliveryRejectOrder(t *testing.T) {
	h, pool, _, _ := newDeliveryRouter(t)
	f := seedDelivery(t, pool, deliverySeed{status: OrderAssigned, riderAvailable: true})

	rec := riderCall(t, h, http.MethodPost, "/delivery/"+f.orderID+"/reject", "", f.phone)
	if rec.Code != http.StatusOK {
		t.Fatalf("reject status = %d body=%s", rec.Code, rec.Body.String())
	}
	var resp struct {
		Reassigned bool `json:"reassigned"`
		Exhausted  bool `json:"exhausted"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatalf("decode reject: %v (%s)", err, rec.Body.String())
	}
	if got := orderStatus(t, pool, f.orderID); got != OrderRejected {
		t.Fatalf("order status = %q, want REJECTED", got)
	}
}

// --- Workflow 3: seller QR scan --------------------------------------------

func TestDeliveryVerifyPickupValid(t *testing.T) {
	h, pool, _, hh := newDeliveryRouter(t)
	f := seedDelivery(t, pool, deliverySeed{status: OrderAccepted, pickupStatus: StopAtPickup})

	rec := riderCall(t, h, http.MethodPost, "/delivery/pickup/verify",
		fmt.Sprintf(`{"stopId":%q,"token":%q}`, f.pickupStopID, validPickupToken(hh, f.pickupStopID)), f.phone)
	if rec.Code != http.StatusOK {
		t.Fatalf("verify status = %d body=%s", rec.Code, rec.Body.String())
	}
	var stopStatus string
	var verified bool
	pool.QueryRow(context.Background(), `
		select status::text, pickup_verified_at is not null
		  from delivery.delivery_stops where stop_id=$1`, f.pickupStopID).Scan(&stopStatus, &verified)
	if stopStatus != StopPickedUp || !verified {
		t.Fatalf("pickup = (%s, verified=%v), want (PICKED_UP, true)", stopStatus, verified)
	}
}

func TestDeliveryVerifyPickupRejectsBadTokens(t *testing.T) {
	h, pool, _, hh := newDeliveryRouter(t)
	f := seedDelivery(t, pool, deliverySeed{status: OrderAccepted, pickupStatus: StopAtPickup})

	// Forged: correct subject, bogus signature.
	forged := fmt.Sprintf("%s.9999999999.xxxxxxxx", f.pickupStopID)
	rec := riderCall(t, h, http.MethodPost, "/delivery/pickup/verify",
		fmt.Sprintf(`{"stopId":%q,"token":%q}`, f.pickupStopID, forged), f.phone)
	if rec.Code != http.StatusUnauthorized || !strings.Contains(rec.Body.String(), "invalid_pickup_qr") {
		t.Fatalf("forged: status = %d body=%s, want 401 invalid_pickup_qr", rec.Code, rec.Body.String())
	}

	// Wrong stop: a token signed for a different subject.
	rec = riderCall(t, h, http.MethodPost, "/delivery/pickup/verify",
		fmt.Sprintf(`{"stopId":%q,"token":%q}`, f.pickupStopID, validPickupToken(hh, "stop-other")), f.phone)
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("wrong stop: status = %d, want 401", rec.Code)
	}

	// Expired: correctly signed but past its window.
	expired := hh.signPickupToken(f.pickupStopID, time.Now().UTC().Add(-time.Minute).Truncate(time.Second))
	rec = riderCall(t, h, http.MethodPost, "/delivery/pickup/verify",
		fmt.Sprintf(`{"stopId":%q,"token":%q}`, f.pickupStopID, expired), f.phone)
	if rec.Code != http.StatusConflict || !strings.Contains(rec.Body.String(), "pickup_qr_expired") {
		t.Fatalf("expired: status = %d body=%s, want 409 pickup_qr_expired", rec.Code, rec.Body.String())
	}

	// Valid token but the stop has not arrived yet (still PENDING).
	f2 := seedDelivery(t, pool, deliverySeed{status: OrderAccepted, pickupStatus: StopPending})
	rec = riderCall(t, h, http.MethodPost, "/delivery/pickup/verify",
		fmt.Sprintf(`{"stopId":%q,"token":%q}`, f2.pickupStopID, validPickupToken(hh, f2.pickupStopID)), f2.phone)
	if rec.Code != http.StatusConflict {
		t.Fatalf("before arrival: status = %d body=%s, want 409", rec.Code, rec.Body.String())
	}
}

// --- Workflow 4: plain status may not complete a pickup without a scan -----

func TestDeliveryPlainStatusRefusesPickedUpWithoutScan(t *testing.T) {
	h, pool, _, _ := newDeliveryRouter(t)
	f := seedDelivery(t, pool, deliverySeed{status: OrderAccepted, pickupStatus: StopAtPickup})

	rec := riderCall(t, h, http.MethodPut, "/delivery/stop/"+f.pickupStopID+"/status", `{"status":"PICKED_UP"}`, f.phone)
	if rec.Code != http.StatusConflict || !strings.Contains(rec.Body.String(), "pickup_scan_required") {
		t.Fatalf("status = %d body=%s, want 409 pickup_scan_required", rec.Code, rec.Body.String())
	}
}

func TestDeliveryPickupAdvancesAtPickupThenPickedUp(t *testing.T) {
	h, pool, _, hh := newDeliveryRouter(t)
	f := seedDelivery(t, pool, deliverySeed{status: OrderAccepted, pickupStatus: StopPending})

	rec := riderCall(t, h, http.MethodPut, "/delivery/stop/"+f.pickupStopID+"/status", `{"status":"AT_PICKUP"}`, f.phone)
	if rec.Code != http.StatusOK {
		t.Fatalf("arrive status = %d body=%s", rec.Code, rec.Body.String())
	}
	rec = riderCall(t, h, http.MethodPost, "/delivery/pickup/verify",
		fmt.Sprintf(`{"stopId":%q,"token":%q}`, f.pickupStopID, validPickupToken(hh, f.pickupStopID)), f.phone)
	if rec.Code != http.StatusOK {
		t.Fatalf("verify status = %d body=%s", rec.Code, rec.Body.String())
	}
	var s string
	pool.QueryRow(context.Background(), `select status::text from delivery.delivery_stops where stop_id=$1`, f.pickupStopID).Scan(&s)
	if s != StopPickedUp {
		t.Fatalf("pickup status = %q, want PICKED_UP", s)
	}
}

// --- Workflow 5: COD payment received --------------------------------------

func TestDeliveryMarkPaymentReceived(t *testing.T) {
	h, pool, _, _ := newDeliveryRouter(t)
	f := seedDelivery(t, pool, deliverySeed{status: OrderAccepted, paymentRequired: true})

	rec := riderCall(t, h, http.MethodPost,
		"/delivery/"+f.orderID+"/stop/"+f.dropStopID+"/payment-received", "", f.phone)
	if rec.Code != http.StatusOK {
		t.Fatalf("payment-received status = %d body=%s", rec.Code, rec.Body.String())
	}
	var received bool
	pool.QueryRow(context.Background(), `select payment_received from delivery.delivery_orders where order_id=$1`, f.orderID).Scan(&received)
	if !received {
		t.Fatal("payment_received = false, want true")
	}

	// Payment is collected at the DROP stop; a pickup stop must be refused.
	rec = riderCall(t, h, http.MethodPost,
		"/delivery/"+f.orderID+"/stop/"+f.pickupStopID+"/payment-received", "", f.phone)
	if rec.Code != http.StatusConflict {
		t.Fatalf("payment on pickup: status = %d, want 409", rec.Code)
	}
}

func TestDeliveryDeliveredGateAndRouteComplete(t *testing.T) {
	h, pool, _, _ := newDeliveryRouter(t)
	f := seedDelivery(t, pool, deliverySeed{
		status: OrderAccepted, riderLoad: 1, paymentRequired: true, paymentReceived: false,
		pickupStatus: StopPickedUp, pickupVerified: true, dropStatus: StopAtCustomer,
	})

	// DELIVERED before "Payment received" is refused.
	rec := riderCall(t, h, http.MethodPut, "/delivery/stop/"+f.dropStopID+"/status", `{"status":"DELIVERED"}`, f.phone)
	if rec.Code != http.StatusConflict || !strings.Contains(rec.Body.String(), "payment_not_received") {
		t.Fatalf("unpaid delivery: status = %d body=%s, want 409 payment_not_received", rec.Code, rec.Body.String())
	}

	// Confirm payment, then deliver → route completes and capacity frees.
	rec = riderCall(t, h, http.MethodPost, "/delivery/"+f.orderID+"/stop/"+f.dropStopID+"/payment-received", "", f.phone)
	if rec.Code != http.StatusOK {
		t.Fatalf("payment-received status = %d body=%s", rec.Code, rec.Body.String())
	}
	rec = riderCall(t, h, http.MethodPut, "/delivery/stop/"+f.dropStopID+"/status", `{"status":"DELIVERED"}`, f.phone)
	if rec.Code != http.StatusOK {
		t.Fatalf("delivered status = %d body=%s", rec.Code, rec.Body.String())
	}
	if got := orderStatus(t, pool, f.orderID); got != OrderRouteComplete {
		t.Fatalf("order status = %q, want ROUTE_COMPLETE", got)
	}
	var load, completed int
	pool.QueryRow(context.Background(), `select current_load, completed_orders from delivery.delivery_boys where rider_id=$1`, f.riderID).Scan(&load, &completed)
	if load != 0 || completed != 1 {
		t.Fatalf("rider = (load=%d, completed=%d), want (0,1)", load, completed)
	}
}

// --- Workflow 6: customer OTP delivery -------------------------------------

func TestDeliveryOtpVerifySuccess(t *testing.T) {
	h, pool, _, _ := newDeliveryRouter(t)
	f := seedDelivery(t, pool, deliverySeed{
		status: OrderAccepted, otp: "1234",
		pickupStatus: StopPickedUp, pickupVerified: true, dropStatus: StopAtCustomer,
	})

	rec := riderCall(t, h, http.MethodPost, "/delivery/otp/verify",
		fmt.Sprintf(`{"stopId":%q,"otp":"1234"}`, f.dropStopID), f.phone)
	if rec.Code != http.StatusOK {
		t.Fatalf("otp status = %d body=%s", rec.Code, rec.Body.String())
	}
	if got := orderStatus(t, pool, f.orderID); got != OrderRouteComplete {
		t.Fatalf("order status = %q, want ROUTE_COMPLETE", got)
	}
}

func TestDeliveryOtpIncorrectThenCorrect(t *testing.T) {
	h, pool, _, _ := newDeliveryRouter(t)
	f := seedDelivery(t, pool, deliverySeed{
		status: OrderAccepted, otp: "1234",
		pickupStatus: StopPickedUp, pickupVerified: true, dropStatus: StopAtCustomer,
	})

	rec := riderCall(t, h, http.MethodPost, "/delivery/otp/verify",
		fmt.Sprintf(`{"stopId":%q,"otp":"0000"}`, f.dropStopID), f.phone)
	if rec.Code != http.StatusUnauthorized || !strings.Contains(rec.Body.String(), "otp_incorrect") {
		t.Fatalf("wrong otp: status = %d body=%s, want 401 otp_incorrect", rec.Code, rec.Body.String())
	}
	rec = riderCall(t, h, http.MethodPost, "/delivery/otp/verify",
		fmt.Sprintf(`{"stopId":%q,"otp":"1234"}`, f.dropStopID), f.phone)
	if rec.Code != http.StatusOK {
		t.Fatalf("correct otp after one miss: status = %d body=%s", rec.Code, rec.Body.String())
	}
}

func TestDeliveryOtpNotRequired(t *testing.T) {
	h, pool, _, _ := newDeliveryRouter(t)
	f := seedDelivery(t, pool, deliverySeed{
		status: OrderAccepted, pickupStatus: StopPickedUp, pickupVerified: true, dropStatus: StopAtCustomer,
	})

	rec := riderCall(t, h, http.MethodPost, "/delivery/otp/verify",
		fmt.Sprintf(`{"stopId":%q,"otp":"1234"}`, f.dropStopID), f.phone)
	if rec.Code != http.StatusConflict || !strings.Contains(rec.Body.String(), "otp_not_required") {
		t.Fatalf("status = %d body=%s, want 409 otp_not_required", rec.Code, rec.Body.String())
	}
}

func TestDeliveryOtpExpired(t *testing.T) {
	h, pool, _, _ := newDeliveryRouter(t)
	f := seedDelivery(t, pool, deliverySeed{
		status: OrderAccepted, otp: "1234", otpExpired: true,
		pickupStatus: StopPickedUp, pickupVerified: true, dropStatus: StopAtCustomer,
	})

	rec := riderCall(t, h, http.MethodPost, "/delivery/otp/verify",
		fmt.Sprintf(`{"stopId":%q,"otp":"1234"}`, f.dropStopID), f.phone)
	if rec.Code != http.StatusConflict || !strings.Contains(rec.Body.String(), "otp_expired") {
		t.Fatalf("status = %d body=%s, want 409 otp_expired", rec.Code, rec.Body.String())
	}
}

func TestDeliveryOtpLockout(t *testing.T) {
	h, pool, _, _ := newDeliveryRouter(t)
	f := seedDelivery(t, pool, deliverySeed{
		status: OrderAccepted, otp: "1234",
		pickupStatus: StopPickedUp, pickupVerified: true, dropStatus: StopAtCustomer,
	})

	// maxOTPAttempts = 5: five wrong guesses are accepted (and consumed), the sixth locks.
	for i := 0; i < maxOTPAttempts; i++ {
		rec := riderCall(t, h, http.MethodPost, "/delivery/otp/verify",
			fmt.Sprintf(`{"stopId":%q,"otp":"0000"}`, f.dropStopID), f.phone)
		if rec.Code != http.StatusUnauthorized {
			t.Fatalf("attempt %d: status = %d body=%s, want 401", i+1, rec.Code, rec.Body.String())
		}
	}
	rec := riderCall(t, h, http.MethodPost, "/delivery/otp/verify",
		fmt.Sprintf(`{"stopId":%q,"otp":"1234"}`, f.dropStopID), f.phone)
	if rec.Code != http.StatusTooManyRequests || !strings.Contains(rec.Body.String(), "otp_locked") {
		t.Fatalf("status = %d body=%s, want 429 otp_locked", rec.Code, rec.Body.String())
	}
}
