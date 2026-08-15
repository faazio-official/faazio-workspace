/**
 * @mock Static fixture — seeded sample data for local development until the Go Chi
 * backend (server/) is wired. See data/DATA_CONTROL.md.
 */

/** Category-capable sub-apps (Food has no category tree). */
export type CategoryAppId = 'FA_MART' | 'GROCERY' | 'PHARMA';

/** One tappable subcategory card in the grid. Routes to Search via `searchQuery`. */
export interface CategoryItem {
  id: string;
  name: string;
  image: string;
  /** Free-text query passed to the Search screen for this sub-app. */
  searchQuery: string;
  /** Optional stable taxonomy id (kept for backward-compat with existing data). */
  categoryId?: string;
  /** Source sub-app for this item (used when a merged 'All' tree routes cross-app). */
  app?: CategoryAppId;
}

/** A section within the right panel — a titled group of subcategory cards. */
export interface CategorySubgroup {
  id: string;
  title: string;
  categoryId?: string;
  items: CategoryItem[];
}

/** One entry in the left sidebar rail → shows the tab and its subgroups. */
export interface CategoryTab {
  id: string;
  title: string;
  icon: string;
  categoryId?: string;
  subgroups: CategorySubgroup[];
}

/** Brand accents used by the Master Categories panel and Catalog screens. */
export const MART_ACCENT = '#E6A800';
export const GROCERY_ACCENT = '#15803D';
export const PHARMA_ACCENT = '#0B7B83';
export const ALL_ACCENT = '#7C3AED';

/** Rail chips for the unified categories page. 'ALL' merges every app's tree. */
export const CATEGORY_RAIL: {
  id: 'ALL' | CategoryAppId;
  label: string;
  accent: string;
  onAccent: string;
}[] = [
  { id: 'ALL', label: 'All', accent: ALL_ACCENT, onAccent: '#FFFFFF' },
  { id: 'FA_MART', label: 'Mart', accent: MART_ACCENT, onAccent: '#FFFFFF' },
  { id: 'GROCERY', label: 'Grocery', accent: GROCERY_ACCENT, onAccent: '#FFFFFF' },
  { id: 'PHARMA', label: 'Pharma', accent: PHARMA_ACCENT, onAccent: '#FFFFFF' },
];

/**
 * Deep category tree for the universal "Master Categories" page.
 * Each sub-app (Mart, Grocery, Pharma) exposes a set of top-level tabs ->
 * subgroups -> items. Items carry a `searchQuery` used to route straight into
 * that sub-app's Search config (never a Catalog page).
 *
 * Subgroups intentionally contain > 5 items so the panel's client-side
 * "View All" pagination (first 5 + a 6th load-more cell) has data to expand.
 */
const MART_TABS: CategoryTab[] = [
  {
    id: 'cat_smart_gadgets',
    title: 'Smart Gadgets',
    icon: 'https://img.icons8.com/color/96/apple-watch-apps.png',
    subgroups: [
      {
        id: 'sg_audio',
        title: 'Headphones & Speakers',
        items: [
          { id: 'sub_bt_head', name: 'Bluetooth Headphones', image: 'https://img.icons8.com/color/96/headphones.png', searchQuery: 'Bluetooth Headphones' },
          { id: 'sub_neck', name: 'Neckbands', image: 'https://img.icons8.com/color/96/earbud-headphones.png', searchQuery: 'Neckbands' },
          { id: 'sub_party', name: 'Party Speakers', image: 'https://img.icons8.com/color/96/subwoofer.png', searchQuery: 'Party Speakers' },
          { id: 'sub_soundbar', name: 'Soundbars', image: 'https://img.icons8.com/color/96/soundbar.png', searchQuery: 'Soundbar' },
          { id: 'sub_mobile_spk', name: 'Mobile speakers', image: 'https://img.icons8.com/color/96/portable-speaker.png', searchQuery: 'Portable Bluetooth Speaker' },
          { id: 'sub_wired', name: 'Wired Earphones', image: 'https://img.icons8.com/color/96/wired-headphones.png', searchQuery: 'Wired Earphones' },
          { id: 'sub_tws', name: 'TWS Earbuds', image: 'https://img.icons8.com/color/96/airpods.png', searchQuery: 'TWS Earbuds' },
        ],
      },
      {
        id: 'sg_wearables',
        title: 'Smart Wearables',
        items: [
          { id: 'sub_bands', name: 'Smart Bands', image: 'https://img.icons8.com/color/96/smart-band.png', searchQuery: 'Smart Fitness Band' },
          { id: 'sub_rings', name: 'Smart Rings', image: 'https://img.icons8.com/color/96/ring.png', searchQuery: 'Smart Ring' },
          { id: 'sub_tags', name: 'Smart Tags', image: 'https://img.icons8.com/color/96/rfid-signal.png', searchQuery: 'Smart Tracker Tag' },
          { id: 'sub_call_watch', name: 'Bluetooth Calling', image: 'https://img.icons8.com/color/96/smart-watch.png', searchQuery: 'Bluetooth Calling Smartwatch' },
          { id: 'sub_amoled', name: 'AMOLED Display', image: 'https://img.icons8.com/color/96/apple-watch.png', searchQuery: 'AMOLED Smartwatch' },
          { id: 'sub_square', name: 'Square Smartwatches', image: 'https://img.icons8.com/color/96/smartwatch-app.png', searchQuery: 'Square Dial Smartwatch' },
        ],
      },
    ],
  },
  {
    id: 'cat_mobiles',
    title: 'Mobiles & Tablets',
    icon: 'https://img.icons8.com/color/96/smartphone.png',
    subgroups: [
      {
        id: 'sg_phones',
        title: 'Smartphones',
        items: [
          { id: 'sub_android', name: 'Android Phones', image: 'https://img.icons8.com/color/96/android.png', searchQuery: 'Android Smartphone' },
          { id: 'sub_iphone', name: 'iPhones', image: 'https://img.icons8.com/color/96/apple-phone.png', searchQuery: 'iPhone' },
          { id: 'sub_5g', name: '5G Phones', image: 'https://img.icons8.com/color/96/smartphone-5g.png', searchQuery: '5G Mobile' },
          { id: 'sub_gaming', name: 'Gaming Phones', image: 'https://img.icons8.com/color/96/game-controller.png', searchQuery: 'Gaming Phone' },
          { id: 'sub_rugged', name: 'Rugged Phones', image: 'https://img.icons8.com/color/96/mobile-protection.png', searchQuery: 'Rugged Smartphone' },
          { id: 'sub_fold', name: 'Foldables', image: 'https://img.icons8.com/color/96/phone-flip.png', searchQuery: 'Foldable Phone' },
        ],
      },
      {
        id: 'sg_tablets',
        title: 'Tablets',
        items: [
          { id: 'sub_ipad', name: 'iPads', image: 'https://img.icons8.com/color/96/ipad.png', searchQuery: 'iPad' },
          { id: 'sub_android_tab', name: 'Android Tablets', image: 'https://img.icons8.com/color/96/tablet-android.png', searchQuery: 'Android Tablet' },
          { id: 'sub_pen_tab', name: 'Stylus Tablets', image: 'https://img.icons8.com/color/96/stylus.png', searchQuery: 'Stylus Tablet' },
        ],
      },
    ],
  },
  {
    id: 'cat_electronics',
    title: 'Electronics',
    icon: 'https://img.icons8.com/color/96/tv.png',
    subgroups: [
      {
        id: 'sg_tv',
        title: 'Televisions',
        items: [
          { id: 'sub_oled_tv', name: 'OLED TVs', image: 'https://img.icons8.com/color/96/oled-tv.png', searchQuery: 'OLED TV' },
          { id: 'sub_qled', name: 'QLED TVs', image: 'https://img.icons8.com/color/96/qled-tv.png', searchQuery: 'QLED TV' },
          { id: 'sub_4k', name: '4K Smart TVs', image: 'https://img.icons8.com/color/96/television.png', searchQuery: '4K Smart TV' },
          { id: 'sub_soundbars_tv', name: 'TV Soundbars', image: 'https://img.icons8.com/color/96/soundbar.png', searchQuery: 'TV Soundbar' },
          { id: 'sub_stream', name: 'Streaming Sticks', image: 'https://img.icons8.com/color/96/chromecast.png', searchQuery: 'Streaming Device' },
        ],
      },
      {
        id: 'sg_laptops',
        title: 'Laptops & Desktops',
        items: [
          { id: 'sub_ultrabook', name: 'Ultrabooks', image: 'https://img.icons8.com/color/96/laptop.png', searchQuery: 'Ultrabook Laptop' },
          { id: 'sub_gaming_lap', name: 'Gaming Laptops', image: 'https://img.icons8.com/color/96/gaming-laptop.png', searchQuery: 'Gaming Laptop' },
          { id: 'sub_2in1', name: '2-in-1 Laptops', image: 'https://img.icons8.com/color/96/laptop-2-in-1.png', searchQuery: '2 in 1 Laptop' },
          { id: 'sub_desktop', name: 'Desktop PCs', image: 'https://img.icons8.com/color/96/desktop-computer.png', searchQuery: 'Desktop Computer' },
          { id: 'sub_monitor', name: 'Monitors', image: 'https://img.icons8.com/color/96/monitor.png', searchQuery: 'Monitor' },
        ],
      },
    ],
  },
  {
    id: 'cat_fashion',
    title: 'Fashion',
    icon: 'https://img.icons8.com/color/96/t-shirt.png',
    subgroups: [
      {
        id: 'sg_men',
        title: 'Men',
        items: [
          { id: 'sub_tshirts', name: 'T-Shirts', image: 'https://img.icons8.com/color/96/t-shirt.png', searchQuery: 'Men T-Shirts' },
          { id: 'sub_shirts', name: 'Shirts', image: 'https://img.icons8.com/color/96/shirt.png', searchQuery: 'Men Shirts' },
          { id: 'sub_jeans', name: 'Jeans', image: 'https://img.icons8.com/color/96/jeans.png', searchQuery: 'Men Jeans' },
          { id: 'sub_sneakers', name: 'Sneakers', image: 'https://img.icons8.com/color/96/sneakers.png', searchQuery: 'Sneakers' },
          { id: 'sub_watches', name: 'Watches', image: 'https://img.icons8.com/color/96/watch.png', searchQuery: 'Men Watch' },
        ],
      },
      {
        id: 'sg_women',
        title: 'Women',
        items: [
          { id: 'sub_kurtas', name: 'Kurtas', image: 'https://img.icons8.com/color/96/kurta.png', searchQuery: 'Women Kurtas' },
          { id: 'sub_dresses', name: 'Dresses', image: 'https://img.icons8.com/color/96/dress.png', searchQuery: 'Women Dresses' },
          { id: 'sub_handbags', name: 'Handbags', image: 'https://img.icons8.com/color/96/handbag-women.png', searchQuery: 'Women Handbags' },
          { id: 'sub_heels', name: 'Heels', image: 'https://img.icons8.com/color/96/high-heels.png', searchQuery: 'Women Heels' },
          { id: 'sub_jewellery', name: 'Jewellery', image: 'https://img.icons8.com/color/96/diamond.png', searchQuery: 'Women Jewellery' },
        ],
      },
    ],
  },
  {
    id: 'cat_home',
    title: 'Home & Kitchen',
    icon: 'https://img.icons8.com/color/96/kitchen.png',
    subgroups: [
      {
        id: 'sg_small_appliances',
        title: 'Small Appliances',
        items: [
          { id: 'sub_mixers', name: 'Mixer Grinders', image: 'https://img.icons8.com/color/96/mixer.png', searchQuery: 'Mixer Grinder' },
          { id: 'sub_toasters', name: 'Toasters', image: 'https://img.icons8.com/color/96/toaster.png', searchQuery: 'Toaster' },
          { id: 'sub_induction', name: 'Induction Cooktops', image: 'https://img.icons8.com/color/96/induction-cooktop.png', searchQuery: 'Induction Cooktop' },
          { id: 'sub_kettles', name: 'Electric Kettles', image: 'https://img.icons8.com/color/96/electric-kettle.png', searchQuery: 'Electric Kettle' },
          { id: 'sub_irons', name: 'Irons', image: 'https://img.icons8.com/color/96/iron.png', searchQuery: 'Clothes Iron' },
        ],
      },
      {
        id: 'sg_furniture',
        title: 'Furniture',
        items: [
          { id: 'sub_sofas', name: 'Sofas', image: 'https://img.icons8.com/color/96/sofa.png', searchQuery: 'Sofa' },
          { id: 'sub_tables', name: 'Coffee Tables', image: 'https://img.icons8.com/color/96/coffee-table.png', searchQuery: 'Coffee Table' },
          { id: 'sub_lamps', name: 'Lamps', image: 'https://img.icons8.com/color/96/floor-lamp.png', searchQuery: 'Floor Lamp' },
          { id: 'sub_storage', name: 'Storage Racks', image: 'https://img.icons8.com/color/96/storage.png', searchQuery: 'Storage Rack' },
        ],
      },
    ],
  },
];

const GROCERY_TABS: CategoryTab[] = [
  {
    id: 'cat_fruits_veg',
    title: 'Fruits & Veggies',
    icon: 'https://img.icons8.com/color/96/vegetables.png',
    subgroups: [
      {
        id: 'sg_fruits',
        title: 'Fresh Fruits',
        items: [
          { id: 'sub_apples', name: 'Apples', image: 'https://img.icons8.com/color/96/apple.png', searchQuery: 'Fresh Apples' },
          { id: 'sub_bananas', name: 'Bananas', image: 'https://img.icons8.com/color/96/banana.png', searchQuery: 'Bananas' },
          { id: 'sub_mangoes', name: 'Mangoes', image: 'https://img.icons8.com/color/96/mango.png', searchQuery: 'Alphonso Mango' },
          { id: 'sub_oranges', name: 'Oranges', image: 'https://img.icons8.com/color/96/orange.png', searchQuery: 'Oranges' },
          { id: 'sub_grapes', name: 'Grapes', image: 'https://img.icons8.com/color/96/grapes.png', searchQuery: 'Fresh Grapes' },
          { id: 'sub_strawberry', name: 'Strawberries', image: 'https://img.icons8.com/color/96/strawberry.png', searchQuery: 'Strawberries' },
          { id: 'sub_pomegranate', name: 'Pomegranate', image: 'https://img.icons8.com/color/96/pomegranate.png', searchQuery: 'Pomegranate' },
        ],
      },
      {
        id: 'sg_veg',
        title: 'Fresh Vegetables',
        items: [
          { id: 'sub_onion', name: 'Onions', image: 'https://img.icons8.com/color/96/onion.png', searchQuery: 'Onions' },
          { id: 'sub_tomato', name: 'Tomatoes', image: 'https://img.icons8.com/color/96/tomato.png', searchQuery: 'Tomatoes' },
          { id: 'sub_potato', name: 'Potatoes', image: 'https://img.icons8.com/color/96/potato.png', searchQuery: 'Potatoes' },
          { id: 'sub_carrot', name: 'Carrots', image: 'https://img.icons8.com/color/96/carrot.png', searchQuery: 'Carrots' },
          { id: 'sub_peppers', name: 'Bell Peppers', image: 'https://img.icons8.com/color/96/pepper.png', searchQuery: 'Bell Pepper' },
        ],
      },
    ],
  },
  {
    id: 'cat_dairy',
    title: 'Dairy & Eggs',
    icon: 'https://img.icons8.com/color/96/milk-carton.png',
    subgroups: [
      {
        id: 'sg_milk',
        title: 'Milk & Curd',
        items: [
          { id: 'sub_milk', name: 'Fresh Milk', image: 'https://img.icons8.com/color/96/milk.png', searchQuery: 'Fresh Milk' },
          { id: 'sub_curd', name: 'Curd', image: 'https://img.icons8.com/color/96/yogurt.png', searchQuery: 'Curd' },
          { id: 'sub_paneer', name: 'Paneer', image: 'https://img.icons8.com/color/96/paneer.png', searchQuery: 'Fresh Paneer' },
          { id: 'sub_butter', name: 'Butter', image: 'https://img.icons8.com/color/96/butter.png', searchQuery: 'Butter' },
          { id: 'sub_cheese', name: 'Cheese', image: 'https://img.icons8.com/color/96/cheese.png', searchQuery: 'Cheese' },
          { id: 'sub_eggs', name: 'Eggs', image: 'https://img.icons8.com/color/96/eggs.png', searchQuery: 'Farm Eggs' },
        ],
      },
    ],
  },
  {
    id: 'cat_snacks',
    title: 'Snacks & Beverages',
    icon: 'https://img.icons8.com/color/96/biscuit.png',
    subgroups: [
      {
        id: 'sg_snacks',
        title: 'Snacks & Biscuits',
        items: [
          { id: 'sub_biscuits', name: 'Biscuits', image: 'https://img.icons8.com/color/96/biscuit.png', searchQuery: 'Biscuits' },
          { id: 'sub_chips', name: 'Chips', image: 'https://img.icons8.com/color/96/chips.png', searchQuery: 'Potato Chips' },
          { id: 'sub_namkeen', name: 'Namkeen', image: 'https://img.icons8.com/color/96/namkeen.png', searchQuery: 'Namkeen' },
          { id: 'sub_choco', name: 'Chocolates', image: 'https://img.icons8.com/color/96/chocolate-bar.png', searchQuery: 'Chocolates' },
          { id: 'sub_nuts', name: 'Dry Fruits & Nuts', image: 'https://img.icons8.com/color/96/nuts.png', searchQuery: 'Dry Fruits' },
        ],
      },
      {
        id: 'sg_beverages',
        title: 'Beverages',
        items: [
          { id: 'sub_tea', name: 'Tea', image: 'https://img.icons8.com/color/96/tea.png', searchQuery: 'Tea' },
          { id: 'sub_coffee', name: 'Coffee', image: 'https://img.icons8.com/color/96/coffee.png', searchQuery: 'Coffee Powder' },
          { id: 'sub_juice', name: 'Fruit Juices', image: 'https://img.icons8.com/color/96/juice.png', searchQuery: 'Fruit Juice' },
          { id: 'sub_soda', name: 'Soft Drinks', image: 'https://img.icons8.com/color/96/soda-can.png', searchQuery: 'Soft Drink' },
          { id: 'sub_water', name: 'Water & Energy', image: 'https://img.icons8.com/color/96/water-bottle.png', searchQuery: 'Packaged Water' },
        ],
      },
    ],
  },
  {
    id: 'cat_grains',
    title: 'Grains & Staples',
    icon: 'https://img.icons8.com/color/96/wheat.png',
    subgroups: [
      {
        id: 'sg_rice',
        title: 'Rice & Flour',
        items: [
          { id: 'sub_basmati', name: 'Basmati Rice', image: 'https://img.icons8.com/color/96/rice.png', searchQuery: 'Basmati Rice' },
          { id: 'sub_atta', name: 'Wheat Atta', image: 'https://img.icons8.com/color/96/flour.png', searchQuery: 'Wheat Atta' },
          { id: 'sub_dal', name: 'Dals & Pulses', image: 'https://img.icons8.com/color/96/lentils.png', searchQuery: 'Dals' },
          { id: 'sub_oils', name: 'Cooking Oils', image: 'https://img.icons8.com/color/96/cooking-oil.png', searchQuery: 'Cooking Oil' },
          { id: 'sub_sugar', name: 'Sugar & Salt', image: 'https://img.icons8.com/color/96/sugar.png', searchQuery: 'Sugar' },
          { id: 'sub_spices', name: 'Spices', image: 'https://img.icons8.com/color/96/spices.png', searchQuery: 'Spices' },
        ],
      },
    ],
  },
];

const PHARMA_TABS: CategoryTab[] = [
  {
    id: 'cat_medicines',
    title: 'Medicines & Rx',
    icon: 'https://img.icons8.com/color/96/pill.png',
    subgroups: [
      {
        id: 'sg_pain_fever',
        title: 'Pain & Fever Relief',
        items: [
          { id: 'sub_paracetamol', name: 'Paracetamol', image: 'https://img.icons8.com/color/96/capsule.png', searchQuery: 'Paracetamol' },
          { id: 'sub_ibuprofen', name: 'Ibuprofen', image: 'https://img.icons8.com/color/96/pill.png', searchQuery: 'Ibuprofen' },
          { id: 'sub_pain_balm', name: 'Pain Balms', image: 'https://img.icons8.com/color/96/ointment.png', searchQuery: 'Pain Balm' },
          { id: 'sub_cough', name: 'Cough Syrups', image: 'https://img.icons8.com/color/96/syrup.png', searchQuery: 'Cough Syrup' },
          { id: 'sub_antacid', name: 'Antacids', image: 'https://img.icons8.com/color/96/stomach.png', searchQuery: 'Antacid' },
          { id: 'sub_ayurvedic', name: 'Ayurvedic Relief', image: 'https://img.icons8.com/color/96/herbal.png', searchQuery: 'Ayurvedic Medicine' },
        ],
      },
      {
        id: 'sg_cold',
        title: 'Cold & Allergy',
        items: [
          { id: 'sub_antihist', name: 'Antihistamines', image: 'https://img.icons8.com/color/96/allergy.png', searchQuery: 'Antihistamine' },
          { id: 'sub_vit_c', name: 'Vitamin C', image: 'https://img.icons8.com/color/96/vitamin-c.png', searchQuery: 'Vitamin C' },
          { id: 'sub_lozenges', name: 'Throat Lozenges', image: 'https://img.icons8.com/color/96/candy.png', searchQuery: 'Throat Lozenges' },
          { id: 'sub_salinet', name: 'Saline Nasal Drops', image: 'https://img.icons8.com/color/96/drop.png', searchQuery: 'Saline Nasal Spray' },
        ],
      },
    ],
  },
  {
    id: 'cat_devices',
    title: 'Medical Devices',
    icon: 'https://img.icons8.com/color/96/stethoscope.png',
    subgroups: [
      {
        id: 'sg_monitors',
        title: 'Health Monitors',
        items: [
          { id: 'sub_bp', name: 'BP Monitors', image: 'https://img.icons8.com/color/96/tensiometer.png', searchQuery: 'BP Monitor' },
          { id: 'sub_glucometer', name: 'Glucometers', image: 'https://img.icons8.com/color/96/glucometer.png', searchQuery: 'Glucometer' },
          { id: 'sub_oximeter', name: 'Pulse Oximeters', image: 'https://img.icons8.com/color/96/oximeter.png', searchQuery: 'Pulse Oximeter' },
          { id: 'sub_thermo', name: 'Thermometers', image: 'https://img.icons8.com/color/96/thermometer.png', searchQuery: 'Digital Thermometer' },
          { id: 'sub_neb', name: 'Nebulizers', image: 'https://img.icons8.com/color/96/nebulizer.png', searchQuery: 'Nebulizer' },
          { id: 'sub_inhaler', name: 'Inhalers', image: 'https://img.icons8.com/color/96/inhaler.png', searchQuery: 'Inhaler' },
        ],
      },
    ],
  },
  {
    id: 'cat_vitamins',
    title: 'Vitamins & Supplements',
    icon: 'https://img.icons8.com/color/96/vitamin.png',
    subgroups: [
      {
        id: 'sg_supplements',
        title: 'Daily Supplements',
        items: [
          { id: 'sub_multivit', name: 'Multivitamins', image: 'https://img.icons8.com/color/96/multivitamin.png', searchQuery: 'Multivitamin' },
          { id: 'sub_omega', name: 'Omega 3', image: 'https://img.icons8.com/color/96/fish-oil.png', searchQuery: 'Omega 3 Fish Oil' },
          { id: 'sub_calcium', name: 'Calcium', image: 'https://img.icons8.com/color/96/bone.png', searchQuery: 'Calcium Supplements' },
          { id: 'sub_protein', name: 'Protein Powders', image: 'https://img.icons8.com/color/96/protein.png', searchQuery: 'Protein Powder' },
          { id: 'sub_magnesium', name: 'Magnesium', image: 'https://img.icons8.com/color/96/magnesium.png', searchQuery: 'Magnesium Supplement' },
        ],
      },
    ],
  },
  {
    id: 'cat_personal_care',
    title: 'Personal Care',
    icon: 'https://img.icons8.com/color/96/soap.png',
    subgroups: [
      {
        id: 'sg_skin',
        title: 'Skin & First Aid',
        items: [
          { id: 'sub_bandages', name: 'Bandages & Plasters', image: 'https://img.icons8.com/color/96/bandage.png', searchQuery: 'Bandage' },
          { id: 'sub_antiseptic', name: 'Antiseptics', image: 'https://img.icons8.com/color/96/antiseptic.png', searchQuery: 'Antiseptic Cream' },
          { id: 'sub_moisturizer', name: 'Moisturizers', image: 'https://img.icons8.com/color/96/lotion-bottle.png', searchQuery: 'Moisturizer' },
          { id: 'sub_sunscreen', name: 'Sunscreens', image: 'https://img.icons8.com/color/96/sunscreen.png', searchQuery: 'Sunscreen' },
          { id: 'sub_handwash', name: 'Handwash', image: 'https://img.icons8.com/color/96/hand-soap.png', searchQuery: 'Handwash' },
          { id: 'sub_oraltab', name: 'Oral Care', image: 'https://img.icons8.com/color/96/toothpaste.png', searchQuery: 'Toothpaste' },
        ],
      },
    ],
  },
];

/** Deep category tree keyed by sub-app id, consumed by the Master Categories panel. */
export const MASTER_CATEGORIES: Record<CategoryAppId, CategoryTab[]> = {
  FA_MART: MART_TABS,
  GROCERY: GROCERY_TABS,
  PHARMA: PHARMA_TABS,
};

/** Recursively tag every item in a tree with its source sub-app (for 'All' routing). */
function tagWithApp(tabs: CategoryTab[], app: CategoryAppId): CategoryTab[] {
  return tabs.map((tab) => ({
    ...tab,
    subgroups: tab.subgroups.map((sub) => ({
      ...sub,
      items: sub.items.map((item) => ({ ...item, app })),
    })),
  }));
}

/** Merged 'All' tree — every app's top-level tabs combined into one sidebar. */
export const ALL_TABS: CategoryTab[] = [
  ...tagWithApp(MART_TABS, 'FA_MART'),
  ...tagWithApp(GROCERY_TABS, 'GROCERY'),
  ...tagWithApp(PHARMA_TABS, 'PHARMA'),
];
