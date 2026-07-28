import React, { useState, useEffect } from 'react';
import { 
  Sparkles, 
  Utensils, 
  ShoppingBag, 
  Apple, 
  Activity, 
  Plus, 
  Check, 
  Search, 
  Filter, 
  Grid,
  Star,
  ChevronRight,
  TrendingUp,
  Tag,
  Heart
} from 'lucide-react';
import { categoriesSearchDatabase } from '../data/mockProducts';
import { exploreStacks } from '../data/exploreData';
import EnterpriseIcon from './EnterpriseIcon';

interface CategoriesViewProps {
  selectedCategory: string;
  setSelectedCategory: (category: string) => void;
  addToCart: (id: string, name: string, price: number, emoji: string) => void;
  onProductClick?: (product: any) => void;
  favorites?: string[];
  toggleFavorite?: (productId: string) => void;
}

export default function CategoriesView({ 
  selectedCategory, 
  setSelectedCategory, 
  addToCart, 
  onProductClick,
  favorites = [],
  toggleFavorite
}: CategoriesViewProps) {
  // Top level App Filter state: FOOD, MART, GROCERY, PHARMA
  const [selectedApp, setSelectedApp] = useState<'ALL' | 'FOOD' | 'MART' | 'GROCERY' | 'PHARMA'>('ALL');
  const [activeSubCat, setActiveSubCat] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [addedItem, setAddedItem] = useState<string | null>(null);

  // Filter Buttons representing the 4 Apps
  const appFilters = [
    { id: 'ALL' as const, label: 'All Apps', emoji: '✨', activeClass: 'bg-slate-900 border-slate-900 text-white shadow-md' },
    { id: 'FOOD' as const, label: 'FOOD', emoji: '🍲', activeClass: 'bg-[#1E5D44] border-[#1E5D44] text-white shadow-md shadow-emerald-900/10' },
    { id: 'MART' as const, label: 'MART', emoji: '🛍️', activeClass: 'bg-[#1162D3] border-[#1162D3] text-white shadow-md shadow-blue-900/10' },
    { id: 'GROCERY' as const, label: 'GROCERY', emoji: '🍏', activeClass: 'bg-[#10B981] border-[#10B981] text-white shadow-md shadow-green-900/10' },
    { id: 'PHARMA' as const, label: 'PHARMA', emoji: '💊', activeClass: 'bg-[#065F46] border-[#065F46] text-white shadow-md shadow-teal-900/10' },
  ];

  // All categories categorized by their respective App with high-end color definitions
  const categoriesList = [
    // FOOD
    { id: 'food-main', name: 'Sizzling Entrees', emoji: '🍛', app: 'FOOD', bg: 'bg-emerald-50/75 text-emerald-800 border-emerald-100', activeRing: 'ring-2 ring-[#1E5D44]' },
    { id: 'food-snack', name: 'Combos & Snacks', emoji: '🌯', app: 'FOOD', bg: 'bg-rose-50/75 text-rose-800 border-rose-100', activeRing: 'ring-2 ring-rose-500' },
    { id: 'food-dessert', name: 'Desserts & Shakes', emoji: '🥞', app: 'FOOD', bg: 'bg-amber-50/75 text-amber-800 border-amber-100', activeRing: 'ring-2 ring-amber-500' },
    // MART
    { id: 'mart-tech', name: 'Tech & Keyboards', emoji: '⌨️', app: 'MART', bg: 'bg-blue-50/75 text-blue-800 border-blue-100', activeRing: 'ring-2 ring-[#1162D3]' },
    { id: 'mart-foot', name: 'Footwear & Kicks', emoji: '👟', app: 'MART', bg: 'bg-indigo-50/75 text-indigo-800 border-indigo-100', activeRing: 'ring-2 ring-indigo-500' },
    { id: 'mart-lounge', name: 'Cozywear Lounge', emoji: '🧥', app: 'MART', bg: 'bg-stone-100 text-stone-800 border-stone-200', activeRing: 'ring-2 ring-stone-600' },
    // GROCERY
    { id: 'groc-green', name: 'Fresh Greens', emoji: '🥦', app: 'GROCERY', bg: 'bg-green-50/75 text-green-800 border-green-100', activeRing: 'ring-2 ring-[#10B981]' },
    { id: 'groc-soda', name: 'Cold Sips & Soda', emoji: '🥤', app: 'GROCERY', bg: 'bg-cyan-50/75 text-cyan-800 border-cyan-100', activeRing: 'ring-2 ring-cyan-500' },
    { id: 'groc-dairy', name: 'Dairy & Milks', emoji: '🥛', app: 'GROCERY', bg: 'bg-sky-50/75 text-sky-800 border-sky-100', activeRing: 'ring-2 ring-sky-500' },
    // PHARMA
    { id: 'ph-wellness', name: 'Wellness Gummies', emoji: '🍊', app: 'PHARMA', bg: 'bg-orange-50/75 text-orange-800 border-orange-100', activeRing: 'ring-2 ring-orange-500' },
    { id: 'ph-sos', name: 'Late-Night SOS', emoji: '🩹', app: 'PHARMA', bg: 'bg-red-50/75 text-red-800 border-red-100', activeRing: 'ring-2 ring-red-500' },
    { id: 'ph-beauty', name: 'K-Beauty Glow', emoji: '✨', app: 'PHARMA', bg: 'bg-teal-50/75 text-teal-800 border-teal-100', activeRing: 'ring-2 ring-[#065F46]' }
  ];

  // Master product database with item list in INR (₹) - central mock file
  const productDatabase = categoriesSearchDatabase;

  // Filter Categories list based on the chosen App filter
  const filteredCategoriesList = categoriesList.filter(cat => 
    selectedApp === 'ALL' || cat.app === selectedApp
  );

  // Auto-select or reset active subcategory when changing the app filter
  useEffect(() => {
    setActiveSubCat('all');
  }, [selectedApp]);

  // Handle addition to basket
  const triggerAddToCart = (id: string, name: string, price: number, emoji: string) => {
    addToCart(id, name, price, emoji);
    setAddedItem(id);
    setTimeout(() => {
      setAddedItem(null);
    }, 1200);
  };

  // Gather products based on active filters
  const getFilteredProducts = () => {
    let list: { 
      id: string; 
      name: string; 
      price: number; 
      emoji: string; 
      image: string; 
      desc: string; 
      rating: number; 
      catId: string; 
      catName: string; 
      app: string;
      badge?: string;
    }[] = [];
    
    filteredCategoriesList.forEach(cat => {
      if (activeSubCat === 'all' || activeSubCat === cat.id) {
        const items = productDatabase[cat.id] || [];
        items.forEach(item => {
          list.push({
            ...item,
            catId: cat.id,
            catName: cat.name,
            app: cat.app
          });
        });
      }
    });

    // Apply search query
    if (searchQuery.trim() !== '') {
      const q = searchQuery.toLowerCase();
      list = list.filter(item => 
        item.name.toLowerCase().includes(q) || 
        item.desc.toLowerCase().includes(q) ||
        item.catName.toLowerCase().includes(q)
      );
    } else if (activeSubCat === 'all') {
      // Curate default landing view with top-rated item from each department instead of listing all database items at once
      const curatedIds = ['cat-fm-1', 'cat-mt-1', 'cat-gg-2', 'cat-pb-1'];
      list = list.filter(item => curatedIds.includes(item.id));
    }

    return list;
  };

  const displayedProducts = getFilteredProducts();

  return (
    <div className="flex flex-col gap-4 animate-fade-in -mx-4 px-4 pb-14 text-slate-800">
      
      {/* 1. TOP APP LEVEL FILTER PILLS - FAST TAB SWITCHING */}
      <div className="space-y-1.5 shrink-0">
        <div className="flex items-center justify-between px-1">
          <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider flex items-center gap-1">
            <Filter size={10} className="text-slate-400" />
            Explore Departments
          </span>
          <span className="text-[8.5px] font-black text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full uppercase">
            {selectedApp === 'ALL' ? 'All Channels' : `${selectedApp} Active`}
          </span>
        </div>
        
        {/* Horizontal scroll of app buttons */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none snap-x px-0.5">
          {appFilters.map((f) => {
            const isSel = selectedApp === f.id;
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => setSelectedApp(f.id)}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-full border text-[9.5px] font-black uppercase tracking-wider transition-all duration-300 snap-start shrink-0 cursor-pointer ${
                  isSel 
                    ? f.activeClass 
                    : 'bg-white border-slate-100 text-slate-500 hover:border-slate-200'
                }`}
              >
                <EnterpriseIcon emoji={f.emoji} app={f.id} className="w-5 h-5 border-none bg-transparent" size={11} variant="flat" />
                <span>{f.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. INSTANT SEARCH BAR */}
      <div className="relative shrink-0">
        <input 
          type="text"
          placeholder="Search catalog by product name or details..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full h-9.5 pl-9 pr-4 rounded-xl border border-slate-100 text-[10.5px] bg-slate-50 text-slate-800 placeholder:text-slate-400 font-semibold focus:outline-none focus:border-slate-300 transition-all shadow-sm"
        />
        <Search size={12} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
      </div>

      {/* 3. ENTERPRISE CATEGORY GRID SELECTOR */}
      <div className="space-y-2.5 shrink-0 bg-slate-50/50 p-3 rounded-[24px] border border-slate-100/40">
        <div className="flex items-center justify-between px-1">
          <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
            Select Category Filter
          </span>
          <button 
            type="button"
            onClick={() => setActiveSubCat('all')}
            className={`text-[8.5px] font-black uppercase px-2 py-0.5 rounded-md transition-all ${
              activeSubCat === 'all' 
                ? 'bg-slate-900 text-white shadow-sm' 
                : 'text-slate-500 hover:bg-slate-200/50'
            }`}
          >
            Show All
          </button>
        </div>

        {/* 3-Column Compact Visual Grid of Categories */}
        <div className="grid grid-cols-3 gap-2">
          {filteredCategoriesList.map((cat) => {
            const isSel = activeSubCat === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setActiveSubCat(cat.id)}
                className={`flex flex-col items-center justify-center p-2.5 rounded-xl border text-center transition-all cursor-pointer relative ${cat.bg} ${
                  isSel 
                    ? `bg-white border-slate-900/10 shadow-md ${cat.activeRing} scale-[1.03] z-10` 
                    : 'hover:bg-white hover:border-slate-200'
                }`}
              >
                <EnterpriseIcon emoji={cat.emoji} app={cat.app} className="w-8 h-8 mb-1 bg-white/90 shadow-xs border-slate-100/40" size={14} />
                <span className="text-[8px] font-black tracking-tight leading-tight uppercase line-clamp-1">
                  {cat.name.split(' ')[0]}
                </span>
                
                {/* Micro branding label in grid */}
                <span className="text-[6px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">
                  {cat.app}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 4. HIGH-DENSITY ENTERPRISE LIST VIEW (Completely different from Explore's carousels!) */}
      <div className="space-y-3 pb-6">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-1.5 text-slate-400">
            <Grid size={11} />
            <span className="text-[9.5px] font-black uppercase tracking-wider text-slate-500">
              {activeSubCat === 'all' 
                ? searchQuery.trim() !== '' ? 'Search Results' : '🔥 Handpicked Highlights' 
                : categoriesList.find(c => c.id === activeSubCat)?.name
              }
            </span>
          </div>
          <span className="text-[9px] font-bold text-slate-400">
            {displayedProducts.length} {displayedProducts.length === 1 ? 'result' : 'results'}
          </span>
        </div>

        {/* Product content: premium curated Explore Stacks for Handpicked Highlights, list view otherwise */}
        {activeSubCat === 'all' && searchQuery.trim() === '' ? (
          <div className="space-y-6 w-full">
            {exploreStacks
              .filter(stack => selectedApp === 'ALL' || stack.type === selectedApp)
              .map((stack) => (
                <div key={stack.id} className="space-y-3 pb-3">
                  {/* Curated Stack Title Card */}
                  <div className="flex flex-col px-1">
                    <div className="flex items-center justify-between">
                      <h4 className="text-[12px] font-black uppercase tracking-wide text-slate-900 flex items-center gap-1">
                        {stack.title}
                      </h4>
                      <span className="text-[7.5px] font-black text-[#FF4A6B] bg-[#FF4A6B]/5 px-2 py-0.5 rounded-full border border-[#FF4A6B]/10 uppercase tracking-widest">
                        {stack.type}
                      </span>
                    </div>
                    <p className="text-[9px] text-slate-400 font-semibold leading-tight mt-0.5">
                      {stack.subtitle}
                    </p>
                  </div>

                  {/* Horizontal Scroll Carousel */}
                  <div className="flex gap-3.5 overflow-x-auto pb-3 scrollbar-none snap-x px-0.5">
                    {stack.items.map((item) => {
                      const isAdded = addedItem === item.id;
                      const isFav = favorites.includes(item.id);
                      
                      // Custom aesthetic colors matching original explore views
                      const cardBg = 
                        stack.type === 'FOOD' ? 'bg-gradient-to-b from-emerald-50/25 to-white' :
                        stack.type === 'MART' ? 'bg-gradient-to-b from-blue-50/20 to-white' :
                        stack.type === 'GROCERY' ? 'bg-gradient-to-b from-green-50/25 to-white' :
                        'bg-gradient-to-b from-teal-50/25 to-white';

                      const btnBg = 
                        stack.type === 'FOOD' ? 'bg-[#1E5D44] hover:bg-[#154230] text-white' :
                        stack.type === 'MART' ? 'bg-[#1162D3] hover:bg-blue-800 text-white' :
                        stack.type === 'GROCERY' ? 'bg-[#10B981] hover:bg-[#0d9488] text-white' :
                        'bg-[#065F46] hover:bg-teal-850 text-white';

                      // Transform ExploreItem to standard Product format
                      const productObj = {
                        id: item.id,
                        name: item.name,
                        price: item.price,
                        rating: Number(item.rating),
                        emoji: item.emoji,
                        image: item.img,
                        desc: `Special premium pick curated from ${item.shop}. 100% genuine quality with high-priority rapid delivery.`,
                        app: stack.type,
                        catId: stack.id,
                        catName: stack.title,
                        shop: item.shop
                      };

                      return (
                        <div 
                          key={item.id}
                          className={`w-[165px] ${cardBg} rounded-[24px] border border-slate-100 p-2.5 shadow-xs hover:border-slate-200 snap-start shrink-0 flex flex-col justify-between group transition-all duration-300 hover:shadow-md relative`}
                        >
                          <div
                            onClick={() => onProductClick && onProductClick(productObj)}
                            className="cursor-pointer flex flex-col"
                          >
                            {/* Card Image Wrapper */}
                            <div className="h-28 w-full rounded-2xl overflow-hidden relative bg-slate-50 border border-slate-100/50 shrink-0">
                              <img 
                                src={item.img} 
                                alt={item.name} 
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                referrerPolicy="no-referrer"
                              />

                              {/* Save/Favorite Overlay Button */}
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (toggleFavorite) toggleFavorite(item.id);
                                }}
                                className="absolute top-2 right-2 w-6 h-6 rounded-full bg-white/95 shadow-sm flex items-center justify-center text-rose-500 hover:scale-105 active:scale-95 transition-all border-none cursor-pointer z-10"
                                title="Toggle favorite"
                              >
                                <Heart size={10} className={isFav ? "fill-rose-500 text-rose-500" : "text-slate-400"} />
                              </button>

                              {/* Star Rating Overlay */}
                              <span className="absolute bottom-2 right-2 bg-slate-900/80 backdrop-blur-xs text-[6.5px] font-black text-white px-1.5 py-0.5 rounded shadow-xs">
                                ★ {item.rating}
                              </span>

                              {/* Enterprise Icon Stamp Overlay */}
                              {item.emoji && (
                                <EnterpriseIcon 
                                  emoji={item.emoji} 
                                  app={stack.type} 
                                  className="absolute top-2 left-2 w-6 h-6 shadow-sm border border-slate-100/30" 
                                  size={11} 
                                />
                              )}
                            </div>

                            {/* Content */}
                            <div className="mt-2 space-y-1">
                              <span className="text-[7px] font-extrabold text-slate-400 uppercase tracking-wide truncate max-w-[120px] block">
                                {item.shop}
                              </span>
                              <h5 className="text-[9.5px] font-black text-slate-950 truncate leading-snug group-hover:text-slate-800 transition-colors">
                                {item.name}
                              </h5>
                              <p className="text-[7.5px] text-slate-400 font-semibold line-clamp-2 min-h-[20px] leading-tight">
                                Fresh curation from {item.shop}. Premium local favorite.
                              </p>
                            </div>
                          </div>

                          {/* Pricing & Cart Action Block */}
                          <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-50">
                            <span className="text-[10px] font-black text-slate-900">
                              ₹{item.price.toLocaleString('en-IN')}
                            </span>
                            
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                triggerAddToCart(item.id, item.name, item.price, item.emoji);
                              }}
                              className={`h-6 px-2 rounded-lg text-[7.5px] font-black uppercase tracking-wider transition-all border-none cursor-pointer flex items-center gap-0.5 shadow-sm ${
                                isAdded 
                                  ? 'bg-emerald-600 text-white animate-pulse' 
                                  : `${btnBg}`
                              }`}
                            >
                              {isAdded ? <Check size={8} className="stroke-[3]" /> : <Plus size={8} />}
                              <span>{isAdded ? 'Added' : 'Add'}</span>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3.5 pb-8">
            {displayedProducts.map((item) => {
              const isAdded = addedItem === item.id;
              
              // Match color accent based on parent app
              const themeColorClass = 
                item.app === 'FOOD' ? 'bg-[#1E5D44] hover:bg-emerald-800' :
                item.app === 'MART' ? 'bg-[#1162D3] hover:bg-blue-800' :
                item.app === 'GROCERY' ? 'bg-[#10B981] hover:bg-emerald-600' :
                'bg-[#065F46] hover:bg-teal-800';

              const appBadgeBg = 
                item.app === 'FOOD' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                item.app === 'MART' ? 'bg-blue-50 text-blue-700 border-blue-100' :
                item.app === 'GROCERY' ? 'bg-green-50 text-green-700 border-green-100' :
                'bg-teal-50 text-teal-700 border-teal-100';

              return (
                <div 
                  key={item.id}
                  className="bg-white rounded-[24px] border border-slate-100 flex flex-col justify-between overflow-hidden group hover:shadow-md transition-all duration-300"
                >
                  <div 
                    onClick={() => onProductClick && onProductClick(item)}
                    className="cursor-pointer flex flex-col"
                  >
                    {/* Visual Card Frame - Near Square */}
                    <div className="h-32 w-full relative overflow-hidden bg-slate-50 shrink-0">
                      <img 
                        src={item.image} 
                        alt={item.name} 
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        referrerPolicy="no-referrer"
                      />
                      
                      {/* Rating Badge */}
                      <span className="absolute bottom-2 right-2 bg-white/95 text-[7.5px] font-black text-amber-500 px-1.5 py-0.5 rounded shadow-xs">
                        ★ {item.rating}
                      </span>
                    </div>

                    {/* Metadata Content */}
                    <div className="p-3.5 space-y-1">
                      <div className="flex items-center gap-1 flex-wrap">
                        <span className={`text-[6px] font-black px-1.5 py-0.2 rounded uppercase border tracking-wider shrink-0 ${appBadgeBg}`}>
                          {item.app}
                        </span>
                        <span className="text-[7px] font-semibold text-slate-400 uppercase tracking-wide truncate max-w-[70px]">
                          {item.catName}
                        </span>
                      </div>
                      
                      <h5 className="text-[10px] font-black text-slate-950 truncate leading-snug group-hover:text-slate-800 transition-colors">
                        {item.name}
                      </h5>

                      <p className="text-[8px] text-slate-400 font-medium line-clamp-2 leading-tight">
                        {item.desc}
                      </p>
                    </div>
                  </div>

                  {/* Pricing and Action */}
                  <div className="p-3.5 pt-0 mt-auto">
                    <div className="flex items-center justify-between border-t border-slate-50 pt-2.5">
                      <span className="text-[10.5px] font-black text-slate-900 leading-none">
                        ₹{item.price.toLocaleString('en-IN')}
                      </span>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          triggerAddToCart(item.id, item.name, item.price, item.emoji);
                        }}
                        className={`h-6.5 px-3 rounded-lg text-[8px] font-black uppercase tracking-wider transition-all border-none cursor-pointer flex items-center gap-0.5 shadow-sm ${
                          isAdded 
                            ? 'bg-emerald-600 text-white' 
                            : `${themeColorClass} text-white`
                        }`}
                      >
                        {isAdded ? <Check size={8} className="stroke-[3]" /> : <Plus size={8} />}
                        <span>{isAdded ? 'Added' : 'Add'}</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Global Empty State */}
        {displayedProducts.length === 0 && (
          <div className="text-center py-16 space-y-3 bg-slate-50 rounded-[28px] border border-dashed border-slate-200">
            <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto text-slate-400 border border-slate-200 shadow-xs">
              <Search size={18} />
            </div>
            <p className="text-[10.5px] font-black text-slate-500 uppercase">No matching products</p>
            <p className="text-[9px] text-slate-400 font-medium px-4">
              We couldn't find items matching "{searchQuery}" under this category. Let's try another one!
            </p>
          </div>
        )}
      </div>

    </div>
  );
}
