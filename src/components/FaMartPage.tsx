import React, { useState, useEffect } from 'react';
import { 
  Shirt, 
  Smartphone, 
  Sparkles, 
  Laptop, 
  Gamepad, 
  Trophy, 
  Tv, 
  Star, 
  ShoppingCart, 
  ArrowRight,
  TrendingUp,
  Percent,
  CheckCircle,
  ShoppingBag,
  BookOpen,
  Gift,
  Armchair,
  Store,
  MapPin,
  Clock,
  ArrowLeft,
  ChevronRight,
  ShieldCheck,
  Timer
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { martProducts, martStores, StoreProfile } from '../data/mockProducts';

interface FaMartPageProps {
  addToCart: (id: string, name: string, price: number, emoji: string) => void;
  onProductClick?: (product: any) => void;
}

export default function FaMartPage({ addToCart, onProductClick }: FaMartPageProps) {
  const [selectedSubCat, setSelectedSubCat] = useState<string>('All');
  const [activeBanner, setActiveBanner] = useState<number>(0);
  const [addedAnimationId, setAddedAnimationId] = useState<string | null>(null);
  const [selectedStore, setSelectedStore] = useState<StoreProfile | null>(null);

  // Live countdown ticker for limited-time offers
  const [timeLeft, setTimeLeft] = useState({ hours: 2, minutes: 14, seconds: 45 });
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev.seconds > 0) return { ...prev, seconds: prev.seconds - 1 };
        if (prev.minutes > 0) return { ...prev, minutes: 59, seconds: 59 };
        if (prev.hours > 0) return { hours: prev.hours - 1, minutes: 59, seconds: 59 };
        return { hours: 2, minutes: 14, seconds: 45 };
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formattedTime = `${String(timeLeft.hours).padStart(2, '0')}h : ${String(timeLeft.minutes).padStart(2, '0')}m : ${String(timeLeft.seconds).padStart(2, '0')}s`;

  const banners = [
    {
      title: "Electronic Bonanza Sale",
      subtitle: "UP TO 50% OFF",
      desc: "Top deals on audio & smartphones with premium glass screens",
      image: "https://images.unsplash.com/photo-1550009158-9ebf69173e03?auto=format&fit=crop&q=80&w=600&h=300",
      bgGradient: "from-blue-950/95 via-blue-900/85 to-transparent",
      accent: "#1162D3",
      category: "Mobile & Electronics"
    },
    {
      title: "Great Winter Collection",
      subtitle: "FLAT 40% OFF",
      desc: "Chic luxury fashion curated for modern premium street style",
      image: "https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&q=80&w=600&h=300",
      bgGradient: "from-purple-950/95 via-purple-900/85 to-transparent",
      accent: "#E040FB",
      category: "Fashion"
    },
    {
      title: "Smart Home Revolution",
      subtitle: "NEW LAUNCH DEALS",
      desc: "Upgrade your living space with robotic purifiers and ergonomic desks",
      image: "https://images.unsplash.com/photo-1556911220-e15b29be8c8f?auto=format&fit=crop&q=80&w=600&h=300",
      bgGradient: "from-emerald-950/95 via-emerald-900/85 to-transparent",
      accent: "#10B981",
      category: "Home Appliances"
    }
  ];

  // Restructured category chips: overlapping consolidated, essential sectors added
  const subCategories = [
    { name: 'All', icon: ShoppingBag, color: 'text-slate-600', bg: 'bg-slate-100' },
    { name: 'Mobile & Electronics', icon: Smartphone, color: 'text-blue-500', bg: 'bg-blue-50' },
    { name: 'Fashion', icon: Shirt, color: 'text-rose-500', bg: 'bg-rose-50' },
    { name: 'Beauty', icon: Sparkles, color: 'text-amber-500', bg: 'bg-amber-50' },
    { name: 'Toys & Gifts', icon: Gift, color: 'text-purple-500', bg: 'bg-purple-50' },
    { name: 'Books & Stationery', icon: BookOpen, color: 'text-emerald-500', bg: 'bg-emerald-50' },
    { name: 'Home Appliances', icon: Tv, color: 'text-indigo-500', bg: 'bg-indigo-50' },
    { name: 'Furniture', icon: Armchair, color: 'text-stone-600', bg: 'bg-stone-100' },
    { name: 'Sports', icon: Trophy, color: 'text-orange-500', bg: 'bg-orange-50' },
  ];

  const products = martProducts;

  const matchCategory = (prodCat: string, targetCat: string) => {
    if (targetCat === 'All') return true;
    if (targetCat === 'Mobile & Electronics') {
      return prodCat === 'Mobiles' || prodCat === 'Electronics' || prodCat === 'Devices' || prodCat === 'Mobile & Electronics';
    }
    if (targetCat === 'Toys & Gifts') {
      return prodCat === 'Toys' || prodCat === 'Gifts' || prodCat === 'Toys & Gifts';
    }
    if (targetCat === 'Books & Stationery') {
      return prodCat === 'Books & Stationery' || prodCat === 'Books' || prodCat === 'Stationery';
    }
    if (targetCat === 'Home Appliances') {
      return prodCat === 'Home Appliances' || prodCat === 'Appliances';
    }
    return prodCat === targetCat;
  };

  const filteredProducts = products.filter(p => matchCategory(p.category, selectedSubCat));

  const filteredStores = selectedSubCat === 'All'
    ? martStores
    : martStores.filter(s => s.categories.some(c => matchCategory(c, selectedSubCat) || c === selectedSubCat));

  const handleAddWithFeedback = (id: string, name: string, price: number, emoji: string) => {
    addToCart(id, name, price, emoji);
    setAddedAnimationId(id);
    setTimeout(() => {
      setAddedAnimationId(null);
    }, 1500);
  };

  // If a store is selected, show Store Profile & Product Catalog
  if (selectedStore) {
    const storeProducts = products.filter(p => 
      p.shop === selectedStore.name || 
      selectedStore.categories.some(c => matchCategory(p.category, c))
    );
    const displayProducts = storeProducts.length > 0 ? storeProducts : products.slice(0, 6);

    return (
      <div className="space-y-4 animate-fade-in pb-8">
        {/* Top Back Navigation */}
        <div className="flex items-center justify-between px-1">
          <button
            onClick={() => setSelectedStore(null)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-black text-xs rounded-xl border-none cursor-pointer transition-all"
          >
            <ArrowLeft size={14} />
            <span>Back to {selectedSubCat === 'All' ? 'Stores' : selectedSubCat}</span>
          </button>
          <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-lg flex items-center gap-1">
            <ShieldCheck size={12} />
            Verified Partner
          </span>
        </div>

        {/* Store Profile Hero Banner */}
        <div className="relative rounded-[24px] overflow-hidden bg-white border border-slate-100 shadow-md">
          <div className="h-[140px] w-full relative overflow-hidden bg-slate-900">
            <img 
              src={selectedStore.coverImage} 
              alt={selectedStore.name}
              className="w-full h-full object-cover opacity-80"
              referrerPolicy="no-referrer"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-900/40 to-transparent" />
            <div className="absolute top-3 right-3 bg-white/90 backdrop-blur-md text-slate-900 px-2.5 py-1 rounded-full text-[10px] font-black flex items-center gap-1 shadow-sm">
              <Star size={11} className="text-amber-500 fill-amber-500" />
              <span>{selectedStore.rating}</span>
              <span className="text-slate-400">({selectedStore.reviewsCount || 500}+)</span>
            </div>
          </div>
          <div className="p-4 pt-0 relative flex flex-col justify-between -mt-6">
            <div className="flex items-end justify-between">
              <div className="w-14 h-14 rounded-2xl bg-white border-2 border-white shadow-lg flex items-center justify-center text-2xl z-10">
                {selectedStore.emoji}
              </div>
              {selectedStore.offerTag && (
                <div className="bg-rose-50 text-rose-600 border border-rose-200/60 px-3 py-1 rounded-xl text-[10px] font-black tracking-tight animate-pulse shadow-sm">
                  🔥 {selectedStore.offerTag}
                </div>
              )}
            </div>
            <div className="mt-2.5">
              <h3 className="text-base font-black text-slate-900 leading-tight">{selectedStore.name}</h3>
              <p className="text-[11px] text-slate-500 font-medium mt-0.5 leading-snug">{selectedStore.desc}</p>
              <div className="flex flex-wrap items-center gap-3 mt-2 pt-2 border-t border-slate-100 text-[10px] font-bold text-slate-600">
                <span className="flex items-center gap-1">
                  <Clock size={12} className="text-blue-500" />
                  {selectedStore.deliveryTime} delivery
                </span>
                <span className="flex items-center gap-1">
                  <MapPin size={12} className="text-rose-500" />
                  {selectedStore.distance} away
                </span>
                <span className="text-slate-400">|</span>
                <span className="text-slate-500">{selectedStore.categories.join(' • ')}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Store Catalog Header */}
        <div className="flex items-center justify-between px-1 pt-2">
          <div>
            <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
              <Store size={14} className="text-[#1162D3]" />
              Store Product Catalog
            </h4>
            <p className="text-[9px] text-slate-400 font-bold mt-0.5">{displayProducts.length} items available in store</p>
          </div>
          <span className="text-[9.5px] font-black text-blue-600 bg-blue-50 px-2.5 py-1 rounded-lg">Instant Delivery</span>
        </div>

        {/* Store Catalog Grid */}
        <div className="grid grid-cols-2 gap-3">
          {displayProducts.map((product) => {
            const isAnimating = addedAnimationId === product.id;
            return (
              <div 
                key={product.id}
                className="bg-white rounded-[24px] border border-slate-100/80 shadow-[0_4px_16px_rgba(0,0,0,0.02)] hover:shadow-[0_8px_24px_rgba(0,0,0,0.06)] transition-all duration-300 flex flex-col justify-between overflow-hidden relative group"
              >
                <div 
                  onClick={() => onProductClick && onProductClick({ ...product, app: 'MART', shop: selectedStore.name })}
                  className="aspect-square w-full bg-slate-50 relative overflow-hidden shrink-0 cursor-pointer"
                >
                  <img 
                    src={product.image} 
                    alt={product.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    referrerPolicy="no-referrer"
                  />
                  <span className={`absolute top-2 left-2 text-[8px] font-black px-2 py-0.5 rounded-md text-white uppercase tracking-wider ${product.badgeBg || 'bg-[#1162D3]'} shadow-sm`}>
                    {product.badge || 'Store Deal'}
                  </span>
                </div>

                <div className="p-3 flex flex-col justify-between flex-1">
                  <div>
                    <div className="flex items-center gap-1">
                      <span className="text-[8px] font-black text-slate-400 bg-slate-50 border border-slate-100 px-1 rounded uppercase tracking-wide">
                        {product.category}
                      </span>
                      <span className="text-[8.5px] font-black text-amber-500 flex items-center">
                        ★ {product.rating}
                      </span>
                    </div>
                    <h5 
                      onClick={() => onProductClick && onProductClick({ ...product, app: 'MART', shop: selectedStore.name })}
                      className="text-[11px] font-black text-slate-900 mt-1 line-clamp-1 leading-tight group-hover:text-blue-600 cursor-pointer transition-colors"
                    >
                      {product.name}
                    </h5>
                    <p className="text-[9px] text-slate-400 font-medium mt-0.5 line-clamp-2 leading-tight">
                      {product.desc}
                    </p>
                  </div>

                  <div className="flex items-center justify-between mt-3 pt-2 border-t border-slate-50">
                    <div className="flex flex-col">
                      <span className="text-xs font-black text-slate-900">${product.price.toFixed(2)}</span>
                      <span className="text-[7.5px] font-bold text-slate-400 line-through">${(product.price * 1.3).toFixed(2)}</span>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleAddWithFeedback(product.id, product.name, product.price, product.emoji)}
                      className={`h-7 px-3 text-[9px] font-black rounded-lg uppercase tracking-wider transition-all border-none cursor-pointer flex items-center justify-center gap-1 ${
                        isAnimating 
                          ? 'bg-emerald-500 text-white shadow-[0_2px_8px_rgba(16,185,129,0.3)]'
                          : 'bg-[#1162D3] hover:bg-blue-600 text-white hover:shadow-md active:scale-95'
                      }`}
                    >
                      {isAnimating ? (
                        <>
                          <CheckCircle size={10} className="stroke-[3]" />
                          <span>Added!</span>
                        </>
                      ) : (
                        <>
                          <ShoppingCart size={10} className="stroke-[2.5]" />
                          <span>Add</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // Determine which banner to show (category specific if category selected)
  const currentBanner = selectedSubCat === 'All' 
    ? banners[activeBanner] 
    : (banners.find(b => b.category === selectedSubCat) || banners[0]);

  return (
    <div className="space-y-4 animate-fade-in pb-8">
      {/* ① Category Chips (Restructured & Consolidated) */}
      <div className="space-y-2">
        <h4 className="text-[11px] font-black text-slate-900 px-1 uppercase tracking-wider">
          Explore Mall Categories
        </h4>
        <div className="flex items-center gap-2 overflow-x-auto pb-1.5 scrollbar-none snap-x px-1">
          {subCategories.map((sub, index) => {
            const isSelected = selectedSubCat === sub.name;
            const Icon = sub.icon;
            return (
              <button
                key={index}
                onClick={() => {
                  setSelectedSubCat(sub.name);
                  setSelectedStore(null);
                }}
                className={`flex items-center gap-2 px-3.5 py-2.5 rounded-2xl snap-start cursor-pointer border transition-all shrink-0 ${
                  isSelected 
                    ? 'bg-[#1162D3] border-[#1162D3] text-white shadow-md scale-105' 
                    : 'bg-white border-slate-100 hover:bg-slate-50 text-slate-700 hover:border-slate-300'
                }`}
              >
                <div className={`w-6 h-6 rounded-lg flex items-center justify-center ${isSelected ? 'bg-white/20' : sub.bg}`}>
                  <Icon size={14} className={isSelected ? 'text-white' : sub.color} />
                </div>
                <span className="text-[10px] font-black tracking-tight">{sub.name}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ② Category-Specific Ad Banner (Positioned BELOW categories) */}
      <div className="relative rounded-[24px] h-[145px] overflow-hidden shadow-lg border border-slate-100">
        <div 
          className="absolute inset-0 bg-cover bg-center transition-all duration-700 ease-in-out"
          style={{ backgroundImage: `url('${currentBanner.image}')` }}
        />
        <div className={`absolute inset-0 bg-gradient-to-r ${currentBanner.bgGradient} pointer-events-none`} />

        <div className="absolute inset-y-0 left-0 pl-6 flex flex-col justify-center max-w-[68%] z-10">
          <div className="flex items-center gap-2">
            <span className="text-[9px] font-black tracking-widest text-emerald-400 uppercase">
              {currentBanner.subtitle}
            </span>
            <span className="bg-rose-500/90 text-white text-[8px] font-black px-2 py-0.5 rounded-full flex items-center gap-1 animate-pulse">
              <Timer size={10} /> {formattedTime}
            </span>
          </div>
          <h3 className="text-sm font-black text-white leading-tight mt-1.5">
            {currentBanner.title}
          </h3>
          <p className="text-[10px] text-slate-200 font-medium mt-1 leading-tight line-clamp-2">
            {currentBanner.desc}
          </p>
          <div className="flex items-center gap-2 mt-2.5">
            <button
              onClick={() => setSelectedSubCat(currentBanner.category)}
              style={{ backgroundColor: currentBanner.accent }}
              className="px-4 py-1.5 text-white font-black text-[9px] rounded-full uppercase tracking-wider shadow-sm hover:brightness-110 active:scale-95 transition-all border-none cursor-pointer"
            >
              Explore {currentBanner.category}
            </button>
            {selectedSubCat === 'All' && (
              <div className="flex gap-1 pl-2">
                {banners.map((_, idx) => (
                  <button
                    key={idx}
                    onClick={() => setActiveBanner(idx)}
                    className={`w-1.5 h-1.5 rounded-full transition-all border-none ${activeBanner === idx ? 'w-3.5 bg-white' : 'bg-white/40'}`}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ③ Trending Deals / Products Strip (Horizontal scroll with Live Countdown Ticker) */}
      <div className="space-y-2 pt-1">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-1.5">
            <TrendingUp size={15} className="text-rose-500" />
            <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider">
              {selectedSubCat === 'All' ? 'Trending Flash Deals' : `${selectedSubCat} Flash Deals`}
            </h4>
          </div>
          <div className="flex items-center gap-1.5 bg-rose-50 border border-rose-200/80 px-2.5 py-1 rounded-xl text-rose-600">
            <Clock size={12} className="animate-spin" style={{ animationDuration: '4s' }} />
            <span className="text-[9.5px] font-black tracking-tight">Ends in {formattedTime}</span>
          </div>
        </div>

        {/* 2-Row / Compact Horizontal Strip */}
        <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-none snap-x px-1">
          {(filteredProducts.length > 0 ? filteredProducts : products).slice(0, 6).map((product) => {
            const isAnimating = addedAnimationId === product.id;
            return (
              <div
                key={product.id}
                className="w-[170px] shrink-0 bg-white rounded-2xl border border-slate-100 p-2.5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between snap-start group"
              >
                <div 
                  onClick={() => onProductClick && onProductClick({ ...product, app: 'MART' })}
                  className="w-full h-28 rounded-xl bg-slate-50 overflow-hidden relative cursor-pointer"
                >
                  <img src={product.image} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform" referrerPolicy="no-referrer" />
                  <span className="absolute top-1.5 left-1.5 bg-rose-600 text-white text-[7.5px] font-black px-1.5 py-0.5 rounded shadow-sm">
                    FLASH SALE
                  </span>
                </div>
                <div className="mt-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[8px] font-bold text-slate-400 uppercase line-clamp-1">{product.category}</span>
                    <span className="text-[8.5px] font-black text-amber-500">★ {product.rating}</span>
                  </div>
                  <h5 
                    onClick={() => onProductClick && onProductClick({ ...product, app: 'MART' })}
                    className="text-[10px] font-black text-slate-800 line-clamp-1 mt-0.5 cursor-pointer hover:text-blue-600"
                  >
                    {product.name}
                  </h5>
                  <div className="flex items-center justify-between mt-2 pt-1.5 border-t border-slate-50">
                    <div>
                      <span className="text-[11px] font-black text-slate-900">${product.price}</span>
                      <span className="text-[7.5px] text-slate-400 line-through ml-1">${(product.price * 1.3).toFixed(0)}</span>
                    </div>
                    <button
                      onClick={() => handleAddWithFeedback(product.id, product.name, product.price, product.emoji)}
                      className={`px-2 py-1 rounded-lg text-[8.5px] font-black uppercase transition-all border-none cursor-pointer flex items-center gap-1 ${
                        isAnimating ? 'bg-emerald-500 text-white' : 'bg-[#1162D3] text-white hover:bg-blue-600'
                      }`}
                    >
                      {isAnimating ? <CheckCircle size={10} /> : '+ Add'}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ④ Vendors Directory ("Shop Name" cards filtered for that category) */}
      <div className="space-y-3 pt-2">
        <div className="flex items-center justify-between px-1">
          <div>
            <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
              <Store size={15} className="text-[#1162D3]" />
              {selectedSubCat === 'All' ? 'Featured Stores & Brands' : `${selectedSubCat} Stores Directory`}
            </h4>
            <p className="text-[9px] text-slate-400 font-bold mt-0.5">
              {selectedSubCat === 'All' ? 'Explore official merchant storefronts directly' : `Tap any store to open its dedicated catalog`}
            </p>
          </div>
          <span className="text-[9.5px] font-black text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md">
            {filteredStores.length} {filteredStores.length === 1 ? 'Store' : 'Stores'}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 px-1">
          {filteredStores.map((store) => (
            <div
              key={store.id}
              onClick={() => setSelectedStore(store)}
              className="bg-white rounded-[20px] border border-slate-100 p-3 shadow-sm hover:shadow-md hover:border-blue-200 transition-all cursor-pointer group flex items-center gap-3 relative overflow-hidden"
            >
              <div className="w-16 h-16 rounded-2xl bg-slate-100 overflow-hidden shrink-0 relative">
                <img src={store.coverImage} alt={store.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" referrerPolicy="no-referrer" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex items-end justify-center pb-1">
                  <span className="text-base">{store.emoji}</span>
                </div>
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <h5 className="text-xs font-black text-slate-900 truncate group-hover:text-blue-600 transition-colors">
                    {store.name}
                  </h5>
                  <span className="text-[9px] font-black text-amber-500 flex items-center gap-0.5 bg-amber-50 px-1.5 py-0.5 rounded-md shrink-0">
                    ★ {store.rating}
                  </span>
                </div>
                <p className="text-[9.5px] text-slate-500 line-clamp-1 mt-0.5">{store.desc}</p>
                <div className="flex items-center gap-2 mt-2 text-[9px] font-bold text-slate-600">
                  <span className="flex items-center gap-0.5 text-blue-600 bg-blue-50/80 px-1.5 py-0.5 rounded">
                    <Clock size={10} /> {store.deliveryTime}
                  </span>
                  <span className="flex items-center gap-0.5 text-slate-500">
                    <MapPin size={10} /> {store.distance}
                  </span>
                  {store.offerTag && (
                    <span className="text-rose-600 font-black truncate bg-rose-50 px-1.5 py-0.5 rounded">
                      🔥 {store.offerTag}
                    </span>
                  )}
                </div>
              </div>

              <div className="w-7 h-7 rounded-full bg-slate-50 group-hover:bg-[#1162D3] group-hover:text-white text-slate-400 flex items-center justify-center transition-all shrink-0">
                <ChevronRight size={14} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* When on "All", also display Trending / Aggregated Products Grid directly */}
      {selectedSubCat === 'All' && (
        <div className="space-y-3 pt-3">
          <div className="flex items-center justify-between px-1">
            <div>
              <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider">
                All Trending Products
              </h4>
              <p className="text-[9px] text-slate-400 font-bold mt-0.5">Aggregated deals across all departments</p>
            </div>
            <span className="text-[9.5px] font-black text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md">100% Authentic</span>
          </div>

          <div className="grid grid-cols-2 gap-3 pb-6">
            {products.map((product) => {
              const isAnimating = addedAnimationId === product.id;
              return (
                <div 
                  key={product.id}
                  className="bg-white rounded-[24px] border border-slate-100/80 shadow-[0_4px_16px_rgba(0,0,0,0.02)] hover:shadow-[0_8px_24px_rgba(0,0,0,0.06)] hover:border-slate-200 transition-all duration-300 flex flex-col justify-between overflow-hidden relative group"
                >
                  <div 
                    onClick={() => onProductClick && onProductClick({ ...product, app: 'MART' })}
                    className="aspect-square w-full bg-slate-50 relative overflow-hidden shrink-0 cursor-pointer"
                  >
                    <img 
                      src={product.image} 
                      alt={product.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      referrerPolicy="no-referrer"
                    />
                    <span className={`absolute top-2 left-2 text-[8px] font-black px-2 py-0.5 rounded-md text-white uppercase tracking-wider ${product.badgeBg || 'bg-[#1162D3]'} shadow-sm`}>
                      {product.badge || 'Trending'}
                    </span>
                  </div>

                  <div className="p-3 flex flex-col justify-between flex-1">
                    <div>
                      <div className="flex items-center gap-1">
                        <span className="text-[8px] font-black text-slate-400 bg-slate-50 border border-slate-100 px-1 rounded uppercase tracking-wide">
                          {product.category}
                        </span>
                        <span className="text-[8.5px] font-black text-amber-500 flex items-center">
                          ★ {product.rating}
                        </span>
                      </div>
                      <h5 
                        onClick={() => onProductClick && onProductClick({ ...product, app: 'MART' })}
                        className="text-[11px] font-black text-slate-900 mt-1 line-clamp-1 leading-tight group-hover:text-blue-600 cursor-pointer transition-colors"
                      >
                        {product.name}
                      </h5>
                      <p className="text-[9px] text-slate-400 font-medium mt-0.5 line-clamp-2 leading-tight">
                        {product.desc}
                      </p>
                    </div>

                    <div className="flex items-center justify-between mt-3 pt-2 border-t border-slate-50">
                      <div className="flex flex-col">
                        <span className="text-xs font-black text-slate-900">${product.price.toFixed(2)}</span>
                        <span className="text-[7.5px] font-bold text-slate-400 line-through">${(product.price * 1.3).toFixed(2)}</span>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleAddWithFeedback(product.id, product.name, product.price, product.emoji)}
                        className={`h-7 px-3 text-[9px] font-black rounded-lg uppercase tracking-wider transition-all border-none cursor-pointer flex items-center justify-center gap-1 ${
                          isAnimating 
                            ? 'bg-emerald-500 text-white shadow-[0_2px_8px_rgba(16,185,129,0.3)]'
                            : 'bg-[#1162D3] hover:bg-blue-600 text-white hover:shadow-md active:scale-95'
                        }`}
                      >
                        {isAnimating ? (
                          <>
                            <CheckCircle size={10} className="stroke-[3]" />
                            <span>Added!</span>
                          </>
                        ) : (
                          <>
                            <ShoppingCart size={10} className="stroke-[2.5]" />
                            <span>Add</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
