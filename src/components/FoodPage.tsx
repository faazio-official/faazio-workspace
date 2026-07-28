import React, { useState, useEffect, useRef } from 'react';
import { 
  Utensils, 
  Clock, 
  MapPin, 
  Star, 
  ChevronRight, 
  Search, 
  Bell, 
  CheckCircle,
  Calendar,
  Users,
  Check,
  Sparkles,
  ArrowLeft,
  Heart,
  Store,
  Filter,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { topOfWeekDishes as topOfWeekDishesList, foodStores, StoreProfile } from '../data/mockProducts';

// Central Database for Vetted Dining Dishes and associated Restaurants/Hotels
const BOOKING_DISHES_DB = [
  {
    id: 'bd-1',
    name: 'Garasen Vegetarian Platter',
    restaurant: 'The Green Garden Bistro',
    category: 'Vegan',
    tab: 'Dinner',
    rating: '4.9',
    tags: 'Vegetables • Salad • Hummus',
    price: '₹250',
    emoji: '🥗',
    isSpecial: true,
    image: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&q=80&w=400&h=300',
  },
  {
    id: 'bd-2',
    name: 'Pesto Vegan Penne',
    restaurant: 'The Green Garden Bistro',
    category: 'Vegan',
    tab: 'Dinner',
    rating: '4.8',
    tags: 'Pasta • Organic • Greens',
    price: '₹320',
    emoji: '🍝',
    isSpecial: false,
    image: 'https://images.unsplash.com/photo-1473093295043-cdd812d0e601?auto=format&fit=crop&q=80&w=400&h=300',
  },
  {
    id: 'bd-3',
    name: 'Neapolitan Margherita Pizza',
    restaurant: 'Milano Pizza & Pasta Co.',
    category: 'Pizza',
    tab: 'Dinner',
    rating: '4.9',
    tags: 'Cheese • Tomato • Basil',
    price: '₹380',
    emoji: '🍕',
    isSpecial: true,
    image: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&q=80&w=400&h=300',
  },
  {
    id: 'bd-4',
    name: 'Spicy Truffle Pizza',
    restaurant: 'Milano Pizza & Pasta Co.',
    category: 'Pizza',
    tab: 'Dinner',
    rating: '4.7',
    tags: 'Mushroom • Arugula • Truffle',
    price: '₹450',
    emoji: '🍕',
    isSpecial: false,
    image: 'https://images.unsplash.com/photo-1574071318508-1cdbab80d002?auto=format&fit=crop&q=80&w=400&h=300',
  },
  {
    id: 'bd-5',
    name: 'Omahs Salmon Sushi Rolls',
    restaurant: 'Kyoto House Sushi Bar',
    category: 'Sushi',
    tab: 'Dinner',
    rating: '4.9',
    tags: 'Raw Fish • Rice • Wasabi',
    price: '₹490',
    emoji: '🍣',
    isSpecial: true,
    image: 'https://images.unsplash.com/photo-1579871494447-9811cf80d66c?auto=format&fit=crop&q=80&w=400&h=300',
  },
  {
    id: 'bd-6',
    name: 'Premium Classic Hot Dog',
    restaurant: 'Broadway Diner & Hotdogs',
    category: 'Hot Dog',
    tab: 'Dinner',
    rating: '4.6',
    tags: 'Sausage • Mustard • Relish',
    price: '₹190',
    emoji: '🌭',
    isSpecial: false,
    image: 'https://images.unsplash.com/photo-1619740455993-9e612b1af08a?auto=format&fit=crop&q=80&w=400&h=300',
  },
  {
    id: 'bd-7',
    name: 'Morning Berry Granola',
    restaurant: 'Aura Organic Kitchen',
    category: 'Vegan',
    tab: 'Breakfast',
    rating: '4.8',
    tags: 'Yogurt • Oats • Mixed Berries',
    price: '₹180',
    emoji: '🥣',
    isSpecial: true,
    image: 'https://images.unsplash.com/photo-1488477181946-6428a0291777?auto=format&fit=crop&q=80&w=400&h=300',
  },
  {
    id: 'bd-8',
    name: 'English Toast & Hash Combo',
    restaurant: 'Aura Organic Kitchen',
    category: 'Hot Dog',
    tab: 'Breakfast',
    rating: '4.7',
    tags: 'Eggs • Bacon • Beans',
    price: '₹220',
    emoji: '🍳',
    isSpecial: false,
    image: 'https://images.unsplash.com/photo-1533089860892-a7c6f0a88666?auto=format&fit=crop&q=80&w=400&h=300',
  }
];

interface FoodPageProps {
  addToCart: (id: string, name: string, price: number, emoji: string) => void;
  activeSubMode?: 'order' | 'booking';
  setActiveSubMode?: (mode: 'order' | 'booking') => void;
  searchFocusedInitially?: boolean;
  onProductClick?: (product: any) => void;
}

export default function FoodPage({ 
  addToCart, 
  activeSubMode: propActiveSubMode, 
  setActiveSubMode: propSetActiveSubMode,
  searchFocusedInitially = false,
  onProductClick
}: FoodPageProps) {
  // Toggle: 'order' (Food Order) vs 'booking' (Dinner Booking)
  const [localActiveSubMode, localSetActiveSubMode] = useState<'order' | 'booking'>('order');
  
  const activeSubMode = propActiveSubMode !== undefined ? propActiveSubMode : localActiveSubMode;
  const setActiveSubMode = propSetActiveSubMode !== undefined ? propSetActiveSubMode : localSetActiveSubMode;

  const [searchQuery, setSearchQuery] = useState('');
  const [addedId, setAddedId] = useState<string | null>(null);

  // Dynamic Vendor Sorting & Filtering Engines
  const [filterVegOnly, setFilterVegOnly] = useState(false);
  const [filterFastDelivery, setFilterFastDelivery] = useState(false);
  const [sortBy, setSortBy] = useState<'rating' | 'time' | 'distance'>('rating');
  const [selectedStore, setSelectedStore] = useState<StoreProfile | null>(null);

  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (searchFocusedInitially && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [searchFocusedInitially]);

  // Dinner Booking specific states
  const [selectedDate, setSelectedDate] = useState<string>('2026-07-08');
  const [selectedTime, setSelectedTime] = useState<string>('19:00');
  const [guestsCount, setGuestsCount] = useState<number>(2);
  const [bookedRestaurant, setBookedRestaurant] = useState<string | null>(null);
  const [bookingConfirmed, setBookingConfirmed] = useState(false);
  const [selectedBookingCategory, setSelectedBookingCategory] = useState<string>('Vegan');
  const [selectedBookingTab, setSelectedBookingTab] = useState<string>('Dinner');
  const [bookingFormOpen, setBookingFormOpen] = useState(false);
  const [bookingFormRestaurant, setBookingFormRestaurant] = useState<string>('Garasen Vegetarian');
  const [bookingFormPrice, setBookingFormPrice] = useState<string>('₹250');
  const [selectedBookingDish, setSelectedBookingDish] = useState<any>(null);
  const [addedRecommendedIds, setAddedRecommendedIds] = useState<string[]>([]);

  // Sample restaurants for Dinner Booking
  const dinnerRestaurants = [
    { id: 'dr-1', name: 'Le Crillon Fine Dining', cuisine: 'French Modern', rating: '4.9', price: '₹₹₹₹', image: 'https://images.unsplash.com/photo-1514933651103-005eec06c04b?auto=format&fit=crop&q=80&w=300&h=200', address: 'Sunset Blvd, Bandra West' },
    { id: 'dr-2', name: 'The Golden Pavilion', cuisine: 'Authentic Cantonese', rating: '4.8', price: '₹₹₹', image: 'https://images.unsplash.com/photo-1552566626-52f8b828add9?auto=format&fit=crop&q=80&w=300&h=200', address: 'Marine Drive, Nariman Point' },
    { id: 'dr-3', name: 'Aura Organic Kitchen', cuisine: 'Healthy Vegan', rating: '4.7', price: '₹₹', image: 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&q=80&w=300&h=200', address: 'Linking Road, Santa Cruz' }
  ];

  const topOfWeekDishes = topOfWeekDishesList;

  const handleAddToCartWithFeedback = (id: string, name: string, price: number, emoji: string) => {
    addToCart(id, name, price, emoji);
    setAddedId(id);
    setTimeout(() => {
      setAddedId(null);
    }, 1500);
  };

  const handleConfirmBooking = (resName: string) => {
    setBookedRestaurant(resName);
    setBookingConfirmed(true);
    setTimeout(() => {
      setBookingConfirmed(false);
    }, 4000);
  };

  return (
    <div className="space-y-4 animate-fade-in text-slate-850">
      {/* iOS-Style Toggle Segment Control (Food Order vs Dinner Booking) - Premium UX */}
      <div className="bg-slate-100 p-1 rounded-2xl flex items-center relative z-10 w-full select-none shadow-[inset_0_1px_2px_rgba(0,0,0,0.05)] border border-slate-200/40">
        <button
          onClick={() => setActiveSubMode('order')}
          className={`flex-1 py-2 text-[11px] font-black tracking-wider uppercase text-center rounded-xl transition-all duration-300 border-none relative cursor-pointer ${
            activeSubMode === 'order' 
              ? 'text-white bg-[#1E5D44] shadow-md scale-[1.02]' 
              : 'text-slate-500 hover:text-slate-800 bg-transparent'
          }`}
        >
          Food Order
        </button>
        <button
          onClick={() => setActiveSubMode('booking')}
          className={`flex-1 py-2 text-[11px] font-black tracking-wider uppercase text-center rounded-xl transition-all duration-300 border-none relative cursor-pointer ${
            activeSubMode === 'booking' 
              ? 'text-white bg-[#1E5D44] shadow-md scale-[1.02]' 
              : 'text-slate-500 hover:text-slate-800 bg-transparent'
          }`}
        >
          Dinner Booking
        </button>
      </div>

      {/* Conditional Sub-mode Render */}
      <AnimatePresence mode="wait">
        {activeSubMode === 'order' ? (
          <motion.div
            key="food-order-mode"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25 }}
            className="space-y-4"
          >
            {/* Search Input: Matches "Search on Food" exactly as in image */}
            <div className="relative">
              <span className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                <Search size={18} className="text-slate-400" />
              </span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search on Food"
                className="w-full h-11 pl-11 pr-4 bg-slate-100/90 hover:bg-slate-100 focus:bg-white text-[12px] font-black text-slate-800 placeholder-slate-400 rounded-2xl border border-slate-200/50 shadow-sm focus:outline-none focus:ring-2 focus:ring-[#1E5D44]/30 focus:border-[#1E5D44] transition-all"
              />
            </div>

            {/* Emerald Green Address Card: Matches Image exactly */}
            <div className="bg-[#1E5D44] rounded-[24px] p-5 text-white shadow-md relative overflow-hidden group hover:scale-[1.01] transition-transform duration-300">
              {/* Subtle background curved vector graphic */}
              <div className="absolute right-0 bottom-0 w-32 h-32 rounded-full border-[18px] border-white/5 opacity-10 translate-x-10 translate-y-10" />
              <div className="absolute right-4 bottom-4 w-16 h-16 rounded-full bg-white/5 blur-md pointer-events-none" />

              <div className="flex items-center justify-between z-10 relative">
                <div>
                  <span className="text-[10px] font-black tracking-wider text-emerald-300 uppercase">
                    Delivery to Home
                  </span>
                  <h4 className="text-sm font-black text-white mt-1 leading-tight tracking-tight">
                    Utama Street no. 14, Rumbai
                  </h4>
                  {/* Distance badge matching image */}
                  <div className="mt-3 inline-flex items-center px-3 py-1 bg-white text-[#1E5D44] font-black text-[9.5px] rounded-xl shadow-sm tracking-tight">
                    2.4 km
                  </div>
                </div>

                {/* Right Arrow Chevron matching image */}
                <button className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 flex items-center justify-center text-white border-none cursor-pointer transition-all">
                  <ChevronRight size={18} className="stroke-[3]" />
                </button>
              </div>
            </div>

            {/* Premium Interactive Teriyaki Promo Card: Matches Image exactly */}
            <div className="bg-[#F2F5F3] rounded-[24px] p-5 shadow-sm border border-slate-200/30 flex items-center justify-between overflow-hidden relative group hover:shadow-md transition-all duration-300">
              <div className="max-w-[55%] flex flex-col items-start z-10">
                <h3 className="text-sm font-black text-slate-900 leading-tight">
                  Chicken Teriyaki
                </h3>
                <span className="text-[10px] font-black text-emerald-700 bg-emerald-50 border border-emerald-100/50 px-2 py-0.5 rounded-md mt-1">
                  Discount 25%
                </span>
                
                <button 
                  onClick={() => handleAddToCartWithFeedback('tow-special', 'Premium Chicken Teriyaki Special', 280, '🍱')}
                  className={`mt-4 px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all border-none cursor-pointer shadow-sm flex items-center gap-1 ${
                    addedId === 'tow-special'
                      ? 'bg-emerald-600 text-white'
                      : 'bg-[#1E5D44] hover:bg-[#154230] text-white active:scale-95'
                  }`}
                >
                  {addedId === 'tow-special' ? (
                    <>
                      <Check size={10} className="stroke-[3]" />
                      <span>Added!</span>
                    </>
                  ) : (
                    <span>Order Now</span>
                  )}
                </button>
              </div>

              {/* Teriyaki bowl image perfectly matching the right circular visual style in image */}
              <div className="w-[124px] h-[124px] rounded-full overflow-hidden shrink-0 border-4 border-white shadow-md relative group-hover:scale-105 transition-transform duration-500">
                <img 
                  src="https://images.unsplash.com/photo-1598515214211-89d3c73ae83b?auto=format&fit=crop&q=80&w=300&h=300" 
                  alt="Chicken Teriyaki"
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              </div>
            </div>

            {/* Top of Week Section: Horizontal scrollable matching image exactly */}
            <div className="space-y-3">
              <div className="flex items-center justify-between px-1">
                <h4 className="text-[12px] font-black text-slate-900 uppercase tracking-wider">
                  Top of Week
                </h4>
                <span className="text-[9px] font-bold text-[#1E5D44]">Weekly Specials</span>
              </div>

              <div className="flex gap-4 overflow-x-auto pb-3.5 scrollbar-none snap-x px-0.5">
                {topOfWeekDishes
                  .filter(d => d.name.toLowerCase().includes(searchQuery.toLowerCase()))
                  .map((dish) => {
                    const isAdded = addedId === dish.id;
                    return (
                      <div
                        key={dish.id}
                        className="bg-white rounded-[24px] border border-slate-100 shadow-[0_4px_16px_rgba(0,0,0,0.02)] hover:border-slate-200 flex flex-col w-[170px] shrink-0 snap-start overflow-hidden group hover:shadow-md transition-all duration-300"
                      >
                        {/* Food card image on top */}
                        <div 
                          onClick={() => onProductClick && onProductClick({ ...dish, price: dish.price / 10, app: 'FOOD' })}
                          className="h-28 w-full relative overflow-hidden bg-slate-50 shrink-0 cursor-pointer"
                        >
                          <img 
                            src={dish.image} 
                            alt={dish.name}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                            referrerPolicy="no-referrer"
                          />
                        </div>

                        {/* Title and Green Price matching layout */}
                        <div className="p-3.5 flex-1 flex flex-col justify-between">
                          <div>
                            <h5 
                              onClick={() => onProductClick && onProductClick({ ...dish, price: dish.price / 10, app: 'FOOD' })}
                              className="text-[10px] font-black text-slate-900 line-clamp-1 leading-tight group-hover:text-[#1E5D44] cursor-pointer transition-colors"
                            >
                              {dish.name}
                            </h5>
                            <p className="text-[8px] text-slate-400 font-medium mt-0.5 line-clamp-2 leading-tight">
                              {dish.desc}
                            </p>
                          </div>

                          <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-slate-50">
                            <span className="text-[11px] font-black text-[#1E5D44]">
                              ₹{dish.price.toLocaleString('en-IN')}
                            </span>

                            <button
                              type="button"
                              onClick={() => handleAddToCartWithFeedback(dish.id, dish.name, dish.price, dish.emoji)}
                              className={`h-6.5 px-3 rounded-lg text-[8.5px] font-black uppercase tracking-wider transition-all border-none cursor-pointer ${
                                isAdded 
                                  ? 'bg-emerald-500 text-white shadow-sm'
                                  : 'bg-slate-100 hover:bg-[#1E5D44] text-slate-700 hover:text-white'
                              }`}
                            >
                              {isAdded ? <Check size={10} className="stroke-[3]" /> : 'ADD'}
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>

            {/* Dynamic Vendor Sorting & Filtering Engines & Restaurant Directory */}
            <div className="space-y-3 pt-2">
              {selectedStore ? (
                /* Store Profile & Product Catalog Mode */
                <div className="space-y-4 animate-fade-in pb-4">
                  <div className="flex items-center justify-between px-1">
                    <button
                      onClick={() => setSelectedStore(null)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-black text-xs rounded-xl border-none cursor-pointer transition-all"
                    >
                      <ArrowLeft size={14} />
                      <span>Back to All Restaurants</span>
                    </button>
                    {selectedStore.isVeg && (
                      <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-lg flex items-center gap-1">
                        🌱 100% Pure Veg
                      </span>
                    )}
                  </div>

                  {/* Restaurant Hero Banner */}
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
                        <span className="text-slate-400">({selectedStore.reviewsCount || 400}+)</span>
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
                            <Clock size={12} className="text-emerald-600" />
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

                  {/* Restaurant Menu Items Grid */}
                  <div className="space-y-2">
                    <h4 className="text-xs font-black text-slate-900 px-1 uppercase tracking-wider flex items-center gap-1.5">
                      <Utensils size={14} className="text-[#1E5D44]" />
                      Full Menu & Specialties
                    </h4>
                    <div className="grid grid-cols-2 gap-3">
                      {topOfWeekDishes.map((dish) => {
                        const isAdded = addedId === dish.id;
                        return (
                          <div 
                            key={dish.id}
                            className="bg-white rounded-[24px] border border-slate-100 p-3 shadow-sm flex flex-col justify-between group"
                          >
                            <div 
                              onClick={() => onProductClick && onProductClick({ ...dish, price: dish.price / 10, app: 'FOOD', shop: selectedStore.name })}
                              className="w-full h-24 rounded-xl bg-slate-50 overflow-hidden relative cursor-pointer"
                            >
                              <img src={dish.image} alt={dish.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform" referrerPolicy="no-referrer" />
                              <span className="absolute top-1.5 left-1.5 bg-[#1E5D44] text-white text-[7.5px] font-black px-1.5 py-0.5 rounded shadow-sm">
                                {selectedStore.name.split(' ')[0]} Special
                              </span>
                            </div>
                            <div className="mt-2">
                              <h5 
                                onClick={() => onProductClick && onProductClick({ ...dish, price: dish.price / 10, app: 'FOOD', shop: selectedStore.name })}
                                className="text-[11px] font-black text-slate-900 line-clamp-1 cursor-pointer hover:text-[#1E5D44]"
                              >
                                {dish.name}
                              </h5>
                              <p className="text-[8.5px] text-slate-400 line-clamp-1 mt-0.5">{dish.desc}</p>
                              <div className="flex items-center justify-between mt-2 pt-1.5 border-t border-slate-50">
                                <span className="text-xs font-black text-[#1E5D44]">₹{dish.price}</span>
                                <button
                                  onClick={() => handleAddToCartWithFeedback(dish.id, dish.name, dish.price, dish.emoji)}
                                  className={`px-2.5 py-1 rounded-lg text-[8.5px] font-black uppercase transition-all border-none cursor-pointer ${
                                    isAdded ? 'bg-emerald-500 text-white' : 'bg-[#1E5D44] text-white hover:bg-[#154230]'
                                  }`}
                                >
                                  {isAdded ? '✓ Added' : '+ Add'}
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ) : (
                /* Restaurants & Food Vendors Directory */
                <div className="space-y-3">
                  <div className="flex items-center justify-between px-1">
                    <div>
                      <h4 className="text-[12px] font-black text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                        <Store size={15} className="text-[#1E5D44]" />
                        Explore Restaurants & Kitchens
                      </h4>
                      <p className="text-[9px] text-slate-400 font-bold mt-0.5">Filter & sort nearby vetted food partners</p>
                    </div>
                    <span className="text-[9.5px] font-black text-[#1E5D44] bg-emerald-50 px-2 py-0.5 rounded-md">
                      {foodStores.filter(s => {
                        if (filterVegOnly && !s.isVeg) return false;
                        if (filterFastDelivery && parseInt(s.deliveryTime) > 30) return false;
                        if (searchQuery && !s.name.toLowerCase().includes(searchQuery.toLowerCase()) && !s.categories.some(c => c.toLowerCase().includes(searchQuery.toLowerCase()))) return false;
                        return true;
                      }).length} Available
                    </span>
                  </div>

                  {/* Filters and Sorting Control Bar */}
                  <div className="flex flex-wrap items-center gap-1.5 px-1 pb-1">
                    {/* 100% Pure Veg Toggle */}
                    <button
                      onClick={() => setFilterVegOnly(!filterVegOnly)}
                      className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[9.5px] font-black cursor-pointer transition-all border ${
                        filterVegOnly 
                          ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm' 
                          : 'bg-white text-slate-700 border-slate-200 hover:border-emerald-500'
                      }`}
                    >
                      <span>🌱</span>
                      <span>100% Pure Veg</span>
                    </button>

                    {/* Under 30 Mins Toggle */}
                    <button
                      onClick={() => setFilterFastDelivery(!filterFastDelivery)}
                      className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[9.5px] font-black cursor-pointer transition-all border ${
                        filterFastDelivery 
                          ? 'bg-[#1E5D44] text-white border-[#1E5D44] shadow-sm' 
                          : 'bg-white text-slate-700 border-slate-200 hover:border-[#1E5D44]'
                      }`}
                    >
                      <span>⚡</span>
                      <span>Under 30 Mins</span>
                    </button>

                    {/* Sort Selector */}
                    <div className="flex items-center bg-slate-100 rounded-xl p-0.5 border border-slate-200/60">
                      {[
                        { id: 'rating', label: '⭐ Rating' },
                        { id: 'time', label: '🕒 Fastest' },
                        { id: 'distance', label: '📍 Nearest' }
                      ].map((s) => (
                        <button
                          key={s.id}
                          onClick={() => setSortBy(s.id as any)}
                          className={`px-2 py-1 rounded-lg text-[9px] font-black cursor-pointer transition-all border-none ${
                            sortBy === s.id ? 'bg-white text-slate-900 shadow-sm' : 'bg-transparent text-slate-500 hover:text-slate-800'
                          }`}
                        >
                          {s.label}
                        </button>
                      ))}
                    </div>

                    {/* Persistent Clear All Filters Pill */}
                    {(filterVegOnly || filterFastDelivery || sortBy !== 'rating') && (
                      <button
                        onClick={() => {
                          setFilterVegOnly(false);
                          setFilterFastDelivery(false);
                          setSortBy('rating');
                        }}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[9px] font-black text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-200 cursor-pointer transition-all"
                      >
                        <X size={12} className="stroke-[3]" />
                        <span>Clear All Filters</span>
                      </button>
                    )}
                  </div>

                  {/* Restaurants Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 px-1">
                    {foodStores
                      .filter(store => {
                        if (filterVegOnly && !store.isVeg) return false;
                        if (filterFastDelivery && parseInt(store.deliveryTime) > 30) return false;
                        if (searchQuery && !store.name.toLowerCase().includes(searchQuery.toLowerCase()) && !store.categories.some(c => c.toLowerCase().includes(searchQuery.toLowerCase()))) return false;
                        return true;
                      })
                      .sort((a, b) => {
                        if (sortBy === 'rating') return b.rating - a.rating;
                        if (sortBy === 'time') return parseInt(a.deliveryTime) - parseInt(b.deliveryTime);
                        if (sortBy === 'distance') return parseFloat(a.distance) - parseFloat(b.distance);
                        return 0;
                      })
                      .map((store) => (
                        <div
                          key={store.id}
                          onClick={() => setSelectedStore(store)}
                          className="bg-white rounded-[20px] border border-slate-100 p-3 shadow-sm hover:shadow-md hover:border-emerald-200 transition-all cursor-pointer group flex items-center gap-3 relative overflow-hidden"
                        >
                          <div className="w-16 h-16 rounded-2xl bg-slate-100 overflow-hidden shrink-0 relative">
                            <img src={store.coverImage} alt={store.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" referrerPolicy="no-referrer" />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex items-end justify-center pb-1">
                              <span className="text-base">{store.emoji}</span>
                            </div>
                            {store.isVeg && (
                              <span className="absolute top-1 left-1 bg-emerald-600 text-white text-[7px] font-black px-1 py-0.5 rounded shadow-sm">
                                VEG
                              </span>
                            )}
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <h5 className="text-xs font-black text-slate-900 truncate group-hover:text-[#1E5D44] transition-colors">
                                {store.name}
                              </h5>
                              <span className="text-[9px] font-black text-amber-500 flex items-center gap-0.5 bg-amber-50 px-1.5 py-0.5 rounded-md shrink-0">
                                ★ {store.rating}
                              </span>
                            </div>
                            <p className="text-[9.5px] text-slate-500 line-clamp-1 mt-0.5">{store.desc}</p>
                            <div className="flex items-center gap-2 mt-2 text-[9px] font-bold text-slate-600">
                              <span className="flex items-center gap-0.5 text-[#1E5D44] bg-emerald-50 px-1.5 py-0.5 rounded">
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

                          <div className="w-7 h-7 rounded-full bg-slate-50 group-hover:bg-[#1E5D44] group-hover:text-white text-slate-400 flex items-center justify-center transition-all shrink-0">
                            <ChevronRight size={14} />
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="dinner-booking-mode"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25 }}
            className="space-y-4"
          >
            {/* Top Header Section with vivid green background matching Mockup */}
            <div className="bg-[#54B175] text-white p-5 rounded-[28px] -mx-4 -mt-4 space-y-4 shadow-[0_4px_20px_rgba(84,177,117,0.15)]">
              {/* Profile Avatar and Greeting */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <img 
                      src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=150&h=150" 
                      alt="User avatar" 
                      className="w-11 h-11 rounded-full object-cover border-2 border-white/85 shadow-sm" 
                    />
                    <span className="absolute top-0 right-0 w-3 h-3 bg-[#4ade80] rounded-full border-2 border-[#54B175]" />
                  </div>
                  <div>
                    <span className="text-[10px] text-white/80 font-bold block leading-none">Let's order a food,</span>
                    <span className="text-sm font-black text-white mt-1 block leading-none">Faizal Basha</span>
                  </div>
                </div>

                {/* Orange Shopping Cart Badge */}
                <div className="w-10 h-10 rounded-full bg-[#FFA500] shadow-[0_4px_10px_rgba(255,165,0,0.3)] flex items-center justify-center cursor-pointer hover:scale-105 active:scale-95 transition-all">
                  <span className="text-lg">🛒</span>
                </div>
              </div>

              {/* Central Search Input Bar */}
              <div className="relative flex items-center gap-3 bg-white px-4 py-2.5 rounded-2xl shadow-sm text-slate-800">
                <ArrowLeft size={16} className="text-slate-400 cursor-pointer" onClick={() => setActiveSubMode('order')} />
                <input 
                  ref={searchInputRef}
                  type="text"
                  placeholder="Find for food or resto ..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="flex-1 bg-transparent border-none focus:outline-none text-xs font-semibold placeholder-slate-400"
                />
                <div className="flex items-center text-slate-400">
                  <Search size={16} className="mr-3" />
                  <div className="w-[1.5px] h-4 bg-slate-200 mr-3" />
                  {/* Custom horizontal slider filter icon */}
                  <div className="w-6 h-6 rounded-lg bg-[#54B175]/10 flex items-center justify-center text-[#54B175] cursor-pointer">
                    <span className="text-xs">⚙️</span>
                  </div>
                </div>
              </div>

              {/* Horizontal Category Tabs: Breakfast, Dinner, Have Lunch */}
              <div className="flex items-center gap-5 pt-1.5 select-none text-[12px] font-black tracking-wide">
                {[
                  { id: 'Breakfast', label: 'Breakfast', badge: '24' },
                  { id: 'Dinner', label: 'Dinner' },
                  { id: 'Have Lunch', label: 'Have Lunch' }
                ].map((tab) => {
                  const isActive = selectedBookingTab === tab.id;
                  return (
                    <div 
                      key={tab.id}
                      onClick={() => setSelectedBookingTab(tab.id)}
                      className="flex items-center gap-1.5 cursor-pointer relative py-1 transition-all"
                    >
                      <span className={isActive ? 'text-white' : 'text-white/60 hover:text-white/90'}>
                        {tab.label}
                      </span>
                      {tab.badge && (
                        <span className="bg-[#FFA500] text-white text-[8px] font-black px-1.5 py-0.5 rounded-md leading-none">
                          {tab.badge}
                        </span>
                      )}
                      {isActive && (
                        <motion.div 
                          layoutId="activeDinnerTabUnderline"
                          className="absolute bottom-0 left-0 right-0 h-0.5 bg-white rounded-full"
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Floating Quick Category Bubble Box */}
            <div className="bg-white rounded-[24px] p-4 flex justify-between shadow-[0_8px_24px_rgba(0,0,0,0.03)] border border-slate-100/60 mt-[-24px] relative z-20 mx-1">
              {[
                { name: 'Vegan', emoji: '🥦', bg: 'bg-[#EAFDF3] text-[#34C759]' },
                { name: 'Pizza', emoji: '🍕', bg: 'bg-[#FFF3F2] text-[#FF3B30]' },
                { name: 'Sushi', emoji: '🍣', bg: 'bg-[#FFF0F6] text-[#FF2D55]' },
                { name: 'Hot Dog', emoji: '🌭', bg: 'bg-[#FFF9E6] text-[#FF9500]' }
              ].map((cat) => {
                const isActive = selectedBookingCategory === cat.name;
                return (
                  <div 
                    key={cat.name} 
                    onClick={() => setSelectedBookingCategory(cat.name)}
                    className="flex flex-col items-center gap-2 cursor-pointer relative"
                  >
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl transition-all ${cat.bg} ${
                      isActive ? 'ring-2 ring-amber-400 scale-105 shadow-md' : 'hover:scale-[1.02]'
                    }`}>
                      {cat.emoji}
                      {/* Active gold star badge exactly as in mockup */}
                      {isActive && (
                        <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-[#FFA500] text-white text-[7px] flex items-center justify-center border border-white">
                          ★
                        </span>
                      )}
                    </div>
                    <span className={`text-[10px] ${isActive ? 'font-black text-slate-900' : 'font-bold text-slate-400'}`}>
                      {cat.name}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Booking Confirmed Notification Badge */}
            <AnimatePresence>
              {bookingConfirmed && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  className="bg-[#54B175] text-white p-3.5 rounded-[20px] shadow-md flex items-center gap-3.5"
                >
                  <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center shrink-0">
                    <CheckCircle size={18} className="text-white" />
                  </div>
                  <div>
                    <h5 className="text-[11px] font-black">Table Confirmed!</h5>
                    <p className="text-[9px] text-emerald-50 mt-0.5">
                      Your table reservation for {guestsCount} guests at {bookedRestaurant} on {selectedDate} ({selectedTime}) is secured.
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* List of Vetted Fine Dining Kitchen Partners */}
            <div className="space-y-4 pt-2">
              <div className="flex items-center justify-between px-1">
                <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-1">
                  Popular Food 🥞
                </h4>
                <span className="text-[9px] font-bold text-slate-400">Filter: {selectedBookingCategory}</span>
              </div>

              {(() => {
                const filteredDishes = BOOKING_DISHES_DB.filter(dish => {
                  const matchesTab = dish.tab === selectedBookingTab;
                  const matchesCat = dish.category === selectedBookingCategory;
                  return matchesTab && matchesCat;
                });

                const dishesToShow = filteredDishes.length > 0 
                  ? filteredDishes 
                  : BOOKING_DISHES_DB.filter(dish => dish.category === selectedBookingCategory);

                if (dishesToShow.length === 0) {
                  return (
                    <div className="text-center py-8 bg-white rounded-2xl border border-slate-100 p-4">
                      <span className="text-2xl">🍽️</span>
                      <p className="text-xs font-black text-slate-800 mt-2">No active tables found</p>
                      <p className="text-[10px] text-slate-400">Try switching category tabs for fresh vetted items.</p>
                    </div>
                  );
                }

                return dishesToShow.map((res) => (
                  <div
                    key={res.id}
                    onClick={() => {
                      setSelectedBookingDish(res);
                      setBookingFormRestaurant(res.restaurant);
                      setBookingFormPrice(res.price);
                      setBookingFormOpen(true);
                    }}
                    className="bg-white rounded-[28px] border border-slate-100 shadow-sm p-4 hover:shadow-md transition-all cursor-pointer relative overflow-hidden group flex flex-col gap-3"
                  >
                    {/* Large visual Unsplash photo */}
                    <div className="w-full h-44 rounded-[24px] overflow-hidden relative bg-slate-100 border border-slate-200/40">
                      <img 
                        src={res.image} 
                        alt={res.name} 
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" 
                      />
                      
                      {/* Floating Heart Icon badge */}
                      <div className="absolute top-4 right-4 w-9 h-9 rounded-full bg-white/95 shadow-sm flex items-center justify-center cursor-pointer hover:scale-110 active:scale-95 transition-all text-[#FFA500]">
                        <Heart size={16} className="fill-[#FFA500] stroke-none" />
                      </div>
                    </div>

                    <div className="px-1 flex flex-col gap-1">
                      <div className="flex items-center justify-between">
                        <div className="flex flex-col min-w-0 flex-1 pr-2">
                          <span className="text-[9px] font-black tracking-wider text-[#FFA500] uppercase truncate">
                            {res.restaurant}
                          </span>
                          <h4 className="text-sm font-black text-slate-900 truncate mt-0.5">{res.name}</h4>
                        </div>
                        <span className="text-xs font-black text-[#54B175] shrink-0">Starting {res.price}</span>
                      </div>

                      <div className="flex items-center justify-between mt-0.5">
                        <div className="flex items-center gap-1.5 text-[10px] text-slate-500 font-bold">
                          <span className="text-amber-500 font-black">★ {res.rating}</span>
                          <span>•</span>
                          <span>{res.tags}</span>
                        </div>
                        <span className="text-[9px] font-black text-[#1E5D44] bg-[#EAFDF3] px-3 py-1 rounded-full uppercase tracking-wider">
                          Book Table
                        </span>
                      </div>
                    </div>
                  </div>
                ));
              })()}
            </div>

            {/* Interactive Table Reservation Drawer / Form Overlay as a Full-Screen Page Modal */}
            {bookingFormOpen && (
              <div className="fixed inset-0 bg-white z-50 flex flex-col overflow-y-auto pb-6 font-sans">
                {/* Header Navigation */}
                <div className="bg-white border-b border-slate-100 px-4 py-3 flex items-center justify-between sticky top-0 z-20 shadow-xs">
                  <button 
                    onClick={() => setBookingFormOpen(false)}
                    className="w-9 h-9 rounded-xl hover:bg-slate-100 flex items-center justify-center text-slate-700 border-none bg-transparent cursor-pointer transition-all shrink-0"
                  >
                    <ArrowLeft size={18} className="stroke-[2.5]" />
                  </button>
                  <div className="text-center flex-1 px-2">
                    <span className="text-[8px] font-black uppercase text-[#FFA500] tracking-widest block">VIP Table Reservation</span>
                    <h3 className="text-xs font-black text-slate-900 mt-0.5 truncate">
                      {selectedBookingDish?.restaurant || bookingFormRestaurant}
                    </h3>
                  </div>
                  <div className="w-9 h-9 shrink-0" />
                </div>

                {/* Main scrollable view inside the full-page container */}
                <div className="flex-1 space-y-5 py-4">
                  
                  {/* Selected Base Food Item Highlight */}
                  <div className="mx-4 p-4 bg-gradient-to-br from-emerald-500/[0.04] to-amber-500/[0.03] rounded-3xl border border-slate-100 flex items-center gap-4 relative overflow-hidden shadow-xs">
                    <div className="absolute right-0 bottom-0 text-7xl opacity-[0.06] font-black select-none pointer-events-none">
                      🍽️
                    </div>
                    <img 
                      src={selectedBookingDish?.image || 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&q=80&w=150&h=150'} 
                      alt={selectedBookingDish?.name}
                      className="w-16 h-16 rounded-2xl object-cover border border-white shadow-sm shrink-0"
                      referrerPolicy="no-referrer"
                    />
                    <div className="flex-1 min-w-0 z-10">
                      <span className="text-[8px] font-black uppercase bg-[#54B175]/10 text-[#1E5D44] px-2 py-0.5 rounded-full inline-block mb-1">
                        Core Dish Selected
                      </span>
                      <h4 className="text-xs font-black text-slate-900 truncate">
                        {selectedBookingDish?.name || bookingFormRestaurant}
                      </h4>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-[10.5px] font-black text-[#54B175]">{selectedBookingDish?.price || bookingFormPrice}</span>
                        <span className="text-[9px] text-slate-400 font-bold">• Reserved Table Seat Included</span>
                      </div>
                    </div>
                  </div>

                  {/* Tactile Reservation Settings Card */}
                  <div className="bg-white mx-4 p-4 rounded-3xl border border-slate-100 space-y-4 shadow-xs">
                    <h4 className="text-[10px] font-black text-slate-900 uppercase tracking-wider border-b border-slate-50 pb-1.5">
                      📅 Reservation Setup
                    </h4>
                    
                    <div className="grid grid-cols-2 gap-3">
                      {/* Date Input */}
                      <div className="space-y-1">
                        <label className="text-[8.5px] font-black text-slate-400 uppercase tracking-wider block flex items-center gap-1">
                          <Calendar size={10} className="text-[#54B175]" />
                          <span>Select Date</span>
                        </label>
                        <input 
                          type="date" 
                          value={selectedDate}
                          onChange={(e) => setSelectedDate(e.target.value)}
                          className="w-full h-9 px-2.5 bg-slate-50 text-[10px] font-black text-slate-700 border border-slate-200/60 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#54B175]/30 focus:border-[#54B175] transition-all"
                        />
                      </div>

                      {/* Time Slot Select */}
                      <div className="space-y-1">
                        <label className="text-[8.5px] font-black text-slate-400 uppercase tracking-wider block flex items-center gap-1">
                          <Clock size={10} className="text-[#54B175]" />
                          <span>Time Slot</span>
                        </label>
                        <select 
                          value={selectedTime}
                          onChange={(e) => setSelectedTime(e.target.value)}
                          className="w-full h-9 px-2 bg-slate-50 text-[10px] font-black text-slate-700 border border-slate-200/60 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#54B175]/30 focus:border-[#54B175] transition-all"
                        >
                          <option value="18:00">06:00 PM (Sunset)</option>
                          <option value="19:00">07:00 PM (Prime)</option>
                          <option value="20:00">08:00 PM (Dinner)</option>
                          <option value="21:00">09:00 PM (Late Night)</option>
                        </select>
                      </div>
                    </div>

                    {/* Guests Pills */}
                    <div className="space-y-2">
                      <label className="text-[8.5px] font-black text-slate-400 uppercase tracking-wider block flex items-center gap-1">
                        <Users size={10} className="text-[#54B175]" />
                        <span>Number of Guests</span>
                      </label>
                      <div className="flex gap-1.5">
                        {[1, 2, 4, 6, 8].map((num) => (
                          <button
                            key={num}
                            onClick={() => setGuestsCount(num)}
                            className={`flex-1 h-9 rounded-xl text-[10px] font-black border transition-all cursor-pointer flex items-center justify-center gap-0.5 ${
                              guestsCount === num 
                                ? 'bg-[#54B175] border-[#54B175] text-white shadow-md' 
                                : 'bg-slate-50 border-slate-150 text-slate-600 hover:bg-slate-100'
                            }`}
                          >
                            <span>{num}</span>
                            <span className="text-[8px] opacity-75">Pax</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Iconic Dishes & Today's Specials visual marketing block */}
                  <div className="space-y-3 mx-4">
                    <div className="flex items-center justify-between px-0.5">
                      <div className="flex flex-col">
                        <span className="text-[8px] font-black text-[#FFA500] uppercase tracking-widest">Highly Recommended</span>
                        <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-1 mt-0.5">
                          <Sparkles size={14} className="text-[#FFA500] fill-[#FFA500]/10 animate-pulse" />
                          <span>Iconic Dishes & Today's Special</span>
                        </h4>
                      </div>
                      <span className="text-[8.5px] font-black uppercase text-[#FFA500] bg-[#FFF9E6] px-2 py-0.5 rounded-full shrink-0">
                        Popular Pairs
                      </span>
                    </div>

                    <div className="flex gap-4 overflow-x-auto pb-4 pt-1 px-1 -mx-4 scrollbar-none snap-x snap-mandatory">
                      <div className="w-3 shrink-0" />
                      {BOOKING_DISHES_DB.filter(dish => dish.id !== selectedBookingDish?.id).map((recDish) => {
                        const isAdded = addedRecommendedIds.includes(recDish.id);
                        return (
                          <div 
                            key={recDish.id}
                            className="snap-start shrink-0 w-36 bg-white rounded-[24px] border border-slate-100 p-3 flex flex-col justify-between shadow-xs hover:shadow-md hover:border-[#54B175]/30 transition-all relative group"
                          >
                            {recDish.isSpecial && (
                              <span className="absolute top-2 left-2 z-10 text-[7px] font-black uppercase bg-[#FFA500] text-white px-2 py-0.5 rounded-full tracking-wider">
                                Special 🔥
                              </span>
                            )}

                            <div className="flex-1">
                              <div className="h-24 bg-slate-50 rounded-2xl flex items-center justify-center mb-2 overflow-hidden relative border border-slate-100">
                                <img 
                                  src={recDish.image} 
                                  alt={recDish.name} 
                                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" 
                                  referrerPolicy="no-referrer" 
                                />
                                <span className="absolute bottom-2 right-2 bg-black/60 backdrop-blur-md text-white text-[8px] font-bold px-1.5 py-0.5 rounded-md">
                                  ★ {recDish.rating}
                                </span>
                              </div>
                              
                              <span className="text-[8px] text-slate-400 font-extrabold uppercase block truncate">
                                {recDish.restaurant}
                              </span>
                              <h5 className="text-[10px] font-black text-slate-800 leading-tight line-clamp-2 mt-0.5 min-h-[24px]">
                                {recDish.name}
                              </h5>
                            </div>

                            <div className="flex items-center justify-between mt-2 pt-1.5 border-t border-slate-50">
                              <span className="text-[10px] font-black text-[#54B175]">{recDish.price}</span>
                              <button
                                onClick={() => {
                                  const priceNum = parseInt(recDish.price.replace(/[^\d]/g, ''));
                                  addToCart(recDish.id, recDish.name, priceNum, recDish.emoji);
                                  setAddedRecommendedIds(prev => [...prev, recDish.id]);
                                }}
                                className={`w-7 h-7 rounded-full flex items-center justify-center transition-all border-none cursor-pointer shadow-xs ${
                                  isAdded ? 'bg-[#54B175] text-white' : 'bg-slate-900 hover:bg-black text-white'
                                }`}
                              >
                                {isAdded ? <Check size={11} strokeWidth={3} /> : <span className="text-[11px] font-black">+</span>}
                              </button>
                            </div>
                          </div>
                        );
                      })}
                      <div className="w-3 shrink-0" />
                    </div>
                  </div>

                </div>

                {/* Elegant bottom sticky action summary */}
                <div className="bg-white border-t border-slate-100 p-4 sticky bottom-0 z-20 shadow-md">
                  <div className="flex items-center justify-between text-slate-500 font-bold text-[10px] px-1 mb-2.5">
                    <span>Reservation Summary</span>
                    <span className="text-slate-800 font-black">
                      {guestsCount} Guests • {selectedDate} @ {selectedTime}
                    </span>
                  </div>
                  <button
                    onClick={() => {
                      const rest = selectedBookingDish?.restaurant || bookingFormRestaurant;
                      setBookedRestaurant(rest);

                      // Save real booking data to localStorage
                      const newBooking = {
                        id: 'BKG-' + Math.floor(100000 + Math.random() * 900000),
                        restaurant: rest,
                        dishName: selectedBookingDish?.name || rest,
                        guestsCount: guestsCount,
                        date: selectedDate,
                        time: selectedTime,
                        price: selectedBookingDish?.price || bookingFormPrice,
                        image: selectedBookingDish?.image || 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&q=80&w=400&h=300',
                        status: 'Confirmed',
                        createdAt: new Date().toLocaleDateString()
                      };
                      try {
                        const existing = JSON.parse(localStorage.getItem('faazio_bookings') || '[]');
                        localStorage.setItem('faazio_bookings', JSON.stringify([newBooking, ...existing]));
                      } catch (e) {
                        console.error('Error saving booking:', e);
                      }

                      setBookingConfirmed(true);
                      setBookingFormOpen(false);
                      setTimeout(() => {
                        setBookingConfirmed(false);
                      }, 5000);
                    }}
                    className="w-full h-11 bg-[#54B175] hover:bg-[#459a63] text-white font-black text-[11px] uppercase tracking-wider rounded-2xl border-none cursor-pointer shadow-lg shadow-[#54B175]/15 transition-all flex items-center justify-center gap-2 hover:scale-[1.01] active:scale-[0.99]"
                  >
                    <span>Confirm Table Reservation ({selectedBookingDish?.price || bookingFormPrice})</span>
                    <span className="text-[9px] bg-white/20 px-2 py-0.5 rounded-full text-white">PROMO PASS</span>
                  </button>
                </div>

              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
