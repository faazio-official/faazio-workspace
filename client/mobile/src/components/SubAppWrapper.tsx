import React, { useState, useEffect, useRef, useCallback } from 'react';
import { StyleSheet, View, TouchableOpacity, ScrollView, BackHandler } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { TextInput } from 'react-native';
import {
  Home,
  LayoutGrid,
  ShoppingBag,
  FileText,
  Check,
  Plus,
  Minus,
  IndianRupee,
  Search,
  Droplet,
  User,
} from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';
import { hs, vs, ms, SCREEN_W } from '@/utils/responsive';
import { SPACE } from '@/theme/spacing';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { CartItem } from '@/state/cartStore';
import type { SubAppId } from '@/state/uiStore';
import type { RootStackParamList } from '@/navigation/types';
import NavbarHomeShortcut from '@/components/shared/NavbarHomeShortcut';

import { FaMartScreen } from '../features/ecommerce/FaMartScreen';
import { PharmaScreen } from '../features/pharma/PharmaScreen';
import AppText from '@/components/AppText';
import SubAppHeader from './shared/SubAppHeader';
import { subAppHeaderH } from './shared/SubAppHeader';
import HeaderCategoryRail from '@/components/shared/HeaderCategoryRail';
import type { CategoryRailItem } from '@data/categories/railFeed';
import { brandTokens } from '@/theme/brandTokens';
import type { AppBrand, StoreProfile } from '@data/types';
import { martStores } from '@data/mart/stores';
import { gateway } from '@/services/api/GatewayClient';
import { useBloodDonorStore } from '@/state/bloodDonorStore';

type SubAppKey = 'FA_MART' | 'FOOD' | 'PHARMA';

interface SubAppPreset {
  name: string;
  primaryColor: string;
  textColor: string;
  tabs: { name: string; icon: LucideIcon }[];
}

const SUB_APP_PRESETS: Record<SubAppKey, SubAppPreset> = {
  FA_MART: {
    name: 'Mart',
    primaryColor: '#1162D3',
    textColor: '#1162D3',
    tabs: [
      { name: 'Home', icon: Home },
      { name: 'Search', icon: Search },
      { name: 'You', icon: User },
      { name: 'Cart', icon: ShoppingBag },
    ],
  },
  FOOD: {
    name: 'Food',
    primaryColor: '#1E5D44',
    textColor: '#1E5D44',
    tabs: [
      { name: 'Home', icon: Home },
      { name: 'Menu', icon: LayoutGrid },
      { name: 'Cart', icon: ShoppingBag },
    ],
  },
  PHARMA: {
    name: 'Pharma',
    primaryColor: '#FF7A59',
    textColor: '#FF7A59',
    tabs: [
      { name: 'Home', icon: Home },
      { name: 'Search', icon: Search },
      { name: 'Cart', icon: ShoppingBag },
      { name: 'History', icon: FileText },
      { name: 'Donor', icon: Droplet },
    ],
  },
};

/** Never-undefined fallback so an unknown id degrades in-app instead of
 *  dereferencing `config.tabs` on `undefined`. */
const FALLBACK_SUB_APP_PRESET: SubAppPreset = {
  name: 'Faazio',
  primaryColor: '#1162D3',
  textColor: '#1162D3',
  tabs: [],
};

const SUPPORTED_SUB_APPS: readonly string[] = ['FA_MART', 'FOOD', 'PHARMA'];

interface SubAppWrapperProps {
  subAppId: 'FA_MART' | 'FOOD' | 'PHARMA';
  /** If set (Mart), the vendor profile drill-in opens directly on mount. */
  initialVendorStoreId?: string;
  onExit: () => void;
  addToCart: (id: string, name: string, price: number, emoji: string) => void;
  cartItems: CartItem[];
  setCartItems: React.Dispatch<React.SetStateAction<CartItem[]>>;
  updateCartQuantity: (id: string, delta: number) => void;
  onProductClick?: (product: any) => void;
  /** Opens the first-class Search screen (Mart/Grocery/Pharma Search tab).
   *  An optional initial query pre-fills the search results. */
  onSearchPress?: (query?: string) => void;
  /** Opens the central Cart page (root stack). */
  onCartPress?: () => void;
}

export default function SubAppWrapper({
  subAppId,
  initialVendorStoreId,
  onExit,
  addToCart,
  cartItems,
  setCartItems,
  updateCartQuantity,
  onProductClick,
  onSearchPress,
  onCartPress,
}: SubAppWrapperProps) {
  const [activeTab, setActiveTab] = useState<string>('Home');
  const [searchQuery, setSearchQuery] = useState('');
  const [martVendor, setMartVendor] = useState<StoreProfile | null>(null);
  const searchInputRef = useRef<TextInput | null>(null);
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const insets = useSafeAreaInsets();

  // Deep-link vendor resolution: the drill-in is seeded from the server directory (`GET /store/:id`,
  // the same id-space the rail + ad targets speak), falling back to the local `@data` fixture when
  // the route fails or the row is absent. A renamed/redacted server row still opens.
  useEffect(() => {
    if (subAppId !== 'FA_MART' || !initialVendorStoreId) return;
    let active = true;
    gateway
      .getStore(initialVendorStoreId)
      .then((store) => {
        if (!active) return;
        setMartVendor(store ?? martStores.find((s) => s.id === initialVendorStoreId) ?? null);
      })
      .catch(() => {
        const fallback = martStores.find((s) => s.id === initialVendorStoreId) ?? null;
        if (active) setMartVendor(fallback);
      });
    return () => {
      active = false;
    };
  }, [subAppId, initialVendorStoreId]);

  useEffect(() => {
    setSearchQuery('');
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === 'Search' && searchInputRef.current) {
      setTimeout(() => searchInputRef.current?.focus(), 300);
    }
  }, [activeTab]);

  const handleBack = useCallback(() => {
    if (martVendor) {
      setMartVendor(null);
      return;
    }
    if (activeTab !== 'Home') {
      setActiveTab('Home');
      return;
    }
    onExit();
  }, [activeTab, martVendor, onExit]);

  useFocusEffect(
    useCallback(() => {
      const onBackPress = () => {
        handleBack();
        return true;
      };
      const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
      return () => subscription.remove();
    }, [handleBack]),
  );

  const config = SUB_APP_PRESETS[subAppId as SubAppKey] ?? FALLBACK_SUB_APP_PRESET;

  // With >4 tabs the fixed 56px items overflow narrow (320dp) screens, so widen
  // them to share the available bar width evenly when the count increases.
  const tabs = config.tabs;
  const tabCount = tabs.length;
  const adaptiveTabWidth = tabCount > 0 ? (SCREEN_W - hs(48)) / tabCount : 0;

  const compactHeader = subAppId === 'FA_MART' || subAppId === 'PHARMA';

  // The pinned Mart category rail below the searchbar opens the category drill-in
  // page for the tapped main category (same behaviour as the Home hub header's rail).
  const handleRailCategoryPress = useCallback(
    (item: CategoryRailItem) => {
      navigation.navigate('CategoryDrillIn', {
        tabId: item.id,
        title: item.name,
        app: 'FA_MART',
      });
    },
    [navigation],
  );

  // Mart hides its app chrome while a vendor profile drill-in is open
  // (martVendor != null).
  const isChromeHidden = subAppId === 'FA_MART' && martVendor !== null;

  // Base navbar height. The app layout (App.tsx `AppLayout`) reserves the bottom
  // safe-area inset once for the whole app, so every consumer below — the
  // absolute bar itself, the viewport clearance and the Home shortcut — uses this
  // bare vs(72), never vs(72) + inset.
  const navBarH = vs(72);

  // Registered-donor dashboard (Pharma Donor tab) renders in-wrapper WITH the
  // pharma bottom navbar but its own "Hi, …" header — so header hiding is
  // decoupled from navbar hiding: only the header + viewport paddingTop use
  // this flag; the navbar + paddingBottom keep using `isChromeHidden`.
  const donorRegistered = useBloodDonorStore((s) => s.registration !== null);
  const hideAppHeader = isChromeHidden || (subAppId === 'PHARMA' && activeTab === 'Donor' && donorRegistered);

  if (!SUPPORTED_SUB_APPS.includes(subAppId)) {
    return (
      <View style={styles.unsupportedContainer}>
        <AppText style={styles.unsupportedTitle}>Unsupported sub-app</AppText>
        <AppText style={styles.unsupportedSub}>This section isn&apos;t available yet.</AppText>
        <TouchableOpacity style={styles.unsupportedBtn} onPress={onExit} activeOpacity={0.8}>
          <AppText style={styles.unsupportedBtnText}>Go back</AppText>
        </TouchableOpacity>
      </View>
    );
  }

  const HEADER_TITLES: Record<SubAppWrapperProps['subAppId'], string> = {
    FA_MART: 'Mart',
    FOOD: 'Food & Dining',
    PHARMA: 'Pharma',
  };
  const brandKey: AppBrand = subAppId === 'FA_MART' ? 'MART' : subAppId;
  const tokens = brandTokens[brandKey];
  const searchPlaceholder =
    subAppId === 'FA_MART'
      ? 'Search products in Mart...'
      : subAppId === 'FOOD'
        ? 'Search on Food'
        : 'Search medicines...';

  const renderSubAppContent = () => {
    if (subAppId === 'PHARMA') {
      return (
        <PharmaScreen
          addToCart={addToCart}
          cartItems={cartItems}
          setCartItems={setCartItems}
          updateCartQuantity={updateCartQuantity}
          onProductClick={onProductClick}
          onSearchPress={onSearchPress}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          searchQuery={searchQuery}
        />
      );
    }

    switch (subAppId) {
      case 'FA_MART':
        if (activeTab === 'Home') {
          return (
            <FaMartScreen
              onProductClick={onProductClick}
              onSearchPress={onSearchPress}
              searchQuery={searchQuery}
              vendor={martVendor}
              onVendorPress={setMartVendor}
              onViewAllDiscounts={(vendor) =>
                navigation.navigate('DealsLanding', {
                  mode: 'discounts',
                  storeId: vendor.id,
                  app: 'FA_MART',
                })
              }
            />
          );
        }
        break;

    }

    return (
      <View style={styles.basketContainer}>
        <AppText style={styles.basketTitle}>Your Basket</AppText>
        {cartItems.length === 0 ? (
          <View style={styles.noDataState}>
            <AppText style={styles.noDataEmoji}>🛒</AppText>
            <AppText style={styles.noDataTitle}>Your basket is empty</AppText>
            <AppText style={styles.noDataSub}>Browse products and add them to your basket.</AppText>
          </View>
        ) : (
          <>
            {cartItems.map((item) => (
              <View key={item.id} style={styles.basketRow}>
                <View style={styles.basketRowLeft}>
                  <AppText style={styles.basketRowEmoji}>{item.emoji}</AppText>
                  <AppText style={styles.basketRowName} numberOfLines={1}>{item.name}</AppText>
                </View>
                <View style={styles.basketStepper}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: hs(4), marginRight: hs(4) }}>
                    <IndianRupee size={ms(8)} color="#94a3b8" />
                    <AppText style={styles.basketRowPrice}>{item.price}×{item.quantity}</AppText>
                  </View>
                  <TouchableOpacity onPress={() => updateCartQuantity(item.id, -1)} style={styles.basketStepperBtn}>
                    <Minus size={ms(12)} color="#64748b" />
                  </TouchableOpacity>
                  <AppText style={styles.basketStepperText}>{item.quantity}</AppText>
                  <TouchableOpacity onPress={() => updateCartQuantity(item.id, 1)} style={styles.basketStepperBtn}>
                    <Plus size={ms(12)} color="#64748b" />
                  </TouchableOpacity>
                </View>
              </View>
            ))}
            <View style={styles.basketTotalCard}>
              <View style={styles.basketTotalRow}>
                <AppText style={styles.basketTotalLabel}>Subtotal</AppText>
                <AppText style={styles.basketTotalValue}>
                  ₹{cartItems.reduce((s, i) => s + i.price * i.quantity, 0)}
                </AppText>
              </View>
              <TouchableOpacity style={[styles.basketCheckoutBtn, { backgroundColor: config.primaryColor }]} activeOpacity={0.8}>
                <AppText style={styles.basketCheckoutText}>Checkout</AppText>
              </TouchableOpacity>
            </View>
          </>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {!hideAppHeader && (
        <SubAppHeader
          title={HEADER_TITLES[subAppId]}
          gradient={tokens.headerGradient}
          textColor={tokens.headerTextColor}
          onBack={handleBack}
          searchValue={searchQuery}
          onSearchChange={setSearchQuery}
          searchPlaceholder={searchPlaceholder}
          inputRef={searchInputRef}
          hideBrandRow={compactHeader}
          belowSearchSlot={
            subAppId === 'FA_MART' ? (
              <HeaderCategoryRail
                onCategoryPress={handleRailCategoryPress}
              />
            ) : undefined
          }
        />
      )}

      <View
        style={[
          styles.viewport,
          {
            paddingTop: hideAppHeader
              ? 0
              : subAppHeaderH(insets.top, compactHeader, subAppId === 'FA_MART'),
            paddingBottom: isChromeHidden ? 0 : navBarH,
          },
        ]}
      >
        {renderSubAppContent()}
      </View>

      {!isChromeHidden && (
        <View style={[styles.tabBar, { height: navBarH }]}>
        {tabs.map((tab, idx) => {
          const isCurrent = activeTab === tab.name;
          const Icon = tab.icon;
          const activeColor = tokens.headerGradient[0];

          return (
            <TouchableOpacity
              key={idx}
              onPress={() => {
                const lower = tab.name.toLowerCase();
                if (lower.includes('cart')) onCartPress?.();
                else if (tab.name === 'Search') onSearchPress?.();
                else if (tab.name === 'You') navigation.navigate('You');
                else if (tab.name === 'Donor') {
                  // Registered → dashboard inside the Pharma wrapper (navbar
                  // stays); not registered → push the wizard route.
                  if (useBloodDonorStore.getState().registration !== null) {
                    setActiveTab('Donor');
                  } else {
                    navigation.navigate('BloodDonor');
                  }
                }
                else setActiveTab(tab.name);              }}
              style={[styles.tabItem, tabCount > 4 && { width: adaptiveTabWidth }]}
              activeOpacity={0.8}
            >
              <View style={styles.iconContainer}>
                <Icon size={ms(18)} color={isCurrent ? activeColor : '#94a3b8'} strokeWidth={isCurrent ? 2.5 : 2} fill={isCurrent ? activeColor : 'transparent'} />
              </View>
              <AppText style={[styles.tabLabel, isCurrent && { color: activeColor, fontWeight: '900' }]}>
                {tab.name}
              </AppText>
            </TouchableOpacity>
          );
        })}
        <NavbarHomeShortcut
          centerX={hs(24) + (tabCount > 4 ? adaptiveTabWidth : ms(56)) / 2}
          barHeight={navBarH}
          onPress={() => navigation.navigate('MainTabs', { screen: 'Home' })}
        />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  viewport: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  tabScroll: {
    flex: 1,
  },
  centeredPadding: {
    padding: hs(20),
    alignItems: 'center',
  },
  noDataState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: vs(50),
    paddingHorizontal: hs(24),
  },
  noDataEmoji: {
    fontSize: ms(32),
    marginBottom: SPACE.BLOCK,
  },
  noDataTitle: {
    fontSize: ms(12),
    fontWeight: '900',
    color: '#1e293b',
    textAlign: 'center',
  },
  noDataSub: {
    fontSize: ms(9.5),
    color: '#94a3b8',
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: vs(14),
    marginTop: vs(6),
  },
  infoSection: {
    padding: hs(16),
  },
  infoTitle: {
    fontSize: ms(11),
    fontWeight: '900',
    color: '#0f172a',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: SPACE.BLOCK,
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: hs(12),
  },
  mallCard: {
    backgroundColor: '#ffffff',
    borderRadius: ms(16),
    borderWidth: 1,
    borderColor: '#f1f5f9',
    padding: hs(14),
    width: '48%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: hs(12),
  },
  mallIcon: {
    fontSize: ms(22),
    width: ms(44),
    height: ms(44),
    borderRadius: ms(10),
    backgroundColor: '#f8fafc',
    textAlign: 'center',
    lineHeight: ms(44),
  },
  mallName: {
    fontSize: ms(11),
    fontWeight: '900',
    color: '#0f172a',
  },
  mallDesc: {
    fontSize: ms(9),
    color: '#94a3b8',
    fontWeight: '600',
    marginTop: vs(2),
  },
  bookingsBox: {
    padding: hs(16),
  },
  bookingsHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACE.BLOCK,
  },
  bookingsTitle: {
    fontSize: ms(11),
    fontWeight: '900',
    color: '#0f172a',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  bookingsActivePill: {
    backgroundColor: '#f1f5f9',
    paddingVertical: vs(3),
    paddingHorizontal: hs(10),
    borderRadius: 999,
  },
  bookingsActiveText: {
    fontSize: ms(8.5),
    fontWeight: '900',
    color: '#64748b',
  },
  emptyBookingsCard: {
    backgroundColor: '#ffffff',
    borderRadius: ms(20),
    borderWidth: 1,
    borderColor: '#f1f5f9',
    padding: hs(24),
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.02,
    shadowRadius: 6,
    elevation: 1,
  },
  emptyBookingsTitle: {
    fontSize: ms(11),
    fontWeight: '900',
    color: '#0f172a',
    marginTop: vs(10),
  },
  emptyBookingsDesc: {
    fontSize: ms(9.5),
    color: '#64748b',
    textAlign: 'center',
    lineHeight: vs(14),
    marginTop: vs(6),
    paddingHorizontal: hs(12),
  },
  browsePartnersBtn: {
    height: Math.max(40, vs(40)),
    borderRadius: ms(12),
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: vs(12),
    flexDirection: 'row',
    gap: hs(6),
  },
  browsePartnersText: {
    fontSize: ms(10),
    color: '#ffffff',
    fontWeight: '900',
  },
  tabBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 30,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderColor: 'rgba(226,232,240,0.4)',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: hs(24),
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 14,
    elevation: 8,
    borderTopLeftRadius: ms(28),
    borderTopRightRadius: ms(28),
  },
  tabItem: {
    width: 56,
    height: 56,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  iconContainer: {
    position: 'relative',
  },
  tabLabel: {
    fontSize: ms(8.5),
    color: '#94a3b8',
    fontWeight: '700',
    marginTop: vs(3),
  },
  basketContainer: {
    padding: hs(16),
    flex: 1,
  },
  basketTitle: {
    fontSize: ms(14),
    fontWeight: '900',
    color: '#0f172a',
    marginBottom: SPACE.BLOCK,
  },
  basketRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: vs(8),
    borderBottomWidth: 1,
    borderColor: '#f1f5f9',
  },
  basketRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: hs(8),
    flex: 1,
  },
  basketRowEmoji: {
    fontSize: ms(16),
  },
  basketRowName: {
    fontSize: ms(10),
    fontWeight: '700',
    color: '#334155',
    flex: 1,
  },
  basketRowPrice: {
    fontSize: ms(9),
    color: '#94a3b8',
  },
  basketStepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: hs(6),
  },
  basketStepperBtn: {
    width: ms(24),
    height: ms(24),
    borderRadius: ms(6),
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  basketStepperText: {
    fontSize: ms(11),
    fontWeight: '900',
    color: '#334155',
  },
  basketTotalCard: {
    backgroundColor: '#ffffff',
    borderRadius: ms(12),
    borderWidth: 1,
    borderColor: '#f1f5f9',
    padding: hs(16),
    marginTop: vs(16),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.02,
    shadowRadius: 6,
    elevation: 1,
  },
  basketTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: vs(8),
  },
  basketTotalLabel: {
    fontSize: ms(10),
    color: '#64748b',
  },
  basketTotalValue: {
    fontSize: ms(11),
    fontWeight: '900',
    color: '#0f172a',
  },
  basketCheckoutBtn: {
    height: Math.max(44, vs(44)),
    borderRadius: ms(12),
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: vs(12),
  },
  basketCheckoutText: {
    fontSize: ms(12),
    color: '#ffffff',
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  unsupportedContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: hs(24),
    backgroundColor: '#ffffff',
  },
  unsupportedTitle: {
    fontSize: ms(15),
    fontWeight: '900',
    color: '#1e293b',
    marginBottom: vs(8),
  },
  unsupportedSub: {
    fontSize: ms(11),
    color: '#64748b',
    textAlign: 'center',
    marginBottom: SPACE.SECTION,
  },
  unsupportedBtn: {
    height: Math.max(44, vs(44)),
    borderRadius: ms(12),
    backgroundColor: '#1162D3',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: hs(24),
  },
  unsupportedBtnText: {
    fontSize: ms(12),
    color: '#ffffff',
    fontWeight: '900',
  },
});
