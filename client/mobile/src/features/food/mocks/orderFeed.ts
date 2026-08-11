/**
 * Order feed mock data — hero promos, cuisines, meals & combos, snacks &
 * beverages. Structured identically to the existing mock layer so components
 * can consume them with the same patterns. See data/DATA_CONTROL.md.
 */

const img = (id: string, w = 900, h = 620) =>
  `https://images.unsplash.com/${id}?fm=jpg&fit=crop&q=80&w=${w}&h=${h}`;

const squareImg = (id: string, w = 560) =>
  `https://images.unsplash.com/${id}?fm=jpg&fit=crop&q=80&w=${w}&h=${w}`;

export interface Promo {
  id: string;
  title: string;
  discount: string;
  code: string;
  subtext: string;
  image: string;
  bgColor: string;
}

export interface CuisineItem {
  id: string;
  name: string;
  image: string;
}

export interface MealCombo {
  id: string;
  name: string;
  startingPrice: number;
  image: string;
}

export interface SnackBeverage {
  id: string;
  name: string;
  image: string;
}

export const PROMOS: Promo[] = [
  {
    id: 'promo-1',
    title: 'FLAT 50% OFF',
    discount: '50',
    code: 'FIRST50',
    subtext: 'Up to ₹120 on your first order',
    image: img('photo-1589302168068-964664d93dc0', 600, 400),
    bgColor: '#4A235A',
  },
  {
    id: 'promo-2',
    title: 'FREE DELIVERY',
    discount: '0',
    code: 'FREEDEL',
    subtext: 'On orders above ₹199',
    image: img('photo-1513104890138-7c749659a591', 600, 400),
    bgColor: '#1B4332',
  },
  {
    id: 'promo-3',
    title: 'GET 20% OFF',
    discount: '20',
    code: 'SAVE20',
    subtext: 'On all orders above ₹399',
    image: img('photo-1571091718767-18b5b1457add', 600, 400),
    bgColor: '#6B21A8',
  },
];

export const CUISINES: CuisineItem[] = [
  { id: 'c-1', name: 'North Indian', image: squareImg('photo-1585937421612-70a008359fbe') },
  { id: 'c-2', name: 'South Indian', image: squareImg('photo-1668236543090-82eba5ee5976') },
  { id: 'c-3', name: 'Chinese', image: squareImg('photo-1525755662778-989d0524087e') },
  { id: 'c-4', name: 'Continental', image: squareImg('photo-1544025162-d76694265947') },
  { id: 'c-5', name: 'Italian', image: squareImg('photo-1551183053-bf91a1d81141') },
  { id: 'c-6', name: 'Thai', image: squareImg('photo-1455619452474-d2be8b1e70cd') },
];

export const MEALS_COMBOS: MealCombo[] = [
  { id: 'mc-1', name: 'Thali Meals', startingPrice: 129, image: img('photo-1567188040759-fb8a883dc6d8', 400, 280) },
  { id: 'mc-2', name: 'Family Feast', startingPrice: 499, image: img('photo-1552566626-52f8b828add9', 400, 280) },
  { id: 'mc-3', name: 'Biryani Combo', startingPrice: 249, image: img('photo-1589302168068-964664d93dc0', 400, 280) },
  { id: 'mc-4', name: 'Lunch Box', startingPrice: 179, image: img('photo-1504674900247-0877df9cc836', 400, 280) },
  { id: 'mc-5', name: 'Party Pack', startingPrice: 799, image: img('photo-1565299624946-b28f40a0ae38', 400, 280) },
];

export const SNACKS_BEVERAGES: SnackBeverage[] = [
  { id: 'sb-1', name: 'Samosa', image: squareImg('photo-1601050690597-df0568f70950') },
  { id: 'sb-2', name: 'French Fries', image: squareImg('photo-1576107232684-1279f390859f') },
  { id: 'sb-3', name: 'Spring Rolls', image: squareImg('photo-1606755962773-d324e0a13086') },
  { id: 'sb-4', name: 'Cold Coffee', image: squareImg('photo-1461023058943-07fcbe16d735') },
  { id: 'sb-5', name: 'Masala Chai', image: squareImg('photo-1571934811356-5cc061b6821f') },
  { id: 'sb-6', name: 'Milkshake', image: squareImg('photo-1572490122747-3968b75cc699') },
];
