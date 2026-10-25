-- Seller order decisions: an incoming NEW order can be accepted (NEW → PACKED) or rejected
-- (NEW → REJECTED). A rejection records the seller's reason and refunds any captured payment row.
-- Additive only: existing Processing/PACKED/SHIPPED/DELIVERED/RETURNED/CANCELLED rows are untouched.

alter type order_status add value if not exists 'REJECTED';

alter table checkout.orders add column if not exists rejection_reason text
  check (rejection_reason is null or octet_length(rejection_reason) <= 500);

create index if not exists orders_seller_status_date_idx
  on checkout.orders (status, status_date desc);
