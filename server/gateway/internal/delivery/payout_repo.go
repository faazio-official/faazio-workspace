package delivery

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"math"
	"time"

	"github.com/jackc/pgx/v5"
)

// PayoutSettings reads the singleton rider rate card.
func (r *Repo) PayoutSettings(ctx context.Context) (PayoutSettings, error) {
	if err := r.ready(); err != nil {
		return PayoutSettings{}, err
	}
	var s PayoutSettings
	err := r.pool.QueryRow(ctx, `
		select base_rate_paisa, base_distance_km::float8, per_extra_km_paisa,
		       night_surge_paisa, weather_surge_paisa, festival_surge_paisa
		  from delivery.payout_settings where id = 1`).
		Scan(&s.BaseRatePaisa, &s.BaseDistanceKm, &s.PerExtraKmPaisa,
			&s.NightSurgePaisa, &s.WeatherSurgePaisa, &s.FestivalSurgePaisa)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return DefaultPayoutSettings(), nil
		}
		return PayoutSettings{}, err
	}
	return s, nil
}

// UpsertPayout persists a calculation. A paid payout is immutable (the existing row is returned).
func (r *Repo) UpsertPayout(ctx context.Context, p RiderPayout) (RiderPayout, error) {
	if err := r.ready(); err != nil {
		return RiderPayout{}, err
	}
	if p.PayoutID == "" {
		p.PayoutID = "dp-" + payoutID()
	}
	var (
		paidAt *time.Time
		out    RiderPayout
	)
	// Auditable breakdown of the calculation used for this order's display projection.
	basis, err := json.Marshal(map[string]any{
		"distanceKm":         p.DistanceKm,
		"baseRatePaisa":      p.BaseRatePaisa,
		"extraKmChargePaisa": p.ExtraKmChargePaisa,
		"surgePaisa":         p.SurgePaisa,
		"surgeReason":        p.SurgeReason,
	})
	if err != nil {
		return RiderPayout{}, err
	}
	err = r.pool.QueryRow(ctx, `
		insert into delivery.delivery_payouts
		  (payout_id, rider_id, order_id, distance_km, base_rate_paisa, extra_km_charge_paisa,
		   surge_paisa, surge_reason, total_paisa, status)
		values ($1,$2,$3,$4,$5,$6,$7,$8,$9,'PENDING')
		on conflict (order_id) do update
		  set distance_km = excluded.distance_km,
		      base_rate_paisa = excluded.base_rate_paisa,
		      extra_km_charge_paisa = excluded.extra_km_charge_paisa,
		      surge_paisa = excluded.surge_paisa,
		      surge_reason = excluded.surge_reason,
		      total_paisa = excluded.total_paisa,
		      updated_at = now()
		  where delivery_payouts.status = 'PENDING'
		returning payout_id, order_id, rider_id, distance_km::float8, base_rate_paisa,
		          extra_km_charge_paisa, surge_paisa, surge_reason, total_paisa, status::text, paid_at`,
		p.PayoutID, p.RiderID, p.OrderID, p.DistanceKm, p.BaseRatePaisa, p.ExtraKmChargePaisa,
		p.SurgePaisa, p.SurgeReason, p.TotalPaisa).
		Scan(&out.PayoutID, &out.OrderID, &out.RiderID, &out.DistanceKm, &out.BaseRatePaisa,
			&out.ExtraKmChargePaisa, &out.SurgePaisa, &out.SurgeReason, &out.TotalPaisa,
			&out.Status, &paidAt)
	if errors.Is(err, pgx.ErrNoRows) {
		existing, ok, ferr := r.PayoutByOrder(ctx, p.OrderID)
		if ferr != nil {
			return RiderPayout{}, ferr
		}
		if !ok {
			return RiderPayout{}, err
		}
		return existing, nil
	}
	if err != nil {
		return RiderPayout{}, err
	}
	out.PaidAt = isoTime(paidAt)
	// Display projection on the delivery order (never the source of truth), plus the auditable basis.
	_, _ = r.pool.Exec(ctx, `
		update delivery.delivery_orders
		   set payout_amount_paisa=$2, payout_basis=$3
		 where order_id=$1`, p.OrderID, out.TotalPaisa, basis)
	return out, nil
}

// StoredDeliveryBasis returns the customer-paid distance + surge total/reason recorded on the
// originating checkout order. ok=false for a legacy order with no stored basis. Cross-context read
// by order id (the delivery job's customer_order_id), never a sibling repo import. Distance is
// returned in integer metres (the same unit as delivery_orders.total_distance_meters).
func (r *Repo) StoredDeliveryBasis(ctx context.Context, customerOrderID string) (distanceMeters int64, paisa int64, reason string, ok bool, err error) {
	if err := r.ready(); err != nil {
		return 0, 0, "", false, err
	}
	if customerOrderID == "" {
		return 0, 0, "", false, nil
	}
	var km float64
	// delivery_billing_basis (not the columns' defaults) is the sentinel for a post-0054 order:
	// legacy rows gain the columns with zero defaults, so only the JSON snapshot distinguishes them.
	err = r.pool.QueryRow(ctx, `
		select coalesce(delivery_distance_km,0)::float8,
		       coalesce(delivery_surge_paisa,0), coalesce(delivery_surge_reason,''),
		       delivery_billing_basis is not null
		  from checkout.orders where order_id = $1`, customerOrderID).
		Scan(&km, &paisa, &reason, &ok)
	if errors.Is(err, pgx.ErrNoRows) {
		return 0, 0, "", false, nil
	}
	if err != nil {
		return 0, 0, "", false, err
	}
	if !ok {
		return 0, 0, "", false, nil
	}
	return int64(math.Round(km * 1000)), paisa, reason, true, nil
}

// PayoutByOrder returns the stored payout for one delivery job.
func (r *Repo) PayoutByOrder(ctx context.Context, orderID string) (RiderPayout, bool, error) {
	if err := r.ready(); err != nil {
		return RiderPayout{}, false, err
	}
	var (
		p      RiderPayout
		paidAt *time.Time
	)
	err := r.pool.QueryRow(ctx, `
		select payout_id, order_id, rider_id, distance_km::float8, base_rate_paisa,
		       extra_km_charge_paisa, surge_paisa, surge_reason, total_paisa, status::text, paid_at
		  from delivery.delivery_payouts where order_id=$1`, orderID).
		Scan(&p.PayoutID, &p.OrderID, &p.RiderID, &p.DistanceKm, &p.BaseRatePaisa,
			&p.ExtraKmChargePaisa, &p.SurgePaisa, &p.SurgeReason, &p.TotalPaisa, &p.Status, &paidAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return RiderPayout{}, false, nil
	}
	if err != nil {
		return RiderPayout{}, false, err
	}
	p.PaidAt = isoTime(paidAt)
	return p, true, nil
}

// SettlePayout marks a PENDING payout PAID (super-admin action).
func (r *Repo) SettlePayout(ctx context.Context, orderID, actorID string) (RiderPayout, bool, error) {
	if err := r.ready(); err != nil {
		return RiderPayout{}, false, err
	}
	var (
		p      RiderPayout
		paidAt *time.Time
	)
	err := r.pool.QueryRow(ctx, `
		update delivery.delivery_payouts
		   set status='PAID', paid_at=now(), paid_by=$2, updated_at=now()
		 where order_id=$1 and status='PENDING'
		 returning payout_id, order_id, rider_id, distance_km::float8, base_rate_paisa,
		           extra_km_charge_paisa, surge_paisa, surge_reason, total_paisa, status::text, paid_at`,
		orderID, actorID).
		Scan(&p.PayoutID, &p.OrderID, &p.RiderID, &p.DistanceKm, &p.BaseRatePaisa,
			&p.ExtraKmChargePaisa, &p.SurgePaisa, &p.SurgeReason, &p.TotalPaisa, &p.Status, &paidAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return RiderPayout{}, false, nil
	}
	if err != nil {
		return RiderPayout{}, false, err
	}
	p.PaidAt = isoTime(paidAt)
	return p, true, nil
}

// PayoutsByRider lists a rider's recent payouts (earnings screen).
func (r *Repo) PayoutsByRider(ctx context.Context, riderID string, limit int) ([]RiderPayout, error) {
	if err := r.ready(); err != nil {
		return nil, err
	}
	if limit <= 0 || limit > 100 {
		limit = 30
	}
	rows, err := r.pool.Query(ctx, `
		select payout_id, order_id, rider_id, distance_km::float8, base_rate_paisa,
		       extra_km_charge_paisa, surge_paisa, surge_reason, total_paisa, status::text, paid_at
		  from delivery.delivery_payouts where rider_id=$1
		 order by created_at desc limit $2`, riderID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []RiderPayout{}
	for rows.Next() {
		var (
			p      RiderPayout
			paidAt *time.Time
		)
		if err := rows.Scan(&p.PayoutID, &p.OrderID, &p.RiderID, &p.DistanceKm, &p.BaseRatePaisa,
			&p.ExtraKmChargePaisa, &p.SurgePaisa, &p.SurgeReason, &p.TotalPaisa, &p.Status, &paidAt); err != nil {
			return nil, err
		}
		p.PaidAt = isoTime(paidAt)
		out = append(out, p)
	}
	return out, rows.Err()
}

// UpdatePayoutSettings writes the singleton rider rate card.
func (r *Repo) UpdatePayoutSettings(ctx context.Context, s PayoutSettings, actorID string) error {
	if err := r.ready(); err != nil {
		return err
	}
	_, err := r.pool.Exec(ctx, `
		insert into delivery.payout_settings
		  (id, base_rate_paisa, base_distance_km, per_extra_km_paisa,
		   night_surge_paisa, weather_surge_paisa, festival_surge_paisa, updated_by)
		values (1,$1,$2,$3,$4,$5,$6,$7)
		on conflict (id) do update
		  set base_rate_paisa = excluded.base_rate_paisa,
		      base_distance_km = excluded.base_distance_km,
		      per_extra_km_paisa = excluded.per_extra_km_paisa,
		      night_surge_paisa = excluded.night_surge_paisa,
		      weather_surge_paisa = excluded.weather_surge_paisa,
		      festival_surge_paisa = excluded.festival_surge_paisa,
		      updated_by = excluded.updated_by,
		      updated_at = now()`,
		s.BaseRatePaisa, s.BaseDistanceKm, s.PerExtraKmPaisa,
		s.NightSurgePaisa, s.WeatherSurgePaisa, s.FestivalSurgePaisa, actorID)
	return err
}

func payoutID() string {
	b := make([]byte, 5)
	_, _ = rand.Read(b)
	return hex.EncodeToString(b)
}

func isoTime(t *time.Time) string {
	if t == nil {
		return ""
	}
	return t.UTC().Format(time.RFC3339)
}
