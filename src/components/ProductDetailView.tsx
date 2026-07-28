import React, { useState } from 'react';
import { 
  X, 
  Heart, 
  Star, 
  ShieldCheck, 
  Truck, 
  ThumbsUp, 
  Plus, 
  Minus, 
  Check, 
  Info, 
  RotateCcw,
  Share2
} from 'lucide-react';
import { Product, Review } from '../types';

interface ProductDetailViewProps {
  product: Product;
  onClose: () => void;
  addToCart: (id: string, name: string, price: number, emoji: string) => void;
  cartItems: { id: string; name: string; price: number; quantity: number; emoji: string }[];
  updateCartQuantity: (id: string, delta: number) => void;
  favorites?: string[];
  toggleFavorite?: (productId: string) => void;
}

// Simple deterministic generator for high-quality, authentic specs and reviews based on product properties
function getEnhancedProductDetails(item: Product) {
  const isFood = item.app === 'FOOD' || item.id.startsWith('cat-fm') || item.id.startsWith('cat-fs') || item.id.startsWith('cat-fd') || item.id.startsWith('tow');
  const isMart = item.app === 'MART' || item.id.startsWith('cat-mt') || item.id.startsWith('cat-mf') || item.id.startsWith('cat-ml');
  const isGrocery = item.app === 'GROCERY' || item.id.startsWith('cat-gg') || item.id.startsWith('cat-gs') || item.id.startsWith('cat-gd') || item.id.startsWith('gr-');
  const isPharma = item.app === 'PHARMA' || item.id.startsWith('cat-pw') || item.id.startsWith('cat-ps') || item.id.startsWith('cat-pb') || item.id.startsWith('ph-');

  let detectedApp: 'FOOD' | 'MART' | 'GROCERY' | 'PHARMA' = 'MART';
  if (isFood) detectedApp = 'FOOD';
  else if (isGrocery) detectedApp = 'GROCERY';
  else if (isPharma) detectedApp = 'PHARMA';

  // Customized Specifications
  let specs: { label: string; value: string }[] = [];
  if (detectedApp === 'FOOD') {
    specs = [
      { label: 'Prep Time', value: '15-20 Mins' },
      { label: 'Dietary', value: item.name.toLowerCase().includes('chicken') || item.name.toLowerCase().includes('mutton') ? 'Non-Veg' : '100% Vegetarian' },
      { label: 'Serving Size', value: 'Ideal for 1-2' },
      { label: 'Spiciness', value: item.name.toLowerCase().includes('spicy') || item.name.toLowerCase().includes('sriracha') ? '🔥 High' : 'Medium' }
    ];
  } else if (detectedApp === 'MART') {
    specs = [
      { label: 'Warranty', value: '1 Year Brand Warranty' },
      { label: 'Return Policy', value: '7 Days Replacement' },
      { label: 'Shipping', value: 'Same Day Delivery' },
      { label: 'Condition', value: '100% Genuine Sealed' }
    ];
  } else if (detectedApp === 'GROCERY') {
    specs = [
      { label: 'Shelf Life', value: 'Fresh (2-5 Days)' },
      { label: 'Source', value: 'Hydroponic Local Farm' },
      { label: 'Organic', value: 'Yes, certified organic' },
      { label: 'Storage', value: 'Keep refrigerated' }
    ];
  } else {
    specs = [
      { label: 'Dosage Form', value: item.name.toLowerCase().includes('gummies') ? 'Gummy Chews' : 'Standard Formula' },
      { label: 'Prescription', value: 'Not Required' },
      { label: 'Pack Size', value: 'Standard Consumer Pack' },
      { label: 'Safety', value: 'FDA compliant, certified' }
    ];
  }

  // Authentic reviews list
  let reviews: Review[] = [];
  if (detectedApp === 'FOOD') {
    reviews = [
      {
        id: 'rev-f1',
        user: 'Aarav Sharma',
        rating: 5,
        comment: 'Absolutely mouthwatering! Arrived piping hot, packaging was pristine. Definitely ordering again.',
        date: 'Today',
        avatar: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&q=80&w=100&h=100'
      },
      {
        id: 'rev-f2',
        user: 'Priya Patel',
        rating: 4,
        comment: 'Excellent flavor and rich taste. Portion size was very generous. Slightly spicy but incredible.',
        date: 'Yesterday',
        avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&q=80&w=100&h=100'
      },
      {
        id: 'rev-f3',
        user: 'Vikram Singh',
        rating: 5,
        comment: 'Best in class! Fresh ingredients, authentic taste. Highly recommended to everyone.',
        date: '3 days ago',
        avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=100&h=100'
      }
    ];
  } else if (detectedApp === 'MART') {
    reviews = [
      {
        id: 'rev-m1',
        user: 'Rohan Mehra',
        rating: 5,
        comment: 'Premium build quality. Exceeded expectations! Sleek design and works flawlessly.',
        date: 'Yesterday',
        avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&q=80&w=100&h=100'
      },
      {
        id: 'rev-m2',
        user: 'Ananya Rao',
        rating: 5,
        comment: 'Super fast delivery by Faazio. Item looks beautiful, absolute value for money.',
        date: '2 days ago',
        avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&q=80&w=100&h=100'
      },
      {
        id: 'rev-m3',
        user: 'Kunal Kapoor',
        rating: 4,
        comment: 'Great product, matches descriptions exactly. Setup was smooth and seamless.',
        date: '1 week ago',
        avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&q=80&w=100&h=100'
      }
    ];
  } else if (detectedApp === 'GROCERY') {
    reviews = [
      {
        id: 'rev-g1',
        user: 'Meera Nair',
        rating: 5,
        comment: 'Unbelievably fresh, looks like it was harvested this morning. Will buy weekly!',
        date: 'Today',
        avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&q=80&w=100&h=100'
      },
      {
        id: 'rev-g2',
        user: 'Arjun Verma',
        rating: 5,
        comment: 'Premium quality produce. Safely packed and prompt delivery inside 15 minutes!',
        date: 'Yesterday',
        avatar: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&q=80&w=100&h=100'
      }
    ];
  } else {
    reviews = [
      {
        id: 'rev-p1',
        user: 'Dr. Sarah Alvi',
        rating: 5,
        comment: 'Excellent formula. Highly effective with very safe clinical benchmarks. Recommended.',
        date: 'Yesterday',
        avatar: 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?auto=format&fit=crop&q=80&w=100&h=100'
      },
      {
        id: 'rev-p2',
        user: 'Rajesh G.',
        rating: 5,
        comment: 'Great packaging and genuine seal. Very convenient to order via Faazio Pharma.',
        date: '4 days ago',
        avatar: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&q=80&w=100&h=100'
      }
    ];
  }

  // Sourced Highlights for Amazon/Flipkart experience
  let highlights: string[] = [];
  if (detectedApp === 'FOOD') {
    highlights = [
      'Freshly prepared on order by vetted gourmet chefs',
      'Hygiene-rated Grade A kitchen preparation standards',
      'Insulated thermal-bag delivery to retain kitchen-hot state',
      'No added preservatives, MSG, or artificial coloring agents'
    ];
  } else if (detectedApp === 'MART') {
    highlights = [
      '100% original manufacturer seal & retail carton',
      'Eligible for brand warranty assistance & registration',
      'Secured transit insurance protection from warehouse to doorstep',
      'Verified zero-defect QC pass checklist certified'
    ];
  } else if (detectedApp === 'GROCERY') {
    highlights = [
      'Ethically sourced from local pesticide-free farms',
      'Chilled-crate supply chain preserving maximum nutrient density',
      'Eco-friendly biodegradable and breathable paper pack bag',
      'Rigorous triple-wash hygiene checklist compliance'
    ];
  } else {
    highlights = [
      'Double-sealed pharmaceutical integrity packing standard',
      'Vetted storage under temperature-regulated environment',
      'Sourced exclusively from WHO-GMP certified clinical partners',
      'Complimentary consultation assistance on dosage from specialists'
    ];
  }

  return { specs, reviews, highlights, app: detectedApp };
}

export default function ProductDetailView({ 
  product, 
  onClose, 
  addToCart, 
  cartItems, 
  updateCartQuantity,
  favorites = [],
  toggleFavorite
}: ProductDetailViewProps) {
  const isFavorite = favorites.includes(product.id);
  const handleToggleFavorite = () => {
    if (toggleFavorite) {
      toggleFavorite(product.id);
    }
  };
  const [helpfulCounts, setHelpfulCounts] = useState<{ [key: string]: number }>({});
  const [likedReviews, setLikedReviews] = useState<{ [key: string]: boolean }>({});

  const { specs, reviews, highlights, app } = getEnhancedProductDetails(product);

  const cartItem = cartItems.find(item => item.id === product.id);
  const currentQuantity = cartItem ? cartItem.quantity : 0;

  // App branding color helpers
  const brandStyles = {
    FOOD: {
      accent: 'bg-[#1E5D44] text-[#1E5D44]',
      bgGradient: 'from-emerald-500/10 via-emerald-50/10 to-white',
      badgeBg: 'bg-emerald-50 text-emerald-700 border-emerald-100',
      btnBg: 'bg-[#1E5D44] hover:bg-[#154230]'
    },
    MART: {
      accent: 'bg-[#1162D3] text-[#1162D3]',
      bgGradient: 'from-blue-500/10 via-blue-50/10 to-white',
      badgeBg: 'bg-blue-50 text-blue-700 border-blue-100',
      btnBg: 'bg-[#1162D3] hover:bg-blue-800'
    },
    GROCERY: {
      accent: 'bg-[#10B981] text-[#10B981]',
      bgGradient: 'from-green-500/10 via-green-50/10 to-white',
      badgeBg: 'bg-green-50 text-green-700 border-green-100',
      btnBg: 'bg-[#10B981] hover:bg-emerald-600'
    },
    PHARMA: {
      accent: 'bg-[#065F46] text-[#065F46]',
      bgGradient: 'from-teal-500/10 via-teal-50/10 to-white',
      badgeBg: 'bg-teal-50 text-teal-700 border-teal-100',
      btnBg: 'bg-[#065F46] hover:bg-teal-850'
    }
  }[app];

  const handleHelpfulToggle = (reviewId: string) => {
    if (likedReviews[reviewId]) {
      setHelpfulCounts(prev => ({ ...prev, [reviewId]: (prev[reviewId] || 0) - 1 }));
      setLikedReviews(prev => ({ ...prev, [reviewId]: false }));
    } else {
      setHelpfulCounts(prev => ({ ...prev, [reviewId]: (prev[reviewId] || 0) + 1 }));
      setLikedReviews(prev => ({ ...prev, [reviewId]: true }));
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-50 flex items-end justify-center select-none">
      {/* Sliding Dialog Sheet */}
      <div className="bg-slate-50 w-full max-w-md h-[90vh] rounded-t-[36px] overflow-hidden flex flex-col shadow-2xl border-t border-white/20 animate-slide-up">
        
        {/* Floating Top Nav Bar inside Detail panel */}
        <div className="absolute top-4 left-4 right-4 flex items-center justify-between z-10">
          <button 
            type="button"
            onClick={onClose}
            className="w-12 h-12 min-w-[48px] min-h-[48px] rounded-full bg-white/90 backdrop-blur-xs flex items-center justify-center text-slate-800 hover:bg-white active:scale-90 transition-all border-none shadow-md cursor-pointer"
            title="Close (48x48dp Touch Target)"
          >
            <X size={20} className="stroke-[2.5]" />
          </button>
          
          <div className="flex items-center gap-2">
            <button 
              type="button"
              className="w-12 h-12 min-w-[48px] min-h-[48px] rounded-full bg-white/90 backdrop-blur-xs flex items-center justify-center text-slate-500 hover:text-slate-800 active:scale-90 transition-all border-none shadow-md cursor-pointer"
              title="Share (48x48dp Touch Target)"
            >
              <Share2 size={18} />
            </button>
            <button 
              type="button"
              onClick={handleToggleFavorite}
              className="w-10 h-10 rounded-full bg-white/90 backdrop-blur-xs flex items-center justify-center text-slate-800 active:scale-90 transition-all border-none shadow-md cursor-pointer"
            >
              <Heart 
                size={18} 
                className={`transition-all ${isFavorite ? 'fill-rose-500 text-rose-500 scale-110' : 'text-slate-700'}`} 
              />
            </button>
          </div>
        </div>

        {/* Scrollable Container */}
        <div className="flex-1 overflow-y-auto pb-24 scrollbar-none">
          {/* Dynamic Hero Gradient Display */}
          <div className={`h-64 bg-gradient-to-b ${brandStyles.bgGradient} flex items-center justify-center relative border-b border-slate-100`}>
            <div className="w-40 h-40 rounded-full bg-white/90 flex items-center justify-center shadow-xl border border-white relative group">
              <span className="text-6.5xl group-hover:scale-110 transition-transform duration-300 select-none">
                {product.emoji}
              </span>
              
              {/* Extra badges */}
              <span className="absolute bottom-1 right-1 bg-amber-500 text-white text-[8px] font-black px-2 py-0.5 rounded-full shadow-xs">
                ★ {product.rating}
              </span>
            </div>

            {/* Quick delivery tag */}
            <div className="absolute bottom-3 left-4 flex items-center gap-1.5 bg-slate-900/90 backdrop-blur-xs text-[8px] font-black text-white py-1 px-2.5 rounded-full shadow-xs uppercase tracking-wider">
              <Truck size={10} className="text-[#7CE045]" />
              <span>DELIVERS IN 12-15 MINS</span>
            </div>
          </div>

          {/* Product Header details */}
          <div className="p-5 bg-white space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className={`text-[8px] font-black px-2 py-0.5 rounded-md border uppercase tracking-wider ${brandStyles.badgeBg}`}>
                    {app}
                  </span>
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                    {product.catName || product.category || 'Premium Pick'}
                  </span>
                </div>
                <h2 className="text-xl font-black text-slate-950 leading-tight">
                  {product.name}
                </h2>
              </div>
              
              <div className="text-right">
                <div className="text-2xl font-black text-slate-950 leading-none">
                  ₹{product.price.toLocaleString('en-IN')}
                </div>
                <div className="text-[8px] font-black text-[#56B821] uppercase tracking-wider mt-1">
                  Incl. of all taxes
                </div>
              </div>
            </div>

            <p className="text-[11px] text-slate-500 font-semibold leading-relaxed">
              {product.desc}
            </p>

            {/* Amazon / Flipkart Style Key Highlights & Promos */}
            <div className="space-y-3.5 pt-3 border-t border-slate-100">
              <h5 className="text-[9.5px] font-black text-slate-900 uppercase tracking-wider">Key Highlights</h5>
              <ul className="space-y-2 m-0 p-0 list-none">
                {highlights.map((hlt, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-[10px] text-slate-600 font-semibold leading-relaxed">
                    <Check size={11} className="text-emerald-600 shrink-0 mt-0.5 stroke-[3.5]" />
                    <span>{hlt}</span>
                  </li>
                ))}
              </ul>

              {/* Special Dynamic Promo Banner */}
              <div className="p-3 bg-amber-50/60 rounded-xl border border-amber-100/50 flex items-start gap-2.5">
                <span className="text-sm shrink-0">🏷️</span>
                <div className="space-y-0.5">
                  <div className="text-[9px] font-black text-slate-800 uppercase tracking-wider">EXCLUSIVE BANK OFFER</div>
                  <div className="text-[8.5px] text-slate-500 font-bold leading-snug">
                    Get extra 10% cashback up to ₹250 on UPI or OneCard payments. Auto-applied during checkout!
                  </div>
                </div>
              </div>
            </div>

            {/* Micro guarantee banners */}
            <div className="grid grid-cols-2 gap-2.5 pt-1.5">
              <div className="flex items-center gap-2 bg-slate-50/70 p-2.5 rounded-xl border border-slate-100/60">
                <ShieldCheck size={14} className="text-emerald-600 shrink-0" />
                <div className="min-w-0">
                  <div className="text-[9px] font-black text-slate-800">Quality Verified</div>
                  <div className="text-[7.5px] text-slate-400 font-bold">100% genuine product</div>
                </div>
              </div>
              <div className="flex items-center gap-2 bg-slate-50/70 p-2.5 rounded-xl border border-slate-100/60">
                <RotateCcw size={14} className="text-blue-600 shrink-0" />
                <div className="min-w-0">
                  <div className="text-[9px] font-black text-slate-800">Hassle-Free Returns</div>
                  <div className="text-[7.5px] text-slate-400 font-bold">Complimentary replacement</div>
                </div>
              </div>
            </div>
          </div>

          {/* Core Specifications */}
          <div className="p-5 mt-2 bg-white border-y border-slate-100">
            <h4 className="text-[9.5px] font-black text-slate-900 uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <Info size={11} className="text-slate-400" />
              Product Specifications
            </h4>
            <div className="grid grid-cols-2 gap-3">
              {specs.map((spec, idx) => (
                <div key={idx} className="bg-slate-50 border border-slate-100/80 p-2.5 rounded-xl flex flex-col gap-0.5">
                  <span className="text-[7.5px] font-bold text-slate-400 uppercase tracking-wider">{spec.label}</span>
                  <span className="text-[10px] font-black text-slate-800">{spec.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Verified Product Reviews */}
          <div className="p-5 mt-2 bg-white border-t border-slate-100">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-[9.5px] font-black text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                <Star size={11} className="text-amber-500 fill-amber-500" />
                Customer Reviews ({reviews.length})
              </h4>
              <span className="text-[10px] font-black text-slate-800 bg-amber-50 border border-amber-100/50 px-2 py-0.5 rounded-lg">
                ★ {product.rating} Average
              </span>
            </div>

            {/* Visual Bar breakdown */}
            <div className="bg-slate-50 border border-slate-100/80 p-3.5 rounded-2xl mb-4 space-y-1.5">
              <div className="flex items-center gap-2 text-[8.5px] font-black text-slate-600">
                <span className="w-8 shrink-0">5 Star</span>
                <div className="flex-1 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                  <div className="h-full bg-amber-500 rounded-full" style={{ width: '88%' }} />
                </div>
                <span className="w-6 text-right">88%</span>
              </div>
              <div className="flex items-center gap-2 text-[8.5px] font-black text-slate-600">
                <span className="w-8 shrink-0">4 Star</span>
                <div className="flex-1 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                  <div className="h-full bg-amber-500 rounded-full" style={{ width: '10%' }} />
                </div>
                <span className="w-6 text-right">10%</span>
              </div>
              <div className="flex items-center gap-2 text-[8.5px] font-black text-slate-600">
                <span className="w-8 shrink-0">3 Star</span>
                <div className="flex-1 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                  <div className="h-full bg-amber-500 rounded-full" style={{ width: '2%' }} />
                </div>
                <span className="w-6 text-right">2%</span>
              </div>
            </div>

            {/* Individual Reviews */}
            <div className="divide-y divide-slate-100">
              {reviews.map(rev => (
                <div key={rev.id} className="py-3.5 first:pt-0 last:pb-0 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <img 
                        src={rev.avatar} 
                        alt={rev.user} 
                        className="w-7 h-7 rounded-full object-cover border border-slate-100"
                        referrerPolicy="no-referrer"
                      />
                      <div>
                        <div className="text-[10px] font-black text-slate-800 leading-none">{rev.user}</div>
                        <div className="text-[7.5px] text-slate-400 font-bold mt-1">{rev.date}</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-0.5">
                      {[...Array(5)].map((_, i) => (
                        <Star 
                          key={i} 
                          size={8.5} 
                          className={i < rev.rating ? 'text-amber-500 fill-amber-500' : 'text-slate-200'} 
                        />
                      ))}
                    </div>
                  </div>

                  <p className="text-[9.5px] text-slate-500 font-semibold leading-relaxed pl-9">
                    "{rev.comment}"
                  </p>

                  <div className="pl-9 flex items-center justify-between">
                    <button 
                      type="button"
                      onClick={() => handleHelpfulToggle(rev.id)}
                      className={`flex items-center gap-1.5 text-[8px] font-black border-none cursor-pointer p-1 rounded-md transition-colors ${
                        likedReviews[rev.id] 
                          ? 'text-emerald-600 bg-emerald-50' 
                          : 'text-slate-400 hover:text-slate-600 bg-transparent'
                      }`}
                    >
                      <ThumbsUp size={10} className={likedReviews[rev.id] ? 'fill-emerald-600' : ''} />
                      <span>Helpful ({12 + (helpfulCounts[rev.id] || 0)})</span>
                    </button>
                    
                    <span className="text-[7.5px] font-bold text-slate-400 flex items-center gap-1">
                      <ShieldCheck size={9} className="text-emerald-500" />
                      Verified Purchase
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Premium Sticky Action Footer Panel */}
        <div className="absolute bottom-0 left-0 right-0 h-20 bg-white border-t border-slate-100 px-5 flex items-center justify-between shadow-2xl z-20">
          <div>
            <span className="text-[8px] font-black text-slate-400 uppercase tracking-wider block">Total Price</span>
            <span className="text-xl font-black text-slate-950 leading-tight">
              ₹{(product.price * (currentQuantity || 1)).toLocaleString('en-IN')}
            </span>
          </div>

          {currentQuantity === 0 ? (
            <button
              type="button"
              onClick={() => addToCart(product.id, product.name, product.price, product.emoji)}
              className={`h-11 px-6 ${brandStyles.btnBg} text-white text-[11px] font-black uppercase tracking-wider rounded-2xl flex items-center gap-1.5 shadow-md active:scale-95 transition-all border-none cursor-pointer`}
            >
              <Plus size={12} className="stroke-[2.5]" />
              <span>Add to Bag</span>
            </button>
          ) : (
            <div className="flex items-center gap-3 bg-slate-100 border border-slate-200/50 p-1.5 rounded-2xl">
              <button
                type="button"
                onClick={() => updateCartQuantity(product.id, -1)}
                className="w-8 h-8 rounded-xl hover:bg-slate-200 active:scale-90 flex items-center justify-center text-slate-800 font-extrabold transition-colors border-none bg-transparent cursor-pointer"
              >
                <Minus size={14} className="stroke-[3]" />
              </button>
              
              <span className="text-xs font-black text-slate-900 min-w-[20px] text-center">
                {currentQuantity}
              </span>

              <button
                type="button"
                onClick={() => updateCartQuantity(product.id, 1)}
                className="w-8 h-8 rounded-xl hover:bg-slate-200 active:scale-90 flex items-center justify-center text-slate-800 font-extrabold transition-colors border-none bg-transparent cursor-pointer"
              >
                <Plus size={14} className="stroke-[3]" />
              </button>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
