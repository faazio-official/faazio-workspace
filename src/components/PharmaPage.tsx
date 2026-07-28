import React, { useState } from 'react';
import { 
  Activity, 
  Search, 
  FileText, 
  Heart, 
  Plus, 
  Minus, 
  Check, 
  ShieldCheck, 
  ShoppingBag,
  Bell,
  CheckCircle,
  Star,
  ChevronLeft,
  ChevronRight,
  MessageSquare,
  Calendar,
  Clock,
  MapPin,
  Phone,
  Stethoscope,
  ClipboardList,
  Store,
  Sparkles
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface PharmaPageProps {
  addToCart: (id: string, name: string, price: number, emoji: string) => void;
  cartItems?: { id: string; name: string; price: number; quantity: number; emoji: string }[];
  setCartItems?: React.Dispatch<React.SetStateAction<{ id: string; name: string; price: number; quantity: number; emoji: string }[]>>;
  updateCartQuantity?: (id: string, delta: number) => void;
  onProductClick?: (product: any) => void;
  activeTab?: string;
  setActiveTab?: (tab: string) => void;
}

interface PharmaProductDetail {
  id: string;
  category: string;
  name: string;
  price: number;
  originalPrice?: number;
  discountBadge?: string;
  rating: number;
  reviewsCount: number;
  image: string;
  emoji: string;
  desc: string;
  bullets: string[];
}

const ALL_CATEGORIES = [
  { id: 'vaccine', name: 'Vaccine', count: '250 products', icon: '💉' },
  { id: 'vitamin', name: 'Vitamine', count: '150 products', icon: '💊' },
  { id: 'supplements', name: 'Supplements', count: '300 products', icon: '🧴' },
  { id: 'fever', name: 'Fever', count: '67 products', icon: '🌡️' },
  { id: 'antiseptic', name: 'Antiseptic', count: '250 products', icon: '🧴' },
  { id: 'hypertension', name: 'Hypertension', count: '150 products', icon: '❤️' },
  { id: 'asthma', name: 'Asthma and Breathing', count: '300 products', icon: '🫁' },
  { id: 'diarrhea', name: 'Diarrhea', count: '87 products', icon: '💧' },
];

const PHARMA_PRODUCTS_DB: PharmaProductDetail[] = [
  // Vitamin category
  {
    id: 'ph-t1',
    category: 'vitamin',
    name: 'Turmeric & Ginger Gummies',
    price: 810,
    originalPrice: 1250,
    discountBadge: '14% OFF',
    rating: 5,
    reviewsCount: 250,
    image: 'https://images.unsplash.com/photo-1584017911766-d451b3d0e843?auto=format&fit=crop&q=80&w=400&h=400',
    emoji: '🍊',
    desc: 'With 270mg of curcumin extract per serving this powerful anti-oxidant treat will put you back in control of your body. Take 2 gummies a day to:',
    bullets: [
      'Reduce joint aches and stiffness',
      'Increase joint flexibility',
      'Receive healthy anti-inflammatory effects',
      'Improve memory and brain function'
    ]
  },
  {
    id: 'ph-t2',
    category: 'vitamin',
    name: 'Collagen Complex Gummies',
    price: 810,
    originalPrice: 1100,
    discountBadge: '15% OFF',
    rating: 4.8,
    reviewsCount: 140,
    image: 'https://images.unsplash.com/photo-1607619056574-7b8d304f2c38?auto=format&fit=crop&q=80&w=400&h=400',
    emoji: '💊',
    desc: 'Nourish your skin, hair, and nails from within. Formulated with premium hydrolyzed collagen peptides and active vitamins for maximum absorption.',
    bullets: [
      'Supports natural skin elasticity & hydration',
      'Strengthens brittle nails and hair follicles',
      'Rich in vital anti-aging antioxidants',
      'Delicious organic mixed berry flavor profile'
    ]
  },
  {
    id: 'ph-t3',
    category: 'vitamin',
    name: 'Apple Cider Vinegar Gummies',
    price: 699,
    originalPrice: 850,
    discountBadge: '17% OFF',
    rating: 4.7,
    reviewsCount: 95,
    image: 'https://images.unsplash.com/photo-1512290923902-8a9f81dc236c?auto=format&fit=crop&q=80&w=400&h=400',
    emoji: '🍎',
    desc: 'Get all the active benefits of pure apple cider vinegar without the sour taste. Supports healthy digestion, metabolic function, and natural detox processes.',
    bullets: [
      'Promotes digestive wellness & gut flora',
      'Aids in healthy metabolism & fat tracking',
      'Infused with beetroot and organic pomegranate',
      'Zero gelatin, gluten-free, vegan friendly'
    ]
  },
  {
    id: 'ph-t4',
    category: 'vitamin',
    name: 'Vitamin C Immune Support',
    price: 499,
    rating: 4.9,
    reviewsCount: 310,
    image: 'https://images.unsplash.com/photo-1626245917822-211a1b1dcbbf?auto=format&fit=crop&q=80&w=400&h=400',
    emoji: '🍋',
    desc: 'High-potency daily Vitamin C for immune defense. Formulated with natural citrus bioflavonoids to optimize daily bioavailability.',
    bullets: [
      'Boosts immune cell activity & response',
      'Assists in natural tissue repair & recovery',
      'Acts as a strong systemic antioxidant agent',
      'Easy to swallow rapid-release soft capsules'
    ]
  },
  // Fever category
  {
    id: 'ph-f1',
    category: 'fever',
    name: 'Paracetamol Fast Relief Tabs',
    price: 45,
    originalPrice: 60,
    discountBadge: '25% OFF',
    rating: 4.8,
    reviewsCount: 1100,
    image: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?auto=format&fit=crop&q=80&w=400&h=400',
    emoji: '💊',
    desc: 'Fast-acting fever reducer and mild pain reliever. Trusted formulation designed to offer rapid, effective relief of cold & flu symptoms.',
    bullets: [
      'Starts lowering fever in under 20 minutes',
      'Provides quick relief for heavy headaches',
      'Extremely gentle on sensitive stomach linings',
      'Vetted safe and widely recommended by doctors'
    ]
  },
  {
    id: 'ph-f2',
    category: 'fever',
    name: 'Instant Cooling Gel Patches',
    price: 199,
    rating: 4.7,
    reviewsCount: 140,
    image: 'https://images.unsplash.com/photo-1551076805-e1869033e561?auto=format&fit=crop&q=80&w=400&h=400',
    emoji: '❄️',
    desc: 'Non-medicated hydrogel cooling sheets that provide immediate physical cooling comfort for babies, children, and adults with fever.',
    bullets: [
      'Delivers up to 8 hours of soothing cooling effect',
      'Sticks securely to the forehead, no sliding off',
      'Safe to use in conjunction with oral medication',
      'Fragrance-free and hypoallergenic'
    ]
  },
  // Vaccine category
  {
    id: 'ph-v1',
    category: 'vaccine',
    name: 'Influenza (Flu) Annual Vaccine Shot',
    price: 850,
    rating: 4.9,
    reviewsCount: 180,
    image: 'https://images.unsplash.com/photo-1603398938378-e54eab446dde?auto=format&fit=crop&q=80&w=400&h=400',
    emoji: '💉',
    desc: 'Protects against multiple seasonal influenza strains. Recommended annually for active clinical viral protection.',
    bullets: [
      'Includes active vaccine components for 4 strains',
      'Administered at home by our vetted nurses',
      'FDA-licensed and strictly cold-chain preserved'
    ]
  },
  // Supplements category
  {
    id: 'ph-s1',
    category: 'supplements',
    name: 'Whey Protein Isolate Powder',
    price: 3499,
    originalPrice: 4200,
    discountBadge: '16% OFF',
    rating: 4.9,
    reviewsCount: 890,
    image: 'https://images.unsplash.com/photo-1550572017-edd951b55104?auto=format&fit=crop&q=80&w=400&h=400',
    emoji: '🥛',
    desc: 'Purest micro-filtered whey protein isolate to facilitate rapid muscle recovery, growth, and structural strength repair.',
    bullets: [
      '25g of premium isolate protein per scoop',
      'Ultra-fast digestion with added digestive enzymes',
      'Rich, delicious double chocolate cream flavor',
      'Zero added sugars, gluten-free, low carb'
    ]
  },
  // Antiseptic category
  {
    id: 'ph-a1',
    category: 'antiseptic',
    name: 'Premium Liquid Disinfectant',
    price: 299,
    originalPrice: 350,
    discountBadge: '15% OFF',
    rating: 4.9,
    reviewsCount: 610,
    image: 'https://images.unsplash.com/photo-1608248597481-496100c80836?auto=format&fit=crop&q=80&w=400&h=400',
    emoji: '🧴',
    desc: 'Trusted first-aid antiseptic and household sanitizing fluid. Eliminates pathogens on wounds and personal items.',
    bullets: [
      'Kills 99.9% of bacteria, viruses, and fungi',
      'Ideal for minor cuts, grazes, and skin washing',
      'Recommended by top international health boards'
    ]
  },
  // Hypertension category
  {
    id: 'ph-h1',
    category: 'hypertension',
    name: 'Cardioprotect Pure Omega-3',
    price: 899,
    originalPrice: 1100,
    discountBadge: '18% OFF',
    rating: 4.9,
    reviewsCount: 380,
    image: 'https://images.unsplash.com/photo-1550572017-edd951b55104?auto=format&fit=crop&q=80&w=400&h=400',
    emoji: '❤️',
    desc: 'Highly concentrated active EPA/DHA softgels to naturally sustain blood vessel elasticity and support arterial pressure control.',
    bullets: [
      'Sustains healthy cardiac muscle performance',
      'Lowers plasma triglycerides & systemic inflammation',
      'Strictly purified to remove heavy metal contents'
    ]
  },
  // Asthma category
  {
    id: 'ph-as1',
    category: 'asthma',
    name: 'Medical Aerodynamic Spacer Chamber',
    price: 650,
    rating: 4.8,
    reviewsCount: 150,
    image: 'https://images.unsplash.com/photo-1512290923902-8a9f81dc236c?auto=format&fit=crop&q=80&w=400&h=400',
    emoji: '🫁',
    desc: 'Valved inhalation holding chamber optimized to deposit asthma medications efficiently in deep airways.',
    bullets: [
      'Universal base fits all common inhalers',
      'Flexible anti-static chamber wall design',
      'Facilitates correct breathing timing control'
    ]
  },
  // Diarrhea category
  {
    id: 'ph-d1',
    category: 'diarrhea',
    name: 'Oral Rehydration Salts Electrolytes',
    price: 95,
    originalPrice: 120,
    discountBadge: '20% OFF',
    rating: 4.9,
    reviewsCount: 450,
    image: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?auto=format&fit=crop&q=80&w=400&h=400',
    emoji: '💧',
    desc: 'WHO-standard dehydration prevention solution. Quick dissolving powder to replenish essential mineral loss.',
    bullets: [
      'Restores perfect water and salt equilibrium',
      'Delicious naturally-sweetened orange flavour',
      'Perfect for quick clinical rehydration needs'
    ]
  }
];

const CategoryIcon = ({ id }: { id: string }) => {
  // Matching custom styled orange-outlined icons as shown in the mockup image!
  switch (id) {
    case 'vaccine':
      return (
        <svg viewBox="0 0 24 24" className="w-5 h-5 text-[#E05B35]" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <line x1="18" y1="2" x2="22" y2="6" />
          <line x1="14" y1="6" x2="18" y2="10" />
          <line x1="16" y1="4" x2="8" y2="12" />
          <line x1="11" y1="9" x2="3" y2="17" />
          <path d="M5 15l-2 2v2h2l2-2" />
        </svg>
      );
    case 'vitamin':
      return (
        <svg viewBox="0 0 24 24" className="w-5 h-5 text-[#E05B35]" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
        </svg>
      );
    case 'supplements':
      return (
        <svg viewBox="0 0 24 24" className="w-5 h-5 text-[#E05B35]" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z" />
          <path d="M12 6v12M6 12h12" />
        </svg>
      );
    case 'fever':
      return (
        <svg viewBox="0 0 24 24" className="w-5 h-5 text-[#E05B35]" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 4v10.54a4 4 0 1 1-4 0V4a2 2 0 0 1 4 0z" />
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 24 24" className="w-5 h-5 text-[#E05B35]" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
        </svg>
      );
  }
};

export default function PharmaPage({ 
  addToCart, 
  cartItems = [], 
  setCartItems, 
  updateCartQuantity, 
  onProductClick,
  activeTab = 'Home',
  setActiveTab
}: PharmaPageProps) {
  
  // Custom screen navigation view logic inside the main 'Home' Tab
  const [currentView, setCurrentView] = useState<'HOME' | 'ALL_CATEGORIES' | 'CATEGORY_PRODUCTS' | 'PRODUCT_DETAIL'>('HOME');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [quantity, setQuantity] = useState<number>(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [addedAnimationId, setAddedAnimationId] = useState<string | null>(null);

  // Favorites
  const [localFavorites, setLocalFavorites] = useState<string[]>(['ph-t1', 'ph-f1']);
  
  // Consultation State
  const [selectedSymptoms, setSelectedSymptoms] = useState<string[]>([]);
  const [consultationQuery, setConsultationQuery] = useState('');
  const [isConsulting, setIsConsulting] = useState(false);
  const [diagnosticsReport, setDiagnosticsReport] = useState<{
    summary: string;
    precaution: string;
    medicines: string[];
  } | null>(null);

  // History State
  const [consultationsList, setConsultationsList] = useState([
    {
      id: 'c-1',
      date: '2026-07-06',
      time: '11:00 AM',
      doctor: 'Dr. Camberline',
      type: 'Video Consultation',
      symptoms: ['Fatigue', 'Vitamin Intake'],
      status: 'Completed',
      recommendations: 'Take Collagen gummies daily, maintain optimal hydration.'
    }
  ]);

  const [activeOrders, setActiveOrders] = useState([
    {
      id: 'ORD-93821',
      date: '2026-07-07',
      items: 'Paracetamol Fast Relief x2',
      total: 90,
      status: 'Shipped (Arriving in 15 mins)'
    }
  ]);

  // Selected physical outlet
  const [preferredOutletId, setPreferredOutletId] = useState('hub-1');

  // Outlets List
  const OUTLETS_DB = [
    {
      id: 'hub-1',
      name: 'Faazio Wellness Hub - Rumbai',
      address: 'Utama Street no. 14, Rumbai',
      hours: 'Open 24 Hours',
      phone: '+91 98765 43210',
      distance: '0.2 km'
    },
    {
      id: 'south-2',
      name: 'Faazio Meds Store - South Plaza',
      address: 'South Ring Road Plaza, Block C',
      hours: '8:00 AM - 11:00 PM',
      phone: '+91 98765 43211',
      distance: '3.5 km'
    },
    {
      id: 'west-3',
      name: 'Faazio Biotech & Lab - Marina Beach',
      address: 'Marina Beach Road, Block 4',
      hours: '7:00 AM - 10:00 PM',
      phone: '+91 98765 43212',
      distance: '5.8 km'
    }
  ];

  const toggleLocalFavorite = (id: string) => {
    setLocalFavorites(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const handleAddWithFeedback = (id: string, name: string, price: number, emoji: string) => {
    addToCart(id, name, price, emoji);
    setAddedAnimationId(id);
    setTimeout(() => {
      setAddedAnimationId(null);
    }, 1200);
  };

  const handleAddMultipleToCart = (product: PharmaProductDetail, qty: number) => {
    if (setCartItems) {
      setCartItems(prev => {
        const existing = prev.find(item => item.id === product.id);
        if (existing) {
          return prev.map(item => item.id === product.id ? { ...item, quantity: item.quantity + qty } : item);
        }
        return [...prev, { id: product.id, name: product.name, price: product.price, quantity: qty, emoji: product.emoji }];
      });
    } else {
      for (let i = 0; i < qty; i++) {
        addToCart(product.id, product.name, product.price, product.emoji);
      }
    }
    setAddedAnimationId(product.id);
    setTimeout(() => {
      setAddedAnimationId(null);
    }, 1200);
  };

  // Symptoms consultation simulator
  const toggleSymptom = (symptom: string) => {
    setSelectedSymptoms(prev => 
      prev.includes(symptom) ? prev.filter(s => s !== symptom) : [...prev, symptom]
    );
  };

  const runDiagnosticAssessment = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedSymptoms.length === 0 && !consultationQuery.trim()) {
      alert('Please select at least one symptom or describe your query.');
      return;
    }

    setIsConsulting(true);
    setDiagnosticsReport(null);

    // Simulate safe clinical determination logic
    setTimeout(() => {
      const isFever = selectedSymptoms.includes('Fever') || consultationQuery.toLowerCase().includes('fever') || consultationQuery.toLowerCase().includes('temp');
      const isFatigue = selectedSymptoms.includes('Fatigue') || consultationQuery.toLowerCase().includes('tired') || consultationQuery.toLowerCase().includes('energy');
      const isStomach = selectedSymptoms.includes('Dehydration') || consultationQuery.toLowerCase().includes('stomach') || consultationQuery.toLowerCase().includes('loose');
      
      let summary = 'General wellness assessment prepared. Based on your inputs, we recommend prioritizing essential macro-nutrients and cellular hydration.';
      let precaution = 'Get at least 8 hours of sleep, avoid strenuous exercise, and monitor your vitals.';
      let recommendedMeds = ['ph-t4']; // Default Vit C

      if (isFever) {
        summary = 'Elevated system temperature indicators. Recommended to lower fever and maintain continuous rest to allow immune cells to recuperate.';
        precaution = 'Monitor temperature every 4 hours. Stay indoors, drink lots of water, and consult a pediatrician if symptoms persist over 48 hours.';
        recommendedMeds = ['ph-f1', 'ph-f2'];
      } else if (isFatigue) {
        summary = 'Underactive metabolism or cellular fatigue indicators. Formulated antioxidants can help restore natural vigor and muscle oxygenation.';
        precaution = 'Limit caffeine intake, take a warm salt bath, and consume fresh greens.';
        recommendedMeds = ['ph-t1', 'ph-t2'];
      } else if (isStomach) {
        summary = 'Electrolyte depletion or digestive flora imbalance indicators. Rehydration of critical mineral salts is highly recommended.';
        precaution = 'Avoid greasy or dairy foods for 24 hours. Drink boiled water and consume plain rehydration solution continuously.';
        recommendedMeds = ['ph-d1'];
      }

      setDiagnosticsReport({
        summary,
        precaution,
        medicines: recommendedMeds
      });
      setIsConsulting(false);
    }, 1500);
  };

  const scheduleDoctorConsultation = (docName: string) => {
    const newConsult = {
      id: 'c-' + Date.now(),
      date: new Date().toISOString().split('T')[0],
      time: '10:00 AM (Tomorrow)',
      doctor: docName,
      type: 'Video Consultation',
      symptoms: selectedSymptoms.length > 0 ? selectedSymptoms : ['General Assessment'],
      status: 'Upcoming' as const,
      recommendations: 'Awaiting doctor connect. Video link will activate 5 minutes before scheduled slot.'
    };

    setConsultationsList(prev => [newConsult, ...prev]);
    alert(`Consultation successfully scheduled with ${docName}! Details have been saved to your History tab.`);
    setSelectedSymptoms([]);
    setConsultationQuery('');
    setDiagnosticsReport(null);
    if (setActiveTab) {
      setActiveTab('History');
    }
  };

  // Filter products by search
  const filteredProducts = PHARMA_PRODUCTS_DB.filter(product => {
    if (!searchQuery) return true;
    return product.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
           product.desc.toLowerCase().includes(searchQuery.toLowerCase());
  });

  return (
    <div className="h-full w-full overflow-y-auto scrollbar-none flex flex-col bg-[#FAF9F6] text-slate-800">
      
      {/* TAB 1: HOME (MEDS SHOP) */}
      {activeTab === 'Home' && (
        <div className="flex-1 flex flex-col">
          
          {/* SCREEN 1: MAIN SHOP LANDING */}
          {currentView === 'HOME' && (
            <div className="flex flex-col flex-1">
              
              {/* BEAUTIFUL PEACH GRADIENT HEADER CARD - 1:1 WITH UPLOADED MOCK IMAGE */}
              <div className="bg-gradient-to-b from-[#FFF0E8] to-[#FFD5C8] rounded-b-[42px] p-5 pb-8 shadow-sm flex flex-col relative overflow-hidden select-none">
                <div className="absolute right-[-10%] top-[-15%] w-36 h-36 rounded-full bg-white/10 blur-xl pointer-events-none" />
                <div className="absolute left-[-5%] bottom-[-15%] w-36 h-36 rounded-full bg-[#FFEAE5]/20 blur-xl pointer-events-none" />

                {/* Top Action Row: Avatar, Name & Actions */}
                <div className="relative z-10 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-full overflow-hidden border-2 border-white shadow-md shrink-0 bg-slate-100">
                      <img 
                        src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&q=80&w=120&h=120" 
                        alt="Hello Camberline" 
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                    <div>
                      <span className="text-slate-500 text-[11px] font-medium block leading-none">Hello,</span>
                      <h4 className="text-slate-900 font-extrabold text-[15px] leading-tight mt-1">
                        Camberline
                      </h4>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <input 
                        type="text"
                        placeholder="Search meds..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-28 focus:w-40 transition-all bg-white/70 focus:bg-white text-xs text-slate-800 rounded-full pl-8 pr-3 py-1.5 focus:outline-none border border-[#FF7A59]/10"
                      />
                      <Search size={12} className="absolute left-3 top-2.5 text-slate-400" />
                    </div>
                    
                    <button className="w-8 h-8 rounded-full bg-white text-slate-700 hover:bg-slate-50 flex items-center justify-center transition-all border-none cursor-pointer shadow-xs relative">
                      <Bell size={13} strokeWidth={2.5} />
                      <span className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-[#E05B35]" />
                    </button>
                  </div>
                </div>

                {/* Mid Banner text: "Get exciting products today with 30% off" */}
                <div className="relative z-10 mt-6 max-w-[85%]">
                  <h1 className="text-[21px] font-black text-slate-900 tracking-tight leading-tight">
                    Get exciting products<br />today with 30% off
                  </h1>
                  
                  <button 
                    onClick={() => {
                      setSelectedCategoryId('vitamin');
                      setCurrentView('CATEGORY_PRODUCTS');
                    }}
                    className="bg-black hover:bg-slate-900 text-white text-[9.5px] font-black uppercase tracking-wider px-4 py-2 rounded-full mt-3 border-none cursor-pointer shadow-md transition-all active:scale-95"
                  >
                    Shop now
                  </button>
                </div>

                {/* VISUALLY INTEGRATED 100% HEALTHCARE CARD - PERFECT PRESERVATION OF VISUAL WEIGHT */}
                <div className="relative z-10 mt-6 bg-white/95 backdrop-blur-md rounded-2xl p-3.5 px-4.5 shadow-[0_8px_24px_rgba(255,122,89,0.08)] border border-white/50 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-[#FFF0E8] flex items-center justify-center text-[#FF7A59] shrink-0">
                      <ShieldCheck size={16} strokeWidth={2.5} />
                    </div>
                    <div>
                      <h5 className="text-[11px] font-black text-slate-900 leading-tight">
                        Certified Wellness Direct Delivery
                      </h5>
                      <p className="text-[8.5px] text-slate-400 font-bold mt-0.5 leading-none">
                        100% Vetted • Temperature Controlled Logistics
                      </p>
                    </div>
                  </div>
                  <div className="w-5.5 h-5.5 rounded-full bg-slate-50 flex items-center justify-center text-[#FF7A59]">
                    <Check size={10} strokeWidth={3.5} />
                  </div>
                </div>

              </div>

              {/* Slider Dots under curved header */}
              <div className="flex items-center justify-center gap-1.5 py-3">
                <div className="w-1.5 h-1.5 rounded-full bg-slate-200" />
                <div className="w-3.5 h-1.5 rounded-full bg-[#FF7A59] shadow-sm" />
                <div className="w-1.5 h-1.5 rounded-full bg-slate-200" />
              </div>

              {/* Categories Section */}
              <div className="px-5 space-y-3 flex-1 pb-6">
                <div className="flex items-center justify-between">
                  <h4 className="text-[14px] font-black text-slate-900 tracking-tight">
                    Category
                  </h4>
                  <button 
                    onClick={() => setCurrentView('ALL_CATEGORIES')}
                    className="text-[10px] font-bold text-slate-400 hover:text-slate-600 transition-colors border-none bg-transparent cursor-pointer"
                  >
                    View all
                  </button>
                </div>

                {/* 2x2 Grid matching the images exactly */}
                <div className="grid grid-cols-2 gap-3.5">
                  {ALL_CATEGORIES.slice(0, 4).map((cat) => (
                    <div 
                      key={cat.id}
                      onClick={() => {
                        setSelectedCategoryId(cat.id);
                        setCurrentView('CATEGORY_PRODUCTS');
                      }}
                      className="bg-white hover:bg-slate-50/50 border border-slate-100 rounded-[22px] p-3.5 flex items-center gap-3 cursor-pointer shadow-[0_4px_12px_rgba(0,0,0,0.015)] active:scale-98 transition-all group"
                    >
                      <div className="w-10 h-10 rounded-full border-2 border-[#FFEAE5] bg-[#FFF5F2] flex items-center justify-center shrink-0 relative transition-transform duration-300 group-hover:scale-105">
                        <CategoryIcon id={cat.id} />
                      </div>

                      <div className="min-w-0">
                        <h5 className="text-[11px] font-extrabold text-slate-900 leading-tight group-hover:text-[#FF7A59] transition-colors truncate">
                          {cat.name}
                        </h5>
                        <p className="text-[8.5px] text-slate-400 font-bold mt-0.5 leading-none uppercase tracking-wide">
                          {cat.count}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Hot Deals & Popular Wellness Matches */}
                <div className="space-y-3 pt-3">
                  <h4 className="text-[14px] font-black text-slate-900 tracking-tight">
                    Popular Wellness Matches
                  </h4>
                  <div className="grid grid-cols-2 gap-3">
                    {PHARMA_PRODUCTS_DB.slice(0, 4).map((product) => {
                      const isFav = localFavorites.includes(product.id);
                      const isAdded = addedAnimationId === product.id;
                      return (
                        <div 
                          key={product.id}
                          className="bg-white rounded-2xl border border-slate-100 p-3 flex flex-col justify-between shadow-sm relative group"
                        >
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleLocalFavorite(product.id);
                            }}
                            className="absolute top-2.5 right-2.5 z-10 w-6.5 h-6.5 rounded-full bg-white/80 flex items-center justify-center text-slate-300 hover:text-rose-500 border-none cursor-pointer"
                          >
                            <Heart size={11} className={isFav ? "fill-rose-500 text-rose-500" : ""} />
                          </button>

                          <div 
                            onClick={() => {
                              setSelectedProductId(product.id);
                              setQuantity(1);
                              setCurrentView('PRODUCT_DETAIL');
                            }}
                            className="cursor-pointer flex-1"
                          >
                            <div className="aspect-square w-full bg-[#FFFBF9] rounded-xl flex items-center justify-center mb-2 overflow-hidden">
                              <img src={product.image} alt={product.name} className="w-[80%] h-[80%] object-contain group-hover:scale-105 transition-transform duration-300" referrerPolicy="no-referrer" />
                            </div>
                            <h5 className="text-[10px] font-extrabold text-slate-900 line-clamp-1 leading-snug group-hover:text-[#FF7A59] transition-colors">
                              {product.name}
                            </h5>
                            <span className="text-[9px] text-[#FF7A59] block mt-0.5 font-bold">★ {product.rating}</span>
                          </div>

                          <div className="flex items-center justify-between mt-2 pt-1 border-t border-slate-50">
                            <span className="text-[10.5px] font-black text-slate-900">₹{product.price}</span>
                            <button
                              onClick={() => handleAddWithFeedback(product.id, product.name, product.price, product.emoji)}
                              className={`w-6 h-6 rounded-full flex items-center justify-center transition-all border-none cursor-pointer ${
                                isAdded ? 'bg-emerald-500 text-white' : 'bg-slate-900 text-white hover:bg-black'
                              }`}
                            >
                              {isAdded ? <Check size={10} strokeWidth={3} /> : <Plus size={10} strokeWidth={3} />}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

              </div>

            </div>
          )}

          {/* SCREEN 2: ALL CATEGORIES GRID VIEW */}
          {currentView === 'ALL_CATEGORIES' && (
            <div className="p-5 space-y-4 flex-1 pb-10">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <button 
                  onClick={() => setCurrentView('HOME')}
                  className="w-8 h-8 rounded-full bg-white text-slate-800 flex items-center justify-center shadow-xs border-none cursor-pointer"
                >
                  <ChevronLeft size={16} strokeWidth={3} />
                </button>
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-900">
                  All Healthcare Categories
                </h3>
                <div className="w-8 h-8" />
              </div>

              <div className="grid grid-cols-2 gap-3.5">
                {ALL_CATEGORIES.map((cat) => (
                  <div 
                    key={cat.id}
                    onClick={() => {
                      setSelectedCategoryId(cat.id);
                      setCurrentView('CATEGORY_PRODUCTS');
                    }}
                    className="bg-white hover:bg-slate-50 border border-slate-100 rounded-[22px] p-4 flex items-center gap-3.5 cursor-pointer shadow-sm active:scale-98 transition-all group"
                  >
                    <div className="w-10 h-10 rounded-full border-2 border-[#FFEAE5] bg-[#FFF5F2] flex items-center justify-center shrink-0 relative transition-transform duration-300 group-hover:scale-105">
                      <CategoryIcon id={cat.id} />
                    </div>

                    <div className="min-w-0">
                      <h5 className="text-[11px] font-extrabold text-slate-900 leading-tight group-hover:text-[#FF7A59] transition-colors truncate">
                        {cat.name}
                      </h5>
                      <p className="text-[8.5px] text-slate-400 font-bold mt-0.5 leading-none">
                        {cat.count}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* SCREEN 3: CATEGORY PRODUCTS LIST */}
          {currentView === 'CATEGORY_PRODUCTS' && (
            <div className="p-5 space-y-4 flex-1 pb-10">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <button 
                  onClick={() => setCurrentView('HOME')}
                  className="w-8 h-8 rounded-full bg-white text-slate-800 flex items-center justify-center shadow-xs border-none cursor-pointer"
                >
                  <ChevronLeft size={16} strokeWidth={3} />
                </button>
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-900">
                  {ALL_CATEGORIES.find(c => c.id === selectedCategoryId)?.name || 'Products'}
                </h3>
                <div className="w-8 h-8" />
              </div>

              {filteredProducts.filter(p => p.category === selectedCategoryId).length === 0 ? (
                <div className="text-center py-12 bg-white rounded-2xl border border-slate-100 p-6">
                  <span className="text-3xl">💊</span>
                  <h5 className="text-[11px] font-black text-slate-700 mt-2">No Matching Products</h5>
                  <p className="text-[9px] text-slate-400 mt-0.5">Please check again later or look under another category!</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3.5">
                  {filteredProducts
                    .filter(p => p.category === selectedCategoryId)
                    .map((product) => {
                      const isFav = localFavorites.includes(product.id);
                      const isAdded = addedAnimationId === product.id;
                      return (
                        <div 
                          key={product.id}
                          className="bg-white rounded-2xl border border-slate-100 p-3.5 flex flex-col justify-between shadow-sm relative group"
                        >
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleLocalFavorite(product.id);
                            }}
                            className="absolute top-2.5 right-2.5 z-10 w-6.5 h-6.5 rounded-full bg-white/85 flex items-center justify-center text-slate-300 hover:text-rose-500 border-none cursor-pointer"
                          >
                            <Heart size={11} className={isFav ? "fill-rose-500 text-rose-500" : ""} />
                          </button>

                          <div 
                            onClick={() => {
                              setSelectedProductId(product.id);
                              setQuantity(1);
                              setCurrentView('PRODUCT_DETAIL');
                            }}
                            className="cursor-pointer flex-1"
                          >
                            <div className="aspect-square w-full bg-[#FFFBF9] rounded-xl flex items-center justify-center mb-2 overflow-hidden">
                              <img src={product.image} alt={product.name} className="w-[85%] h-[85%] object-contain group-hover:scale-105 transition-transform duration-300" referrerPolicy="no-referrer" />
                            </div>
                            <h5 className="text-[10px] font-extrabold text-slate-900 line-clamp-2 leading-snug group-hover:text-[#FF7A59] transition-colors min-h-[28px]">
                              {product.name}
                            </h5>
                            <span className="text-[9px] text-[#FF7A59] block mt-0.5 font-bold">★ {product.rating}</span>
                          </div>

                          <div className="flex items-center justify-between mt-3 pt-1.5 border-t border-slate-50">
                            <span className="text-[11px] font-black text-slate-900">₹{product.price}</span>
                            <button
                              onClick={() => handleAddWithFeedback(product.id, product.name, product.price, product.emoji)}
                              className={`w-6.5 h-6.5 rounded-full flex items-center justify-center transition-all border-none cursor-pointer ${
                                isAdded ? 'bg-emerald-500 text-white' : 'bg-slate-900 text-white'
                              }`}
                            >
                              {isAdded ? <Check size={10} strokeWidth={3} /> : <Plus size={10} strokeWidth={3} />}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>
          )}

          {/* SCREEN 4: PRODUCT DETAIL & ORDER INTEGRATION */}
          {currentView === 'PRODUCT_DETAIL' && (
            <div className="p-5 space-y-4 flex-1 pb-12">
              {(() => {
                const product = PHARMA_PRODUCTS_DB.find(p => p.id === selectedProductId);
                if (!product) return null;
                const isFav = localFavorites.includes(product.id);
                const isAdded = addedAnimationId === product.id;
                const totalItemPrice = product.price * quantity;
                return (
                  <div className="space-y-4">
                    
                    {/* Header Image box */}
                    <div className="bg-gradient-to-b from-[#FFF2EE] to-[#FFF7F4] rounded-[36px] p-5 pb-8 border border-[#FFF2EE] relative overflow-hidden flex flex-col">
                      <div className="flex items-center justify-between z-10">
                        <button 
                          onClick={() => setCurrentView('CATEGORY_PRODUCTS')}
                          className="w-8.5 h-8.5 rounded-full bg-white text-slate-800 flex items-center justify-center shadow-xs border-none cursor-pointer"
                        >
                          <ChevronLeft size={16} strokeWidth={3} />
                        </button>
                        
                        <button 
                          onClick={() => toggleLocalFavorite(product.id)}
                          className="w-8.5 h-8.5 rounded-full bg-white text-slate-300 hover:text-rose-500 flex items-center justify-center shadow-xs border-none cursor-pointer"
                        >
                          <Heart size={14} className={isFav ? "fill-rose-500 text-rose-500" : ""} />
                        </button>
                      </div>

                      <div className="w-48 h-48 mx-auto flex items-center justify-center my-4 relative z-10">
                        <img 
                          src={product.image} 
                          alt={product.name} 
                          className="max-w-[90%] max-h-[90%] object-contain mix-blend-multiply drop-shadow-md"
                          referrerPolicy="no-referrer"
                        />
                      </div>
                    </div>

                    {/* Detail Information */}
                    <div className="space-y-3 px-1">
                      <h2 className="text-[18px] font-black text-slate-900 leading-tight">
                        {product.name}
                      </h2>
                      
                      <div className="flex items-center gap-1 text-slate-400 text-xs">
                        <div className="flex items-center text-amber-400">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <Star key={i} size={11} className="fill-amber-400 text-amber-400" />
                          ))}
                        </div>
                        <span className="text-[10px] font-bold text-slate-500 ml-1">
                          ({product.reviewsCount} Reviews)
                        </span>
                      </div>

                      {/* Quantity Selector */}
                      <div className="flex items-center justify-between bg-slate-50 border border-slate-100 rounded-2xl p-3">
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                          SELECT QUANTITY
                        </span>
                        
                        <div className="flex items-center gap-4">
                          <button 
                            onClick={() => setQuantity(prev => Math.max(1, prev - 1))}
                            className="w-7.5 h-7.5 rounded-full bg-white text-slate-700 flex items-center justify-center border border-slate-200/50 cursor-pointer shadow-xs"
                          >
                            <Minus size={11} strokeWidth={3} />
                          </button>
                          
                          <span className="text-xs font-black text-slate-900 w-4 text-center">
                            {quantity}
                          </span>
                          
                          <button 
                            onClick={() => setQuantity(prev => prev + 1)}
                            className="w-7.5 h-7.5 rounded-full bg-white text-slate-700 flex items-center justify-center border border-slate-200/50 cursor-pointer shadow-xs"
                          >
                            <Plus size={11} strokeWidth={3} />
                          </button>
                        </div>
                      </div>

                      {/* Description */}
                      <div className="space-y-1.5 pt-1">
                        <h4 className="text-[11px] font-black text-slate-900 uppercase tracking-wider">
                          Description
                        </h4>
                        <p className="text-[10px] text-slate-500 font-medium leading-relaxed">
                          {product.desc}
                        </p>
                      </div>

                      {/* Benefits check list */}
                      <div className="space-y-2 pt-1">
                        {product.bullets.map((bullet, idx) => (
                          <div key={idx} className="flex items-start gap-2.5">
                            <div className="w-4 h-4 rounded-full bg-[#FFEAE5] flex items-center justify-center shrink-0 text-[#FF7A59]">
                              <Check size={8} strokeWidth={4} />
                            </div>
                            <span className="text-[9.5px] text-slate-600 font-bold leading-tight">
                              {bullet}
                            </span>
                          </div>
                        ))}
                      </div>

                    </div>

                    {/* Total Sticky Bottom Pay Actions */}
                    <div className="bg-white border-t border-slate-100 pt-3 flex items-center justify-between gap-4 mt-4 px-1">
                      <div className="flex flex-col">
                        <span className="text-[8px] text-slate-400 font-black uppercase tracking-wider">
                          TOTAL AMOUNT
                        </span>
                        <span className="text-[16px] font-black text-slate-900 mt-0.5">
                          ₹{totalItemPrice.toLocaleString('en-IN')}
                        </span>
                      </div>

                      <button
                        onClick={() => handleAddMultipleToCart(product, quantity)}
                        className={`flex-1 h-11 rounded-xl text-[10px] font-black uppercase tracking-wider border-none cursor-pointer flex items-center justify-center gap-1.5 transition-all ${
                          isAdded ? 'bg-emerald-500 text-white' : 'bg-slate-900 hover:bg-black text-white'
                        }`}
                      >
                        {isAdded ? (
                          <>
                            <CheckCircle size={12} strokeWidth={3} />
                            <span>Added to Cart!</span>
                          </>
                        ) : (
                          <span>Add to Cart</span>
                        )}
                      </button>
                    </div>

                  </div>
                );
              })()}
            </div>
          )}

        </div>
      )}

      {/* TAB 2: FOR YOU (CLEAN, POLISHED USER-CURATED WELLNESS SELECTIONS) */}
      {activeTab === 'For You' && (
        <div className="p-5 space-y-5 flex-1 pb-16 overflow-y-auto h-full scrollbar-none">
          <div className="border-b border-slate-100 pb-3">
            <h3 className="text-xs font-black uppercase tracking-widest text-[#FF7A59] flex items-center gap-1.5">
              <Sparkles size={13} className="fill-[#FF7A59]/10" />
              For You
            </h3>
            <p className="text-[10px] text-slate-400 font-bold mt-0.5 leading-snug">
              A certified wellness selection recommended specifically based on your health preferences.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3.5 pt-1">
            {[
              PHARMA_PRODUCTS_DB.find(p => p.id === 'ph-t1'),
              PHARMA_PRODUCTS_DB.find(p => p.id === 'ph-t2'),
              PHARMA_PRODUCTS_DB.find(p => p.id === 'ph-t4'),
              PHARMA_PRODUCTS_DB.find(p => p.id === 'ph-f1'),
              PHARMA_PRODUCTS_DB.find(p => p.id === 'ph-f2')
            ].filter((p): p is PharmaProductDetail => !!p).map((product) => {
              const isFav = localFavorites.includes(product.id);
              const isAdded = addedAnimationId === product.id;
              return (
                <div 
                  key={product.id}
                  className="bg-white rounded-[22px] border border-slate-100 p-3.5 flex flex-col justify-between shadow-sm relative group"
                >
                  {product.discountBadge && (
                    <span className="absolute top-2.5 left-2.5 z-10 text-[8px] font-black uppercase bg-[#E05B35] text-white px-2 py-0.5 rounded-full">
                      {product.discountBadge}
                    </span>
                  )}

                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleLocalFavorite(product.id);
                    }}
                    className="absolute top-2.5 right-2.5 z-10 w-6.5 h-6.5 rounded-full bg-white/85 flex items-center justify-center text-slate-300 hover:text-rose-500 border-none cursor-pointer"
                  >
                    <Heart size={11} className={isFav ? "fill-rose-500 text-rose-500" : ""} />
                  </button>

                  <div 
                    onClick={() => {
                      setSelectedProductId(product.id);
                      setQuantity(1);
                      setCurrentView('PRODUCT_DETAIL');
                      if (setActiveTab) setActiveTab('Home');
                    }}
                    className="cursor-pointer flex-1"
                  >
                    <div className="aspect-square w-full bg-[#FFFBF9] rounded-xl flex items-center justify-center mb-2 overflow-hidden">
                      <img 
                        src={product.image} 
                        alt={product.name} 
                        className="w-[85%] h-[85%] object-contain group-hover:scale-105 transition-transform duration-300" 
                        referrerPolicy="no-referrer" 
                      />
                    </div>
                    
                    <h5 className="text-[10px] font-extrabold text-slate-900 leading-snug group-hover:text-[#FF7A59] transition-colors min-h-[28px] line-clamp-2">
                      {product.name}
                    </h5>
                    <span className="text-[9px] text-[#FF7A59] block mt-0.5 font-bold">★ {product.rating}</span>
                  </div>

                  <div className="flex items-center justify-between mt-3 pt-1.5 border-t border-slate-50">
                    <div className="flex flex-col">
                      <span className="text-[11px] font-black text-slate-900">₹{product.price}</span>
                      {product.originalPrice && (
                        <span className="text-[8.5px] line-through text-slate-300 font-bold">-₹{product.originalPrice}</span>
                      )}
                    </div>
                    <button
                      onClick={() => handleAddWithFeedback(product.id, product.name, product.price, product.emoji)}
                      className={`w-6.5 h-6.5 rounded-full flex items-center justify-center transition-all border-none cursor-pointer ${
                        isAdded ? 'bg-emerald-500 text-white' : 'bg-slate-900 text-white'
                      }`}
                    >
                      {isAdded ? <Check size={10} strokeWidth={3} /> : <Plus size={10} strokeWidth={3} />}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 3: HISTORY (ACTIVE ORDERS & CONSULTATIONS TRACKER) */}
      {activeTab === 'History' && (
        <div className="p-5 space-y-4 flex-1 pb-10">
          <div className="border-b border-slate-100 pb-3">
            <h3 className="text-xs font-black uppercase tracking-widest text-[#FF7A59] flex items-center gap-2">
              <ClipboardList size={14} />
              Healthcare History & Active Orders
            </h3>
            <p className="text-[10px] text-slate-400 font-bold mt-0.5">
              Review placed medicine delivery states and registered medical assessment logs.
            </p>
          </div>

          {/* Placed Medicine Orders */}
          <div className="space-y-3">
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">
              Active Medicine Deliveries
            </span>

            {activeOrders.map((ord) => (
              <div key={ord.id} className="bg-white p-4 rounded-2xl border border-slate-100 shadow-xs space-y-2">
                <div className="flex justify-between items-center text-[10px]">
                  <span className="font-black text-[#FF7A59]">{ord.id}</span>
                  <span className="text-slate-400 font-bold">{ord.date}</span>
                </div>
                <div className="flex justify-between items-end">
                  <div>
                    <h4 className="text-[11px] font-black text-slate-900 leading-tight">{ord.items}</h4>
                    <span className="text-[9.5px] text-emerald-600 font-black flex items-center gap-1 mt-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      {ord.status}
                    </span>
                  </div>
                  <span className="text-xs font-black text-slate-800">₹{ord.total}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Scheduled consultations list */}
          <div className="space-y-3 pt-2">
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">
              Scheduled Doctor Consultations
            </span>

            {consultationsList.length === 0 ? (
              <div className="text-center py-8 bg-white rounded-2xl border border-slate-100 p-5">
                <span className="text-2xl">🗓️</span>
                <p className="text-[9.5px] text-slate-400 font-bold mt-1.5">No registered scheduled consultations.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {consultationsList.map((con) => (
                  <div key={con.id} className="bg-white p-4 rounded-2xl border border-slate-100 shadow-xs space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider">{con.type}</span>
                      <span className={`px-2 py-0.5 text-[8.5px] font-black rounded-full ${
                        con.status === 'Upcoming' ? 'bg-amber-50 text-amber-600 border border-amber-100' : 'bg-slate-50 text-slate-400'
                      }`}>
                        {con.status}
                      </span>
                    </div>

                    <div className="flex justify-between items-center">
                      <div>
                        <h4 className="text-[11px] font-black text-slate-900">{con.doctor}</h4>
                        <div className="flex items-center gap-2 mt-1 text-[9px] text-slate-400 font-bold">
                          <span className="flex items-center gap-0.5"><Calendar size={9} /> {con.date}</span>
                          <span className="flex items-center gap-0.5"><Clock size={9} /> {con.time}</span>
                        </div>
                      </div>
                    </div>

                    <div className="p-2.5 bg-slate-50 rounded-xl text-[9px] leading-relaxed text-slate-500 font-bold">
                      <span className="text-slate-400 font-black block uppercase text-[7.5px] mb-0.5">DOCTOR'S DIRECTIVE / DIRECT LINK</span>
                      {con.recommendations}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      )}



    </div>
  );
}
