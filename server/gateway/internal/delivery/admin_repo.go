package delivery

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
)

// ErrManualFareRequired is returned when a MANUAL payout is settled before the admin recorded the
// travelled distance and fare. The handler maps it to a 409 with an actionable code.
var ErrManualFareRequired = errors.New("delivery: manual fare is required")

const adminOrderSelect = `
	select p.order_id, p.customer_order_id, p.store_id, st.name, coalesce(st.address,''),
	       st.latitude, st.longitude, coalesce(sl.district_code,''), coalesce(sl.state_code,''),
	       p.rider_id, coalesce(r.full_name,''), coalesce(r.phone,''), p.status,
	       coalesce(a.name,''), coalesce(a.phone,''), coalesce(a.address,''),
	       co.delivery_latitude, co.delivery_longitude, coalesce(co.total_paisa,0),
	       coalesce(round(co.delivery_distance_km * 1000), p.distance_meters)::int8,
	       p.payout_mode, p.calculated_fare_paisa,
	       p.manual_distance_km::float8, p.manual_fare_paisa, p.fare_override_reason,
	       coalesce(co.status_date, co.placed_at, p.created_at),
	       p.assigned_at, p.expires_at, p.completed_at, p.created_at
	  from (%s) p
	  join directory.stores st on st.id = p.store_id
	  left join sellers.sellers sl on sl.seller_id = st.seller_id
	  left join delivery.delivery_boys r on r.rider_id = p.rider_id
	  left join checkout.orders co on co.order_id = p.customer_order_id
	  left join checkout.addresses a on a.address_id = co.address_id`

const adminPendingOrdersCTE = `
	select d.order_id, d.customer_order_id, d.store_id, d.rider_id, d.status::text as status,
	       d.total_distance_meters as distance_meters, d.payout_mode::text as payout_mode,
	       d.calculated_fare_paisa, d.manual_distance_km, d.manual_fare_paisa,
	       coalesce(d.fare_override_reason,'') as fare_override_reason,
	       d.assigned_at, d.expires_at, d.completed_at, d.created_at
	  from delivery.delivery_orders d
	 where d.status in ('ASSIGNED','REJECTED')
	union all
	select ''::text, co.order_id, st.id, ''::text, 'UNASSIGNED'::text,
	       coalesce(round(co.delivery_distance_km * 1000),0)::int8, 'AUTOMATED'::text,
	       null::int8, null::numeric, null::int8, ''::text,
	       null::timestamptz, null::timestamptz, null::timestamptz, co.placed_at
	  from checkout.orders co
	  join directory.stores st on st.id = co.vendor_store_ids[1]
	 where co.status = 'PACKED'
	   and co.fulfillment is distinct from 'PICKUP'
	   and not exists (
	     select 1 from delivery.delivery_orders d
	      where d.customer_order_id = co.order_id
	        and d.status <> 'CANCELLED')`

// AdminOrders lists the district-scoped allocation board: pending delivery jobs (ASSIGNED /
// REJECTED) plus PACKED orders that were never auto-dispatched. District admins pass their claim
// in district; super admins pass "" to see every district.
func (r *Repo) AdminOrders(ctx context.Context, district, state, status, storeID string, from, to *time.Time, limit int) ([]AdminOrder, error) {
	if err := r.ready(); err != nil {
		return nil, err
	}
	if limit <= 0 || limit > 200 {
		limit = 100
	}
	q := fmt.Sprintf(adminOrderSelect+`
		 where ($1 = '' or coalesce(sl.district_code,'') = $1)
		   and ($2 = '' or coalesce(sl.state_code,'') = $2)
		   and ($3 = '' or p.status = $3)
		   and ($4 = '' or p.store_id = $4)
		   and ($5::timestamptz is null or p.created_at >= $5)
		   and ($6::timestamptz is null or p.created_at <= $6)
		   and ($8 = '' or p.order_id = $8 or p.customer_order_id = $8)
		 order by coalesce(sl.district_code,''), p.created_at desc
		 limit $7`, adminPendingOrdersCTE)
	rows, err := r.pool.Query(ctx, q, district, strings.ToUpper(strings.TrimSpace(state)),
		strings.ToUpper(strings.TrimSpace(status)), storeID, from, to, limit, "")
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []AdminOrder{}
	for rows.Next() {
		o, err := scanAdminOrder(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, o)
	}
	return out, rows.Err()
}

// AdminOrderByID resolves a delivery job id or a customer order id on the pending board.
func (r *Repo) AdminOrderByID(ctx context.Context, orderID string) (AdminOrder, error) {
	if err := r.ready(); err != nil {
		return AdminOrder{}, err
	}
	q := fmt.Sprintf(adminOrderSelect+`
		 where ($1 = '' or p.order_id = $1 or p.customer_order_id = $1)
		 order by case when p.order_id = $1 then 0 else 1 end, p.created_at desc
		 limit 1`, adminPendingOrdersCTE)
	o, err := scanAdminOrder(r.pool.QueryRow(ctx, q, orderID))
	if errors.Is(err, pgx.ErrNoRows) {
		return AdminOrder{}, ErrNotFound
	}
	if err != nil {
		return AdminOrder{}, err
	}
	if o.OrderID != "" {
		if err := r.loadOrderStops(ctx, &o); err != nil {
			return AdminOrder{}, err
		}
	}
	return o, nil
}

func scanAdminOrder(row pgx.Row) (AdminOrder, error) {
	var o AdminOrder
	var readyAt, assigned, expires, completed, created *time.Time
	err := row.Scan(
		&o.OrderID, &o.CustomerOrderID, &o.StoreID, &o.StoreName, &o.StoreAddress,
		&o.StoreLatitude, &o.StoreLongitude, &o.DistrictCode, &o.StateCode,
		&o.RiderID, &o.RiderName, &o.RiderPhone, &o.Status,
		&o.CustomerName, &o.CustomerPhone, &o.DropAddress,
		&o.DropLatitude, &o.DropLongitude, &o.OrderValuePaisa,
		&o.DistanceMeters, &o.PayoutMode, &o.CalculatedFarePaisa,
		&o.ManualDistanceKm, &o.ManualFarePaisa, &o.FareOverrideReason,
		&readyAt, &assigned, &expires, &completed, &created)
	if err != nil {
		return AdminOrder{}, err
	}
	o.ReadyAt = iso(readyAt)
	o.AssignedAt = iso(assigned)
	o.ExpiresAt = iso(expires)
	o.CompletedAt = iso(completed)
	o.CreatedAt = iso(created)
	return o, nil
}

func (r *Repo) loadOrderStops(ctx context.Context, o *AdminOrder) error {
	rows, err := r.pool.Query(ctx, `
		select stop_id, delivery_order_id, sequence, stop_type::text, status::text, label, address,
		       latitude, longitude, customer_name, customer_phone,
		       (customer_otp_hash is not null) as requires_otp, coalesce(failure_reason,''),
		       arrived_at, completed_at
		  from delivery.delivery_stops where delivery_order_id=$1 order by sequence`, o.OrderID)
	if err != nil {
		return err
	}
	defer rows.Close()
	o.Stops = []Stop{}
	for rows.Next() {
		var s Stop
		var arrived, done *time.Time
		if err := rows.Scan(&s.StopID, &s.DeliveryOrderID, &s.Sequence, &s.StopType, &s.Status,
			&s.Label, &s.Address, &s.Latitude, &s.Longitude, &s.CustomerName, &s.CustomerPhone,
			&s.RequiresOTP, &s.FailureReason, &arrived, &done); err != nil {
			return err
		}
		s.ArrivedAt = iso(arrived)
		s.CompletedAt = iso(done)
		o.Stops = append(o.Stops, s)
	}
	return rows.Err()
}

// StoreDistrict resolves the district claim for a store from its seller. Legacy stores without a
// seller district return "" (the job stays super-admin-only on the district-scoped board).
func (r *Repo) StoreDistrict(ctx context.Context, storeID string) (string, error) {
	if err := r.ready(); err != nil {
		return "", err
	}
	var district string
	err := r.pool.QueryRow(ctx, `
		select coalesce(sl.district_code,'')
		  from directory.stores st
		  left join sellers.sellers sl on sl.seller_id = st.seller_id
		 where st.id = $1`, storeID).Scan(&district)
	if errors.Is(err, pgx.ErrNoRows) {
		return "", nil
	}
	return district, err
}

// OrderScope returns the district + parent state for an existing delivery job, used by the
// district-admin authorization guard. Legacy rows without a seller district return "".
func (r *Repo) OrderScope(ctx context.Context, orderID string) (district, state string, err error) {
	if err := r.ready(); err != nil {
		return "", "", err
	}
	err = r.pool.QueryRow(ctx, `
		select coalesce(d.district_code,''), coalesce(sl.state_code,'')
		  from delivery.delivery_orders d
		  join directory.stores st on st.id = d.store_id
		  left join sellers.sellers sl on sl.seller_id = st.seller_id
		 where d.order_id = $1`, orderID).Scan(&district, &state)
	if errors.Is(err, pgx.ErrNoRows) {
		return "", "", ErrNotFound
	}
	return district, state, err
}

// ReallocateOrder assigns an existing ASSIGNED/REJECTED job to an admin-chosen rider and records
// the payout mode + calculated fare snapshot. A rider who already declined the job is refused.
func (r *Repo) ReallocateOrder(ctx context.Context, orderID, riderID, mode, district string, calculatedFare int64, expiresAt time.Time, totalMeters, etaSeconds int64) (Order, error) {
	if err := r.ready(); err != nil {
		return Order{}, err
	}
	ct, err := r.pool.Exec(ctx, `
		update delivery.delivery_orders
		   set rider_id=$2, status='ASSIGNED', assigned_at=now(), accepted_at=null,
		       completed_at=null, expires_at=$3, total_distance_meters=$4,
		       estimated_duration_seconds=$5, payout_mode=$6::delivery_payout_mode,
		       district_code=coalesce(nullif($8,''), district_code),
		       calculated_fare_paisa=$7, payout_amount_paisa=$7,
		       manual_distance_km=null, manual_fare_paisa=null, fare_override_reason=null,
		       dispatch_attempts=dispatch_attempts + 1, updated_at=now()
		 where order_id=$1 and status in ('ASSIGNED','REJECTED')
		   and not (excluded_rider_ids ? $2)`,
		orderID, riderID, expiresAt, totalMeters, etaSeconds, payoutModeOrDefault(mode),
		calculatedFare, district)
	if err != nil {
		return Order{}, err
	}
	if ct.RowsAffected() == 0 {
		return Order{}, fmt.Errorf("%w: order is not allocatable to this rider", ErrConflict)
	}
	return r.OrderByID(ctx, orderID)
}

// CreateManualOrder creates a delivery job for a PACKED order that was never auto-dispatched.
func (r *Repo) CreateManualOrder(ctx context.Context, o Order, stops []Stop, expiresAt time.Time) (Order, error) {
	return r.CreateOrder(ctx, o, stops, "", nil, expiresAt)
}

// SetPayoutMode changes the order's payout mode before settlement. Switching to AUTOMATED clears
// the manual fields; the caller passes the fresh calculated fare. A PENDING payout row mirrors it.
func (r *Repo) SetPayoutMode(ctx context.Context, orderID, mode string, calculatedFare int64, manualDistance *float64, manualFare *int64, reason string) (Order, error) {
	if err := r.ready(); err != nil {
		return Order{}, err
	}
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return Order{}, err
	}
	defer func() { _ = tx.Rollback(ctx) }()
	ct, err := tx.Exec(ctx, `
		update delivery.delivery_orders
		   set payout_mode=$2::delivery_payout_mode, calculated_fare_paisa=$3,
		       manual_distance_km=$4, manual_fare_paisa=$5, fare_override_reason=nullif($6,''),
		       payout_amount_paisa=coalesce($5, $3, payout_amount_paisa), updated_at=now()
		 where order_id=$1 and status <> 'CANCELLED'
		   and not exists (select 1 from delivery.delivery_payouts p
		                    where p.order_id=$1 and p.status='PAID')`,
		orderID, payoutModeOrDefault(mode), calculatedFare, manualDistance, manualFare, reason)
	if err != nil {
		return Order{}, err
	}
	if ct.RowsAffected() == 0 {
		return Order{}, fmt.Errorf("%w: payout mode cannot change after payment", ErrConflict)
	}
	_, err = tx.Exec(ctx, `
		update delivery.delivery_payouts
		   set payout_mode=$2::delivery_payout_mode, calculated_fare_paisa=$3,
		       manual_distance_km=$4, manual_fare_paisa=$5, fare_override_reason=nullif($6,''),
		       total_paisa=coalesce($5, $3, total_paisa), updated_at=now()
		 where order_id=$1 and status='PENDING'`,
		orderID, payoutModeOrDefault(mode), calculatedFare, manualDistance, manualFare, reason)
	if err != nil {
		return Order{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return Order{}, err
	}
	return r.OrderByID(ctx, orderID)
}

// SetManualFare records the admin-travelled distance + fare for a MANUAL order before payment.
func (r *Repo) SetManualFare(ctx context.Context, orderID string, distanceKm float64, calculatedFare, farePaisa int64, reason string) (Order, error) {
	if err := r.ready(); err != nil {
		return Order{}, err
	}
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return Order{}, err
	}
	defer func() { _ = tx.Rollback(ctx) }()
	ct, err := tx.Exec(ctx, `
		update delivery.delivery_orders
		   set manual_distance_km=$2, manual_fare_paisa=$3, calculated_fare_paisa=$4,
		       fare_override_reason=nullif($5,''), payout_amount_paisa=$3, updated_at=now()
		 where order_id=$1 and payout_mode='MANUAL' and status <> 'CANCELLED'
		   and not exists (select 1 from delivery.delivery_payouts p
		                    where p.order_id=$1 and p.status='PAID')`,
		orderID, distanceKm, farePaisa, calculatedFare, reason)
	if err != nil {
		return Order{}, err
	}
	if ct.RowsAffected() == 0 {
		return Order{}, fmt.Errorf("%w: manual fare requires a MANUAL order before payment", ErrConflict)
	}
	_, err = tx.Exec(ctx, `
		update delivery.delivery_payouts
		   set distance_km=$2, total_paisa=$3, calculated_fare_paisa=$4,
		       manual_distance_km=$2, manual_fare_paisa=$3, fare_override_reason=nullif($5,''),
		       updated_at=now()
		 where order_id=$1 and status='PENDING'`,
		orderID, distanceKm, farePaisa, calculatedFare, reason)
	if err != nil {
		return Order{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return Order{}, err
	}
	return r.OrderByID(ctx, orderID)
}

// AdminPayouts lists the settlement board. Completed jobs with no payout row yet are projected as
// PENDING so the admin can settle them from one screen.
func (r *Repo) AdminPayouts(ctx context.Context, district, state, mode, status, riderID string, from, to *time.Time, limit int) ([]AdminPayout, error) {
	if err := r.ready(); err != nil {
		return nil, err
	}
	if limit <= 0 || limit > 200 {
		limit = 100
	}
	rows, err := r.pool.Query(ctx, `
		select coalesce(p.payout_id,''), d.order_id, d.customer_order_id, d.rider_id,
		       coalesce(r.full_name,''), coalesce(d.district_code,''),
		       coalesce(p.distance_km, d.manual_distance_km, co.delivery_distance_km,
		                round(d.total_distance_meters / 1000.0, 2))::float8,
		       d.payout_mode::text,
		       coalesce(p.calculated_fare_paisa, d.calculated_fare_paisa, d.payout_amount_paisa, 0),
		       coalesce(p.total_paisa, d.manual_fare_paisa, d.calculated_fare_paisa,
		                d.payout_amount_paisa, 0),
		       coalesce(p.status::text,'PENDING'),
		       coalesce(p.manual_distance_km, d.manual_distance_km)::float8,
		       coalesce(p.manual_fare_paisa, d.manual_fare_paisa),
		       coalesce(p.fare_override_reason, d.fare_override_reason, ''),
		       p.paid_at, coalesce(p.paid_by,''), d.completed_at, d.created_at
		  from delivery.delivery_orders d
		  join delivery.delivery_boys r on r.rider_id = d.rider_id
		  join directory.stores st on st.id = d.store_id
		  left join sellers.sellers sl on sl.seller_id = st.seller_id
		  left join checkout.orders co on co.order_id = d.customer_order_id
		  left join delivery.delivery_payouts p on p.order_id = d.order_id
		 where d.status = 'ROUTE_COMPLETE'
		   and ($1 = '' or coalesce(d.district_code,'') = $1)
		   and ($2 = '' or coalesce(sl.state_code,'') = $2)
		   and ($3 = '' or d.payout_mode::text = $3)
		   and ($4 = '' or coalesce(p.status::text,'PENDING') = $4)
		   and ($5 = '' or d.rider_id = $5)
		   and ($6::timestamptz is null or coalesce(d.completed_at, d.created_at) >= $6)
		   and ($7::timestamptz is null or coalesce(d.completed_at, d.created_at) <= $7)
		 order by coalesce(d.completed_at, d.created_at) desc
		 limit $8`,
		district, strings.ToUpper(strings.TrimSpace(state)),
		strings.ToUpper(strings.TrimSpace(mode)), strings.ToUpper(strings.TrimSpace(status)),
		riderID, from, to, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []AdminPayout{}
	for rows.Next() {
		var p AdminPayout
		var paidAt, completed, created *time.Time
		if err := rows.Scan(&p.PayoutID, &p.OrderID, &p.CustomerOrderID, &p.RiderID, &p.RiderName,
			&p.DistrictCode, &p.DistanceKm, &p.PayoutMode, &p.CalculatedFarePaisa, &p.TotalPaisa,
			&p.Status, &p.ManualDistanceKm, &p.ManualFarePaisa, &p.FareOverrideReason,
			&paidAt, &p.PaidBy, &completed, &created); err != nil {
			return nil, err
		}
		p.PaidAt = iso(paidAt)
		p.CompletedAt = iso(completed)
		p.CreatedAt = iso(created)
		out = append(out, p)
	}
	return out, rows.Err()
}

// SettleOrderPayout settles one completed order. AUTOMATED rows use the calculated breakdown
// (created by the handler before this call); MANUAL rows require the admin-recorded fare. The row
// becomes immutable once PAID.
func (r *Repo) SettleOrderPayout(ctx context.Context, orderID, actorID string) (RiderPayout, bool, error) {
	if err := r.ready(); err != nil {
		return RiderPayout{}, false, err
	}
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return RiderPayout{}, false, err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	var (
		orderStatus, mode string
		riderID           string
		manualKm          *float64
		manualFare        *int64
		calculated        *int64
		distanceMeters    int64
		reason            string
	)
	err = tx.QueryRow(ctx, `
		select status::text, payout_mode::text, rider_id, manual_distance_km::float8,
		       manual_fare_paisa, calculated_fare_paisa, total_distance_meters,
		       coalesce(fare_override_reason,'')
		  from delivery.delivery_orders where order_id=$1 for update`, orderID).
		Scan(&orderStatus, &mode, &riderID, &manualKm, &manualFare, &calculated, &distanceMeters, &reason)
	if errors.Is(err, pgx.ErrNoRows) {
		return RiderPayout{}, false, ErrNotFound
	}
	if err != nil {
		return RiderPayout{}, false, err
	}
	if orderStatus != OrderRouteComplete {
		return RiderPayout{}, false, fmt.Errorf("%w: only a completed delivery can be paid", ErrConflict)
	}
	var (
		existingStatus   string
		existingTotal    int64
		existingDistance float64
	)
	err = tx.QueryRow(ctx, `select status::text, total_paisa, distance_km::float8
	                          from delivery.delivery_payouts where order_id=$1 for update`, orderID).
		Scan(&existingStatus, &existingTotal, &existingDistance)
	if err != nil && !errors.Is(err, pgx.ErrNoRows) {
		return RiderPayout{}, false, err
	}
	if existingStatus == "PAID" {
		return RiderPayout{}, false, nil
	}

	distanceKm := float64(distanceMeters) / 1000
	if existingStatus == "PENDING" {
		distanceKm = existingDistance
	}
	total := existingTotal
	if total == 0 && calculated != nil {
		total = *calculated
	}
	if mode == PayoutManual {
		if manualKm == nil || manualFare == nil {
			return RiderPayout{}, false, ErrManualFareRequired
		}
		distanceKm = *manualKm
		total = *manualFare
	}
	var out RiderPayout
	var paidAt *time.Time
	err = tx.QueryRow(ctx, `
		insert into delivery.delivery_payouts
		  (payout_id, rider_id, order_id, distance_km, base_rate_paisa, extra_km_charge_paisa,
		   surge_paisa, surge_reason, total_paisa, status, paid_at, paid_by,
		   payout_mode, manual_distance_km, manual_fare_paisa, calculated_fare_paisa,
		   fare_override_reason)
		values ($1,$2,$3,$4,0,0,0,'',$5,'PAID',now(),$6,$7::delivery_payout_mode,
		        $8,$9,$10,nullif($11,''))
		on conflict (order_id) do update
		  set rider_id=excluded.rider_id, total_paisa=excluded.total_paisa, status='PAID',
		      paid_at=now(), paid_by=excluded.paid_by, payout_mode=excluded.payout_mode,
		      manual_distance_km=excluded.manual_distance_km,
		      manual_fare_paisa=excluded.manual_fare_paisa,
		      calculated_fare_paisa=excluded.calculated_fare_paisa,
		      fare_override_reason=excluded.fare_override_reason,
		      distance_km=excluded.distance_km, updated_at=now()
		  where delivery_payouts.status='PENDING'
		returning payout_id, order_id, rider_id, distance_km::float8, base_rate_paisa,
		          extra_km_charge_paisa, surge_paisa, surge_reason, total_paisa, status::text,
		          paid_at, payout_mode::text, manual_distance_km::float8, manual_fare_paisa,
		          calculated_fare_paisa, coalesce(fare_override_reason,'')`,
		"dp-"+payoutID(), riderID, orderID, distanceKm, total, actorID,
		payoutModeOrDefault(mode), manualKm, manualFare, calculated, reason).
		Scan(&out.PayoutID, &out.OrderID, &out.RiderID, &out.DistanceKm, &out.BaseRatePaisa,
			&out.ExtraKmChargePaisa, &out.SurgePaisa, &out.SurgeReason, &out.TotalPaisa,
			&out.Status, &paidAt, &out.PayoutMode, &out.ManualDistanceKm, &out.ManualFarePaisa,
			&out.CalculatedFarePaisa, &out.FareOverrideReason)
	if errors.Is(err, pgx.ErrNoRows) {
		return RiderPayout{}, false, nil
	}
	if err != nil {
		return RiderPayout{}, false, err
	}
	out.PaidAt = isoTime(paidAt)
	if err := tx.Commit(ctx); err != nil {
		return RiderPayout{}, false, err
	}
	return out, true, nil
}
