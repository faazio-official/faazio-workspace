export interface PharmaQuickAction {
  id: number;
  title: string;
  icon: 'file-text' | 'upload' | 'refresh-cw' | 'clipboard-list' | 'tag';
  bgColor: string;
}

export interface PharmaAllCategory {
  id: string;
  name: string;
  imageUrl: string;
}

export interface PharmaOffersBadge {
  id: number;
  title: string;
  subtitle: string;
  bgColor: string;
  icon: 'shield-check' | 'percent' | 'truck' | 'rotate-ccw';
}

const squareImg = (id: string, w = 300) =>
  `https://images.unsplash.com/${id}?fm=jpg&fit=crop&q=80&w=${w}&h=${w}`;

export const PHARMA_QUICK_ACTIONS: PharmaQuickAction[] = [
  { id: 1, title: 'Prescribed Medicines', icon: 'file-text', bgColor: '#EFF8F8' },
  { id: 2, title: 'Upload Prescription', icon: 'upload', bgColor: '#EFF8F8' },
  { id: 3, title: 'Order Again', icon: 'refresh-cw', bgColor: '#EFF8F8' },
  { id: 4, title: 'Health Records', icon: 'clipboard-list', bgColor: '#EFF8F8' },
  { id: 5, title: 'Offers & Discounts', icon: 'tag', bgColor: '#FFF8EC' },
];

export const PHARMA_ALL_CATEGORIES: PharmaAllCategory[] = [
  { id: 'pc-cat-1', name: 'Prescription Medicines', imageUrl: squareImg('photo-1584308666744-24d5c474f2ae') },
  { id: 'pc-cat-2', name: 'OTC Medicines & Health Products', imageUrl: squareImg('photo-1584017911766-d451b3d0e843') },
  { id: 'pc-cat-3', name: 'Daily Care & Personal Hygiene', imageUrl: squareImg('photo-1556228578-0d85b1a4d571') },
  { id: 'pc-cat-4', name: 'Baby Care', imageUrl: squareImg('photo-1595815771614-5fc0e125f409') },
  { id: 'pc-cat-5', name: 'Diabetes Care', imageUrl: squareImg('photo-1584308666744-24d5c474f2ae') },
  { id: 'pc-cat-6', name: 'Health Monitors & Devices', imageUrl: squareImg('photo-1584036561566-baf8f5f1b144') },
  { id: 'pc-cat-7', name: 'Vitamins & Supplements', imageUrl: squareImg('photo-1584017911766-d451b3d0e843') },
  { id: 'pc-cat-8', name: 'Pain Relief', imageUrl: squareImg('photo-1584308666744-24d5c474f2ae') },
  { id: 'pc-cat-9', name: 'Digestive Care', imageUrl: squareImg('photo-1512621776951-a57141f2eefd') },
  { id: 'pc-cat-10', name: 'Respiratory Care', imageUrl: squareImg('photo-1584036561566-baf8f5f1b144') },
  { id: 'pc-cat-11', name: 'Skin Care', imageUrl: squareImg('photo-1596462502278-27bfdc403348') },
  { id: 'pc-cat-12', name: 'Hair Care', imageUrl: squareImg('photo-1522337660859-02fbefca4702') },
  { id: 'pc-cat-13', name: 'Oral Care', imageUrl: squareImg('photo-1556228578-0d85b1a4d571') },
  { id: 'pc-cat-14', name: 'Eye Care', imageUrl: squareImg('photo-1584036561566-baf8f5f1b144') },
  { id: 'pc-cat-15', name: 'Ear Care', imageUrl: squareImg('photo-1584308666744-24d5c474f2ae') },
  { id: 'pc-cat-16', name: 'Feminine Hygiene', imageUrl: squareImg('photo-1556228578-0d85b1a4d571') },
  { id: 'pc-cat-17', name: 'Health Drinks & Nutrition', imageUrl: squareImg('photo-1610970881699-44a5587cabec') },
  { id: 'pc-cat-18', name: 'First Aid', imageUrl: squareImg('photo-1584308666744-24d5c474f2ae') },
  { id: 'pc-cat-19', name: 'Medical Supplies', imageUrl: squareImg('photo-1584036561566-baf8f5f1b144') },
  { id: 'pc-cat-20', name: 'Mobility Aids & Supports', imageUrl: squareImg('photo-1584036561566-baf8f5f1b144') },
  { id: 'pc-cat-21', name: 'Sexual Wellness', imageUrl: squareImg('photo-1596462502278-27bfdc403348') },
  { id: 'pc-cat-22', name: 'Ayurveda & Herbal', imageUrl: squareImg('photo-1545241047-6083a3684587') },
  { id: 'pc-cat-23', name: 'Homeopathy', imageUrl: squareImg('photo-1545241047-6083a3684587') },
  { id: 'pc-cat-24', name: 'Pet Care', imageUrl: squareImg('photo-1548199973-03cce0bbc87b') },
  { id: 'pc-cat-25', name: 'Sports Nutrition', imageUrl: squareImg('photo-1593095948071-474c5cc2c1cf') },
];

export const PHARMA_OFFERS_BADGES: PharmaOffersBadge[] = [
  { id: 1, title: 'UPTO 25% OFF', subtitle: 'On Medicines', bgColor: '#E8F5E9', icon: 'percent' },
  { id: 2, title: 'Flat 20% OFF', subtitle: 'On Health Products', bgColor: '#E3F2FD', icon: 'shield-check' },
  { id: 3, title: 'Free Delivery', subtitle: 'On orders above ₹499', bgColor: '#F3E5F5', icon: 'truck' },
  { id: 4, title: 'Easy Returns', subtitle: 'Quick & hassle-free', bgColor: '#FFF3E0', icon: 'rotate-ccw' },
];
