package delivery

import (
	"context"
	"net/http"
	"strconv"
	"time"

	"github.com/faazio/server/gateway/internal/platform/cache"
	"github.com/faazio/server/gateway/internal/platform/httpx"
)

// ist is the business timezone for shift / day boundaries (matches the admin board filters at
// admin_handler.go). Shift days roll at 00:00 IST.
var ist = time.FixedZone("IST", 5*3600+1800)

func istNow(t time.Time) time.Time { return t.In(ist) }
func istDay(t time.Time) string    { return t.In(ist).Format("20060102") }
func sameISTDay(a, b time.Time) bool {
	ai, bi := a.In(ist), b.In(ist)
	return ai.Year() == bi.Year() && ai.Month() == bi.Month() && ai.Day() == bi.Day()
}
func startOfISTDay(t time.Time) time.Time {
	d := t.In(ist)
	return time.Date(d.Year(), d.Month(), d.Day(), 0, 0, 0, 0, ist)
}

type shiftSummaryResponse struct {
	ShiftDate          string `json:"shiftDate"`
	ShiftEarningsPaisa int    `json:"shiftEarningsPaisa"`
	OnlineSecondsToday int    `json:"onlineSecondsToday"`
}

// shiftSummary returns today's server-derived earnings and worked time for the signed-in rider.
// Earnings are durable in Postgres (credited on DROP → DELIVERED); today's online seconds live in
// Valkey, so this read never writes a Postgres row per request. A new IST day lazily rolls the
// previous day into delivery.rider_shift_days.
func (h *Handler) shiftSummary(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	rider, err := h.currentRider(ctx)
	if err != nil {
		h.writeErr(w, err)
		return
	}
	now := time.Now()
	today := istNow(now)

	earnings := rider.ShiftEarningsPaisa
	if rider.ShiftResetAt == nil || !sameISTDay(*rider.ShiftResetAt, today) {
		if err := h.rollover(ctx, rider, today, &earnings); err != nil {
			h.writeErr(w, err)
			return
		}
	}

	httpx.JSON(w, http.StatusOK, shiftSummaryResponse{
		ShiftDate:          today.Format("2006-01-02"),
		ShiftEarningsPaisa: earnings,
		OnlineSecondsToday: h.shiftOnlineSeconds(ctx, rider.RiderID, now),
	})
}

// rollover snapshots the previous IST day into rider_shift_days and resets today's earnings. It
// replaces *earnings with the value the repo actually holds after the (possibly concurrent) rollover
// so a stale read never under-reports.
func (h *Handler) rollover(ctx context.Context, rider Rider, today time.Time, earnings *int) error {
	prevOnline := 0
	if rider.ShiftResetAt != nil {
		if v, ok := h.cache.GetInt(ctx, cache.DeliveryShiftOnline(rider.RiderID, istDay(*rider.ShiftResetAt))); ok {
			prevOnline = int(v)
		}
	}
	current, err := h.repo.RolloverShift(ctx, rider.RiderID, rider.ShiftResetAt, today, prevOnline)
	if err != nil {
		return err
	}
	*earnings = current
	return nil
}

// markShiftOnline records the epoch second the rider went online. Idempotent: an already-online
// rider keeps the original start (so a duplicate toggle never resets the clock).
func (h *Handler) markShiftOnline(ctx context.Context, riderID string) {
	key := cache.DeliveryShiftSince(riderID)
	if _, ok := h.cache.GetInt(ctx, key); ok {
		return
	}
	h.cache.Set(ctx, key, strconv.FormatInt(time.Now().Unix(), 10), cache.TTLDeliveryShiftSince)
}

// markShiftOffline folds the online segment into today's counter and clears the start marker. A
// segment is attributed to the IST day it ends on, clipped at that day's 00:00 (an overnight shift's
// pre-midnight tail is not double-counted). A disabled cache degrades to "no worked-time tracking"
// rather than fabricating a value.
func (h *Handler) markShiftOffline(ctx context.Context, riderID string) {
	key := cache.DeliveryShiftSince(riderID)
	start, ok := h.cache.GetInt(ctx, key)
	h.cache.Del(ctx, key)
	if !ok {
		return
	}
	now := time.Now()
	from := start
	if dayStart := startOfISTDay(now).Unix(); from < dayStart {
		from = dayStart
	}
	if delta := now.Unix() - from; delta > 0 {
		_, _ = h.cache.IncrBy(ctx, cache.DeliveryShiftOnline(riderID, istDay(now)), delta, cache.TTLDeliveryShiftOnline)
	}
}

// shiftOnlineSeconds = today's accumulated offline segments + the live online segment (clipped to
// today's 00:00 IST so an overnight shift does not count yesterday into today).
func (h *Handler) shiftOnlineSeconds(ctx context.Context, riderID string, now time.Time) int {
	total, _ := h.cache.GetInt(ctx, cache.DeliveryShiftOnline(riderID, istDay(now)))
	if start, ok := h.cache.GetInt(ctx, cache.DeliveryShiftSince(riderID)); ok {
		from := start
		if dayStart := startOfISTDay(now).Unix(); from < dayStart {
			from = dayStart
		}
		if live := now.Unix() - from; live > 0 {
			total += live
		}
	}
	if total < 0 {
		return 0
	}
	return int(total)
}
