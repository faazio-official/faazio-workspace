-- Faazio — FOOD master data import from the catalogue workbook (migration 0145).
--
-- Authority: docs/architecture/db-schema.md §12.4/§12.30, docs/architecture/monolith-breakdown.md §1,
-- docs/user-interaction-workflow/seller/web-portal/{super-admin-categories,menu-creation}.md.
--
-- Why: the approved `food_video_catalog_master_data` workbook defines the full FOOD catalogue —
-- 147 atomic cuisine sub-categories, the 24 carousel → atomic mappings, the store onboarding config
-- set, the Ice Cream / Shake / Rolls dynamic forms and 15 generated sample dishes. Only the carousel
-- roots and a partial facet set were seeded before (0139/0140/0143). This migration stores the
-- remaining reference master data in the database so the portal and apps read one authority instead
-- of a spreadsheet or hand-maintained copy.
--
-- Scope:
--   * taxonomy.food_atomic_taxonomy   — the 147-row Atomic Food Taxonomy v2 reference (app/category/
--                                       sub-category + GST slab), the cuisine layer behind the
--                                       carousel categories.
--   * taxonomy.categories             — new atomic_category / atomic_subcategory mapping columns.
--   * taxonomy.store_config_options   — the 11 store-onboarding config rules (schedule, dietary
--                                       policy, trust filters, delivery offers).
--   * taxonomy.food_sample_menu_items — the 15 generated sample dishes (templates, not live menus).
--   * Rolls facet fix                 — a separate Sauce group (Mayonnaise / Makhani) split out of
--                                       Ingredient, matching the workbook.
--   * live FOOD menu remap            — correct the over-loaded `sub-chicken` bucket by name so the
--                                       customer category rails are not empty / mis-tagged.
--
-- Idempotent: fixed ids + INSERT ... ON CONFLICT DO UPDATE/NOTHING; the remap pass is safe to re-run.
-- Additive. Apply from a dev terminal via server/supabase/apply-migration.sh per
-- docs/RUNBOOKS/DATABASE_MIGRATIONS.md. Never auto-run on Render.

begin;

-- ---------------------------------------------------------------- 1. atomic food taxonomy
create table if not exists taxonomy.food_atomic_taxonomy (
  id               text primary key,
  app              app_brand not null default 'FOOD',
  record_type      text not null default 'Food Taxonomy',
  category         text not null,
  sub_category     text not null,
  gst_category_name text not null default 'Food & Beverage (all food)',
  gst_slug         text not null default 'gst-food-standard',
  gst_rate_pct     smallint not null default 5,
  gst_rule_status  text not null default 'Active',
  display_order    int not null default 0,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (app, record_type, category, sub_category)
);
create index if not exists food_atomic_taxonomy_cat_idx
  on taxonomy.food_atomic_taxonomy (app, category, display_order);

insert into taxonomy.food_atomic_taxonomy
  (id, app, record_type, category, sub_category, gst_category_name, gst_slug, gst_rate_pct, gst_rule_status)
values
  ('south-indian--chettinad-cuisine','FOOD','Food Taxonomy','South Indian','Chettinad Cuisine','Food & Beverage (all food)','gst-food-standard',5,'Active'),
  ('south-indian--kongunadu-cuisine','FOOD','Food Taxonomy','South Indian','Kongunadu Cuisine','Food & Beverage (all food)','gst-food-standard',5,'Active'),
  ('south-indian--madurai-mess-cuisine','FOOD','Food Taxonomy','South Indian','Madurai Mess Cuisine','Food & Beverage (all food)','gst-food-standard',5,'Active'),
  ('south-indian--tamil-tiffin','FOOD','Food Taxonomy','South Indian','Tamil Tiffin','Food & Beverage (all food)','gst-food-standard',5,'Active'),
  ('south-indian--malabar-cuisine','FOOD','Food Taxonomy','South Indian','Malabar Cuisine','Food & Beverage (all food)','gst-food-standard',5,'Active'),
  ('south-indian--kerala-sadhya','FOOD','Food Taxonomy','South Indian','Kerala Sadhya','Food & Beverage (all food)','gst-food-standard',5,'Active'),
  ('south-indian--udupi-cuisine','FOOD','Food Taxonomy','South Indian','Udupi Cuisine','Food & Beverage (all food)','gst-food-standard',5,'Active'),
  ('south-indian--mangalorean-cuisine','FOOD','Food Taxonomy','South Indian','Mangalorean Cuisine','Food & Beverage (all food)','gst-food-standard',5,'Active'),
  ('south-indian--bengaluru-darshini','FOOD','Food Taxonomy','South Indian','Bengaluru Darshini','Food & Beverage (all food)','gst-food-standard',5,'Active'),
  ('south-indian--coorgi-cuisine','FOOD','Food Taxonomy','South Indian','Coorgi Cuisine','Food & Beverage (all food)','gst-food-standard',5,'Active'),
  ('south-indian--north-karnataka-cuisine','FOOD','Food Taxonomy','South Indian','North Karnataka Cuisine','Food & Beverage (all food)','gst-food-standard',5,'Active'),
  ('south-indian--rayalaseema-cuisine','FOOD','Food Taxonomy','South Indian','Rayalaseema Cuisine','Food & Beverage (all food)','gst-food-standard',5,'Active'),
  ('south-indian--coastal-andhra-cuisine','FOOD','Food Taxonomy','South Indian','Coastal Andhra Cuisine','Food & Beverage (all food)','gst-food-standard',5,'Active'),
  ('south-indian--hyderabadi-cuisine','FOOD','Food Taxonomy','South Indian','Hyderabadi Cuisine','Food & Beverage (all food)','gst-food-standard',5,'Active'),
  ('north-indian--punjabi-cuisine','FOOD','Food Taxonomy','North Indian','Punjabi Cuisine','Food & Beverage (all food)','gst-food-standard',5,'Active'),
  ('north-indian--tandoori-cuisine','FOOD','Food Taxonomy','North Indian','Tandoori Cuisine','Food & Beverage (all food)','gst-food-standard',5,'Active'),
  ('north-indian--mughlai-cuisine','FOOD','Food Taxonomy','North Indian','Mughlai Cuisine','Food & Beverage (all food)','gst-food-standard',5,'Active'),
  ('north-indian--awadhi-cuisine','FOOD','Food Taxonomy','North Indian','Awadhi Cuisine','Food & Beverage (all food)','gst-food-standard',5,'Active'),
  ('north-indian--rajasthani-cuisine','FOOD','Food Taxonomy','North Indian','Rajasthani Cuisine','Food & Beverage (all food)','gst-food-standard',5,'Active'),
  ('north-indian--kashmiri-wazwan','FOOD','Food Taxonomy','North Indian','Kashmiri Wazwan','Food & Beverage (all food)','gst-food-standard',5,'Active'),
  ('north-indian--bihari-cuisine','FOOD','Food Taxonomy','North Indian','Bihari Cuisine','Food & Beverage (all food)','gst-food-standard',5,'Active'),
  ('north-indian--banarasi-cuisine','FOOD','Food Taxonomy','North Indian','Banarasi Cuisine','Food & Beverage (all food)','gst-food-standard',5,'Active'),
  ('north-indian--uttarakhand-pahadi-cuisine','FOOD','Food Taxonomy','North Indian','Uttarakhand Pahadi Cuisine','Food & Beverage (all food)','gst-food-standard',5,'Active'),
  ('north-indian--himachali-dham','FOOD','Food Taxonomy','North Indian','Himachali Dham','Food & Beverage (all food)','gst-food-standard',5,'Active'),
  ('north-indian--haryanvi-dhaba-cuisine','FOOD','Food Taxonomy','North Indian','Haryanvi Dhaba Cuisine','Food & Beverage (all food)','gst-food-standard',5,'Active'),
  ('west-indian--gujarati-thali','FOOD','Food Taxonomy','West Indian','Gujarati Thali','Food & Beverage (all food)','gst-food-standard',5,'Active'),
  ('west-indian--kathiyawadi-cuisine','FOOD','Food Taxonomy','West Indian','Kathiyawadi Cuisine','Food & Beverage (all food)','gst-food-standard',5,'Active'),
  ('west-indian--surti-cuisine','FOOD','Food Taxonomy','West Indian','Surti Cuisine','Food & Beverage (all food)','gst-food-standard',5,'Active'),
  ('west-indian--malvani-cuisine','FOOD','Food Taxonomy','West Indian','Malvani Cuisine','Food & Beverage (all food)','gst-food-standard',5,'Active'),
  ('west-indian--kolhapuri-cuisine','FOOD','Food Taxonomy','West Indian','Kolhapuri Cuisine','Food & Beverage (all food)','gst-food-standard',5,'Active'),
  ('west-indian--maharashtrian-cuisine','FOOD','Food Taxonomy','West Indian','Maharashtrian Cuisine','Food & Beverage (all food)','gst-food-standard',5,'Active'),
  ('west-indian--varhadi-saoji-cuisine','FOOD','Food Taxonomy','West Indian','Varhadi Saoji Cuisine','Food & Beverage (all food)','gst-food-standard',5,'Active'),
  ('west-indian--goan-cuisine','FOOD','Food Taxonomy','West Indian','Goan Cuisine','Food & Beverage (all food)','gst-food-standard',5,'Active'),
  ('central-indian--indori-cuisine','FOOD','Food Taxonomy','Central Indian','Indori Cuisine','Food & Beverage (all food)','gst-food-standard',5,'Active'),
  ('central-indian--chhattisgarhi-cuisine','FOOD','Food Taxonomy','Central Indian','Chhattisgarhi Cuisine','Food & Beverage (all food)','gst-food-standard',5,'Active'),
  ('east-indian--bengali-cuisine','FOOD','Food Taxonomy','East Indian','Bengali Cuisine','Food & Beverage (all food)','gst-food-standard',5,'Active'),
  ('east-indian--odia-cuisine','FOOD','Food Taxonomy','East Indian','Odia Cuisine','Food & Beverage (all food)','gst-food-standard',5,'Active'),
  ('north-east-indian--assamese-cuisine','FOOD','Food Taxonomy','North-East Indian','Assamese Cuisine','Food & Beverage (all food)','gst-food-standard',5,'Active'),
  ('north-east-indian--naga-cuisine','FOOD','Food Taxonomy','North-East Indian','Naga Cuisine','Food & Beverage (all food)','gst-food-standard',5,'Active'),
  ('north-east-indian--manipuri-cuisine','FOOD','Food Taxonomy','North-East Indian','Manipuri Cuisine','Food & Beverage (all food)','gst-food-standard',5,'Active'),
  ('north-east-indian--meghalayan-khasi-cuisine','FOOD','Food Taxonomy','North-East Indian','Meghalayan Khasi Cuisine','Food & Beverage (all food)','gst-food-standard',5,'Active'),
  ('north-east-indian--sikkimese-cuisine','FOOD','Food Taxonomy','North-East Indian','Sikkimese Cuisine','Food & Beverage (all food)','gst-food-standard',5,'Active'),
  ('north-east-indian--mizo-cuisine','FOOD','Food Taxonomy','North-East Indian','Mizo Cuisine','Food & Beverage (all food)','gst-food-standard',5,'Active'),
  ('biryani--hyderabadi-dum-biryani','FOOD','Food Taxonomy','Biryani','Hyderabadi Dum Biryani','Food & Beverage (all food)','gst-food-standard',5,'Active'),
  ('biryani--ambur-biryani','FOOD','Food Taxonomy','Biryani','Ambur Biryani','Food & Beverage (all food)','gst-food-standard',5,'Active'),
  ('biryani--dindigul-biryani','FOOD','Food Taxonomy','Biryani','Dindigul Biryani','Food & Beverage (all food)','gst-food-standard',5,'Active'),
  ('biryani--kolkata-biryani','FOOD','Food Taxonomy','Biryani','Kolkata Biryani','Food & Beverage (all food)','gst-food-standard',5,'Active'),
  ('biryani--thalassery-biryani','FOOD','Food Taxonomy','Biryani','Thalassery Biryani','Food & Beverage (all food)','gst-food-standard',5,'Active'),
  ('biryani--donne-biryani','FOOD','Food Taxonomy','Biryani','Donne Biryani','Food & Beverage (all food)','gst-food-standard',5,'Active'),
  ('biryani--bamboo-biryani','FOOD','Food Taxonomy','Biryani','Bamboo Biryani','Food & Beverage (all food)','gst-food-standard',5,'Active'),
  ('biryani--bucket-biryani','FOOD','Food Taxonomy','Biryani','Bucket Biryani','Food & Beverage (all food)','gst-food-standard',5,'Active'),
  ('biryani--lucknowi-pulao','FOOD','Food Taxonomy','Biryani','Lucknowi Pulao','Food & Beverage (all food)','gst-food-standard',5,'Active'),
  ('kebabs--seekh-kebab','FOOD','Food Taxonomy','Kebabs','Seekh Kebab','Food & Beverage (all food)','gst-food-standard',5,'Active'),
  ('kebabs--galouti-kebab','FOOD','Food Taxonomy','Kebabs','Galouti Kebab','Food & Beverage (all food)','gst-food-standard',5,'Active'),
  ('kebabs--chicken-tikka','FOOD','Food Taxonomy','Kebabs','Chicken Tikka','Food & Beverage (all food)','gst-food-standard',5,'Active'),
  ('kebabs--paneer-tikka','FOOD','Food Taxonomy','Kebabs','Paneer Tikka','Food & Beverage (all food)','gst-food-standard',5,'Active'),
  ('kebabs--shawarma','FOOD','Food Taxonomy','Kebabs','Shawarma','Food & Beverage (all food)','gst-food-standard',5,'Active'),
  ('kebabs--al-faham-chicken','FOOD','Food Taxonomy','Kebabs','Al-Faham Chicken','Food & Beverage (all food)','gst-food-standard',5,'Active'),
  ('street-food--pani-puri','FOOD','Food Taxonomy','Street Food','Pani Puri','Food & Beverage (all food)','gst-food-standard',5,'Active'),
  ('street-food--chaat','FOOD','Food Taxonomy','Street Food','Chaat','Food & Beverage (all food)','gst-food-standard',5,'Active'),
  ('street-food--samosa','FOOD','Food Taxonomy','Street Food','Samosa','Food & Beverage (all food)','gst-food-standard',5,'Active'),
  ('street-food--kachori','FOOD','Food Taxonomy','Street Food','Kachori','Food & Beverage (all food)','gst-food-standard',5,'Active'),
  ('street-food--pav-bhaji','FOOD','Food Taxonomy','Street Food','Pav Bhaji','Food & Beverage (all food)','gst-food-standard',5,'Active'),
  ('street-food--vada-pav','FOOD','Food Taxonomy','Street Food','Vada Pav','Food & Beverage (all food)','gst-food-standard',5,'Active'),
  ('street-food--dabeli','FOOD','Food Taxonomy','Street Food','Dabeli','Food & Beverage (all food)','gst-food-standard',5,'Active'),
  ('street-food--chole-bhature','FOOD','Food Taxonomy','Street Food','Chole Bhature','Food & Beverage (all food)','gst-food-standard',5,'Active'),
  ('street-food--kathi-roll','FOOD','Food Taxonomy','Street Food','Kathi Roll','Food & Beverage (all food)','gst-food-standard',5,'Active'),
  ('street-food--momos','FOOD','Food Taxonomy','Street Food','Momos','Food & Beverage (all food)','gst-food-standard',5,'Active'),
  ('street-food--bajji','FOOD','Food Taxonomy','Street Food','Bajji','Food & Beverage (all food)','gst-food-standard',5,'Active'),
  ('street-food--bonda','FOOD','Food Taxonomy','Street Food','Bonda','Food & Beverage (all food)','gst-food-standard',5,'Active'),
  ('street-food--omelette','FOOD','Food Taxonomy','Street Food','Omelette','Food & Beverage (all food)','gst-food-standard',5,'Active'),
  ('fast-food--pizza','FOOD','Food Taxonomy','Fast Food','Pizza','Food & Beverage (all food)','gst-food-standard',5,'Active'),
  ('fast-food--burger','FOOD','Food Taxonomy','Fast Food','Burger','Food & Beverage (all food)','gst-food-standard',5,'Active'),
  ('fast-food--fried-chicken','FOOD','Food Taxonomy','Fast Food','Fried Chicken','Food & Beverage (all food)','gst-food-standard',5,'Active'),
  ('fast-food--sandwich','FOOD','Food Taxonomy','Fast Food','Sandwich','Food & Beverage (all food)','gst-food-standard',5,'Active'),
  ('fast-food--wrap','FOOD','Food Taxonomy','Fast Food','Wrap','Food & Beverage (all food)','gst-food-standard',5,'Active'),
  ('fast-food--pasta','FOOD','Food Taxonomy','Fast Food','Pasta','Food & Beverage (all food)','gst-food-standard',5,'Active'),
  ('international--indo-chinese','FOOD','Food Taxonomy','International','Indo-Chinese','Food & Beverage (all food)','gst-food-standard',5,'Active'),
  ('international--japanese-sushi','FOOD','Food Taxonomy','International','Japanese Sushi','Food & Beverage (all food)','gst-food-standard',5,'Active'),
  ('international--korean-cuisine','FOOD','Food Taxonomy','International','Korean Cuisine','Food & Beverage (all food)','gst-food-standard',5,'Active'),
  ('international--thai-cuisine','FOOD','Food Taxonomy','International','Thai Cuisine','Food & Beverage (all food)','gst-food-standard',5,'Active'),
  ('international--mexican-cuisine','FOOD','Food Taxonomy','International','Mexican Cuisine','Food & Beverage (all food)','gst-food-standard',5,'Active'),
  ('international--arabian-mandi','FOOD','Food Taxonomy','International','Arabian Mandi','Food & Beverage (all food)','gst-food-standard',5,'Active'),
  ('international--continental-cuisine','FOOD','Food Taxonomy','International','Continental Cuisine','Food & Beverage (all food)','gst-food-standard',5,'Active'),
  ('bakery--birthday-cake','FOOD','Food Taxonomy','Bakery','Birthday Cake','Food & Beverage (all food)','gst-food-standard',5,'Active'),
  ('bakery--pastry','FOOD','Food Taxonomy','Bakery','Pastry','Food & Beverage (all food)','gst-food-standard',5,'Active'),
  ('bakery--brownie','FOOD','Food Taxonomy','Bakery','Brownie','Food & Beverage (all food)','gst-food-standard',5,'Active'),
  ('bakery--croissant','FOOD','Food Taxonomy','Bakery','Croissant','Food & Beverage (all food)','gst-food-standard',5,'Active'),
  ('bakery--veg-puff','FOOD','Food Taxonomy','Bakery','Veg Puff','Food & Beverage (all food)','gst-food-standard',5,'Active'),
  ('bakery--egg-puff','FOOD','Food Taxonomy','Bakery','Egg Puff','Food & Beverage (all food)','gst-food-standard',5,'Active'),
  ('bakery--chicken-puff','FOOD','Food Taxonomy','Bakery','Chicken Puff','Food & Beverage (all food)','gst-food-standard',5,'Active'),
  ('bakery--donut','FOOD','Food Taxonomy','Bakery','Donut','Food & Beverage (all food)','gst-food-standard',5,'Active'),
  ('bakery--waffle','FOOD','Food Taxonomy','Bakery','Waffle','Food & Beverage (all food)','gst-food-standard',5,'Active'),
  ('mithai--gulab-jamun','FOOD','Food Taxonomy','Mithai','Gulab Jamun','Food & Beverage (all food)','gst-food-standard',5,'Active'),
  ('mithai--jalebi','FOOD','Food Taxonomy','Mithai','Jalebi','Food & Beverage (all food)','gst-food-standard',5,'Active'),
  ('mithai--kaju-katli','FOOD','Food Taxonomy','Mithai','Kaju Katli','Food & Beverage (all food)','gst-food-standard',5,'Active'),
  ('mithai--rasgulla','FOOD','Food Taxonomy','Mithai','Rasgulla','Food & Beverage (all food)','gst-food-standard',5,'Active'),
  ('mithai--sandesh','FOOD','Food Taxonomy','Mithai','Sandesh','Food & Beverage (all food)','gst-food-standard',5,'Active'),
  ('mithai--mysore-pak','FOOD','Food Taxonomy','Mithai','Mysore Pak','Food & Beverage (all food)','gst-food-standard',5,'Active'),
  ('mithai--tirunelveli-halwa','FOOD','Food Taxonomy','Mithai','Tirunelveli Halwa','Food & Beverage (all food)','gst-food-standard',5,'Active'),
  ('desserts--ice-cream','FOOD','Food Taxonomy','Desserts','Ice Cream','Food & Beverage (all food)','gst-food-standard',5,'Active'),
  ('desserts--gelato','FOOD','Food Taxonomy','Desserts','Gelato','Food & Beverage (all food)','gst-food-standard',5,'Active'),
  ('desserts--kulfi','FOOD','Food Taxonomy','Desserts','Kulfi','Food & Beverage (all food)','gst-food-standard',5,'Active'),
  ('desserts--falooda','FOOD','Food Taxonomy','Desserts','Falooda','Food & Beverage (all food)','gst-food-standard',5,'Active'),
  ('cafe--filter-coffee','FOOD','Food Taxonomy','Cafe','Filter Coffee','Food & Beverage (all food)','gst-food-standard',5,'Active'),
  ('cafe--espresso-coffee','FOOD','Food Taxonomy','Cafe','Espresso Coffee','Food & Beverage (all food)','gst-food-standard',5,'Active'),
  ('cafe--masala-chai','FOOD','Food Taxonomy','Cafe','Masala Chai','Food & Beverage (all food)','gst-food-standard',5,'Active'),
  ('cafe--irani-chai','FOOD','Food Taxonomy','Cafe','Irani Chai','Food & Beverage (all food)','gst-food-standard',5,'Active'),
  ('cafe--bubble-tea','FOOD','Food Taxonomy','Cafe','Bubble Tea','Food & Beverage (all food)','gst-food-standard',5,'Active'),
  ('cafe--fresh-fruit-juice','FOOD','Food Taxonomy','Cafe','Fresh Fruit Juice','Food & Beverage (all food)','gst-food-standard',5,'Active'),
  ('cafe--milkshake','FOOD','Food Taxonomy','Cafe','Milkshake','Food & Beverage (all food)','gst-food-standard',5,'Active'),
  ('cafe--smoothie','FOOD','Food Taxonomy','Cafe','Smoothie','Food & Beverage (all food)','gst-food-standard',5,'Active'),
  ('cafe--jigarthanda','FOOD','Food Taxonomy','Cafe','Jigarthanda','Food & Beverage (all food)','gst-food-standard',5,'Active'),
  ('cafe--sweet-paan','FOOD','Food Taxonomy','Cafe','Sweet Paan','Food & Beverage (all food)','gst-food-standard',5,'Active'),
  ('healthy-food--salad-bowl','FOOD','Food Taxonomy','Healthy Food','Salad Bowl','Food & Beverage (all food)','gst-food-standard',5,'Active'),
  ('healthy-food--keto-meal','FOOD','Food Taxonomy','Healthy Food','Keto Meal','Food & Beverage (all food)','gst-food-standard',5,'Active'),
  ('healthy-food--high-protein-meal','FOOD','Food Taxonomy','Healthy Food','High-Protein Meal','Food & Beverage (all food)','gst-food-standard',5,'Active'),
  ('healthy-food--millet-meal','FOOD','Food Taxonomy','Healthy Food','Millet Meal','Food & Beverage (all food)','gst-food-standard',5,'Active'),
  ('healthy-food--daily-tiffin-subscription','FOOD','Food Taxonomy','Healthy Food','Daily Tiffin Subscription','Food & Beverage (all food)','gst-food-standard',5,'Active'),
  ('restaurant-format--dine-in-restaurant','FOOD','Food Taxonomy','Restaurant Format','Dine-In Restaurant','Food & Beverage (all food)','gst-food-standard',5,'Active'),
  ('restaurant-format--quick-service-restaurant','FOOD','Food Taxonomy','Restaurant Format','Quick Service Restaurant','Food & Beverage (all food)','gst-food-standard',5,'Active'),
  ('restaurant-format--cloud-kitchen','FOOD','Food Taxonomy','Restaurant Format','Cloud Kitchen','Food & Beverage (all food)','gst-food-standard',5,'Active'),
  ('restaurant-format--virtual-multi-brand-kitchen','FOOD','Food Taxonomy','Restaurant Format','Virtual Multi-Brand Kitchen','Food & Beverage (all food)','gst-food-standard',5,'Active'),
  ('restaurant-format--mess-center','FOOD','Food Taxonomy','Restaurant Format','Mess Center','Food & Beverage (all food)','gst-food-standard',5,'Active'),
  ('restaurant-format--highway-dhaba','FOOD','Food Taxonomy','Restaurant Format','Highway Dhaba','Food & Beverage (all food)','gst-food-standard',5,'Active'),
  ('restaurant-format--food-truck','FOOD','Food Taxonomy','Restaurant Format','Food Truck','Food & Beverage (all food)','gst-food-standard',5,'Active'),
  ('restaurant-format--catering-kitchen','FOOD','Food Taxonomy','Restaurant Format','Catering Kitchen','Food & Beverage (all food)','gst-food-standard',5,'Active'),
  ('restaurant-format--fssai-home-chef','FOOD','Food Taxonomy','Restaurant Format','FSSAI Home Chef','Food & Beverage (all food)','gst-food-standard',5,'Active'),
  ('dietary-policy--100-pure-veg-kitchen','FOOD','Food Taxonomy','Dietary Policy','100% Pure Veg Kitchen','Food & Beverage (all food)','gst-food-standard',5,'Active'),
  ('dietary-policy--veg-plus-egg-kitchen','FOOD','Food Taxonomy','Dietary Policy','Veg Plus Egg Kitchen','Food & Beverage (all food)','gst-food-standard',5,'Active'),
  ('dietary-policy--non-veg-exclusive-kitchen','FOOD','Food Taxonomy','Dietary Policy','Non-Veg Exclusive Kitchen','Food & Beverage (all food)','gst-food-standard',5,'Active'),
  ('dietary-policy--mixed-shared-kitchen','FOOD','Food Taxonomy','Dietary Policy','Mixed Shared Kitchen','Food & Beverage (all food)','gst-food-standard',5,'Active'),
  ('dietary-policy--mixed-separate-fryers-kitchen','FOOD','Food Taxonomy','Dietary Policy','Mixed Separate Fryers Kitchen','Food & Beverage (all food)','gst-food-standard',5,'Active'),
  ('dietary-policy--jain-certified-kitchen','FOOD','Food Taxonomy','Dietary Policy','Jain Certified Kitchen','Food & Beverage (all food)','gst-food-standard',5,'Active'),
  ('dietary-policy--strict-jain-premises','FOOD','Food Taxonomy','Dietary Policy','Strict Jain Premises','Food & Beverage (all food)','gst-food-standard',5,'Active'),
  ('dietary-policy--halal-certified-kitchen','FOOD','Food Taxonomy','Dietary Policy','Halal Certified Kitchen','Food & Beverage (all food)','gst-food-standard',5,'Active'),
  ('dietary-policy--sattvic-no-onion-no-garlic-kitchen','FOOD','Food Taxonomy','Dietary Policy','Sattvic No Onion No Garlic Kitchen','Food & Beverage (all food)','gst-food-standard',5,'Active'),
  ('dietary-policy--swaminarayan-diet-kitchen','FOOD','Food Taxonomy','Dietary Policy','Swaminarayan Diet Kitchen','Food & Beverage (all food)','gst-food-standard',5,'Active'),
  ('dietary-policy--vegan-plant-based-kitchen','FOOD','Food Taxonomy','Dietary Policy','Vegan Plant-Based Kitchen','Food & Beverage (all food)','gst-food-standard',5,'Active'),
  ('dietary-policy--gluten-free-safe-kitchen','FOOD','Food Taxonomy','Dietary Policy','Gluten-Free Safe Kitchen','Food & Beverage (all food)','gst-food-standard',5,'Active'),
  ('food-operations--10-min-ready-to-eat-zone','FOOD','Food Taxonomy','Food Operations','10-Min Ready-to-Eat Zone','Food & Beverage (all food)','gst-food-standard',5,'Active'),
  ('food-operations--midnight-kitchen','FOOD','Food Taxonomy','Food Operations','Midnight Kitchen','Food & Beverage (all food)','gst-food-standard',5,'Active'),
  ('food-operations--early-morning-breakfast-kitchen','FOOD','Food Taxonomy','Food Operations','Early Morning Breakfast Kitchen','Food & Beverage (all food)','gst-food-standard',5,'Active'),
  ('food-operations--advance-pre-order-catering','FOOD','Food Taxonomy','Food Operations','Advance Pre-Order Catering','Food & Beverage (all food)','gst-food-standard',5,'Active'),
  ('food-operations--frozen-ice-gel-dispatch','FOOD','Food Taxonomy','Food Operations','Frozen Ice-Gel Dispatch','Food & Beverage (all food)','gst-food-standard',5,'Active'),
  ('food-operations--spill-prone-packaging-guard','FOOD','Food Taxonomy','Food Operations','Spill-Prone Packaging Guard','Food & Beverage (all food)','gst-food-standard',5,'Active'),
  ('food-operations--fssai-license-tier-verification','FOOD','Food Taxonomy','Food Operations','FSSAI License Tier Verification','Food & Beverage (all food)','gst-food-standard',5,'Active')
on conflict (id) do update
  set record_type = excluded.record_type,
      category = excluded.category,
      sub_category = excluded.sub_category,
      gst_category_name = excluded.gst_category_name,
      gst_slug = excluded.gst_slug,
      gst_rate_pct = excluded.gst_rate_pct,
      gst_rule_status = excluded.gst_rule_status,
      updated_at = now();

-- Stable display order follows the workbook row order (the VALUES insert leaves it at 0).
with ordered as (
  select id, row_number() over (order by ctid) as n
    from taxonomy.food_atomic_taxonomy
)
update taxonomy.food_atomic_taxonomy t
   set display_order = o.n
  from ordered o
 where t.id = o.id and t.display_order = 0;

-- ---------------------------------------------------------------- 2. category → atomic mapping
alter table taxonomy.categories
  add column if not exists atomic_category text,
  add column if not exists atomic_subcategory text;

with map(id, category, subcategory) as (values
  ('cat-burger','Fast Food','Burger'),
  ('cat-dosa','South Indian','Tamil Tiffin'),
  ('cat-fried-rice','International','Indo-Chinese'),
  ('cat-chicken','Kebabs','Al-Faham Chicken'),
  ('cat-rolls','Street Food','Kathi Roll'),
  ('cat-milkshake','Cafe','Milkshake'),
  ('cat-chicken-fried-rice','International','Indo-Chinese'),
  ('cat-paratha','North Indian','Punjabi Cuisine'),
  ('cat-rice','South Indian','Kerala Sadhya'),
  ('cat-fries','Fast Food','Burger'),
  ('cat-shake','Cafe','Milkshake'),
  ('cat-south-indian','South Indian','Chettinad Cuisine'),
  ('cat-desserts','Desserts','Falooda'),
  ('cat-ice-cream','Desserts','Ice Cream'),
  ('cat-noodles','International','Indo-Chinese'),
  ('cat-tandoori-chicken','North Indian','Tandoori Cuisine'),
  ('cat-parotta','South Indian','Malabar Cuisine'),
  ('cat-sweets','Mithai','Gulab Jamun'),
  ('cat-cheesecake','Bakery','Pastry'),
  ('cat-tiramisu','Bakery','Pastry'),
  ('cat-chilli-chicken','International','Indo-Chinese'),
  ('cat-chicken-curries','North Indian','Mughlai Cuisine'),
  ('cat-juice','Cafe','Fresh Fruit Juice'),
  ('cat-chicken-65','South Indian','Chettinad Cuisine')
)
update taxonomy.categories c
   set atomic_category = m.category,
       atomic_subcategory = m.subcategory,
       updated_at = now()
  from map m
 where c.id = m.id;

-- Mirror each carousel mapping onto its listable leaf so the seller form can show the cuisine the
-- leaf belongs to (the child rows are the selectable dish targets).
update taxonomy.categories leaf
   set atomic_category = root.atomic_category,
       atomic_subcategory = root.atomic_subcategory,
       updated_at = now()
  from taxonomy.categories root
 where leaf.parent_id = root.id
   and root.atomic_category is not null
   and leaf.atomic_category is null;

-- ---------------------------------------------------------------- 3. store onboarding config
create table if not exists taxonomy.store_config_options (
  id                  text primary key,
  store_attribute_group text not null,
  option_value        text not null,
  atomic_category     text,
  atomic_subcategory  text,
  collection_stage    text not null default '',
  behavior_note       text not null default '',
  display_order       int not null default 0,
  is_active           boolean not null default true,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index if not exists store_config_options_group_idx
  on taxonomy.store_config_options (store_attribute_group, display_order);

insert into taxonomy.store_config_options
  (id, store_attribute_group, option_value, atomic_category, atomic_subcategory, collection_stage, behavior_note) values
  ('CFG-01','Schedule / Pre-Order Availability','Instant Delivery','Food Operations','10-Min Ready-to-Eat Zone','Store Timing / Kitchen Mode','Default live ordering mode'),
  ('CFG-02','Schedule / Pre-Order Availability','Schedule','Food Operations','Advance Pre-Order Catering','Store Timing / Kitchen Mode','Enables future time-slot selection in customer filter drawer'),
  ('CFG-03','Store Dietary Policy','100% Pure Veg Kitchen','Dietary Policy','100% Pure Veg Kitchen','Store KYC / FSSAI Onboarding','Unlocks ''Pure Veg'' restaurant filter badge'),
  ('CFG-04','Store Dietary Policy','Veg Plus Egg Kitchen','Dietary Policy','Veg Plus Egg Kitchen','Store KYC / FSSAI Onboarding','Allows Veg & Egg items only'),
  ('CFG-05','Store Dietary Policy','Mixed Shared Kitchen','Dietary Policy','Mixed Shared Kitchen','Store KYC / FSSAI Onboarding','Allows Veg, Egg & Non-Veg items'),
  ('CFG-06','Store Dietary Policy','Jain Certified Kitchen','Dietary Policy','Jain Certified Kitchen','Store KYC / FSSAI Onboarding','Supports strict Jain dietary filtering'),
  ('CFG-07','Store Dietary Policy','Halal Certified Kitchen','Dietary Policy','Halal Certified Kitchen','Store KYC / FSSAI Onboarding','Displays Halal certification tag'),
  ('CFG-08','Trust & Rating Filters','Rated 3.5+','Food Operations','Quick Service Restaurant','System-Computed (Order Telemetry)','Auto-applied when rolling store rating >= 3.5'),
  ('CFG-09','Trust & Rating Filters','Rated 4.0+','Food Operations','Quick Service Restaurant','System-Computed (Order Telemetry)','Auto-applied when rolling store rating >= 4.0'),
  ('CFG-10','Trust & Rating Filters','Highly Reordered','Food Operations','Quick Service Restaurant','System-Computed (Repeat Rate)','Auto-applied when 30-day repeat customer rate crosses threshold'),
  ('CFG-11','Delivery & Offers','Free Delivery','Food Operations','Quick Service Restaurant','Store Promo / Radius Config','Configured at store delivery-zone level')
on conflict (id) do update
  set store_attribute_group = excluded.store_attribute_group,
      option_value = excluded.option_value,
      atomic_category = excluded.atomic_category,
      atomic_subcategory = excluded.atomic_subcategory,
      collection_stage = excluded.collection_stage,
      behavior_note = excluded.behavior_note,
      updated_at = now();

with ordered as (
  select id, row_number() over (order by ctid) as n
    from taxonomy.store_config_options
)
update taxonomy.store_config_options t
   set display_order = o.n
  from ordered o
 where t.id = o.id and t.display_order = 0;

-- ---------------------------------------------------------------- 4. sample menu templates
create table if not exists taxonomy.food_sample_menu_items (
  id                        text primary key,
  dish_name                 text not null,
  app_subcategory           text not null,
  atomic_category           text not null,
  atomic_subcategory        text not null,
  dietary_preference        text not null,
  base_price_inr            int not null check (base_price_inr >= 0),
  auto_price_bucket         text not null default '',
  primary_flavour_or_ingredient text not null default '',
  master_tab_group          text not null default '',
  type_or_base              text not null default '',
  additive_or_sauce         text not null default '',
  cuisine_origin            text not null default '',
  delivery_mode             text not null default '',
  applicable_gst_rate       text not null default '5%',
  display_order             int not null default 0,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);

insert into taxonomy.food_sample_menu_items
  (id, dish_name, app_subcategory, atomic_category, atomic_subcategory, dietary_preference,
   base_price_inr, auto_price_bucket, primary_flavour_or_ingredient, master_tab_group,
   type_or_base, additive_or_sauce, cuisine_origin, delivery_mode, applicable_gst_rate) values
  ('ITEM-1001','Alphonso Mango & Roasted Almond Sundae','Ice Cream','Desserts','Ice Cream','Veg',180,'₹100 – ₹200','Alphonso, Roasted Almond','Classic / Dry Fruit','Kulfi','None','None','Instant Delivery','5%'),
  ('ITEM-1002','Royal Kesar Pista Matka Kulfi','Ice Cream','Desserts','Ice Cream','Veg',95,'Under ₹100','Kesar Pista, Saffron, Pistachio','Desi','Kulfi','None','None','Instant Delivery','5%'),
  ('ITEM-1003','Belgian Chocochip Brownie Cassata','Ice Cream','Desserts','Ice Cream','Egg',220,'Above ₹200','Chocolate, Chocochip, Brownie','Chocolate / Cake','Cassata','None','None','Schedule','5%'),
  ('ITEM-1004','Tender Coconut & Fig Natural Scoop','Ice Cream','Desserts','Ice Cream','Vegan',140,'₹100 – ₹200','Tender Coconut, Fig','Fruit / Dry Fruit','None','None','None','Instant Delivery','5%'),
  ('ITEM-1005','Rajbhog Saffron Thickshake with Ice Cream','Shake','Cafe','Milkshake','Veg',190,'₹100 – ₹200','Rajbhog, Saffron','Desi','Ice cream','Cream, Nuts','None','Instant Delivery','5%'),
  ('ITEM-1006','Cold Coffee & Roasted Almond Shake','Shake','Cafe','Milkshake','Veg',160,'₹100 – ₹200','Coffee, Roasted Almond','Classic / Dry Fruit','Ice cream','Cream','None','Instant Delivery','5%'),
  ('ITEM-1007','Kulfi Falooda & Rose Butterscotch Shake','Shake','Cafe','Milkshake','Veg',210,'Above ₹200','Butterscotch, Kesar Pista','Classic','Kulfi','Nuts','None','Schedule','5%'),
  ('ITEM-1008','Old Delhi Chicken Tandoori Lachcha Roll','Rolls','Street Food','Kathi Roll','Non-Veg',175,'₹100 – ₹200','Chicken Tandoori','Chicken','Lachcha','Mayonnaise','Mughlai','Instant Delivery','5%'),
  ('ITEM-1009','Butter Chicken Makhani Paratha Roll','Rolls','Street Food','Kathi Roll','Non-Veg',195,'₹100 – ₹200','Butter Chicken, Chicken Makhani','Chicken','Paratha','Makhani','Indian','Instant Delivery','5%'),
  ('ITEM-1010','Double Egg & Malai Cream Wheat Roll','Rolls','Street Food','Kathi Roll','Egg',120,'₹100 – ₹200','Egg, Malai, Cream','Others','Wheat','Mayonnaise','Indian','Instant Delivery','5%'),
  ('ITEM-1011','Crispy Chicken & Cheddar Brioche Burger','Burger','Fast Food','Burger','Non-Veg',240,'Above ₹200','Fried Chicken | Crispy | Cheddar','Chicken','Brioche','Mayonnaise','American','Instant Delivery','5%'),
  ('ITEM-1012','Ghee Roast Masala Dosa','Dosa','South Indian','Tamil Tiffin','Veg',110,'₹100 – ₹200','N/A (Global Filters Only)','N/A','N/A','N/A','Indian','Instant Delivery','5%'),
  ('ITEM-1013','Schezwan Chicken Fried Rice','Chicken Fried Rice','International','Indo-Chinese','Non-Veg',185,'₹100 – ₹200','N/A (Global Filters Only)','N/A','N/A','N/A','Indian','Instant Delivery','5%'),
  ('ITEM-1014','Al-Faham Charcoal Grilled Chicken (Half)','Chicken','Kebabs','Al-Faham Chicken','Non-Veg',320,'₹200 – ₹350','N/A (Global Filters Only)','N/A','N/A','N/A','Arabian','Schedule','5%'),
  ('ITEM-1015','Peri Peri Salted French Fries','Fries','Fast Food','Burger','Vegan',130,'₹100 – ₹250','N/A (Global Filters Only)','N/A','N/A','N/A','American','Instant Delivery','5%')
on conflict (id) do update
  set dish_name = excluded.dish_name,
      app_subcategory = excluded.app_subcategory,
      atomic_category = excluded.atomic_category,
      atomic_subcategory = excluded.atomic_subcategory,
      dietary_preference = excluded.dietary_preference,
      base_price_inr = excluded.base_price_inr,
      auto_price_bucket = excluded.auto_price_bucket,
      primary_flavour_or_ingredient = excluded.primary_flavour_or_ingredient,
      master_tab_group = excluded.master_tab_group,
      type_or_base = excluded.type_or_base,
      additive_or_sauce = excluded.additive_or_sauce,
      cuisine_origin = excluded.cuisine_origin,
      delivery_mode = excluded.delivery_mode,
      applicable_gst_rate = excluded.applicable_gst_rate,
      updated_at = now();

with ordered as (
  select id, row_number() over (order by ctid) as n
    from taxonomy.food_sample_menu_items
)
update taxonomy.food_sample_menu_items t
   set display_order = o.n
  from ordered o
 where t.id = o.id and t.display_order = 0;

-- ---------------------------------------------------------------- 5. Rolls: split Sauce out of Ingredient
-- The workbook models Ingredient and Sauce as separate groups. 0143 folded Mayonnaise/Makhani into
-- Ingredient under a `Sauce` tab; move them to their own group and renumber the later groups.
insert into taxonomy.subcategory_attribute_groups
  (id, subcategory_id, slug, display_name, name_ta, input_type, display_order)
values
  ('ag-rolls-sauce', 'sub-rolls', 'sauce', 'Sauce', '', 'multi_select', 2)
on conflict (id) do update
  set subcategory_id = excluded.subcategory_id,
      slug = excluded.slug,
      display_name = excluded.display_name,
      input_type = excluded.input_type,
      display_order = excluded.display_order,
      updated_at = now();

update taxonomy.subcategory_attribute_groups
   set display_order = 3, updated_at = now()
 where id = 'ag-rolls-base';
update taxonomy.subcategory_attribute_groups
   set display_order = 4, updated_at = now()
 where id = 'ag-rolls-region-cuisine-origin';

delete from taxonomy.attribute_options
 where id in ('ao-rolls-ingredient-mayonnaise', 'ao-rolls-ingredient-makhani');

insert into taxonomy.attribute_options
  (id, group_id, parent_filter_tab, label, name_ta, icon_url, keywords, display_order)
values
  ('ao-rolls-sauce-mayonnaise', 'ag-rolls-sauce', null, 'Mayonnaise', '', null, array['mayonnaise']::text[], 0),
  ('ao-rolls-sauce-makhani', 'ag-rolls-sauce', null, 'Makhani', '', null, array['makhani']::text[], 1)
on conflict (id) do update
  set group_id = excluded.group_id,
      label = excluded.label,
      keywords = excluded.keywords,
      display_order = excluded.display_order,
      updated_at = now();

-- ---------------------------------------------------------------- 6. clean live FOOD menu mapping
-- 0140 defaulted every unmatched dish to `sub-chicken`, so cheesecake / coffee / tiramisu landed in
-- the Chicken bucket and most new carousel leaves stayed empty. Re-map by dish name (more specific
-- first) and derive the dietary type where the seller has not set one.
with mapped as (
  select m.venue_id, m.dish_id,
         case
           when hay like '%cheesecake%' then 'sub-cheesecake'
           when hay like '%tiramisu%' then 'sub-tiramisu'
           when hay like '%ice cream%' or hay like '%gelato%' or hay like '%kulfi%' or hay like '%falooda%' then 'sub-ice-cream'
           when hay like '%milkshake%' or hay like '%shake%' or hay like '%smoothie%' or hay like '%lassi%' then 'sub-milkshake'
           when hay like '%juice%' or hay like '%coffee%' or hay like '%espresso%' or hay like '%chai%' or hay like '%affogato%' or hay like '%flat white%' then 'sub-juice'
           when hay like '%dosa%' or hay like '%dosai%' or hay like '%idli%' or hay like '%vada%' or hay like '%uttapam%' or hay like '%pongal%' or hay like '%appam%' then 'sub-dosa'
           when hay like '%burger%' or hay like '%sandwich%' or hay like '%panini%' or hay like '%wrap%' or hay like '%slider%' then 'sub-burger'
           when hay like '%parotta%' or hay like '%paratha%' then 'sub-parotta'
           when hay like '%tandoori%' then 'sub-tandoori-chicken'
           when hay like '%chilli chicken%' then 'sub-chilli-chicken'
           when hay like '%chicken 65%' then 'sub-chicken-65'
           when hay like '%curry%' or hay like '%masala%' or hay like '%rogan%' or hay like '%makhani%' or hay like '%butter chicken%' then 'sub-chicken-curries'
           when hay like '%fries%' then 'sub-fries'
           when hay like '%sweet%' or hay like '%jamun%' or hay like '%jalebi%' or hay like '%halwa%' or hay like '%rasgulla%' then 'sub-sweets'
           when hay like '%thali%' or hay like '%platter%' or hay like '%combo%' or hay like '%meals%' then 'sub-thali'
           when hay like '%pizza%' or hay like '%pasta%' or hay like '%risotto%' or hay like '%noodle%' or hay like '%chow mein%' or hay like '%chowmein%' or hay like '%schezwan%' or hay like '%manchurian%' or hay like '%dim sum%' or hay like '%spring roll%' or hay like '%fried rice%' or hay like '%biryani%' or hay like '%pulao%' or hay like '%rice%' then 'sub-fried-rice'
           else 'sub-chicken'
         end as leaf_id
    from directory.menus m
    join directory.dining_venues v on v.id = m.venue_id
   cross join lateral (
     select lower(coalesce(m.name, '') || ' ' || coalesce(m.cuisine, '')) as hay
   ) h
   where v.app = 'FOOD'::app_brand
)
update directory.menus m
   set section_id = c.parent_id,
       sub_category_id = c.id,
       dietary_type = coalesce(m.dietary_type, case when m.is_veg then 'VEG' else 'NON_VEG' end)
  from mapped x
  join taxonomy.categories c on c.id = x.leaf_id
 where m.venue_id = x.venue_id and m.dish_id = x.dish_id;

commit;
