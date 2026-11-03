-- 0075_analytics_metrics.sql
-- Why: the portal's admin dashboards used a seeded deterministic fake ("series.ts") for
-- GMV/order trend lines. The trend must come from the real ledger. The gateway endpoint
-- (internal/analytics, GET /analytics/series + /analytics/ranks) aggregates live
-- checkout.orders / order_items grouped by IST day — no scheduled writer needed. These two
-- indexes keep the date-range scan and per-product aggregation fast.
create index if not exists orders_placed_idx on checkout.orders (placed_at desc);
create index if not exists order_items_product_idx on checkout.order_items (product_id);