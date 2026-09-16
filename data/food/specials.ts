/**
 * @mock Static fixture — seeded sample data for local development until the Go Chi
 * backend (server/) is wired. See data/DATA_CONTROL.md.
 */
import type { Product, SpecialDish } from '../types';

const img = (id: string, w = 560, h = 560) =>
  `https://images.unsplash.com/${id}?fm=jpg&fit=crop&q=80&w=${w}&h=${h}`;

/**
 * Today's Special — clean food photography, no promotional labels.
 * Single source of truth: read by the Food Dining "Today's Special Near You"
 * rail and the Home "Today's Special" stacked rail (2-up columns).
 */
export const TODAYS_SPECIALS: SpecialDish[] = [
  {
    id: 'sp-1',
    dishName: 'Hyderabadi Mutton Biryani',
    restaurant: 'Biryani Basera',
    price: 499,
    image: img('photo-1589302168068-964664d93dc0'),
    isVeg: false,
    description:
      'Slow-cooked mutton layered over fragrant basmati rice with saffron and fried onions.',
    cuisine: 'Hyderabadi',
    rating: 4.8,
    deliveryTime: '30 min',
  },
  {
    id: 'sp-2',
    dishName: 'Chicken Dum Biryani',
    restaurant: 'Paradise Biryani House',
    price: 320,
    image: img('photo-1589301760014-d929f3979dbc'),
    isVeg: false,
    description:
      'Tender chicken dum-cooked with aged basmati rice and a blend of whole spices.',
    cuisine: 'Hyderabadi',
    rating: 4.9,
    deliveryTime: '30 min',
  },
  {
    id: 'sp-3',
    dishName: 'Truffle Alfredo Pasta',
    restaurant: 'Milano Pizza & Pasta',
    price: 380,
    image: img('photo-1621996346565-e3dbc646d9a9'),
    isVeg: true,
    description:
      'Fettuccine tossed in a creamy truffle alfredo sauce with a parmesan finish.',
    cuisine: 'Italian',
    rating: 4.6,
    deliveryTime: '35 min',
  },
  {
    id: 'sp-4',
    dishName: 'Wood-Fired Margherita',
    restaurant: 'Olive Cafe',
    price: 420,
    image: img('photo-1604382355076-af4b0eb60143'),
    isVeg: true,
    description:
      'Blistered sourdough base with san marzano tomato, fresh mozzarella and basil.',
    cuisine: 'Pizza',
    rating: 4.7,
    deliveryTime: '20 min',
  },
  {
    id: 'sp-5',
    dishName: 'Grilled Ribeye Steak',
    restaurant: 'Sea Salt Grill',
    price: 890,
    image: img('photo-1603360946369-dc9bb6258143'),
    isVeg: false,
    description:
      'Char-grilled ribeye with herb butter, served with roasted vegetables.',
    cuisine: 'Continental',
    rating: 4.8,
    deliveryTime: '28 min',
  },
  {
    id: 'sp-6',
    dishName: 'Charcoal Grilled Chicken',
    restaurant: 'The Brass Monkey',
    price: 460,
    image: img('photo-1598103442097-8b74394b95c6'),
    isVeg: false,
    description:
      'Smoky charcoal-grilled chicken thighs glazed with a tangy pepper marinade.',
    cuisine: 'Grill',
    rating: 4.6,
    deliveryTime: '35 min',
  },
  {
    id: 'sp-7',
    dishName: 'Masala Cheese Dosa',
    restaurant: 'Dakshin Swad',
    price: 190,
    image: img('photo-1540189549336-e6e99c3679fe'),
    isVeg: true,
    description:
      'Crisp golden dosa stuffed with spiced potato and a generous layer of molten cheese.',
    cuisine: 'South Indian',
    rating: 4.7,
    deliveryTime: '26 min',
  },
  {
    id: 'sp-8',
    dishName: 'Butter Paneer Tikka',
    restaurant: 'The Spice Room',
    price: 310,
    image: img('photo-1504674900247-0877df9cc836'),
    isVeg: true,
    description:
      'Charred paneer cubes tossed in a buttery makhani sauce with kasuri methi.',
    cuisine: 'North Indian',
    rating: 4.8,
    deliveryTime: '30 min',
  },
  {
    id: 'sp-9',
    dishName: 'Honey Chilli Chicken Noodles',
    restaurant: 'Lotus & Lantern',
    price: 340,
    image: img('photo-1585032226651-759b368d7246'),
    isVeg: false,
    description:
      'Wok-tossed noodles with crispy chicken and a sticky honey-chilli glaze.',
    cuisine: 'Chinese',
    rating: 4.6,
    deliveryTime: '38 min',
  },
  {
    id: 'sp-10',
    dishName: 'Garlic Butter Prawns',
    restaurant: 'The Coastal House',
    price: 720,
    image: img('photo-1553621042-f6e147245754'),
    isVeg: false,
    description:
      'Plump prawns sautéed in garlic butter with a squeeze of lemon and herbs.',
    cuisine: 'Seafood',
    rating: 4.9,
    deliveryTime: '40 min',
  },
  {
    id: 'sp-11',
    dishName: 'Smash Bacon Burger',
    restaurant: 'Hungry Minds Cafe',
    price: 290,
    image: img('photo-1571091718767-18b5b1457add'),
    isVeg: false,
    description:
      'Double-smashed patty with crispy bacon, cheddar and house sauce in a toasted bun.',
    cuisine: 'Fast Food',
    rating: 4.7,
    deliveryTime: '20 min',
  },
  {
    id: 'sp-12',
    dishName: 'Signature Virgin Mojito',
    restaurant: 'Skyline Bistro',
    price: 180,
    image: img('photo-1551538827-9c037cb4f32a'),
    isVeg: true,
    description:
      'Fresh mint, lime and soda over crushed ice with a sugar-sweetened tang.',
    cuisine: 'Beverage',
    rating: 4.9,
    deliveryTime: '25 min',
  },
  {
    id: 'sp-13',
    dishName: 'Gamberi al Aglio',
    restaurant: 'Trattoria Bella Italia',
    price: 720,
    image: img('photo-1553621042-f6e147245754'),
    isVeg: false,
    description:
      'Sautéed tiger prawns with garlic, chilli and white wine over grilled crostini.',
    cuisine: 'Italian',
    rating: 4.8,
    deliveryTime: '30 min',
  },
  {
    id: 'sp-14',
    dishName: 'Murg Malai Tikka',
    restaurant: 'Royal Mughlai Dastarkhwan',
    price: 340,
    image: img('photo-1598103442097-8b74394b95c6'),
    isVeg: false,
    description:
      'Creamy yogurt-marinated chicken tikka grilled in a charcoal tandoor.',
    cuisine: 'Mughlai',
    rating: 4.9,
    deliveryTime: '32 min',
  },
  {
    id: 'sp-15',
    dishName: 'Korean Kimchi Fried Rice',
    restaurant: 'Seoul Street Korean Kitchen',
    price: 380,
    image: img('photo-1546069901-ba9599a7e63c'),
    isVeg: false,
    description:
      'Wok-tossed rice with spicy kimchi, spring onion and a sunny-side egg.',
    cuisine: 'Korean',
    rating: 4.7,
    deliveryTime: '26 min',
  },
  {
    id: 'sp-16',
    dishName: 'Grilled Fish Peri Peri',
    restaurant: 'Catch of the Day Seafood',
    price: 640,
    image: img('photo-1519708227418-c8fd9a32b7a2'),
    isVeg: false,
    description:
      'Whole grilled fish glazed in a fiery peri-peri marinade with lemon wedges.',
    cuisine: 'Seafood',
    rating: 4.8,
    deliveryTime: '40 min',
  },
];

/**
 * Map a dining "today's special" dish to a full Product so it can render in the
 * unified CommonProductDetail page. FOOD dishes carry no MRP/unit by default,
 * so those are left undefined (the detail page falls back gracefully).
 */
export const dishToProduct = (dish: SpecialDish): Product => ({
  id: dish.id,
  app: 'FOOD',
  category: dish.cuisine ?? 'Featured',
  name: dish.dishName,
  price: dish.price,
  emoji: '🍽️',
  rating: dish.rating ?? 4.5,
  desc: dish.description,
  image: dish.image,
  shop: dish.restaurant,
  attributes: { brand: dish.restaurant, dietary: dish.isVeg ? 'Vegetarian' : 'Non-Veg' },
});
