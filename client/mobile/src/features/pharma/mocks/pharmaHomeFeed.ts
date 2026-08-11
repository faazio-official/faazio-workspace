const img = (id: string, w = 900, h = 620) =>
  `https://images.unsplash.com/${id}?fm=jpg&fit=crop&q=80&w=${w}&h=${h}`;

const squareImg = (id: string, w = 560) =>
  `https://images.unsplash.com/${id}?fm=jpg&fit=crop&q=80&w=${w}&h=${w}`;

export const PHARMA_TEAL = '#009688';
export const PHARMA_TEAL_DARK = '#00695C';
export const PHARMA_PALE = '#E0F2F1';
export const PHARMA_SOFT = '#F0FDF8';
export const PHARMA_INK = '#1E2022';
export const PHARMA_GREY = '#666666';

export interface PharmaFeatureChip {
  id: string;
  title: string;
  subtitle: string;
  iconName: 'clock' | 'shield' | 'percent' | 'rotate';
}

export interface PharmaCategoryItem {
  id: string;
  name: string;
  cutoutImageUrl: string;
}

export interface PharmaQuickReorderItem {
  id: string;
  name: string;
  stripDetails: string;
  price: number;
}

export interface PharmaTopOffer {
  id: string;
  title: string;
  subtitle: string;
  code: string;
  iconName: 'percent' | 'truck' | 'wallet';
}

export interface PharmaPopularMedicine {
  id: string;
  name: string;
  details: string;
  rating: number;
  price: number;
  imageUrl: string;
}

export interface PharmaHealthEssential {
  id: string;
  title: string;
  imageUrl: string;
}

export interface PharmaFeaturedBrand {
  id: string;
  name: string;
  logoUrl: string;
}

export interface PharmaHealthCornerArticle {
  id: string;
  title: string;
  subtitle: string;
  imageUrl: string;
}

export const PHARMA_FEATURE_CHIPS: PharmaFeatureChip[] = [
  { id: 'pfc-1', title: 'Express Delivery', subtitle: '15-30 mins', iconName: 'clock' },
  { id: 'pfc-2', title: '100% Genuine', subtitle: 'Quality assured', iconName: 'shield' },
  { id: 'pfc-3', title: 'Best Prices', subtitle: 'Up to 50% off', iconName: 'percent' },
  { id: 'pfc-4', title: 'Easy Returns', subtitle: 'Within 7 days', iconName: 'rotate' },
];

export const PHARMA_FEED_CATEGORIES: PharmaCategoryItem[] = [
  { id: 'pc-1', name: 'Medicines', cutoutImageUrl: squareImg('photo-1584308666744-24d5c474f2ae', 300) },
  { id: 'pc-2', name: 'Vitamins', cutoutImageUrl: squareImg('photo-1584017911766-d451b3d0e843', 300) },
  { id: 'pc-3', name: 'Supplements', cutoutImageUrl: squareImg('photo-1593095948071-474c5cc2c1cf', 300) },
  { id: 'pc-4', name: 'Baby Care', cutoutImageUrl: squareImg('photo-1595815771614-5fc0e125f409', 300) },
  { id: 'pc-5', name: 'Personal Care', cutoutImageUrl: squareImg('photo-1556228578-0d85b1a4d571', 300) },
  { id: 'pc-6', name: 'Devices', cutoutImageUrl: squareImg('photo-1586016413664-8e5b6f5e58a5', 300) },
];

export const PHARMA_QUICK_REORDER: PharmaQuickReorderItem[] = [
  { id: 'pqr-1', name: 'Paracetamol 650', stripDetails: 'Strip of 15 Tablets', price: 45 },
  { id: 'pqr-2', name: 'Vitamin D3', stripDetails: 'Bottle of 60 Capsules', price: 450 },
  { id: 'pqr-3', name: 'Cetirizine 10mg', stripDetails: 'Strip of 10 Tablets', price: 38 },
  { id: 'pqr-4', name: 'ORS Sachets', stripDetails: 'Pack of 20 Sachets', price: 75 },
  { id: 'pqr-5', name: 'Antiseptic Cream', stripDetails: 'Tube of 30g', price: 120 },
];

export const PHARMA_TOP_OFFERS: PharmaTopOffer[] = [
  { id: 'pto-1', title: 'FLAT 20% OFF', subtitle: 'On medicines above ₹299', code: 'MED20', iconName: 'percent' },
  { id: 'pto-2', title: 'FREE DELIVERY', subtitle: 'On orders above ₹499', code: 'FREEDEL', iconName: 'truck' },
  { id: 'pto-3', title: '15% CASHBACK', subtitle: 'With digital wallet', code: 'PAY15', iconName: 'wallet' },
  { id: 'pto-4', title: '25% OFF', subtitle: 'On your first order', code: 'HEALTH25', iconName: 'percent' },
];

export const PHARMA_POPULAR_MEDICINES: PharmaPopularMedicine[] = [
  { id: 'ppm-1', name: 'Paracetamol 500mg', details: 'Strip of 10 Tablets', rating: 4.9, price: 45, imageUrl: squareImg('photo-1584308666744-24d5c474f2ae', 400) },
  { id: 'ppm-2', name: 'Vitamin D3 2000 IU', details: 'Bottle of 60 Capsules', rating: 4.7, price: 450, imageUrl: squareImg('photo-1584017911766-d451b3d0e843', 400) },
  { id: 'ppm-3', name: 'Ibuprofen 400mg', details: 'Strip of 15 Tablets', rating: 4.8, price: 85, imageUrl: squareImg('photo-1550572017-edd951b55104', 400) },
  { id: 'ppm-4', name: 'Multivitamin Daily', details: 'Bottle of 90 Tablets', rating: 4.9, price: 680, imageUrl: squareImg('photo-1620916566398-39f1143ab7be', 400) },
  { id: 'ppm-5', name: 'Salbutamol Inhaler', details: '200 Doses', rating: 4.8, price: 350, imageUrl: squareImg('photo-1631549916768-4119b2e5f926', 400) },
  { id: 'ppm-6', name: 'Whey Protein Isolate', details: '500g Tub', rating: 4.9, price: 1299, imageUrl: squareImg('photo-1593095948071-474c5cc2c1cf', 400) },
];

export const PHARMA_HEALTH_ESSENTIALS: PharmaHealthEssential[] = [
  { id: 'phe-1', title: 'Vitamins & Supplements', imageUrl: squareImg('photo-1584017911766-d451b3d0e843', 300) },
  { id: 'phe-2', title: 'Diabetes Care', imageUrl: squareImg('photo-1571019613454-1cb2f99b2d8b', 300) },
  { id: 'phe-3', title: 'First Aid', imageUrl: squareImg('photo-1603398938378-e54eab446dde', 300) },
  { id: 'phe-4', title: 'Home Testing Kits', imageUrl: squareImg('photo-1579154204601-01588f351e67', 300) },
  { id: 'phe-5', title: 'Maternity Care', imageUrl: squareImg('photo-1516627145497-ae6968895b74', 300) },
  { id: 'phe-6', title: 'Pain Relief', imageUrl: squareImg('photo-1550583724-b2692b85b150', 300) },
];

export const PHARMA_FEATURED_BRANDS: PharmaFeaturedBrand[] = [
  { id: 'pfb-1', name: 'Cipla', logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/22/Cipla_logo.svg/120px-Cipla_logo.svg.png' },
  { id: 'pfb-2', name: 'Sun Pharma', logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1d/Sun_Pharma.svg/120px-Sun_Pharma.svg.png' },
  { id: 'pfb-3', name: 'Abbott', logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e4/Abbott_Laboratories_logo.svg/120px-Abbott_Laboratories_logo.svg.png' },
  { id: 'pfb-4', name: 'Dr. Reddy\'s', logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/38/Dr._Reddy%27s_logo.svg/120px-Dr._Reddy%27s_logo.svg.png' },
  { id: 'pfb-5', name: 'GSK', logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5c/GlaxoSmithKline_Logo.svg/120px-GlaxoSmithKline_Logo.svg.png' },
  { id: 'pfb-6', name: 'Mankind', logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/73/Mankind_Pharma_logo.svg/120px-Mankind_Pharma_logo.svg.png' },
];

export const PHARMA_HEALTH_CORNER: PharmaHealthCornerArticle[] = [
  { id: 'phc-1', title: 'Stay Hydrated', subtitle: 'Why water matters for immunity', imageUrl: squareImg('photo-1548839140-29a749e1cf4d', 300) },
  { id: 'phc-2', title: 'Balanced Diet', subtitle: 'Eat right for a healthier you', imageUrl: squareImg('photo-1512621776951-a57141f2eefd', 300) },
  { id: 'phc-3', title: 'Sleep Well', subtitle: '8 hours of rest, every night', imageUrl: squareImg('photo-1541781774459-bb2af2f05b55', 300) },
  { id: 'phc-4', title: 'Exercise Daily', subtitle: 'Move more, stress less', imageUrl: squareImg('photo-1571019613454-1cb2f99b2d8b', 300) },
];

export const PHARMA_HERO_IMAGE = img('photo-1603398938378-e54eab446dde', 500, 500);
