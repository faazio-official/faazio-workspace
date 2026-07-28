import React, { useState } from 'react';
import { 
  ArrowLeft, 
  Home, 
  LayoutGrid, 
  Compass, 
  User, 
  ShoppingBag, 
  Activity, 
  MapPin, 
  Bell, 
  Search, 
  ChevronDown,
  Percent,
  CheckCircle,
  Plus,
  Minus,
  Check,
  Calendar,
  Sparkles,
  Heart,
  BriefcaseMedical,
  Cookie,
  Apple,
  Store,
  CreditCard,
  Phone,
  Settings,
  MessageSquare,
  FileText
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import FoodPage from './FoodPage';
import FoodMenuView from './FoodMenuView';
import FaMartPage from './FaMartPage';
import GroceryPage from './GroceryPage';
import PharmaPage from './PharmaPage';
import AccountView from './AccountView';
import CartView from './CartView';

interface SubAppWrapperProps {
  subAppId: 'FA_MART' | 'FOOD' | 'GROCERY' | 'PHARMA';
  onExit: () => void;
  addToCart: (id: string, name: string, price: number, emoji: string) => void;
  cartItems: { id: string; name: string; price: number; quantity: number; emoji: string }[];
  setCartItems: React.Dispatch<React.SetStateAction<{ id: string; name: string; price: number; quantity: number; emoji: string }[]>>;
  updateCartQuantity: (id: string, delta: number) => void;
  handleReset: (e?: React.MouseEvent) => void;
  setShowLocationRequestState: (val: boolean) => void;
  setIsLoggedIn: (val: boolean) => void;
  onProductClick?: (product: any) => void;
}

export default function SubAppWrapper({ 
  subAppId, 
  onExit, 
  addToCart, 
  cartItems, 
  setCartItems,
  updateCartQuantity,
  handleReset,
  setShowLocationRequestState,
  setIsLoggedIn,
  onProductClick
}: SubAppWrapperProps) {
  
  // Each sub-app has its own unique bottom navbar and navigation states
  const [activeTab, setActiveTab] = useState<string>('Home');
  const [activeSubMode, setActiveSubMode] = useState<'order' | 'booking'>('order');
  const [showExitConfirm, setShowExitConfirm] = useState<boolean>(false);
  const [touchStartX, setTouchStartX] = useState<number | null>(null);

  const handleSubModeChange = (mode: 'order' | 'booking') => {
    setActiveSubMode(mode);
    setActiveTab('Home');
  };

  // Let's configure brand presets based on subAppId
  const config = {
    FA_MART: {
      name: 'FA MART',
      primaryColor: 'bg-[#1162D3]',
      textColor: 'text-[#1162D3]',
      borderColor: 'border-[#1162D3]',
      accentColor: '#1162D3',
      tabs: [
        { name: 'Home', icon: Home },
        { name: 'Categories', icon: LayoutGrid },
        { name: 'Cart', icon: ShoppingBag },
        { name: 'Profile', icon: User }
      ]
    },
    FOOD: {
      name: 'Food',
      primaryColor: 'bg-[#1E5D44]',
      textColor: 'text-[#1E5D44]',
      borderColor: 'border-[#1E5D44]',
      accentColor: '#1E5D44',
      tabs: activeSubMode === 'order' 
        ? [
            { name: 'Home', icon: Home },
            { name: 'Menu', icon: LayoutGrid },
            { name: 'Cart', icon: ShoppingBag },
            { name: 'Profile', icon: User }
          ]
        : [
            { name: 'Home', icon: Home },
            { name: 'Search', icon: Search },
            { name: 'My Bookings', icon: Calendar },
            { name: 'Profile', icon: User }
          ]
    },
    GROCERY: {
      name: 'FA Grocery',
      primaryColor: 'bg-emerald-600',
      textColor: 'text-emerald-600',
      borderColor: 'border-emerald-600',
      accentColor: '#10B981',
      tabs: [
        { name: 'Home', icon: Home },
        { name: 'Aisles', icon: LayoutGrid },
        { name: 'Smart Cart', icon: ShoppingBag },
        { name: 'Profile', icon: User }
      ]
    },
    PHARMA: {
      name: 'FA Pharma',
      primaryColor: 'bg-[#FF7A59]',
      textColor: 'text-[#FF7A59]',
      borderColor: 'border-[#FF7A59]',
      accentColor: '#FF7A59',
      tabs: [
        { name: 'Home', icon: Home },
        { name: 'For You', icon: Sparkles },
        { name: 'Cart', icon: ShoppingBag },
        { name: 'History', icon: FileText }
      ]
    }
  }[subAppId];

  const totalCartQty = cartItems.reduce((acc, curr) => acc + curr.quantity, 0);

  // Structured views rendering inside the sub-apps
  const renderSubAppContent = () => {
    // Centralized Cart and Profile tabs across ALL four sub-apps
    if (activeTab === 'Cart' || activeTab === 'Smart Cart') {
      return (
        <CartView 
          cartItems={cartItems} 
          setCartItems={setCartItems} 
          updateCartQuantity={updateCartQuantity} 
          setActiveTab={(tab) => {
            if (tab === 'Home') setActiveTab('Home');
            else if (tab === 'Account') setActiveTab('Profile');
          }} 
        />
      );
    }
    if (activeTab === 'Profile') {
      return (
        <AccountView 
          handleReset={handleReset} 
          setShowLocationRequestState={setShowLocationRequestState} 
          setIsLoggedIn={setIsLoggedIn} 
        />
      );
    }

    switch (subAppId) {
      case 'FOOD':
        if (activeTab === 'Home' || activeTab === 'Search') {
          return (
            <FoodPage 
              addToCart={addToCart} 
              activeSubMode={activeSubMode} 
              setActiveSubMode={handleSubModeChange}
              searchFocusedInitially={activeTab === 'Search'}
              onProductClick={onProductClick}
            />
          );
        }
        if (activeTab === 'Menu') {
          return <FoodMenuView addToCart={addToCart} onProductClick={onProductClick} />;
        }
        if (activeTab === 'My Bookings') {
          let bookings = [];
          try {
            bookings = JSON.parse(localStorage.getItem('faazio_bookings') || '[]');
          } catch (e) {
            console.error(e);
          }

          return (
            <div className="space-y-4 animate-fade-in p-1 text-slate-850">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[8px] font-black text-[#54B175] uppercase tracking-widest block">VIP DINING PASS</span>
                  <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider">My Reservations</h4>
                </div>
                <span className="text-[9px] font-black uppercase text-[#54B175] bg-[#EAF7EE] px-2.5 py-1 rounded-full shrink-0">
                  {bookings.filter((b: any) => b.status === 'Confirmed').length} Active
                </span>
              </div>

              {bookings.length === 0 ? (
                <div className="bg-white p-8 rounded-[24px] border border-slate-100 text-center space-y-3.5 shadow-xs">
                  <div className="w-12 h-12 rounded-full bg-[#EAF7EE] flex items-center justify-center mx-auto text-[#1E5D44] border border-emerald-100/50">
                    <Calendar size={18} />
                  </div>
                  <div>
                    <h5 className="text-xs font-black text-slate-800">No Reservations Yet</h5>
                    <p className="text-[9.5px] text-slate-400 max-w-[200px] mx-auto leading-relaxed mt-0.5">
                      Explore our curated gourmet partners, select your preferred table menu, and book instantly!
                    </p>
                  </div>
                  <button
                    onClick={() => setActiveTab('Home')}
                    className="h-8 px-4 bg-slate-900 hover:bg-black text-white rounded-xl text-[9px] font-black uppercase tracking-wider border-none cursor-pointer transition-colors"
                  >
                    Browse Partners
                  </button>
                </div>
              ) : (
                <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1 scrollbar-none">
                  {bookings.map((b: any) => (
                    <div 
                      key={b.id} 
                      className={`bg-white rounded-[24px] border p-3.5 flex flex-col gap-3 shadow-xs relative overflow-hidden transition-all duration-300 ${
                        b.status === 'Cancelled' ? 'opacity-65 border-slate-100' : 'border-slate-100 hover:border-[#54B175]/30'
                      }`}
                    >
                      <span className={`absolute top-3.5 right-3.5 text-[8px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${
                        b.status === 'Cancelled' ? 'bg-slate-100 text-slate-500' : 'bg-[#EAF7EE] text-[#1E5D44]'
                      }`}>
                        {b.status}
                      </span>

                      <div className="flex items-center gap-3">
                        <img 
                          src={b.image} 
                          alt={b.restaurant} 
                          className="w-12 h-12 rounded-xl object-cover border border-slate-100 shrink-0"
                          referrerPolicy="no-referrer"
                        />
                        <div className="min-w-0 flex-1">
                          <span className="text-[8.5px] font-black text-[#FFA500] uppercase tracking-wider truncate block">
                            {b.restaurant}
                          </span>
                          <h5 className="text-[11.5px] font-black text-slate-900 truncate leading-tight mt-0.5">
                            {b.dishName}
                          </h5>
                          <p className="text-[9px] text-slate-400 font-bold mt-0.5">
                            Booking ID: {b.id}
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-1 bg-slate-50 p-2 rounded-xl border border-slate-100 text-center divide-x divide-slate-150">
                        <div>
                          <span className="text-[7px] font-bold text-slate-400 uppercase block">Guests</span>
                          <span className="text-[9.5px] font-black text-slate-800 block mt-0.5">{b.guestsCount} Pax</span>
                        </div>
                        <div>
                          <span className="text-[7px] font-bold text-slate-400 uppercase block">Date</span>
                          <span className="text-[9.5px] font-black text-slate-800 block mt-0.5 truncate">{b.date}</span>
                        </div>
                        <div>
                          <span className="text-[7px] font-bold text-slate-400 uppercase block">Time Slot</span>
                          <span className="text-[9.5px] font-black text-[#54B175] block mt-0.5">
                            {b.time === '18:00' ? '06:00 PM' : b.time === '19:00' ? '07:00 PM' : b.time === '20:00' ? '08:00 PM' : '09:00 PM'}
                          </span>
                        </div>
                      </div>

                      {b.status === 'Confirmed' && (
                        <div className="flex gap-2 justify-end mt-0.5">
                          <button
                            onClick={() => {
                              try {
                                const updated = bookings.map((item: any) => 
                                  item.id === b.id ? { ...item, status: 'Cancelled' } : item
                                );
                                localStorage.setItem('faazio_bookings', JSON.stringify(updated));
                                // Trigger re-render
                                setActiveTab('My Bookings');
                              } catch (e) {
                                console.error(e);
                              }
                            }}
                            className="h-7 px-3 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 border-none text-[8.5px] font-black uppercase tracking-wider cursor-pointer transition-colors"
                          >
                            Cancel Table
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        }
        if (activeTab === 'Profile') {
          return (
            <div className="bg-white p-5 rounded-[24px] border border-slate-100 shadow-sm space-y-4 text-slate-850">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center font-black text-slate-700">F</div>
                <div>
                  <h4 className="text-xs font-black text-slate-900">Food Account</h4>
                  <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Premium Dine Club Member</span>
                </div>
              </div>
              <div className="space-y-2 pt-2 border-t border-slate-100 text-[10px] font-bold text-slate-600">
                <div className="flex justify-between py-1.5 border-b border-slate-50">
                  <span>Registered Name</span>
                  <span className="text-slate-900">Faizal Basha</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-50">
                  <span>Default Address</span>
                  <span className="text-slate-900 truncate max-w-[180px]">Utama Street no. 14, Rumbai</span>
                </div>
                <div className="flex justify-between py-1.5">
                  <span>Helpline Chat Support</span>
                  <span className="text-[#1E5D44] font-black">Online 🟢</span>
                </div>
              </div>
            </div>
          );
        }
        break;

      case 'FA_MART':
        if (activeTab === 'Home') {
          return <FaMartPage addToCart={addToCart} onProductClick={onProductClick} />;
        }
        if (activeTab === 'Categories') {
          return (
            <div className="space-y-4 animate-fade-in p-1">
              <h4 className="text-sm font-black text-slate-900 uppercase tracking-wider">Mall Categories</h4>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { name: 'Smart Phones', desc: 'Sleek OLED screens', icon: '📱' },
                  { name: 'Casual Wear', desc: 'Classic custom cottons', icon: '👕' },
                  { name: 'Acoustic Sound', desc: 'Noise-canceling gears', icon: '🎧' },
                  { name: 'Fitness Gear', desc: 'Heart trackers & weights', icon: '🏋️' }
                ].map((cat, idx) => (
                  <div key={idx} className="bg-white p-4 rounded-2xl border border-slate-100 flex items-center gap-3 shadow-sm hover:border-blue-300 transition-all cursor-pointer">
                    <span className="text-2xl">{cat.icon}</span>
                    <div>
                      <h5 className="text-[11px] font-black text-slate-900">{cat.name}</h5>
                      <span className="text-[8.5px] text-slate-400 font-bold block">{cat.desc}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        }
        if (activeTab === 'Offers') {
          return (
            <div className="space-y-4 animate-fade-in p-1">
              <h4 className="text-sm font-black text-slate-900 uppercase tracking-wider">Active Promo Codes</h4>
              <div className="space-y-3">
                {[
                  { code: 'FAAZIO50', desc: 'Flat 50% discount on all custom tech accessories.', expiry: 'Expires tomorrow' },
                  { code: 'SUPERSTYLE', desc: 'Buy 1 Get 1 free on all premium Winter Hoodies.', expiry: 'Limited period offer' }
                ].map((offer, idx) => (
                  <div key={idx} className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200/60 p-4 rounded-2xl flex justify-between items-center gap-4">
                    <div>
                      <span className="text-[10px] font-black text-blue-800 bg-white px-2.5 py-1 rounded-md border border-blue-200">{offer.code}</span>
                      <p className="text-[9.5px] text-slate-700 font-black mt-2 leading-tight">{offer.desc}</p>
                      <span className="text-[8.5px] text-slate-400 font-bold mt-1 block">{offer.expiry}</span>
                    </div>
                    <button className="px-3 py-1.5 bg-blue-600 text-white font-black text-[9px] rounded-lg border-none cursor-pointer">APPLY</button>
                  </div>
                ))}
              </div>
            </div>
          );
        }
        break;

      case 'GROCERY':
        if (activeTab === 'Home') {
          return <GroceryPage addToCart={addToCart} cartItems={cartItems} updateCartQuantity={updateCartQuantity} onProductClick={onProductClick} />;
        }
        if (activeTab === 'Aisles') {
          return (
            <div className="space-y-4 animate-fade-in p-1">
              <h4 className="text-sm font-black text-slate-900 uppercase tracking-wider">Aisle Map</h4>
              <p className="text-[10px] text-slate-400 font-bold leading-tight">Fresh organic foods categorized perfectly for lightning fast discovery.</p>
              <div className="grid grid-cols-2 gap-3 pt-2">
                {[
                  { name: 'Greens & Orchard', count: '14 Fresh Items', bg: 'bg-emerald-50 text-emerald-800' },
                  { name: 'Dairy Cold Room', count: '10 Vetted Milks', bg: 'bg-sky-50 text-sky-800' },
                  { name: 'Bakery Hearth', count: '6 Warm Loaves', bg: 'bg-amber-50 text-amber-800' },
                  { name: 'Sweet Beverages', count: '12 Plant Milks', bg: 'bg-indigo-50 text-indigo-800' }
                ].map((aisle, idx) => (
                  <div key={idx} className={`${aisle.bg} p-4 rounded-2xl border border-transparent hover:scale-102 transition-transform cursor-pointer`}>
                    <h5 className="text-[11px] font-black leading-tight">{aisle.name}</h5>
                    <span className="text-[8.5px] font-bold opacity-80 mt-1 block">{aisle.count}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        }
        if (activeTab === 'Fresh Club') {
          return (
            <div className="bg-white p-5 rounded-[24px] border border-slate-100 shadow-sm space-y-4 text-slate-850 animate-fade-in">
              <div className="flex items-center gap-2">
                <Sparkles className="text-amber-500 fill-amber-100" size={18} />
                <h4 className="text-xs font-black text-slate-950 uppercase tracking-wider">Fresh Club Membership</h4>
              </div>
              <p className="text-[9.5px] text-slate-500 font-medium leading-relaxed">
                Unlock continuous <strong>Free Delivery</strong>, double reward points, and dynamic early access to morning farm hand-picks.
              </p>
              <div className="p-3.5 bg-emerald-50 rounded-xl border border-emerald-100">
                <span className="text-[8px] font-black text-emerald-800 uppercase tracking-wider block">YOUR SAVINGS SCORE</span>
                <span className="text-xl font-black text-emerald-950 block mt-1">₹4,820 Saved</span>
                <span className="text-[8.5px] text-slate-400 font-bold mt-0.5 block">In the last 30 days</span>
              </div>
            </div>
          );
        }
        break;

      case 'PHARMA':
        // Inside pharma, let's delegate home content to PharmaPage
        return (
          <PharmaPage 
            addToCart={addToCart} 
            cartItems={cartItems}
            setCartItems={setCartItems}
            updateCartQuantity={updateCartQuantity}
            onProductClick={onProductClick} 
            activeTab={activeTab}
            setActiveTab={setActiveTab}
          />
        );
    }

    // Default Fallback / Cart rendering inside Subapp
    return (
      <div className="space-y-4 animate-fade-in text-slate-850">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-black uppercase tracking-wider text-slate-900">Your Basket</h4>
          <span className="text-[9px] font-black bg-slate-100 px-2 py-0.5 rounded text-slate-500 uppercase">
            {cartItems.length} Unique types
          </span>
        </div>

        {cartItems.length === 0 ? (
          <div className="text-center py-10 bg-white rounded-3xl border border-slate-100 p-6">
            <span className="text-3xl">🛒</span>
            <h5 className="text-[11px] font-black text-slate-800 mt-2">Your basket is empty</h5>
            <p className="text-[9px] text-slate-400 mt-0.5 font-bold">Add some fresh vetted products to get started!</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {cartItems.map((item) => (
              <div 
                key={item.id}
                className="bg-white p-3 rounded-2xl border border-slate-100 flex items-center justify-between gap-3 shadow-sm"
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl w-10 h-10 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center">
                    {item.emoji}
                  </span>
                  <div>
                    <h5 className="text-[11px] font-black text-slate-950 line-clamp-1">{item.name}</h5>
                    <span className="text-[10px] font-bold text-slate-400">₹{item.price.toLocaleString('en-IN')} each</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 bg-slate-50 border border-slate-200/50 p-0.5 rounded-lg">
                  <button
                    onClick={() => updateCartQuantity(item.id, -1)}
                    className="w-5 h-5 rounded hover:bg-slate-200/60 flex items-center justify-center text-slate-700 font-extrabold text-xs transition-colors border-none bg-transparent cursor-pointer"
                  >
                    <Minus size={9} />
                  </button>
                  <span className="text-[10px] font-black text-slate-800 min-w-[12px] text-center">
                    {item.quantity}
                  </span>
                  <button
                    onClick={() => updateCartQuantity(item.id, 1)}
                    className="w-5 h-5 rounded hover:bg-slate-200/60 flex items-center justify-center text-slate-700 font-extrabold text-xs transition-colors border-none bg-transparent cursor-pointer"
                  >
                    <Plus size={9} />
                  </button>
                </div>
              </div>
            ))}

            <div className="bg-white p-4 rounded-2xl border border-slate-100 space-y-2 text-[10px] font-black text-slate-800">
              <div className="flex justify-between">
                <span className="text-slate-400">Subtotal</span>
                <span>
                  ₹{cartItems.reduce((acc, curr) => acc + (curr.price * curr.quantity), 0).toLocaleString('en-IN')}
                </span>
              </div>
              <div className="flex justify-between text-[#1E5D44]">
                <span>Faazio Safe Delivery</span>
                <span>FREE</span>
              </div>
              <div className="flex justify-between pt-2 border-t border-slate-50 text-xs">
                <span>Total Due</span>
                <span>
                  ₹{cartItems.reduce((acc, curr) => acc + (curr.price * curr.quantity), 0).toLocaleString('en-IN')}
                </span>
              </div>
            </div>

            <button 
              onClick={() => {
                alert("Order Placed Successfully! Faazio partners are packing your basket right now.");
              }}
              className={`w-full h-10 mt-2 text-white text-[10px] font-black uppercase tracking-wider rounded-xl border-none cursor-pointer shadow-md transition-colors ${config.primaryColor}`}
            >
              Secure Checkout & Pay
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div 
      onTouchStart={(e) => {
        if (e.touches && e.touches[0].clientX < 40) {
          setTouchStartX(e.touches[0].clientX);
        }
      }}
      onTouchEnd={(e) => {
        if (touchStartX !== null && e.changedTouches && e.changedTouches[0].clientX - touchStartX > 60) {
          setShowExitConfirm(true);
        }
        setTouchStartX(null);
      }}
      className="flex-1 flex flex-col justify-between bg-slate-50 text-slate-900 overflow-hidden relative h-full"
    >
      {/* Dynamic Sub-App Header */}
      <div className="absolute top-0 left-0 right-0 z-30 bg-white border-b border-slate-100 px-4 pt-4 pb-3 flex items-center justify-between shadow-[0_2px_12px_rgba(0,0,0,0.03)] h-16">
        <div className="flex items-center gap-2.5">
          <button 
            onClick={() => {
              setShowExitConfirm(true);
            }}
            className="w-12 h-12 min-w-[48px] min-h-[48px] rounded-xl hover:bg-slate-100 active:scale-90 flex items-center justify-center text-slate-700 border-none bg-transparent cursor-pointer transition-all -ml-2"
            title="Back (48x48dp Touch Target)"
          >
            <ArrowLeft size={22} className="stroke-[2.5]" />
          </button>
          
          <div>
            <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none block">
              FAAZIO APP HUB
            </span>
            <h3 className="text-xs font-black text-slate-900 leading-none mt-1">
              {config.name}
            </h3>
          </div>
        </div>

        {/* Dynamic Location indicator inside Sub-App */}
        <div className="flex items-center gap-1 bg-slate-50 border border-slate-200/50 px-2.5 py-1.5 rounded-xl text-[9px] font-black text-slate-600">
          <MapPin size={10} className="text-[#2F80ED]" />
          <span>Utama St no. 14</span>
        </div>
      </div>

      {/* Main content viewport, fits scroll height perfectly */}
      <div className={`flex-1 ${
        (subAppId === 'FOOD' && activeTab === 'Menu') || subAppId === 'PHARMA'
          ? 'overflow-hidden p-0' 
          : 'overflow-y-auto p-4 space-y-4'
      } pt-17 pb-24 scrollbar-none h-full relative`}>
        {renderSubAppContent()}
      </div>

      {/* Persistent Liquid Sub-App Bottom Navbar */}
      <div className="absolute bottom-0 left-0 right-0 h-[72px] bg-white/95 backdrop-blur-md border-t border-slate-200/50 rounded-t-[28px] flex items-center justify-between px-6 select-none z-40 shadow-[0_-12px_36px_rgba(0,0,0,0.12)]">
        {config.tabs.map((tab, idx) => {
          const isCurrent = activeTab === tab.name;
          const TabIcon = tab.icon;

          return (
            <button
              key={idx}
              type="button"
              onClick={() => setActiveTab(tab.name)}
              className={`flex flex-col items-center justify-center w-14 h-14 rounded-xl transition-all duration-300 relative bg-transparent border-none ${
                isCurrent 
                  ? `${config.textColor} scale-110 font-bold` 
                  : 'text-slate-400/90 hover:text-slate-600'
              }`}
            >
              {isCurrent && (
                <motion.div 
                  layoutId="activeSubTabBubble"
                  className={`absolute -top-[1.5px] left-1/2 -translate-x-1/2 w-8 h-1 ${config.primaryColor} rounded-full shadow-[0_2px_8px_rgba(0,0,0,0.15)]`}
                  transition={{ type: 'spring', stiffness: 350, damping: 25 }}
                />
              )}

              {isCurrent && (
                <motion.div 
                  layoutId="activeSubTabGlow"
                  className="absolute inset-1 rounded-2xl bg-gradient-to-b from-white to-slate-50 border border-white shadow-[inset_0_1.5px_2px_rgba(255,255,255,0.95),0_8px_24px_rgba(0,0,0,0.06),0_1px_3px_rgba(0,0,0,0.02)] -z-10"
                  transition={{ type: 'spring', stiffness: 350, damping: 25 }}
                />
              )}

              <div className="relative">
                <TabIcon size={18} className={isCurrent ? 'stroke-[2.5px]' : 'stroke-[2px]'} />
                {tab.name === 'Cart' && totalCartQty > 0 && (
                  <span className="absolute -top-1.5 -right-2 bg-orange-500 text-white font-black text-[8px] leading-none min-w-[14px] h-[14px] rounded-full flex items-center justify-center px-0.5 border border-white animate-bounce shadow-md">
                    {totalCartQty}
                  </span>
                )}
              </div>
              <span className="text-[8px] font-black tracking-tight mt-1">{tab.name}</span>
            </button>
          );
        })}
      </div>

      {/* Premium In-App Confirmation Modal */}
      {showExitConfirm && (
        <div className="absolute inset-0 z-[100] flex items-end justify-center bg-slate-900/40 backdrop-blur-xs animate-fade-in">
          <div className="absolute inset-0 bg-transparent" onClick={() => setShowExitConfirm(false)} />
          <motion.div 
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="w-full bg-white rounded-t-[32px] p-6 pb-8 border-t border-slate-100 shadow-[0_-12px_40px_rgba(0,0,0,0.15)] flex flex-col gap-4 text-slate-850 z-10"
          >
            <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto" />
            <div className="text-center space-y-1.5 mt-2">
              <h4 className="text-sm font-black text-slate-900 uppercase tracking-wider">
                {subAppId === 'FOOD' ? 'Exit Food?' : subAppId === 'PHARMA' ? 'Exit Pharma?' : subAppId === 'FA_MART' ? 'Exit Mart?' : 'Exit Grocery?'}
              </h4>
              <p className="text-[10px] text-slate-400 font-bold max-w-[240px] mx-auto leading-relaxed">
                Are you sure you want to exit the current service and return to the main Faazio Hub?
              </p>
            </div>
            <div className="flex gap-2.5 mt-2">
              <button
                onClick={() => setShowExitConfirm(false)}
                className="flex-1 h-10 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 border-none text-[9px] font-black uppercase tracking-wider cursor-pointer transition-colors"
              >
                Keep Exploring
              </button>
              <button
                onClick={() => {
                  setShowExitConfirm(false);
                  onExit();
                }}
                className={`flex-1 h-10 rounded-xl text-white border-none text-[9px] font-black uppercase tracking-wider cursor-pointer transition-colors ${config.primaryColor}`}
              >
                Exit to Main App
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
