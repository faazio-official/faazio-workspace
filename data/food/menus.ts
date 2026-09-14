/**
 * @mock Static fixture — per-restaurant menu items for the dining rooms surfaced
 * in the Food dining tab (see `features/food/mocks/restaurants.ts`). Each row is
 * a `SpecialDish` whose `restaurant` field matches the dining restaurant's name,
 * so `RestaurantProfileScreen.getMenuForRestaurant()` can populate every
 * restaurant's "Recommended & Offers" rail with its own dishes instead of padding
 * the shared specials. See data/DATA_CONTROL.md.
 */
import type { SpecialDish } from '../types';

const img = (id: string, w = 400, h = 300) =>
  `https://images.unsplash.com/${id}?fm=jpg&fit=crop&q=80&w=${w}&h=${h}`;

type MenuSeed = Omit<SpecialDish, 'id'> & { key: string };

const MENUS: MenuSeed[] = [
  // ---- Skyline Bistro (rooftop / continental) ----
  { key: 'sky-1', dishName: 'Grilled Chicken Steak', restaurant: 'Skyline Bistro', price: 520, image: img('photo-1544025162-d76694265947'), isVeg: false, description: 'Chargrilled chicken breast with red wine jus, garlic mash and seasonal greens.', cuisine: 'Continental', rating: 4.8, deliveryTime: '25 min' },
  { key: 'sky-2', dishName: 'Truffle Mushroom Risotto', restaurant: 'Skyline Bistro', price: 480, image: img('photo-1476124369491-e7addf5db371'), isVeg: true, description: 'Creamy arborio rice with wild mushrooms, white truffle oil and parmesan.', cuisine: 'Continental', rating: 4.9, deliveryTime: '25 min' },
  { key: 'sky-3', dishName: 'Roast Veggie Bruschetta', restaurant: 'Skyline Bistro', price: 320, image: img('photo-1572695157366-5e585ab2b69f'), isVeg: true, description: 'Charred seasonal vegetables on toasted sourdough with basil pesto.', cuisine: 'Rooftop', rating: 4.6, deliveryTime: '20 min' },
  { key: 'sky-4', dishName: 'Herb Butter Grilled Fish', restaurant: 'Skyline Bistro', price: 680, image: img('photo-1519708227418-c8fd9a32b7a2'), isVeg: false, description: 'Pan-seared catch of the day with lemon herb butter and sautéed asparagus.', cuisine: 'Continental', rating: 4.8, deliveryTime: '30 min' },
  { key: 'sky-5', dishName: 'Classic Tiramisu', restaurant: 'Skyline Bistro', price: 290, image: img('photo-1571877227200-a0d98ea607e9'), isVeg: true, description: 'Layered espresso-soaked ladyfingers with mascarpone cream and cocoa.', cuisine: 'Continental', rating: 4.7, deliveryTime: '15 min' },
  // ---- The Spice Room (North Indian / Mughlai) ----
  { key: 'spice-1', dishName: 'Butter Chicken', restaurant: 'The Spice Room', price: 420, image: img('photo-1603894584373-5ac82b2ae398'), isVeg: false, description: 'Tandoori chicken simmered in a rich tomato-butter gravy with kasuri methi.', cuisine: 'North Indian', rating: 4.9, deliveryTime: '30 min' },
  { key: 'spice-2', dishName: 'Paneer Butter Masala', restaurant: 'The Spice Room', price: 360, image: img('photo-1631452180519-c014fe946bc7'), isVeg: true, description: 'Soft paneer cubes in a creamy tomato-cashew gravy.', cuisine: 'North Indian', rating: 4.8, deliveryTime: '30 min' },
  { key: 'spice-3', dishName: 'Mutton Rogan Josh', restaurant: 'The Spice Room', price: 520, image: img('photo-1601050690597-df0568f70950'), isVeg: false, description: 'Slow-cooked tender mutton in a fragrant Kashmiri red chilli gravy.', cuisine: 'Mughlai', rating: 4.9, deliveryTime: '35 min' },
  { key: 'spice-4', dishName: 'Garlic Naan Basket', restaurant: 'The Spice Room', price: 180, image: img('photo-1584637828277-43228b442c02'), isVeg: true, description: 'Four freshly baked naans brushed with garlic butter and coriander.', cuisine: 'North Indian', rating: 4.7, deliveryTime: '20 min' },
  // ---- Olive Cafe (cafe / italian) ----
  { key: 'olive-1', dishName: 'Penne Arrabbiata', restaurant: 'Olive Cafe', price: 380, image: img('photo-1473093295043-cdd812d0e601'), isVeg: true, description: 'Penne tossed in a spicy tomato sauce with garlic and red chilli flakes.', cuisine: 'Italian', rating: 4.7, deliveryTime: '20 min' },
  { key: 'olive-2', dishName: 'Caprese Panini', restaurant: 'Olive Cafe', price: 340, image: img('photo-1528735602780-2552fd46c7af'), isVeg: true, description: 'Mozzarella, tomato and basil pressed in a crisp ciabatta with balsamic glaze.', cuisine: 'Cafe', rating: 4.6, deliveryTime: '18 min' },
  { key: 'olive-3', dishName: 'Classic Club Sandwich', restaurant: 'Olive Cafe', price: 320, image: img('photo-1528735602780-2552fd46c7af'), isVeg: false, description: 'Triple-decker with grilled chicken, egg, lettuce, tomato and garlic mayo.', cuisine: 'Cafe', rating: 4.8, deliveryTime: '20 min' },
  { key: 'olive-4', dishName: 'Affogato', restaurant: 'Olive Cafe', price: 220, image: img('photo-1572490122747-3968b75cc699'), isVeg: true, description: 'Vanilla gelato drowned in a double shot of hot espresso.', cuisine: 'Cafe', rating: 4.9, deliveryTime: '10 min' },
  // ---- Copper Chimney (tandoor / north indian) ----
  { key: 'cc-1', dishName: 'Tandoori Chicken (Half)', restaurant: 'Copper Chimney', price: 390, image: img('photo-1598103442097-8b74394b95c6'), isVeg: false, description: 'Charcoal-fired chicken marinated in yogurt, ginger and garam masala.', cuisine: 'Tandoor', rating: 4.8, deliveryTime: '30 min' },
  { key: 'cc-2', dishName: 'Chicken Tikka', restaurant: 'Copper Chimney', price: 350, image: img('photo-1599487488170-d11ec9c172f0'), isVeg: false, description: 'Smoky boneless chicken tikka skewers with mint chutney.', cuisine: 'Tandoor', rating: 4.7, deliveryTime: '28 min' },
  { key: 'cc-3', dishName: 'Dal Tadka', restaurant: 'Copper Chimney', price: 260, image: img('photo-1546833999-b9f581a1996d'), isVeg: true, description: 'Yellow lentils tempered with ghee, garlic and dried red chillies.', cuisine: 'North Indian', rating: 4.6, deliveryTime: '25 min' },
  { key: 'cc-4', dishName: 'Veg Biryani', restaurant: 'Copper Chimney', price: 330, image: img('photo-1589302168068-964664d93dc0'), isVeg: true, description: 'Fragrant basmati layered with seasonal vegetables and saffron.', cuisine: 'North Indian', rating: 4.7, deliveryTime: '30 min' },
  // ---- The Coastal House (seafood / coastal) ----
  { key: 'coast-1', dishName: 'Kerala Fish Curry', restaurant: 'The Coastal House', price: 460, image: img('photo-1547592180-85f173990554'), isVeg: false, description: 'Kingfish simmered in tangy coconut curry with curry leaves and kokum.', cuisine: 'Coastal', rating: 4.9, deliveryTime: '35 min' },
  { key: 'coast-2', dishName: 'Prawn Ghee Roast', restaurant: 'The Coastal House', price: 520, image: img('photo-1553621042-f6e147245754'), isVeg: false, description: 'Kundapur-style prawns roasted in ghee with fiery red chilli masala.', cuisine: 'Seafood', rating: 4.8, deliveryTime: '35 min' },
  { key: 'coast-3', dishName: 'Crab Masala', restaurant: 'The Coastal House', price: 640, image: img('photo-1559737558-2f5a35f4523b'), isVeg: false, description: 'Whole crab in a spicy onion-coconut masala, best eaten with neer dosa.', cuisine: 'Seafood', rating: 4.9, deliveryTime: '40 min' },
  { key: 'coast-4', dishName: 'Neer Dosa', restaurant: 'The Coastal House', price: 140, image: img('photo-1630383249896-424e482df921'), isVeg: true, description: 'Soft lacy coconut crepes from coastal Karnataka.', cuisine: 'Coastal', rating: 4.7, deliveryTime: '20 min' },
  // ---- Veranda Dining (multi-cuisine) ----
  { key: 'ver-1', dishName: 'Chef Signature Kebab Platter', restaurant: 'Veranda Dining', price: 560, image: img('photo-1544025162-d76694265947'), isVeg: false, description: 'Assorted seekh, malai and hara bhara kebabs with dips.', cuisine: 'Multi-cuisine', rating: 4.8, deliveryTime: '35 min' },
  { key: 'ver-2', dishName: 'Thai Green Curry', restaurant: 'Veranda Dining', price: 480, image: img('photo-1563245372-f21724e3856d'), isVeg: true, description: 'Coconut curry with bamboo shoots, basil and jasmine rice.', cuisine: 'Multi-cuisine', rating: 4.7, deliveryTime: '30 min' },
  { key: 'ver-3', dishName: 'Wild Mushroom Pizza', restaurant: 'Veranda Dining', price: 520, image: img('photo-1513104890138-7c749659a591'), isVeg: true, description: 'Wood-fired pizza topped with wild mushrooms, rocket and truffle oil.', cuisine: 'Fine Dining', rating: 4.8, deliveryTime: '30 min' },
  { key: 'ver-4', dishName: 'Chocolate Fondant', restaurant: 'Veranda Dining', price: 320, image: img('photo-1571877227200-a0d98ea607e9'), isVeg: true, description: 'Molten chocolate cake with a vanilla bean ice cream scoop.', cuisine: 'Fine Dining', rating: 4.9, deliveryTime: '20 min' },
  // ---- Sea Salt Grill ----
  { key: 'ss-1', dishName: 'Grilled Prawn Skewers', restaurant: 'Sea Salt Grill', price: 560, image: img('photo-1553621042-f6e147245754'), isVeg: false, description: 'Chargrilled tiger prawns with lemon-garlic butter and chimichurri.', cuisine: 'Seafood', rating: 4.8, deliveryTime: '30 min' },
  { key: 'ss-2', dishName: 'Fish & Chips', restaurant: 'Sea Salt Grill', price: 460, image: img('photo-1579208575657-c595a05383b7'), isVeg: false, description: 'Beer-battered fish fillet with chunky fries and tartar sauce.', cuisine: 'Continental', rating: 4.7, deliveryTime: '25 min' },
  { key: 'ss-3', dishName: 'Grilled Veggie Stack', restaurant: 'Sea Salt Grill', price: 380, image: img('photo-1540420773420-3366772f4999'), isVeg: true, description: 'Grilled zucchini, capsicum and halloumi with a balsamic drizzle.', cuisine: 'Continental', rating: 4.6, deliveryTime: '25 min' },
  // ---- Green Leaf Bistro ----
  { key: 'gl-1', dishName: 'Mediterranean Bowl', restaurant: 'Green Leaf Bistro', price: 390, image: img('photo-1512621776951-a57141f2eefd'), isVeg: true, description: 'Quinoa, hummus, roasted veggies and feta with a tahini drizzle.', cuisine: 'Healthy', rating: 4.8, deliveryTime: '20 min' },
  { key: 'gl-2', dishName: 'Avocado Toast', restaurant: 'Green Leaf Bistro', price: 310, image: img('photo-1541519227354-08fa5d50c44d'), isVeg: true, description: 'Smashed avocado on multigrain toast with chilli flakes and lemon.', cuisine: 'Cafe', rating: 4.7, deliveryTime: '15 min' },
  { key: 'gl-3', dishName: 'Cobb Salad', restaurant: 'Green Leaf Bistro', price: 420, image: img('photo-1512621776951-a57141f2eefd'), isVeg: false, description: 'Grilled chicken, egg, avocado, bacon and blue cheese over greens.', cuisine: 'Healthy', rating: 4.7, deliveryTime: '20 min' },
  // ---- Morningside Diner ----
  { key: 'md-1', dishName: 'American Pancake Stack', restaurant: 'Morningside Diner', price: 340, image: img('photo-1567620905732-2d1ec7ab7445'), isVeg: true, description: 'Fluffy buttermilk pancakes with maple syrup and berries.', cuisine: 'Breakfast', rating: 4.8, deliveryTime: '18 min' },
  { key: 'md-2', dishName: 'Full English Breakfast', restaurant: 'Morningside Diner', price: 420, image: img('photo-1533089860892-a7c6f0a88666'), isVeg: false, description: 'Eggs, sausage, bacon, baked beans, toast and grilled tomato.', cuisine: 'Breakfast', rating: 4.7, deliveryTime: '20 min' },
  { key: 'md-3', dishName: 'Classic Waffle & Ice Cream', restaurant: 'Morningside Diner', price: 290, image: img('photo-1562376552-0d160a2f238d'), isVeg: true, description: 'Golden waffle topped with vanilla ice cream and chocolate sauce.', cuisine: 'Desserts', rating: 4.6, deliveryTime: '15 min' },
  // ---- The Brass Monkey ----
  { key: 'bm-1', dishName: 'Pulled Pork Sliders', restaurant: 'The Brass Monkey', price: 460, image: img('photo-1568901346375-23c9450c58cd'), isVeg: false, description: 'Slow-cooked pulled pork with BBQ sauce on mini brioche buns.', cuisine: 'Continental', rating: 4.8, deliveryTime: '25 min' },
  { key: 'bm-2', dishName: 'Buffalo Wings', restaurant: 'The Brass Monkey', price: 390, image: img('photo-1562967914-608f82629710'), isVeg: false, description: 'Crispy wings tossed in spicy buffalo sauce with blue cheese dip.', cuisine: 'Continental', rating: 4.7, deliveryTime: '22 min' },
  { key: 'bm-3', dishName: 'Truffle Fries', restaurant: 'The Brass Monkey', price: 240, image: img('photo-1573080496219-bb080dd4f877'), isVeg: true, description: 'Crispy fries with truffle oil, parmesan and herbs.', cuisine: 'Continental', rating: 4.6, deliveryTime: '15 min' },
  // ---- Terraza Latina ----
  { key: 'tl-1', dishName: 'Chicken Fajitas', restaurant: 'Terraza Latina', price: 480, image: img('photo-1615937657715-bc7b4b7962c1'), isVeg: false, description: 'Sizzling chicken strips with peppers, tortillas, salsa and sour cream.', cuisine: 'Mexican', rating: 4.8, deliveryTime: '30 min' },
  { key: 'tl-2', dishName: 'Veg Burrito Bowl', restaurant: 'Terraza Latina', price: 390, image: img('photo-1526137844794-45f1041f397c'), isVeg: true, description: 'Mexican rice, beans, corn salsa, guacamole and cheese.', cuisine: 'Mexican', rating: 4.7, deliveryTime: '25 min' },
  { key: 'tl-3', dishName: 'Churros with Chocolate', restaurant: 'Terraza Latina', price: 260, image: img('photo-1624378439575-d8705ad7ae80'), isVeg: true, description: 'Cinnamon-sugar churros with a warm chocolate dip.', cuisine: 'Mexican', rating: 4.9, deliveryTime: '15 min' },
  // ---- Naan & Kebab Junction ----
  { key: 'nk-1', dishName: 'Seekh Kebab Roll', restaurant: 'Naan & Kebab Junction', price: 280, image: img('photo-1601050690597-df0568f70950'), isVeg: false, description: 'Spiced minced lamb seekh wrapped in rumali roti with onions.', cuisine: 'Mughlai', rating: 4.8, deliveryTime: '20 min' },
  { key: 'nk-2', dishName: 'Paneer Tikka Roll', restaurant: 'Naan & Kebab Junction', price: 240, image: img('photo-1601050690597-df0568f70950'), isVeg: true, description: 'Charred paneer tikka in a flaky paratha with mint chutney.', cuisine: 'Mughlai', rating: 4.7, deliveryTime: '18 min' },
  { key: 'nk-3', dishName: 'Afghani Chicken Kebab', restaurant: 'Naan & Kebab Junction', price: 360, image: img('photo-1599487488170-d11ec9c172f0'), isVeg: false, description: 'Creamy, mildly spiced chicken kebabs with a saffron finish.', cuisine: 'Tandoor', rating: 4.8, deliveryTime: '25 min' },
  // ---- Cafe Corretto ----
  { key: 'cafe-1', dishName: 'Flat White', restaurant: 'Cafe Corretto', price: 190, image: img('photo-1509042239860-f550ce710b93'), isVeg: true, description: 'Velvety double shot espresso with silky steamed milk.', cuisine: 'Cafe', rating: 4.9, deliveryTime: '10 min' },
  { key: 'cafe-2', dishName: 'Pesto Pasta', restaurant: 'Cafe Corretto', price: 380, image: img('photo-1473093295043-cdd812d0e601'), isVeg: true, description: 'Fusilli tossed in fresh basil pesto with cherry tomatoes and pine nuts.', cuisine: 'Italian', rating: 4.7, deliveryTime: '20 min' },
  { key: 'cafe-3', dishName: 'Blueberry Cheesecake', restaurant: 'Cafe Corretto', price: 300, image: img('photo-1533134242443-d4fd215305ad'), isVeg: true, description: 'Creamy baked cheesecake with a blueberry compote topping.', cuisine: 'Desserts', rating: 4.8, deliveryTime: '15 min' },
  // ---- The Garden Table ----
  { key: 'gt-1', dishName: 'Farmhouse Garden Salad', restaurant: 'The Garden Table', price: 350, image: img('photo-1512621776951-a57141f2eefd'), isVeg: true, description: 'Fresh garden greens, heirloom tomatoes, cucumber and vinaigrette.', cuisine: 'Salads', rating: 4.7, deliveryTime: '15 min' },
  { key: 'gt-2', dishName: 'Harvest Grain Bowl', restaurant: 'The Garden Table', price: 420, image: img('photo-1540420773420-3366772f4999'), isVeg: true, description: 'Brown rice, roasted pumpkin, chickpeas, kale and tahini.', cuisine: 'Healthy', rating: 4.8, deliveryTime: '20 min' },
  { key: 'gt-3', dishName: 'Berry Smoothie Bowl', restaurant: 'The Garden Table', price: 320, image: img('photo-1490474418585-ba9bad8fd0ea'), isVeg: true, description: 'Blended berries topped with granola, coconut and chia.', cuisine: 'Healthy', rating: 4.9, deliveryTime: '12 min' },
  // ---- Lotus & Lantern ----
  { key: 'll-1', dishName: 'Cantonese Chow Mein', restaurant: 'Lotus & Lantern', price: 420, image: img('photo-1585032226651-759b368d7246'), isVeg: false, description: 'Wok-tossed noodles with chicken, cabbage, carrots and soy.', cuisine: 'Chinese', rating: 4.8, deliveryTime: '25 min' },
  { key: 'll-2', dishName: 'Veg Spring Rolls', restaurant: 'Lotus & Lantern', price: 280, image: img('photo-1563245372-f21724e3856d'), isVeg: true, description: 'Crispy rolls stuffed with vegetables, served with sweet chilli.', cuisine: 'Chinese', rating: 4.6, deliveryTime: '20 min' },
  { key: 'll-3', dishName: 'Dim Sum Platter', restaurant: 'Lotus & Lantern', price: 460, image: img('photo-1563245372-f21724e3856d'), isVeg: false, description: 'Steamed chicken and prawn dumplings with dipping sauces.', cuisine: 'Chinese', rating: 4.7, deliveryTime: '25 min' },
  // ---- The Irish Anchor ----
  { key: 'ia-1', dishName: 'Irish Beef Stew', restaurant: 'The Irish Anchor', price: 520, image: img('photo-1547592180-85f173990554'), isVeg: false, description: 'Slow-braised beef with root vegetables in a rich stout gravy.', cuisine: 'Continental', rating: 4.8, deliveryTime: '30 min' },
  { key: 'ia-2', dishName: 'Fish & Mushroom Pie', restaurant: 'The Irish Anchor', price: 460, image: img('photo-1601050690597-df0568f70950'), isVeg: false, description: 'Creamy fish and mushroom filling under a golden puff pastry.', cuisine: 'Continental', rating: 4.7, deliveryTime: '28 min' },
  { key: 'ia-3', dishName: 'Loaded Nachos', restaurant: 'The Irish Anchor', price: 360, image: img('photo-1513456852971-30c0b8199d4d'), isVeg: true, description: 'Crispy nachos with cheese sauce, jalapeños, salsa and sour cream.', cuisine: 'Continental', rating: 4.6, deliveryTime: '18 min' },
  // ---- Dakshin Swad ----
  { key: 'ds-1', dishName: 'Chettinad Chicken Curry', restaurant: 'Dakshin Swad', price: 420, image: img('photo-1603894584373-5ac82b2ae398'), isVeg: false, description: 'Fiery Chettinad-style chicken with roasted spices and curry leaves.', cuisine: 'South Indian', rating: 4.8, deliveryTime: '28 min' },
  { key: 'ds-2', dishName: 'Ghee Roast Dosa', restaurant: 'Dakshin Swad', price: 180, image: img('photo-1630383249896-424e482df921'), isVeg: true, description: 'Crispy golden dosa roasted in ghee with sambar and chutneys.', cuisine: 'South Indian', rating: 4.7, deliveryTime: '20 min' },
  { key: 'ds-3', dishName: 'Curd Rice', restaurant: 'Dakshin Swad', price: 160, image: img('photo-1589302168068-964664d93dc0'), isVeg: true, description: 'Cool yogurt rice tempered with mustard, curry leaves and ginger.', cuisine: 'South Indian', rating: 4.6, deliveryTime: '15 min' },
  // ---- Biryani Basera ----
  { key: 'bb-1', dishName: 'Mutton Dum Biryani', restaurant: 'Biryani Basera', price: 520, image: img('photo-1589302168068-964664d93dc0'), isVeg: false, description: 'Sealed-pot mutton biryani with saffron, mint and fried onions.', cuisine: 'Biryani', rating: 4.9, deliveryTime: '35 min' },
  { key: 'bb-2', dishName: 'Chicken 65', restaurant: 'Biryani Basera', price: 340, image: img('photo-1599487488170-d11ec9c172f0'), isVeg: false, description: 'Spicy deep-fried chicken tossed with curry leaves and chillies.', cuisine: 'South Indian', rating: 4.7, deliveryTime: '22 min' },
  { key: 'bb-3', dishName: 'Hyderabadi Veg Biryani', restaurant: 'Biryani Basera', price: 330, image: img('photo-1589302168068-964664d93dc0'), isVeg: true, description: 'Fragrant veg biryani with paneer, saffron and mint raita on the side.', cuisine: 'Biryani', rating: 4.8, deliveryTime: '30 min' },
];

/** Per-restaurant menu keyed by dining restaurant name. */
export const restaurantMenus: Record<string, SpecialDish[]> = MENUS.reduce<Record<string, SpecialDish[]>>(
  (acc, seed) => {
    const { key, ...dish } = seed;
    const menu = (acc[dish.restaurant] ??= []);
    menu.push({ ...dish, id: `rm-${key}` });
    return acc;
  },
  {},
);

/** Flat list of all per-restaurant menu dishes (for search / catalog indexing). */
export const allRestaurantMenuDishes: SpecialDish[] = Object.values(restaurantMenus).flat();
