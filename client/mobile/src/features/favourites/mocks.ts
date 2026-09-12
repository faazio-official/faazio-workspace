export type FavIconKey = 'grid' | 'bag' | 'food' | 'pharma';

export interface FilterChip {
  id: 'all' | 'mart' | 'food' | 'pharma';
  label: string;
  count: number;
  icon: FavIconKey;
  active?: boolean;
}

export interface FavItem {
  id: string;
  name: string;
  qty: string;
  price: number;
  oldPrice: number;
  discount: string;
}

export interface FavCategory {
  id: 'mart' | 'food' | 'pharma';
  title: string;
  icon: FavIconKey;
  color: string;
  items: FavItem[];
}

export const filterChips: FilterChip[] = [
  { id: 'all', label: 'All', count: 8, icon: 'grid', active: true },
  { id: 'mart', label: 'Mart', count: 4, icon: 'bag' },
  { id: 'food', label: 'Food', count: 2, icon: 'food' },
  { id: 'pharma', label: 'Pharma', count: 2, icon: 'pharma' },
];

const martItems: FavItem[] = [
  { id: 'm1', name: 'Coca-Cola Diet Coke Can', qty: '300 ml', price: 155, oldPrice: 169, discount: '8% OFF' },
  { id: 'm2', name: 'Red Bull Sugar Free', qty: '250 ml', price: 115, oldPrice: 130, discount: '12% OFF' },
  { id: 'g1', name: 'Imported Daily Apple (Sebu)', qty: '2 pieces', price: 91, oldPrice: 114, discount: '20% OFF' },
  { id: 'g2', name: 'Id Fresh Pouch Curd', qty: '500 gm', price: 30, oldPrice: 35, discount: '14% OFF' },
];

const foodItems: FavItem[] = [
  { id: 'f1', name: 'Cornitos Cheese and Herbs Nacho Crisps', qty: '55 gm', price: 34, oldPrice: 35, discount: '3% OFF' },
  { id: 'f2', name: 'CookieMan Double Chocolate Cookies', qty: '200 gm', price: 284, oldPrice: 350, discount: '19% OFF' },
];

const pharmaItems: FavItem[] = [
  { id: 'p1', name: 'Vicks VapoRub', qty: '50 ml', price: 189, oldPrice: 210, discount: '10% OFF' },
  { id: 'p2', name: 'Crocin Advance 500mg Tablet', qty: '15 tablets', price: 45, oldPrice: 52, discount: '13% OFF' },
];

export const favCategories: FavCategory[] = [
  { id: 'mart', title: 'Mart', icon: 'bag', color: '#118C4F', items: martItems },
  { id: 'food', title: 'Food', icon: 'food', color: '#F97316', items: foodItems },
  { id: 'pharma', title: 'Pharma', icon: 'pharma', color: '#0EA5E9', items: pharmaItems },
];

export const favsSummary = {
  count: 8,
  total: '₹943',
  oldTotal: '₹1,135',
};
