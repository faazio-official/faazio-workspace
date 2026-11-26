-- Faazio — customer-visible FOOD demo venue for the catalogue workbook samples (migration 0146).
--
-- Authority: docs/architecture/db-schema.md §12.4/§12.45, docs/user-interaction-workflow/customer/
-- discovery/food-categories.md, and migration 0145 (the workbook reference tables).
--
-- Why: 0145 stored the 15 generated sample dishes as templates. This migration publishes them on a
-- single, clearly-named demo venue so the customer Food feed, category drill-ins and dish detail can
-- show real DB-backed rows (no client fixture). It is a venue, not a seller store: `seller_id` stays
-- null so it never appears in a real seller's console or payouts.
--
-- Idempotent: fixed ids + ON CONFLICT UPDATE; the venue's facet tags are rewritten each run. Delete
-- the `venue-food-lab` row to remove the demo entirely.
--
begin;

insert into directory.dining_venues
  (id, name, app, rating, cover_image, address, phone, hours, categories, seller_id,
   latitude, longitude, name_ta, instant_delivery, accepts_scheduled_orders,
   schedule_lead_time_minutes, schedule_slots)
values
  ('venue-food-lab', 'Faazio Food Lab', 'FOOD', 4.7, '', 'Karaikal, Puducherry', null,
   '10:00 AM – 11:00 PM',
   array['Ice Cream','Shake','Rolls','Burger','Dosa','Chicken Fried Rice','Chicken','Fries']::text[],
   null, 10.9254, 79.8380, '', true, true, 45, array['11:00','13:00','19:00']::text[])
on conflict (id) do update
  set name = excluded.name,
      app = excluded.app,
      rating = excluded.rating,
      cover_image = excluded.cover_image,
      address = excluded.address,
      phone = excluded.phone,
      hours = excluded.hours,
      categories = excluded.categories,
      seller_id = excluded.seller_id,
      latitude = excluded.latitude,
      longitude = excluded.longitude,
      name_ta = excluded.name_ta,
      instant_delivery = excluded.instant_delivery,
      accepts_scheduled_orders = excluded.accepts_scheduled_orders,
      schedule_lead_time_minutes = excluded.schedule_lead_time_minutes,
      schedule_slots = excluded.schedule_slots;

insert into directory.menus
  (venue_id, dish_id, name, price_paisa, is_veg, cuisine, rating, image, status, description,
   emoji, delivery_time, mrp_paisa, image_key, image_asset_id, name_ta, description_ta,
   section_id, sub_category_id, dietary_type)
values
  ('venue-food-lab','demo-item-1001','Alphonso Mango & Roasted Almond Sundae',18000,true,'Desserts',4.5,'','ACTIVE','Alphonso, Roasted Almond','','25 min',null,null,null,'','','cat-ice-cream','sub-ice-cream','VEG'),
  ('venue-food-lab','demo-item-1002','Royal Kesar Pista Matka Kulfi',9500,true,'Desserts',4.6,'','ACTIVE','Kesar Pista, Saffron, Pistachio','','25 min',null,null,null,'','','cat-ice-cream','sub-ice-cream','VEG'),
  ('venue-food-lab','demo-item-1003','Belgian Chocochip Brownie Cassata',22000,false,'Desserts',4.7,'','ACTIVE','Chocolate, Chocochip, Brownie','','25 min',null,null,null,'','','cat-ice-cream','sub-ice-cream','EGG'),
  ('venue-food-lab','demo-item-1004','Tender Coconut & Fig Natural Scoop',14000,true,'Desserts',4.8,'','ACTIVE','Tender Coconut, Fig','','25 min',null,null,null,'','','cat-ice-cream','sub-ice-cream','VEG'),
  ('venue-food-lab','demo-item-1005','Rajbhog Saffron Thickshake with Ice Cream',19000,true,'Cafe',4.9,'','ACTIVE','Rajbhog, Saffron','','25 min',null,null,null,'','','cat-shake','sub-shake','VEG'),
  ('venue-food-lab','demo-item-1006','Cold Coffee & Roasted Almond Shake',16000,true,'Cafe',4.5,'','ACTIVE','Coffee, Roasted Almond','','25 min',null,null,null,'','','cat-shake','sub-shake','VEG'),
  ('venue-food-lab','demo-item-1007','Kulfi Falooda & Rose Butterscotch Shake',21000,true,'Cafe',4.6,'','ACTIVE','Butterscotch, Kesar Pista','','25 min',null,null,null,'','','cat-shake','sub-shake','VEG'),
  ('venue-food-lab','demo-item-1008','Old Delhi Chicken Tandoori Lachcha Roll',17500,false,'Mughlai',4.7,'','ACTIVE','Chicken Tandoori','','25 min',null,null,null,'','','cat-rolls','sub-rolls','NON_VEG'),
  ('venue-food-lab','demo-item-1009','Butter Chicken Makhani Paratha Roll',19500,false,'Indian',4.8,'','ACTIVE','Butter Chicken, Chicken Makhani','','25 min',null,null,null,'','','cat-rolls','sub-rolls','NON_VEG'),
  ('venue-food-lab','demo-item-1010','Double Egg & Malai Cream Wheat Roll',12000,false,'Indian',4.9,'','ACTIVE','Egg, Malai, Cream','','25 min',null,null,null,'','','cat-rolls','sub-rolls','EGG'),
  ('venue-food-lab','demo-item-1011','Crispy Chicken & Cheddar Brioche Burger',24000,false,'American',4.5,'','ACTIVE','Fried Chicken | Crispy | Cheddar','','25 min',null,null,null,'','','cat-burger','sub-burger','NON_VEG'),
  ('venue-food-lab','demo-item-1012','Ghee Roast Masala Dosa',11000,true,'Indian',4.6,'','ACTIVE','','','25 min',null,null,null,'','','cat-dosa','sub-dosa','VEG'),
  ('venue-food-lab','demo-item-1013','Schezwan Chicken Fried Rice',18500,false,'Indian',4.7,'','ACTIVE','','','25 min',null,null,null,'','','cat-chicken-fried-rice','sub-chicken-fried-rice','NON_VEG'),
  ('venue-food-lab','demo-item-1014','Al-Faham Charcoal Grilled Chicken (Half)',32000,false,'Arabian',4.8,'','ACTIVE','','','25 min',null,null,null,'','','cat-chicken','sub-chicken','NON_VEG'),
  ('venue-food-lab','demo-item-1015','Peri Peri Salted French Fries',13000,true,'American',4.9,'','ACTIVE','','','25 min',null,null,null,'','','cat-fries','sub-fries','VEG')
on conflict (venue_id, dish_id) do update
  set name = excluded.name,
      price_paisa = excluded.price_paisa,
      is_veg = excluded.is_veg,
      cuisine = excluded.cuisine,
      rating = excluded.rating,
      image = excluded.image,
      status = excluded.status,
      description = excluded.description,
      emoji = excluded.emoji,
      delivery_time = excluded.delivery_time,
      mrp_paisa = excluded.mrp_paisa,
      image_key = excluded.image_key,
      image_asset_id = excluded.image_asset_id,
      name_ta = excluded.name_ta,
      description_ta = excluded.description_ta,
      section_id = excluded.section_id,
      sub_category_id = excluded.sub_category_id,
      dietary_type = excluded.dietary_type;

delete from directory.menu_item_attributes where venue_id = 'venue-food-lab';

insert into directory.menu_item_attributes (venue_id, dish_id, option_id)
values
  ('venue-food-lab','demo-item-1001','ao-ice-cream-dietary-preference-veg'),
  ('venue-food-lab','demo-item-1001','ao-ice-cream-flavour-alphonso'),
  ('venue-food-lab','demo-item-1001','ao-ice-cream-flavour-roasted-almond'),
  ('venue-food-lab','demo-item-1001','ao-ice-cream-type-kulfi'),
  ('venue-food-lab','demo-item-1002','ao-ice-cream-dietary-preference-veg'),
  ('venue-food-lab','demo-item-1002','ao-ice-cream-flavour-kesar-pista'),
  ('venue-food-lab','demo-item-1002','ao-ice-cream-flavour-saffron'),
  ('venue-food-lab','demo-item-1002','ao-ice-cream-flavour-pistachio'),
  ('venue-food-lab','demo-item-1002','ao-ice-cream-type-kulfi'),
  ('venue-food-lab','demo-item-1003','ao-ice-cream-dietary-preference-egg'),
  ('venue-food-lab','demo-item-1003','ao-ice-cream-flavour-chocolate'),
  ('venue-food-lab','demo-item-1003','ao-ice-cream-flavour-chocochip'),
  ('venue-food-lab','demo-item-1003','ao-ice-cream-flavour-brownie'),
  ('venue-food-lab','demo-item-1003','ao-ice-cream-type-cassata'),
  ('venue-food-lab','demo-item-1004','ao-ice-cream-dietary-preference-vegan'),
  ('venue-food-lab','demo-item-1004','ao-ice-cream-flavour-tender-coconut'),
  ('venue-food-lab','demo-item-1004','ao-ice-cream-flavour-fig'),
  ('venue-food-lab','demo-item-1005','ao-shake-dietary-preference-veg'),
  ('venue-food-lab','demo-item-1005','ao-shake-flavour-rajbhog'),
  ('venue-food-lab','demo-item-1005','ao-shake-flavour-saffron'),
  ('venue-food-lab','demo-item-1005','ao-shake-type-ice-cream'),
  ('venue-food-lab','demo-item-1005','ao-shake-additive-cream'),
  ('venue-food-lab','demo-item-1005','ao-shake-additive-nuts'),
  ('venue-food-lab','demo-item-1006','ao-shake-dietary-preference-veg'),
  ('venue-food-lab','demo-item-1006','ao-shake-flavour-coffee'),
  ('venue-food-lab','demo-item-1006','ao-shake-flavour-roasted-almond'),
  ('venue-food-lab','demo-item-1006','ao-shake-type-ice-cream'),
  ('venue-food-lab','demo-item-1006','ao-shake-additive-cream'),
  ('venue-food-lab','demo-item-1007','ao-shake-dietary-preference-veg'),
  ('venue-food-lab','demo-item-1007','ao-shake-flavour-butterscotch'),
  ('venue-food-lab','demo-item-1007','ao-shake-flavour-kesar-pista'),
  ('venue-food-lab','demo-item-1007','ao-shake-type-kulfi'),
  ('venue-food-lab','demo-item-1007','ao-shake-additive-nuts'),
  ('venue-food-lab','demo-item-1008','ao-rolls-dietary-preference-non-veg'),
  ('venue-food-lab','demo-item-1008','ao-rolls-ingredient-chicken-tandoori'),
  ('venue-food-lab','demo-item-1008','ao-rolls-base-lachcha'),
  ('venue-food-lab','demo-item-1008','ao-rolls-sauce-mayonnaise'),
  ('venue-food-lab','demo-item-1008','ao-rolls-region-cuisine-origin-mughlai'),
  ('venue-food-lab','demo-item-1009','ao-rolls-dietary-preference-non-veg'),
  ('venue-food-lab','demo-item-1009','ao-rolls-ingredient-butter-chicken'),
  ('venue-food-lab','demo-item-1009','ao-rolls-ingredient-chicken-makhani'),
  ('venue-food-lab','demo-item-1009','ao-rolls-base-paratha'),
  ('venue-food-lab','demo-item-1009','ao-rolls-sauce-makhani'),
  ('venue-food-lab','demo-item-1009','ao-rolls-region-cuisine-origin-indian'),
  ('venue-food-lab','demo-item-1010','ao-rolls-dietary-preference-egg'),
  ('venue-food-lab','demo-item-1010','ao-rolls-ingredient-egg'),
  ('venue-food-lab','demo-item-1010','ao-rolls-ingredient-malai'),
  ('venue-food-lab','demo-item-1010','ao-rolls-ingredient-cream'),
  ('venue-food-lab','demo-item-1010','ao-rolls-base-wheat'),
  ('venue-food-lab','demo-item-1010','ao-rolls-sauce-mayonnaise'),
  ('venue-food-lab','demo-item-1010','ao-rolls-region-cuisine-origin-indian'),
  ('venue-food-lab','demo-item-1011','ao-burger-dietary-preference-non-veg'),
  ('venue-food-lab','demo-item-1011','ao-patty-fried-chicken'),
  ('venue-food-lab','demo-item-1011','ao-patty-type-crispy'),
  ('venue-food-lab','demo-item-1011','ao-cheese-type-cheddar'),
  ('venue-food-lab','demo-item-1011','ao-bun-type-brioche'),
  ('venue-food-lab','demo-item-1011','ao-dressing-sauce-mayonnaise'),
  ('venue-food-lab','demo-item-1011','ao-region-cuisine-origin-american'),
  ('venue-food-lab','demo-item-1012','ao-dosa-dietary-preference-veg'),
  ('venue-food-lab','demo-item-1013','ao-chicken-fried-rice-dietary-preference-non-veg'),
  ('venue-food-lab','demo-item-1014','ao-chicken-dietary-preference-non-veg'),
  ('venue-food-lab','demo-item-1015','ao-fries-dietary-preference-vegan')
on conflict do nothing;

commit;
