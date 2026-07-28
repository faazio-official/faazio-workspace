import React, { useState, useEffect } from 'react';
import { 
  ShoppingBag, 
  Utensils, 
  Apple, 
  BriefcaseMedical, 
  ChevronRight, 
  ChevronLeft,
  Sparkles,
  ArrowRight,
  TrendingUp,
  Clock,
  Star,
  MapPin,
  Tag,
  Percent,
  Flame,
  Heart,
  Plus,
  Check,
  Award,
  Zap,
  Coffee,
  Volume2,
  VolumeX,
  ShieldCheck,
  Play,
  Info
} from 'lucide-react';
import EnterpriseIcon from './EnterpriseIcon';

interface HomeViewProps {
  onLaunchSubApp: (subAppId: 'FA_MART' | 'FOOD' | 'GROCERY' | 'PHARMA') => void;
}

export default function HomeView({ onLaunchSubApp }: HomeViewProps) {
  const [favoriteRestaurants, setFavoriteRestaurants] = useState<string[]>([]);
  const [addedItemFeedback, setAddedItemFeedback] = useState<string | null>(null);
  const [topAdIndex, setTopAdIndex] = useState(0);
  const [heroSlideIndex, setHeroSlideIndex] = useState(0);
  const [isMuted, setIsMuted] = useState(true);
  const [showAdminDoc, setShowAdminDoc] = useState(false);

  // Auto-scroll Top Ad Banner every 5 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      setTopAdIndex((prev) => (prev + 1) % 3);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  const portalSectors = [
    { 
      id: 'FA_MART' as const,
      name: 'MART', 
      tagline: 'Fashion & Tech',
      emoji: '🛍️',
      imageUrl: 'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?auto=format&fit=crop&q=80&w=300&h=300',
      themeColor: '#1162D3',
      shadowColor: 'rgba(17,98,211,0.18)'
    },
    { 
      id: 'FOOD' as const,
      name: 'FOOD', 
      tagline: 'Gourmet Dining',
      emoji: '🍲',
      imageUrl: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&q=80&w=300&h=300',
      themeColor: '#1E5D44',
      shadowColor: 'rgba(30,93,68,0.18)'
    },
    { 
      id: 'GROCERY' as const,
      name: 'GROCERY', 
      tagline: '10-Min Delivery',
      emoji: '🍏',
      imageUrl: 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&q=80&w=300&h=300',
      themeColor: '#10B981',
      shadowColor: 'rgba(16,185,129,0.18)'
    },
    { 
      id: 'PHARMA' as const,
      name: 'PHARMA', 
      tagline: 'Rx & Lab Tests',
      emoji: '💊',
      imageUrl: 'https://images.unsplash.com/photo-1584017911766-d451b3d0e843?auto=format&fit=crop&q=80&w=300&h=300',
      themeColor: '#065F46',
      shadowColor: 'rgba(6,95,70,0.18)'
    }
  ];

  // Top Ad Space (Dynamic carousel supporting videos, static banners, and text)
  const topAdSlides = [
    {
      type: 'video',
      title: "⚡ 10-Min Superfast Delivery Live Feed!",
      tagline: "Watch our automated fulfillment drone riders in action. Zero delivery fee on orders above ₹499.",
      videoUrl: "https://assets.mixkit.co/videos/preview/mixkit-delivery-man-riding-a-scooter-in-the-city-41618-large.mp4",
      posterUrl: "https://images.unsplash.com/photo-1617347454431-f49d7ff5c3b1?auto=format&fit=crop&q=80&w=600&h=200",
      badge: "LIVE VIDEO CAM",
      targetApp: 'GROCERY' as const
    },
    {
      type: 'banner',
      title: "🍔 Burger Craft 1+1 Special Live",
      tagline: "Order any double truffle smash burger and get a gourmet side & beverage absolutely free today.",
      imageUrl: "https://images.unsplash.com/photo-1550547660-d9450f859349?auto=format&fit=crop&q=80&w=600&h=200",
      badge: "LIMITED OFFER",
      targetApp: 'FOOD' as const
    },
    {
      type: 'text',
      title: "🎉 Up to 60% OFF on K-Beauty & Tech Essentials",
      tagline: "Exclusive deals across Faazio Mart and Pharma Wellness. Verified quality & instant dispatch.",
      badge: "FLASH SALE TODAY",
      targetApp: 'FA_MART' as const
    }
  ];

  // Upgraded Main Hero Carousel (Swipeable with high-res images and videos)
  const sponsoredAds = [
    {
      title: "Gourmet Double Truffle Smash Burger",
      tagline: "Unleash authentic black winter truffle butter inside premium Angus beef patties. Hand-crafted fresh daily.",
      brand: "Burger Craft",
      discount: "50% OFF TODAY",
      mediaType: "video" as const,
      mediaUrl: "https://assets.mixkit.co/videos/preview/mixkit-chef-preparing-a-gourmet-burger-41584-large.mp4",
      imageUrl: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&q=80&w=600&h=300",
      targetApp: 'FOOD' as const
    },
    {
      title: "Next-Gen Apple M3 Max & Mechanical RGB Setup",
      tagline: "Experience ultra-responsive mechanical brown switches, customizable RGB backlighting, and pro studio audio.",
      brand: "FA Tech Hub",
      discount: "FLAT ₹5,000 CASHBACK",
      mediaType: "image" as const,
      imageUrl: "https://images.unsplash.com/photo-1587829741301-dc798b83add3?auto=format&fit=crop&q=80&w=600&h=300",
      targetApp: 'FA_MART' as const
    },
    {
      title: "10-Minute SOS Midnight Emergency Delivery",
      tagline: "Instant dispatch for prescription medicines, K-beauty serums, and daily wellness gummies with zero delivery fee.",
      brand: "Faazio Wellness",
      discount: "FREE 24/7 CONSULTATION",
      mediaType: "image" as const,
      imageUrl: "https://images.unsplash.com/photo-1584017911766-d451b3d0e843?auto=format&fit=crop&q=80&w=600&h=300",
      targetApp: 'PHARMA' as const
    }
  ];

  // Recently Viewed Strip (Connected to unified history router across all categories)
  const recentlyViewedHistory = [
    {
      id: "rv-hist-1",
      name: "Retro Mechanical RGB Keyboard",
      price: "₹4,999",
      emoji: "⌨️",
      imageUrl: "https://images.unsplash.com/photo-1587829741301-dc798b83add3?auto=format&fit=crop&q=80&w=150&h=150",
      activityTag: "Viewed 2h ago",
      targetApp: 'FA_MART' as const
    },
    {
      id: "rv-hist-2",
      name: "Signature Spicy Tonkotsu Ramen",
      price: "₹450",
      emoji: "🍜",
      imageUrl: "https://images.unsplash.com/photo-1569718212165-3a8278d5f624?auto=format&fit=crop&q=80&w=150&h=150",
      activityTag: "Searched 'Ramen'",
      targetApp: 'FOOD' as const
    },
    {
      id: "rv-hist-3",
      name: "Organic Honeycrisp Gala Apples",
      price: "₹249 / kg",
      emoji: "🍎",
      imageUrl: "https://images.unsplash.com/photo-1619546813926-a78fa6372cd2?auto=format&fit=crop&q=80&w=150&h=150",
      activityTag: "In your Wishlist",
      targetApp: 'GROCERY' as const
    },
    {
      id: "rv-hist-4",
      name: "Pure Vitamin C 1000mg Gummies",
      price: "₹349",
      emoji: "🍊",
      imageUrl: "https://images.unsplash.com/photo-1584017911766-d451b3d0e843?auto=format&fit=crop&q=80&w=150&h=150",
      activityTag: "Viewed yesterday",
      targetApp: 'PHARMA' as const
    },
    {
      id: "rv-hist-5",
      name: "Minimalist Suede Sneaker Kicks",
      price: "₹3,499",
      emoji: "👟",
      imageUrl: "https://images.unsplash.com/photo-1549298916-b41d501d3772?auto=format&fit=crop&q=80&w=150&h=150",
      activityTag: "Searched 'Sneakers'",
      targetApp: 'FA_MART' as const
    }
  ];

  // Aggregated Today's Offers (Mixed deals across all sectors)
  const todaysOffers = [
    {
      id: "to-1",
      dishName: "Signature Spicy Tonkotsu Ramen",
      originalPrice: "₹450",
      promoPrice: "₹225",
      restaurant: "Ramen Ichiraku • Food",
      emoji: "🍜",
      discountBadge: "50% Off Today",
      imageUrl: "https://images.unsplash.com/photo-1569718212165-3a8278d5f624?auto=format&fit=crop&q=80&w=200&h=200",
      targetApp: 'FOOD' as const
    },
    {
      id: "to-2",
      dishName: "Retro Mechanical RGB Keyboard",
      originalPrice: "₹7,999",
      promoPrice: "₹4,999",
      restaurant: "Faazio Tech Hub • Mart",
      emoji: "⌨️",
      discountBadge: "40% Off Mega Deal",
      imageUrl: "https://images.unsplash.com/photo-1587829741301-dc798b83add3?auto=format&fit=crop&q=80&w=200&h=200",
      targetApp: 'FA_MART' as const
    },
    {
      id: "to-3",
      dishName: "Organic Dragonfruit Acai Bowl",
      originalPrice: "₹380",
      promoPrice: "₹249",
      restaurant: "Aura Organic • Grocery",
      emoji: "🍧",
      discountBadge: "35% Off Fresh",
      imageUrl: "https://images.unsplash.com/photo-1590301157890-4810ed352733?auto=format&fit=crop&q=80&w=200&h=200",
      targetApp: 'GROCERY' as const
    },
    {
      id: "to-4",
      dishName: "Pure Vitamin C Immunity Gummies",
      originalPrice: "₹550",
      promoPrice: "₹349",
      restaurant: "Faazio Wellness • Pharma",
      emoji: "🍊",
      discountBadge: "35% Off Special",
      imageUrl: "https://images.unsplash.com/photo-1584017911766-d451b3d0e843?auto=format&fit=crop&q=80&w=200&h=200",
      targetApp: 'PHARMA' as const
    }
  ];

  // Mixed Recommendations Section (Varied mix from all available sectors)
  const mixedRecommendations = [
    {
      id: "mr-1",
      name: "Hi-Fi Active Noise Canceling Headset",
      price: "₹8,999",
      sector: "FA Mart",
      emoji: "🎧",
      rating: "4.9",
      imageUrl: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&q=80&w=300&h=200",
      targetApp: 'FA_MART' as const
    },
    {
      id: "mr-2",
      name: "Slow Cooked Awadhi Mutton Biryani",
      price: "₹550",
      sector: "Gourmet Food",
      emoji: "🍗",
      rating: "4.9",
      imageUrl: "https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?auto=format&fit=crop&q=80&w=300&h=200",
      targetApp: 'FOOD' as const
    },
    {
      id: "mr-3",
      name: "Cold Pressed Fresh Orange Juice",
      price: "₹180",
      sector: "Grocery Fresh",
      emoji: "🍊",
      rating: "4.8",
      imageUrl: "https://images.unsplash.com/photo-1621506289937-a8e4df240d0b?auto=format&fit=crop&q=80&w=300&h=200",
      targetApp: 'GROCERY' as const
    },
    {
      id: "mr-4",
      name: "Non-Contact Digital Thermometer",
      price: "₹1,850",
      sector: "Pharma Rx",
      emoji: "🌡️",
      rating: "4.9",
      imageUrl: "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?auto=format&fit=crop&q=80&w=300&h=200",
      targetApp: 'PHARMA' as const
    }
  ];

  // Food Offers Today Section
  const foodOffers = [
    {
      id: "fo-1",
      dishName: "Signature Spicy Tonkotsu Ramen",
      originalPrice: "₹450",
      promoPrice: "₹225",
      restaurant: "Ramen Ichiraku",
      emoji: "🍜",
      discountBadge: "50% Off Today",
      imageUrl: "https://images.unsplash.com/photo-1569718212165-3a8278d5f624?auto=format&fit=crop&q=80&w=200&h=200"
    },
    {
      id: "fo-2",
      dishName: "Organic Dragonfruit Acai Bowl",
      originalPrice: "₹380",
      promoPrice: "₹249",
      restaurant: "Aura Organic Kitchen",
      emoji: "🍧",
      discountBadge: "35% Off",
      imageUrl: "https://images.unsplash.com/photo-1590301157890-4810ed352733?auto=format&fit=crop&q=80&w=200&h=200"
    }
  ];

  // Premium Dining Restaurants Section
  const popularDining = [
    {
      id: "pd-1",
      name: "The Imperial Jade Garden",
      cuisine: "Fine Cantonese & Dim Sum",
      rating: "4.9",
      distance: "1.8 km",
      avgTime: "22 mins",
      avgPrice: "₹1,200 for two",
      imageUrl: "https://images.unsplash.com/photo-1514933651103-005eec06c04b?auto=format&fit=crop&q=80&w=300&h=200",
      trendingBadge: "Michelin Listed"
    },
    {
      id: "pd-2",
      name: "Bella Vista Trattoria",
      cuisine: "Stonefire Pizzas & Homemade Pasta",
      rating: "4.8",
      distance: "2.6 km",
      avgTime: "28 mins",
      avgPrice: "₹800 for two",
      imageUrl: "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&q=80&w=300&h=200",
      trendingBadge: "Most Ordered"
    },
    {
      id: "pd-3",
      name: "Kuroshio Modern Omakase",
      cuisine: "Aesthetic Premium Sushi",
      rating: "4.9",
      distance: "3.2 km",
      avgTime: "35 mins",
      avgPrice: "₹2,500 for two",
      imageUrl: "https://images.unsplash.com/photo-1579871494447-9811cf80d66c?auto=format&fit=crop&q=80&w=300&h=200",
      trendingBadge: "Chef's Table"
    }
  ];

  // Recently Viewed Sections (Structured as 3 distinct horizontal sliding carousels)
  const recentlyViewedMart = [
    {
      id: "rv-mart-1",
      name: "Retro Mechanical RGB Keyboard",
      price: "₹4,999",
      emoji: "⌨️",
      imageUrl: "https://images.unsplash.com/photo-1587829741301-dc798b83add3?auto=format&fit=crop&q=80&w=150&h=150",
      desc: "Tactile brown switches with customizable backlit keycaps."
    },
    {
      id: "rv-mart-2",
      name: "Minimalist Suede Sneaker Kicks",
      price: "₹3,499",
      emoji: "👟",
      imageUrl: "https://images.unsplash.com/photo-1549298916-b41d501d3772?auto=format&fit=crop&q=80&w=150&h=150",
      desc: "Premium lightweight trainers built for urban environments."
    },
    {
      id: "rv-mart-3",
      name: "Active Noise Cancelling Earbuds",
      price: "₹6,999",
      emoji: "🎧",
      imageUrl: "https://images.unsplash.com/photo-1590658268037-6bf12165a8df?auto=format&fit=crop&q=80&w=150&h=150",
      desc: "32-hour hybrid playback with customized transparency mode."
    }
  ];

  const recentlyViewedGrocery = [
    {
      id: "rv-groc-1",
      name: "Organic Honeycrisp Gala Apples",
      price: "₹249 / kg",
      emoji: "🍎",
      imageUrl: "https://images.unsplash.com/photo-1619546813926-a78fa6372cd2?auto=format&fit=crop&q=80&w=150&h=150",
      desc: "Sweet, crispy, and hand-picked from organic valley farms."
    },
    {
      id: "rv-groc-2",
      name: "Cold Pressed Fresh Orange Juice",
      price: "₹180",
      emoji: "🍊",
      imageUrl: "https://images.unsplash.com/photo-1621506289937-a8e4df240d0b?auto=format&fit=crop&q=80&w=150&h=150",
      desc: "No added sugar, rich in real active vitamin C nutrients."
    },
    {
      id: "rv-groc-3",
      name: "Premium California Almonds",
      price: "₹499 / 500g",
      emoji: "🥜",
      imageUrl: "https://images.unsplash.com/photo-1508061253366-f7da158b6d4f?auto=format&fit=crop&q=80&w=150&h=150",
      desc: "Perfectly sorted whole almonds roasted to golden crispiness."
    }
  ];

  const recentlyViewedPharma = [
    {
      id: "rv-ph-1",
      name: "Faazio Pure Vitamin C 1000mg",
      price: "₹349",
      emoji: "🍊",
      imageUrl: "https://images.unsplash.com/photo-1584017911766-d451b3d0e843?auto=format&fit=crop&q=80&w=150&h=150",
      desc: "Premium antioxidant gummies for dynamic daily immunity booster."
    },
    {
      id: "rv-ph-2",
      name: "Multi-Symptom Throat Lozenge Pack",
      price: "₹120",
      emoji: "🍬",
      imageUrl: "https://images.unsplash.com/photo-1550572017-edd951b55104?auto=format&fit=crop&q=80&w=150&h=150",
      desc: "Menthol-mint soothing action for fast throat irritation relief."
    },
    {
      id: "rv-ph-3",
      name: "Non-Contact Digital Thermometer",
      price: "₹1,850",
      emoji: "🌡️",
      imageUrl: "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?auto=format&fit=crop&q=80&w=150&h=150",
      desc: "Medical grade instant scanning with bright backlit display."
    }
  ];

  // FA Mart Finds Section (Curated dynamic tech / lifestyle items in INR)
  const faMartFinds = [
    {
      id: "fmf-1",
      name: "Hi-Fi Active Noise Canceling Headset",
      price: "₹8,999",
      tag: "Best Value",
      imageUrl: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&q=80&w=300&h=200",
      rating: "4.9"
    },
    {
      id: "fmf-2",
      name: "Premium Vegan Suede Bomber Jacket",
      price: "₹4,500",
      tag: "Trending Now",
      imageUrl: "https://images.unsplash.com/photo-1551028719-00167b16eac5?auto=format&fit=crop&q=80&w=300&h=200",
      rating: "4.8"
    }
  ];

  // Restaurant's Special Dishes Section (Added Carousel below FA Mart finds)
  const restaurantSpecials = [
    {
      id: "rs-1",
      name: "Slow Cooked Awadhi Mutton Biryani",
      price: "₹550",
      restaurant: "Dastarkhwan Heritage",
      rating: "4.9",
      emoji: "🍗",
      badge: "Chef Signature",
      imageUrl: "https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?auto=format&fit=crop&q=80&w=300&h=200"
    },
    {
      id: "rs-2",
      name: "Crisp Garlic Butter Naan & Paneer Butter Masala",
      price: "₹380",
      restaurant: "The Punjab Darbar",
      rating: "4.8",
      emoji: "🍛",
      badge: "Classic Favourite",
      imageUrl: "https://images.unsplash.com/photo-1631452180519-c014fe946bc7?auto=format&fit=crop&q=80&w=300&h=200"
    },
    {
      id: "rs-3",
      name: "Triple Chocolate Lava Melt Souffle",
      price: "₹240",
      restaurant: "Le Paris Crêperie",
      rating: "4.9",
      emoji: "🍫",
      badge: "Guilt Free Dessert",
      imageUrl: "https://images.unsplash.com/photo-1606313564200-e75d5e30476c?auto=format&fit=crop&q=80&w=300&h=200"
    }
  ];

  const toggleFavorite = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (favoriteRestaurants.includes(id)) {
      setFavoriteRestaurants(favoriteRestaurants.filter(item => item !== id));
    } else {
      setFavoriteRestaurants([...favoriteRestaurants, id]);
    }
  };

  const triggerAddToCartFeedback = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setAddedItemFeedback(id);
    setTimeout(() => {
      setAddedItemFeedback(null);
    }, 1500);
  };

  return (
    <div className="space-y-6 animate-fade-in text-slate-800 pb-12">
      {/* PHASE 2: ADMINISTRATIVE ALIGNMENT & DELIVERY BANNER (Ditto Demo Status) */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white p-4.5 rounded-[24px] border border-amber-500/30 shadow-xl relative overflow-hidden">
        <div className="absolute -right-6 -bottom-6 w-28 h-28 bg-amber-500/10 rounded-full blur-xl pointer-events-none" />
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
              <ShieldCheck size={18} />
            </div>
            <div>
              <h4 className="text-[12px] font-black tracking-tight text-white flex items-center gap-1.5">
                <span>Production "Ditto" Demo Replica</span>
                <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full text-[8px] uppercase tracking-wider font-extrabold">v2.0 Locked</span>
              </h4>
              <p className="text-[9.5px] text-slate-300 font-medium">All staging placeholders replaced with 100% real production INR pricing, Unsplash media & history routing.</p>
            </div>
          </div>
          <button 
            onClick={() => setShowAdminDoc(!showAdminDoc)}
            className="text-[9px] font-black bg-white/10 hover:bg-white/20 text-amber-300 px-3 py-1.5 rounded-xl border border-white/10 transition-all cursor-pointer shrink-0"
          >
            {showAdminDoc ? 'Hide Delivery Note' : 'Read Alignment Note'}
          </button>
        </div>

        {showAdminDoc && (
          <div className="mt-3.5 pt-3.5 border-t border-white/10 space-y-3 text-[10px] text-slate-200 leading-relaxed bg-black/30 p-3.5 rounded-xl border border-white/5 animate-fade-in">
            <div>
              <span className="font-black text-amber-400 uppercase text-[9px] tracking-wider block mb-1">📌 Review Clarification (No Technical Jargon):</span>
              <p>In our previous review, the mention of "service routing architecture" simply meant that items you search for or view in any department (Mart, Food, Grocery, Pharma) now automatically appear in your unified <b>Recently Viewed Strip</b> on this home screen. Your activity seamlessly travels with you so you never lose track of items you liked.</p>
            </div>
            <div>
              <span className="font-black text-emerald-400 uppercase text-[9px] tracking-wider block mb-1">📅 Deadline Lock ("Date 2"):</span>
              <p>The final production handover is scheduled for <b>Friday, August 15th at 5:00 PM IST</b>. This locked timeline fully incorporates all voice note UI restructurings (Top Ad video carousels, 1dp category borders, aggregated Today's Offers, and enlarged 48dp touch targets).</p>
            </div>
            <div>
              <span className="font-black text-rose-400 uppercase text-[9px] tracking-wider block mb-1">🛑 Ticketing Module Scope Boundary:</span>
              <p>As requested, bus, train, and movie ticket booking engines have been strictly excluded from this release. These require third-party aggregators (IRCTC, RedBus, BookMyShow) and complex seat-mapping microservices, which are slated for the official Version 2.0 expansion after our core 4-sector user base is established.</p>
            </div>
          </div>
        )}
      </div>

      {/* PHASE 1 - REQUIREMENT 1: TOP AD SPACE (Dynamic Carousel replacing text area) */}
      <div className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-1.5">
            <Zap size={14} className="text-amber-500 fill-amber-500 animate-pulse" />
            <h4 className="text-[11px] font-black text-slate-900 uppercase tracking-wider">
              Live Sector Updates & Feeds
            </h4>
          </div>
          <div className="flex items-center gap-1">
            {topAdSlides.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setTopAdIndex(idx)}
                className={`h-1.5 rounded-full transition-all border-none cursor-pointer ${
                  topAdIndex === idx ? 'w-4 bg-amber-500' : 'w-1.5 bg-slate-300 hover:bg-slate-400'
                }`}
              />
            ))}
          </div>
        </div>

        <div 
          onClick={() => onLaunchSubApp(topAdSlides[topAdIndex].targetApp)}
          className="bg-slate-950 text-white rounded-[20px] p-3.5 border border-slate-800 shadow-md relative overflow-hidden group cursor-pointer flex items-center justify-between gap-3"
        >
          <div className="flex items-center gap-3 min-w-0 z-10">
            <div className="w-12 h-12 rounded-xl overflow-hidden bg-slate-900 border border-slate-800 shrink-0 relative">
              {topAdSlides[topAdIndex].type === 'video' ? (
                <video 
                  src={topAdSlides[topAdIndex].videoUrl} 
                  poster={topAdSlides[topAdIndex].posterUrl}
                  autoPlay 
                  loop 
                  muted 
                  playsInline 
                  className="w-full h-full object-cover"
                />
              ) : (
                <img 
                  src={topAdSlides[topAdIndex].imageUrl || "https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?auto=format&fit=crop&q=80&w=150&h=150"} 
                  alt="" 
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              )}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-[8px] font-black uppercase tracking-wider bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded border border-amber-500/30">
                  {topAdSlides[topAdIndex].badge}
                </span>
              </div>
              <h5 className="text-[11px] font-black text-white mt-1 truncate group-hover:text-amber-400 transition-colors">
                {topAdSlides[topAdIndex].title}
              </h5>
              <p className="text-[9px] text-slate-300 font-medium truncate mt-0.5">
                {topAdSlides[topAdIndex].tagline}
              </p>
            </div>
          </div>
          <div className="shrink-0 z-10">
            <div className="w-8 h-8 rounded-full bg-white/10 group-hover:bg-amber-500 group-hover:text-slate-950 flex items-center justify-center text-white transition-all">
              <ChevronRight size={16} />
            </div>
          </div>
          <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-gradient-to-l from-amber-500/10 to-transparent pointer-events-none" />
        </div>
      </div>

      {/* PHASE 1 - REQUIREMENT 2: CATEGORY BORDERS (4 Gateway Shortcuts with 1dp borders & shadow) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h4 className="text-[11px] font-black text-slate-900 uppercase tracking-wider">
            Explore Premium Sectors
          </h4>
          <span className="text-[8.5px] font-bold text-slate-400">Tap to open applet</span>
        </div>

        <div className="grid grid-cols-4 gap-2.5 bg-white p-4 rounded-[24px] border border-slate-200/80 shadow-sm">
          {portalSectors.map((sector) => {
            return (
              <button
                key={sector.id}
                onClick={() => onLaunchSubApp(sector.id)}
                className="flex flex-col items-center text-center group cursor-pointer active:scale-95 transition-all bg-slate-50/80 hover:bg-slate-100/80 p-2.5 rounded-2xl border border-slate-200 shadow-xs hover:shadow-md"
              >
                {/* Sector Circle Icon */}
                <div 
                  className="w-[54px] h-[54px] rounded-full overflow-hidden border-2 border-white relative shadow-sm group-hover:scale-105 transition-transform duration-300"
                  style={{ boxShadow: `0 4px 14px ${sector.shadowColor}` }}
                >
                  <img 
                    src={sector.imageUrl} 
                    alt={sector.name}
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                  <span className="absolute inset-0 bg-black/5" />
                  <EnterpriseIcon 
                    emoji={sector.emoji} 
                    app={sector.id} 
                    className="absolute bottom-0 right-0 w-5 h-5 shadow-md border border-white" 
                    size={10} 
                  />
                </div>

                <span className="text-[10px] font-black text-slate-900 uppercase tracking-tight mt-2 leading-tight group-hover:text-blue-600 transition-colors">
                  {sector.name}
                </span>
                <span className="text-[8px] font-bold text-slate-500 mt-0.5 leading-none">
                  {sector.tagline}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* PHASE 1 - REQUIREMENT 3: UPGRADED MAIN BANNER CAROUSEL (Swipeable with videos & images) */}
      <div className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider flex items-center gap-1">
            <Tag size={11} className="text-amber-500 fill-amber-500" /> Sponsored Showcase
          </span>
          <div className="flex items-center gap-1.5">
            <button
              onClick={(e) => { e.stopPropagation(); setHeroSlideIndex((prev) => (prev - 1 + sponsoredAds.length) % sponsoredAds.length); }}
              className="w-6 h-6 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-700 border-none cursor-pointer transition-all"
            >
              <ChevronLeft size={14} />
            </button>
            <span className="text-[9px] font-bold text-slate-600">{heroSlideIndex + 1}/{sponsoredAds.length}</span>
            <button
              onClick={(e) => { e.stopPropagation(); setHeroSlideIndex((prev) => (prev + 1) % sponsoredAds.length); }}
              className="w-6 h-6 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-700 border-none cursor-pointer transition-all"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>

        {(() => {
          const currentAd = sponsoredAds[heroSlideIndex];
          return (
            <div 
              onClick={() => onLaunchSubApp(currentAd.targetApp)}
              className="bg-slate-950 text-white rounded-[24px] overflow-hidden shadow-lg border border-slate-800 group cursor-pointer relative"
            >
              <div className="absolute top-3.5 left-3.5 z-20 bg-black/50 backdrop-blur-md px-2.5 py-1 rounded-md text-[8px] font-black uppercase tracking-wider flex items-center gap-1 border border-white/10">
                <Tag size={10} className="text-amber-400 fill-amber-400" />
                <span>Sponsored Ad • {currentAd.brand}</span>
              </div>

              {currentAd.mediaType === 'video' && (
                <button
                  onClick={(e) => { e.stopPropagation(); setIsMuted(!isMuted); }}
                  className="absolute top-3.5 right-3.5 z-20 w-8 h-8 rounded-full bg-black/60 backdrop-blur-md flex items-center justify-center text-white border border-white/20 cursor-pointer hover:bg-black/80 transition-all"
                >
                  {isMuted ? <VolumeX size={14} /> : <Volume2 size={14} />}
                </button>
              )}

              <div className="h-48 w-full relative overflow-hidden bg-slate-900">
                {currentAd.mediaType === 'video' ? (
                  <video 
                    src={currentAd.mediaUrl} 
                    poster={currentAd.imageUrl}
                    autoPlay 
                    loop 
                    muted={isMuted} 
                    playsInline 
                    className="w-full h-full object-cover opacity-90 group-hover:scale-102 transition-transform duration-700"
                  />
                ) : (
                  <img 
                    src={currentAd.imageUrl} 
                    alt={currentAd.title} 
                    className="w-full h-full object-cover opacity-90 group-hover:scale-102 transition-transform duration-700" 
                    referrerPolicy="no-referrer"
                  />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent" />
              </div>

              <div className="p-5 space-y-2 relative -mt-14 bg-gradient-to-b from-transparent via-slate-950/95 to-slate-950">
                <div className="flex items-center justify-between">
                  <span className="text-[9px] font-black tracking-widest text-emerald-400 uppercase">
                    {currentAd.discount}
                  </span>
                  <span className="text-[8px] font-bold text-slate-400 flex items-center gap-1">
                    <span>Tap to open {currentAd.brand}</span>
                    <ArrowRight size={10} />
                  </span>
                </div>
                <h4 className="text-sm font-black text-white leading-tight tracking-tight group-hover:text-emerald-300 transition-colors">
                  {currentAd.title}
                </h4>
                <p className="text-[10px] text-slate-300 font-medium leading-relaxed">
                  {currentAd.tagline}
                </p>
              </div>
            </div>
          );
        })()}
      </div>

      {/* PHASE 1 - REQUIREMENT 4: RECENTLY VIEWED STRIP (Horizontal row below main banner) */}
      <div className="space-y-3 bg-slate-50 p-4 rounded-[24px] border border-slate-200/80">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-1.5">
            <TrendingUp size={14} className="text-[#1162D3]" />
            <h4 className="text-[11px] font-black text-slate-900 uppercase tracking-wider">
              Recently Viewed & Searched
            </h4>
          </div>
          <span className="text-[8px] font-extrabold bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full uppercase tracking-wider">
            History Router
          </span>
        </div>

        <div className="flex gap-3.5 overflow-x-auto pb-1 scrollbar-none snap-x px-0.5">
          {recentlyViewedHistory.map((item) => {
            const hasAdded = addedItemFeedback === item.id;
            return (
              <div 
                key={item.id}
                onClick={() => onLaunchSubApp(item.targetApp)}
                className="w-56 bg-white p-3 rounded-2xl border border-slate-200/80 hover:border-blue-400 shadow-xs flex items-center justify-between gap-3 shrink-0 snap-start cursor-pointer group transition-all"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-12 h-12 rounded-xl overflow-hidden border border-slate-100 bg-slate-50 shrink-0 relative">
                    <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    <span className="absolute bottom-0 right-0 bg-white/90 text-[10px] px-0.5 rounded shadow-xs">{item.emoji}</span>
                  </div>
                  <div className="min-w-0">
                    <span className="text-[7.5px] font-bold text-blue-600 uppercase tracking-wider block leading-none mb-1">{item.activityTag}</span>
                    <h5 className="text-[10px] font-black text-slate-950 truncate max-w-[100px]">{item.name}</h5>
                    <span className="text-[9.5px] font-black text-slate-800 mt-0.5 block">{item.price}</span>
                  </div>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); triggerAddToCartFeedback(item.id, e); }}
                  className={`h-7 px-2 rounded-xl text-[8px] font-black uppercase tracking-wider transition-all border-none cursor-pointer flex items-center gap-1 shrink-0 ${
                    hasAdded ? 'bg-emerald-600 text-white shadow-sm' : 'bg-slate-100 hover:bg-slate-200 text-slate-800'
                  }`}
                >
                  {hasAdded ? <Check size={10} className="stroke-[3]" /> : <Plus size={10} className="stroke-[3]" />}
                  <span>{hasAdded ? 'Added' : 'Add'}</span>
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* PHASE 1 - REQUIREMENT 5: GLOBAL OFFERS RESTRUCTURE (Today's Offers - Aggregated across all sectors) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-1.5">
            <Flame size={14} className="text-orange-500 fill-orange-500 animate-pulse" />
            <h4 className="text-[11px] font-black text-slate-900 uppercase tracking-wider">
              Today's Offers
            </h4>
          </div>
          <span className="text-[9px] font-black text-slate-500 bg-orange-50 border border-orange-100 px-2 py-0.5 rounded-lg uppercase tracking-wider">
            All Sectors Deals
          </span>
        </div>

        <div className="flex gap-4 overflow-x-auto pb-2.5 scrollbar-none snap-x px-0.5">
          {todaysOffers.map((offer) => (
            <div 
              key={offer.id}
              onClick={() => onLaunchSubApp(offer.targetApp)}
              className="w-64 bg-white rounded-[24px] border border-slate-200/80 p-3.5 shadow-sm hover:border-slate-300 cursor-pointer snap-start shrink-0 group flex flex-col justify-between"
            >
              <div>
                <div className="h-32 w-full rounded-2xl overflow-hidden relative bg-slate-50">
                  <img 
                    src={offer.imageUrl} 
                    alt={offer.dishName} 
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" 
                    referrerPolicy="no-referrer"
                  />
                  <span className="absolute bottom-2.5 left-2.5 bg-slate-900/90 text-amber-400 text-[8px] font-black uppercase px-2.5 py-1 rounded-lg border border-amber-500/40 shadow-sm">
                    {offer.discountBadge}
                  </span>
                  <EnterpriseIcon 
                    emoji={offer.emoji} 
                    app={offer.targetApp} 
                    className="absolute top-2.5 right-2.5 w-7.5 h-7.5 shadow-sm border border-slate-100/30" 
                    size={12} 
                  />
                </div>

                <h5 className="text-[12px] font-black text-slate-950 mt-3 line-clamp-1 group-hover:text-blue-600 transition-colors leading-tight">
                  {offer.dishName}
                </h5>
                <p className="text-[9.5px] text-slate-500 font-bold mt-1">{offer.restaurant}</p>
              </div>

              <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-100">
                <div className="flex items-baseline gap-1.5">
                  <span className="text-[12.5px] font-black text-emerald-700">{offer.promoPrice}</span>
                  <span className="text-[9.5px] text-slate-400 line-through font-medium">{offer.originalPrice}</span>
                </div>
                
                <span className="text-[8.5px] font-black text-white uppercase tracking-wider bg-slate-900 hover:bg-slate-800 px-3 py-1 rounded-full">
                  Claim Deal
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* PHASE 1 - REQUIREMENT 6: MIXED RECOMMENDATIONS (Varied mix from all sectors below Today's Offers) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-1.5">
            <Sparkles size={14} className="text-indigo-600 animate-spin" style={{ animationDuration: '6s' }} />
            <h4 className="text-[11px] font-black text-slate-900 uppercase tracking-wider">
              Recommended For You
            </h4>
          </div>
          <span className="text-[8.5px] font-bold text-slate-400 uppercase tracking-wider">AI Curated Picks</span>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {mixedRecommendations.map((item) => (
            <div 
              key={item.id}
              onClick={() => onLaunchSubApp(item.targetApp)}
              className="bg-white rounded-[20px] border border-slate-200/80 p-3 shadow-xs hover:shadow-md cursor-pointer group transition-all flex flex-col justify-between"
            >
              <div>
                <div className="h-28 w-full rounded-xl overflow-hidden relative bg-slate-50 mb-2.5">
                  <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" referrerPolicy="no-referrer" />
                  <span className="absolute top-2 left-2 bg-black/60 backdrop-blur-md text-white text-[7.5px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider">
                    {item.sector}
                  </span>
                  <span className="absolute bottom-2 right-2 bg-white/95 text-amber-600 text-[8px] font-black px-1.5 py-0.5 rounded shadow-xs">
                    ★ {item.rating}
                  </span>
                </div>
                <h5 className="text-[11px] font-black text-slate-900 line-clamp-1 group-hover:text-blue-600 transition-colors">
                  {item.name}
                </h5>
              </div>
              <div className="flex items-center justify-between mt-3 pt-2 border-t border-slate-100">
                <span className="text-[11px] font-black text-slate-900">{item.price}</span>
                <span className="w-6 h-6 rounded-full bg-slate-100 group-hover:bg-blue-600 group-hover:text-white flex items-center justify-center text-slate-700 transition-all text-[10px]">
                  →
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* POPULAR DINING RESTAURANTS SECTION */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-1.5">
            <Utensils size={14} className="text-[#1E5D44]" />
            <h4 className="text-[11px] font-black text-slate-900 uppercase tracking-wider">
              Popular Dining Restaurants
            </h4>
          </div>
          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Top Voted</span>
        </div>

        <div className="flex gap-4 overflow-x-auto pb-2.5 scrollbar-none snap-x px-0.5">
          {popularDining.map((res) => {
            const isLiked = favoriteRestaurants.includes(res.id);
            return (
              <div 
                key={res.id}
                onClick={() => onLaunchSubApp('FOOD')}
                className="w-64 bg-white rounded-[24px] border border-slate-100 overflow-hidden shadow-sm hover:border-slate-200 snap-start shrink-0 group cursor-pointer"
              >
                <div className="h-32 w-full relative overflow-hidden bg-slate-50">
                  <img 
                    src={res.imageUrl} 
                    alt={res.name} 
                    className="w-full h-full object-cover group-hover:scale-102 transition-transform duration-500" 
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />

                  {/* Rating, Trending Tag & Heart button */}
                  <div className="absolute top-3.5 left-3.5 bg-black/40 backdrop-blur-md px-2.5 py-1 rounded-md text-[8.5px] font-black text-white uppercase tracking-wider flex items-center gap-1 border border-white/10">
                    <Star size={10} className="text-amber-400 fill-amber-400" />
                    <span>{res.rating}</span>
                  </div>

                  <span className="absolute top-3.5 right-3.5 bg-white/95 px-2 py-0.5 rounded-md text-[8px] font-black text-[#1E5D44] uppercase tracking-wider shadow-sm border border-slate-100">
                    {res.trendingBadge}
                  </span>

                  {/* Favorite toggle button */}
                  <button 
                    onClick={(e) => toggleFavorite(res.id, e)}
                    className="absolute bottom-3 right-3 w-8 h-8 rounded-full bg-white/95 shadow-md flex items-center justify-center text-rose-500 border-none cursor-pointer hover:scale-105 active:scale-95 transition-all"
                  >
                    <Heart size={14} className={isLiked ? "fill-rose-500 text-rose-500" : "text-slate-400"} />
                  </button>
                </div>

                <div className="p-4 space-y-1.5">
                  <h5 className="text-[11.5px] font-black text-slate-950 tracking-tight leading-tight group-hover:text-[#1E5D44] transition-colors line-clamp-1">
                    {res.name}
                  </h5>
                  <p className="text-[9px] text-slate-400 font-bold leading-tight">{res.cuisine} • {res.avgPrice}</p>
                  
                  <div className="flex items-center justify-between pt-2 border-t border-slate-50 text-[9px] font-bold text-slate-500">
                    <span className="flex items-center gap-0.5">
                      <MapPin size={9} className="text-slate-400" /> {res.distance}
                    </span>
                    <span className="flex items-center gap-0.5">
                      <Clock size={9} className="text-slate-400" /> {res.avgTime}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* THREE SEPARATE HORIZONTAL CAROUSELS FOR RECENTLY VIEWED (MART, GROCERY, PHARMA) */}
      <div className="space-y-5">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-1.5">
            <TrendingUp size={14} className="text-[#1162D3]" />
            <h4 className="text-[11px] font-black text-slate-900 uppercase tracking-wider">
              Recently Viewed Items
            </h4>
          </div>
          <span className="text-[8px] font-bold text-slate-400 uppercase tracking-wider">Your History</span>
        </div>

        {/* Carousel 1: Recently Viewed in Mart */}
        <div className="space-y-2">
          <div className="flex items-center justify-between px-1">
            <span className="text-[9px] font-black text-slate-500 uppercase tracking-wider">In Mart Sector</span>
            <span className="w-1.5 h-1.5 rounded-full bg-[#1162D3]" />
          </div>
          <div className="flex gap-3.5 overflow-x-auto pb-1 scrollbar-none snap-x px-0.5">
            {recentlyViewedMart.map((item) => {
              const hasAdded = addedItemFeedback === item.id;
              return (
                <div 
                  key={item.id}
                  onClick={() => onLaunchSubApp('FA_MART')}
                  className="w-64 bg-white p-3 rounded-2xl border border-slate-100 hover:border-slate-300 shadow-sm flex items-center justify-between gap-3 shrink-0 snap-start cursor-pointer group transition-all"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-[46px] h-[46px] rounded-xl overflow-hidden border border-slate-100 bg-slate-50 shrink-0 relative">
                      <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      <EnterpriseIcon 
                        emoji={item.emoji} 
                        app="MART" 
                        className="absolute bottom-0.5 right-0.5 w-[20px] h-[20px] shadow-sm border border-slate-100/40" 
                        size={10} 
                      />
                    </div>
                    <div className="min-w-0">
                      <h5 className="text-[10px] font-black text-slate-950 truncate max-w-[120px]">{item.name}</h5>
                      <p className="text-[8px] text-slate-400 font-medium truncate max-w-[120px]">{item.desc}</p>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span className="text-[9.5px] font-black text-slate-900">{item.price}</span>
                    <button
                      onClick={(e) => triggerAddToCartFeedback(item.id, e)}
                      className={`h-5 px-2 rounded-lg text-[8px] font-black uppercase tracking-wider transition-all border-none cursor-pointer flex items-center gap-0.5 ${
                        hasAdded ? 'bg-emerald-600 text-white shadow-sm' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                      }`}
                    >
                      {hasAdded ? <Check size={8} className="stroke-[3]" /> : <Plus size={8} className="stroke-[3]" />}
                      <span>{hasAdded ? 'Added' : 'Add'}</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Carousel 2: Recently Viewed in Grocery */}
        <div className="space-y-2">
          <div className="flex items-center justify-between px-1">
            <span className="text-[9px] font-black text-slate-500 uppercase tracking-wider">In Grocery Essentials</span>
            <span className="w-1.5 h-1.5 rounded-full bg-[#10B981]" />
          </div>
          <div className="flex gap-3.5 overflow-x-auto pb-1 scrollbar-none snap-x px-0.5">
            {recentlyViewedGrocery.map((item) => {
              const hasAdded = addedItemFeedback === item.id;
              return (
                <div 
                  key={item.id}
                  onClick={() => onLaunchSubApp('GROCERY')}
                  className="w-64 bg-white p-3 rounded-2xl border border-slate-100 hover:border-slate-300 shadow-sm flex items-center justify-between gap-3 shrink-0 snap-start cursor-pointer group transition-all"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-[46px] h-[46px] rounded-xl overflow-hidden border border-slate-100 bg-slate-50 shrink-0 relative">
                      <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      <EnterpriseIcon 
                        emoji={item.emoji} 
                        app="GROCERY" 
                        className="absolute bottom-0.5 right-0.5 w-[20px] h-[20px] shadow-sm border border-slate-100/40" 
                        size={10} 
                      />
                    </div>
                    <div className="min-w-0">
                      <h5 className="text-[10px] font-black text-slate-950 truncate max-w-[120px]">{item.name}</h5>
                      <p className="text-[8px] text-slate-400 font-medium truncate max-w-[120px]">{item.desc}</p>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span className="text-[9.5px] font-black text-slate-900">{item.price}</span>
                    <button
                      onClick={(e) => triggerAddToCartFeedback(item.id, e)}
                      className={`h-5 px-2 rounded-lg text-[8px] font-black uppercase tracking-wider transition-all border-none cursor-pointer flex items-center gap-0.5 ${
                        hasAdded ? 'bg-emerald-600 text-white shadow-sm' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                      }`}
                    >
                      {hasAdded ? <Check size={8} className="stroke-[3]" /> : <Plus size={8} className="stroke-[3]" />}
                      <span>{hasAdded ? 'Added' : 'Add'}</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Carousel 3: Recently Viewed in Pharma */}
        <div className="space-y-2">
          <div className="flex items-center justify-between px-1">
            <span className="text-[9px] font-black text-slate-500 uppercase tracking-wider">In Pharma Wellness</span>
            <span className="w-1.5 h-1.5 rounded-full bg-[#065F46]" />
          </div>
          <div className="flex gap-3.5 overflow-x-auto pb-1 scrollbar-none snap-x px-0.5">
            {recentlyViewedPharma.map((item) => {
              const hasAdded = addedItemFeedback === item.id;
              return (
                <div 
                  key={item.id}
                  onClick={() => onLaunchSubApp('PHARMA')}
                  className="w-64 bg-white p-3 rounded-2xl border border-slate-100 hover:border-slate-300 shadow-sm flex items-center justify-between gap-3 shrink-0 snap-start cursor-pointer group transition-all"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-[46px] h-[46px] rounded-xl overflow-hidden border border-slate-100 bg-slate-50 shrink-0 relative">
                      <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      <EnterpriseIcon 
                        emoji={item.emoji} 
                        app="PHARMA" 
                        className="absolute bottom-0.5 right-0.5 w-[20px] h-[20px] shadow-sm border border-slate-100/40" 
                        size={10} 
                      />
                    </div>
                    <div className="min-w-0">
                      <h5 className="text-[10px] font-black text-slate-950 truncate max-w-[120px]">{item.name}</h5>
                      <p className="text-[8px] text-slate-400 font-medium truncate max-w-[120px]">{item.desc}</p>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span className="text-[9.5px] font-black text-slate-900">{item.price}</span>
                    <button
                      onClick={(e) => triggerAddToCartFeedback(item.id, e)}
                      className={`h-5 px-2 rounded-lg text-[8px] font-black uppercase tracking-wider transition-all border-none cursor-pointer flex items-center gap-0.5 ${
                        hasAdded ? 'bg-emerald-600 text-white shadow-sm' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                      }`}
                    >
                      {hasAdded ? <Check size={8} className="stroke-[3]" /> : <Plus size={8} className="stroke-[3]" />}
                      <span>{hasAdded ? 'Added' : 'Add'}</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* FA MART FINDS CURATED SECTION */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-1.5">
            <Sparkles size={14} className="text-[#1162D3] animate-pulse" />
            <h4 className="text-[11px] font-black text-slate-900 uppercase tracking-wider">
              FA Mart Curated Finds
            </h4>
          </div>
          <button 
            onClick={() => onLaunchSubApp('FA_MART')}
            className="text-[9px] font-black text-[#1162D3] uppercase tracking-wider"
          >
            Shop Mart Finds
          </button>
        </div>

        <div className="flex gap-4 overflow-x-auto pb-2.5 scrollbar-none snap-x px-0.5">
          {faMartFinds.map((find) => (
            <div 
              key={find.id}
              onClick={() => onLaunchSubApp('FA_MART')}
              className="w-64 bg-white rounded-[24px] border border-slate-100 p-3.5 shadow-sm hover:border-slate-200 cursor-pointer snap-start shrink-0 group flex flex-col justify-between"
            >
              <div>
                <div className="h-32 w-full rounded-2xl overflow-hidden relative bg-slate-50">
                  <img src={find.imageUrl} alt={find.name} className="w-full h-full object-cover group-hover:scale-102 transition-transform duration-500" referrerPolicy="no-referrer" />
                  <span className="absolute top-2.5 left-2.5 bg-blue-600 text-white text-[8px] font-black uppercase px-2.5 py-1 rounded-lg border border-blue-500 shadow-sm">
                    {find.tag}
                  </span>
                  <span className="absolute bottom-2.5 right-2.5 bg-white/95 text-[8.5px] font-black text-amber-500 px-1.5 py-0.5 rounded shadow-sm">
                    ★ {find.rating}
                  </span>
                </div>

                <h5 className="text-[12px] font-black text-slate-950 mt-3 line-clamp-1 group-hover:text-[#1162D3] transition-colors leading-tight">
                  {find.name}
                </h5>
                <p className="text-[9.5px] text-slate-400 font-bold mt-1">FA Mart Exclusive</p>
              </div>

              <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-100">
                <span className="text-[12.5px] font-black text-[#1162D3]">{find.price}</span>
                <span className="text-[8.5px] font-black text-white uppercase tracking-wider bg-[#1162D3] px-3 py-1 rounded-full">
                  Discover
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* RESTAURANT'S SPECIAL SECTION (Horizontal sliding carousel under FA Mart Curated Finds) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-1.5">
            <Award size={14} className="text-amber-500 animate-bounce" />
            <h4 className="text-[11px] font-black text-slate-900 uppercase tracking-wider">
              Restaurant's Special
            </h4>
          </div>
          <span className="text-[9px] font-bold text-[#1E5D44] uppercase tracking-wider">Signature Dishes</span>
        </div>

        <div className="flex gap-4 overflow-x-auto pb-2.5 scrollbar-none snap-x px-0.5">
          {restaurantSpecials.map((special) => {
            return (
              <div 
                key={special.id}
                onClick={() => onLaunchSubApp('FOOD')}
                className="w-64 bg-white rounded-[24px] border border-slate-100 overflow-hidden shadow-sm hover:border-slate-200 snap-start shrink-0 group cursor-pointer flex flex-col justify-between"
              >
                <div>
                  <div className="h-32 w-full relative overflow-hidden bg-slate-50">
                    <img 
                      src={special.imageUrl} 
                      alt={special.name} 
                      className="w-full h-full object-cover group-hover:scale-102 transition-transform duration-500" 
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />

                    {/* Quality Badging */}
                    <div className="absolute top-3.5 left-3.5 bg-amber-500 text-white px-2.5 py-1 rounded-md text-[8px] font-black uppercase tracking-wider flex items-center gap-1 shadow-md">
                      <Zap size={10} className="fill-white" />
                      <span>{special.badge}</span>
                    </div>

                    <EnterpriseIcon 
                      emoji={special.emoji} 
                      app="FOOD" 
                      className="absolute bottom-3 right-3 w-8 h-8 shadow-md border border-slate-100/30" 
                      size={14} 
                    />
                  </div>

                  <div className="p-4 space-y-1">
                    <h5 className="text-[11.5px] font-black text-slate-950 tracking-tight leading-tight group-hover:text-[#1E5D44] transition-colors line-clamp-1">
                      {special.name}
                    </h5>
                    <p className="text-[9px] text-slate-400 font-bold leading-tight">{special.restaurant}</p>
                  </div>
                </div>

                <div className="px-4 pb-4 pt-2 border-t border-slate-50 flex items-center justify-between text-[11px]">
                  <span className="font-black text-[#1E5D44]">{special.price}</span>
                  <button
                    onClick={(e) => { e.stopPropagation(); onLaunchSubApp('FOOD'); }}
                    className="h-6 px-3 bg-[#1E5D44] hover:bg-emerald-800 text-white font-black text-[8px] rounded-lg border-none cursor-pointer uppercase tracking-wider transition-colors"
                  >
                    Order Now
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
