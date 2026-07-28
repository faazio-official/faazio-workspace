import React, { useState } from 'react';
import { 
  Heart, 
  Sparkles, 
  Plus, 
  Check, 
  Star, 
  Trash2, 
  ShoppingBag,
  Utensils,
  Apple,
  BriefcaseMedical,
  ExternalLink
} from 'lucide-react';
import { categoriesSearchDatabase } from '../data/mockProducts';
import { exploreStacks } from '../data/exploreData';
import EnterpriseIcon from './EnterpriseIcon';

interface FavouritesViewProps {
  addToCart: (id: string, name: string, price: number, emoji: string) => void;
  onProductClick?: (product: any) => void;
  favorites: string[];
  toggleFavorite: (productId: string) => void;
}

export default function FavouritesView({ 
  addToCart, 
  onProductClick, 
  favorites = [], 
  toggleFavorite 
}: FavouritesViewProps) {
  const [addedItem, setAddedItem] = useState<string | null>(null);

  const handleAddToCart = (id: string, name: string, price: number, emoji: string) => {
    addToCart(id, name, price, emoji);
    setAddedItem(id);
    setTimeout(() => {
      setAddedItem(null);
    }, 1200);
  };

  // Compile a flat list of all products in the ecosystem
  const getAllProducts = () => {
    const list: any[] = [];
    
    // 1. Standard Category Database Products
    Object.entries(categoriesSearchDatabase).forEach(([catId, items]: [string, any]) => {
      let app: 'FOOD' | 'MART' | 'GROCERY' | 'PHARMA' = 'MART';
      if (catId.startsWith('food-') || catId.startsWith('fd-')) app = 'FOOD';
      else if (catId.startsWith('groc-') || catId.startsWith('gr-')) app = 'GROCERY';
      else if (catId.startsWith('ph-')) app = 'PHARMA';
      else if (catId.startsWith('mart-') || catId.startsWith('fm-')) app = 'MART';
      
      items.forEach((item: any) => {
        list.push({
          ...item,
          app,
          catId,
          catName: item.catName || catId,
          image: item.image || item.img
        });
      });
    });

    // 2. Curated Explore Feed Products
    exploreStacks.forEach(stack => {
      stack.items.forEach(item => {
        list.push({
          id: item.id,
          name: item.name,
          price: item.price,
          rating: Number(item.rating),
          emoji: item.emoji,
          image: item.img,
          desc: `Premium GenZ favorite curated from ${item.shop}. 100% genuine quality with lightning speed delivery.`,
          app: stack.type,
          catId: stack.id,
          catName: stack.title,
          shop: item.shop
        });
      });
    });

    return list;
  };

  // Extract saved favorite items
  const favoriteProducts = getAllProducts().filter(p => favorites.includes(p.id));

  // Categorize favorites by Sub App
  const categorized = {
    FOOD: favoriteProducts.filter(p => p.app === 'FOOD'),
    MART: favoriteProducts.filter(p => p.app === 'MART'),
    GROCERY: favoriteProducts.filter(p => p.app === 'GROCERY'),
    PHARMA: favoriteProducts.filter(p => p.app === 'PHARMA')
  };

  const hasAnyFavorites = favoriteProducts.length > 0;

  // Theme styling helpers for each category section
  const sectorStyles = {
    FOOD: {
      title: 'Food Delivery & Dining',
      emoji: '🍲',
      textColor: 'text-emerald-700',
      borderColor: 'border-emerald-100',
      badgeBg: 'bg-emerald-50 text-emerald-700 border-emerald-100',
      btnBg: 'bg-[#1E5D44] hover:bg-[#154230] text-white',
      cardBg: 'bg-gradient-to-b from-emerald-50/25 to-white'
    },
    MART: {
      title: 'Fashion, Tech & Lifestyle',
      emoji: '🛍️',
      textColor: 'text-blue-700',
      borderColor: 'border-blue-100',
      badgeBg: 'bg-blue-50 text-blue-700 border-blue-100',
      btnBg: 'bg-[#1162D3] hover:bg-blue-800 text-white',
      cardBg: 'bg-gradient-to-b from-blue-50/25 to-white'
    },
    GROCERY: {
      title: 'Grocery & Fresh Essentials',
      emoji: '🍏',
      textColor: 'text-green-700',
      borderColor: 'border-green-100',
      badgeBg: 'bg-green-50 text-green-700 border-green-100',
      btnBg: 'bg-[#10B981] hover:bg-emerald-600 text-white',
      cardBg: 'bg-gradient-to-b from-green-50/25 to-white'
    },
    PHARMA: {
      title: 'Pharma & Wellness Care',
      emoji: '💊',
      textColor: 'text-teal-700',
      borderColor: 'border-teal-100',
      badgeBg: 'bg-teal-50 text-teal-700 border-teal-100',
      btnBg: 'bg-[#065F46] hover:bg-teal-850 text-white',
      cardBg: 'bg-gradient-to-b from-teal-50/25 to-white'
    }
  };

  return (
    <div className="space-y-6 animate-fade-in pb-16 text-slate-800">
      
      {/* 1. Header Banner */}
      <div className="bg-gradient-to-tr from-rose-950 via-slate-900 to-slate-850 text-white rounded-[26px] p-4 border border-slate-800 shadow-lg relative overflow-hidden">
        <div className="absolute -right-10 -bottom-10 w-36 h-36 bg-rose-500/10 rounded-full blur-2xl" />
        <div className="absolute -left-10 -top-10 w-36 h-36 bg-blue-500/10 rounded-full blur-2xl" />
        
        <div className="relative z-10 space-y-1">
          <span className="text-[8px] font-black uppercase tracking-widest text-[#FF4A6B] bg-[#FF4A6B]/15 px-2.5 py-0.5 rounded-full border border-[#FF4A6B]/20">
            Personal Wishlists
          </span>
          <h3 className="text-sm font-black tracking-tight leading-tight uppercase font-display">
            My Curated Favourites
          </h3>
          <p className="text-[9.5px] text-slate-400 font-medium">
            Your saved items categorized across active sub apps
          </p>
        </div>
      </div>

      {/* 2. Categorized Sections */}
      {hasAnyFavorites ? (
        <div className="space-y-6">
          {(Object.keys(categorized) as Array<keyof typeof categorized>).map((key) => {
            const items = categorized[key];
            if (items.length === 0) return null;

            const style = sectorStyles[key];

            return (
              <div key={key} className="space-y-3">
                {/* Section Sub-Header */}
                <div className="flex items-center justify-between px-1 border-b border-slate-100 pb-1.5">
                  <div className="flex items-center gap-1.5">
                    <EnterpriseIcon emoji={style.emoji} app={key} className="w-5.5 h-5.5 border-none bg-transparent" size={11} variant="flat" />
                    <h4 className={`text-[11px] font-black uppercase tracking-wider ${style.textColor}`}>
                      {style.title}
                    </h4>
                  </div>
                  <span className="text-[9px] font-bold text-slate-400">
                    {items.length} {items.length === 1 ? 'item' : 'items'}
                  </span>
                </div>

                {/* Grid of items */}
                <div className="grid grid-cols-2 gap-3.5">
                  {items.map((item) => {
                    const isAdded = addedItem === item.id;

                    return (
                      <div 
                        key={item.id}
                        className={`rounded-[24px] border border-slate-100 flex flex-col justify-between overflow-hidden group hover:shadow-md transition-all duration-300 ${style.cardBg}`}
                      >
                        <div 
                          onClick={() => onProductClick && onProductClick(item)}
                          className="cursor-pointer flex flex-col"
                        >
                          {/* Visual Frame */}
                          <div className="h-32 w-full relative overflow-hidden bg-slate-50 shrink-0 border-b border-slate-100/50">
                            <img 
                              src={item.image} 
                              alt={item.name} 
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                              referrerPolicy="no-referrer"
                            />
                            
                            {/* Heart Button */}
                            <button 
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleFavorite(item.id);
                              }}
                              className="absolute top-2.5 right-2.5 w-7 h-7 rounded-full bg-white/95 shadow-sm flex items-center justify-center text-rose-500 border-none cursor-pointer hover:scale-105 active:scale-95 transition-all z-10"
                              title="Remove from favorites"
                            >
                              <Heart size={12} className="fill-rose-500 text-rose-500" />
                            </button>

                            {/* Rating Badge */}
                            <span className="absolute bottom-2.5 left-2.5 bg-slate-900/80 backdrop-blur-xs text-white text-[7.5px] font-black px-1.5 py-0.5 rounded-md flex items-center gap-0.5">
                              ★ {item.rating}
                            </span>

                            {/* Enterprise Icon overlay */}
                            {item.emoji && (
                              <EnterpriseIcon 
                                emoji={item.emoji} 
                                app={item.app} 
                                className="absolute top-2.5 left-2.5 w-7 h-7 shadow-sm border border-slate-100/30" 
                                size={12} 
                              />
                            )}
                          </div>

                          {/* Content */}
                          <div className="p-3 space-y-1">
                            <div className="flex items-center gap-1">
                              <span className={`text-[6px] font-black px-1.5 py-0.2 rounded uppercase border tracking-wider shrink-0 ${style.badgeBg}`}>
                                {item.app}
                              </span>
                              {item.shop && (
                                <span className="text-[7px] font-bold text-slate-400 uppercase tracking-wide truncate max-w-[80px]">
                                  {item.shop}
                                </span>
                              )}
                            </div>
                            <h5 className="text-[10px] font-black text-slate-950 truncate leading-snug group-hover:text-slate-800 transition-colors">
                              {item.name}
                            </h5>
                            <p className="text-[8px] text-slate-400 font-semibold line-clamp-2 min-h-[22px] leading-tight">
                              {item.desc}
                            </p>
                          </div>
                        </div>

                        {/* Pricing & Cart Action Row */}
                        <div className="px-3 pb-3 pt-2 border-t border-slate-50 flex items-center justify-between bg-white/50 backdrop-blur-xs">
                          <span className="text-[10.5px] font-black text-slate-900">
                            ₹{item.price.toLocaleString('en-IN')}
                          </span>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleAddToCart(item.id, item.name, item.price, item.emoji);
                            }}
                            className={`h-6.5 px-3 rounded-lg text-[8px] font-black uppercase tracking-wider transition-all border-none cursor-pointer flex items-center gap-0.5 ${
                              isAdded 
                                ? 'bg-emerald-600 text-white' 
                                : `${style.btnBg} shadow-sm`
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
            );
          })}
        </div>
      ) : (
        /* 3. High-Fidelity Empty State */
        <div className="text-center py-16 px-4 bg-white rounded-[32px] border border-slate-100 shadow-sm space-y-4">
          <div className="w-16 h-16 rounded-full bg-rose-50 flex items-center justify-center text-rose-400 mx-auto animate-pulse">
            <Heart size={28} className="stroke-[2px]" />
          </div>
          <div className="space-y-1.5 max-w-[260px] mx-auto">
            <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider">
              No Favourites Yet
            </h4>
            <p className="text-[10px] text-slate-400 font-semibold leading-relaxed">
              Tap the heart icon on any product in our categories or explore feeds to add them to your curated shortlist here!
            </p>
          </div>
        </div>
      )}

    </div>
  );
}
