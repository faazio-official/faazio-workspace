export interface Review {
  id: string;
  user: string;
  rating: number;
  comment: string;
  date: string;
  avatar: string;
}

export interface Product {
  id: string;
  name: string;
  price: number;
  emoji: string;
  desc: string;
  rating: string;
  app: 'FOOD' | 'MART' | 'GROCERY' | 'PHARMA';
  catName?: string;
  category?: string;
  unit?: string;
  badge?: string;
  image?: string;
  reviews?: Review[];
  specs?: { label: string; value: string }[];
}

export interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  emoji: string;
  app?: 'FOOD' | 'MART' | 'GROCERY' | 'PHARMA';
}
