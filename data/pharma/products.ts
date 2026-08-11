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
  attributes: {
    form: deriveForm(p.name),
    prescription: PRESCRIPTION_CATEGORIES.includes(p.category) ? 'Prescription' : 'OTC',
    brand: 'Faazio Health',
  },
}));
