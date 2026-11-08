-- Faazio demo data — realistic seller registrations for Tiruchirappalli (TTC, TN) and
-- Karaikal (PY1, PY) across MART / FOOD / PHARMA, with a mix of KYC states.
--
-- Apply from a developer terminal (writes the REAL tables, not a staging table):
--   server/supabase/apply-migration.sh server/supabase/seed/demo_sellers_ttc_karaikal.sql
--
-- Tables written: sellers.sellers, sellers.bank_accounts, sellers.kyc_documents, directory.stores.
-- Every row uses a deterministic `sel-demo-*` / `store-demo-*` / `kyc-demo-*` / `bank-demo-*` id, so
-- this file is idempotent (on conflict do nothing) and trivially removable — see the cleanup block
-- at the bottom. district_code references admins.district_master (TTC/PY1 already seeded by 0046).
--
-- This is NOT part of the generated bootstrap (seed/0001_seed.sql); it exists so the admin dashboard
-- shows realistic review states: some sellers ACTIVE with verified KYC, some PENDING with uploaded
-- but unverified docs, some PENDING with no docs at all, and two REJECTED with a reason/history.

begin;

-- ================================================================ sellers
insert into sellers.sellers (
  seller_id, business_name, owner_name, gstin, pan, address, phone,
  state_code, district_code, status, rating, contact_email,
  otp_verified, otp_verified_at, latitude, longitude,
  rejection_reason, rejection_history, created_at
) values
  -- ---- Tiruchirappalli (TN) ----------------------------------------------------------------
  ('sel-demo-ttc-mart-1', 'Sri Balaji Supermarket', 'Balaji Rajendran',
   '33ABCDE1234F1Z5', 'ABCDE1234F', 'No. 12, NSB Road, Tiruchirappalli, Tamil Nadu 620001',
   '+919843010001', 'TN', 'TTC', 'ACTIVE'::seller_status, 4.5, 'balaji.supermarket@faazio-demo.test',
   true, now() - interval '18 days', 10.7930, 78.6980, null, '[]'::jsonb, now() - interval '20 days'),

  ('sel-demo-ttc-mart-2', 'Pillai Provision Store', 'Karthik Pillai',
   '', 'FGHIJ5678K', 'No. 88, Big Bazaar Street, Tiruchirappalli, Tamil Nadu 620008',
   '+919843010002', 'TN', 'TTC', 'PENDING_REVIEW'::seller_status, 0, 'karthik.pillai@faazio-demo.test',
   true, now() - interval '2 days', 10.8060, 78.6850, null, '[]'::jsonb, now() - interval '3 days'),

  ('sel-demo-ttc-food-1', 'Anandha Bhavan Restaurant', 'Suresh Kumar',
   '33KLMNO9012P1Z3', 'KLMNO9012P', 'No. 45, Cantonment Main Road, Tiruchirappalli, Tamil Nadu 620001',
   '+919843010003', 'TN', 'TTC', 'ACTIVE'::seller_status, 4.7, 'anandha.bhavan@faazio-demo.test',
   true, now() - interval '30 days', 10.8001, 78.6890, null, '[]'::jsonb, now() - interval '33 days'),

  ('sel-demo-ttc-food-2', 'Hotel Kannappa Mess', 'Muthukumar Kannan',
   '', 'MNOPQ3456R', 'No. 17, Rockfort Road, Tiruchirappalli, Tamil Nadu 620002',
   '+919843010004', 'TN', 'TTC', 'PENDING_REVIEW'::seller_status, 0, 'kannappa.mess@faazio-demo.test',
   false, null, 10.8160, 78.6900, null, '[]'::jsonb, now() - interval '1 day'),

  ('sel-demo-ttc-pharma-1', 'Vasan Medicals', 'Vasan Sankaran',
   '33QRSTU7890V1Z9', 'QRSTU7890V', 'No. 22, Salai Road, Tiruchirappalli, Tamil Nadu 620018',
   '+919843010005', 'TN', 'TTC', 'ACTIVE'::seller_status, 4.6, 'vasan.medicals@faazio-demo.test',
   true, now() - interval '25 days', 10.8180, 78.6870, null, '[]'::jsonb, now() - interval '28 days'),

  ('sel-demo-ttc-pharma-2', 'Sri Venkateswara Pharmacy', 'Ramesh Venkatesan',
   '', 'UVWXY1234Z', 'No. 5, Thillai Nagar, Tiruchirappalli, Tamil Nadu 620018',
   '+919843010006', 'TN', 'TTC', 'PENDING_REVIEW'::seller_status, 0, 'venkateswara.pharmacy@faazio-demo.test',
   true, now() - interval '4 days', 10.8220, 78.6830, null, '[]'::jsonb, now() - interval '5 days'),

  ('sel-demo-ttc-food-3', 'Quick Bites Trichy', 'Anand Mohan',
   '33BCDEF2345G1Z7', 'BCDEF2345G', 'No. 60, Bharathidasan Road, Tiruchirappalli, Tamil Nadu 620017',
   '+919843010007', 'TN', 'TTC', 'REJECTED'::seller_status, 0, 'quickbites.trichy@faazio-demo.test',
   true, now() - interval '9 days', 10.8050, 78.6920,
   'FSSAI certificate is illegible; upload a clear scan.',
   '[{"reason":"FSSAI certificate is illegible; upload a clear scan.","adminId":"adm-ttc-demo","createdAt":"2026-10-30T09:30:00Z"}]'::jsonb,
   now() - interval '12 days'),

  -- ---- Karaikal (PY) -----------------------------------------------------------------------
  ('sel-demo-py1-mart-1', 'Karaikal Mega Mart', 'Thirumalai Selvam',
   '34GHIJK6789L1Z5', 'GHIJK6789L', 'No. 34, Bharathiar Road, Karaikal, Puducherry 609602',
   '+919843020001', 'PY', 'PY1', 'ACTIVE'::seller_status, 4.4, 'karaikal.megamart@faazio-demo.test',
   true, now() - interval '15 days', 10.9250, 79.8380, null, '[]'::jsonb, now() - interval '17 days'),

  ('sel-demo-py1-mart-2', 'Vallalar Provision Store', 'Subramani Perumal',
   '', 'HIJKL1234M', 'No. 9, Kamaraj Salai, Karaikal, Puducherry 609602',
   '+919843020002', 'PY', 'PY1', 'PENDING_REVIEW'::seller_status, 0, 'vallalar.store@faazio-demo.test',
   true, now() - interval '2 days', 10.9180, 79.8330, null, '[]'::jsonb, now() - interval '2 days'),

  ('sel-demo-py1-food-1', 'Hotel Aristo Karaikal', 'Bhaskar Narayanan',
   '34MNOPQ4567R1Z1', 'MNOPQ4567R', 'No. 12, Church Street, Karaikal, Puducherry 609602',
   '+919843020003', 'PY', 'PY1', 'ACTIVE'::seller_status, 4.5, 'hotel.aristo@faazio-demo.test',
   true, now() - interval '22 days', 10.9270, 79.8360, null, '[]'::jsonb, now() - interval '24 days'),

  ('sel-demo-py1-food-2', 'Sangam Mess', 'Dhandapani Krishnan',
   '', 'OPQRS8901T', 'No. 78, Nagore Road, Karaikal, Puducherry 609602',
   '+919843020004', 'PY', 'PY1', 'PENDING_REVIEW'::seller_status, 0, 'sangam.mess@faazio-demo.test',
   true, now() - interval '3 days', 10.9200, 79.8300, null, '[]'::jsonb, now() - interval '3 days'),

  ('sel-demo-py1-pharma-1', 'Maruthi Medicals', 'Senthil Raja',
   '34TUVWX2345Y1Z9', 'TUVWX2345Y', 'No. 3, Beach Road, Karaikal, Puducherry 609602',
   '+919843020005', 'PY', 'PY1', 'ACTIVE'::seller_status, 4.3, 'maruthi.medicals@faazio-demo.test',
   true, now() - interval '19 days', 10.9230, 79.8400, null, '[]'::jsonb, now() - interval '21 days'),

  ('sel-demo-py1-pharma-2', 'Annai Pharmacy', 'Ganesh Murugan',
   '', 'UVWXY6789Z', 'No. 21, Ammaiyappan Street, Karaikal, Puducherry 609602',
   '+919843020006', 'PY', 'PY1', 'PENDING_REVIEW'::seller_status, 0, 'annai.pharmacy@faazio-demo.test',
   true, now() - interval '1 day', 10.9160, 79.8270, null, '[]'::jsonb, now() - interval '1 day'),

  ('sel-demo-py1-mart-3', 'Bharathi Stores', 'Ilango Thangavel',
   '34ABCDE9012F1Z5', 'ABCDE9012F', 'No. 55, Market Road, Karaikal, Puducherry 609602',
   '+919843020007', 'PY', 'PY1', 'REJECTED'::seller_status, 0, 'bharathi.stores@faazio-demo.test',
   true, now() - interval '8 days', 10.9190, 79.8350,
   'PAN name does not match the registered owner.',
   '[{"reason":"PAN name does not match the registered owner.","adminId":"adm-py1-demo","createdAt":"2026-11-01T11:05:00Z"}]'::jsonb,
   now() - interval '10 days')
on conflict (seller_id) do nothing;

-- ================================================================ bank accounts (one per seller)
insert into sellers.bank_accounts (
  bank_account_id, seller_id, bank_name, account_number_masked, ifsc, beneficiary_name
) values
  ('bank-demo-ttc-mart-1',   'sel-demo-ttc-mart-1',   'HDFC Bank',           '******4821', 'HDFC0001234', 'Sri Balaji Supermarket'),
  ('bank-demo-ttc-mart-2',   'sel-demo-ttc-mart-2',   'Indian Bank',         '******1130', 'IDIB000T045', 'Karthik Pillai'),
  ('bank-demo-ttc-food-1',   'sel-demo-ttc-food-1',   'ICICI Bank',          '******7742', 'ICIC0001234', 'Anandha Bhavan Restaurant'),
  ('bank-demo-ttc-food-2',   'sel-demo-ttc-food-2',   'State Bank of India', '******3390', 'SBIN0001234', 'Muthukumar Kannan'),
  ('bank-demo-ttc-pharma-1', 'sel-demo-ttc-pharma-1', 'Kotak Mahindra Bank', '******5567', 'KKBK0001234', 'Vasan Medicals'),
  ('bank-demo-ttc-pharma-2', 'sel-demo-ttc-pharma-2', 'Canara Bank',         '******9081', 'CNRB0001234', 'Ramesh Venkatesan'),
  ('bank-demo-ttc-food-3',   'sel-demo-ttc-food-3',   'HDFC Bank',           '******2214', 'HDFC0005678', 'Anand Mohan'),
  ('bank-demo-py1-mart-1',   'sel-demo-py1-mart-1',   'HDFC Bank',           '******6605', 'HDFC0006677', 'Karaikal Mega Mart'),
  ('bank-demo-py1-mart-2',   'sel-demo-py1-mart-2',   'Indian Overseas Bank','******4478', 'IOBA0000123', 'Subramani Perumal'),
  ('bank-demo-py1-food-1',   'sel-demo-py1-food-1',   'ICICI Bank',          '******8123', 'ICIC0007788', 'Hotel Aristo Karaikal'),
  ('bank-demo-py1-food-2',   'sel-demo-py1-food-2',   'State Bank of India', '******1290', 'SBIN0007788', 'Dhandapani Krishnan'),
  ('bank-demo-py1-pharma-1', 'sel-demo-py1-pharma-1', 'Kotak Mahindra Bank', '******7761', 'KKBK0007788', 'Maruthi Medicals'),
  ('bank-demo-py1-pharma-2', 'sel-demo-py1-pharma-2', 'Canara Bank',         '******9902', 'CNRB0007788', 'Ganesh Murugan'),
  ('bank-demo-py1-mart-3',   'sel-demo-py1-mart-3',   'Indian Bank',         '******3345', 'IDIB000K123', 'Ilango Thangavel')
on conflict (seller_id) do nothing;

-- ================================================================ KYC documents
-- ACTIVE sellers: verified. PENDING/REJECTED: uploaded but unverified. Two sellers have NO rows at
-- all (sel-demo-py1-mart-2, sel-demo-py1-pharma-2) so the dashboard shows "No docs".
insert into sellers.kyc_documents (kyc_id, seller_id, doc_type, file_key, verified) values
  ('kyc-demo-ttc-mart-1-passbook',   'sel-demo-ttc-mart-1',   'PASSBOOK'::kyc_doc_type,     'kyc/demo/sel-demo-ttc-mart-1/passbook.jpg',   true),
  ('kyc-demo-ttc-mart-1-gstin',      'sel-demo-ttc-mart-1',   'GSTIN'::kyc_doc_type,        'kyc/demo/sel-demo-ttc-mart-1/gstin.pdf',      true),
  ('kyc-demo-ttc-mart-2-passbook',   'sel-demo-ttc-mart-2',   'PASSBOOK'::kyc_doc_type,     'kyc/demo/sel-demo-ttc-mart-2/passbook.jpg',   false),
  ('kyc-demo-ttc-food-1-passbook',   'sel-demo-ttc-food-1',   'PASSBOOK'::kyc_doc_type,     'kyc/demo/sel-demo-ttc-food-1/passbook.jpg',   true),
  ('kyc-demo-ttc-food-1-fssai',      'sel-demo-ttc-food-1',   'FSSAI'::kyc_doc_type,        'kyc/demo/sel-demo-ttc-food-1/fssai.pdf',      true),
  ('kyc-demo-ttc-food-1-gstin',      'sel-demo-ttc-food-1',   'GSTIN'::kyc_doc_type,        'kyc/demo/sel-demo-ttc-food-1/gstin.pdf',      true),
  ('kyc-demo-ttc-food-2-passbook',   'sel-demo-ttc-food-2',   'PASSBOOK'::kyc_doc_type,     'kyc/demo/sel-demo-ttc-food-2/passbook.jpg',   false),
  ('kyc-demo-ttc-food-2-fssai',      'sel-demo-ttc-food-2',   'FSSAI'::kyc_doc_type,        'kyc/demo/sel-demo-ttc-food-2/fssai.pdf',      false),
  ('kyc-demo-ttc-pharma-1-passbook', 'sel-demo-ttc-pharma-1', 'PASSBOOK'::kyc_doc_type,     'kyc/demo/sel-demo-ttc-pharma-1/passbook.jpg', true),
  ('kyc-demo-ttc-pharma-1-shop',     'sel-demo-ttc-pharma-1', 'SHOP_LICENSE'::kyc_doc_type, 'kyc/demo/sel-demo-ttc-pharma-1/shop-license.pdf', true),
  ('kyc-demo-ttc-pharma-1-gstin',    'sel-demo-ttc-pharma-1', 'GSTIN'::kyc_doc_type,        'kyc/demo/sel-demo-ttc-pharma-1/gstin.pdf',    true),
  ('kyc-demo-ttc-pharma-2-passbook', 'sel-demo-ttc-pharma-2', 'PASSBOOK'::kyc_doc_type,     'kyc/demo/sel-demo-ttc-pharma-2/passbook.jpg', false),
  ('kyc-demo-ttc-pharma-2-shop',     'sel-demo-ttc-pharma-2', 'SHOP_LICENSE'::kyc_doc_type, 'kyc/demo/sel-demo-ttc-pharma-2/shop-license.pdf', false),
  ('kyc-demo-ttc-food-3-passbook',   'sel-demo-ttc-food-3',   'PASSBOOK'::kyc_doc_type,     'kyc/demo/sel-demo-ttc-food-3/passbook.jpg',   false),
  ('kyc-demo-ttc-food-3-fssai',      'sel-demo-ttc-food-3',   'FSSAI'::kyc_doc_type,        'kyc/demo/sel-demo-ttc-food-3/fssai.pdf',      false),
  ('kyc-demo-ttc-food-3-gstin',      'sel-demo-ttc-food-3',   'GSTIN'::kyc_doc_type,        'kyc/demo/sel-demo-ttc-food-3/gstin.pdf',      false),
  ('kyc-demo-py1-mart-1-passbook',   'sel-demo-py1-mart-1',   'PASSBOOK'::kyc_doc_type,     'kyc/demo/sel-demo-py1-mart-1/passbook.jpg',   true),
  ('kyc-demo-py1-mart-1-gstin',      'sel-demo-py1-mart-1',   'GSTIN'::kyc_doc_type,        'kyc/demo/sel-demo-py1-mart-1/gstin.pdf',      true),
  ('kyc-demo-py1-food-1-passbook',   'sel-demo-py1-food-1',   'PASSBOOK'::kyc_doc_type,     'kyc/demo/sel-demo-py1-food-1/passbook.jpg',   true),
  ('kyc-demo-py1-food-1-fssai',      'sel-demo-py1-food-1',   'FSSAI'::kyc_doc_type,        'kyc/demo/sel-demo-py1-food-1/fssai.pdf',      true),
  ('kyc-demo-py1-food-1-gstin',      'sel-demo-py1-food-1',   'GSTIN'::kyc_doc_type,        'kyc/demo/sel-demo-py1-food-1/gstin.pdf',      true),
  ('kyc-demo-py1-food-2-passbook',   'sel-demo-py1-food-2',   'PASSBOOK'::kyc_doc_type,     'kyc/demo/sel-demo-py1-food-2/passbook.jpg',   false),
  ('kyc-demo-py1-food-2-fssai',      'sel-demo-py1-food-2',   'FSSAI'::kyc_doc_type,        'kyc/demo/sel-demo-py1-food-2/fssai.pdf',      false),
  ('kyc-demo-py1-pharma-1-passbook', 'sel-demo-py1-pharma-1', 'PASSBOOK'::kyc_doc_type,     'kyc/demo/sel-demo-py1-pharma-1/passbook.jpg', true),
  ('kyc-demo-py1-pharma-1-shop',     'sel-demo-py1-pharma-1', 'SHOP_LICENSE'::kyc_doc_type, 'kyc/demo/sel-demo-py1-pharma-1/shop-license.pdf', true),
  ('kyc-demo-py1-pharma-1-gstin',    'sel-demo-py1-pharma-1', 'GSTIN'::kyc_doc_type,        'kyc/demo/sel-demo-py1-pharma-1/gstin.pdf',    true),
  ('kyc-demo-py1-mart-3-passbook',   'sel-demo-py1-mart-3',   'PASSBOOK'::kyc_doc_type,     'kyc/demo/sel-demo-py1-mart-3/passbook.jpg',   false),
  ('kyc-demo-py1-mart-3-gstin',      'sel-demo-py1-mart-3',   'GSTIN'::kyc_doc_type,        'kyc/demo/sel-demo-py1-mart-3/gstin.pdf',      false)
on conflict (kyc_id) do nothing;

-- ================================================================ vendor stores (one per seller)
insert into directory.stores (
  id, app, name, seller_id, state_code, address, phone, hours, latitude, longitude,
  rating, reviews_count, delivery_time, distance, is_live, platform_fee_pct,
  fssai_number, drug_license_number, desc_text
) values
  ('store-demo-ttc-mart-1', 'MART'::app_brand, 'Sri Balaji Supermarket', 'sel-demo-ttc-mart-1',
   'TN', 'No. 12, NSB Road, Tiruchirappalli, Tamil Nadu 620001', '+919843010001', '8:00 AM - 9:00 PM',
   10.7930, 78.6980, 4.5, 214, '20 min', '1.2 km', true, 10, '', '',
   'Everyday groceries, fresh produce and household essentials.'),

  ('store-demo-ttc-mart-2', 'MART'::app_brand, 'Pillai Provision Store', 'sel-demo-ttc-mart-2',
   'TN', 'No. 88, Big Bazaar Street, Tiruchirappalli, Tamil Nadu 620008', '+919843010002', '7:30 AM - 8:30 PM',
   10.8060, 78.6850, 0, 0, '25 min', '2.0 km', false, 10, '', '',
   'Neighbourhood provisions and daily needs.'),

  ('store-demo-ttc-food-1', 'FOOD'::app_brand, 'Anandha Bhavan Restaurant', 'sel-demo-ttc-food-1',
   'TN', 'No. 45, Cantonment Main Road, Tiruchirappalli, Tamil Nadu 620001', '+919843010003', '7:00 AM - 10:30 PM',
   10.8001, 78.6890, 4.7, 532, '30 min', '1.6 km', true, 15, '12422033000123', '',
   'Authentic South Indian breakfast and meals.'),

  ('store-demo-ttc-food-2', 'FOOD'::app_brand, 'Hotel Kannappa Mess', 'sel-demo-ttc-food-2',
   'TN', 'No. 17, Rockfort Road, Tiruchirappalli, Tamil Nadu 620002', '+919843010004', '6:30 AM - 10:00 PM',
   10.8160, 78.6900, 0, 0, '28 min', '2.4 km', false, 12, '', '',
   'Traditional mess meals and biryani.'),

  ('store-demo-ttc-pharma-1', 'PHARMA'::app_brand, 'Vasan Medicals', 'sel-demo-ttc-pharma-1',
   'TN', 'No. 22, Salai Road, Tiruchirappalli, Tamil Nadu 620018', '+919843010005', '9:00 AM - 10:00 PM',
   10.8180, 78.6870, 4.6, 187, '18 min', '1.4 km', true, 10, '', 'TN-TRY-20B-12345',
   'Prescription medicines and wellness products.'),

  ('store-demo-ttc-pharma-2', 'PHARMA'::app_brand, 'Sri Venkateswara Pharmacy', 'sel-demo-ttc-pharma-2',
   'TN', 'No. 5, Thillai Nagar, Tiruchirappalli, Tamil Nadu 620018', '+919843010006', '8:30 AM - 9:30 PM',
   10.8220, 78.6830, 0, 0, '20 min', '2.1 km', false, 10, '', 'TN-TRY-20B-67890',
   'Pharmacy and daily health essentials.'),

  ('store-demo-ttc-food-3', 'FOOD'::app_brand, 'Quick Bites Trichy', 'sel-demo-ttc-food-3',
   'TN', 'No. 60, Bharathidasan Road, Tiruchirappalli, Tamil Nadu 620017', '+919843010007', '11:00 AM - 11:00 PM',
   10.8050, 78.6920, 0, 0, '35 min', '3.0 km', false, 12, '12422033000999', '',
   'Quick service restaurant.'),

  ('store-demo-py1-mart-1', 'MART'::app_brand, 'Karaikal Mega Mart', 'sel-demo-py1-mart-1',
   'PY', 'No. 34, Bharathiar Road, Karaikal, Puducherry 609602', '+919843020001', '8:00 AM - 9:00 PM',
   10.9250, 79.8380, 4.4, 163, '22 min', '1.5 km', true, 10, '', '',
   'Supermarket for groceries and household items.'),

  ('store-demo-py1-mart-2', 'MART'::app_brand, 'Vallalar Provision Store', 'sel-demo-py1-mart-2',
   'PY', 'No. 9, Kamaraj Salai, Karaikal, Puducherry 609602', '+919843020002', '7:00 AM - 8:30 PM',
   10.9180, 79.8330, 0, 0, '26 min', '1.9 km', false, 10, '', '',
   'Daily provisions and groceries.'),

  ('store-demo-py1-food-1', 'FOOD'::app_brand, 'Hotel Aristo Karaikal', 'sel-demo-py1-food-1',
   'PY', 'No. 12, Church Street, Karaikal, Puducherry 609602', '+919843020003', '7:00 AM - 10:30 PM',
   10.9270, 79.8360, 4.5, 298, '30 min', '1.8 km', true, 15, '34522033000234', '',
   'Multi-cuisine restaurant and tiffin.'),

  ('store-demo-py1-food-2', 'FOOD'::app_brand, 'Sangam Mess', 'sel-demo-py1-food-2',
   'PY', 'No. 78, Nagore Road, Karaikal, Puducherry 609602', '+919843020004', '6:30 AM - 10:00 PM',
   10.9200, 79.8300, 0, 0, '28 min', '2.3 km', false, 12, '', '',
   'Home-style meals and tiffin.'),

  ('store-demo-py1-pharma-1', 'PHARMA'::app_brand, 'Maruthi Medicals', 'sel-demo-py1-pharma-1',
   'PY', 'No. 3, Beach Road, Karaikal, Puducherry 609602', '+919843020005', '9:00 AM - 10:00 PM',
   10.9230, 79.8400, 4.3, 121, '16 min', '1.1 km', true, 10, '', 'PY-KKL-20B-43210',
   'Medicines, devices and wellness.'),

  ('store-demo-py1-pharma-2', 'PHARMA'::app_brand, 'Annai Pharmacy', 'sel-demo-py1-pharma-2',
   'PY', 'No. 21, Ammaiyappan Street, Karaikal, Puducherry 609602', '+919843020006', '8:30 AM - 9:30 PM',
   10.9160, 79.8270, 0, 0, '20 min', '2.2 km', false, 10, '', 'PY-KKL-20B-87654',
   'Pharmacy and health essentials.'),

  ('store-demo-py1-mart-3', 'MART'::app_brand, 'Bharathi Stores', 'sel-demo-py1-mart-3',
   'PY', 'No. 55, Market Road, Karaikal, Puducherry 609602', '+919843020007', '7:00 AM - 9:00 PM',
   10.9190, 79.8350, 0, 0, '24 min', '1.7 km', false, 10, '', '',
   'Provisions and general store.')
on conflict (id) do nothing;

commit;

-- ================================================================ cleanup (run manually to remove)
-- begin;
--   delete from directory.stores where id like 'store-demo-%';
--   delete from sellers.kyc_documents where kyc_id like 'kyc-demo-%';
--   delete from sellers.bank_accounts where bank_account_id like 'bank-demo-%';
--   delete from sellers.sellers where seller_id like 'sel-demo-%';
-- commit;
