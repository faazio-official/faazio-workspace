-- 0044_checkout_drop_coordinates.sql — persist the customer's delivery fix on the order.
--
-- Auto-dispatch runs when a seller marks an order PACKED. The seller portal has no customer
-- location, so the app captures the live delivery fix at placement and the gateway stores it on the
-- order. Null means the app had no fix (or the order is self-pickup) and auto-dispatch is skipped;
-- an admin can still assign manually with coordinates. Additive only.

alter table checkout.orders
  add column if not exists delivery_latitude float8
    check (delivery_latitude between -90 and 90),
  add column if not exists delivery_longitude float8
    check (delivery_longitude between -180 and 180);

comment on column checkout.orders.delivery_latitude is
  'Customer drop latitude captured at placement (delivery fulfillment only); null = no fix.';
comment on column checkout.orders.delivery_longitude is
  'Customer drop longitude captured at placement (delivery fulfillment only); null = no fix.';
