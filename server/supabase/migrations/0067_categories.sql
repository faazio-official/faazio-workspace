-- Faazio MVP — central category taxonomy (superadmin-owned).
-- Authority: docs/architecture/db-schema.md (categories section) and
-- docs/architecture/monolith-breakdown.md §1.
--
-- One parent/child tree for every sub-app (Mart, Food, Pharma). The superadmin portal is the only
-- writer (via the Go gateway, service_role); shoppers and sellers read. Ids are the legacy
-- `@data/categories/masterCategories.ts` ids (`cat_*` / `sg_*` / `sub_*`) so CATEGORY_TOP ad
-- targeting and the drill-in deep links stay stable; FOOD rows are new (restaurant categories).
-- Additive only (never rewrites 0001-0066). Idempotent: safe to re-run.

create schema if not exists taxonomy;

create table if not exists taxonomy.categories (
  id          text primary key,
  app         app_brand not null,
  name        text not null,
  slug        text not null,
  description text,
  icon_url    text,
  parent_id   text references taxonomy.categories (id),
  search_query text,
  is_active   boolean not null default true,
  sort_order  int8 not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  created_by  text not null default 'system',
  updated_by  text
);

create index if not exists categories_app_idx on taxonomy.categories (app);
create index if not exists categories_parent_idx on taxonomy.categories (parent_id);
create index if not exists categories_active_idx on taxonomy.categories (is_active) where is_active;

-- RLS (Supabase only): gateway (service_role) writes; anon/authenticated read active rows.
do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'auth')
     and exists (select 1 from pg_roles where rolname = 'authenticated') then
    grant usage on schema taxonomy to anon, authenticated;
    grant select on taxonomy.categories to anon, authenticated;
    alter table taxonomy.categories enable row level security;
    drop policy if exists categories_public_read on taxonomy.categories;
    create policy categories_public_read on taxonomy.categories
      for select to anon, authenticated using (is_active = true);
  end if;
end $$;

-- A seller (restaurant included) may pick one taxonomy category within its app brand. Nullable and
-- additive: legacy sellers keep only their `category` app_brand, and validation happens at write time.
alter table sellers.sellers
  add column if not exists seller_category_id text references taxonomy.categories (id);
create index if not exists sellers_category_id_idx on sellers.sellers (seller_category_id);

-- ---------------------------------------------------------------- seed (idempotent)
-- Initial superadmin taxonomy: the former MASTER_CATEGORIES tree plus the new FOOD
-- restaurant categories. on conflict (id) do nothing keeps re-runs and portal edits safe.

insert into taxonomy.categories
  (id, app, name, slug, parent_id, icon_url, search_query, sort_order)
values
  ('cat_smart_gadgets', 'MART'::app_brand, 'Smart Gadgets', 'seed-smart-gadgets', null, 'https://img.icons8.com/color/96/apple-watch-apps.png', null, 0),
  ('sg_audio', 'MART'::app_brand, 'Headphones & Speakers', 'seed-headphones-and-speakers', 'cat_smart_gadgets', null, null, 1),
  ('sub_bt_head', 'MART'::app_brand, 'Bluetooth Headphones', 'seed-bluetooth-headphones', 'sg_audio', null, 'Bluetooth Headphones', 2),
  ('sub_neck', 'MART'::app_brand, 'Neckbands', 'seed-neckbands', 'sg_audio', null, 'Neckbands', 3),
  ('sub_party', 'MART'::app_brand, 'Party Speakers', 'seed-party-speakers', 'sg_audio', null, 'Party Speakers', 4),
  ('sub_soundbar', 'MART'::app_brand, 'Soundbars', 'seed-soundbars', 'sg_audio', null, 'Soundbar', 5),
  ('sub_mobile_spk', 'MART'::app_brand, 'Mobile speakers', 'seed-mobile-speakers', 'sg_audio', null, 'Portable Bluetooth Speaker', 6),
  ('sub_wired', 'MART'::app_brand, 'Wired Earphones', 'seed-wired-earphones', 'sg_audio', null, 'Wired Earphones', 7),
  ('sub_tws', 'MART'::app_brand, 'TWS Earbuds', 'seed-tws-earbuds', 'sg_audio', null, 'TWS Earbuds', 8),
  ('sg_wearables', 'MART'::app_brand, 'Smart Wearables', 'seed-smart-wearables', 'cat_smart_gadgets', null, null, 9),
  ('sub_bands', 'MART'::app_brand, 'Smart Bands', 'seed-smart-bands', 'sg_wearables', null, 'Smart Fitness Band', 10),
  ('sub_rings', 'MART'::app_brand, 'Smart Rings', 'seed-smart-rings', 'sg_wearables', null, 'Smart Ring', 11),
  ('sub_tags', 'MART'::app_brand, 'Smart Tags', 'seed-smart-tags', 'sg_wearables', null, 'Smart Tracker Tag', 12),
  ('sub_call_watch', 'MART'::app_brand, 'Bluetooth Calling', 'seed-bluetooth-calling', 'sg_wearables', null, 'Bluetooth Calling Smartwatch', 13),
  ('sub_amoled', 'MART'::app_brand, 'AMOLED Display', 'seed-amoled-display', 'sg_wearables', null, 'AMOLED Smartwatch', 14),
  ('sub_square', 'MART'::app_brand, 'Square Smartwatches', 'seed-square-smartwatches', 'sg_wearables', null, 'Square Dial Smartwatch', 15),
  ('cat_mobiles', 'MART'::app_brand, 'Mobiles & Tablets', 'seed-mobiles-and-tablets', null, 'https://img.icons8.com/color/96/smartphone.png', null, 16),
  ('sg_phones', 'MART'::app_brand, 'Smartphones', 'seed-smartphones', 'cat_mobiles', null, null, 17),
  ('sub_android', 'MART'::app_brand, 'Android Phones', 'seed-android-phones', 'sg_phones', null, 'Android Smartphone', 18),
  ('sub_iphone', 'MART'::app_brand, 'iPhones', 'seed-iphones', 'sg_phones', null, 'iPhone', 19),
  ('sub_5g', 'MART'::app_brand, '5G Phones', 'seed-5g-phones', 'sg_phones', null, '5G Mobile', 20),
  ('sub_gaming', 'MART'::app_brand, 'Gaming Phones', 'seed-gaming-phones', 'sg_phones', null, 'Gaming Phone', 21),
  ('sub_rugged', 'MART'::app_brand, 'Rugged Phones', 'seed-rugged-phones', 'sg_phones', null, 'Rugged Smartphone', 22),
  ('sub_fold', 'MART'::app_brand, 'Foldables', 'seed-foldables', 'sg_phones', null, 'Foldable Phone', 23),
  ('sg_tablets', 'MART'::app_brand, 'Tablets', 'seed-tablets', 'cat_mobiles', null, null, 24),
  ('sub_ipad', 'MART'::app_brand, 'iPads', 'seed-ipads', 'sg_tablets', null, 'iPad', 25),
  ('sub_android_tab', 'MART'::app_brand, 'Android Tablets', 'seed-android-tablets', 'sg_tablets', null, 'Android Tablet', 26),
  ('sub_pen_tab', 'MART'::app_brand, 'Stylus Tablets', 'seed-stylus-tablets', 'sg_tablets', null, 'Stylus Tablet', 27),
  ('cat_electronics', 'MART'::app_brand, 'Electronics', 'seed-electronics', null, 'https://img.icons8.com/color/96/tv.png', null, 28),
  ('sg_tv', 'MART'::app_brand, 'Televisions', 'seed-televisions', 'cat_electronics', null, null, 29),
  ('sub_oled_tv', 'MART'::app_brand, 'OLED TVs', 'seed-oled-tvs', 'sg_tv', null, 'OLED TV', 30),
  ('sub_qled', 'MART'::app_brand, 'QLED TVs', 'seed-qled-tvs', 'sg_tv', null, 'QLED TV', 31),
  ('sub_4k', 'MART'::app_brand, '4K Smart TVs', 'seed-4k-smart-tvs', 'sg_tv', null, '4K Smart TV', 32),
  ('sub_soundbars_tv', 'MART'::app_brand, 'TV Soundbars', 'seed-tv-soundbars', 'sg_tv', null, 'TV Soundbar', 33),
  ('sub_stream', 'MART'::app_brand, 'Streaming Sticks', 'seed-streaming-sticks', 'sg_tv', null, 'Streaming Device', 34),
  ('sg_laptops', 'MART'::app_brand, 'Laptops & Desktops', 'seed-laptops-and-desktops', 'cat_electronics', null, null, 35),
  ('sub_ultrabook', 'MART'::app_brand, 'Ultrabooks', 'seed-ultrabooks', 'sg_laptops', null, 'Ultrabook Laptop', 36),
  ('sub_gaming_lap', 'MART'::app_brand, 'Gaming Laptops', 'seed-gaming-laptops', 'sg_laptops', null, 'Gaming Laptop', 37),
  ('sub_2in1', 'MART'::app_brand, '2-in-1 Laptops', 'seed-2-in-1-laptops', 'sg_laptops', null, '2 in 1 Laptop', 38),
  ('sub_desktop', 'MART'::app_brand, 'Desktop PCs', 'seed-desktop-pcs', 'sg_laptops', null, 'Desktop Computer', 39),
  ('sub_monitor', 'MART'::app_brand, 'Monitors', 'seed-monitors', 'sg_laptops', null, 'Monitor', 40),
  ('cat_fashion', 'MART'::app_brand, 'Fashion', 'seed-fashion', null, 'https://img.icons8.com/color/96/t-shirt.png', null, 41),
  ('sg_men', 'MART'::app_brand, 'Men', 'seed-men', 'cat_fashion', null, null, 42),
  ('sub_tshirts', 'MART'::app_brand, 'T-Shirts', 'seed-t-shirts', 'sg_men', null, 'Men T-Shirts', 43),
  ('sub_shirts', 'MART'::app_brand, 'Shirts', 'seed-shirts', 'sg_men', null, 'Men Shirts', 44),
  ('sub_jeans', 'MART'::app_brand, 'Jeans', 'seed-jeans', 'sg_men', null, 'Men Jeans', 45),
  ('sub_sneakers', 'MART'::app_brand, 'Sneakers', 'seed-sneakers', 'sg_men', null, 'Sneakers', 46),
  ('sub_watches', 'MART'::app_brand, 'Watches', 'seed-watches', 'sg_men', null, 'Men Watch', 47),
  ('sg_women', 'MART'::app_brand, 'Women', 'seed-women', 'cat_fashion', null, null, 48),
  ('sub_kurtas', 'MART'::app_brand, 'Kurtas', 'seed-kurtas', 'sg_women', null, 'Women Kurtas', 49),
  ('sub_dresses', 'MART'::app_brand, 'Dresses', 'seed-dresses', 'sg_women', null, 'Women Dresses', 50),
  ('sub_handbags', 'MART'::app_brand, 'Handbags', 'seed-handbags', 'sg_women', null, 'Women Handbags', 51),
  ('sub_heels', 'MART'::app_brand, 'Heels', 'seed-heels', 'sg_women', null, 'Women Heels', 52),
  ('sub_jewellery', 'MART'::app_brand, 'Jewellery', 'seed-jewellery', 'sg_women', null, 'Women Jewellery', 53),
  ('cat_home', 'MART'::app_brand, 'Home & Kitchen', 'seed-home-and-kitchen', null, 'https://img.icons8.com/color/96/kitchen.png', null, 54),
  ('sg_small_appliances', 'MART'::app_brand, 'Small Appliances', 'seed-small-appliances', 'cat_home', null, null, 55),
  ('sub_mixers', 'MART'::app_brand, 'Mixer Grinders', 'seed-mixer-grinders', 'sg_small_appliances', null, 'Mixer Grinder', 56),
  ('sub_toasters', 'MART'::app_brand, 'Toasters', 'seed-toasters', 'sg_small_appliances', null, 'Toaster', 57),
  ('sub_induction', 'MART'::app_brand, 'Induction Cooktops', 'seed-induction-cooktops', 'sg_small_appliances', null, 'Induction Cooktop', 58),
  ('sub_kettles', 'MART'::app_brand, 'Electric Kettles', 'seed-electric-kettles', 'sg_small_appliances', null, 'Electric Kettle', 59),
  ('sub_irons', 'MART'::app_brand, 'Irons', 'seed-irons', 'sg_small_appliances', null, 'Clothes Iron', 60),
  ('sg_furniture', 'MART'::app_brand, 'Furniture', 'seed-furniture', 'cat_home', null, null, 61),
  ('sub_sofas', 'MART'::app_brand, 'Sofas', 'seed-sofas', 'sg_furniture', null, 'Sofa', 62),
  ('sub_tables', 'MART'::app_brand, 'Coffee Tables', 'seed-coffee-tables', 'sg_furniture', null, 'Coffee Table', 63),
  ('sub_lamps', 'MART'::app_brand, 'Lamps', 'seed-lamps', 'sg_furniture', null, 'Floor Lamp', 64),
  ('sub_storage', 'MART'::app_brand, 'Storage Racks', 'seed-storage-racks', 'sg_furniture', null, 'Storage Rack', 65),
  ('cat_fruits_veg', 'MART'::app_brand, 'Fruits & Veggies', 'seed-fruits-and-veggies', null, 'https://img.icons8.com/color/96/vegetables.png', null, 66),
  ('sg_fruits', 'MART'::app_brand, 'Fresh Fruits', 'seed-fresh-fruits', 'cat_fruits_veg', null, null, 67),
  ('sub_apples', 'MART'::app_brand, 'Apples', 'seed-apples', 'sg_fruits', null, 'Fresh Apples', 68),
  ('sub_bananas', 'MART'::app_brand, 'Bananas', 'seed-bananas', 'sg_fruits', null, 'Bananas', 69),
  ('sub_mangoes', 'MART'::app_brand, 'Mangoes', 'seed-mangoes', 'sg_fruits', null, 'Alphonso Mango', 70),
  ('sub_oranges', 'MART'::app_brand, 'Oranges', 'seed-oranges', 'sg_fruits', null, 'Oranges', 71),
  ('sub_grapes', 'MART'::app_brand, 'Grapes', 'seed-grapes', 'sg_fruits', null, 'Fresh Grapes', 72),
  ('sub_strawberry', 'MART'::app_brand, 'Strawberries', 'seed-strawberries', 'sg_fruits', null, 'Strawberries', 73),
  ('sub_pomegranate', 'MART'::app_brand, 'Pomegranate', 'seed-pomegranate', 'sg_fruits', null, 'Pomegranate', 74),
  ('sg_veg', 'MART'::app_brand, 'Fresh Vegetables', 'seed-fresh-vegetables', 'cat_fruits_veg', null, null, 75),
  ('sub_onion', 'MART'::app_brand, 'Onions', 'seed-onions', 'sg_veg', null, 'Onions', 76),
  ('sub_tomato', 'MART'::app_brand, 'Tomatoes', 'seed-tomatoes', 'sg_veg', null, 'Tomatoes', 77),
  ('sub_potato', 'MART'::app_brand, 'Potatoes', 'seed-potatoes', 'sg_veg', null, 'Potatoes', 78),
  ('sub_carrot', 'MART'::app_brand, 'Carrots', 'seed-carrots', 'sg_veg', null, 'Carrots', 79),
  ('sub_peppers', 'MART'::app_brand, 'Bell Peppers', 'seed-bell-peppers', 'sg_veg', null, 'Bell Pepper', 80),
  ('cat_dairy', 'MART'::app_brand, 'Dairy & Eggs', 'seed-dairy-and-eggs', null, 'https://img.icons8.com/color/96/milk-carton.png', null, 81),
  ('sg_milk', 'MART'::app_brand, 'Milk & Curd', 'seed-milk-and-curd', 'cat_dairy', null, null, 82),
  ('sub_milk', 'MART'::app_brand, 'Fresh Milk', 'seed-fresh-milk', 'sg_milk', null, 'Fresh Milk', 83),
  ('sub_curd', 'MART'::app_brand, 'Curd', 'seed-curd', 'sg_milk', null, 'Curd', 84),
  ('sub_paneer', 'MART'::app_brand, 'Paneer', 'seed-paneer', 'sg_milk', null, 'Fresh Paneer', 85),
  ('sub_butter', 'MART'::app_brand, 'Butter', 'seed-butter', 'sg_milk', null, 'Butter', 86),
  ('sub_cheese', 'MART'::app_brand, 'Cheese', 'seed-cheese', 'sg_milk', null, 'Cheese', 87),
  ('sub_eggs', 'MART'::app_brand, 'Eggs', 'seed-eggs', 'sg_milk', null, 'Farm Eggs', 88),
  ('cat_snacks', 'MART'::app_brand, 'Snacks & Beverages', 'seed-snacks-and-beverages', null, 'https://img.icons8.com/color/96/biscuit.png', null, 89),
  ('sg_snacks', 'MART'::app_brand, 'Snacks & Biscuits', 'seed-snacks-and-biscuits', 'cat_snacks', null, null, 90),
  ('sub_biscuits', 'MART'::app_brand, 'Biscuits', 'seed-biscuits', 'sg_snacks', null, 'Biscuits', 91),
  ('sub_chips', 'MART'::app_brand, 'Chips', 'seed-chips', 'sg_snacks', null, 'Potato Chips', 92),
  ('sub_namkeen', 'MART'::app_brand, 'Namkeen', 'seed-namkeen', 'sg_snacks', null, 'Namkeen', 93),
  ('sub_choco', 'MART'::app_brand, 'Chocolates', 'seed-chocolates', 'sg_snacks', null, 'Chocolates', 94),
  ('sub_nuts', 'MART'::app_brand, 'Dry Fruits & Nuts', 'seed-dry-fruits-and-nuts', 'sg_snacks', null, 'Dry Fruits', 95),
  ('sg_beverages', 'MART'::app_brand, 'Beverages', 'seed-beverages', 'cat_snacks', null, null, 96),
  ('sub_tea', 'MART'::app_brand, 'Tea', 'seed-tea', 'sg_beverages', null, 'Tea', 97),
  ('sub_coffee', 'MART'::app_brand, 'Coffee', 'seed-coffee', 'sg_beverages', null, 'Coffee Powder', 98),
  ('sub_juice', 'MART'::app_brand, 'Fruit Juices', 'seed-fruit-juices', 'sg_beverages', null, 'Fruit Juice', 99),
  ('sub_soda', 'MART'::app_brand, 'Soft Drinks', 'seed-soft-drinks', 'sg_beverages', null, 'Soft Drink', 100),
  ('sub_water', 'MART'::app_brand, 'Water & Energy', 'seed-water-and-energy', 'sg_beverages', null, 'Packaged Water', 101),
  ('cat_grains', 'MART'::app_brand, 'Grains & Staples', 'seed-grains-and-staples', null, 'https://img.icons8.com/color/96/wheat.png', null, 102),
  ('sg_rice', 'MART'::app_brand, 'Rice & Flour', 'seed-rice-and-flour', 'cat_grains', null, null, 103),
  ('sub_basmati', 'MART'::app_brand, 'Basmati Rice', 'seed-basmati-rice', 'sg_rice', null, 'Basmati Rice', 104),
  ('sub_atta', 'MART'::app_brand, 'Wheat Atta', 'seed-wheat-atta', 'sg_rice', null, 'Wheat Atta', 105),
  ('sub_dal', 'MART'::app_brand, 'Dals & Pulses', 'seed-dals-and-pulses', 'sg_rice', null, 'Dals', 106),
  ('sub_oils', 'MART'::app_brand, 'Cooking Oils', 'seed-cooking-oils', 'sg_rice', null, 'Cooking Oil', 107),
  ('sub_sugar', 'MART'::app_brand, 'Sugar & Salt', 'seed-sugar-and-salt', 'sg_rice', null, 'Sugar', 108),
  ('sub_spices', 'MART'::app_brand, 'Spices', 'seed-spices', 'sg_rice', null, 'Spices', 109),
  ('cat_medicines', 'PHARMA'::app_brand, 'Medicines & Rx', 'seed-medicines-and-rx', null, 'https://img.icons8.com/color/96/pill.png', null, 110),
  ('sg_pain_fever', 'PHARMA'::app_brand, 'Pain & Fever Relief', 'seed-pain-and-fever-relief', 'cat_medicines', null, null, 111),
  ('sub_paracetamol', 'PHARMA'::app_brand, 'Paracetamol', 'seed-paracetamol', 'sg_pain_fever', null, 'Paracetamol', 112),
  ('sub_ibuprofen', 'PHARMA'::app_brand, 'Ibuprofen', 'seed-ibuprofen', 'sg_pain_fever', null, 'Ibuprofen', 113),
  ('sub_pain_balm', 'PHARMA'::app_brand, 'Pain Balms', 'seed-pain-balms', 'sg_pain_fever', null, 'Pain Balm', 114),
  ('sub_cough', 'PHARMA'::app_brand, 'Cough Syrups', 'seed-cough-syrups', 'sg_pain_fever', null, 'Cough Syrup', 115),
  ('sub_antacid', 'PHARMA'::app_brand, 'Antacids', 'seed-antacids', 'sg_pain_fever', null, 'Antacid', 116),
  ('sub_ayurvedic', 'PHARMA'::app_brand, 'Ayurvedic Relief', 'seed-ayurvedic-relief', 'sg_pain_fever', null, 'Ayurvedic Medicine', 117),
  ('sg_cold', 'PHARMA'::app_brand, 'Cold & Allergy', 'seed-cold-and-allergy', 'cat_medicines', null, null, 118),
  ('sub_antihist', 'PHARMA'::app_brand, 'Antihistamines', 'seed-antihistamines', 'sg_cold', null, 'Antihistamine', 119),
  ('sub_vit_c', 'PHARMA'::app_brand, 'Vitamin C', 'seed-vitamin-c', 'sg_cold', null, 'Vitamin C', 120),
  ('sub_lozenges', 'PHARMA'::app_brand, 'Throat Lozenges', 'seed-throat-lozenges', 'sg_cold', null, 'Throat Lozenges', 121),
  ('sub_salinet', 'PHARMA'::app_brand, 'Saline Nasal Drops', 'seed-saline-nasal-drops', 'sg_cold', null, 'Saline Nasal Spray', 122),
  ('cat_devices', 'PHARMA'::app_brand, 'Medical Devices', 'seed-medical-devices', null, 'https://img.icons8.com/color/96/stethoscope.png', null, 123),
  ('sg_monitors', 'PHARMA'::app_brand, 'Health Monitors', 'seed-health-monitors', 'cat_devices', null, null, 124),
  ('sub_bp', 'PHARMA'::app_brand, 'BP Monitors', 'seed-bp-monitors', 'sg_monitors', null, 'BP Monitor', 125),
  ('sub_glucometer', 'PHARMA'::app_brand, 'Glucometers', 'seed-glucometers', 'sg_monitors', null, 'Glucometer', 126),
  ('sub_oximeter', 'PHARMA'::app_brand, 'Pulse Oximeters', 'seed-pulse-oximeters', 'sg_monitors', null, 'Pulse Oximeter', 127),
  ('sub_thermo', 'PHARMA'::app_brand, 'Thermometers', 'seed-thermometers', 'sg_monitors', null, 'Digital Thermometer', 128),
  ('sub_neb', 'PHARMA'::app_brand, 'Nebulizers', 'seed-nebulizers', 'sg_monitors', null, 'Nebulizer', 129),
  ('sub_inhaler', 'PHARMA'::app_brand, 'Inhalers', 'seed-inhalers', 'sg_monitors', null, 'Inhaler', 130),
  ('cat_vitamins', 'PHARMA'::app_brand, 'Vitamins & Supplements', 'seed-vitamins-and-supplements', null, 'https://img.icons8.com/color/96/vitamin.png', null, 131),
  ('sg_supplements', 'PHARMA'::app_brand, 'Daily Supplements', 'seed-daily-supplements', 'cat_vitamins', null, null, 132),
  ('sub_multivit', 'PHARMA'::app_brand, 'Multivitamins', 'seed-multivitamins', 'sg_supplements', null, 'Multivitamin', 133),
  ('sub_omega', 'PHARMA'::app_brand, 'Omega 3', 'seed-omega-3', 'sg_supplements', null, 'Omega 3 Fish Oil', 134),
  ('sub_calcium', 'PHARMA'::app_brand, 'Calcium', 'seed-calcium', 'sg_supplements', null, 'Calcium Supplements', 135),
  ('sub_protein', 'PHARMA'::app_brand, 'Protein Powders', 'seed-protein-powders', 'sg_supplements', null, 'Protein Powder', 136),
  ('sub_magnesium', 'PHARMA'::app_brand, 'Magnesium', 'seed-magnesium', 'sg_supplements', null, 'Magnesium Supplement', 137),
  ('cat_personal_care', 'PHARMA'::app_brand, 'Personal Care', 'seed-personal-care', null, 'https://img.icons8.com/color/96/soap.png', null, 138),
  ('sg_skin', 'PHARMA'::app_brand, 'Skin & First Aid', 'seed-skin-and-first-aid', 'cat_personal_care', null, null, 139),
  ('sub_bandages', 'PHARMA'::app_brand, 'Bandages & Plasters', 'seed-bandages-and-plasters', 'sg_skin', null, 'Bandage', 140),
  ('sub_antiseptic', 'PHARMA'::app_brand, 'Antiseptics', 'seed-antiseptics', 'sg_skin', null, 'Antiseptic Cream', 141),
  ('sub_moisturizer', 'PHARMA'::app_brand, 'Moisturizers', 'seed-moisturizers', 'sg_skin', null, 'Moisturizer', 142),
  ('sub_sunscreen', 'PHARMA'::app_brand, 'Sunscreens', 'seed-sunscreens', 'sg_skin', null, 'Sunscreen', 143),
  ('sub_handwash', 'PHARMA'::app_brand, 'Handwash', 'seed-handwash', 'sg_skin', null, 'Handwash', 144),
  ('sub_oraltab', 'PHARMA'::app_brand, 'Oral Care', 'seed-oral-care', 'sg_skin', null, 'Toothpaste', 145),
  ('cat_north_indian', 'FOOD'::app_brand, 'North Indian', 'seed-north-indian', null, '🍛', null, 146),
  ('cat_south_indian', 'FOOD'::app_brand, 'South Indian', 'seed-south-indian', null, '🥘', null, 147),
  ('cat_chinese', 'FOOD'::app_brand, 'Chinese', 'seed-chinese', null, '🥡', null, 148),
  ('cat_bakery', 'FOOD'::app_brand, 'Bakery', 'seed-bakery', null, '🧁', null, 149),
  ('cat_cafe', 'FOOD'::app_brand, 'Cafe', 'seed-cafe', null, '☕', null, 150),
  ('cat_fast_food', 'FOOD'::app_brand, 'Fast Food', 'seed-fast-food', null, '🍔', null, 151),
  ('cat_desserts', 'FOOD'::app_brand, 'Desserts', 'seed-desserts', null, '🍰', null, 152)
on conflict (id) do nothing;
