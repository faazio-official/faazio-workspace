/**
 * Food sub-app home feed — static fixtures structured identically to the
 * existing mock layer (mocks/restaurants.ts, mocks/specials.ts) so the same
 * components/types can consume them. See data/DATA_CONTROL.md.
 */
import type { ComponentType } from 'react';
import {
  UtensilsCrossed,
  Coffee,
  Users,
  Utensils,
  Flame,
  Drumstick,
  Pizza,
} from 'lucide-react-native';
import type { DiningRestaurant } from './types';

const img = (id: string, w = 900, h = 620) =>
  `https://images.unsplash.com/${id}?fm=jpg&fit=crop&q=80&w=${w}&h=${h}`;

const squareImg = (id: string, w = 560) =>
  `https://images.unsplash.com/${id}?fm=jpg&fit=crop&q=80&w=${w}&h=${w}`;

export interface QuickCategory {
  id: string;
  label: string;
  icon: ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
  /** Search term submitted in the food Search page when this category is tapped. */
  searchQuery: string;
}

export interface FoodType {
  id: string;
  name: string;
  image: string;
  rating: number;
}

export interface NearbyRestaurant {
  id: string;
  name: string;
  image: string;
  cuisine: string;
  rating: number;
  distance: number;
  priceForTwo: number;
  tags: string[];
}

/** Section 3 — quick category bubbles (horizontal scroll, 7 items). */
export const QUICK_CATEGORIES: QuickCategory[] = [
  { id: 'fine-dining', label: 'Fine Dining', icon: UtensilsCrossed, searchQuery: 'Fine Dining' },
  { id: 'cafes', label: 'Cafes', icon: Coffee, searchQuery: 'Cafes' },
  { id: 'family-dining', label: 'Family Dining', icon: Users, searchQuery: 'Family Dining' },
  { id: 'buffet', label: 'Buffet', icon: Utensils, searchQuery: 'Buffet' },
  { id: 'popular-food', label: 'Popular Food', icon: Flame, searchQuery: 'Popular Food' },
  { id: 'biryani', label: 'Biryani', icon: Drumstick, searchQuery: 'Biryani' },
  { id: 'pizza', label: 'Pizza', icon: Pizza, searchQuery: 'Pizza' },
];

/** Section 4 — "Popular Dining Spots" horizontal rail. */
export const POPULAR_DINING_SPOTS: DiningRestaurant[] = [
  {
    id: 'pd-1',
    name: 'The Spice Room',
    image: img('photo-1517248135467-4c7edcad34c4'),
    rating: 4.8,
    ratingCount: 3120,
    distance: 2.4,
    deliveryTime: '30 min',
    priceForTwo: 1400,
    cuisine: 'North Indian • Fine Dining',
    cuisines: ['North Indian', 'Fine Dining'],
    neighborhood: 'Jubilee Hills',
    offerTag: '20% OFF',
    address: 'Road 5, Jubilee Hills, Hyderabad',
    latitude: 17.4319,
    longitude: 78.414,
    isFavourite: false,
  },
  {
    id: 'pd-2',
    name: 'Skyline Bistro',
    image: img('photo-1600565193348-f74bd3c7ccdf'),
    rating: 4.9,
    ratingCount: 2480,
    distance: 1.2,
    deliveryTime: '25 min',
    priceForTwo: 1800,
    cuisine: 'Continental • Rooftop',
    cuisines: ['Continental', 'Rooftop'],
    neighborhood: 'Banjara Hills',
    offerTag: 'FLAT ₹200 OFF',
    address: 'Road 12, Banjara Hills, Hyderabad',
    latitude: 17.422,
    longitude: 78.442,
    isFavourite: true,
  },
  {
    id: 'pd-3',
    name: 'Olive Cafe',
    image: img('photo-1554118811-1e0d58224f24'),
    rating: 4.7,
    ratingCount: 1890,
    distance: 0.8,
    deliveryTime: '20 min',
    priceForTwo: 1200,
    cuisine: 'Cafe • Italian',
    cuisines: ['Cafe', 'Italian'],
    neighborhood: 'Hitech City',
    offerTag: '15% OFF',
    address: 'Hitech City Main Road, Hyderabad',
    latitude: 17.4435,
    longitude: 78.3772,
    isFavourite: true,
  },
  {
    id: 'pd-4',
    name: 'The Coastal House',
    image: img('photo-1550966871-3ed3cdb5ed0c'),
    rating: 4.9,
    ratingCount: 1540,
    distance: 4.6,
    deliveryTime: '40 min',
    priceForTwo: 2200,
    cuisine: 'Seafood • Coastal',
    cuisines: ['Seafood', 'Coastal'],
    neighborhood: 'Jubilee Hills',
    offerTag: '25% OFF',
    address: 'Jubilee Hills Check Post, Hyderabad',
    latitude: 17.4287,
    longitude: 78.4041,
    isFavourite: false,
  },
  {
    id: 'pd-5',
    name: 'Veranda Dining',
    image: img('photo-1414235077428-338989a2e8c0'),
    rating: 4.6,
    ratingCount: 980,
    distance: 5.3,
    deliveryTime: '45 min',
    priceForTwo: 2000,
    cuisine: 'Multi-cuisine • Fine Dining',
    cuisines: ['Multi-cuisine', 'Fine Dining'],
    neighborhood: 'Somajiguda',
    address: 'Plot 89, Somajiguda, Hyderabad',
    latitude: 17.4137,
    longitude: 78.4621,
    isFavourite: false,
  },
];

/** Section 5 — "Top Food To Order" horizontal rail (circular food images). */
export const TOP_FOODS_TO_ORDER: FoodType[] = [
  { id: 'tf-1', name: 'Burgers', image: squareImg('photo-1571091718767-18b5b1457add'), rating: 4.4 },
  { id: 'tf-2', name: 'Pizza', image: squareImg('photo-1513104890138-7c749659a591'), rating: 4.6 },
  { id: 'tf-3', name: 'Biryani', image: squareImg('photo-1589302168068-964664d93dc0'), rating: 4.7 },
  { id: 'tf-4', name: 'Sushi', image: squareImg('photo-1579871494447-9811cf80d66c'), rating: 4.5 },
  { id: 'tf-5', name: 'Pasta', image: squareImg('photo-1621996346565-e3dbc646d9a9'), rating: 4.3 },
  { id: 'tf-6', name: 'Noodles', image: squareImg('photo-1585032226651-759b368d7246'), rating: 4.2 },
  { id: 'tf-7', name: 'Desserts', image: squareImg('photo-1551024506-0bccd828d307'), rating: 4.8 },
  { id: 'tf-8', name: 'Salads', image: squareImg('photo-1512621776951-a57141f2eefd'), rating: 4.1 },
];

/** Section 6 — "Restaurants Nearby" vertical list rows. */
export const NEARBY_RESTAURANTS: NearbyRestaurant[] = [
  {
    id: 'nr-1',
    name: 'The Spice Room',
    image: img('photo-1517248135467-4c7edcad34c4', 300, 300),
    cuisine: 'North Indian • Fine Dining',
    rating: 4.8,
    distance: 2.4,
    priceForTwo: 1400,
    tags: ['Great Ambience', 'Valet Parking'],
  },
  {
    id: 'nr-2',
    name: 'Green Leaf Bistro',
    image: img('photo-1537047902294-62a40c20a6ae', 300, 300),
    cuisine: 'South Indian • Pure Veg',
    rating: 4.7,
    distance: 1.8,
    priceForTwo: 900,
    tags: ['Pure Veg', 'Family Friendly'],
  },
  {
    id: 'nr-3',
    name: 'Naan & Kebab Junction',
    image: img('photo-1517486808906-6ca8b3f04846', 300, 300),
    cuisine: 'Tandoor • North Indian',
    rating: 4.9,
    distance: 3.1,
    priceForTwo: 1300,
    tags: ['Free Delivery', 'Live Music'],
  },
  {
    id: 'nr-4',
    name: 'Sea Salt Grill',
    image: img('photo-1559339352-11d035aa65de', 300, 300),
    cuisine: 'Continental • Grill',
    rating: 4.8,
    distance: 4.2,
    priceForTwo: 1700,
    tags: ['Great Ambience', 'Outdoor Seating'],
  },
  {
    id: 'nr-5',
    name: 'Olive Cafe',
    image: img('photo-1554118811-1e0d58224f24', 300, 300),
    cuisine: 'Cafe • Italian',
    rating: 4.7,
    distance: 0.9,
    priceForTwo: 1200,
    tags: ['Cozy Vibes', 'Free WiFi'],
  },
  {
    id: 'nr-6',
    name: 'Wok Express & Noodles',
    image: img('photo-1569718212165-3a8278d5f624', 300, 300),
    cuisine: 'Chinese • Asian',
    rating: 4.8,
    distance: 2.7,
    priceForTwo: 800,
    tags: ['Fast Delivery', 'Spicy Menu'],
  },
  {
    id: 'nr-7',
    name: 'La Paris Creperie',
    image: img('photo-1509440159596-0249088772ff', 300, 300),
    cuisine: 'Bakery • Desserts',
    rating: 4.9,
    distance: 1.4,
    priceForTwo: 700,
    tags: ['Valet Parking', 'Open Late'],
  },
  {
    id: 'nr-8',
    name: 'Hungry Minds Cafe',
    image: img('photo-1555396273-367ea4eb4db5', 300, 300),
    cuisine: 'Fast Food • Beverages',
    rating: 4.6,
    distance: 3.8,
    priceForTwo: 600,
    tags: ['Family Friendly', 'Free Delivery'],
  },
];
