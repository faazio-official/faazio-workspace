import { create } from 'zustand';

export type TabName = 'Home' | 'Categories' | 'Favourites' | 'Account' | 'Cart';
export type SubAppId = 'FA_MART' | 'FOOD' | 'GROCERY' | 'PHARMA';

interface UIState {
  activeTab: TabName;
  activeSubApp: SubAppId | null;
  selectedProduct: any | null;
  setActiveTab: (tab: TabName) => void;
  setActiveSubApp: (subApp: SubAppId | null) => void;
  setSelectedProduct: (product: any | null) => void;
  reset: () => void;
}

export const useUIStore = create<UIState>()((set) => ({
  activeTab: 'Home',
  activeSubApp: null,
  selectedProduct: null,
  setActiveTab: (tab) => set({ activeTab: tab }),
  setActiveSubApp: (subApp) => set({ activeSubApp: subApp }),
  setSelectedProduct: (product) => set({ selectedProduct: product }),
  reset: () => set({ activeTab: 'Home', activeSubApp: null, selectedProduct: null }),
}));
