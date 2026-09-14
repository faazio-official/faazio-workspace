/**
 * Food sub-app home feed — static fixtures structured identically to the
 * existing mock layer (mocks/restaurants.ts, mocks/specials.ts) so the same
 * components/types can consume them. See data/DATA_CONTROL.md.
 */
const img = (id: string, w = 900, h = 620) =>
  `https://images.unsplash.com/${id}?fm=jpg&fit=crop&q=80&w=${w}&h=${h}`;

const squareImg = (id: string, w = 560) =>
  `https://images.unsplash.com/${id}?fm=jpg&fit=crop&q=80&w=${w}&h=${w}`;

export interface FoodType {
  id: string;
  name: string;
  image: string;
  rating: number;
  dietType: 'veg' | 'nonveg' | 'both';
}

/** Compact "nearby" restaurant row model, also consumed by the Home hub. */
export interface NearbyRestaurant {
  id: string;
  name: string;
  image: string;
  cuisine: string;
  rating: number;
  distance: number;
  priceForTwo: number;
  tags: string[];
  dietType: 'veg' | 'nonveg' | 'both';
}

export interface SnackBeverage {
  id: string;
  name: string;
  image: string;
  isVeg?: boolean;
}

/** "What's on your mind?" circular food images. */
export const TOP_FOODS_TO_ORDER: FoodType[] = [
  { id: 'tf-1', name: 'Burgers', image: squareImg('photo-1571091718767-18b5b1457add'), rating: 4.4, dietType: 'nonveg' },
  { id: 'tf-2', name: 'Pizza', image: squareImg('photo-1513104890138-7c749659a591'), rating: 4.6, dietType: 'nonveg' },
  { id: 'tf-3', name: 'Biryani', image: squareImg('photo-1589302168068-964664d93dc0'), rating: 4.7, dietType: 'nonveg' },
  { id: 'tf-4', name: 'Sushi', image: squareImg('photo-1579871494447-9811cf80d66c'), rating: 4.5, dietType: 'nonveg' },
  { id: 'tf-5', name: 'Pasta', image: squareImg('photo-1621996346565-e3dbc646d9a9'), rating: 4.3, dietType: 'both' },
  { id: 'tf-6', name: 'Noodles', image: squareImg('photo-1585032226651-759b368d7246'), rating: 4.2, dietType: 'both' },
  { id: 'tf-7', name: 'Desserts', image: squareImg('photo-1551024506-0bccd828d307'), rating: 4.8, dietType: 'veg' },
  { id: 'tf-8', name: 'Salads', image: squareImg('photo-1512621776951-a57141f2eefd'), rating: 4.1, dietType: 'veg' },
];

/** "Snacks & Beverages" square tiles. */
export const SNACKS_BEVERAGES: SnackBeverage[] = [
  { id: 'sb-1', name: 'Samosa', image: squareImg('photo-1601050690597-df0568f70950'), isVeg: true },
  { id: 'sb-2', name: 'French Fries', image: squareImg('photo-1576107232684-1279f390859f'), isVeg: true },
  { id: 'sb-3', name: 'Spring Rolls', image: squareImg('photo-1606755962773-d324e0a13086'), isVeg: true },
  { id: 'sb-4', name: 'Cold Coffee', image: squareImg('photo-1461023058943-07fcbe16d735'), isVeg: true },
  { id: 'sb-5', name: 'Masala Chai', image: squareImg('photo-1571934811356-5cc061b6821f'), isVeg: true },
  { id: 'sb-6', name: 'Milkshake', image: squareImg('photo-1572490122747-3968b75cc699'), isVeg: true },
];
