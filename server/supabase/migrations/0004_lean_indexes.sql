-- Faazio MVP — lean indexes + guards for the hot read paths.
-- Authority: docs/architecture/db-schema.md §5–§8, docs/architecture/monolith-breakdown.md §4.
-- Additive only: indexes, CHECK guards, and one derived aggregate table + trigger. No contract change.
--
-- Note on CONCURRENTLY: Supabase applies migrations inside a transaction, where
-- CREATE INDEX CONCURRENTLY is illegal. On a large live table, pre-build the index
-- concurrently out of band, then this statement becomes a no-op.

-- 1. Store keyset pagination: matches ByAppPage ORDER BY rating DESC, id ASC.
create index if not exists stores_app_rating_id_idx
  on directory.stores (app, rating desc, id asc);

-- 2. Vendor review pages: matches VendorReviewsPage ORDER BY created_at DESC, id ASC.
create index if not exists vendor_reviews_vendor_created_idx
  on reviews.vendor_reviews (vendor_id, created_at desc, id asc);

-- 3. Product reviews: bounds the unbounded ProductReviews scan (ORDER BY created_at DESC, id ASC).
create index if not exists reviews_product_created_idx
  on reviews.reviews (product_id, created_at desc, id asc);

-- 4. Rating-gate proof: covers PurchaseProof (a user's orders + vendor snapshot) without a heap fetch.
create index if not exists orders_user_vendor_cover_idx
  on checkout.orders (user_id) include (vendor_store_ids, placed_at);

-- 5. Cart sweep: supports sweep_stale_carts() without a sequential scan.
create index if not exists carts_updated_idx on inventory.carts (updated_at);

-- 6. Cart size guard (MVP keeps JSONB; a normalized cart_items table only wins past ~50 lines/cart).
alter table inventory.carts drop constraint if exists carts_items_max50;
alter table inventory.carts
  add constraint carts_items_max50 check (jsonb_array_length(items) <= 50);

-- 7. Account JSONB size guards: nav/details never become TOAST monsters.
alter table accounts.nav drop constraint if exists nav_rows_size;
alter table accounts.nav
  add constraint nav_rows_size check (octet_length("rows"::text) <= 8192);
alter table accounts.details drop constraint if exists details_data_size;
alter table accounts.details
  add constraint details_data_size check (octet_length(data::text) <= 8192);

-- 8. O(1) vendor rating summary — replaces a per-request GROUP BY over reviews.vendor_reviews.
--    The mobile client renders a 5-star distribution, so per-star counters are stored (not just
--    average/count). Kept separate from directory.stores.rating (that column is the fixture/catalog
--    rating and is also used for the /stores sort); the review aggregate is its own concern.
create table if not exists reviews.vendor_summary (
  vendor_id     text primary key,
  rating_sum    int8 not null default 0,
  reviews_count int8 not null default 0,
  star1         int4 not null default 0,
  star2         int4 not null default 0,
  star3         int4 not null default 0,
  star4         int4 not null default 0,
  star5         int4 not null default 0
);

create or replace function reviews.sync_vendor_summary()
returns trigger language plpgsql as $$
begin
  if (TG_OP = 'DELETE') then
    update reviews.vendor_summary set
      rating_sum    = rating_sum - OLD.rating,
      reviews_count = reviews_count - 1,
      star1 = star1 - (OLD.rating = 1)::int,
      star2 = star2 - (OLD.rating = 2)::int,
      star3 = star3 - (OLD.rating = 3)::int,
      star4 = star4 - (OLD.rating = 4)::int,
      star5 = star5 - (OLD.rating = 5)::int
    where vendor_id = OLD.vendor_id;
    return OLD;
  elsif (TG_OP = 'UPDATE') then
    update reviews.vendor_summary set
      rating_sum    = rating_sum - OLD.rating + NEW.rating,
      star1 = star1 - (OLD.rating = 1)::int + (NEW.rating = 1)::int,
      star2 = star2 - (OLD.rating = 2)::int + (NEW.rating = 2)::int,
      star3 = star3 - (OLD.rating = 3)::int + (NEW.rating = 3)::int,
      star4 = star4 - (OLD.rating = 4)::int + (NEW.rating = 4)::int,
      star5 = star5 - (OLD.rating = 5)::int + (NEW.rating = 5)::int
    where vendor_id = NEW.vendor_id;
    return NEW;
  end if;
  insert into reviews.vendor_summary
    (vendor_id, rating_sum, reviews_count, star1, star2, star3, star4, star5)
  values
    (NEW.vendor_id, NEW.rating, 1,
     (NEW.rating = 1)::int, (NEW.rating = 2)::int, (NEW.rating = 3)::int,
     (NEW.rating = 4)::int, (NEW.rating = 5)::int)
  on conflict (vendor_id) do update set
    rating_sum    = reviews.vendor_summary.rating_sum + NEW.rating,
    reviews_count = reviews.vendor_summary.reviews_count + 1,
    star1 = reviews.vendor_summary.star1 + (NEW.rating = 1)::int,
    star2 = reviews.vendor_summary.star2 + (NEW.rating = 2)::int,
    star3 = reviews.vendor_summary.star3 + (NEW.rating = 3)::int,
    star4 = reviews.vendor_summary.star4 + (NEW.rating = 4)::int,
    star5 = reviews.vendor_summary.star5 + (NEW.rating = 5)::int;
  return NEW;
end $$;

drop trigger if exists vendor_reviews_summary on reviews.vendor_reviews;
create trigger vendor_reviews_summary
  after insert or update or delete on reviews.vendor_reviews
  for each row execute function reviews.sync_vendor_summary();

-- Backfill from any rows that predate the trigger.
insert into reviews.vendor_summary
  (vendor_id, rating_sum, reviews_count, star1, star2, star3, star4, star5)
select vendor_id,
       sum(rating),
       count(*),
       count(*) filter (where rating = 1),
       count(*) filter (where rating = 2),
       count(*) filter (where rating = 3),
       count(*) filter (where rating = 4),
       count(*) filter (where rating = 5)
  from reviews.vendor_reviews
 group by vendor_id
on conflict (vendor_id) do nothing;