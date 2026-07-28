export interface ExploreItem {
  id: string;
  name: string;
  price: number;
  rating: string;
  emoji: string;
  img: string;
  shop: string;
}

export interface ExploreStack {
  id: string;
  title: string;
  subtitle: string;
  type: 'FOOD' | 'MART' | 'GROCERY' | 'PHARMA';
  accent: string;
  items: ExploreItem[];
}

export const exploreStacks: ExploreStack[] = [
  {
    id: "trending-street-food",
    title: "🔥 Trending Street Food",
    subtitle: "Insane local flavours blowing up on social feeds",
    type: "FOOD",
    accent: "text-rose-500 bg-rose-50 border-rose-100",
    items: [
      { id: "exp-sf-1", name: "Loaded Cheese Volcano Momos", price: 220, rating: "4.9", emoji: "🥟", img: "https://images.unsplash.com/photo-1534422298391-e4f8c172dddb?auto=format&fit=crop&q=80&w=200&h=150", shop: "Momo Hub" },
      { id: "exp-sf-2", name: "Tandoori Sriracha Seekh Roll", price: 180, rating: "4.8", emoji: "🌯", img: "https://images.unsplash.com/photo-1626777552726-4a6b54c97e46?auto=format&fit=crop&q=80&w=200&h=150", shop: "Kebab Junction" },
      { id: "exp-sf-3", name: "Crispy Peri-Peri Loaded Fries", price: 150, rating: "4.7", emoji: "🍟", img: "https://images.unsplash.com/photo-1573080496219-bb080dd4f877?auto=format&fit=crop&q=80&w=200&h=150", shop: "The Fry Society" }
    ]
  },
  {
    id: "hype-sneakers",
    title: "👟 Hype Kicks & Sneakers",
    subtitle: "Step up your drip with premium limited releases",
    type: "MART",
    accent: "text-blue-600 bg-blue-50 border-blue-100",
    items: [
      { id: "exp-sn-1", name: "Air Retro High OG Mint", price: 14999, rating: "4.9", emoji: "👟", img: "https://images.unsplash.com/photo-1549298916-b41d501d3772?auto=format&fit=crop&q=80&w=200&h=150", shop: "Sneaker Vault" },
      { id: "exp-sn-2", name: "Neo-Glow Futuristic Runner", price: 8499, rating: "4.8", emoji: "👟", img: "https://images.unsplash.com/photo-1606107557195-0e29a4b5b4aa?auto=format&fit=crop&q=80&w=200&h=150", shop: "Mart Streetwear" },
      { id: "exp-sn-3", name: "Urban Tech Sandal V2", price: 3200, rating: "4.6", emoji: "👡", img: "https://images.unsplash.com/photo-1595950653106-6c9ebd614d3a?auto=format&fit=crop&q=80&w=200&h=150", shop: "Mart Streetwear" }
    ]
  },
  {
    id: "instagrammable-cafe",
    title: "☕ Aesthetic Cafe Finds",
    subtitle: "Prettiest treats perfect for your daily feed updates",
    type: "FOOD",
    accent: "text-amber-600 bg-amber-50 border-amber-100",
    items: [
      { id: "exp-cf-1", name: "Pink Matcha Rose Cold Foam", price: 240, rating: "4.9", emoji: "🍵", img: "https://images.unsplash.com/photo-1536256263959-770b48d82b0a?auto=format&fit=crop&q=80&w=200&h=150", shop: "Aura Brew Lab" },
      { id: "exp-cf-2", name: "Sourdough Avocado & Edible Flowers", price: 320, rating: "4.7", emoji: "🥑", img: "https://images.unsplash.com/photo-1541532713592-79a0317b6b77?auto=format&fit=crop&q=80&w=200&h=150", shop: "Grounded Cafe" },
      { id: "exp-cf-3", name: "Fluffy Japanese Souffle Stack", price: 290, rating: "4.8", emoji: "🥞", img: "https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?auto=format&fit=crop&q=80&w=200&h=150", shop: "Kup Coffee Co." }
    ]
  },
  {
    id: "midnight-munchies",
    title: "🍿 Late-Night Soda & Munchies",
    subtitle: "Instant cravings solved in 10 minutes flat",
    type: "GROCERY",
    accent: "text-emerald-600 bg-emerald-50 border-emerald-100",
    items: [
      { id: "exp-mm-1", name: "Imported Sour Gummy Belts Pack", price: 180, rating: "4.8", emoji: "🍬", img: "https://images.unsplash.com/photo-1581798459219-318e76aecc7b?auto=format&fit=crop&q=80&w=200&h=150", shop: "FaGrocery Quick" },
      { id: "exp-mm-2", name: "Peri-Peri Popcorn Tub XL", price: 120, rating: "4.6", emoji: "🍿", img: "https://images.unsplash.com/photo-1578292812824-c14f40a12e3e?auto=format&fit=crop&q=80&w=200&h=150", shop: "FaGrocery Quick" },
      { id: "exp-mm-3", name: "Mexican Chili Lime Tortillas", price: 90, rating: "4.7", emoji: "🌮", img: "https://images.unsplash.com/photo-1518047601542-79f18c655718?auto=format&fit=crop&q=80&w=200&h=150", shop: "FaGrocery Quick" }
    ]
  },
  {
    id: "gaming-gear",
    title: "🎮 Pro Sound & Gaming Gear",
    subtitle: "Immersive audio setups and desktop upgrades",
    type: "MART",
    accent: "text-indigo-600 bg-indigo-50 border-indigo-100",
    items: [
      { id: "exp-gg-1", name: "ANC Matte Black Pods Pro", price: 3999, rating: "4.9", emoji: "🎧", img: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&q=80&w=200&h=150", shop: "Mart Acoustics" },
      { id: "exp-gg-2", name: "Pastel RGB Custom Keyboard", price: 5499, rating: "4.8", emoji: "⌨️", img: "https://images.unsplash.com/photo-1587829741301-dc798b83add3?auto=format&fit=crop&q=80&w=200&h=150", shop: "Vibe Accessories" },
      { id: "exp-gg-3", name: "Ambient RGB Desk Smart Tube", price: 1850, rating: "4.7", emoji: "💡", img: "https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&q=80&w=200&h=150", shop: "Vibe Accessories" }
    ]
  },
  {
    id: "daily-wellness-pills",
    title: "💊 GenZ Immunity Gummies & Vitality",
    subtitle: "Wellness routine that actually tastes incredible",
    type: "PHARMA",
    accent: "text-teal-600 bg-teal-50 border-teal-100",
    items: [
      { id: "exp-ph-1", name: "Aesthetic Biotin Glow Gummies", price: 499, rating: "4.9", emoji: "🍊", img: "https://images.unsplash.com/photo-1584017911766-d451b3d0e843?auto=format&fit=crop&q=80&w=200&h=150", shop: "FaPharma Premium" },
      { id: "exp-ph-2", name: "Ashwagandha Calming Sips (10p)", price: 350, rating: "4.8", emoji: "🍵", img: "https://images.unsplash.com/photo-1550572017-edd951b55104?auto=format&fit=crop&q=80&w=200&h=150", shop: "Mind & Muscle" },
      { id: "exp-ph-3", name: "Deep Sleep Melatonin Melts", price: 420, rating: "4.7", emoji: "💤", img: "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?auto=format&fit=crop&q=80&w=200&h=150", shop: "FaPharma Premium" }
    ]
  },
  {
    id: "budget-dishes",
    title: "💸 Budget Feasts (Under ₹250)",
    subtitle: "Epic single-person meals that respect your bank balance",
    type: "FOOD",
    accent: "text-emerald-600 bg-emerald-50 border-emerald-100",
    items: [
      { id: "exp-bd-1", name: "Paneer Tikka Roll & Cola Combo", price: 199, rating: "4.7", emoji: "🥤", img: "https://images.unsplash.com/photo-1626777552726-4a6b54c97e46?auto=format&fit=crop&q=80&w=200&h=150", shop: "Hungry Minds" },
      { id: "exp-bd-2", name: "Mac & Triple Cheese Oven Bake", price: 220, rating: "4.8", emoji: "🧀", img: "https://images.unsplash.com/photo-1543339494-b4cd4f7ba686?auto=format&fit=crop&q=80&w=200&h=150", shop: "Pasta & Co" },
      { id: "exp-bd-3", name: "Classic Garlic Hakka Noodles", price: 160, rating: "4.6", emoji: "🍜", img: "https://images.unsplash.com/photo-1569718212165-3a8278d5f624?auto=format&fit=crop&q=80&w=200&h=150", shop: "Wok Express" }
    ]
  },
  {
    id: "organic-farms",
    title: "🥦 Organic Fresh Farm Picks",
    subtitle: "100% pesticide-free greens direct from local growers",
    type: "GROCERY",
    accent: "text-green-600 bg-green-50 border-green-100",
    items: [
      { id: "exp-of-1", name: "Hydroponic Salad Leaves Mix (250g)", price: 130, rating: "4.9", emoji: "🥗", img: "https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format&fit=crop&q=80&w=200&h=150", shop: "GreenRoots Farms" },
      { id: "exp-of-2", name: "Imported Seedless Avocado", price: 160, rating: "4.8", emoji: "🥑", img: "https://images.unsplash.com/photo-1523049673857-eb18f1d7b578?auto=format&fit=crop&q=80&w=200&h=150", shop: "GreenRoots Farms" },
      { id: "exp-of-3", name: "Sun-Ripened Organic Strawberries", price: 190, rating: "4.7", emoji: "🍓", img: "https://images.unsplash.com/photo-1464965911861-746a04b4bca6?auto=format&fit=crop&q=80&w=200&h=150", shop: "Orchard Direct" }
    ]
  },
  {
    id: "aesthetic-cozywear",
    title: "🧥 Minimalist Cozywear",
    subtitle: "Oversized hoodies & relaxed lounge staples",
    type: "MART",
    accent: "text-amber-700 bg-amber-50 border-amber-100",
    items: [
      { id: "exp-cw-1", name: "Heavyweight Boxy Hoodie", price: 1899, rating: "4.9", emoji: "🧥", img: "https://images.unsplash.com/photo-1556905055-8f358a7a47b2?auto=format&fit=crop&q=80&w=200&h=150", shop: "Thread Labs" },
      { id: "exp-cw-2", name: "Relaxed Waffle Knit Joggers", price: 1299, rating: "4.8", emoji: "👖", img: "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&q=80&w=200&h=150", shop: "Thread Labs" },
      { id: "exp-cw-3", name: "Minimalist Soft Cotton Crew", price: 799, rating: "4.7", emoji: "👕", img: "https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&q=80&w=200&h=150", shop: "Vibe Apparel" }
    ]
  },
  {
    id: "late-night-dining",
    title: "🍽️ Nearby Late Night Dining",
    subtitle: "Rave spots with incredible food active after midnight",
    type: "FOOD",
    accent: "text-indigo-500 bg-indigo-50 border-indigo-100",
    items: [
      { id: "exp-ln-1", name: "Spicy Double Chicken Kathi Roll", price: 210, rating: "4.8", emoji: "🌯", img: "https://images.unsplash.com/photo-1626777552726-4a6b54c97e46?auto=format&fit=crop&q=80&w=200&h=150", shop: "Nite Bite Station" },
      { id: "exp-ln-2", name: "Golden Garlic Butter Naan Combo", price: 290, rating: "4.9", emoji: "🥘", img: "https://images.unsplash.com/photo-1631452180519-c014fe946bc7?auto=format&fit=crop&q=80&w=200&h=150", shop: "Midnight Dhaba" },
      { id: "exp-ln-3", name: "Overloaded Dark Choco Waffle", price: 180, rating: "4.7", emoji: " waffle", img: "https://images.unsplash.com/photo-1562376502-6f769499c886?auto=format&fit=crop&q=80&w=200&h=150", shop: "Waffle Craze" }
    ]
  },
  {
    id: "dairy-greek-yogurts",
    title: "🥛 Morning Greek Yogurts & Milks",
    subtitle: "Power breakfasts with high active protein",
    type: "GROCERY",
    accent: "text-blue-500 bg-blue-50 border-blue-100",
    items: [
      { id: "exp-dy-1", name: "Blueberry Greek Yogurt Pot", price: 75, rating: "4.9", emoji: "🍧", img: "https://images.unsplash.com/photo-1488477181946-6428a0291777?auto=format&fit=crop&q=80&w=200&h=150", shop: "Dairyland Express" },
      { id: "exp-dy-2", name: "Sugar-Free Organic Almond Milk", price: 240, rating: "4.8", emoji: "🥛", img: "https://images.unsplash.com/photo-1550583724-b2692b85b150?auto=format&fit=crop&q=80&w=200&h=150", shop: "GreenRoots Farms" },
      { id: "exp-dy-3", name: "Salted Caramel Oat Milk Carton", price: 280, rating: "4.7", emoji: "🥛", img: "https://images.unsplash.com/photo-1563227812-0ea4c22e6cc8?auto=format&fit=crop&q=80&w=200&h=150", shop: "Grounded Cafe" }
    ]
  },
  {
    id: "first-aid-sos",
    title: "🩹 Late-Night SOS & First Aid",
    subtitle: "Instant cooling patches, recovery sheets, & daily band-aids",
    type: "PHARMA",
    accent: "text-red-600 bg-red-50 border-red-100",
    items: [
      { id: "exp-sos-1", name: "Fast Healing Hydrocolloid Patch Pack", price: 199, rating: "4.9", emoji: "🩹", img: "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?auto=format&fit=crop&q=80&w=200&h=150", shop: "FaPharma Premium" },
      { id: "exp-sos-2", name: "Soothing Aloe-Vera Hydrating Gel", price: 280, rating: "4.8", emoji: "🧴", img: "https://images.unsplash.com/photo-1556228720-195a672e8a03?auto=format&fit=crop&q=80&w=200&h=150", shop: "Korean Glow Care" },
      { id: "exp-sos-3", name: "Cooling Migraine Comfort Patch (2p)", price: 150, rating: "4.7", emoji: "❄️", img: "https://images.unsplash.com/photo-1550572017-edd951b55104?auto=format&fit=crop&q=80&w=200&h=150", shop: "FaPharma Premium" }
    ]
  },
  {
    id: "korean-skincare",
    title: "✨ Korean Skincare Aesthetics",
    subtitle: "Get that ultimate dewy glass skin feel",
    type: "PHARMA",
    accent: "text-pink-600 bg-pink-50 border-pink-100",
    items: [
      { id: "exp-sk-1", name: "96% Advanced Snail Mucin Power Essence", price: 1450, rating: "4.9", emoji: "🧴", img: "https://images.unsplash.com/photo-1608248597481-496100c80836?auto=format&fit=crop&q=80&w=200&h=150", shop: "Korean Glow Care" },
      { id: "exp-sk-2", name: "Super Hyaluronic Acid Glow Serum", price: 1120, rating: "4.8", emoji: "💧", img: "https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?auto=format&fit=crop&q=80&w=200&h=150", shop: "Korean Glow Care" },
      { id: "exp-sk-3", name: "Centella Soothing Barrier Cream", price: 950, rating: "4.7", emoji: "🧴", img: "https://images.unsplash.com/photo-1556228578-0d85b1a4d571?auto=format&fit=crop&q=80&w=200&h=150", shop: "Korean Glow Care" }
    ]
  },
  {
    id: "cold-beverages",
    title: "🥤 Ice Cold Beverages & Sodas",
    subtitle: "Instant hydration delivered super chilled",
    type: "GROCERY",
    accent: "text-cyan-600 bg-cyan-50 border-cyan-100",
    items: [
      { id: "exp-bv-1", name: "Sparkling Cranberry Peach Soda Can", price: 95, rating: "4.8", emoji: "🥫", img: "https://images.unsplash.com/photo-1622483767028-3f66f32aef97?auto=format&fit=crop&q=80&w=200&h=150", shop: "FaGrocery Quick" },
      { id: "exp-bv-2", name: "Sugar-Free Premium Tonic Water", price: 80, rating: "4.6", emoji: "🥤", img: "https://images.unsplash.com/photo-1527960659564-77b95dd07fe0?auto=format&fit=crop&q=80&w=200&h=150", shop: "FaGrocery Quick" },
      { id: "exp-bv-3", name: "Double Roasted Caramel Cold Brew", price: 160, rating: "4.9", emoji: "🧋", img: "https://images.unsplash.com/photo-1517701604599-bb29b565090c?auto=format&fit=crop&q=80&w=200&h=150", shop: "Aura Brew Lab" }
    ]
  },
  {
    id: "desert-combos",
    title: "🥞 Late-Night Sweet Desserts",
    subtitle: "Double chocolate melts, waffles, and rich pastries",
    type: "FOOD",
    accent: "text-amber-500 bg-amber-50 border-amber-100",
    items: [
      { id: "exp-ds-1", name: "Dark Chocolate Lava Overload", price: 180, rating: "4.9", emoji: "🧁", img: "https://images.unsplash.com/photo-1606313564200-e75d5e30476c?auto=format&fit=crop&q=80&w=200&h=150", shop: "Dessert Lab" },
      { id: "exp-ds-2", name: "Blueberry New York Cheesecake Slice", price: 220, rating: "4.8", emoji: "🍰", img: "https://images.unsplash.com/photo-1533134242443-d4fd215305ad?auto=format&fit=crop&q=80&w=200&h=150", shop: "La Paris Crêperie" },
      { id: "exp-ds-3", name: "Tender Coconut Ice Cream Tub", price: 150, rating: "4.7", emoji: "🍨", img: "https://images.unsplash.com/photo-1560008511-11c63416e52d?auto=format&fit=crop&q=80&w=200&h=150", shop: "Dairyland Express" }
    ]
  }
];
