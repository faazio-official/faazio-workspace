const img = (id: string, w = 900, h = 620) =>
  `https://images.unsplash.com/${id}?fm=jpg&fit=crop&q=80&w=${w}&h=${h}`;

const squareImg = (id: string, w = 560) =>
  `https://images.unsplash.com/${id}?fm=jpg&fit=crop&q=80&w=${w}&h=${w}`;

export const GROCERY_GREEN = '#116D3B';
export const GROCERY_GREEN_DARK = '#0A4222';
export const GROCERY_PALE = '#E8F5E9';
export const GROCERY_CREAM = '#F0F8EC';
export const GROCERY_BADGE = '#28A745';
export const GROCERY_GREY = '#666666';
export const GROCERY_INK = '#1E2022';

export interface GroceryAdBanner {
  id: string;
  title: string;
  subtitle: string;
  bgHex: string;
  imageUrl: string;
}

export interface GroceryCategory {
  id: string;
  name: string;
  cutoutImageUrl: string;
}

export interface GroceryProductItem {
  id: string;
  name: string;
  size: string;
  price: number;
  originalPrice: number;
  discountTag: string;
  imageUrl: string;
}

export interface GroceryBestDeal {
  id: string;
  brand: string;
  name: string;
  size: string;
  price: number;
  originalPrice: number;
  imageUrl: string;
}

export interface GrocerySeasonSpecial {
  id: string;
  title: string;
  subtitle: string;
  btnText: string;
  bgHex: string;
  imageUrl: string;
}

export interface GroceryTopBrand {
  id: string;
  name: string;
  logoUrl: string;
}

export const GROCERY_CATEGORIES: GroceryCategory[] = [
  { id: 'gc-1', name: 'Fruits & Vegetables', cutoutImageUrl: squareImg('photo-1542838132-92c53300491e', 300) },
  { id: 'gc-2', name: 'Dairy, Bread & Eggs', cutoutImageUrl: squareImg('photo-1550583724-b2692b85b150', 300) },
  { id: 'gc-3', name: 'Snacks & Munchies', cutoutImageUrl: squareImg('photo-1600026453320-ef36ea012f6b', 300) },
  { id: 'gc-4', name: 'Beverages', cutoutImageUrl: squareImg('photo-1544252890-c3e95e867389', 300) },
  { id: 'gc-5', name: 'Personal Care', cutoutImageUrl: squareImg('photo-1556228578-0d85b1a4d571', 300) },
  { id: 'gc-6', name: 'Household Needs', cutoutImageUrl: squareImg('photo-1585421514284-efb74c2b69ba', 300) },
  { id: 'gc-7', name: 'Baby Care', cutoutImageUrl: squareImg('photo-1595815771614-5fc0e125f409', 300) },
  { id: 'gc-8', name: 'Frozen Foods', cutoutImageUrl: squareImg('photo-1580915411954-282cb1b0d780', 300) },
];

export const GROCERY_TOP_PICKS: GroceryProductItem[] = [
  { id: 'gp-1', name: 'Fresh Farm Whole Milk', size: '1L', price: 128, originalPrice: 198, discountTag: '35% OFF', imageUrl: squareImg('photo-1550583724-b2692b85b150', 400) },
  { id: 'gp-2', name: 'Premium Basmati Rice', size: '5kg', price: 449, originalPrice: 599, discountTag: '25% OFF', imageUrl: squareImg('photo-1586201375761-83865001e31c', 400) },
  { id: 'gp-3', name: 'Cold Pressed Coconut Oil', size: '1L', price: 299, originalPrice: 499, discountTag: '40% OFF', imageUrl: squareImg('photo-1474979266404-7eaacbcd87c5', 400) },
  { id: 'gp-4', name: 'Mixed Nuts Combo', size: '500g', price: 349, originalPrice: 549, discountTag: '36% OFF', imageUrl: squareImg('photo-1604068549290-dea0e4a305ca', 400) },
  { id: 'gp-5', name: 'Free Range Eggs', size: '12 pcs', price: 89, originalPrice: 129, discountTag: '31% OFF', imageUrl: squareImg('photo-1582722872445-44dc5f7e3c8f', 400) },
  { id: 'gp-6', name: 'Whole Wheat Bread', size: '400g', price: 35, originalPrice: 55, discountTag: '36% OFF', imageUrl: squareImg('photo-1509440159596-0249088772ff', 400) },
];

export const GROCERY_BEST_DEALS: GroceryBestDeal[] = [
  { id: 'gbd-1', brand: 'Amul', name: 'Fresh Whole Milk', size: '1L', price: 68, originalPrice: 84, imageUrl: squareImg('photo-1550583724-b2692b85b150', 300) },
  { id: 'gbd-2', brand: 'Nestlé', name: 'Milk Chocolate', size: '100g', price: 89, originalPrice: 110, imageUrl: squareImg('photo-1549007994-cb92caebd54b', 300) },
  { id: 'gbd-3', brand: 'Britannia', name: 'Good Day Biscuits', size: '400g', price: 49, originalPrice: 65, imageUrl: squareImg('photo-1558961363-fa8fdf82db35', 300) },
  { id: 'gbd-4', brand: 'Fortune', name: 'Sunflower Oil', size: '1L', price: 129, originalPrice: 165, imageUrl: squareImg('photo-1474979266404-7eaacbcd87c5', 300) },
  { id: 'gbd-5', brand: 'Red Label', name: 'Natural Care Tea', size: '500g', price: 215, originalPrice: 260, imageUrl: squareImg('photo-1594631252845-29fc4cc8cde9', 300) },
  { id: 'gbd-6', brand: 'Tata', name: 'Iodised Salt', size: '1kg', price: 25, originalPrice: 32, imageUrl: squareImg('photo-1615637561699-9e0b25fcbc0c', 300) },
];

export const GROCERY_SEASON_SPECIALS: GrocerySeasonSpecial[] = [
  { id: 'gss-1', title: 'Fruit Fiesta', subtitle: 'Fresh summer fruits', btnText: 'Shop Now', bgHex: '#FFF8D6', imageUrl: squareImg('photo-1610832958506-aa56368176cf', 300) },
  { id: 'gss-2', title: 'Chilled Beverages', subtitle: 'Sodas & fresh juices', btnText: 'Shop Now', bgHex: '#E3F2FD', imageUrl: squareImg('photo-1544252890-c3e95e867389', 300) },
  { id: 'gss-3', title: 'Sweet Tooth', subtitle: 'Chocolates & desserts', btnText: 'Shop Now', bgHex: '#F3E5F5', imageUrl: squareImg('photo-1549007994-cb92caebd54b', 300) },
  { id: 'gss-4', title: 'Bakery Delights', subtitle: 'Fresh from the oven', btnText: 'Shop Now', bgHex: '#FFF3E0', imageUrl: squareImg('photo-1509440159596-0249088772ff', 300) },
];

export const GROCERY_TOP_BRANDS: GroceryTopBrand[] = [
  { id: 'gbr-1', name: 'Tata', logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1e/Tata_logo.svg/120px-Tata_logo.svg.png' },
  { id: 'gbr-2', name: 'Amul', logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/60/Amul_logo.svg/120px-Amul_logo.svg.png' },
  { id: 'gbr-3', name: 'Nestlé', logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/73/Nestl%C3%A9_logo.svg/120px-Nestl%C3%A9_logo.svg.png' },
  { id: 'gbr-4', name: 'Britannia', logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/43/Britannia_Logo.svg/120px-Britannia_Logo.svg.png' },
  { id: 'gbr-5', name: 'P&G', logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4e/P%26G_logo.svg/120px-P%26G_logo.svg.png' },
  { id: 'gbr-6', name: 'HUL', logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e4/Hindustan_Unilever_Logo.svg/120px-Hindustan_Unilever_Logo.svg.png' },
];

export const GROCERY_ALSO_NEED: GroceryProductItem[] = [
  { id: 'gan-1', name: 'Almond Milk', size: '1L', price: 199, originalPrice: 299, discountTag: '33% OFF', imageUrl: squareImg('photo-1553456558-aff63285bdd1', 400) },
  { id: 'gan-2', name: 'Organic Apples', size: '1kg', price: 249, originalPrice: 329, discountTag: '24% OFF', imageUrl: squareImg('photo-1560806887-1e4cd0b6cbd6', 400) },
  { id: 'gan-3', name: 'Broccoli Crown', size: '500g', price: 89, originalPrice: 129, discountTag: '31% OFF', imageUrl: squareImg('photo-1515002246390-7bf7e8f87b54', 400) },
  { id: 'gan-4', name: 'Coffee Beans', size: '250g', price: 450, originalPrice: 599, discountTag: '25% OFF', imageUrl: squareImg('photo-1514432324607-a09d9b4aefdd', 400) },
  { id: 'gan-5', name: 'Masala Corn Chips', size: '240g', price: 99, originalPrice: 149, discountTag: '34% OFF', imageUrl: squareImg('photo-1576107232684-1279f390859f', 400) },
  { id: 'gan-6', name: 'Salted Popcorn', size: '150g', price: 119, originalPrice: 169, discountTag: '30% OFF', imageUrl: squareImg('photo-1576460049974-5f96bd33f1a3', 400) },
];

export const GROCERY_HERO_IMAGE = img('photo-1615485290382-441e4d049cb5', 500, 500);

export const GROCERY_AD_BANNERS: GroceryAdBanner[] = [
  {
    id: 'gad-1',
    title: 'Farm Fresh Produce',
    subtitle: 'UP TO 40% OFF',
    bgHex: '#E8F5E9',
    imageUrl: squareImg('photo-1542838132-92c53300491e', 400),
  },
  {
    id: 'gad-2',
    title: 'Daily Dairy & Bread',
    subtitle: 'FREE DELIVERY',
    bgHex: '#E3F2FD',
    imageUrl: squareImg('photo-1550583724-b2692b85b150', 400),
  },
  {
    id: 'gad-3',
    title: 'Beverages Blast',
    subtitle: 'FLAT 30% OFF',
    bgHex: '#FFF8D6',
    imageUrl: squareImg('photo-1544252890-c3e95e867389', 400),
  },
];

