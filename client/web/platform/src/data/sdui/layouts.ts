// Provenance: MongoDB sdui_layouts (_id=home). ID-only refs; the gateway joins product/store docs.
// Mirrors server/supabase/seed/mongo/sdui_layouts.json — the single source the app renders.
import type { SduiLayout } from "@/data/types";

const FOOD_STORE_IDS = [
  "store-f1",
  "store-f2",
  "store-f3",
  "store-f4",
  "store-f5",
  "store-f6",
  "store-f7",
  "store-f8",
  "store-f9",
  "store-f10",
  "store-f11",
  "store-f12",
];

export const SDUI_LAYOUTS: SduiLayout[] = [
  {
    layoutId: "home",
    locale: "en",
    version: 1,
    updatedAt: "2026-01-01T00:00:00.000Z",
    sections: [
      {
        id: "martHero",
        title: "Mart Highlights",
        accent: "#F25C3D",
        productIds: [],
        banners: [
          { id: "hb-1", title: "Big Savings Everyday", subtitle: "UP TO 50% OFF", accent: "#FFF8D6", imageUrl: "https://images.unsplash.com/photo-1542838132-92c53300491e?fm=jpg&fit=crop&q=80&w=400&h=400" },
          { id: "hb-2", title: "Fresh Groceries Doorstep", subtitle: "FREE DELIVERY", accent: "#E8F5E9", imageUrl: "https://images.unsplash.com/photo-1579113800032-c38bd1625818?fm=jpg&fit=crop&q=80&w=400&h=400" },
          { id: "hb-3", title: "Electronics Mega Sale", subtitle: "FLAT 40% OFF", accent: "#FFF3E0", imageUrl: "https://images.unsplash.com/photo-1498050108023-c5249f4df085?fm=jpg&fit=crop&q=80&w=400&h=400" },
        ],
      },
      { id: "adBanner", title: "Offers", accent: "#111827", productIds: [] },
      { id: "diningSpecials", title: "Today's Special", accent: "#1E5D44", productIds: [], storeIds: FOOD_STORE_IDS },
      { id: "hotBrandDeals", title: "Deals of the day", accent: "#1162D3", productIds: ["hbd-1", "hbd-2", "hbd-3", "hbd-4", "hbd-5"] },
      { id: "dealsOfDay", title: "Daily Essentials", accent: "#F25C3D", productIds: ["md-1", "md-2", "md-3", "md-4", "md-5", "md-6"] },
      { id: "martEssentials", title: "Daily Essentials", accent: "#0F766E", productIds: ["gr-p3", "gr-p4", "gr-p5", "gr-p6", "gr-p7"] },
      {
        id: "foodHero",
        title: "Food Highlights",
        accent: "#1E5D44",
        productIds: [],
        banners: [
          { id: "fb-1", title: "Dining Deals Near You", subtitle: "UP TO 40% OFF", accent: "#E8F5E9", imageUrl: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?fm=jpg&fit=crop&q=80&w=800&h=450" },
          { id: "fb-2", title: "Biryani Festival", subtitle: "FLAT ₹150 OFF", accent: "#FFF3E0", imageUrl: "https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?fm=jpg&fit=crop&q=80&w=800&h=450" },
          { id: "fb-3", title: "Late Night Cravings", subtitle: "FREE DELIVERY", accent: "#EDE9FE", imageUrl: "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?fm=jpg&fit=crop&q=80&w=800&h=450" },
        ],
      },
      { id: "foodSpecials", title: "Today's Special", accent: "#1E5D44", productIds: ["sp-1", "sp-2", "sp-3", "sp-4", "sp-5", "sp-6", "sp-7", "sp-8", "sp-9", "sp-10", "sp-11", "sp-12", "sp-13", "sp-14", "sp-15", "sp-16"] },
      { id: "sponsoredRail", title: "Sponsored picks", accent: "#B45309", productIds: [] },
      { id: "mostRatedDining", title: "Most Rated Dining", accent: "#1E5D44", productIds: [], storeIds: ["tr-1", "tr-2", "tr-3", "tr-4", "tr-5", "tr-6"] },
      { id: "recentlyViewedMart", title: "Recently Viewed — Mart", accent: "#1162D3", productIds: ["rvm-1", "rvm-2", "rvm-3", "rvm-4"] },
      { id: "recentlyViewedFood", title: "Recently Viewed — Food", accent: "#1E5D44", productIds: ["rvf-1", "rvf-2", "rvf-3"] },
      { id: "recentlyViewedPharma", title: "Recently Viewed — Pharma", accent: "#065F46", productIds: ["rvp-1", "rvp-2", "rvp-3"] },
      { id: "nearbyOffers", title: "Nearby Offers", accent: "#111827", productIds: ["nb-1", "nb-2", "nb-3", "nb-4", "nb-5", "nb-6"] },
      { id: "mens", title: "Men", accent: "#1162D3", productIds: ["men-1", "men-2", "men-3", "men-4", "men-5", "men-6"] },
      { id: "womens", title: "Women", accent: "#1162D3", productIds: ["wom-1", "wom-2", "wom-3", "wom-4", "wom-5", "wom-6"] },
      { id: "childrens", title: "Kids", accent: "#1162D3", productIds: ["kid-1", "kid-2", "kid-3", "kid-4", "kid-5"] },
      { id: "hairSkinCare", title: "Hair & Skin Care", accent: "#0F766E", productIds: ["hs-1", "hs-2", "hs-3", "hs-4", "hs-5"] },
      {
        id: "filterFeed",
        title: "Filter Feed",
        accent: "#8B5CF6",
        productIds: [],
        chips: [
          { id: "forYou", label: "For You", accent: "#8B5CF6", productIds: [] },
          { id: "trendy", label: "Trendy", accent: "#8B5CF6", productIds: ["men-1", "hbd-1", "rvm-2"] },
          { id: "fashion", label: "Fashion", accent: "#1162D3", productIds: ["men-1", "men-3", "wom-2", "kid-3"] },
          { id: "homeAppliances", label: "Home Appliances", accent: "#1162D3", productIds: ["hbd-2", "rvm-4"] },
          { id: "fastFood", label: "Fast Food", accent: "#C2410C", productIds: ["lm-1", "bf-1", "bf-2"] },
          { id: "snacks", label: "Snacks", accent: "#10B981", productIds: ["rvg-4"] },
          { id: "hotMeals", label: "Hot Meals", accent: "#C2410C", productIds: ["m-seafood-ramen", "m-chicken-rice", "m-mushroom-soup", "m-crispy-dumplings"] },
          { id: "skincare", label: "Skincare", accent: "#0F766E", productIds: ["hs-1", "hs-4"] },
          { id: "freshVeggies", label: "Fresh Veggies", accent: "#10B981", productIds: ["nb-3", "rvg-1"] },
          { id: "coughSyrup", label: "Cough Syrup", accent: "#0F766E", productIds: ["ph-c1", "ph-c2", "ph-c3"] },
        ],
      },
    ],
  },
];