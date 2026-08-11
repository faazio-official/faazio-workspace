/**
 * @mock Static fixture — seeded sample data for local development until the Go Chi
 * backend (server/) is wired. See data/DATA_CONTROL.md.
 */
import type { Product } from '../types';

export const categoriesSearchDatabase: Record<string, Product[]> = {
  'food-main': [
    { id: 'cat-fm-1', app: 'FOOD', category: 'food-main', name: 'Slow Cooked Awadhi Mutton Biryani', price: 550, emoji: '🍛', desc: 'Saffron-infused premium basmati with tender pieces of slow cooked lamb.', rating: 4.9, image: 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?fm=jpg&fit=crop&q=80&w=400&h=400' },
    { id: 'cat-fm-2', app: 'FOOD', category: 'food-main', name: 'Sizzling Garlic Naan & Paneer Butter', price: 380, emoji: '🍛', desc: 'Classic punjabi charcoal naan baked to order with creamy butter gravy.', rating: 4.8, image: 'https://images.unsplash.com/photo-1565557623262-b51c2513a641?fm=jpg&fit=crop&q=80&w=400&h=400' },
    { id: 'cat-fm-3', app: 'FOOD', category: 'food-main', name: 'Gourmet Woodfired Margherita Pizza', price: 440, emoji: '🍕', desc: 'Hand stretched artisanal sourdough topped with fresh pulled mozzarella.', rating: 4.9, image: 'https://images.unsplash.com/photo-1604382354936-07c5d9983bd3?fm=jpg&fit=crop&q=80&w=400&h=400' },
  ],
  'food-snack': [
    { id: 'cat-fs-1', app: 'FOOD', category: 'food-snack', name: 'Spicy Sriracha Chicken Seekh Roll', price: 199, emoji: '🌯', desc: 'Charcoal seekh kebabs tossed in fiery house sriracha dressing.', rating: 4.8, image: 'https://images.unsplash.com/photo-1626700051175-6518c4793f4f?fm=jpg&fit=crop&q=80&w=400&h=400' },
    { id: 'cat-fs-2', app: 'FOOD', category: 'food-snack', name: 'Crispy Cheese Loaded Fries Bowl', price: 160, emoji: '🍟', desc: 'Thick cut skin-on potatoes coated in double cheddar & dynamic seasoning.', rating: 4.7, image: 'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?fm=jpg&fit=crop&q=80&w=400&h=400' },
    { id: 'cat-fs-3', app: 'FOOD', category: 'food-snack', name: 'Handcrafted Truffle Smash Slider', price: 220, emoji: '🍔', desc: 'Caramelized onions & black truffle butter glaze on soft milk brioche.', rating: 4.9, image: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?fm=jpg&fit=crop&q=80&w=400&h=400' },
  ],
  'food-dessert': [
    { id: 'cat-fd-1', app: 'FOOD', category: 'food-dessert', name: 'Triple Chocolate Lava Melt Souffle', price: 240, emoji: '🥞', desc: 'Molten center dark chocolate souffle with a dusting of vanilla snow.', rating: 4.9, image: 'https://images.unsplash.com/photo-1606313564200-e75d5e30476c?fm=jpg&fit=crop&q=80&w=400&h=400' },
    { id: 'cat-fd-2', app: 'FOOD', category: 'food-dessert', name: 'Fluffy Japanese Pancake Stack', price: 290, emoji: '🥞', desc: 'Three extra fluffy souffle cakes served with warm honeycomb butter.', rating: 4.8, image: 'https://images.unsplash.com/photo-1528207776546-365bb710ee93?fm=jpg&fit=crop&q=80&w=400&h=400' },
    { id: 'cat-fd-3', app: 'FOOD', category: 'food-dessert', name: 'Classic Salted Caramel Fudge Sundae', price: 180, emoji: '🍨', desc: 'Soft-serve organic milk custard layered with roasted crunch.', rating: 4.7, image: 'https://images.unsplash.com/photo-1563805042-7684c019e1cb?fm=jpg&fit=crop&q=80&w=400&h=400' },
  ],
  'mart-tech': [
    { id: 'cat-mt-1', app: 'MART', category: 'mart-tech', name: 'Pastel Retro Mechanical Keyboard', price: 5499, emoji: '⌨️', desc: 'Brown clicky switches with beautiful vintage-themed keycaps.', rating: 4.9, image: 'https://images.unsplash.com/photo-1587829741301-dc798b83add3?fm=jpg&fit=crop&q=80&w=400&h=400' },
    { id: 'cat-mt-2', app: 'MART', category: 'mart-tech', name: 'ANC Premium Matte Earbuds', price: 3999, emoji: '🎧', desc: 'Premium hybrid active isolation with deep immersive stereo.', rating: 4.8, image: 'https://images.unsplash.com/photo-1546435770-a3e426bf472b?fm=jpg&fit=crop&q=80&w=400&h=400' },
    { id: 'cat-mt-3', app: 'MART', category: 'mart-tech', name: 'Dual Arc RGB Ambience Tube Light', price: 1850, emoji: '💡', desc: 'App controlled smart glow tube with endless music sync dynamics.', rating: 4.7, image: 'https://images.unsplash.com/photo-1565814329452-e1efa11c5b89?fm=jpg&fit=crop&q=80&w=400&h=400' },
  ],
  'mart-foot': [
    { id: 'cat-mf-1', app: 'MART', category: 'mart-foot', name: 'Air Retro High Mint Kicks', price: 14999, emoji: '👟', desc: 'Limited street drop high-top trainers with iconic stitched branding.', rating: 4.9, image: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?fm=jpg&fit=crop&q=80&w=400&h=400' },
    { id: 'cat-mf-2', app: 'MART', category: 'mart-foot', name: 'Futuristic Neo-Glow Runners', price: 8499, emoji: '👟', desc: 'Ultra lightweight responsive foam cushioning built for speed.', rating: 4.8, image: 'https://images.unsplash.com/photo-1539185441755-769473a23570?fm=jpg&fit=crop&q=80&w=400&h=400' },
    { id: 'cat-mf-3', app: 'MART', category: 'mart-foot', name: 'Urban Tech Water Resistant Sandals', price: 3200, emoji: '👡', desc: 'Magnetic buckled strap harness with rugged traction system.', rating: 4.6, image: 'https://images.unsplash.com/photo-1603252109303-2751441dd157?fm=jpg&fit=crop&q=80&w=400&h=400' },
  ],
  'mart-lounge': [
    { id: 'cat-ml-1', app: 'MART', category: 'mart-lounge', name: 'Heavyweight Boxy Fleece Hoodie', price: 1899, emoji: '🧥', desc: 'Oversized premium custom knit cotton with thick drop-shoulders.', rating: 4.9, image: 'https://images.unsplash.com/photo-1556821840-3a63f95609a7?fm=jpg&fit=crop&q=80&w=400&h=400' },
    { id: 'cat-ml-2', app: 'MART', category: 'mart-lounge', name: 'Relaxed Waffle Weave Joggers', price: 1299, emoji: '👖', desc: 'Breathable elastic cuffed lounge trousers perfect for working from home.', rating: 4.8, image: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?fm=jpg&fit=crop&q=80&w=400&h=400' },
    { id: 'cat-ml-3', app: 'MART', category: 'mart-lounge', name: 'Minimalist Combed Soft Tee', price: 799, emoji: '👕', desc: 'Clean basic essential styled with high crew neckline detail.', rating: 4.7, image: 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?fm=jpg&fit=crop&q=80&w=400&h=400' },
  ],
  'groc-green': [
    { id: 'cat-gg-1', app: 'GROCERY', category: 'groc-green', name: 'Hydroponic Salad Greens Box', price: 130, emoji: '🥗', desc: 'Pesticide-free young romaine, kale and butterhead greens (250g).', rating: 4.9, image: 'https://images.unsplash.com/photo-1540420773420-3366772f4999?fm=jpg&fit=crop&q=80&w=400&h=400' },
    { id: 'cat-gg-2', app: 'GROCERY', category: 'groc-green', name: 'Premium Imported Hass Avocado', price: 160, emoji: '🥑', desc: 'Ultra buttery texture with supreme healthy monounsaturated oils.', rating: 4.8, image: 'https://images.unsplash.com/photo-1523049673857-eb18f1d7b578?fm=jpg&fit=crop&q=80&w=400&h=400' },
    { id: 'cat-gg-3', app: 'GROCERY', category: 'groc-green', name: 'Organic Royal Gala Apples (1kg)', price: 249, emoji: '🍎', desc: 'Crisp, super sweet orchard picked gala apples with bright red skin.', rating: 4.9, image: 'https://images.unsplash.com/photo-1560806887-1e4cd0b6cbd6?fm=jpg&fit=crop&q=80&w=400&h=400' },
  ],
  'groc-soda': [
    { id: 'cat-gs-1', app: 'GROCERY', category: 'groc-soda', name: 'Sparkling Peach Cranberry Can', price: 95, emoji: '🥫', desc: 'Real fruit juice infusion with light bubbly carbonation zest.', rating: 4.8, image: 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?fm=jpg&fit=crop&q=80&w=400&h=400' },
    { id: 'cat-gs-2', app: 'GROCERY', category: 'groc-soda', name: 'Artisanal Double Shot Nitro Cold Brew', price: 160, emoji: '🧋', desc: 'Creamy nitrogen charged single origin coffee brewed for 18 hours.', rating: 4.9, image: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?fm=jpg&fit=crop&q=80&w=400&h=400' },
    { id: 'cat-gs-3', app: 'GROCERY', category: 'groc-soda', name: 'Premium Sugar-Free Tonic Can', price: 80, emoji: '🥤', desc: 'Crisp quinine flavor profile perfect for premium mocktail mixes.', rating: 4.6, image: 'https://images.unsplash.com/photo-1551024709-8f23befc6f87?fm=jpg&fit=crop&q=80&w=400&h=400' },
  ],
  'groc-dairy': [
    { id: 'cat-gd-1', app: 'GROCERY', category: 'groc-dairy', name: 'Oat Milk Salted Caramel Carton', price: 280, emoji: '🥛', desc: 'Luxurious barista-grade plant alternative with sweet creamy body.', rating: 4.8, image: 'https://images.unsplash.com/photo-1550583724-b2692b85b150?fm=jpg&fit=crop&q=80&w=400&h=400' },
    { id: 'cat-gd-2', app: 'GROCERY', category: 'groc-dairy', name: 'Organic Blueberry Greek Yogurt', price: 75, emoji: '🍧', desc: 'Thick, high-protein organic strained yogurt with real blueberries.', rating: 4.9, image: 'https://images.unsplash.com/photo-1488477181946-6428a0291777?fm=jpg&fit=crop&q=80&w=400&h=400' },
    { id: 'cat-gd-3', app: 'GROCERY', category: 'groc-dairy', name: 'Dairy-Free Vanilla Almond Milk', price: 240, emoji: '🥛', desc: 'Smooth unsweetened vanilla bean almond extract milk (1L).', rating: 4.7, image: 'https://images.unsplash.com/photo-1553456558-aff63285bdd1?fm=jpg&fit=crop&q=80&w=400&h=400' },
  ],
  'ph-wellness': [
    { id: 'cat-pw-1', app: 'PHARMA', category: 'ph-wellness', name: 'Biotin Skin Glow Active Gummies', price: 499, emoji: '🍊', desc: 'Delicious strawberry vitamins to build active collagen structures.', rating: 4.9, image: 'https://images.unsplash.com/photo-1584017911766-d451b3d0e843?fm=jpg&fit=crop&q=80&w=400&h=400' },
    { id: 'cat-pw-2', app: 'PHARMA', category: 'ph-wellness', name: 'Ashwagandha De-Stress Mint Drops', price: 350, emoji: '🍵', desc: 'Calming adaptogens to ease cortisol levels and boost mental clarity.', rating: 4.8, image: 'https://images.unsplash.com/photo-1607619056574-7b8d304f2c38?fm=jpg&fit=crop&q=80&w=400&h=400' },
    { id: 'cat-pw-3', app: 'PHARMA', category: 'ph-wellness', name: 'Deep Sleep Chamomile Melatonin', price: 420, emoji: '💤', desc: 'Fast dissolving organic strips for healthy rest cycles.', rating: 4.7, image: 'https://images.unsplash.com/photo-1512290923902-8a9f81dc236c?fm=jpg&fit=crop&q=80&w=400&h=400' },
  ],
  'ph-sos': [
    { id: 'cat-ps-1', app: 'PHARMA', category: 'ph-sos', name: 'Hydrocolloid Fast Healing Patch Pack', price: 199, emoji: '🩹', desc: 'Absorbs fluids from acne lesions and protects from pollution.', rating: 4.9, image: 'https://images.unsplash.com/photo-1603398938378-e54eab446dde?fm=jpg&fit=crop&q=80&w=400&h=400' },
    { id: 'cat-ps-2', app: 'PHARMA', category: 'ph-sos', name: 'Cooling Instant Migraine Strip (2p)', price: 150, emoji: '❄️', desc: 'No-mess instant cold therapy strip to relieve temple stress.', rating: 4.7, image: 'https://images.unsplash.com/photo-1551076805-e1869033e561?fm=jpg&fit=crop&q=80&w=400&h=400' },
    { id: 'cat-ps-3', app: 'PHARMA', category: 'ph-sos', name: 'Menthol Throat Relief Lozenges', price: 120, emoji: '🍬', desc: 'Triple cooling action to soothe scratchy throat instantly.', rating: 4.8, image: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?fm=jpg&fit=crop&q=80&w=400&h=400' },
  ],
  'ph-beauty': [
    { id: 'cat-pb-1', app: 'PHARMA', category: 'ph-beauty', name: 'Advanced 96% Snail Mucin Essence', price: 1450, emoji: '🧴', desc: 'World famous hydrating formula for glass-like glowing skin.', rating: 4.9, image: 'https://images.unsplash.com/photo-1608248597481-496100c80836?fm=jpg&fit=crop&q=80&w=400&h=400' },
    { id: 'cat-pb-2', app: 'PHARMA', category: 'ph-beauty', name: 'AHA BHA PHA 30D Miracle Toner', price: 1150, emoji: '🧴', desc: 'Gently exfoliates dead cells and reveals natural translucent glow.', rating: 4.8, image: 'https://images.unsplash.com/photo-1556228720-195a672e8a03?fm=jpg&fit=crop&q=80&w=400&h=400' },
  ],
};
