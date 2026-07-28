import React, { useState } from 'react';
import { 
  ShoppingBag, 
  Search, 
  Percent, 
  CheckCircle, 
  Clock, 
  ChevronRight, 
  ArrowRight,
  TrendingUp,
  Plus,
  Minus
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { groceryProducts } from '../data/mockProducts';

interface GroceryPageProps {
  addToCart: (id: string, name: string, price: number, emoji: string) => void;
  cartItems: { id: string; name: string; price: number; quantity: number; emoji: string }[];
  updateCartQuantity: (id: string, delta: number) => void;
  onProductClick?: (product: any) => void;
}

export default function GroceryPage({ addToCart, cartItems, updateCartQuantity, onProductClick }: GroceryPageProps) {
  const [selectedGrocCat, setSelectedGrocCat] = useState<string>('All');
  const [addedFeedbackId, setAddedFeedbackId] = useState<string | null>(null);

  const subCategories = [
    { name: 'All', emoji: '🍏' },
    { name: 'Fresh Produce', emoji: '🥦' },
    { name: 'Dairy & Eggs', emoji: '🥚' },
    { name: 'Bakery', emoji: '🍞' },
    { name: 'Beverages', emoji: '🥛' },
    { name: 'Snacks', emoji: '🍿' },
  ];

  const products = groceryProducts;

  const filteredProducts = selectedGrocCat === 'All'
    ? products
    : products.filter(p => p.category === selectedGrocCat);

  const getItemQuantity = (id: string) => {
    const item = cartItems.find(i => i.id === id);
    return item ? item.quantity : 0;
  };

  const handleAddWithFeedback = (id: string, name: string, price: number, emoji: string) => {
    addToCart(id, name, price, emoji);
    setAddedFeedbackId(id);
    setTimeout(() => {
      setAddedFeedbackId(null);
    }, 1200);
  };

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Grocery Supermarket Promo Banner */}
      <div 
        className="relative rounded-[24px] h-32 flex items-center px-5 overflow-hidden shadow-md border border-slate-100 bg-cover bg-center"
        style={{ backgroundImage: `url('https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&q=80&w=500&h=250')` }}
      >
        <div className="absolute inset-0 bg-gradient-to-r from-emerald-950 via-slate-900/95 to-transparent pointer-events-none" />
        
        <div className="relative z-10 max-w-[70%] flex flex-col items-start">
          <span className="text-[8.5px] font-black tracking-widest text-[#56B821] bg-white/10 px-2 py-0.5 rounded uppercase">
            🚀 FA FAST
          </span>
          <h3 className="text-sm font-black mt-1 leading-tight tracking-tight text-white">
            Daily Grocery & Fresh Essentials
          </h3>
          <p className="text-[9px] text-slate-300 mt-1">Delivered to Sunnambukkara Street in exactly 10 minutes!</p>
        </div>
      </div>

      {/* Horizontal Subcategories Row */}
      <div className="space-y-2">
        <h4 className="text-[11px] font-black text-slate-900 px-1 uppercase tracking-wider">
          Supermarket Aisles
        </h4>
        <div className="flex gap-2.5 overflow-x-auto pb-1.5 scrollbar-none snap-x px-1">
          {subCategories.map((sub, index) => (
            <button
              key={index}
              onClick={() => setSelectedGrocCat(sub.name)}
              className={`flex items-center gap-1.5 px-3.5 py-2.5 rounded-2xl snap-start cursor-pointer border transition-all shrink-0 ${
                selectedGrocCat === sub.name
                  ? 'bg-emerald-600 border-emerald-600 text-white shadow-md scale-105 font-black'
                  : 'bg-white border-slate-100 text-slate-700 hover:bg-slate-50'
              }`}
            >
              <span className="text-base">{sub.emoji}</span>
              <span className="text-[10px] tracking-tight">{sub.name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Product List header */}
      <div className="flex items-center justify-between px-1">
        <div>
          <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider">
            {selectedGrocCat === 'All' ? 'Farm-Fresh Staples' : `${selectedGrocCat} Collection`}
          </h4>
          <p className="text-[9px] text-slate-400 font-bold mt-0.5">{filteredProducts.length} items packed with care</p>
        </div>
        <span className="text-[8.5px] font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md flex items-center gap-0.5">
          <Clock size={10} /> 10-Min Delivery
        </span>
      </div>

      {/* List / Grid of Grocery Products with Direct Quantity Counters */}
      <div className="grid grid-cols-2 gap-3.5 pb-6">
        {filteredProducts.map((product) => {
          const qty = getItemQuantity(product.id);
          const isRecentlyAdded = addedFeedbackId === product.id;

          return (
            <div 
              key={product.id}
              className="bg-white rounded-[24px] border border-slate-100 flex flex-col justify-between overflow-hidden group hover:shadow-md transition-all duration-300 relative"
            >
              <div 
                onClick={() => onProductClick && onProductClick({ ...product, app: 'GROCERY' })}
                className="cursor-pointer"
              >
                {/* Image Frame - 1:1 Aspect ratio (perfect square) */}
                <div className="aspect-square w-full bg-slate-50 relative overflow-hidden shrink-0">
                  <img 
                    src={product.image} 
                    alt={product.name} 
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    referrerPolicy="no-referrer"
                  />
                  {product.badge && (
                    <span className="absolute top-2 left-2 text-[7px] font-black bg-emerald-500 text-white px-2 py-0.5 rounded-full uppercase tracking-wider shadow-xs">
                      {product.badge}
                    </span>
                  )}
                </div>

                {/* Content */}
                <div className="p-3.5 space-y-1">
                  <div className="flex items-center gap-1 flex-wrap">
                    <span className="text-[7.5px] font-black text-emerald-600 bg-emerald-50 border border-emerald-100/50 px-1.5 py-0.2 rounded uppercase">
                      ★ {product.rating}
                    </span>
                    <span className="text-[7.5px] font-bold text-slate-400 uppercase tracking-wide">
                      {product.unit}
                    </span>
                  </div>

                  <h5 className="text-[10px] font-black text-slate-950 truncate leading-snug group-hover:text-emerald-700 transition-colors">
                    {product.name}
                  </h5>

                  <p className="text-[8px] text-slate-400 font-semibold line-clamp-2 min-h-[22px] leading-tight">
                    {product.desc}
                  </p>
                </div>
              </div>

              {/* Price & Action Row */}
              <div className="p-3.5 pt-0 mt-auto">
                <div className="flex items-center justify-between border-t border-slate-50 pt-2.5">
                  <span className="text-[10.5px] font-black text-slate-900 leading-none">
                    ₹{product.price.toLocaleString('en-IN')}
                  </span>

                  {qty > 0 ? (
                    <div className="flex items-center gap-1 bg-emerald-50 border border-emerald-200/50 p-0.5 rounded-lg">
                      <button
                        type="button"
                        onClick={() => updateCartQuantity(product.id, -1)}
                        className="w-5 h-5 rounded-md hover:bg-emerald-100 active:scale-95 flex items-center justify-center text-emerald-700 font-extrabold text-xs transition-colors border-none bg-transparent cursor-pointer"
                      >
                        <Minus size={9} className="stroke-[3]" />
                      </button>
                      <span className="text-[9.5px] font-black text-emerald-800 min-w-[12px] text-center">
                        {qty}
                      </span>
                      <button
                        type="button"
                        onClick={() => updateCartQuantity(product.id, 1)}
                        className="w-5 h-5 rounded-md hover:bg-emerald-100 active:scale-95 flex items-center justify-center text-emerald-700 font-extrabold text-xs transition-colors border-none bg-transparent cursor-pointer"
                      >
                        <Plus size={9} className="stroke-[3]" />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleAddWithFeedback(product.id, product.name, product.price, product.emoji)}
                      className={`h-6.5 px-3 rounded-lg text-[8px] font-black uppercase tracking-wider transition-all border-none cursor-pointer flex items-center justify-center gap-0.5 ${
                        isRecentlyAdded 
                          ? 'bg-emerald-600 text-white animate-pulse'
                          : 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-xs'
                      }`}
                    >
                      {isRecentlyAdded ? (
                        <CheckCircle size={10} className="stroke-[3]" />
                      ) : (
                        <span>ADD</span>
                      )}
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
