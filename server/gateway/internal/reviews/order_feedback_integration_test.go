package reviews

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/faazio/server/gateway/internal/checkout"
	"github.com/faazio/server/gateway/internal/platform/authtest"
	"github.com/faazio/server/gateway/internal/platform/cache"
	"github.com/faazio/server/gateway/internal/platform/testenv"
	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// ---------------------------------------------------------------------------
// Workflow 7 — customer submits post-delivery order feedback.
//
// PUT/GET /orders/{orderID}/feedback is driven through the real reviews HTTP
// handler + service with the checkout repo as the delivered-purchase gate,
// against a real Postgres (testenv.Pool skips when unconfigured).
// ---------------------------------------------------------------------------

func newReviewsRouter(t *testing.T) (http.Handler, *pgxpool.Pool, *cache.Cache) {
	t.Helper()
	pool := testenv.Pool(t)
	c := testenv.Cache(t)
	repo := New(pool)
	gate := checkout.New(pool)
	h := NewHandler(repo, NewService(repo, gate, gate, c), c, nil)
	r := chi.NewRouter()
	r.Use(authtest.Middleware())
	h.Register(r)
	return r, pool, c
}

func reviewsCall(t *testing.T, h http.Handler, method, path, body string, headers map[string]string) *httptest.ResponseRecorder {
	t.Helper()
	req := httptest.NewRequest(method, path, strings.NewReader(body))
	if body != "" {
		req.Header.Set("Content-Type", "application/json")
	}
	for k, v := range headers {
		req.Header.Set(k, v)
	}
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	return rec
}

func seedOrder(t *testing.T, pool *pgxpool.Pool, userID, status string) string {
	t.Helper()
	ctx := context.Background()
	orderID := fmt.Sprintf("it-fb-%d", time.Now().UnixNano())
	if _, err := pool.Exec(ctx, `
		insert into checkout.orders (order_id, order_number, user_id, placed_at, status, vendor_store_ids)
		values ($1,$1,$2,now(),$3::order_status,'{}')`, orderID, userID, status); err != nil {
		t.Fatalf("seed order: %v", err)
	}
	t.Cleanup(func() {
		_, _ = pool.Exec(ctx, `delete from reviews.order_feedback where order_id=$1`, orderID)
		_, _ = pool.Exec(ctx, `delete from checkout.orders where order_id=$1`, orderID)
	})
	return orderID
}

func TestOrderFeedbackSubmitAndRead(t *testing.T) {
	h, pool, _ := newReviewsRouter(t)
	orderID := seedOrder(t, pool, "user-1", "Delivered")

	put := reviewsCall(t, h, http.MethodPut, "/orders/"+orderID+"/feedback",
		`{"rating":5,"comment":"great"}`, map[string]string{"X-Dev-User": "user-1"})
	if put.Code != http.StatusOK {
		t.Fatalf("put status = %d body=%s", put.Code, put.Body.String())
	}

	get := reviewsCall(t, h, http.MethodGet, "/orders/"+orderID+"/feedback", "",
		map[string]string{"X-Dev-User": "user-1"})
	if get.Code != http.StatusOK {
		t.Fatalf("get status = %d body=%s", get.Code, get.Body.String())
	}
	var fb struct {
		Rating  int64  `json:"rating"`
		Comment string `json:"comment"`
	}
	if err := json.Unmarshal(get.Body.Bytes(), &fb); err != nil {
		t.Fatalf("decode: %v (%s)", err, get.Body.String())
	}
	if fb.Rating != 5 || fb.Comment != "great" {
		t.Fatalf("feedback = (%d,%q), want (5,great)", fb.Rating, fb.Comment)
	}

	var rows int
	pool.QueryRow(context.Background(), `select count(*) from reviews.order_feedback where order_id=$1`, orderID).Scan(&rows)
	if rows != 1 {
		t.Fatalf("order_feedback rows = %d, want 1", rows)
	}
}

func TestOrderFeedbackNotEligible(t *testing.T) {
	h, pool, _ := newReviewsRouter(t)

	// Not delivered.
	processing := seedOrder(t, pool, "user-1", "Processing")
	rec := reviewsCall(t, h, http.MethodPut, "/orders/"+processing+"/feedback",
		`{"rating":5}`, map[string]string{"X-Dev-User": "user-1"})
	if rec.Code != http.StatusForbidden || !strings.Contains(rec.Body.String(), "not_eligible") {
		t.Fatalf("not delivered: status = %d body=%s, want 403 not_eligible", rec.Code, rec.Body.String())
	}

	// Delivered but a different user's order.
	ctx := context.Background()
	if _, err := pool.Exec(ctx, `insert into checkout.users (user_id,name,email,phone)
		values ('user-it-other','IT','it@it','0') on conflict (user_id) do nothing`); err != nil {
		t.Fatalf("seed other user: %v", err)
	}
	t.Cleanup(func() { _, _ = pool.Exec(ctx, `delete from checkout.users where user_id='user-it-other'`) })
	other := seedOrder(t, pool, "user-it-other", "Delivered")
	rec = reviewsCall(t, h, http.MethodPut, "/orders/"+other+"/feedback",
		`{"rating":5}`, map[string]string{"X-Dev-User": "user-1"})
	if rec.Code != http.StatusForbidden {
		t.Fatalf("not owner: status = %d, want 403", rec.Code)
	}
}

func TestOrderFeedbackInvalidRating(t *testing.T) {
	h, pool, _ := newReviewsRouter(t)
	orderID := seedOrder(t, pool, "user-1", "Delivered")
	for _, rating := range []int{0, 6} {
		rec := reviewsCall(t, h, http.MethodPut, "/orders/"+orderID+"/feedback",
			fmt.Sprintf(`{"rating":%d}`, rating), map[string]string{"X-Dev-User": "user-1"})
		if rec.Code != http.StatusBadRequest || !strings.Contains(rec.Body.String(), "invalid_rating") {
			t.Fatalf("rating %d: status = %d body=%s, want 400 invalid_rating", rating, rec.Code, rec.Body.String())
		}
	}
}

func TestOrderFeedbackCommentTruncated(t *testing.T) {
	h, pool, _ := newReviewsRouter(t)
	orderID := seedOrder(t, pool, "user-1", "Delivered")

	long := strings.Repeat("a", 300)
	rec := reviewsCall(t, h, http.MethodPut, "/orders/"+orderID+"/feedback",
		fmt.Sprintf(`{"rating":4,"comment":%q}`, long), map[string]string{"X-Dev-User": "user-1"})
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d body=%s", rec.Code, rec.Body.String())
	}
	var stored string
	pool.QueryRow(context.Background(), `select comment from reviews.order_feedback where order_id=$1`, orderID).Scan(&stored)
	if len(stored) > 280 {
		t.Fatalf("stored comment length = %d, want <= 280", len(stored))
	}
}

func TestOrderFeedbackUpsertLatestWins(t *testing.T) {
	h, pool, _ := newReviewsRouter(t)
	orderID := seedOrder(t, pool, "user-1", "Delivered")
	hdr := map[string]string{"X-Dev-User": "user-1"}

	for _, body := range []string{`{"rating":3,"comment":"ok"}`, `{"rating":5,"comment":"better"}`} {
		if rec := reviewsCall(t, h, http.MethodPut, "/orders/"+orderID+"/feedback", body, hdr); rec.Code != http.StatusOK {
			t.Fatalf("put status = %d body=%s", rec.Code, rec.Body.String())
		}
	}
	var rows int
	var rating int64
	var comment string
	pool.QueryRow(context.Background(), `select count(*) from reviews.order_feedback where order_id=$1`, orderID).Scan(&rows)
	pool.QueryRow(context.Background(), `select rating, comment from reviews.order_feedback where order_id=$1`, orderID).Scan(&rating, &comment)
	if rows != 1 || rating != 5 || comment != "better" {
		t.Fatalf("rows=%d rating=%d comment=%q, want 1/5/better", rows, rating, comment)
	}
}

func TestOrderFeedbackSignedOut(t *testing.T) {
	pool := testenv.Pool(t)
	c := testenv.Cache(t)
	repo := New(pool)
	gate := checkout.New(pool)
	h := NewHandler(repo, NewService(repo, gate, gate, c), c, nil)
	// No authtest middleware: the caller has no resolved identity.
	r := chi.NewRouter()
	h.Register(r)

	rec := reviewsCall(t, r, http.MethodGet, "/orders/whatever/feedback", "", nil)
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("status = %d, want 401", rec.Code)
	}
}
