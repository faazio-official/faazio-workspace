/**
 * @mock Static fixture — seeded sample data for local development until the Go Chi
 * backend (server/) is wired. See data/DATA_CONTROL.md.
 */
import type { PharmaProduct, PharmaCategory } from '../types';

export const PHARMA_CATEGORIES: PharmaCategory[] = [
  { id: 'vaccine', name: 'Vaccine', count: '250 products', icon: '💉' },
  { id: 'vitamin', name: 'Vitamin', count: '150 products', icon: '💊' },
  { id: 'supplements', name: 'Supplements', count: '300 products', icon: '🧴' },
  { id: 'fever', name: 'Fever', count: '67 products', icon: '🌡️' },
  { id: 'antiseptic', name: 'Antiseptic', count: '250 products', icon: '🧴' },
  { id: 'hypertension', name: 'Hypertension', count: '150 products', icon: '❤️' },
  { id: 'asthma', name: 'Asthma and Breathing', count: '300 products', icon: '🫁' },
  { id: 'diarrhea', name: 'Diarrhea', count: '87 products', icon: '💧' },
  { id: 'cough', name: 'Cough & Cold', count: '120 products', icon: '🤧' },
];

export interface PharmaDBItem {
  id: string;
  category: string;
  name: string;
  price: number;
  originalPrice: number | null;
  discountBadge: string | null;
  rating: number;
  reviewsCount: number;
  image: string;
  emoji: string;
  desc: string;
  bullets: string[];
}

export const PHARMA_PRODUCTS_DB: PharmaDBItem[] = [
  { id: 'ph-t1', category: 'vitamin', name: 'Turmeric & Ginger Gummies', price: 810, originalPrice: 1250, discountBadge: '14% OFF', rating: 5, reviewsCount: 250, image: 'https://images.unsplash.com/photo-1584017911766-d451b3d0e843?fm=jpg&fit=crop&q=80&w=400&h=400', emoji: '🍊', desc: 'With 270mg of curcumin extract per serving this powerful anti-oxidant treat will put you back in control of your body.', bullets: ['Turmeric 270mg', 'Ginger Extract 50mg', 'Vitamin C 30mg', 'Bioperine 5mg'] },
  { id: 'ph-t2', category: 'vitamin', name: 'Collagen Complex Gummies', price: 810, originalPrice: 1100, discountBadge: '15% OFF', rating: 4.8, reviewsCount: 140, image: 'https://images.unsplash.com/photo-1607619056574-7b8d304f2c38?fm=jpg&fit=crop&q=80&w=400&h=400', emoji: '💊', desc: 'Nourish your skin, hair, and nails from within. Formulated with premium hydrolyzed collagen peptides and active vitamins.', bullets: ['Hydrolyzed Collagen 500mg', 'Vitamin C 30mg', 'Biotin 300mcg', 'Vitamin E 15mg'] },
  { id: 'ph-t3', category: 'vitamin', name: 'Vitamin D3 2000 IU (60 Caps)', price: 450, originalPrice: 650, discountBadge: '30% OFF', rating: 4.7, reviewsCount: 310, image: 'https://images.unsplash.com/photo-1584017911766-d451b3d0e843?fm=jpg&fit=crop&q=80&w=400&h=400', emoji: '☀️', desc: 'Supports bone health, immune function, and calcium absorption with premium Vitamin D3.', bullets: ['Vitamin D3 2000 IU', 'Calcium 100mg', 'Zinc 10mg', 'Olive Oil Base'] },
  { id: 'ph-t4', category: 'vitamin', name: 'Multivitamin Daily (90 Tabs)', price: 680, originalPrice: null, discountBadge: null, rating: 4.9, reviewsCount: 580, image: 'https://images.unsplash.com/photo-1607619056574-7b8d304f2c38?fm=jpg&fit=crop&q=80&w=400&h=400', emoji: '💊', desc: 'Complete daily nutrition with 23 essential vitamins and minerals for overall wellness.', bullets: ['23 Essential Vitamins', 'Iron 18mg', 'Vitamin B12 6mcg', 'Folic Acid 400mcg'] },
  { id: 'ph-f1', category: 'fever', name: 'Paracetamol 500mg (10 Tabs)', price: 45, originalPrice: null, discountBadge: null, rating: 4.9, reviewsCount: 890, image: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?fm=jpg&fit=crop&q=80&w=400&h=400', emoji: '💊', desc: 'Effective relief from fever and mild to moderate pain. Consult a physician before exceeding daily dose limitations.', bullets: ['Paracetamol 500mg', 'Lactose Free', 'Gluten Free', 'No Artificial Colors'] },
  { id: 'ph-f2', category: 'fever', name: 'Ibuprofen 400mg (15 Tabs)', price: 85, originalPrice: null, discountBadge: null, rating: 4.8, reviewsCount: 560, image: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?fm=jpg&fit=crop&q=80&w=400&h=400', emoji: '💊', desc: 'Fast-acting anti-inflammatory pain relief for headaches, muscle pain, and fever.', bullets: ['Ibuprofen 400mg', 'Anti-inflammatory', 'Fast Absorbing', 'Sugar Free'] },
  { id: 'ph-v1', category: 'vaccine', name: 'Flu Vaccine (Quadrivalent)', price: 1200, originalPrice: 1500, discountBadge: '20% OFF', rating: 4.8, reviewsCount: 120, image: 'https://images.unsplash.com/photo-1584017911766-d451b3d0e843?fm=jpg&fit=crop&q=80&w=400&h=400', emoji: '💉', desc: 'Protect against four influenza virus strains with our preservative-free quadrivalent vaccine.', bullets: ['Quadrivalent Protection', 'Preservative Free', 'Single Dose', '18+ Years'] },
  { id: 'ph-a1', category: 'antiseptic', name: 'Antiseptic Cream 30g', price: 120, originalPrice: null, discountBadge: null, rating: 4.7, reviewsCount: 340, image: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?fm=jpg&fit=crop&q=80&w=400&h=400', emoji: '🧴', desc: 'Multi-purpose antiseptic cream for cuts, scrapes, and minor skin infections.', bullets: ['Antiseptic Formula', 'Soothing Aloe', 'Fast Healing', '3 year Shelf Life'] },
  { id: 'ph-h1', category: 'hypertension', name: 'Amlodipine 5mg (30 Tabs)', price: 180, originalPrice: 280, discountBadge: '35% OFF', rating: 4.6, reviewsCount: 230, image: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?fm=jpg&fit=crop&q=80&w=400&h=400', emoji: '❤️', desc: 'Calcium channel blocker for managing high blood pressure and coronary artery disease.', bullets: ['Amlodipine 5mg', 'BP Management', 'Heart Health', 'Prescription Required'] },
  { id: 'ph-as1', category: 'asthma', name: 'Salbutamol Inhaler 200 Doses', price: 350, originalPrice: 450, discountBadge: '22% OFF', rating: 4.8, reviewsCount: 410, image: 'https://images.unsplash.com/photo-1584017911766-d451b3d0e843?fm=jpg&fit=crop&q=80&w=400&h=400', emoji: '🫁', desc: 'Fast-acting bronchodilator inhaler for relief of asthma symptoms and breathing difficulties.', bullets: ['Salbutamol 100mcg', '200 Doses', 'Mouthpiece Included', 'Prescription Required'] },
  { id: 'ph-d1', category: 'diarrhea', name: 'Oral Rehydration Salt (20 Sachets)', price: 75, originalPrice: null, discountBadge: null, rating: 4.9, reviewsCount: 670, image: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?fm=jpg&fit=crop&q=80&w=400&h=400', emoji: '💧', desc: 'WHO-recommended oral rehydration salts for rapid electrolyte replacement during diarrhea.', bullets: ['WHO Formula', 'Electrolyte Balance', 'Orange Flavor', 'Easy Mix'] },
  { id: 'ph-s1', category: 'supplements', name: 'Whey Protein Isolate 500g', price: 1299, originalPrice: 1699, discountBadge: '23% OFF', rating: 4.9, reviewsCount: 180, image: 'https://images.unsplash.com/photo-1593095948071-474c5cc2c1cf?fm=jpg&fit=crop&q=80&w=400&h=400', emoji: '💪', desc: 'Premium whey protein isolate with 27g protein per serving, zero sugar, and fast absorption.', bullets: ['27g Protein', 'Zero Sugar', 'BCAA 5.5g', 'Chocolate Flavor'] },
  { id: 'ph-c1', category: 'cough', name: 'Honey & Tulsi Expectorant Syrup', price: 145, originalPrice: 190, discountBadge: '24% OFF', rating: 4.7, reviewsCount: 420, image: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?fm=jpg&fit=crop&q=80&w=400&h=400', emoji: '🍯', desc: 'Ayurvedic honey & tulsi based syrup that loosens chest congestion and soothes a dry tickly cough.', bullets: ['Honey 500mg', 'Tulsi Extract', 'Liquorice 30mg', 'Thyme 20mg'] },
  { id: 'ph-c2', category: 'cough', name: 'Dextromethorphan Cough Syrup', price: 165, originalPrice: 210, discountBadge: '21% OFF', rating: 4.6, reviewsCount: 310, image: 'https://images.unsplash.com/photo-1584017911766-d451b3d0e843?fm=jpg&fit=crop&q=80&w=400&h=400', emoji: '🤧', desc: 'Fast-acting cough suppressant for dry, hacking coughs. Consult a physician before use.', bullets: ['Dextromethorphan 10mg', 'Non-Drowsy', 'Sugar Free', 'Berry Flavor'] },
  { id: 'ph-c3', category: 'cough', name: 'Eucalyptus Cough Lozenges (24)', price: 95, originalPrice: null, discountBadge: null, rating: 4.8, reviewsCount: 260, image: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?fm=jpg&fit=crop&q=80&w=400&h=400', emoji: '🍬', desc: 'Menthol-eucalyptus drops that give instant cooling relief to a sore, scratchy throat.', bullets: ['Menthol 2mg', 'Eucalyptus Oil', 'Cough Relief', 'Dairy Free'] },
  { id: 'ph-pain1', category: 'fever', name: 'Diclofenac Gel 30g', price: 95, originalPrice: 130, discountBadge: '27% OFF', rating: 4.6, reviewsCount: 210, image: 'https://img.icons8.com/3d-fluency/94/ointment.png', emoji: '🧴', desc: 'Quick-absorbing topical gel for effective joint and muscle pain relief.', bullets: ['Diclofenac 1%', 'Anti-inflammatory', 'Fast Absorbing', 'Dermatologist Tested'] },
  { id: 'ph-pain2', category: 'fever', name: 'Cooling Pain Relief Balm', price: 135, originalPrice: 180, discountBadge: '25% OFF', rating: 4.7, reviewsCount: 380, image: 'https://img.icons8.com/3d-fluency/94/rubber-balls.png', emoji: '🧴', desc: 'Mentholated balm for soothing relief of back, neck and joint aches.', bullets: ['Menthol 10%', 'Methyl Salicylate', 'No Greasy Feel', '3 Pack'] },
  { id: 'ph-dev1', category: 'hypertension', name: 'Digital BP Monitor', price: 1299, originalPrice: 1699, discountBadge: '24% OFF', rating: 4.8, reviewsCount: 540, image: 'https://img.icons8.com/3d-fluency/94/tensiometer.png', emoji: '🩺', desc: 'Clinically accurate upper-arm blood pressure monitor with large backlit display.', bullets: ['Automatic Cuff', 'Irregular Heartbeat Detect', '120 Readings Memory', 'WHO Classification'] },
  { id: 'ph-dev2', category: 'hypertension', name: 'Wrist BP Monitor', price: 899, originalPrice: 1199, discountBadge: '25% OFF', rating: 4.6, reviewsCount: 260, image: 'https://img.icons8.com/3d-fluency/94/tensiometer.png', emoji: '⌚', desc: 'Compact wrist-worn blood pressure monitor perfect for travel and daily tracking.', bullets: ['One-Touch Operation', 'Portable', '60 Reading Memory', 'USB Charging'] },
  { id: 'ph-dev3', category: 'supplements', name: 'Glucometer & Test Strips (50)', price: 749, originalPrice: 999, discountBadge: '25% OFF', rating: 4.7, reviewsCount: 430, image: 'https://img.icons8.com/3d-fluency/94/glucometer.png', emoji: '💉', desc: 'Fast 5-second glucose reading with 50 test strips and lancing device.', bullets: ['50 Strips', '5 Sec Result', 'Code Free', 'Carry Case'] },
  { id: 'ph-dev4', category: 'supplements', name: 'Glucose Test Strips (25)', price: 349, originalPrice: 450, discountBadge: '22% OFF', rating: 4.8, reviewsCount: 310, image: 'https://img.icons8.com/3d-fluency/94/glucometer.png', emoji: '🧪', desc: 'Refill pack of 25 glucose test strips compatible with Faazio glucometer.', bullets: ['25 Strips', 'No Coding', 'Small Blood Sample', 'Valid 24 months'] },
  { id: 'ph-dev5', category: 'asthma', name: 'Fingertip Pulse Oximeter', price: 899, originalPrice: 1199, discountBadge: '25% OFF', rating: 4.8, reviewsCount: 650, image: 'https://img.icons8.com/3d-fluency/94/oximeter.png', emoji: '🫁', desc: 'Accurate SpO2 and pulse rate in 8 seconds with bright OLED display.', bullets: ['SpO2 + Pulse', 'OLED Display', '8 Sec Reading', 'Auto Power Off'] },
  { id: 'ph-dev6', category: 'antiseptic', name: 'Digital Infrared Thermometer', price: 599, originalPrice: 799, discountBadge: '25% OFF', rating: 4.7, reviewsCount: 720, image: 'https://img.icons8.com/3d-fluency/94/thermometer.png', emoji: '🌡️', desc: 'Non-contact infrared thermometer with fast 1-second forehead reading.', bullets: ['1 Sec Reading', 'Non-Contact', 'Fever Alarm', 'Silent Mode'] },
  { id: 'ph-dev7', category: 'fever', name: 'Digital Forehead Thermometer', price: 449, originalPrice: 599, discountBadge: '25% OFF', rating: 4.6, reviewsCount: 490, image: 'https://img.icons8.com/3d-fluency/94/thermometer.png', emoji: '🌡️', desc: 'Swipe-mode forehead thermometer with quick and comfortable readings.', bullets: ['Swipe Mode', 'Large LCD', 'Memory Recall', 'Auto Shutoff'] },
  { id: 'ph-dig1', category: 'diarrhea', name: 'Antacid Suspension (170ml)', price: 98, originalPrice: 140, discountBadge: '30% OFF', rating: 4.7, reviewsCount: 380, image: 'https://img.icons8.com/3d-fluency/94/stomach.png', emoji: '💧', desc: 'Fast-acting relief from acidity, heartburn and indigestion.', bullets: ['Aluminum Hydroxide', 'Magnesium', 'Mint Flavor', 'Sugar Free'] },
  { id: 'ph-dig2', category: 'supplements', name: 'Antacid Chewable Tablets (30)', price: 65, originalPrice: 90, discountBadge: '28% OFF', rating: 4.6, reviewsCount: 290, image: 'https://img.icons8.com/3d-fluency/94/pills.png', emoji: '🍬', desc: 'Peppermint-flavoured chewable antacid tablets for on-the-go relief.', bullets: ['Calcium Carbonate', 'Peppermint', 'Chewable', 'Sugar Free'] },
  { id: 'ph-dig3', category: 'supplements', name: 'Gentle Laxative Sachets (10)', price: 120, originalPrice: 160, discountBadge: '25% OFF', rating: 4.5, reviewsCount: 150, image: 'https://img.icons8.com/3d-fluency/94/pills.png', emoji: '🧪', desc: 'Osmotic laxative powder sachets for gentle relief from constipation.', bullets: ['Lactulose', 'No Bloating', '10 Sachets', 'Orange Flavor'] },
  { id: 'ph-dig4', category: 'supplements', name: 'Probiotic Gummies (30)', price: 499, originalPrice: 699, discountBadge: '29% OFF', rating: 4.8, reviewsCount: 410, image: 'https://img.icons8.com/3d-fluency/94/bacteria.png', emoji: '🦠', desc: 'Daily gut-health probiotics with prebiotic fibre in a tasty berry gummy.', bullets: ['10 Billion CFU', 'Prebiotic Fibre', 'Berry Flavor', 'Vegetarian'] },
  { id: 'ph-dig5', category: 'supplements', name: 'Digestive Enzyme Capsules (60)', price: 549, originalPrice: 749, discountBadge: '27% OFF', rating: 4.7, reviewsCount: 230, image: 'https://img.icons8.com/3d-fluency/94/capsule.png', emoji: '💊', desc: 'Multi-enzyme blend to support digestion of proteins, carbs and fats.', bullets: ['Amylase', 'Protease', 'Lipase', 'Lactase'] },
  { id: 'ph-om1', category: 'supplements', name: 'Fish Oil Omega-3 (120 Caps)', price: 649, originalPrice: 899, discountBadge: '28% OFF', rating: 4.9, reviewsCount: 520, image: 'https://img.icons8.com/3d-fluency/94/fish-oil.png', emoji: '🐟', desc: 'Ultra-pure EPA & DHA omega-3 supporting heart, brain and joint health.', bullets: ['EPA 360mg', 'DHA 240mg', 'Enteric Coated', 'No Fishy Aftertaste'] },
  { id: 'ph-om2', category: 'supplements', name: 'Omega-3 Vegan Capsules (60)', price: 699, originalPrice: 949, discountBadge: '26% OFF', rating: 4.7, reviewsCount: 180, image: 'https://img.icons8.com/3d-fluency/94/fish-oil.png', emoji: '🌿', desc: 'Plant-based algae-sourced omega-3 for vegans, rich in DHA.', bullets: ['Algal DHA 300mg', 'Vegan', 'Gold Standard Tested', '60 Caps'] },
  { id: 'ph-cal3', category: 'supplements', name: 'Calcium + D3 Effervescent (20)', price: 399, originalPrice: 549, discountBadge: '27% OFF', rating: 4.7, reviewsCount: 350, image: 'https://img.icons8.com/3d-fluency/94/bone.png', emoji: '🦴', desc: 'Effervescent calcium and vitamin D3 for strong bones and teeth.', bullets: ['Calcium 1000mg', 'Vitamin D3 800 IU', 'Orange Flavor', '20 Tablets'] },
  { id: 'ph-cal4', category: 'supplements', name: 'Calcium & Magnesium Caps (90)', price: 449, originalPrice: 599, discountBadge: '25% OFF', rating: 4.6, reviewsCount: 200, image: 'https://img.icons8.com/3d-fluency/94/bone.png', emoji: '💊', desc: 'Combined calcium and magnesium for bone density and muscle recovery.', bullets: ['Calcium 500mg', 'Magnesium 250mg', 'Zinc 5mg', '90 Caps'] },
];

const deriveForm = (name: string): string => {
  if (/gumm/i.test(name)) return 'Gummies';
  if (/caps/i.test(name)) return 'Capsule';
  if (/tab|tablet/i.test(name)) return 'Tablet';
  if (/syrup/i.test(name)) return 'Syrup';
  if (/inhaler/i.test(name)) return 'Inhaler';
  if (/cream/i.test(name)) return 'Cream';
  if (/lozenge/i.test(name)) return 'Lozenge';
  if (/sachet|salt/i.test(name)) return 'Powder';
  if (/protein/i.test(name)) return 'Powder';
  if (/vaccine/i.test(name)) return 'Injection';
  return 'Other';
};

const PRESCRIPTION_CATEGORIES = ['hypertension', 'asthma', 'fever'];

export const pharmaProducts: PharmaProduct[] = PHARMA_PRODUCTS_DB.map(p => ({
  id: p.id,
  app: 'PHARMA' as const,
  category: p.category,
  name: p.name,
  price: p.price,
  emoji: p.emoji,
  image: p.image,
  desc: p.desc,
  rating: p.rating,
  badge: p.discountBadge || undefined,
  badgeBg: undefined,
  originalPrice: p.originalPrice ?? undefined,
  attributes: {
    form: deriveForm(p.name),
    prescription: PRESCRIPTION_CATEGORIES.includes(p.category) ? 'Prescription' : 'OTC',
    brand: 'Faazio Health',
  },
}));
