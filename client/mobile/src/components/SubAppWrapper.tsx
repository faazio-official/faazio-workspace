import React, { useState, useEffect, useRef, useCallback } from 'react';
import { StyleSheet, View, TouchableOpacity, ScrollView, BackHandler, StatusBar } from 'react-native';
import type { TextInput } from 'react-native';
import {
  Home,
  LayoutGrid,
  ShoppingBag,
  Sparkles,
  FileText,
  Check,
  Plus,
  Minus,
  IndianRupee,
  Search,
} from 'lucide-react-native';
import { hs, vs, ms } from '@/utils/responsive';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { CartItem } from '@/state/cartStore';
import type { SubAppId } from '@/state/uiStore';
import type { RootStackParamList } from '@/navigation/types';

import { FaMartScreen } from '../features/ecommerce/FaMartScreen';
import { GroceryScreen } from '../features/ecommerce/GroceryScreen';
import { PharmaScreen } from '../features/pharma/PharmaScreen';
import AppText from '@/components/AppText';
import SlideUpSheet from '@/components/shared/SlideUpSheet';
import SubAppHeader from './shared/SubAppHeader';
import { SUB_HEADER_H, SUB_HEADER_H_COMPACT } from './shared/SubAppHeader';
import { brandTokens } from '@/theme/brandTokens';
import type { AppBrand } from '@data/types';

interface SubAppWrapperProps {
  subAppId: 'FA_MART' | 'FOOD' | 'GROCERY' | 'PHARMA';
  onExit: () => void;
  addToCart: (id: string, name: string, price: number, emoji: string) => void;
  cartItems: CartItem[];
  setCartItems: React.Dispatch<React.SetStateAction<CartItem[]>>;
  updateCartQuantity: (id: string, delta: number) => void;
  onProductClick?: (product: any) => void;
  /** Opens the first-class Search screen (Mart/Grocery/Pharma Search tab). */
  onSearchPress?: () => void;
  /** Opens the central Cart page (root stack). */
  onCartPress?: () => void;
}

export default function SubAppWrapper({
  subAppId,
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
  const [showExitConfirm, setShowExitConfirm] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [pharmaOnCategory, setPharmaOnCategory] = useState<boolean>(false);
  const searchInputRef = useRef<TextInput | null>(null);
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  useEffect(() => {
    setSearchQuery('');
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === 'Search' && searchInputRef.current) {
      setTimeout(() => searchInputRef.current?.focus(), 300);
    }
  }, [activeTab]);

  const handleBack = useCallback(() => {
    if (pharmaOnCategory || activeTab !== 'Home') {
      setPharmaOnCategory(false);
      setActiveTab('Home');
      return;
    }
    setShowExitConfirm(true);
  }, [activeTab, pharmaOnCategory]);

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

  const getConfig = () => {
    const configPresets = {
      FA_MART: {
        name: 'Mart',
        primaryColor: '#1162D3',
        textColor: '#1162D3',
        tabs: [
          { name: 'Home', icon: Home },
          { name: 'Categories', icon: LayoutGrid },
          { name: 'Search', icon: Search },
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
      GROCERY: {
        name: 'Grocery',
        primaryColor: '#10B981',
        textColor: '#10B981',
        tabs: [
          { name: 'Home', icon: Home },
          { name: 'Aisles', icon: LayoutGrid },
          { name: 'Search', icon: Search },
          { name: 'Smart Cart', icon: ShoppingBag },
        ],
      },
      PHARMA: {
        name: 'Pharma',
        primaryColor: '#FF7A59',
        textColor: '#FF7A59',
        tabs: [
          { name: 'Home', icon: Home },
          { name: 'For You', icon: Sparkles },
          { name: 'Search', icon: Search },
          { name: 'Cart', icon: ShoppingBag },
          { name: 'History', icon: FileText },
        ],
      },
    };
    return configPresets[subAppId];
  };

  const config = getConfig();

  const hasAddressBar = subAppId === 'FA_MART' || subAppId === 'GROCERY' || subAppId === 'PHARMA';

  // Category pages drop the app header (only the panel's [back] All Categories
  // header remains). Mart/Grocery now open the common Master Categories route
  // (a pushed page with its own header). Pharma keeps its internal All
  // Categories view, reported via onCategoryViewChange.
  const isCategoryPage = subAppId === 'PHARMA' && pharmaOnCategory;

  const HEADER_TITLES: Record<SubAppWrapperProps['subAppId'], string> = {
    FA_MART: 'Mart',
    FOOD: 'Food & Dining',
    GROCERY: 'Grocery',
    PHARMA: 'Pharma',
  };
  const brandKey: AppBrand = subAppId === 'FA_MART' ? 'MART' : subAppId;
  const tokens = brandTokens[brandKey];
  const searchPlaceholder =
    subAppId === 'FA_MART'
      ? 'Search products in Mart...'
      : subAppId === 'FOOD'
        ? 'Search on Food'
        : subAppId === 'GROCERY'
          ? 'Search groceries...'
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
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          searchQuery={searchQuery}
          onCategoryViewChange={setPharmaOnCategory}
        />
      );
    }

    switch (subAppId) {
      case 'FA_MART':
        if (activeTab === 'Home') {
          return <FaMartScreen onProductClick={onProductClick} searchQuery={searchQuery} />;
        }
        break;

      case 'GROCERY':
        if (activeTab === 'Home') {
          return (
            <GroceryScreen 
              addToCart={addToCart} 
              cartItems={cartItems} 
              updateCartQuantity={updateCartQuantity} 
              onProductClick={onProductClick} 
              searchQuery={searchQuery}
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
      {!isCategoryPage && (
        <SubAppHeader
          title={HEADER_TITLES[subAppId]}
          gradient={tokens.headerGradient}
          textColor={tokens.headerTextColor}
          onBack={handleBack}
          searchValue={searchQuery}
          onSearchChange={setSearchQuery}
          searchPlaceholder={searchPlaceholder}
          inputRef={searchInputRef}
          hideBrandRow={hasAddressBar}
          addressLabel={hasAddressBar ? 'Anna Nagar, Chennai' : undefined}
          addressSubLabel={hasAddressBar ? 'Delivering to Home' : undefined}
          onAddressPress={hasAddressBar ? () => {} : undefined}
        />
      )}

      <View
        style={[
          styles.viewport,
          {
            paddingTop: isCategoryPage
              ? 0
              : hasAddressBar
                ? SUB_HEADER_H_COMPACT
                : SUB_HEADER_H,
          },
        ]}
      >
        {renderSubAppContent()}
      </View>

      <View style={styles.tabBar}>
        {config.tabs.map((tab, idx) => {
          const isCurrent = activeTab === tab.name;
          const Icon = tab.icon;

          return (
            <TouchableOpacity
              key={idx}
              onPress={() => {
                const lower = tab.name.toLowerCase();
                if (lower.includes('cart')) onCartPress?.();
                else if (tab.name === 'Search') onSearchPress?.();
                else if (subAppId === 'FA_MART' && tab.name === 'Categories') {
                  navigation.navigate('MasterCategories', { initialChip: 'FA_MART' });
                } else if (subAppId === 'GROCERY' && tab.name === 'Aisles') {
                  navigation.navigate('MasterCategories', { initialChip: 'GROCERY' });
                } else setActiveTab(tab.name);
              }}
              style={styles.tabItem}
              activeOpacity={0.8}
            >
              <View style={styles.iconContainer}>
                <Icon size={ms(18)} color={isCurrent ? config.textColor : '#94a3b8'} strokeWidth={isCurrent ? 2.5 : 2} fill={isCurrent ? config.textColor : 'transparent'} />
              </View>
              <AppText style={[styles.tabLabel, isCurrent && { color: config.textColor, fontWeight: '900' }]}>
                {tab.name}
              </AppText>
            </TouchableOpacity>
          );
        })}
      </View>

      <SlideUpSheet
        visible={showExitConfirm}
        onRequestClose={() => setShowExitConfirm(false)}
        sheetTop={
          <LinearGradient
            colors={tokens.headerGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.modalBar}
          />
        }
      >
        <AppText style={[styles.modalTitle, { color: config.primaryColor }]}>
          {subAppId === 'FOOD'
            ? 'Exit Food?'
            : subAppId === 'PHARMA'
            ? 'Exit Pharma?'
            : subAppId === 'FA_MART'
            ? 'Exit Mart?'
            : 'Exit Grocery?'}
        </AppText>
        <AppText style={styles.modalSubtitle}>Return to the main Faazio Hub?</AppText>

        <View style={styles.modalButtons}>
          <TouchableOpacity
            onPress={() => setShowExitConfirm(false)}
            style={styles.keepBtn}
          >
            <AppText style={styles.keepBtnText}>Keep Exploring</AppText>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => {
              setShowExitConfirm(false);
              onExit();
            }}
            style={styles.exitBtn}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={tokens.headerGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.exitBtnFill}
            >
              <AppText style={[styles.exitBtnText, { color: tokens.headerTextColor }]}>Exit App</AppText>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </SlideUpSheet>
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
    paddingBottom: vs(72),
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
    marginBottom: vs(12),
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
    marginBottom: vs(12),
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
    marginBottom: vs(12),
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
    height: vs(72),
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderTopWidth: 1,
    borderColor: 'rgba(226,232,240,0.5)',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: hs(24),
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -12 },
    shadowOpacity: 0.12,
    shadowRadius: 36,
    elevation: 8,
    borderTopLeftRadius: ms(28),
    borderTopRightRadius: ms(28),
    overflow: 'hidden',
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
  modalBar: {
    width: hs(48),
    height: vs(6),
    borderRadius: vs(3),
    marginBottom: vs(16),
    overflow: 'hidden',
  },
  modalTitle: {
    fontSize: ms(16),
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  modalSubtitle: {
    fontSize: ms(11),
    color: '#64748b',
    textAlign: 'center',
    marginTop: vs(4),
    fontWeight: '600',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: hs(12),
    marginTop: vs(20),
    width: '100%',
  },
  keepBtn: {
    flex: 1,
    height: Math.max(44, vs(44)),
    borderRadius: ms(12),
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  keepBtnText: {
    color: '#475569',
    fontSize: ms(11),
    fontWeight: '800',
  },
  exitBtn: {
    flex: 1,
    height: Math.max(44, vs(44)),
    borderRadius: ms(12),
    overflow: 'hidden',
  },
  exitBtnFill: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  exitBtnText: {
    fontSize: ms(11),
    fontWeight: '900',
  },
  basketContainer: {
    padding: hs(16),
    flex: 1,
  },
  basketTitle: {
    fontSize: ms(14),
    fontWeight: '900',
    color: '#0f172a',
    marginBottom: vs(12),
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
});
