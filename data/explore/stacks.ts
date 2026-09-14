/**
 * @mock Static fixture — seeded sample data for local development until the Go Chi
 * backend (server/) is wired. See data/DATA_CONTROL.md.
 */
import type { ExploreStack } from '../types';

export const exploreStacks: ExploreStack[] = [
  { id: "trending-street-food", title: "🔥 Trending Street Food", subtitle: "Insane local flavours blowing up on social feeds", type: "FOOD", accent: "#1E5D44", items: [
    { id: "toy-1", name: "Hot Spicy Noodle Town", price: 180, rating: "4.8", emoji: "🍜", img: "https://images.unsplash.com/photo-1569718212165-3a8278d5f624?fm=jpg&fit=crop&q=80&w=400&h=400", shop: "Noodle Town" },
    { id: "toy-2", name: "Crispy Korean Fried Chicken", price: 250, rating: "4.9", emoji: "🍗", img: "https://images.unsplash.com/photo-1598515214211-89d3c73ae83b?fm=jpg&fit=crop&q=80&w=400&h=400", shop: "Seoul Kitchen" },
    { id: "toy-3", name: "Peri Peri French Fries", price: 120, rating: "4.7", emoji: "🍟", img: "https://images.unsplash.com/photo-1573080496219-bb080dd4f877?fm=jpg&fit=crop&q=80&w=400&h=400", shop: "Fry House" },
  ]},
  { id: "hype-kicks", title: "👟 Hype Kicks & Drops", subtitle: "Limited street heat you can cop right now", type: "MART", accent: "#1162D3", items: [
    { id: "hk-1", name: "Air Retro High Mint Kicks", price: 14999, rating: "4.9", emoji: "👟", img: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?fm=jpg&fit=crop&q=80&w=400&h=400", shop: "Sneaker Spot" },
    { id: "hk-2", name: "Futuristic Neo-Glow Runners", price: 8499, rating: "4.8", emoji: "👟", img: "https://images.unsplash.com/photo-1539185441755-769473a23570?fm=jpg&fit=crop&q=80&w=400&h=400", shop: "RunLab" },
    { id: "hk-3", name: "Limited Drop Metallic Force 1s", price: 18999, rating: "4.7", emoji: "👟", img: "https://images.unsplash.com/photo-1608231387042-66d1773070a5?fm=jpg&fit=crop&q=80&w=400&h=400", shop: "Kick District" },
  ]},
  { id: "aesthetic-cafe", title: "☕ Aesthetic Cafe Finds", subtitle: "Aesthetic driven spaces serving elite cups", type: "FOOD", accent: "#1E5D44", items: [
    { id: "ac-1", name: "Cinnamon Roll Latte", price: 280, rating: "4.9", emoji: "☕", img: "https://images.unsplash.com/photo-1509042239860-f550ce710b93?fm=jpg&fit=crop&q=80&w=400&h=400", shop: "Brew & Bean" },
    { id: "ac-2", name: "Charcoal Croissant Sandwich", price: 320, rating: "4.8", emoji: "🥐", img: "https://images.unsplash.com/photo-1550507992-eb63ffee0847?fm=jpg&fit=crop&q=80&w=400&h=400", shop: "La Paris" },
    { id: "ac-3", name: "Vegan Matcha Tiramisu", price: 260, rating: "4.7", emoji: "🍰", img: "https://images.unsplash.com/photo-1556679343-c7306c1976bc?fm=jpg&fit=crop&q=80&w=400&h=400", shop: "Green Glaze" },
  ]},
  { id: "late-night-munchies", title: "🌙 Late-Night Munchies", subtitle: "Insane bites to kill those 1 AM cravings", type: "FOOD", accent: "#1E5D44", items: [
    { id: "lm-1", name: "Loaded Cheese Fries", price: 160, rating: "4.8", emoji: "🍟", img: "https://images.unsplash.com/photo-1573080496219-bb080dd4f877?fm=jpg&fit=crop&q=80&w=400&h=400", shop: "Midnight Dhaba" },
    { id: "lm-2", name: "Spicy Chicken Seekh Roll", price: 220, rating: "4.9", emoji: "🌯", img: "https://images.unsplash.com/photo-1626700051175-6518c4793f4f?fm=jpg&fit=crop&q=80&w=400&h=400", shop: "Roll Express" },
    { id: "lm-3", name: "Garlic Chili Mushroom", price: 140, rating: "4.6", emoji: "🍄", img: "https://images.unsplash.com/photo-1565958011703-44f9829ba187?fm=jpg&fit=crop&q=80&w=400&h=400", shop: "Wok Express" },
  ]},
  { id: "gaming-gear", title: "🎮 Gaming Gear Galaxy", subtitle: "Level up your setup with these epic finds", type: "MART", accent: "#1162D3", items: [
    { id: "gg-1", name: "Wireless RGB Gaming Mouse", price: 2499, rating: "4.9", emoji: "🖱️", img: "https://images.unsplash.com/photo-1527814050087-3793815479db?fm=jpg&fit=crop&q=80&w=400&h=400", shop: "Tech Zone" },
    { id: "gg-2", name: "Mechanical Keyboard (Blue Switch)", price: 3999, rating: "4.8", emoji: "⌨️", img: "https://images.unsplash.com/photo-1587829741301-dc798b83add3?fm=jpg&fit=crop&q=80&w=400&h=400", shop: "GameTech" },
    { id: "gg-3", name: "HD Gaming Webcam 1080p", price: 3499, rating: "4.7", emoji: "📷", img: "https://images.unsplash.com/photo-1587826080692-f439cd0b70da?fm=jpg&fit=crop&q=80&w=400&h=400", shop: "StreamLab" },
  ]},
  { id: "immunity-gummies", title: "💊 Immunity Gummies", subtitle: "Tasty supplements your body is craving", type: "PHARMA", accent: "#065F46", items: [
    { id: "ig-1", name: "Vitamin C Gummies 1000mg", price: 499, rating: "4.9", emoji: "🍊", img: "https://images.unsplash.com/photo-1584017911766-d451b3d0e843?fm=jpg&fit=crop&q=80&w=400&h=400", shop: "Pharma" },
    { id: "ig-2", name: "Zinc & Elderberry Gummies", price: 550, rating: "4.8", emoji: "💊", img: "https://images.unsplash.com/photo-1607619056574-7b8d304f2c38?fm=jpg&fit=crop&q=80&w=400&h=400", shop: "Pharma" },
    { id: "ig-3", name: "Probiotic Digestive Gummies", price: 650, rating: "4.7", emoji: "🦠", img: "https://images.unsplash.com/photo-1584017911766-d451b3d0e843?fm=jpg&fit=crop&q=80&w=400&h=400", shop: "Pharma" },
  ]},
  { id: "budget-feasts", title: "💰 Budget Feasts", subtitle: "Heavy on the taste, light on the wallet", type: "FOOD", accent: "#1E5D44", items: [
    { id: "bf-1", name: "Masala Dosa Combo", price: 90, rating: "4.9", emoji: "🥞", img: "https://images.unsplash.com/photo-1630383249896-424e482df921?fm=jpg&fit=crop&q=80&w=400&h=400", shop: "Udupi Grand" },
    { id: "bf-2", name: "Veg Thali", price: 120, rating: "4.8", emoji: "🍛", img: "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?fm=jpg&fit=crop&q=80&w=400&h=400", shop: "Green Leaf" },
    { id: "bf-3", name: "Egg Biryani", price: 150, rating: "4.9", emoji: "🍚", img: "https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?fm=jpg&fit=crop&q=80&w=400&h=400", shop: "Paradise" },
  ]},
  { id: "organic-farms", title: "🌿 Organic Farms", subtitle: "Pure unadulterated produce from local farms", type: "MART", accent: "#1162D3", items: [
    { id: "of-1", name: "Organic Baby Spinach", price: 80, rating: "4.9", emoji: "🥬", img: "https://images.unsplash.com/photo-1576045057995-568f588f82fb?fm=jpg&fit=crop&q=80&w=400&h=400", shop: "Farm Fresh" },
    { id: "of-2", name: "Heirloom Tomatoes Box", price: 130, rating: "4.8", emoji: "🍅", img: "https://images.unsplash.com/photo-1518977822534-7049a61ee0c2?fm=jpg&fit=crop&q=80&w=400&h=400", shop: "Farm Fresh" },
    { id: "of-3", name: "Cold Pressed Coconut Oil", price: 340, rating: "4.9", emoji: "🥥", img: "https://images.unsplash.com/photo-1527689368864-3a821dbccc34?fm=jpg&fit=crop&q=80&w=400&h=400", shop: "Pure Harvest" },
  ]},
  { id: "cozywear", title: "🧥 Cozywear Lounge", subtitle: "Because staying in should be stylish", type: "MART", accent: "#1162D3", items: [
    { id: "cw-1", name: "Oversized Cotton Hoodie", price: 1899, rating: "4.9", emoji: "🧥", img: "https://images.unsplash.com/photo-1556821840-3a63f95609a7?fm=jpg&fit=crop&q=80&w=400&h=400", shop: "Thread Labs" },
    { id: "cw-2", name: "Waffle Knit Joggers", price: 1299, rating: "4.8", emoji: "👖", img: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?fm=jpg&fit=crop&q=80&w=400&h=400", shop: "Thread Labs" },
    { id: "cw-3", name: "Premium Wool Blend Socks", price: 399, rating: "4.7", emoji: "🧦", img: "https://images.unsplash.com/photo-1586350977771-b3b0abd50c82?fm=jpg&fit=crop&q=80&w=400&h=400", shop: "Cozy Corner" },
  ]},
  { id: "late-night-dining", title: "🕯️ Late-Night Dining", subtitle: "Premium restaurants open past midnight", type: "FOOD", accent: "#1E5D44", items: [
    { id: "ld-1", name: "Truffle Mushroom Risotto", price: 520, rating: "4.9", emoji: "🍚", img: "https://images.unsplash.com/photo-1476124369491-e7addf5db371?fm=jpg&fit=crop&q=80&w=400&h=400", shop: "Midnight Dhaba" },
    { id: "ld-2", name: "Charcoal Grilled Lamb Chops", price: 690, rating: "4.9", emoji: "🥩", img: "https://images.unsplash.com/photo-1514516345957-51be1cae4a29?fm=jpg&fit=crop&q=80&w=400&h=400", shop: "Smoke House" },
    { id: "ld-3", name: "Ferrero Rocher Shake", price: 230, rating: "4.8", emoji: "🥤", img: "https://images.unsplash.com/photo-1572490122747-3968b75cc699?fm=jpg&fit=crop&q=80&w=400&h=400", shop: "Shake Lab" },
  ]},
  { id: "greek-yogurts", title: "🥛 Greek Yogurts & More", subtitle: "High protein creamy goodness delivered cold", type: "MART", accent: "#1162D3", items: [
    { id: "gy-1", name: "Greek Plain Yogurt (500g)", price: 180, rating: "4.8", emoji: "🥛", img: "https://images.unsplash.com/photo-1488477181946-6428a0291777?fm=jpg&fit=crop&q=80&w=400&h=400", shop: "Dairy Delight" },
    { id: "gy-2", name: "Blueberry Honey Yogurt Cup", price: 95, rating: "4.9", emoji: "🍧", img: "https://images.unsplash.com/photo-1511690656952-34342bb7c2f1?fm=jpg&fit=crop&q=80&w=400&h=400", shop: "Dairy Delight" },
    { id: "gy-3", name: "A2 Cow Milk (1L)", price: 110, rating: "4.9", emoji: "🥛", img: "https://images.unsplash.com/photo-1550583724-b2692b85b150?fm=jpg&fit=crop&q=80&w=400&h=400", shop: "Pure Dairy" },
  ]},
  { id: "first-aid-sos", title: "🩹 First Aid SOS", subtitle: "Medical essentials when you need them most", type: "PHARMA", accent: "#065F46", items: [
    { id: "fa-1", name: "Ultimate First Aid Kit", price: 799, rating: "4.9", emoji: "🩹", img: "https://images.unsplash.com/photo-1603398938378-e54eab446dde?fm=jpg&fit=crop&q=80&w=400&h=400", shop: "Pharma" },
    { id: "fa-2", name: "Pulse Oximeter", price: 1899, rating: "4.8", emoji: "⌚", img: "https://images.unsplash.com/photo-1551076805-e1869033e561?fm=jpg&fit=crop&q=80&w=400&h=400", shop: "Pharma" },
    { id: "fa-3", name: "Instant Ice Pack (4 Pack)", price: 110, rating: "4.7", emoji: "❄️", img: "https://images.unsplash.com/photo-1631553097084-9f0b5cb3caa9?fm=jpg&fit=crop&q=80&w=400&h=400", shop: "Pharma" },
  ]},
  { id: "korean-skincare", title: "✨ Korean Skincare", subtitle: "K-Beauty glow up secrets from Seoul", type: "PHARMA", accent: "#065F46", items: [
    { id: "ks-1", name: "Snail Mucin 96% Essence", price: 1450, rating: "4.9", emoji: "🧴", img: "https://images.unsplash.com/photo-1608248597481-496100c80836?fm=jpg&fit=crop&q=80&w=400&h=400", shop: "K-Beauty HQ" },
    { id: "ks-2", name: "AHA BHA PHA Toner", price: 1150, rating: "4.8", emoji: "🧴", img: "https://images.unsplash.com/photo-1556228720-195a672e8a03?fm=jpg&fit=crop&q=80&w=400&h=400", shop: "K-Beauty HQ" },
    { id: "ks-3", name: "Sunscreen SPF 50 PA++++", price: 890, rating: "4.9", emoji: "☀️", img: "https://images.unsplash.com/photo-1556228578-0d85b1a4d571?fm=jpg&fit=crop&q=80&w=400&h=400", shop: "K-Beauty HQ" },
  ]},
  { id: "cold-beverages", title: "🧊 Cold Beverages", subtitle: "Chilled drinks to beat the heat", type: "MART", accent: "#1162D3", items: [
    { id: "cb-1", name: "Cold Brew Coffee Can", price: 160, rating: "4.9", emoji: "🧋", img: "https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?fm=jpg&fit=crop&q=80&w=400&h=400", shop: "Brew & Bean" },
    { id: "cb-2", name: "Sparkling Lychee Drink", price: 95, rating: "4.8", emoji: "🥫", img: "https://images.unsplash.com/photo-1622483767028-3f66f32aef97?fm=jpg&fit=crop&q=80&w=400&h=400", shop: "Sip Town" },
    { id: "cb-3", name: "Coconut Water (1L)", price: 80, rating: "4.7", emoji: "🥥", img: "https://images.unsplash.com/photo-1527689368864-3a821dbccc34?fm=jpg&fit=crop&q=80&w=400&h=400", shop: "Pure Harvest" },
  ]},
  { id: "desserts", title: "🍰 Desserts & Sweet Tooth", subtitle: "Indulge your sweet cravings with these treats", type: "FOOD", accent: "#1E5D44", items: [
    { id: "dt-1", name: "Triple Chocolate Lava Cake", price: 240, rating: "4.9", emoji: "🥞", img: "https://images.unsplash.com/photo-1606313564200-e75d5e30476c?fm=jpg&fit=crop&q=80&w=400&h=400", shop: "Soul Desserts" },
    { id: "dt-2", name: "Fluffy Japanese Pancakes", price: 290, rating: "4.8", emoji: "🥞", img: "https://images.unsplash.com/photo-1528207776546-365bb710ee93?fm=jpg&fit=crop&q=80&w=400&h=400", shop: "Fluffy House" },
    { id: "dt-3", name: "Salted Caramel Sundae", price: 180, rating: "4.7", emoji: "🍨", img: "https://images.unsplash.com/photo-1563805042-7684c019e1cb?fm=jpg&fit=crop&q=80&w=400&h=400", shop: "Chill Spot" },
  ]},
  { id: "home-office", title: "💼 Home Office Setup", subtitle: "Level up your WFH desk with these essentials", type: "MART", accent: "#1162D3", items: [
    { id: "ho-1", name: "Ergonomic Desk Chair", price: 11999, rating: "4.9", emoji: "🪑", img: "https://images.unsplash.com/photo-1580481077494-e3299ac2fef6?fm=jpg&fit=crop&q=80&w=400&h=400", shop: "Wood & Steel" },
    { id: "ho-2", name: "28\" 4K Monitor", price: 18999, rating: "4.8", emoji: "🖥️", img: "https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?fm=jpg&fit=crop&q=80&w=400&h=400", shop: "Volt Electronics" },
    { id: "ho-3", name: "LED Desk Lamp Wireless Charge", price: 1499, rating: "4.7", emoji: "💡", img: "https://images.unsplash.com/photo-1507473885765-e6ed057f782c?fm=jpg&fit=crop&q=80&w=400&h=400", shop: "SmartHome" },
  ]},
  { id: "fitness-kit", title: "🏋️ Fitness Starter Kit", subtitle: "Everything to kickstart your home workouts", type: "MART", accent: "#1162D3", items: [
    { id: "fk-1", name: "Adjustable Dumbbell Set", price: 3999, rating: "4.9", emoji: "🏋️", img: "https://images.unsplash.com/photo-1517838277536-f5f99be501cd?fm=jpg&fit=crop&q=80&w=400&h=400", shop: "Peak Performance" },
    { id: "fk-2", name: "Resistance Band Combo (5)", price: 599, rating: "4.8", emoji: "🎗️", img: "https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?fm=jpg&fit=crop&q=80&w=400&h=400", shop: "Peak Performance" },
    { id: "fk-3", name: "Non-Slip Yoga Mat", price: 999, rating: "4.8", emoji: "🧘", img: "https://images.unsplash.com/photo-1601925260368-ae2f83cf8b7f?fm=jpg&fit=crop&q=80&w=400&h=400", shop: "Peak Performance" },
  ]},
  { id: "kids-party", title: "🎈 Kids Party Planner", subtitle: "Toys, treats and décor for the perfect party", type: "MART", accent: "#1162D3", items: [
    { id: "kp-1", name: "Party Balloon Décor Kit", price: 450, rating: "4.8", emoji: "🎈", img: "https://images.unsplash.com/photo-1513151233558-d860c5398176?fm=jpg&fit=crop&q=80&w=400&h=400", shop: "Wonderland Toys" },
    { id: "kp-2", name: "Birthday Cake Candle Set", price: 199, rating: "4.7", emoji: "🕯️", img: "https://images.unsplash.com/photo-1514316454349-750a7fd3da3a?fm=jpg&fit=crop&q=80&w=400&h=400", shop: "Wonderland Toys" },
    { id: "kp-3", name: "RC Toy Car Racer", price: 1499, rating: "4.9", emoji: "🏎️", img: "https://images.unsplash.com/photo-1594787318286-3d835c1d207f?fm=jpg&fit=crop&q=80&w=400&h=400", shop: "Wonderland Toys" },
  ]},
  { id: "pharma-wellness", title: "🧴 Pharma Wellness Corner", subtitle: "Everyday health essentials for the whole family", type: "PHARMA", accent: "#065F46", items: [
    { id: "pw-1", name: "Digital BP Monitor", price: 1299, rating: "4.8", emoji: "🩺", img: "https://img.icons8.com/3d-fluency/94/tensiometer.png", shop: "Faazio Health" },
    { id: "pw-2", name: "Fingertip Pulse Oximeter", price: 899, rating: "4.8", emoji: "🫁", img: "https://img.icons8.com/3d-fluency/94/oximeter.png", shop: "Faazio Health" },
    { id: "pw-3", name: "Vitamin D3 2000 IU", price: 450, rating: "4.7", emoji: "☀️", img: "https://images.unsplash.com/photo-1584017911766-d451b3d0e843?fm=jpg&fit=crop&q=80&w=400&h=400", shop: "Wellness Plus" },
    { id: "pw-4", name: "Fish Oil Omega-3 (120)", price: 649, rating: "4.9", emoji: "🐟", img: "https://img.icons8.com/3d-fluency/94/fish-oil.png", shop: "CareFirst Meds" },
  ]},
  { id: "monsoon-essentials", title: "🌧️ Monsoon Home Essentials", subtitle: "Beat the rain with these smart picks", type: "MART", accent: "#1162D3", items: [
    { id: "me-1", name: "Waterproof Rain Jacket", price: 1499, rating: "4.8", emoji: "🧥", img: "https://images.unsplash.com/photo-1520975954732-35dd22299614?fm=jpg&fit=crop&q=80&w=400&h=400", shop: "Thread Labs" },
    { id: "me-2", name: "Non-Slip Umbrella (Auto Open)", price: 699, rating: "4.7", emoji: "☂️", img: "https://images.unsplash.com/photo-1517701550927-30cf4ba1dba5?fm=jpg&fit=crop&q=80&w=400&h=400", shop: "Vibe Apparel" },
    { id: "me-3", name: "Instant Water Heater", price: 2499, rating: "4.8", emoji: "♨️", img: "https://images.unsplash.com/photo-1626806787461-102c1bfaaea1?fm=jpg&fit=crop&q=80&w=400&h=400", shop: "SmartHome" },
    { id: "me-4", name: "Anti-Skid Bathroom Mat", price: 399, rating: "4.6", emoji: "🛁", img: "https://images.unsplash.com/photo-1584622650111-993a426fbf0a?fm=jpg&fit=crop&q=80&w=400&h=400", shop: "Wonderland Toys" },
  ]},
];
