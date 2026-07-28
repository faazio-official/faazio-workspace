// Centralized high-quality mock product database for SuperApp (Fa Mart, Food, Grocery, Pharma)
// Every product has custom descriptions, ratings, badges, and professional high-resolution Unsplash image URLs instead of emojis.

export interface BaseProduct {
  id: string;
  name: string;
  price: number;
  emoji: string;
  image: string;
  desc: string;
  rating: number;
  badge?: string;
  badgeBg?: string;
  shop?: string;
}

export interface MartProduct extends BaseProduct {
  category: string;
  reviews: number;
}

export interface GroceryProduct extends BaseProduct {
  category: string;
  unit: string;
}

export interface PharmaProduct extends BaseProduct {
  category: string;
}

export interface FoodProduct {
  id: string;
  name: string;
  price: number;
  emoji: string;
  image: string;
  categories: string[];
  desc: string;
  rating?: number;
  shop?: string;
}

// ----------------------------------------------------
// FA MART PRODUCTS
// ----------------------------------------------------
export const martProducts: MartProduct[] = [
  // Fashion
  {
    id: 'fm-f1',
    category: 'Fashion',
    name: 'Premium Cotton Hoodie',
    price: 1499,
    emoji: '🧥',
    rating: 4.8,
    reviews: 245,
    desc: 'Ultra-soft heavyweight cotton fleece with custom premium Faazio tailoring and dynamic dropped shoulder design.',
    image: 'https://images.unsplash.com/photo-1556821840-3a63f95609a7?auto=format&fit=crop&q=80&w=400&h=400',
    badge: 'Best Seller',
    badgeBg: 'bg-amber-500'
  },
  {
    id: 'fm-f2',
    category: 'Fashion',
    name: 'Chic Leather Jacket',
    price: 3999,
    emoji: '🧥',
    rating: 4.9,
    reviews: 112,
    desc: 'Tailored faux-leather jacket with double chrome zippers and premium satin inner lining.',
    image: 'https://images.unsplash.com/photo-1551028719-00167b16eac5?auto=format&fit=crop&q=80&w=400&h=400',
    badge: 'Hot Drop',
    badgeBg: 'bg-red-500'
  },
  {
    id: 'fm-f3',
    category: 'Fashion',
    name: 'Comfort Street Sneakers',
    price: 2499,
    emoji: '👟',
    rating: 4.7,
    reviews: 389,
    desc: 'Breathable flyknit mesh with lightweight dynamic cushions and ultra-grip durable outsoles.',
    image: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&q=80&w=400&h=400',
    badge: 'Trending',
    badgeBg: 'bg-blue-500'
  },
  // Mobiles
  {
    id: 'fm-m1',
    category: 'Mobiles',
    name: 'Faazio Phone Pro Max',
    price: 89999,
    emoji: '📱',
    rating: 4.9,
    reviews: 1420,
    desc: 'Ultimate ceramic glass screen, ultra wide triple camera, dynamic processor and super long battery life.',
    image: 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&q=80&w=400&h=400',
    badge: 'Flagship',
    badgeBg: 'bg-indigo-600'
  },
  {
    id: 'fm-m2',
    category: 'Mobiles',
    name: 'Infinite Flip 5G',
    price: 69999,
    emoji: '📳',
    rating: 4.6,
    reviews: 94,
    desc: 'Futuristic folding AMOLED screen with zero-gap crease and premium matte titanium frame.',
    image: 'https://images.unsplash.com/photo-1598327105666-5b89351aff97?auto=format&fit=crop&q=80&w=400&h=400',
    badge: 'New Launch',
    badgeBg: 'bg-emerald-500'
  },
  // Beauty
  {
    id: 'fm-b1',
    category: 'Beauty',
    name: 'Organic Hydrating Serum',
    price: 799,
    emoji: '🧴',
    rating: 4.8,
    reviews: 520,
    desc: 'Cold-pressed botanical oil with multi-layer hyaluronic acid to restore glass skin radiance.',
    image: 'https://images.unsplash.com/photo-1608248597481-496100c80836?auto=format&fit=crop&q=80&w=400&h=400',
    badge: 'Eco-Choice',
    badgeBg: 'bg-emerald-500'
  },
  {
    id: 'fm-b2',
    category: 'Beauty',
    name: 'Matte Lip Cream Duo',
    price: 649,
    emoji: '💄',
    rating: 4.5,
    reviews: 177,
    desc: 'Non-drying 12-hour high-pigmented matte finish with nourishing organic jojoba extract.',
    image: 'https://images.unsplash.com/photo-1586495777744-4413f21062fa?auto=format&fit=crop&q=80&w=400&h=400',
    badge: 'Duo Deal',
    badgeBg: 'bg-rose-500'
  },
  // Electronics
  {
    id: 'fm-e1',
    category: 'Electronics',
    name: 'Pro Noise Cancelling Headphones',
    price: 4499,
    emoji: '🎧',
    rating: 4.9,
    reviews: 812,
    desc: 'Hi-Res studio acoustics with hybrid active cancellation, soft memory foam earcups.',
    image: 'https://images.unsplash.com/photo-1546435770-a3e426bf472b?auto=format&fit=crop&q=80&w=400&h=400',
    badge: 'Top Rated',
    badgeBg: 'bg-purple-600'
  },
  {
    id: 'fm-e2',
    category: 'Electronics',
    name: 'Smart Fitness Tracker v3',
    price: 1999,
    emoji: '⌚',
    rating: 4.7,
    reviews: 1104,
    desc: 'Continuous heart tracker, blood oxygen sensor, active sleep staging, and 10 days battery.',
    image: 'https://images.unsplash.com/photo-1575311373937-040b8e1fd5b6?auto=format&fit=crop&q=80&w=400&h=400',
    badge: 'Budget Pick',
    badgeBg: 'bg-[#2F80ED]'
  },
  {
    id: 'fm-e3',
    category: 'Electronics',
    name: 'Slim Mechanical Keyboard',
    price: 2999,
    emoji: '⌨️',
    rating: 4.8,
    reviews: 310,
    desc: 'Gateron brown switches, vibrant customizable RGB backlight, and durable aluminum top plate.',
    image: 'https://images.unsplash.com/photo-1587829741301-dc798b83add3?auto=format&fit=crop&q=80&w=400&h=400',
    badge: 'Popular',
    badgeBg: 'bg-slate-700'
  },
  // Toys & Sports
  {
    id: 'fm-t1',
    category: 'Toys',
    name: 'High-Speed RC Racing Car',
    price: 1249,
    emoji: '🏎️',
    rating: 4.7,
    reviews: 156,
    desc: '2.4GHz full-scale high speed RC model with modular rechargeable batteries and premium suspension.',
    image: 'https://images.unsplash.com/photo-1594787318286-3d835c1d207f?auto=format&fit=crop&q=80&w=400&h=400',
    badge: 'Kids Pick',
    badgeBg: 'bg-sky-500'
  },
  {
    id: 'fm-s1',
    category: 'Sports',
    name: 'Adjustable Kettlebell Set',
    price: 2199,
    emoji: '🏋️',
    rating: 4.8,
    reviews: 293,
    desc: 'Solid cast-iron handles, rapid weight locks up to 10kg, textured handle grip.',
    image: 'https://images.unsplash.com/photo-1517838277536-f5f99be501cd?auto=format&fit=crop&q=80&w=400&h=400',
    badge: 'Heavy Duty',
    badgeBg: 'bg-stone-700'
  },
  // Books & Stationery
  {
    id: 'fm-bk1',
    category: 'Books & Stationery',
    name: 'Executive Hardcover Journal & Pen Set',
    price: 899,
    emoji: '📓',
    rating: 4.9,
    reviews: 420,
    desc: 'Premium 120gsm bleed-proof dotted paper with a crafted brass rollerball writing pen.',
    image: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&q=80&w=400&h=400',
    badge: 'Best Seller',
    badgeBg: 'bg-amber-600'
  },
  {
    id: 'fm-bk2',
    category: 'Books & Stationery',
    name: 'Scientific Graphic Calculator v4',
    price: 3499,
    emoji: '🧮',
    rating: 4.8,
    reviews: 180,
    desc: 'High-resolution multi-line LCD display with 400+ advanced mathematical and plotting functions.',
    image: 'https://images.unsplash.com/photo-1594980596870-8aa52a78d8cd?auto=format&fit=crop&q=80&w=400&h=400',
    badge: 'Student Choice',
    badgeBg: 'bg-blue-600'
  },
  // Home Appliances
  {
    id: 'fm-ha1',
    category: 'Home Appliances',
    name: 'Smart Wi-Fi Air Purifier Pro',
    price: 8999,
    emoji: '🌪️',
    rating: 4.9,
    reviews: 650,
    desc: 'True HEPA H13 filter removes 99.97% of dust and smoke with real-time app air quality monitoring.',
    image: 'https://images.unsplash.com/photo-1585771724684-38269d6639fd?auto=format&fit=crop&q=80&w=400&h=400',
    badge: 'Mega Deal',
    badgeBg: 'bg-emerald-600'
  },
  {
    id: 'fm-ha2',
    category: 'Home Appliances',
    name: 'Digital Touch Air Fryer 5L',
    price: 5499,
    emoji: '🍟',
    rating: 4.8,
    reviews: 890,
    desc: 'Rapid hot air circulation with 8 preset cooking modes and non-stick dishwasher safe basket.',
    image: 'https://images.unsplash.com/photo-1556911220-e15b29be8c8f?auto=format&fit=crop&q=80&w=400&h=400',
    badge: '40% OFF',
    badgeBg: 'bg-rose-600'
  },
  // Furniture
  {
    id: 'fm-fur1',
    category: 'Furniture',
    name: 'Ergonomic Mesh Office Chair',
    price: 11999,
    emoji: '🪑',
    rating: 4.9,
    reviews: 310,
    desc: 'Adjustable lumbar support, 3D armrests, breathable Korean mesh, and heavy-duty steel base.',
    image: 'https://images.unsplash.com/photo-1580481077494-e3299ac2fef6?auto=format&fit=crop&q=80&w=400&h=400',
    badge: 'Luxe Pick',
    badgeBg: 'bg-indigo-600'
  },
  {
    id: 'fm-fur2',
    category: 'Furniture',
    name: 'Minimalist Solid Oak Study Desk',
    price: 14500,
    emoji: '🗄️',
    rating: 4.7,
    reviews: 145,
    desc: 'Natural oak wood tabletop with integrated cable management and matte black steel frame.',
    image: 'https://images.unsplash.com/photo-1518455027359-f3f8164ba6bd?auto=format&fit=crop&q=80&w=400&h=400',
    badge: 'Premium',
    badgeBg: 'bg-stone-800'
  },
  // Toys & Gifts
  {
    id: 'fm-tg1',
    category: 'Toys & Gifts',
    name: 'Modular Magnetic Building Blocks (100p)',
    price: 2499,
    emoji: '🧱',
    rating: 4.9,
    reviews: 540,
    desc: 'Vibrant translucent magnetic tiles for 3D architecture, STEM learning, and creative play.',
    image: 'https://images.unsplash.com/photo-1587654780291-39c9404d746b?auto=format&fit=crop&q=80&w=400&h=400',
    badge: 'Kids Top Pick',
    badgeBg: 'bg-purple-600'
  }
];

// ----------------------------------------------------
// GROCERY PRODUCTS
// ----------------------------------------------------
export const groceryProducts: GroceryProduct[] = [
  {
    id: 'gr-p1',
    category: 'Fresh Produce',
    name: 'Organic Royal Gala Apples',
    price: 249,
    unit: '1 kg',
    emoji: '🍎',
    rating: 4.9,
    desc: 'Crisp, sweet, hand-picked organic apples directly from certified zero-pesticide orchards.',
    image: 'https://images.unsplash.com/photo-1560806887-1e4cd0b6cbd6?auto=format&fit=crop&q=80&w=400&h=400',
    badge: '100% Organic'
  },
  {
    id: 'gr-p2',
    category: 'Fresh Produce',
    name: 'Fresh Farm Broccoli Crown',
    price: 120,
    unit: '500g',
    emoji: '🥦',
    rating: 4.8,
    desc: 'Vibrant green broccoli crown packed with fibers and iron, harvested fresh from local farms.',
    image: 'https://images.unsplash.com/photo-1515002246390-7bf7e8f87b54?auto=format&fit=crop&q=80&w=400&h=400',
    badge: 'Farm Pick'
  },
  {
    id: 'gr-p3',
    category: 'Dairy & Eggs',
    name: 'Fresh Farm Whole Milk',
    price: 75,
    unit: '1 L',
    emoji: '🥛',
    rating: 4.9,
    desc: 'Pasteurized grass-fed whole cow milk with full cream nutrition, delivered cold.',
    image: 'https://images.unsplash.com/photo-1550583724-b2692b85b150?auto=format&fit=crop&q=80&w=400&h=400',
    badge: 'Rich Cream'
  },
  {
    id: 'gr-p4',
    category: 'Bakery',
    name: 'Artisan Sourdough Loaf',
    price: 150,
    unit: '450g',
    emoji: '🍞',
    rating: 4.8,
    desc: 'Freshly baked naturally leavened crispy golden sourdough crust with soft, airy interior.',
    image: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&q=80&w=400&h=400',
    badge: 'Baked Daily'
  },
  {
    id: 'gr-p5',
    category: 'Beverages',
    name: 'Almond Milk Unsweetened',
    price: 190,
    unit: '1 L',
    emoji: '🥛',
    rating: 4.7,
    desc: 'Smooth, tasty dairy-free milk crafted from lightly toasted organic Mediterranean almonds.',
    image: 'https://images.unsplash.com/photo-1553456558-aff63285bdd1?auto=format&fit=crop&q=80&w=400&h=400',
    badge: 'Vegan Fit'
  },
  {
    id: 'gr-p6',
    category: 'Snacks',
    name: 'Sea Salt Multigrain Crisps',
    price: 95,
    unit: '150g',
    emoji: '🍿',
    rating: 4.6,
    desc: 'Baked whole grains with fine crystals of natural pink Himalayan salt, crisp and delicious.',
    image: 'https://images.unsplash.com/photo-1599490659213-e2b9527bb087?auto=format&fit=crop&q=80&w=400&h=400',
    badge: 'Gluten-Free'
  },
  {
    id: 'gr-p7',
    category: 'Beverages',
    name: 'Arabica Coffee Beans Medium',
    price: 450,
    unit: '250g',
    emoji: '☕',
    rating: 4.9,
    desc: 'Freshly roasted single-origin rich aroma beans with subtle notes of caramel and hazelnut.',
    image: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&q=80&w=400&h=400',
    badge: 'Premium'
  }
];

// ----------------------------------------------------
// PHARMA PRODUCTS
// ----------------------------------------------------
export const pharmaProducts: PharmaProduct[] = [
  {
    id: 'ph-1',
    category: 'Vitamins',
    name: 'Faazio Vitamin C Gummies 1000mg',
    price: 499,
    emoji: '🍊',
    rating: 4.9,
    desc: 'Supports daily immune health & collagen absorption. 100% organic fruit pectin formula.',
    image: 'https://images.unsplash.com/photo-1584017911766-d451b3d0e843?auto=format&fit=crop&q=80&w=400&h=400',
    badge: 'Best Seller'
  },
  {
    id: 'ph-2',
    category: 'Pain Relief',
    name: 'Premium Pain Reliever (Ibuprofen)',
    price: 95,
    emoji: '💊',
    rating: 4.8,
    desc: 'Fast acting relief for muscle pain, headache, dental aches, & backache.',
    image: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?auto=format&fit=crop&q=80&w=400&h=400',
    badge: 'Essential'
  },
  {
    id: 'ph-3',
    category: 'First Aid',
    name: 'Ultimate First Aid Medical Kit',
    price: 799,
    emoji: '🩹',
    rating: 4.9,
    desc: 'Packed with 120 antiseptic supplies, flexible fabric bandages, & sterile gauze pads.',
    image: 'https://images.unsplash.com/photo-1603398938378-e54eab446dde?auto=format&fit=crop&q=80&w=400&h=400',
    badge: 'FDA Vetted'
  },
  {
    id: 'ph-4',
    category: 'Devices',
    name: 'Digital Blood Pressure Monitor',
    price: 1899,
    emoji: '⌚',
    rating: 4.7,
    desc: 'Accurate dynamic pulse tracking with custom high contrast screen and smart posture sensor.',
    image: 'https://images.unsplash.com/photo-1551076805-e1869033e561?auto=format&fit=crop&q=80&w=400&h=400',
    badge: 'Smart Device'
  },
  {
    id: 'ph-5',
    category: 'Vitamins',
    name: 'Organic Herbal Sleep Elixir',
    price: 599,
    emoji: '🍵',
    rating: 4.6,
    desc: 'Infused with organic chamomile, valerian root, & melatonin to naturally aid restful sleep.',
    image: 'https://images.unsplash.com/photo-1607619056574-7b8d304f2c38?auto=format&fit=crop&q=80&w=400&h=400',
    badge: '100% Organic'
  }
];

// ----------------------------------------------------
// FOOD PRODUCTS (DISHES)
// ----------------------------------------------------
export const foodProducts: FoodProduct[] = [
  {
    id: 'm-squid-sweet',
    name: 'Squid Sweet & Sour',
    price: 399,
    emoji: '🦑',
    image: 'https://images.unsplash.com/photo-1534422298391-e4f8c172dddb?auto=format&fit=crop&q=80&w=400&h=400',
    categories: ['All', 'Top of Week', 'Seafood'],
    desc: 'Zesty wok-tossed premium squid, caramelized pineapples, and a rich sweet & sour glaze.',
    rating: 4.9
  },
  {
    id: 'm-pepper-beef',
    name: 'Black Pepper Beef',
    price: 549,
    emoji: '🥩',
    image: 'https://images.unsplash.com/photo-1534939561126-855b8675edd7?auto=format&fit=crop&q=80&w=400&h=400',
    categories: ['All', 'Top of Week', 'Featured'],
    desc: 'Tender grain-fed beef slices sautéed with crushed tellicherry black pepper and spring onion.',
    rating: 4.8
  },
  {
    id: 'm-mushroom-soup',
    name: 'Creamy Mushroom Soup',
    price: 220,
    emoji: '🥣',
    image: 'https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&q=80&w=400&h=400',
    categories: ['All', 'Soup'],
    desc: 'Velvety puréed forest mushrooms, simmered light cream, and wild truffle oil drizzle.',
    rating: 4.7
  },
  {
    id: 'm-seafood-ramen',
    name: 'Spicy Seafood Ramen',
    price: 450,
    emoji: '🍜',
    image: 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?auto=format&fit=crop&q=80&w=400&h=400',
    categories: ['All', 'Seafood', 'Top of Week'],
    desc: 'House-made wheat noodles in spicy slow-simmered seafood broth, topped with Tiger prawns.',
    rating: 4.9
  },
  {
    id: 'm-chicken-rice',
    name: 'Hainanese Chicken Rice',
    price: 349,
    emoji: '🍛',
    image: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&q=80&w=400&h=400',
    categories: ['All', 'Featured'],
    desc: 'Tender poached farm chicken served over fragrant ginger rice with chili soy sauce.',
    rating: 4.8
  },
  {
    id: 'm-crispy-dumplings',
    name: 'Golden Crispy Dumplings',
    price: 280,
    emoji: '🥟',
    image: 'https://images.unsplash.com/photo-1563245372-f21724e3856d?auto=format&fit=crop&q=80&w=400&h=400',
    categories: ['All', 'Featured'],
    desc: 'Pan-seared handmade wrappers filled with fresh seasoned chicken & Chinese chives.',
    rating: 4.6
  }
];

// Helper top-of-week dishes mapping for FoodPage
export const topOfWeekDishes = [
  {
    id: 'tow-1',
    name: 'Hongkong Hainanese Chicken Rice',
    price: 349,
    emoji: '🍛',
    image: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&q=80&w=400&h=400',
    desc: 'Slow poached organic chicken, fragrant jasmine rice with cool cucumber.'
  },
  {
    id: 'tow-2',
    name: 'Hot & Sour Corn Soup',
    price: 249,
    emoji: '🍜',
    image: 'https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&q=80&w=400&h=400',
    desc: 'Authentic Sichuan spices, sweet golden corn, and organic field greens.'
  },
  {
    id: 'tow-3',
    name: 'Singapura Hainan Curry',
    price: 499,
    emoji: '🍛',
    image: 'https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?auto=format&fit=crop&q=80&w=400&h=400',
    desc: 'Rich coconut curry leaf broth, fresh wild prawns & golden tofu puffs.'
  }
];

// ----------------------------------------------------
// SPONSORED/CATEGORIES SEARCH DATABASE FOR CATEGORIES VIEW
// ----------------------------------------------------
export const categoriesSearchDatabase: { [key: string]: Array<BaseProduct & { app: string; catName: string }> } = {
  'food-main': [
    {
      id: 'cat-fm-1',
      app: 'FOOD',
      catName: 'Sizzling Entrees',
      name: 'Slow Cooked Awadhi Mutton Biryani',
      price: 550,
      emoji: '🍛',
      desc: 'Saffron-infused premium basmati with tender pieces of slow cooked lamb.',
      rating: 4.9,
      image: 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?auto=format&fit=crop&q=80&w=400&h=400'
    },
    {
      id: 'cat-fm-2',
      app: 'FOOD',
      catName: 'Sizzling Entrees',
      name: 'Sizzling Garlic Naan & Paneer Butter',
      price: 380,
      emoji: '🍛',
      desc: 'Classic punjabi charcoal naan baked to order with creamy butter gravy.',
      rating: 4.8,
      image: 'https://images.unsplash.com/photo-1565557623262-b51c2513a641?auto=format&fit=crop&q=80&w=400&h=400'
    },
    {
      id: 'cat-fm-3',
      app: 'FOOD',
      catName: 'Sizzling Entrees',
      name: 'Gourmet Woodfired Margherita Pizza',
      price: 440,
      emoji: '🍕',
      desc: 'Hand stretched artisanal sourdough topped with fresh pulled mozzarella.',
      rating: 4.9,
      image: 'https://images.unsplash.com/photo-1604382354936-07c5d9983bd3?auto=format&fit=crop&q=80&w=400&h=400'
    }
  ],
  'food-snack': [
    {
      id: 'cat-fs-1',
      app: 'FOOD',
      catName: 'Combos & Snacks',
      name: 'Spicy Sriracha Chicken Seekh Roll',
      price: 199,
      rating: 4.8,
      emoji: '🌯',
      desc: 'Charcoal seekh kebabs tossed in fiery house sriracha dressing.',
      image: 'https://images.unsplash.com/photo-1626700051175-6518c4793f4f?auto=format&fit=crop&q=80&w=400&h=400'
    },
    {
      id: 'cat-fs-2',
      app: 'FOOD',
      catName: 'Combos & Snacks',
      name: 'Crispy Cheese Loaded Fries Bowl',
      price: 160,
      rating: 4.7,
      emoji: '🍟',
      desc: 'Thick cut skin-on potatoes coated in double cheddar & dynamic seasoning.',
      image: 'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?auto=format&fit=crop&q=80&w=400&h=400'
    },
    {
      id: 'cat-fs-3',
      app: 'FOOD',
      catName: 'Combos & Snacks',
      name: 'Handcrafted Truffle Smash Slider',
      price: 220,
      rating: 4.9,
      emoji: '🍔',
      desc: 'Caramelized onions & black truffle butter glaze on soft milk brioche.',
      image: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&q=80&w=400&h=400'
    }
  ],
  'food-dessert': [
    {
      id: 'cat-fd-1',
      app: 'FOOD',
      catName: 'Desserts & Shakes',
      name: 'Triple Chocolate Lava Melt Souffle',
      price: 240,
      rating: 4.9,
      emoji: '🥞',
      desc: 'Molten center dark chocolate souffle with a dusting of vanilla snow.',
      image: 'https://images.unsplash.com/photo-1606313564200-e75d5e30476c?auto=format&fit=crop&q=80&w=400&h=400'
    },
    {
      id: 'cat-fd-2',
      app: 'FOOD',
      catName: 'Desserts & Shakes',
      name: 'Fluffy Japanese Pancake Stack',
      price: 290,
      rating: 4.8,
      emoji: '🥞',
      desc: 'Three extra fluffy souffle cakes served with warm honeycomb butter.',
      image: 'https://images.unsplash.com/photo-1528207776546-365bb710ee93?auto=format&fit=crop&q=80&w=400&h=400'
    },
    {
      id: 'cat-fd-3',
      app: 'FOOD',
      catName: 'Desserts & Shakes',
      name: 'Classic Salted Caramel Fudge Sundae',
      price: 180,
      rating: 4.7,
      emoji: '🍨',
      desc: 'Soft-serve organic milk custard layered with roasted crunch.',
      image: 'https://images.unsplash.com/photo-1563805042-7684c019e1cb?auto=format&fit=crop&q=80&w=400&h=400'
    }
  ],
  'mart-tech': [
    {
      id: 'cat-mt-1',
      app: 'MART',
      catName: 'Tech & Keyboards',
      name: 'Pastel Retro Mechanical Keyboard',
      price: 5499,
      rating: 4.9,
      emoji: '⌨️',
      desc: 'Brown clicky switches with beautiful vintage-themed keycaps.',
      image: 'https://images.unsplash.com/photo-1587829741301-dc798b83add3?auto=format&fit=crop&q=80&w=400&h=400'
    },
    {
      id: 'cat-mt-2',
      app: 'MART',
      catName: 'Tech & Keyboards',
      name: 'ANC Premium Matte Earbuds',
      price: 3999,
      rating: 4.8,
      emoji: '🎧',
      desc: 'Premium hybrid active isolation with deep immersive stereo.',
      image: 'https://images.unsplash.com/photo-1546435770-a3e426bf472b?auto=format&fit=crop&q=80&w=400&h=400'
    },
    {
      id: 'cat-mt-3',
      app: 'MART',
      catName: 'Tech & Keyboards',
      name: 'Dual Arc RGB Ambience Tube Light',
      price: 1850,
      rating: 4.7,
      emoji: '💡',
      desc: 'App controlled smart glow tube with endless music sync dynamics.',
      image: 'https://images.unsplash.com/photo-1565814329452-e1efa11c5b89?auto=format&fit=crop&q=80&w=400&h=400'
    }
  ],
  'mart-foot': [
    {
      id: 'cat-mf-1',
      app: 'MART',
      catName: 'Footwear & Kicks',
      name: 'Air Retro High Mint Kicks',
      price: 14999,
      rating: 4.9,
      emoji: '👟',
      desc: 'Limited street drop high-top trainers with iconic stitched branding.',
      image: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&q=80&w=400&h=400'
    },
    {
      id: 'cat-mf-2',
      app: 'MART',
      catName: 'Footwear & Kicks',
      name: 'Futuristic Neo-Glow Runners',
      price: 8499,
      rating: 4.8,
      emoji: '👟',
      desc: 'Ultra lightweight responsive foam cushioning built for speed.',
      image: 'https://images.unsplash.com/photo-1539185441755-769473a23570?auto=format&fit=crop&q=80&w=400&h=400'
    },
    {
      id: 'cat-mf-3',
      app: 'MART',
      catName: 'Footwear & Kicks',
      name: 'Urban Tech Water Resistant Sandals',
      price: 3200,
      rating: 4.6,
      emoji: '👡',
      desc: 'Magnetic buckled strap harness with rugged traction system.',
      image: 'https://images.unsplash.com/photo-1603252109303-2751441dd157?auto=format&fit=crop&q=80&w=400&h=400'
    }
  ],
  'mart-lounge': [
    {
      id: 'cat-ml-1',
      app: 'MART',
      catName: 'Cozywear Lounge',
      name: 'Heavyweight Boxy Fleece Hoodie',
      price: 1899,
      rating: 4.9,
      emoji: '🧥',
      desc: 'Oversized premium custom knit cotton with thick drop-shoulders.',
      image: 'https://images.unsplash.com/photo-1556821840-3a63f95609a7?auto=format&fit=crop&q=80&w=400&h=400'
    },
    {
      id: 'cat-ml-2',
      app: 'MART',
      catName: 'Cozywear Lounge',
      name: 'Relaxed Waffle Weave Joggers',
      price: 1299,
      rating: 4.8,
      emoji: '👖',
      desc: 'Breathable elastic cuffed lounge trousers perfect for working from home.',
      image: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&q=80&w=400&h=400'
    },
    {
      id: 'cat-ml-3',
      app: 'MART',
      catName: 'Cozywear Lounge',
      name: 'Minimalist Combed Soft Tee',
      price: 799,
      rating: 4.7,
      emoji: '👕',
      desc: 'Clean basic essential styled with high crew neckline detail.',
      image: 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&q=80&w=400&h=400'
    }
  ],
  'groc-green': [
    {
      id: 'cat-gg-1',
      app: 'GROCERY',
      catName: 'Fresh Greens',
      name: 'Hydroponic Salad Greens Box',
      price: 130,
      rating: 4.9,
      emoji: '🥗',
      desc: 'Pesticide-free young romaine, kale and butterhead greens (250g).',
      image: 'https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format&fit=crop&q=80&w=400&h=400'
    },
    {
      id: 'cat-gg-2',
      app: 'GROCERY',
      catName: 'Fresh Greens',
      name: 'Premium Imported Hass Avocado',
      price: 160,
      rating: 4.8,
      emoji: '🥑',
      desc: 'Ultra buttery texture with supreme healthy monounsaturated oils.',
      image: 'https://images.unsplash.com/photo-1523049673857-eb18f1d7b578?auto=format&fit=crop&q=80&w=400&h=400'
    },
    {
      id: 'cat-gg-3',
      app: 'GROCERY',
      catName: 'Fresh Greens',
      name: 'Organic Royal Gala Apples (1kg)',
      price: 249,
      rating: 4.9,
      emoji: '🍎',
      desc: 'Crisp, super sweet orchard picked gala apples with bright red skin.',
      image: 'https://images.unsplash.com/photo-1560806887-1e4cd0b6cbd6?auto=format&fit=crop&q=80&w=400&h=400'
    }
  ],
  'groc-soda': [
    {
      id: 'cat-gs-1',
      app: 'GROCERY',
      catName: 'Cold Sips & Soda',
      name: 'Sparkling Peach Cranberry Can',
      price: 95,
      rating: 4.8,
      emoji: '🥫',
      desc: 'Real fruit juice infusion with light bubbly carbonation zest.',
      image: 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?auto=format&fit=crop&q=80&w=400&h=400'
    },
    {
      id: 'cat-gs-2',
      app: 'GROCERY',
      catName: 'Cold Sips & Soda',
      name: 'Artisanal Double Shot Nitro Cold Brew',
      price: 160,
      rating: 4.9,
      emoji: '🧋',
      desc: 'Creamy nitrogen charged single origin coffee brewed for 18 hours.',
      image: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&q=80&w=400&h=400'
    },
    {
      id: 'cat-gs-3',
      app: 'GROCERY',
      catName: 'Cold Sips & Soda',
      name: 'Premium Sugar-Free Tonic Can',
      price: 80,
      rating: 4.6,
      emoji: '🥤',
      desc: 'Crisp quinine flavor profile perfect for premium mocktail mixes.',
      image: 'https://images.unsplash.com/photo-1551024709-8f23befc6f87?auto=format&fit=crop&q=80&w=400&h=400'
    }
  ],
  'groc-dairy': [
    {
      id: 'cat-gd-1',
      app: 'GROCERY',
      catName: 'Dairy & Milks',
      name: 'Oat Milk Salted Caramel Carton',
      price: 280,
      rating: 4.8,
      emoji: '🥛',
      desc: 'Luxurious barista-grade plant alternative with sweet creamy body.',
      image: 'https://images.unsplash.com/photo-1550583724-b2692b85b150?auto=format&fit=crop&q=80&w=400&h=400'
    },
    {
      id: 'cat-gd-2',
      app: 'GROCERY',
      catName: 'Dairy & Milks',
      name: 'Organic Blueberry Greek Yogurt',
      price: 75,
      rating: 4.9,
      emoji: '🍧',
      desc: 'Thick, high-protein organic strained yogurt with real blueberries.',
      image: 'https://images.unsplash.com/photo-1488477181946-6428a0291777?auto=format&fit=crop&q=80&w=400&h=400'
    },
    {
      id: 'cat-gd-3',
      app: 'GROCERY',
      catName: 'Dairy & Milks',
      name: 'Dairy-Free Vanilla Almond Milk',
      price: 240,
      rating: 4.7,
      emoji: '🥛',
      desc: 'Smooth unsweetened vanilla bean almond extract milk (1L).',
      image: 'https://images.unsplash.com/photo-1553456558-aff63285bdd1?auto=format&fit=crop&q=80&w=400&h=400'
    }
  ],
  'ph-wellness': [
    {
      id: 'cat-pw-1',
      app: 'PHARMA',
      catName: 'Wellness Gummies',
      name: 'Biotin Skin Glow Active Gummies',
      price: 499,
      rating: 4.9,
      emoji: '🍊',
      desc: 'Delicious strawberry vitamins to build active collagen structures.',
      image: 'https://images.unsplash.com/photo-1584017911766-d451b3d0e843?auto=format&fit=crop&q=80&w=400&h=400'
    },
    {
      id: 'cat-pw-2',
      app: 'PHARMA',
      catName: 'Wellness Gummies',
      name: 'Ashwagandha De-Stress Mint Drops',
      price: 350,
      rating: 4.8,
      emoji: '🍵',
      desc: 'Calming adaptogens to ease cortisol levels and boost mental clarity.',
      image: 'https://images.unsplash.com/photo-1607619056574-7b8d304f2c38?auto=format&fit=crop&q=80&w=400&h=400'
    },
    {
      id: 'cat-pw-3',
      app: 'PHARMA',
      catName: 'Wellness Gummies',
      name: 'Deep Sleep Chamomile Melatonin',
      price: 420,
      rating: 4.7,
      emoji: '💤',
      desc: 'Fast dissolving organic strips for healthy rest cycles.',
      image: 'https://images.unsplash.com/photo-1512290923902-8a9f81dc236c?auto=format&fit=crop&q=80&w=400&h=400'
    }
  ],
  'ph-sos': [
    {
      id: 'cat-ps-1',
      app: 'PHARMA',
      catName: 'Late-Night SOS',
      name: 'Hydrocolloid Fast Healing Patch Pack',
      price: 199,
      rating: 4.9,
      emoji: '🩹',
      desc: 'Absorbs fluids from acne lesions and protects from pollution.',
      image: 'https://images.unsplash.com/photo-1603398938378-e54eab446dde?auto=format&fit=crop&q=80&w=400&h=400'
    },
    {
      id: 'cat-ps-2',
      app: 'PHARMA',
      catName: 'Late-Night SOS',
      name: 'Cooling Instant Migraine Strip (2p)',
      price: 150,
      rating: 4.7,
      emoji: '❄️',
      desc: 'No-mess instant cold therapy strip to relieve temple stress.',
      image: 'https://images.unsplash.com/photo-1551076805-e1869033e561?auto=format&fit=crop&q=80&w=400&h=400'
    },
    {
      id: 'cat-ps-3',
      app: 'PHARMA',
      catName: 'Late-Night SOS',
      name: 'Menthol Throat Relief Lozenges',
      price: 120,
      rating: 4.8,
      emoji: '🍬',
      desc: 'Triple cooling action to soothe scratchy throat instantly.',
      image: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?auto=format&fit=crop&q=80&w=400&h=400'
    }
  ],
  'ph-beauty': [
    {
      id: 'cat-pb-1',
      app: 'PHARMA',
      catName: 'K-Beauty Glow',
      name: 'Advanced 96% Snail Mucin Essence',
      price: 1450,
      rating: 4.9,
      emoji: '🧴',
      desc: 'World famous hydrating formula for glass-like glowing skin.',
      image: 'https://images.unsplash.com/photo-1608248597481-496100c80836?auto=format&fit=crop&q=80&w=400&h=400'
    },
    {
      id: 'cat-pb-2',
      app: 'PHARMA',
      catName: 'K-Beauty Glow',
      name: 'AHA BHA PHA 30D Miracle Toner',
      price: 1150,
      rating: 4.8,
      emoji: '🧴',
      desc: 'Gently exfoliates dead cells and reveals natural translucent glow.',
      image: 'https://images.unsplash.com/photo-1556228720-195a672e8a03?auto=format&fit=crop&q=80&w=400&h=400'
    }
  ]
};

export interface StoreProfile {
  id: string;
  name: string;
  app: 'MART' | 'FOOD' | 'GROCERY' | 'PHARMA';
  categories: string[]; // multi-category tagging
  rating: number;
  reviewsCount?: number;
  deliveryTime: string;
  distance: string;
  coverImage: string;
  emoji: string;
  desc: string;
  offerTag?: string;
  isVeg?: boolean;
}

export const martStores: StoreProfile[] = [
  {
    id: 'store-m1',
    name: 'Darling Mobiles',
    app: 'MART',
    categories: ['Mobile & Electronics', 'Home Appliances'],
    rating: 4.9,
    reviewsCount: 1240,
    deliveryTime: '25 min',
    distance: '1.8 km',
    coverImage: 'https://images.unsplash.com/photo-1550009158-9ebf69173e03?auto=format&fit=crop&q=80&w=600&h=300',
    emoji: '📱',
    desc: 'Authorized dealer for Apple, Samsung, Sony & Premium Gadgets',
    offerTag: 'FLAT ₹2000 OFF on Card Payments'
  },
  {
    id: 'store-m2',
    name: 'Mass Mobiles & Gadgets',
    app: 'MART',
    categories: ['Mobile & Electronics', 'Toys & Gifts'],
    rating: 4.8,
    reviewsCount: 890,
    deliveryTime: '30 min',
    distance: '2.4 km',
    coverImage: 'https://images.unsplash.com/photo-1588872657578-7efd1f1555ed?auto=format&fit=crop&q=80&w=600&h=300',
    emoji: '💻',
    desc: 'Smartphones, Laptops, Gaming Consoles & Accessories',
    offerTag: 'UP TO 50% OFF Accessories'
  },
  {
    id: 'store-m3',
    name: 'Thread Labs Studio',
    app: 'MART',
    categories: ['Fashion', 'Sports'],
    rating: 4.9,
    reviewsCount: 2150,
    deliveryTime: '35 min',
    distance: '3.1 km',
    coverImage: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&q=80&w=600&h=300',
    emoji: '👔',
    desc: 'Modern streetwear, oversized tees, hoodies & athletic gear',
    offerTag: 'BUY 2 GET 1 FREE'
  },
  {
    id: 'store-m4',
    name: 'Vibe Apparel & Accessories',
    app: 'MART',
    categories: ['Fashion', 'Beauty', 'Toys & Gifts'],
    rating: 4.7,
    reviewsCount: 650,
    deliveryTime: '20 min',
    distance: '1.2 km',
    coverImage: 'https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&q=80&w=600&h=300',
    emoji: '👗',
    desc: 'Trendy women & men clothing, styling accessories & gifts',
    offerTag: 'FLAT 30% OFF'
  },
  {
    id: 'store-m5',
    name: 'Korean Glow Care HQ',
    app: 'MART',
    categories: ['Beauty', 'Fashion'],
    rating: 4.9,
    reviewsCount: 3400,
    deliveryTime: '15 min',
    distance: '0.9 km',
    coverImage: 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&q=80&w=600&h=300',
    emoji: '✨',
    desc: '100% Authentic Korean serums, snail mucin, skincare & makeup',
    offerTag: 'FREE Sheet Mask on ₹999+'
  },
  {
    id: 'store-m6',
    name: 'Scholars Bookland & Stationery',
    app: 'MART',
    categories: ['Books & Stationery', 'Toys & Gifts'],
    rating: 4.8,
    reviewsCount: 540,
    deliveryTime: '25 min',
    distance: '1.5 km',
    coverImage: 'https://images.unsplash.com/photo-1507842229356-51ce24720076?auto=format&fit=crop&q=80&w=600&h=300',
    emoji: '📚',
    desc: 'Academic textbooks, luxury journals, scientific calculators & art supplies',
    offerTag: '15% Student Discount'
  },
  {
    id: 'store-m7',
    name: 'SmartHome Emporium',
    app: 'MART',
    categories: ['Home Appliances', 'Furniture', 'Mobile & Electronics'],
    rating: 4.9,
    reviewsCount: 1120,
    deliveryTime: '40 min',
    distance: '4.5 km',
    coverImage: 'https://images.unsplash.com/photo-1556911220-e15b29be8c8f?auto=format&fit=crop&q=80&w=600&h=300',
    emoji: '🏠',
    desc: 'Smart air purifiers, robotic vacuums, kitchen gadgets & home automation',
    offerTag: '0% EMI Available'
  },
  {
    id: 'store-m8',
    name: 'Wood & Steel Living',
    app: 'MART',
    categories: ['Furniture', 'Home Appliances'],
    rating: 4.8,
    reviewsCount: 420,
    deliveryTime: '45 min',
    distance: '5.2 km',
    coverImage: 'https://images.unsplash.com/photo-1524758631624-e2822e304c36?auto=format&fit=crop&q=80&w=600&h=300',
    emoji: '🪑',
    desc: 'Ergonomic office chairs, oak desks, minimalist shelving & home decor',
    offerTag: 'FLAT ₹5000 OFF on Furniture Sets'
  },
  {
    id: 'store-m9',
    name: 'ProArena Sports & Fitness',
    app: 'MART',
    categories: ['Sports', 'Fashion'],
    rating: 4.9,
    reviewsCount: 780,
    deliveryTime: '30 min',
    distance: '2.8 km',
    coverImage: 'https://images.unsplash.com/photo-1517838277536-f5f99be501cd?auto=format&fit=crop&q=80&w=600&h=300',
    emoji: '🏆',
    desc: 'Kettlebells, resistance bands, cricket kits, badminton & sportswear',
    offerTag: 'FLAT 25% OFF Fitness Gear'
  }
];

export const foodStores: StoreProfile[] = [
  {
    id: 'store-f1',
    name: 'Paradise Biryani House',
    app: 'FOOD',
    categories: ['Biryani', 'North Indian', 'Tiffin', 'Dinner Specials'],
    rating: 4.9,
    reviewsCount: 4500,
    deliveryTime: '30 min',
    distance: '2.1 km',
    coverImage: 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?auto=format&fit=crop&q=80&w=600&h=300',
    emoji: '🍛',
    desc: 'World famous royal Awadhi mutton & chicken dum biryani',
    offerTag: 'FESTIVE50 - 50% OFF up to ₹150',
    isVeg: false
  },
  {
    id: 'store-f2',
    name: 'Green Leaf Pure Veg Kitchen',
    app: 'FOOD',
    categories: ['Tiffin', 'North Indian', 'South Indian', 'Beverages'],
    rating: 4.8,
    reviewsCount: 3100,
    deliveryTime: '25 min',
    distance: '1.4 km',
    coverImage: 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?auto=format&fit=crop&q=80&w=600&h=300',
    emoji: '🥗',
    desc: '100% Pure Vegetarian South & North Indian delicacies, Jain options available',
    offerTag: 'FLAT ₹100 OFF on ₹399+',
    isVeg: true
  },
  {
    id: 'store-f3',
    name: 'Hungry Minds Cafe',
    app: 'FOOD',
    categories: ['Chinese', 'Fast Food', 'Beverages', 'Dinner Specials'],
    rating: 4.7,
    reviewsCount: 1890,
    deliveryTime: '20 min',
    distance: '0.8 km',
    coverImage: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&q=80&w=600&h=300',
    emoji: '🍔',
    desc: 'Gourmet smash burgers, loaded fries, paneer tikka rolls & cold brews',
    offerTag: 'FREE Loaded Fries on ₹499+',
    isVeg: false
  },
  {
    id: 'store-f4',
    name: 'Wok Express & Noodles',
    app: 'FOOD',
    categories: ['Chinese', 'Asian', 'Dinner Specials'],
    rating: 4.8,
    reviewsCount: 2200,
    deliveryTime: '35 min',
    distance: '3.2 km',
    coverImage: 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?auto=format&fit=crop&q=80&w=600&h=300',
    emoji: '🍜',
    desc: 'Authentic Hakka noodles, dimsums, Manchurian & spicy Schezwan bowls',
    offerTag: '20% OFF on Noodles & Bowls',
    isVeg: false
  },
  {
    id: 'store-f5',
    name: 'La Paris Crêperie & Bakery',
    app: 'FOOD',
    categories: ['Bakery', 'Desserts', 'Beverages'],
    rating: 4.9,
    reviewsCount: 1400,
    deliveryTime: '15 min',
    distance: '1.1 km',
    coverImage: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&q=80&w=600&h=300',
    emoji: '🍰',
    desc: 'Freshly baked French croissants, New York cheesecake, artisanal coffee',
    offerTag: 'BUY 1 GET 1 FREE Pastries',
    isVeg: true
  },
  {
    id: 'store-f6',
    name: 'Midnight Dhaba & Tandoor',
    app: 'FOOD',
    categories: ['North Indian', 'Tandoor', 'Dinner Specials'],
    rating: 4.7,
    reviewsCount: 980,
    deliveryTime: '40 min',
    distance: '4.0 km',
    coverImage: 'https://images.unsplash.com/photo-1631452180519-c014fe946bc7?auto=format&fit=crop&q=80&w=600&h=300',
    emoji: '🥘',
    desc: 'Charcoal grilled kebabs, buttery garlic naan & slow cooked dal makhani',
    offerTag: 'FLAT 30% OFF Midnight Feasts',
    isVeg: false
  }
];

