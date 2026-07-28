import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ChevronRight, 
  ChevronLeft, 
  Eye, 
  EyeOff, 
  ShoppingBag, 
  Utensils, 
  Ticket, 
  Wrench, 
  Search, 
  MapPin, 
  User, 
  LogOut, 
  Bell, 
  Compass, 
  Clock, 
  Heart, 
  ChevronDown,
  Sparkles,
  ArrowRight,
  TrendingUp,
  Percent,
  CheckCircle,
  Truck,
  Star,
  Activity,
  Menu,
  Navigation,
  Home,
  LayoutGrid,
  ShoppingCart,
  Smartphone,
  Sparkle,
  X,
  Lightbulb,
  Shirt
} from 'lucide-react';

import welcomeIllustration1 from './assets/welcome_illustration_1.png';
import welcomeIllustration2 from './assets/welcome_illustration_2.png';
import welcomeIllustration3 from './assets/welcome_illustration_3.png';
import welcomeIllustration4 from './assets/welcome_illustration_4.png';
import phoneAuthBackgroundImg from './assets/phone_auth_background.png';
import locationAccessPageImg from './assets/location_access_page.png';

// Custom modular view components
import HomeView from './components/HomeView';
import CategoriesView from './components/CategoriesView';
import FavouritesView from './components/FavouritesView';
import AccountView from './components/AccountView';
import CartView from './components/CartView';
import SubAppWrapper from './components/SubAppWrapper';
import ProductDetailView from './components/ProductDetailView';

// Brand Logo Component (Renders the custom vector Faazio logo with blue background gradient)
function FaazioLogo({ className = "h-8" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 600 240" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="logoFaazioGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#4e82fe" />
          <stop offset="100%" stopColor="#2c56f6" />
        </linearGradient>
      </defs>
      
      <rect width="600" height="240" rx="36" fill="url(#logoFaazioGrad)" />
      
      <g transform="translate(45, 55)">
        <path d="M 5,115 L 5,68 C 5,68 15,68 25,68 C 25,68 35,68 35,52 L 35,46 L 5,46 L 5,30 C 5,20 18,12 36,12 C 58,12 84,18 108,18 C 118,18 126,14 126,4 C 126,16 114,34 94,34 C 70,34 49,30 35,30 L 35,46 L 94,46 C 114,46 122,60 122,68 C 122,78 112,115 112,115 L 85,115 L 94,68 L 35,68 L 35,115 Z" fill="#ffffff" />
        
        <path d="M 175,117 C 152,117 136,101 136,79 C 136,57 152,41 175,41 C 194,41 206,53 208,68 L 180,68 C 178,62 172,58 166,58 C 158,58 153,65 153,79 C 153,93 158,100 166,100 C 172,100 178,96 180,90 L 208,90 C 206,105 194,117 175,117 Z M 208,115 L 208,44 L 222,44 L 222,115 Z" fill="#ffffff" />
        
        <path d="M 275,117 C 252,117 236,101 236,79 C 236,57 252,41 275,41 C 294,41 306,53 308,68 L 280,68 C 278,62 272,58 266,58 C 258,58 253,65 253,79 C 253,93 258,100 266,100 C 272,100 278,96 280,90 L 308,90 C 308,105 296,117 275,117 Z M 308,115 L 308,44 L 322,44 L 322,115 Z" fill="#ffffff" />
        
        <path d="M 335,44 L 382,44 L 382,58 L 352,101 L 382,101 L 382,115 L 335,115 L 335,101 L 365,58 L 335,58 Z" fill="#ffffff" />
        
        <path d="M 402,115 L 402,44 L 418,44 L 418,115 Z M 410,30 C 416,30 421,25 421,19 C 421,13 416,8 410,8 C 404,8 399,13 399,19 C 399,25 404,30 410,30 Z" fill="#ffffff" />
        
        <path d="M 475,117 C 450,117 432,99 432,79 C 432,59 450,41 475,41 C 500,41 518,59 518,79 C 518,99 500,117 475,117 Z M 475,101 C 488,101 498,91 498,79 C 498,67 488,57 475,57 C 462,57 452,67 452,79 C 452,91 462,101 475,101 Z" fill="#ffffff" />
      </g>
    </svg>
  );
}

function LoginPatternBackground() {
  const emojis = [
    { char: '🛍️', x: '10%', y: '15%', rot: -15, scale: 1.25 },
    { char: '🍔', x: '35%', y: '25%', rot: 10, scale: 1.15 },
    { char: '🛵', x: '60%', y: '10%', rot: -5, scale: 1.3 },
    { char: '🎟️', x: '85%', y: '30%', rot: 15, scale: 1.1 },
    { char: '🛠️', x: '20%', y: '65%', rot: 25, scale: 1.2 },
    { char: '📦', x: '50%', y: '70%', rot: -20, scale: 1.3 },
    { char: '🛒', x: '75%', y: '60%', rot: 12, scale: 1.25 },
    { char: '🍕', x: '90%', y: '75%', rot: -10, scale: 1.15 },
    { char: '👟', x: '5%', y: '45%', rot: 18, scale: 1.1 },
    { char: '✈️', x: '45%', y: '45%', rot: -8, scale: 1.2 },
  ];

  return (
    <div className="absolute inset-0 bg-[#2993f5] overflow-hidden select-none pointer-events-none">
      {/* Soft gradient overlays for lighting and depth */}
      <div className="absolute inset-0 bg-gradient-to-b from-white/10 via-transparent to-black/15" />
      <div className="absolute -inset-10 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.15),transparent_70%)]" />
      
      {emojis.map((e, idx) => (
        <div
          key={idx}
          className="absolute text-3xl drop-shadow-[0_4px_6px_rgba(0,0,0,0.15)] select-none pointer-events-none filter saturate-125 hover:scale-110 transition-transform duration-300"
          style={{
            left: e.x,
            top: e.y,
            transform: `rotate(${e.rot}deg) scale(${e.scale})`,
            opacity: 0.9,
          }}
        >
          {e.char}
        </div>
      ))}
    </div>
  );
}

function SmilingCoinHandIllustration() {
  return (
    <svg viewBox="0 0 100 100" className="w-13 h-13 select-none" xmlns="http://www.w3.org/2000/svg">
      {/* Friendly, polished yellow smile face */}
      <circle cx="50" cy="50" r="45" fill="#ffd037" />
      <circle cx="50" cy="50" r="41" fill="#ffc107" />
      <circle cx="50" cy="50" r="38" fill="#ffd037" />
      
      {/* Eyes with friendly shape */}
      <circle cx="36" cy="42" r="5" fill="#1e293b" />
      <circle cx="64" cy="42" r="5" fill="#1e293b" />
      
      {/* Sparkle/Shine in the eyes for expressive personality */}
      <circle cx="34" cy="40" r="1.5" fill="#ffffff" />
      <circle cx="62" cy="40" r="1.5" fill="#ffffff" />
      
      {/* Blushing cheeks for a warm and welcoming greeting */}
      <ellipse cx="26" cy="54" rx="7" ry="4" fill="#ff8a80" opacity="0.6" />
      <ellipse cx="74" cy="54" rx="7" ry="4" fill="#ff8a80" opacity="0.6" />
      
      {/* Sweet, welcoming curved smiling mouth */}
      <path d="M 32,54 Q 50,68 68,54" stroke="#1e293b" strokeWidth="4.5" strokeLinecap="round" fill="none" />
    </svg>
  );
}

interface OnboardingStep {
  title: string;
  subtitle: string;
  description: string;
  bgColor: string;
  accentColor: string;
  textColor: string;
  bgCircleColor: string;
}

const ONBOARDING_DATA: OnboardingStep[] = [
  {
    title: 'Welcome to Faazio',
    subtitle: 'Your Daily SuperApp',
    description: 'Simplify your life. Shop essentials, order delicious food, book travel tickets, and access trusted local e-services inside one seamless interface.',
    bgColor: 'bg-white',
    accentColor: '#2c56f6', // Consistent Brand Accent
    textColor: 'text-slate-800',
    bgCircleColor: 'bg-slate-100',
  },
  {
    title: 'Smart Shopping',
    subtitle: 'Essentials Made Easy',
    description: 'Experience instant deliveries of groceries, household essentials, and favorite brands from vetted local stores direct to your doorstep.',
    bgColor: 'bg-white',
    accentColor: '#e11d48', // Rose-600
    textColor: 'text-slate-800',
    bgCircleColor: 'bg-slate-100',
  },
  {
    title: 'Satisfy Your Hunger',
    subtitle: 'Hot Food Ordering',
    description: 'Craving something hot and delicious? Order from premier local restaurants and track your delivery in real-time with zero hassle.',
    bgColor: 'bg-white',
    accentColor: '#16a34a', // Green-600
    textColor: 'text-slate-800',
    bgCircleColor: 'bg-slate-100',
  },
  {
    title: 'Instant E-Services',
    subtitle: 'And Hassle-Free Booking',
    description: 'From certified home repairs to booking movie, bus, or train tickets—Faazio handles your entire chore list instantly.',
    bgColor: 'bg-white',
    accentColor: '#9333ea', // Purple-600
    textColor: 'text-slate-800',
    bgCircleColor: 'bg-slate-100',
  },
];

const slideVariants = {
  enter: (direction: 'next' | 'back') => ({
    x: direction === 'next' ? 120 : -120,
    opacity: 0,
    transition: { type: 'tween', ease: 'easeOut', duration: 0.22 }
  }),
  center: {
    x: 0,
    opacity: 1,
    transition: { type: 'tween', ease: 'easeOut', duration: 0.22 }
  },
  exit: (direction: 'next' | 'back') => ({
    x: direction === 'next' ? -120 : 120,
    opacity: 0,
    transition: { type: 'tween', ease: 'easeIn', duration: 0.15 }
  }),
};

export default function App() {
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [isLoginView, setIsLoginView] = useState<boolean>(false);
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);

  // Preload key static images for instant, high-performance loading
  React.useEffect(() => {
    const imagesToPreload = [
      welcomeIllustration1,
      welcomeIllustration2,
      welcomeIllustration3,
      welcomeIllustration4,
      phoneAuthBackgroundImg,
      locationAccessPageImg
    ];
    imagesToPreload.forEach((src) => {
      const img = new Image();
      img.src = src;
    });
  }, []);
  
  // Intermediate States for redirection
  const [showAllDoneState, setShowAllDoneState] = useState<boolean>(false);
  const [showLocationRequestState, setShowLocationRequestState] = useState<boolean>(false);
  
  // Custom 3-Step Location Flow States
  const [showManualLocationState, setShowManualLocationState] = useState<boolean>(false);
  const [showMapLoaderState, setShowMapLoaderState] = useState<boolean>(false);
  const [selectedLocation, setSelectedLocation] = useState<string>('Sunnambukkara Street, Karaikal');
  const [manualSearchQuery, setManualSearchQuery] = useState<string>('');

  // Automatic 2-second transition from "All done!" to "What is your location?"
  React.useEffect(() => {
    if (showAllDoneState) {
      const timer = setTimeout(() => {
        setShowAllDoneState(false);
        setShowLocationRequestState(true);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [showAllDoneState]);

  // Automatic 2-second transition from Map Loader to Logged In Dashboard
  React.useEffect(() => {
    if (showMapLoaderState) {
      const timer = setTimeout(() => {
        showMapLoaderState; // touch to avoid unused warning in some builds
        setShowMapLoaderState(false);
        setIsLoggedIn(true);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [showMapLoaderState]);
  
  // Login Form States
  const [loginPhone, setLoginPhone] = useState<string>('');
  const [showOtpState, setShowOtpState] = useState<boolean>(false);
  const [otpCode, setOtpCode] = useState<string>('');
  const [otpError, setOtpError] = useState<string>('');
  const [isKeyboardActive, setIsKeyboardActive] = useState<boolean>(false);
  const keyboardTimeoutRef = React.useRef<any>(null);
  const phoneInputRef = React.useRef<HTMLInputElement>(null);

  // Auto-focus phone input when login view is shown
  React.useEffect(() => {
    if (isLoginView && !showOtpState && !isLoggedIn && !showAllDoneState && !showLocationRequestState && !showManualLocationState && !showMapLoaderState) {
      setTimeout(() => {
        phoneInputRef.current?.focus();
        setIsKeyboardActive(true);
      }, 300);
    }
  }, [isLoginView, showOtpState, isLoggedIn, showAllDoneState, showLocationRequestState, showManualLocationState, showMapLoaderState]);

  const handleInputFocus = () => {
    if (keyboardTimeoutRef.current) {
      clearTimeout(keyboardTimeoutRef.current);
      keyboardTimeoutRef.current = null;
    }
    setIsKeyboardActive(true);
  };

  const handleInputBlur = () => {
    if (keyboardTimeoutRef.current) {
      clearTimeout(keyboardTimeoutRef.current);
    }
    keyboardTimeoutRef.current = setTimeout(() => {
      setIsKeyboardActive(false);
    }, 150);
  };
  
  // Dashboard states
  const [activeTab, setActiveTab] = useState<'Home' | 'Categories' | 'Favourites' | 'Account' | 'Cart'>('Home');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [activeSubApp, setActiveSubApp] = useState<'MASTER_HUB' | 'FA_MART' | 'FOOD' | 'GROCERY' | 'PHARMA'>('MASTER_HUB');

  // Persisted Favorites State
  const [favorites, setFavorites] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('faazio_favorites');
      return saved ? JSON.parse(saved) : ['exp-sf-1', 'exp-sn-1', 'cat-pb-1', 'cat-fm-1'];
    } catch {
      return ['exp-sf-1', 'exp-sn-1', 'cat-pb-1', 'cat-fm-1'];
    }
  });

  const toggleFavorite = (productId: string) => {
    setFavorites(prev => {
      const isFav = prev.includes(productId);
      const updated = isFav ? prev.filter(id => id !== productId) : [...prev, productId];
      try {
        localStorage.setItem('faazio_favorites', JSON.stringify(updated));
      } catch (e) {
        console.error('Error saving favorites to localStorage', e);
      }
      return updated;
    });
  };

  // Responsive collapsed header states
  const [isHeaderCollapsed, setIsHeaderCollapsed] = useState<boolean>(false);
  const lastScrollY = React.useRef<number>(0);
  const scrollContainerRef = React.useRef<HTMLDivElement>(null);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const scrollTop = e.currentTarget.scrollTop;
    if (scrollTop <= 15) {
      setIsHeaderCollapsed(false);
    } else {
      if (scrollTop > lastScrollY.current) {
        setIsHeaderCollapsed(true);
      } else {
        setIsHeaderCollapsed(false);
      }
    }
    lastScrollY.current = scrollTop;
  };

  // Cart state and handlers
  const [cartItems, setCartItems] = useState<{ id: string; name: string; price: number; quantity: number; emoji: string }[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<any | null>(null);
  const [showProductDetail, setShowProductDetail] = useState<boolean>(false);

  const handleProductClick = (product: any) => {
    setSelectedProduct(product);
    setShowProductDetail(true);
  };

  const addToCart = (id: string, name: string, price: number, emoji: string) => {
    setCartItems(prev => {
      const existing = prev.find(item => item.id === id);
      if (existing) {
        return prev.map(item => item.id === id ? { ...item, quantity: item.quantity + 1 } : item);
      }
      return [...prev, { id, name, price, quantity: 1, emoji }];
    });
  };

  const updateCartQuantity = (id: string, delta: number) => {
    setCartItems(prev => {
      return prev.map(item => {
        if (item.id === id) {
          const newQty = item.quantity + delta;
          return newQty > 0 ? { ...item, quantity: newQty } : null;
        }
        return item;
      }).filter(Boolean) as typeof prev;
    });
  };

  // Animation direction tracking
  const [slideDirection, setSlideDirection] = useState<'next' | 'back'>('next');

  const handleNext = () => {
    setSlideDirection('next');
    if (currentStep < ONBOARDING_DATA.length - 1) {
      setCurrentStep((prev) => prev + 1);
    } else {
      setIsLoginView(true);
    }
  };

  const handleBack = () => {
    setSlideDirection('back');
    if (currentStep > 0) {
      setCurrentStep((prev) => prev - 1);
    }
  };

  const handleSkip = (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (isLoginView) return;
    setSlideDirection('next');
    setIsLoginView(true);
  };

  const handleReset = (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    setCurrentStep(0);
    setIsLoginView(false);
    setIsLoggedIn(false);
    setLoginPhone('');
    setShowOtpState(false);
    setOtpCode('');
    setOtpError('');
    setIsKeyboardActive(false);
    setShowAllDoneState(false);
    setShowLocationRequestState(false);
    setShowManualLocationState(false);
    setShowMapLoaderState(false);
    setSelectedLocation('Sunnambukkara Street, Karaikal');
    setManualSearchQuery('');
    setCartItems([]);
    setActiveTab('Home');
  };

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginPhone) return;
    
    if (!showOtpState) {
      // Transition to OTP state
      setShowOtpState(true);
      setOtpError('');
      setIsKeyboardActive(false);
    } else {
      // Verify code
      if (otpCode === '1234' || otpCode === '123456') {
        setShowAllDoneState(true);
        setOtpError('');
        setIsKeyboardActive(false);
      } else {
        setOtpError('Invalid OTP! Please use 123456.');
      }
    }
  };

  const currentData = ONBOARDING_DATA[currentStep];

  return (
    <div className="h-screen w-screen bg-slate-100 flex items-center justify-center font-sans antialiased overflow-hidden" id="faazio-app-root">
      
      {/* Full-bleed Responsive Mobile App Canvas (No artificial device borders, pure screen edge experience) */}
      <div className="w-full max-w-md h-full md:max-h-[900px] md:rounded-[24px] md:shadow-2xl overflow-hidden bg-white flex flex-col relative md:border md:border-slate-200/60">
        
        <AnimatePresence custom={slideDirection} mode="wait" initial={false}>
          
          {/* 1. ONBOARDING SCREEN VIEW */}
          {!isLoginView && !isLoggedIn && !showAllDoneState && !showLocationRequestState && (
            <motion.div
              key={`onboarding-slide-${currentStep}`}
              custom={slideDirection}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              className={`flex-1 h-full flex flex-col justify-between p-4 sm:p-5 ${currentData.bgColor} transition-colors duration-500 overflow-hidden`}
            >
              {/* Header block */}
              <div className="flex items-center justify-between pt-1">
                <div className="flex items-center space-x-2">
                  <FaazioLogo className="h-7 w-auto shadow-sm rounded-lg" />
                </div>
                <button 
                  type="button"
                  onClick={handleSkip}
                  disabled={isLoginView}
                  className="text-[11px] font-bold px-3 py-1 rounded-full bg-white/80 hover:bg-white text-slate-700 hover:text-slate-900 transition-all shadow-sm disabled:opacity-50"
                >
                  Skip
                </button>
              </div>

              {/* Graphic Vector Artwork - Perfectly bounded to prevent scrolling */}
              <div className="flex-1 flex items-center justify-center min-h-0 my-3">
                <div className="relative w-full max-w-[310px] sm:max-w-[350px] aspect-square bg-transparent flex items-center justify-center shrink-0">
                  
                  {/* Step 1 Graphic: Welcome / Mobile Grid */}
                  {currentStep === 0 && (
                    <motion.div 
                      initial={{ scale: 0.9, y: 5 }}
                      animate={{ scale: 1, y: 0 }}
                      className="w-full h-full"
                    >
                      <img 
                        src={welcomeIllustration1} 
                        alt="Faazio Daily SuperApp Welcome"
                        className="w-full h-full object-contain"
                        referrerPolicy="no-referrer"
                      />
                    </motion.div>
                  )}

                  {/* Step 2 Graphic: Shopping */}
                  {currentStep === 1 && (
                    <motion.div 
                      initial={{ scale: 0.9, rotate: -2 }}
                      animate={{ scale: 1, rotate: 0 }}
                      className="w-full h-full"
                    >
                      <img 
                        src={welcomeIllustration2} 
                        alt="Faazio Smart Shopping Essentials"
                        className="w-full h-full object-contain"
                        referrerPolicy="no-referrer"
                      />
                    </motion.div>
                  )}

                  {/* Step 3 Graphic: Food Ordering */}
                  {currentStep === 2 && (
                    <motion.div 
                      initial={{ scale: 0.9, x: -10 }}
                      animate={{ scale: 1, x: 0 }}
                      className="w-full h-full"
                    >
                      <img 
                        src={welcomeIllustration3} 
                        alt="Faazio Hot Food Delivery"
                        className="w-full h-full object-contain"
                        referrerPolicy="no-referrer"
                      />
                    </motion.div>
                  )}

                  {/* Step 4 Graphic: E-Services & Booking */}
                  {currentStep === 3 && (
                    <motion.div 
                      initial={{ scale: 0.9, rotate: 2 }}
                      animate={{ scale: 1, rotate: 0 }}
                      className="w-full h-full"
                    >
                      <img 
                        src={welcomeIllustration4} 
                        alt="Faazio E-Services and Tickets Booking"
                        className="w-full h-full object-contain"
                        referrerPolicy="no-referrer"
                      />
                    </motion.div>
                  )}

                </div>
              </div>

              {/* Text Information - perfectly sized and tight to block scrolling */}
              <div className="text-center px-4 my-1 shrink-0">
                <h2 className="text-[20px] sm:text-2xl font-black text-slate-950 tracking-tight leading-tight font-display">
                  {currentData.title}
                </h2>
                <h3 className="text-xs sm:text-sm font-bold mt-1 tracking-wide uppercase" style={{ color: currentData.accentColor }}>
                  {currentData.subtitle}
                </h3>
                
                {/* Horizontal Accent Line */}
                <div 
                  className="w-10 h-0.5 mx-auto my-2.5 rounded-full transition-colors duration-500" 
                  style={{ backgroundColor: currentData.accentColor }}
                />

                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed font-sans max-w-sm mx-auto">
                  {currentData.description}
                </p>
              </div>

              {/* Footer Controls - perfectly snug at the bottom edge */}
              <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-200/50 shrink-0">
                
                {/* Dot step indicator */}
                <div className="flex items-center space-x-1">
                  {ONBOARDING_DATA.map((_, index) => {
                    const isActive = index === currentStep;
                    return (
                      <div
                        key={index}
                        className={`h-1.5 rounded-full transition-all duration-300 ${isActive ? 'w-5 bg-blue-600 shadow-sm' : 'w-1.5 bg-slate-300'}`}
                      />
                    );
                  })}
                </div>

                {/* Back and Next Buttons Row */}
                <div className="flex items-center space-x-2">
                  {currentStep > 0 && (
                    <button
                      onClick={handleBack}
                      className="px-3.5 py-2 rounded-full bg-slate-200/80 hover:bg-slate-300 text-slate-700 font-bold text-xs transition-all active:scale-95 flex items-center gap-0.5"
                    >
                      <ChevronLeft size={12} />
                      Back
                    </button>
                  )}
                  
                  <button
                    onClick={handleNext}
                    className="h-9 px-4 rounded-full bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs transition-all flex items-center justify-center gap-0.5 shadow-md shadow-blue-500/10 active:scale-95"
                  >
                    <span>{currentStep === ONBOARDING_DATA.length - 1 ? 'Get Started' : 'Next'}</span>
                    <ChevronRight size={12} />
                  </button>
                </div>

              </div>
            </motion.div>
          )}

          {/* 2. LOGIN SCREEN VIEW */}
          {isLoginView && !isLoggedIn && !showAllDoneState && !showLocationRequestState && !showManualLocationState && !showMapLoaderState && (
            <motion.div
              key="login-screen-view"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex-1 h-full flex flex-col text-white overflow-hidden relative select-none bg-gradient-to-b from-[#2c56f6] to-[#122bb3]"
            >
              {!showOtpState ? (
                <>
                  {/* Back button to return to onboarding - high visibility solid circular design */}
                  <button 
                    onClick={handleReset}
                    className="absolute top-4 left-4 z-40 w-10 h-10 rounded-full bg-white text-slate-800 hover:bg-slate-50 flex items-center justify-center transition-all shadow-md active:scale-90 border border-slate-100/10"
                    title="Go back to onboarding"
                  >
                    <ChevronLeft size={20} strokeWidth={2.5} />
                  </button>

                  {/* Top background illustration section - normal flex child with dynamic height to prevent black/peeking corner lines */}
                  <div 
                    onClick={() => setIsKeyboardActive(false)}
                    className={`transition-all duration-300 ${isKeyboardActive ? 'h-[20%] opacity-100 cursor-pointer' : 'h-[45%] opacity-100 cursor-pointer'} w-full relative overflow-hidden shrink-0 z-0 bg-white`}
                  >
                    <img 
                      src={phoneAuthBackgroundImg} 
                      alt="Faazio Phone Auth Header Background" 
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  </div>

                  {/* Middle content section with highly pronounced physical roundness - friendly bottom sheet pattern */}
                  {/* Uses negative margin to overlap top section beautifully, preventing any back-layer peek-through, and expands to full height when keyboard is active */}
                  <div 
                    onClick={() => setIsKeyboardActive(false)}
                    className={`flex-1 bg-gradient-to-b from-[#2c56f6] to-[#122bb3] relative flex flex-col justify-between px-6 z-10 rounded-t-[44px] sm:rounded-t-[48px] shadow-[0_-15px_35px_rgba(0,0,0,0.18)] border-t border-white/10 transition-all duration-300 ${isKeyboardActive ? 'mt-0 pt-8 pb-12' : '-mt-10 pt-12 pb-10'}`}
                  >
                    
                    {/* Overlapping White Circle Badge positioned perfectly on the peak of the sheet */}
                    {/* Selected section - we never hide this section on focus as requested */}
                    <div 
                      onClick={(e) => e.stopPropagation()}
                      className="absolute left-1/2 -translate-x-1/2 -top-11 rounded-full bg-white shadow-xl flex items-center justify-center border-4 border-white/20 z-25 transition-all duration-300 w-22 h-22 opacity-100 scale-100"
                    >
                      <div>
                        <SmilingCoinHandIllustration />
                      </div>
                    </div>

                    {/* 1. Explore Header Block */}
                    <div className={`relative text-center transition-all duration-300 ${isKeyboardActive ? 'mt-2 mb-2' : 'mt-4 mb-3'} shrink-0 select-none`}>
                      <h1 className={`text-white font-black tracking-tight leading-none uppercase drop-shadow-sm font-sans transition-all duration-300 ${isKeyboardActive ? 'text-[28px]' : 'text-[42px]'}`}>
                        Explore
                      </h1>
                    </div>

                    {/* 2. Interactive Form Container (Lifted above the keyboard) */}
                    <form 
                      onSubmit={handleLoginSubmit} 
                      onClick={(e) => e.stopPropagation()}
                      className="flex-1 flex flex-col justify-center gap-3.5 max-w-sm mx-auto w-full mb-1 cursor-default"
                    >
                      {/* PHONE ENTRY STATE */}
                      <div className="space-y-3.5">
                        {/* Pill-shaped Mobile Input Box */}
                        <div 
                          onClick={(e) => e.stopPropagation()}
                          className="flex items-center bg-white rounded-full px-5 py-3 shadow-[0_12px_25px_rgba(0,0,0,0.16)] border border-white/10 w-full group transition-all focus-within:ring-2 focus-within:ring-[#41E68F]"
                        >
                          <span className="text-[#212121] font-bold text-sm mr-2.5 shrink-0 select-none">
                            (+91)
                          </span>
                          <div className="w-px h-4 bg-slate-200 mr-2.5 shrink-0" />
                          <input 
                            ref={phoneInputRef}
                            type="tel"
                            maxLength={10}
                            required
                            value={loginPhone}
                            onFocus={handleInputFocus}
                            onBlur={handleInputBlur}
                            onChange={(e) => {
                              const val = e.target.value.replace(/\D/g, '');
                              setLoginPhone(val);
                              if (val.length === 10) {
                                // Auto submit to OTP state
                                setTimeout(() => {
                                  setShowOtpState(true);
                                  setOtpError('');
                                  setIsKeyboardActive(false);
                                }, 150);
                              }
                            }}
                            placeholder="Enter your mobile number"
                            className="w-full bg-transparent text-[#212121] font-medium placeholder:text-[#E2E2E7] focus:outline-none text-sm leading-none"
                          />
                        </div>

                        {/* Terms & Conditions Agreement */}
                        <p className="text-[10px] text-white/90 text-center leading-relaxed px-2">
                          By clicking, I accept the <span className="font-bold underline cursor-pointer hover:text-white transition-colors">Terms & Conditions</span> and <span className="font-bold underline cursor-pointer hover:text-white transition-colors">Privacy Policy</span>
                        </p>

                        {/* Green CTA Button: Get Otp is removed due to automatic submit behavior on typing 10 numbers */}
                        <div className="flex justify-center pt-0.5 min-h-[44px]">
                          {loginPhone.length === 10 && (
                            <div className="px-10 py-3.5 bg-[#41E68F] text-[#212121] font-black text-xs rounded-full shadow-lg shadow-[#41E68F]/25 flex items-center justify-center gap-2.5 leading-none select-none">
                              <span className="w-3.5 h-3.5 border-2 border-[#212121] border-t-transparent rounded-full animate-spin" />
                              Sending OTP...
                            </div>
                          )}
                        </div>
                      </div>
                    </form>

                    {/* Snug Bottom Info / Helper note */}
                    <div className="text-center text-[9px] text-white/60 select-none pointer-events-none mt-1 shrink-0">
                      <span>💡 Demo Mode • Enter any number & any 6-digit OTP code</span>
                    </div>

                  </div>
                </>
              ) : (
                /* DESIGN-PERFECT OTP STATE (Matching layout specifications, XML and images 1:1) */
                <div 
                  id="iphone_14_p"
                  className="absolute inset-0 w-full h-full bg-white overflow-hidden select-none cursor-default z-20 font-lato"
                >
                  {/* Rectangle 111 background gradient overlay - matching consistent branding */}
                  <div className="absolute inset-0 bg-gradient-to-br from-[#2c56f6] to-[#122bb3] z-0 pointer-events-none" />
                  
                  {/* Explicit top click overlay to close simulated keyboard when clicking the blue top area (above top: 24.2%) */}
                  <div 
                    className="absolute inset-x-0 top-0 h-[24.2%] z-30 cursor-pointer" 
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsKeyboardActive(false);
                    }}
                  />
                  
                  {/* Back button to return to Phone Input - high visibility solid circular design */}
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowOtpState(false);
                      setOtpCode('');
                      setOtpError('');
                      setIsKeyboardActive(true);
                    }}
                    className="absolute top-4 left-4 z-50 w-10 h-10 rounded-full bg-white text-slate-800 hover:bg-slate-50 flex items-center justify-center transition-all shadow-md active:scale-90 border border-slate-100/10 cursor-pointer"
                    title="Go back to phone input"
                  >
                    <ChevronLeft size={20} strokeWidth={2.5} />
                  </button>

                  {/* Lets get verified (Title) at exactly top: 4.4% (85px of 1920) */}
                  <div className="absolute top-[4.4%] left-0 right-0 z-10 text-center select-none pointer-events-none">
                    <h1 className="text-white font-black uppercase font-lato tracking-tight text-xl sm:text-2xl md:text-3xl">
                      Lets get verified
                    </h1>
                  </div>

                  {/* Ellipse 98 Check Circle background overlay at exactly top: 12.65% (243px of 1920) */}
                  <div className="absolute top-[12.65%] left-1/2 -translate-x-1/2 w-[13.3%] aspect-square rounded-full bg-black/10 mix-blend-overlay border border-white/15 z-10 flex items-center justify-center pointer-events-none" />

                  {/* Icon feather-check-circle white lines centered in circle at top: 14.27% (274px of 1920) */}
                  <div className="absolute top-[13.9%] left-1/2 -translate-x-1/2 w-[8%] aspect-square z-20 flex items-center justify-center text-white pointer-events-none">
                    <svg 
                      viewBox="0 0 24 24" 
                      fill="none" 
                      stroke="currentColor" 
                      strokeWidth="3.5" 
                      strokeLinecap="round" 
                      strokeLinejoin="round" 
                      className="w-full h-full text-white drop-shadow-sm"
                    >
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </div>

                  {/* Rectangle 129 - Blue curve peeking from behind - upgraded with true physical rounded sheet */}
                  <div 
                    className="absolute left-0 right-0 bottom-0 bg-[#2b51db] z-10 shadow-[0px_-24px_33px_rgba(0,0,0,0.08)] rounded-t-[44px] sm:rounded-t-[48px] transition-all duration-300"
                    style={{ 
                      top: isKeyboardActive ? '13.7%' : '22.7%'
                    }}
                  />

                  {/* Rectangle 123 - Front white curve dome container - upgraded with true physical rounded sheet */}
                  <div 
                    className="absolute left-0 right-0 bottom-0 bg-white z-20 shadow-[0px_-24px_33px_rgba(0,0,0,0.08)] overflow-hidden rounded-t-[44px] sm:rounded-t-[48px] transition-all duration-300"
                    style={{ 
                      top: isKeyboardActive ? '15.2%' : '24.2%'
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      const inputEl = document.getElementById('otp-real-input');
                      if (inputEl) inputEl.focus();
                    }}
                  >
                    <div className="h-full flex flex-col justify-between py-8 px-6 text-center select-none">
                      
                      {/* Top Verification Prompt */}
                      <div className="space-y-1.5 pt-2 shrink-0">
                        <p className="text-[10px] sm:text-xs font-bold text-slate-400 tracking-widest uppercase">
                          Secure Verification
                        </p>
                        <p className="text-base sm:text-lg font-extrabold text-slate-800 leading-snug">
                          Enter the code sent to
                        </p>
                        <p className="text-lg sm:text-xl font-black text-[#2f80ed] tracking-wide">
                          {loginPhone ? `+91 ${loginPhone}` : '+9876543210'}
                        </p>
                      </div>

                      {/* Middle Custom Segmented Indicator (Premium Underground Line Layout) */}
                      <div className="my-auto py-8 relative flex flex-col items-center justify-center shrink-0">
                        
                        {/* Invisible real text input covering the whole tapping area */}
                        <input 
                          id="otp-real-input"
                          type="tel"
                          maxLength={6}
                          required
                          value={otpCode}
                          onFocus={handleInputFocus}
                          onBlur={handleInputBlur}
                          onChange={(e) => {
                            const val = e.target.value.replace(/\D/g, '');
                            if (val.length <= 6) {
                              setOtpCode(val);
                              setOtpError('');
                              if (val.length === 6) {
                                // Dynamic delay for seamless visual response before auto-submitting
                                setTimeout(() => {
                                  setShowAllDoneState(true);
                                  setOtpError('');
                                }, 250);
                              }
                            }
                          }}
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-40"
                          autoFocus
                        />

                        {/* Elegant Underlined Segments for React Native inspired look */}
                        <div className="flex justify-center items-center gap-3 w-full max-w-xs z-30 pointer-events-none">
                          {Array.from({ length: 6 }).map((_, index) => {
                            const digit = otpCode[index];
                            const isCurrent = index === otpCode.length;
                            const isFilled = digit !== undefined;
                            return (
                              <div 
                                key={index}
                                className="flex flex-col items-center w-9 sm:w-11 relative"
                              >
                                {/* Digit Character */}
                                <div className="h-12 flex items-center justify-center">
                                  {isFilled ? (
                                    <span className="text-2xl sm:text-3xl font-black text-slate-800 tracking-tight animate-pop-in">
                                      {digit}
                                    </span>
                                  ) : (
                                    <span className="text-xs font-black text-slate-300 opacity-70">
                                      •
                                    </span>
                                  )}
                                </div>

                                {/* Active Track Line */}
                                <div 
                                  className={`h-1.5 rounded-full w-full transition-all duration-300 ${
                                    otpError 
                                      ? 'bg-rose-500 shadow-[0_2px_8px_rgba(244,63,94,0.35)] animate-shake'
                                      : isFilled
                                        ? 'bg-[#2F80ED] shadow-[0_3px_8px_rgba(47,128,237,0.3)] scale-x-105 h-[5px]'
                                        : isCurrent
                                          ? 'bg-blue-500 animate-pulse h-[5px]'
                                          : 'bg-slate-200'
                                  }`}
                                />
                              </div>
                            );
                          })}
                        </div>
                        
                      </div>

                      {/* Warnings, Info & Footer controls */}
                      <div className="space-y-4 shrink-0 pb-6">
                        
                        {/* Red Alert Pill / iOS Toast style Alert */}
                        {otpError ? (
                          <div className="flex items-center gap-3 bg-rose-50 border border-rose-100 rounded-2xl px-4 py-3 shadow-[0_4px_12px_rgba(244,63,94,0.08)] max-w-[290px] mx-auto animate-shake">
                            <div className="w-8 h-8 rounded-full bg-rose-500 flex items-center justify-center shrink-0 shadow-sm shadow-rose-500/20">
                              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                              </svg>
                            </div>
                            <div className="text-left">
                              <p className="text-[11px] font-extrabold text-rose-800 leading-tight">Verification Failed</p>
                              <p className="text-[10px] text-rose-600 font-bold leading-normal mt-0.5">{otpError}</p>
                            </div>
                          </div>
                        ) : (
                          <p className="text-[10px] text-slate-400 font-extrabold tracking-wide uppercase">
                            Demo Mode • Enter any 6-digit code to continue
                          </p>
                        )}

                        {/* Didn't get code link */}
                        <div className="text-[11px] text-slate-500 font-semibold">
                          Didn't get the code?{' '}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setOtpCode('');
                              setOtpError('');
                              alert('A new demo OTP verification code has been sent to (+91) ' + loginPhone);
                            }}
                            className="text-[#2F80ED] hover:underline font-extrabold cursor-pointer transition-all ml-0.5 border-none bg-transparent"
                          >
                            Resend
                          </button>
                        </div>
                        
                      </div>

                    </div>
                  </div>
                </div>
              )}

            </motion.div>
          )}

          {/* ALL DONE SCREEN VIEW (Replaced with a beautiful simple Loading Spinner in white background) */}
          {showAllDoneState && (
            <motion.div
              key="loading-spinner-screen"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.35, ease: 'easeInOut' }}
              className="flex-1 h-full w-full flex flex-col items-center justify-center relative bg-white select-none p-6 font-sans"
            >
              <div className="flex flex-col items-center justify-center space-y-4 z-10 text-center">
                {/* Simple loading spinner matching our clean theme */}
                <div className="relative w-12 h-12">
                  <div className="absolute inset-0 rounded-full border-3 border-slate-100" />
                  <div className="absolute inset-0 rounded-full border-3 border-t-[#2c56f6] border-r-transparent border-b-transparent border-l-transparent animate-spin" />
                </div>
              </div>
            </motion.div>
          )}

          {/* WHAT IS YOUR LOCATION SCREEN VIEW (Shown after 2 seconds) */}
          {showLocationRequestState && (
            <motion.div
              key="location-request-screen"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4 }}
              className="flex-1 h-full w-full flex flex-col justify-between bg-gradient-to-b from-white via-[#FAF7FF] to-[#EBE4FC] p-6 text-slate-900 select-none relative overflow-hidden font-sans"
            >
              {/* Top Text content */}
              <div className="text-center pt-4 z-10">
                <h2 className="font-black text-slate-900 text-2xl tracking-tight leading-tight mt-4">
                  What is{' '}
                  <span className="relative inline-block">
                    your
                    <svg className="absolute left-0 right-0 -bottom-1 h-1.5 w-full text-[#3D8CF2]" viewBox="0 0 50 10" preserveAspectRatio="none">
                      <path d="M1 9C15 1.5 35 1.5 49 9" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" fill="none"/>
                    </svg>
                  </span>{' '}
                  location?
                </h2>
                
                <p className="text-[11px] text-slate-500 font-semibold max-w-[260px] mx-auto mt-3.5 leading-relaxed">
                  We need your location to show available restaurants & products
                </p>
              </div>

              {/* Central Isometric Graphic */}
              <div className="flex-1 w-full max-w-[340px] aspect-square mx-auto relative flex items-center justify-center my-4">
                <motion.div 
                  initial={{ scale: 0.95, y: 10 }}
                  animate={{ scale: 1, y: 0 }}
                  className="w-full h-full"
                >
                  <img 
                    src={locationAccessPageImg} 
                    alt="Faazio Location Access"
                    className="w-full h-full object-contain"
                    referrerPolicy="no-referrer"
                  />
                </motion.div>
              </div>

              {/* Bottom CTAs */}
              <div className="w-full pb-6 px-2 z-10">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedLocation("Sunnambukkara Street, Karaikal");
                    setShowLocationRequestState(false);
                    setShowMapLoaderState(true);
                  }}
                  className="w-full h-11 rounded-xl bg-[#7CE045] hover:bg-[#6FD237] active:scale-95 text-white font-extrabold text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-[0_8px_20px_rgba(124,224,69,0.3)] transition-all duration-200 cursor-pointer border-none"
                >
                  <span>Allow location access</span>
                </button>
                
                <button
                  type="button"
                  onClick={() => {
                    setShowLocationRequestState(false);
                    setShowManualLocationState(true);
                  }}
                  className="w-full text-[11px] font-black text-slate-800 hover:text-blue-600 transition-colors cursor-pointer text-center flex items-center justify-center gap-1 mt-4.5 bg-transparent border-none"
                >
                  <span>Enter Location Manually</span>
                  <ArrowRight size={11} />
                </button>
              </div>
            </motion.div>
          )}

          {/* A. ENTER LOCATION MANUALLY SCREEN VIEW */}
          {showManualLocationState && (
            <motion.div
              key="manual-location-screen"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
              className="flex-1 h-full w-full flex flex-col bg-white text-slate-900 select-none font-sans"
            >
              {/* Header */}
              <div className="px-4 pt-5 pb-3 border-b border-slate-100 flex items-center gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setShowManualLocationState(false);
                    setShowLocationRequestState(true);
                  }}
                  className="w-8 h-8 rounded-full hover:bg-slate-50 flex items-center justify-center text-slate-700 active:scale-95 transition-all border-none bg-transparent cursor-pointer"
                >
                  <ChevronLeft size={20} />
                </button>
                <h2 className="font-black text-slate-900 text-sm tracking-tight leading-tight">
                  Enter your area or apartment name
                </h2>
              </div>

              {/* Search input container */}
              <div className="p-4 shrink-0">
                <div className="relative">
                  <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Try Golden Nagar, Church Street, etc."
                    value={manualSearchQuery}
                    onChange={(e) => setManualSearchQuery(e.target.value)}
                    className="w-full h-11 pl-10 pr-10 rounded-xl border border-slate-200 bg-slate-50 text-xs font-semibold focus:outline-none focus:border-[#3D8CF2] focus:bg-white text-slate-950 transition-all shadow-sm"
                  />
                  {manualSearchQuery && (
                    <button
                      type="button"
                      onClick={() => setManualSearchQuery('')}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-slate-200 hover:bg-slate-300 flex items-center justify-center text-slate-500 transition-colors border-none cursor-pointer"
                    >
                      <X size={10} />
                    </button>
                  )}
                </div>

                {/* Use my current location option */}
                <button
                  type="button"
                  onClick={() => {
                    setSelectedLocation("Sunnambukkara Street, Karaikal");
                    setShowManualLocationState(false);
                    setShowMapLoaderState(true);
                  }}
                  className="w-full flex items-center justify-between py-3.5 mt-2 bg-transparent border-none cursor-pointer group text-left"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center text-[#3D8CF2]">
                      <Navigation size={14} className="fill-[#3D8CF2] rotate-[135deg]" />
                    </div>
                    <span className="text-xs font-black text-[#3D8CF2]">Use my current location</span>
                  </div>
                  <ChevronRight size={14} className="text-[#3D8CF2] group-hover:translate-x-0.5 transition-transform" />
                </button>
              </div>

              {/* Separator line */}
              <div className="h-2 bg-slate-50 border-y border-slate-100 shrink-0" />

              {/* Search Results list */}
              <div className="flex-1 overflow-y-auto px-4 py-4">
                <h3 className="text-[10px] tracking-wider text-slate-400 font-bold uppercase mb-3 px-1">
                  SEARCH RESULTS
                </h3>

                <div className="space-y-1">
                  {[
                    { title: "Karaikal Beach", subtitle: "Karaikal, Puducherry" },
                    { title: "Karaikal Bus Stand", subtitle: "Karaikal, Puducherry" },
                    { title: "Karaikal Railway Station (KIK)", subtitle: "Karaikal, Puducherry, India" },
                    { title: "Karaikal Ammaiyar Temple", subtitle: "Bharathiyar Street, Karaikal, Puducherry" }
                  ]
                    .filter(item => 
                      !manualSearchQuery || 
                      item.title.toLowerCase().includes(manualSearchQuery.toLowerCase()) || 
                      item.subtitle.toLowerCase().includes(manualSearchQuery.toLowerCase())
                    )
                    .map((item, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          setSelectedLocation(`${item.title}, ${item.subtitle.split(',')[0]}`);
                          setShowManualLocationState(false);
                          setShowMapLoaderState(true);
                        }}
                        className="w-full flex items-start gap-3.5 py-3 px-2 rounded-xl hover:bg-slate-50 active:bg-slate-100 transition-colors border-none bg-transparent cursor-pointer text-left"
                      >
                        <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 shrink-0 mt-0.5">
                          <Navigation size={13} className="rotate-[135deg]" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="text-xs font-black text-slate-900 leading-tight">
                            {item.title}
                          </h4>
                          <p className="text-[10px] text-slate-400 font-semibold mt-0.5 leading-none">
                            {item.subtitle}
                          </p>
                        </div>
                      </button>
                    ))
                  }

                  {/* Fallback if searched but no matches */}
                  {[
                    { title: "Karaikal Beach", subtitle: "Karaikal, Puducherry" },
                    { title: "Karaikal Bus Stand", subtitle: "Karaikal, Puducherry" },
                    { title: "Karaikal Railway Station (KIK)", subtitle: "Karaikal, Puducherry, India" },
                    { title: "Karaikal Ammaiyar Temple", subtitle: "Bharathiyar Street, Karaikal, Puducherry" }
                  ].filter(item => 
                    !manualSearchQuery || 
                    item.title.toLowerCase().includes(manualSearchQuery.toLowerCase()) || 
                    item.subtitle.toLowerCase().includes(manualSearchQuery.toLowerCase())
                  ).length === 0 && (
                    <div className="text-center py-8 text-slate-400">
                      <p className="text-xs font-semibold">No locations found matching your search</p>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedLocation(`${manualSearchQuery}, Karaikal`);
                          setShowManualLocationState(false);
                          setShowMapLoaderState(true);
                        }}
                        className="mt-3 px-4 py-1.5 bg-[#3D8CF2] hover:bg-blue-600 text-white rounded-lg text-[10px] font-black uppercase tracking-wider transition-colors border-none cursor-pointer"
                      >
                        Use "{manualSearchQuery}" anyway
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {/* B. MAP LOADER SCREEN VIEW (Shown for exactly 2 seconds) */}
          {showMapLoaderState && (
            <motion.div
              key="map-loader-screen"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="flex-1 h-full w-full flex flex-col bg-[#F9F6F0] text-slate-900 select-none relative overflow-hidden font-sans"
            >
              {/* Custom simulated grid-based street map background with warm tones */}
              <div className="absolute inset-0 z-0 opacity-80">
                <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
                  {/* Base warm maps colors */}
                  <rect width="100%" height="100%" fill="#FDFBF7" />
                  
                  {/* Simulated water body / park */}
                  <path d="M -20,100 C 100,120 180,60 300,110 L 500,150 L 500,-50 L -20,-50 Z" fill="#EBF3FC" />
                  <rect x="250" y="30" width="120" height="80" rx="16" fill="#E6F4EA" opacity="0.8" />
                  <rect x="-40" y="480" width="180" height="150" rx="24" fill="#E6F4EA" opacity="0.6" />
                  <rect x="280" y="550" width="200" height="180" rx="24" fill="#E6F4EA" opacity="0.6" />
                  
                  {/* Main Grid/Streets lines */}
                  <g stroke="#F2E6D0" strokeWidth="6" strokeLinecap="round">
                    <line x1="-50" y1="200" x2="500" y2="200" />
                    <line x1="-50" y1="360" x2="500" y2="360" stroke="#FCECD4" strokeWidth="12" />
                    <line x1="-50" y1="520" x2="500" y2="520" />
                    
                    <line x1="80" y1="-50" x2="80" y2="900" />
                    <line x1="240" y1="-50" x2="240" y2="900" stroke="#FCECD4" strokeWidth="10" />
                    <line x1="400" y1="-50" x2="400" y2="900" />
                  </g>
                  
                  {/* Minor Grid/Streets lines */}
                  <g stroke="#F4ECE1" strokeWidth="3" strokeLinecap="round">
                    <line x1="-50" y1="120" x2="500" y2="120" />
                    <line x1="-50" y1="280" x2="500" y2="280" />
                    <line x1="-50" y1="440" x2="500" y2="440" />
                    <line x1="-50" y1="600" x2="500" y2="600" />
                    
                    <line x1="160" y1="-50" x2="160" y2="900" />
                    <line x1="320" y1="-50" x2="320" y2="900" />
                    <line x1="460" y1="-50" x2="460" y2="900" />
                  </g>

                  {/* Secondary curved avenues */}
                  <path d="M -50,60 Q 180,320 500,480" fill="none" stroke="#F5EDE4" strokeWidth="6" />
                  <path d="M -50,300 C 150,150 350,450 500,280" fill="none" stroke="#F2E6D0" strokeWidth="5" />
                </svg>
              </div>

              {/* Glowing green locator ring animation in the center of the viewport */}
              <div className="flex-1 w-full flex flex-col items-center justify-center relative z-10 pt-16">
                <div className="relative flex items-center justify-center w-56 h-56">
                  {/* Glowing Pulse rings */}
                  <motion.div
                    initial={{ scale: 0.6, opacity: 0.8 }}
                    animate={{ scale: 1.4, opacity: 0 }}
                    transition={{
                      repeat: Infinity,
                      duration: 2.2,
                      ease: "easeOut"
                    }}
                    className="absolute w-28 h-28 rounded-full border-4 border-emerald-500/30 bg-emerald-500/5"
                  />
                  
                  <motion.div
                    initial={{ scale: 0.3, opacity: 1 }}
                    animate={{ scale: 1.1, opacity: 0 }}
                    transition={{
                      repeat: Infinity,
                      duration: 2.2,
                      delay: 0.7,
                      ease: "easeOut"
                    }}
                    className="absolute w-28 h-28 rounded-full border-2 border-emerald-400/40"
                  />

                  {/* Solid core green locator circle */}
                  <div className="absolute w-12 h-12 rounded-full bg-emerald-500/20 flex items-center justify-center shadow-lg shadow-emerald-500/10">
                    <div className="w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center text-white font-extrabold text-xs shadow-md">
                      <div className="w-2.5 h-2.5 rounded-full bg-white" />
                    </div>
                  </div>

                  {/* High-fidelity bouncing black map-pin marker positioned above the locator */}
                  <motion.div
                    animate={{ y: [-14, -28, -14] }}
                    transition={{
                      repeat: Infinity,
                      duration: 1.6,
                      ease: "easeInOut"
                    }}
                    className="absolute -top-[10px]"
                  >
                    <svg viewBox="0 0 100 120" fill="none" className="w-14 h-16 drop-shadow-[0_12px_20px_rgba(0,0,0,0.25)]">
                      <path 
                        d="M 50,115 C 50,115 20,75 12,58 C 4,40 10,12 40,4 C 70,-4 92,10 92,34 C 92,54 75,75 50,115 Z" 
                        fill="#111111" 
                      />
                      <circle cx="50" cy="38" r="14" fill="#FFFFFF" />
                      {/* Little center green spot */}
                      <circle cx="50" cy="38" r="7" fill="#10B981" />
                    </svg>
                  </motion.div>
                </div>
              </div>

              {/* Delivering Details Overlay Card */}
              <div className="w-full px-5 pb-12 z-10 shrink-0">
                <motion.div 
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.1, duration: 0.4 }}
                  className="bg-white p-5 rounded-2xl border border-slate-100 shadow-[0_12px_36px_rgba(0,0,0,0.08)] text-center max-w-[340px] mx-auto"
                >
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-[0.18em] block">
                    DELIVERING TO
                  </span>
                  
                  <div className="flex items-center justify-center gap-1.5 mt-2.5">
                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                    <h3 className="text-sm font-black text-slate-900 truncate max-w-[240px] leading-tight">
                      {selectedLocation.split(',')[0]}
                    </h3>
                  </div>

                  <p className="text-[10px] text-slate-400 font-bold mt-1 truncate">
                    {selectedLocation}
                  </p>
                </motion.div>
              </div>
            </motion.div>
          )}

          {/* 3. CORE APP DASHBOARD VIEW (WHEN LOGGED IN) */}
          {isLoggedIn && activeSubApp !== 'MASTER_HUB' && (
            <motion.div
              key="sub-app-view"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              className="flex-1 h-full flex flex-col justify-between bg-slate-50 text-slate-900 overflow-hidden relative"
            >
              <SubAppWrapper
                subAppId={activeSubApp}
                onExit={() => setActiveSubApp('MASTER_HUB')}
                addToCart={addToCart}
                cartItems={cartItems}
                setCartItems={setCartItems}
                updateCartQuantity={updateCartQuantity}
                handleReset={handleReset}
                setShowLocationRequestState={setShowLocationRequestState}
                setIsLoggedIn={setIsLoggedIn}
                onProductClick={handleProductClick}
              />
            </motion.div>
          )}

          {/* 3. CORE APP DASHBOARD VIEW (WHEN LOGGED IN) */}
          {isLoggedIn && activeSubApp === 'MASTER_HUB' && (
            <motion.div
              key="dashboard-view"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex-1 h-full flex flex-col justify-between bg-slate-50 text-slate-900 overflow-hidden relative"
            >
              {/* Dashboard header with premium royal blue gradient and curvature matching Image 3 */}
              <div className={`absolute top-0 left-0 right-0 z-30 bg-gradient-to-b from-[#1162D3] via-[#2F80ED] to-[#7CB3FF]/15 px-4 pt-4 pb-4 text-white rounded-b-[32px] shadow-[0_8px_32px_rgba(47,128,237,0.12)] flex flex-col gap-3.5 transition-transform duration-300 ${
                isHeaderCollapsed ? '-translate-y-[52px]' : 'translate-y-0'
              } overflow-hidden`}>
                {/* Subtle soft light glow background decoration */}
                <div className="absolute right-[-10%] top-[-20%] w-48 h-48 rounded-full bg-white/5 blur-xl pointer-events-none" />
                <div className="absolute left-[-10%] bottom-[-20%] w-48 h-48 rounded-full bg-white/5 blur-xl pointer-events-none" />

                {/* Top Row: Hamburger, Centered Logo/Location, Bell Notification */}
                <div className="flex items-center justify-between z-10 h-9">
                  {/* Hamburger Menu Bar */}
                  <button className="w-9 h-9 rounded-xl hover:bg-white/10 active:scale-95 flex items-center justify-center text-white bg-transparent border-none cursor-pointer transition-all">
                    <Menu size={22} className="stroke-[2.5]" />
                  </button>

                  {/* Centered Logo & Location Block */}
                  <div className="flex flex-col items-center gap-1.5">
                    {/* Official Custom Vector Logo inside dynamic pill */}
                    <div className="h-6 flex items-center justify-center bg-white/5 px-3 py-1 rounded-full border border-white/10 shadow-sm">
                      <FaazioLogo className="h-4.5 w-auto" />
                    </div>

                    {/* Centered Location Selector Dropdown */}
                    <div 
                      onClick={() => {
                        setShowManualLocationState(true);
                        setIsLoggedIn(false);
                      }}
                      className="flex items-center gap-1 text-white/90 hover:text-white transition-colors cursor-pointer group"
                    >
                      <MapPin size={11} className="text-[#7CE045] fill-[#7CE045]/10 group-hover:scale-110 transition-transform" />
                      <span className="text-[10px] font-black uppercase tracking-wider truncate max-w-[180px]">
                        {selectedLocation.toUpperCase()}
                      </span>
                      <ChevronDown size={11} className="text-white/60 group-hover:translate-y-0.5 transition-transform" />
                    </div>
                  </div>

                  {/* Bell Notification Icon with counter */}
                  <button className="w-9 h-9 rounded-xl hover:bg-white/10 active:scale-95 flex items-center justify-center text-white relative bg-transparent border-none cursor-pointer transition-all">
                    <Bell size={20} className="stroke-[2.5]" />
                    <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-rose-500 border border-[#2F80ED] animate-pulse" />
                  </button>
                </div>

                {/* Main Centered Search Input Bar */}
                <div className="relative z-10 px-1">
                  <input 
                    type="text"
                    placeholder="Search for food, groceries or more..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full h-11 px-5 rounded-full border-none bg-white text-slate-900 placeholder:text-slate-400 text-xs font-semibold focus:outline-none focus:ring-3 focus:ring-emerald-400/30 shadow-[0_4px_16px_rgba(0,0,0,0.06)] transition-all text-center"
                  />
                </div>
              </div>

              {/* Main Scrollable Body - fits perfectly inside frame height */}
              <div 
                ref={scrollContainerRef}
                onScroll={handleScroll}
                className="flex-1 overflow-y-auto p-4 pt-[148px] pb-28 space-y-5 scrollbar-none"
              >
                {activeTab === 'Home' && (
                  <HomeView 
                    onLaunchSubApp={(subAppId) => {
                      setActiveSubApp(subAppId);
                    }}
                  />
                )}

                {activeTab === 'Categories' && (
                  <CategoriesView 
                    selectedCategory={selectedCategory} 
                    setSelectedCategory={setSelectedCategory} 
                    addToCart={addToCart} 
                    onProductClick={handleProductClick}
                    favorites={favorites}
                    toggleFavorite={toggleFavorite}
                  />
                )}

                {activeTab === 'Favourites' && (
                  <FavouritesView 
                    addToCart={addToCart} 
                    onProductClick={handleProductClick} 
                    favorites={favorites}
                    toggleFavorite={toggleFavorite}
                  />
                )}

                {activeTab === 'Cart' && (
                  <CartView 
                    cartItems={cartItems} 
                    setCartItems={setCartItems} 
                    updateCartQuantity={updateCartQuantity} 
                    setActiveTab={setActiveTab} 
                  />
                )}

                {activeTab === 'Account' && (
                  <AccountView 
                    handleReset={handleReset} 
                    setShowLocationRequestState={setShowLocationRequestState} 
                    setIsLoggedIn={setIsLoggedIn} 
                  />
                )}
              </div>

              {/* Bottom Simulated Tab Navigation Bar - Premium Liquid Glass UI Component Sticking Perfectly to the Bottom (Auto-Edge) */}
              <div className="absolute bottom-0 left-0 right-0 h-[76px] bg-white/80 backdrop-blur-xl border-t border-white/50 rounded-t-[30px] flex items-center justify-between px-5 select-none z-40 shadow-[0_-10px_35px_rgba(0,0,0,0.08),inset_0_1px_0px_rgba(255,255,255,0.8)]">
                {[
                  { name: 'Home', icon: Home, activeColor: 'text-[#2F80ED]', glowColor: 'rgba(47,128,237,0.15)', bubbleColor: 'bg-[#2F80ED] shadow-[0_2px_12px_rgba(47,128,237,0.6)]', dropShadow: 'shadow-[0_10px_25px_rgba(47,128,237,0.25)]' },
                  { name: 'Categories', icon: LayoutGrid, activeColor: 'text-[#27AE60]', glowColor: 'rgba(39,174,96,0.15)', bubbleColor: 'bg-[#27AE60] shadow-[0_2px_12px_rgba(39,174,96,0.6)]', dropShadow: 'shadow-[0_10px_25px_rgba(39,174,96,0.25)]' },
                  { name: 'Favourites', icon: Heart, activeColor: 'text-[#FF4A6B]', glowColor: 'rgba(255,74,107,0.15)', bubbleColor: 'bg-[#FF4A6B] shadow-[0_2px_12px_rgba(255,74,107,0.6)]', dropShadow: 'shadow-[0_10px_25px_rgba(255,74,107,0.25)]' },
                  { name: 'Account', icon: User, activeColor: 'text-[#6C5CE7]', glowColor: 'rgba(108,92,231,0.15)', bubbleColor: 'bg-[#6C5CE7] shadow-[0_2px_12px_rgba(108,92,231,0.6)]', dropShadow: 'shadow-[0_10px_25px_rgba(108,92,231,0.25)]' },
                  { name: 'Cart', icon: ShoppingBag, activeColor: 'text-slate-900', glowColor: 'rgba(242,153,74,0.15)', bubbleColor: 'bg-amber-400 shadow-[0_2px_12px_rgba(242,153,74,0.6)]', dropShadow: 'shadow-[0_10px_25px_rgba(242,153,74,0.25)]' },
                ].map((tab, index) => {
                  const isCurrent = activeTab === tab.name;
                  const totalCartQty = cartItems.reduce((acc, curr) => acc + curr.quantity, 0);

                  if (tab.name === 'Cart') {
                    return (
                      <button
                        key={index}
                        type="button"
                        onClick={() => setActiveTab('Cart')}
                        className={`flex flex-col items-center justify-center w-16 h-16 rounded-full bg-gradient-to-b from-[#FFE066] via-[#F2C94C] to-[#F2994A] text-slate-900 border-2 border-white shadow-[0_8px_24px_rgba(242,153,74,0.45),inset_0_2px_5px_rgba(255,255,255,0.8),inset_0_-2px_5px_rgba(0,0,0,0.1)] -translate-y-5 hover:scale-105 active:scale-95 transition-all duration-300 relative z-50 overflow-hidden ${
                          isCurrent ? 'ring-4 ring-amber-400/30 font-black' : ''
                        }`}
                      >
                        {/* Upper highlight reflection (Apple Liquid Glass signature) */}
                        <div className="absolute top-0.5 left-0.5 right-0.5 h-[45%] bg-gradient-to-b from-white/65 to-white/5 rounded-t-full pointer-events-none" />
                        
                        <div className="relative z-10 flex flex-col items-center justify-center -mt-1">
                          <tab.icon size={22} className="stroke-[2.5px] text-slate-905" />
                          {totalCartQty > 0 && (
                            <span className="absolute -top-2.5 -right-2.5 bg-rose-600 text-white font-black text-[9px] leading-none min-w-[16px] h-[16px] rounded-full flex items-center justify-center px-1 border border-white shadow-md animate-bounce">
                              {totalCartQty}
                            </span>
                          )}
                          <span className="text-[8px] font-black tracking-tight mt-0.5 uppercase">Cart</span>
                        </div>
                      </button>
                    );
                  }

                  return (
                    <button
                      key={index}
                      type="button"
                      onClick={() => setActiveTab(tab.name as 'Home' | 'Categories' | 'Favourites' | 'Account' | 'Cart')}
                      className={`flex flex-col items-center justify-center w-14 h-13 rounded-2xl transition-all duration-300 relative bg-transparent border-none ${
                        isCurrent 
                          ? `${tab.activeColor} scale-105 font-bold` 
                          : 'text-slate-400/90 hover:text-slate-600'
                      }`}
                    >
                      {/* Active Top Edge Liquid Glass Droplet Highlight */}
                      {isCurrent && (
                        <motion.div 
                          layoutId="activeTabBubble"
                          className={`absolute -top-[1.5px] left-1/2 -translate-x-1/2 w-8 h-1 ${tab.bubbleColor} rounded-full`}
                          transition={{ type: 'spring', stiffness: 350, damping: 25 }}
                        />
                      )}

                      {/* Active Inner Liquid Glass Capsule Background with dual shadows (High-Fidelity Apple level) */}
                      {isCurrent && (
                        <motion.div 
                          layoutId="activeTabGlow"
                          className={`absolute inset-0.5 rounded-xl bg-gradient-to-b from-white via-slate-50/95 to-slate-100/90 border-[1.5px] border-white shadow-[inset_0_2px_4px_rgba(255,255,255,1),0_10px_22px_rgba(0,0,0,0.06),0_2px_4px_rgba(0,0,0,0.03)] ${tab.dropShadow} -z-10`}
                          transition={{ type: 'spring', stiffness: 350, damping: 25 }}
                        >
                          {/* Inner glass subtle gloss gradient accent */}
                          <div className="absolute top-0.5 left-0.5 right-0.5 h-[40%] bg-gradient-to-b from-white/90 to-transparent rounded-t-lg pointer-events-none" />
                        </motion.div>
                      )}
                      
                      <div className="relative">
                        <tab.icon size={18} className={isCurrent ? 'stroke-[2.5px]' : 'stroke-[2px]'} />
                      </div>
                      <span className="text-[8px] font-black tracking-tight mt-1">{tab.name}</span>
                    </button>
                  );
                })}
              </div>

            </motion.div>
          )}

        </AnimatePresence>

        <AnimatePresence>
          {showProductDetail && selectedProduct && (
            <ProductDetailView 
              product={selectedProduct}
              onClose={() => {
                setShowProductDetail(false);
                setSelectedProduct(null);
              }}
              addToCart={addToCart}
              cartItems={cartItems}
              updateCartQuantity={updateCartQuantity}
              favorites={favorites}
              toggleFavorite={toggleFavorite}
            />
          )}
        </AnimatePresence>

      </div>

    </div>
  );
}
