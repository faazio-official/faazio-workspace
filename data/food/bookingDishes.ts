/**
 * @mock Static fixture — seeded sample data for local development until the Go Chi
 * backend (server/) is wired. See data/DATA_CONTROL.md.
 */
export interface BookingDish {
  id: string;
  name: string;
  restaurant: string;
  category: string;
  tab: string;
  rating: string;
  tags: string;
  price: string;
  emoji: string;
  isSpecial: boolean;
  image: string;
}

export const BOOKING_DISHES_DB: BookingDish[] = [
  { id: 'bd-1', name: 'Garasen Vegetarian Platter', restaurant: 'The Green Garden Bistro', category: 'Vegan', tab: 'Dinner', rating: '4.9', tags: 'Vegetables • Salad • Hummus', price: '₹250', emoji: '🥗', isSpecial: true, image: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?fm=jpg&fit=crop&q=80&w=400&h=300' },
  { id: 'bd-2', name: 'Pesto Vegan Penne', restaurant: 'The Green Garden Bistro', category: 'Vegan', tab: 'Dinner', rating: '4.8', tags: 'Pasta • Organic • Greens', price: '₹320', emoji: '🍝', isSpecial: false, image: 'https://images.unsplash.com/photo-1473093295043-cdd812d0e601?fm=jpg&fit=crop&q=80&w=400&h=300' },
  { id: 'bd-3', name: 'Neapolitan Margherita Pizza', restaurant: 'Milano Pizza & Pasta Co.', category: 'Pizza', tab: 'Dinner', rating: '4.9', tags: 'Cheese • Tomato • Basil', price: '₹380', emoji: '🍕', isSpecial: true, image: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?fm=jpg&fit=crop&q=80&w=400&h=300' },
  { id: 'bd-4', name: 'Spicy Truffle Pizza', restaurant: 'Milano Pizza & Pasta Co.', category: 'Pizza', tab: 'Dinner', rating: '4.7', tags: 'Mushroom • Arugula • Truffle', price: '₹450', emoji: '🍕', isSpecial: false, image: 'https://images.unsplash.com/photo-1574071318508-1cdbab80d002?fm=jpg&fit=crop&q=80&w=400&h=300' },
  { id: 'bd-5', name: 'Omahs Salmon Sushi Rolls', restaurant: 'Kyoto House Sushi Bar', category: 'Sushi', tab: 'Dinner', rating: '4.9', tags: 'Raw Fish • Rice • Wasabi', price: '₹490', emoji: '🍣', isSpecial: true, image: 'https://images.unsplash.com/photo-1579871494447-9811cf80d66c?fm=jpg&fit=crop&q=80&w=400&h=300' },
  { id: 'bd-6', name: 'Premium Classic Hot Dog', restaurant: 'Broadway Diner & Hotdogs', category: 'Hot Dog', tab: 'Dinner', rating: '4.6', tags: 'Sausage • Mustard • Relish', price: '₹190', emoji: '🌭', isSpecial: false, image: 'https://images.unsplash.com/photo-1619740455993-9e612b1af08a?fm=jpg&fit=crop&q=80&w=400&h=300' },
  { id: 'bd-7', name: 'Morning Berry Granola', restaurant: 'Aura Organic Kitchen', category: 'Vegan', tab: 'Breakfast', rating: '4.8', tags: 'Yogurt • Oats • Mixed Berries', price: '₹180', emoji: '🥣', isSpecial: true, image: 'https://images.unsplash.com/photo-1488477181946-6428a0291777?fm=jpg&fit=crop&q=80&w=400&h=300' },
  { id: 'bd-8', name: 'English Toast & Hash Combo', restaurant: 'Aura Organic Kitchen', category: 'Hot Dog', tab: 'Breakfast', rating: '4.7', tags: 'Eggs • Bacon • Beans', price: '₹220', emoji: '🍳', isSpecial: false, image: 'https://images.unsplash.com/photo-1533089860892-a7c6f0a88666?fm=jpg&fit=crop&q=80&w=400&h=300' },
  { id: 'bd-9', name: 'Italian Antipasto Platter', restaurant: 'Trattoria Bella Italia', category: 'Italian', tab: 'Dinner', rating: '4.8', tags: 'Charcuterie • Cheese • Olives', price: '₹520', emoji: '🧀', isSpecial: true, image: 'https://images.unsplash.com/photo-1547592180-85f173990554?fm=jpg&fit=crop&q=80&w=400&h=300' },
  { id: 'bd-10', name: 'Bibimbap Lunch Set', restaurant: 'Seoul Street Korean Kitchen', category: 'Korean', tab: 'Lunch', rating: '4.8', tags: 'Rice • Veggies • Gochujang', price: '₹460', emoji: '🍚', isSpecial: false, image: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?fm=jpg&fit=crop&q=80&w=400&h=300' },
];
