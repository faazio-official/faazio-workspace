import React, { useState } from 'react';
import { Search, Bell, Plus, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { foodProducts } from '../data/mockProducts';

interface FoodMenuViewProps {
  addToCart: (id: string, name: string, price: number, emoji: string) => void;
  onProductClick?: (product: any) => void;
}

interface FoodItem {
  id: string;
  name: string;
  price: number;
  emoji: string;
  image: string;
  categories: string[];
  desc: string;
}

export default function FoodMenuView({ addToCart, onProductClick }: FoodMenuViewProps) {
  const [activeCategory, setActiveCategory] = useState<string>('Top of Week');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [addedItem, setAddedItem] = useState<string | null>(null);
  const [showAlert, setShowAlert] = useState<boolean>(false);

  // Tabs as specified in the mockup
  const categories = ['All', 'Featured', 'Top of Week', 'Soup', 'Seafood'];

  // Master food items populated with premium Unsplash food imagery to match design
  const foodItems: FoodItem[] = foodProducts;

  // Filtering logic
  const filteredItems = foodItems.filter(item => {
    const matchesCategory = activeCategory === 'All' || item.categories.includes(activeCategory);
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          item.desc.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const triggerAddToCart = (item: FoodItem) => {
    addToCart(item.id, item.name, item.price, item.emoji);
    setAddedItem(item.id);
    setTimeout(() => {
      setAddedItem(null);
    }, 1200);
  };

  const handleNotificationClick = () => {
    setShowAlert(true);
    setTimeout(() => {
      setShowAlert(false);
    }, 2500);
  };

  return (
    <div className="flex flex-col h-full w-full bg-slate-50 text-slate-850 overflow-hidden animate-fade-in">
      <div className="flex-1 overflow-y-auto px-4 pt-4 pb-16 scrollbar-none space-y-4">
        {/* 1. Mockup Header Block */}
        <div className="flex items-center justify-between px-1 shrink-0">
          {/* Empty left spacer to center the title "Menu" exactly like the mockup */}
          <div className="w-9" />
          
          <h2 className="text-base font-black text-slate-900 tracking-tight text-center">
            Menu
          </h2>
  
          {/* Bell notification with active badge */}
          <button 
            onClick={handleNotificationClick}
            className="w-9 h-9 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-700 relative border-none bg-transparent cursor-pointer transition-all active:scale-90"
          >
            <Bell size={20} className="stroke-[2.2]" />
            <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-rose-500 border border-white animate-pulse" />
          </button>
        </div>
  
        {/* Notification Toast */}
        <AnimatePresence>
          {showAlert && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="bg-slate-900 text-white text-[10px] font-bold px-4 py-2.5 rounded-xl shadow-md mx-1 flex items-center justify-between"
            >
              <span>🔔 Your gourmet chef has started prepping your customized recommendations.</span>
            </motion.div>
          )}
        </AnimatePresence>
  
        {/* 2. Brand Subtitles */}
        <div className="px-1 shrink-0">
          <span className="text-xs font-black text-slate-400 leading-none">
            Our Food
          </span>
          <h1 className="text-xl font-black text-[#1E5D44] mt-0.5 tracking-tight">
            Special For You
          </h1>
        </div>
  
        {/* 3. Sticky Search Bar with Mockup Design */}
        <div className="sticky top-0 z-30 bg-slate-50 pt-2 pb-2 -mx-4 px-4 shadow-[0_1px_0_rgba(0,0,0,0.01)]">
          <div className="relative">
            <span className="absolute inset-y-0 left-3.5 flex items-center pointer-events-none">
              <Search size={18} className="text-slate-400" />
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search Your Menus"
              className="w-full h-11 pl-11 pr-4 bg-[#F8FAFC] border border-slate-200/40 text-[11.5px] font-black text-slate-800 placeholder-slate-400 rounded-2xl focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#1E5D44]/15 focus:border-[#1E5D44] transition-all"
            />
          </div>
        </div>
  
        {/* 4. Sticky Horizontal Categories tab with Underline Indicator exactly like Mockup */}
        <div className="sticky top-[60px] z-20 bg-slate-50 pb-2.5 pt-1 -mx-4 px-4 border-b border-slate-100/60 shadow-[0_4px_12px_rgba(0,0,0,0.01)]">
          <div className="flex gap-5 overflow-x-auto pb-1 scrollbar-none px-1">
            {categories.map((cat) => {
              const isSel = activeCategory === cat;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => {
                    setActiveCategory(cat);
                    setSearchQuery('');
                  }}
                  className={`pb-2.5 text-xs font-bold tracking-tight transition-all border-none bg-transparent cursor-pointer relative shrink-0 ${
                    isSel 
                      ? 'text-slate-900 font-extrabold' 
                      : 'text-slate-400/80 hover:text-slate-600'
                  }`}
                >
                  <span>{cat}</span>
                  {isSel && (
                    <motion.div 
                      layoutId="activeFoodMenuTabLine"
                      className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#1E5D44] rounded-full"
                      transition={{ type: 'spring', stiffness: 350, damping: 25 }}
                    />
                  )}
                </button>
              );
            })}
          </div>
        </div>
  
        {/* 5. Two-Column Grid of Premium Food Cards */}
        <div className="pt-2 pb-12">
          <div className="grid grid-cols-2 gap-x-4 gap-y-5 px-1">
            {filteredItems.map((item) => {
              const isAdded = addedItem === item.id;
              return (
                <div 
                  key={item.id} 
                  onClick={() => onProductClick ? onProductClick({ ...item, price: item.price / 10, app: 'FOOD' }) : triggerAddToCart(item)}
                  className="flex flex-col group cursor-pointer"
                >
                  {/* Image Frame with rounded-[20px] / rounded-[24px] */}
                  <div className="aspect-square w-full rounded-2xl overflow-hidden bg-slate-100 relative shadow-sm border border-slate-100">
                    <img 
                      src={item.image} 
                      alt={item.name} 
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                      referrerPolicy="no-referrer"
                    />
                    
                    {/* Plus/Added badge in bottom right corner */}
                    <div 
                      onClick={(e) => {
                        e.stopPropagation();
                        triggerAddToCart(item);
                      }}
                      className="absolute bottom-2.5 right-2.5 w-7 h-7 rounded-full flex items-center justify-center bg-white/95 backdrop-blur-sm border border-slate-100 shadow-md transition-all hover:bg-slate-50 active:scale-90 z-10"
                    >
                      {isAdded ? (
                        <Check size={12} className="text-emerald-600 stroke-[3.5]" />
                      ) : (
                        <Plus size={12} className="text-slate-700 stroke-[2.5]" />
                      )}
                    </div>
                  </div>
  
                  {/* Text and Pricing details styled exactly like Mockup */}
                  <div className="mt-2 px-0.5">
                    <h3 className="text-[11.5px] font-black text-slate-900 truncate leading-snug group-hover:text-[#1E5D44] transition-colors">
                      {item.name}
                    </h3>
                    <p className="text-[11.5px] font-black text-[#1E5D44] mt-0.5">
                      ₹{item.price.toLocaleString('en-IN')}
                    </p>
                  </div>
                </div>
              );
            })}
  
            {filteredItems.length === 0 && (
              <div className="col-span-2 text-center py-16 space-y-2 bg-slate-50 rounded-3xl border border-dashed border-slate-200 mt-2">
                <p className="text-xs font-black text-slate-500 uppercase tracking-wider">No gourmet menus found</p>
                <p className="text-[10px] text-slate-400 font-bold">Try adjusting your active category tab or search keyword</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
