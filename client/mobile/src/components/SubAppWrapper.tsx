import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, View, TouchableOpacity, ScrollView, Alert, BackHandler, Modal, Animated, StatusBar } from 'react-native';
import type { TextInput } from 'react-native';
import {
  Home,
  LayoutGrid,
  User,
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
import type { CartItem } from '@/state/cartStore';

import { FaMartScreen } from '../features/ecommerce/FaMartScreen';
import { MartCategoriesScreen } from '../features/ecommerce/MartCategoriesScreen';
import { GroceryScreen } from '../features/ecommerce/GroceryScreen';
import { GroceryAislesScreen } from '../features/ecommerce/GroceryAislesScreen';
import { PharmaScreen } from '../features/pharma/PharmaScreen';
import AccountView from '@/features/profile/AccountView';
import CartView from '@/features/cart/CartView';
import AppText from '@/components/AppText';
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
  handleReset: () => void;
  setShowLocationRequestState: (val: boolean) => void;
  setIsLoggedIn: (val: boolean) => void;
  onProductClick?: (product: any) => void;
  /** Opens the first-class Search screen (Mart/Grocery/Pharma Search tab). */
  onSearchPress?: () => void;
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
  onProductClick,
  onSearchPress,
}: SubAppWrapperProps) {
  const [activeTab, setActiveTab] = useState<string>('Home');
  const [showExitConfirm, setShowExitConfirm] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef<TextInput | null>(null);

  const tabPositions = useRef<number[]>([]);
  const pillAnim = useRef(new Animated.Value(0)).current;
  const badgeBounce = useRef(new Animated.Value(0)).current;

  const totalCartQty = cartItems.reduce((acc, curr) => acc + curr.quantity, 0);

  useEffect(() => {
    setSearchQuery('');
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === 'Search' && searchInputRef.current) {
      setTimeout(() => searchInputRef.current?.focus(), 300);
    }
  }, [activeTab]);

  useEffect(() => {
    const onBackPress = () => {
      setShowExitConfirm(true);
      return true;
    };
    const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    const idx = config.tabs.findIndex(t => t.name === activeTab);
    if (idx >= 0 && tabPositions.current[idx] !== undefined) {
      Animated.spring(pillAnim, {
        toValue: tabPositions.current[idx] - ms(12),
        useNativeDriver: true,
        stiffness: 300,
        damping: 30,
      }).start();
    }
  }, [activeTab]);

  useEffect(() => {
    // Only bounce the cart badge while there is something in the cart.
    if (totalCartQty <= 0) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(badgeBounce, { toValue: 1, duration: 600, useNativeDriver: true }),
        Animated.timing(badgeBounce, { toValue: 0, duration: 600, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [badgeBounce, totalCartQty]);

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
          { name: 'Profile', icon: User },
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
          { name: 'Profile', icon: User },
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
          { name: 'Profile', icon: User },
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
        />
      );
    }

    switch (subAppId) {
      case 'FA_MART':
        if (activeTab === 'Home') {
          return <FaMartScreen onProductClick={onProductClick} searchQuery={searchQuery} />;
        }
        if (activeTab === 'Categories') {
          return <MartCategoriesScreen />;
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
        if (activeTab === 'Aisles') {
          return (
            <GroceryAislesScreen
              onCategoryPress={() => Alert.alert('Aisle Select', 'Category aisles coming soon.')}
              onSearchPress={() => onSearchPress?.()}
              onOffersPress={() => setActiveTab('Home')}
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
      <SubAppHeader
        title={HEADER_TITLES[subAppId]}
        gradient={tokens.headerGradient}
        textColor={tokens.headerTextColor}
        onBack={() => setShowExitConfirm(true)}
        searchValue={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder={searchPlaceholder}
        inputRef={searchInputRef}
        hideBrandRow={hasAddressBar}
        addressLabel={hasAddressBar ? 'Anna Nagar, Chennai' : undefined}
        addressSubLabel={hasAddressBar ? 'Delivering to Home' : undefined}
        onAddressPress={hasAddressBar ? () => {} : undefined}
      />

      <View
        style={[
          styles.viewport,
          { paddingTop: hasAddressBar ? SUB_HEADER_H_COMPACT : SUB_HEADER_H },
        ]}
      >
        {renderSubAppContent()}
      </View>

      <View style={styles.tabBar}>
        <Animated.View style={[styles.activePill, { backgroundColor: config.primaryColor, transform: [{ translateX: pillAnim }] }]} />
        {config.tabs.map((tab, idx) => {
          const isCurrent = activeTab === tab.name;
          const Icon = tab.icon;

          return (
            <TouchableOpacity
              key={idx}
              onPress={() => (tab.name === 'Search' ? onSearchPress?.() : setActiveTab(tab.name))}
              style={styles.tabItem}
              activeOpacity={0.8}
              onLayout={(e) => { tabPositions.current[idx] = e.nativeEvent.layout.x; }}
            >
              <View style={styles.iconContainer}>
                <Icon size={ms(18)} color={isCurrent ? config.textColor : '#94a3b8'} strokeWidth={isCurrent ? 2.5 : 2} style={isCurrent ? { transform: [{ scale: 1.1 }] } : undefined} />
                {tab.name.toLowerCase().includes('cart') && totalCartQty > 0 && (
                  <Animated.View style={{ transform: [{ translateY: badgeBounce.interpolate({ inputRange: [0, 1], outputRange: [0, -3] }) }] }}>
                    <View style={styles.badge}>
                      <AppText style={styles.badgeText}>{totalCartQty}</AppText>
                    </View>
                  </Animated.View>
                )}
              </View>
              <AppText style={[styles.tabLabel, isCurrent && { color: config.textColor, fontWeight: '900' }]}>
                {tab.name}
              </AppText>
            </TouchableOpacity>
          );
        })}
      </View>

      <Modal
        visible={showExitConfirm}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowExitConfirm(false)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={styles.modalBgPressable} onPress={() => setShowExitConfirm(false)} />
          <View style={styles.modalContent}>
            <View style={styles.modalBar} />
            <AppText style={styles.modalTitle}>
              {subAppId === 'FOOD'
                ? 'Exit Food?'
                : subAppId === 'PHARMA'
                ? 'Exit Pharma?'
                : subAppId === 'FA_MART'
                ? 'Exit Mart?'
                : 'Exit Grocery?'}
            </AppText>
            <AppText style={styles.modalSubtitle}>
              Are you sure you want to exit the current service and return to the main Faazio Hub?
            </AppText>

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
                style={[styles.exitBtn, { backgroundColor: config.primaryColor }]}
              >
                <AppText style={styles.exitBtnText}>Exit to Main App</AppText>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  activePill: {
    position: 'absolute',
    width: ms(32),
    height: vs(4),
    borderRadius: ms(2),
    bottom: -2,
  },
  iconContainer: {
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: vs(-6),
    right: hs(-10),
    backgroundColor: '#f97316',
    borderRadius: ms(7),
    minWidth: ms(14),
    height: ms(14),
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: hs(2),
    borderWidth: 1,
    borderColor: '#ffffff',
  },
  badgeText: {
    color: '#ffffff',
    fontSize: ms(8),
    fontWeight: '900',
  },
  tabLabel: {
    fontSize: ms(8.5),
    color: '#94a3b8',
    fontWeight: '700',
    marginTop: vs(3),
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.4)',
    justifyContent: 'flex-end',
  },
  modalBgPressable: {
    flex: 1,
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: ms(32),
    borderTopRightRadius: ms(32),
    padding: hs(24),
    paddingBottom: vs(32),
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -12 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 8,
  },
  modalBar: {
    width: hs(48),
    height: vs(6),
    borderRadius: vs(3),
    backgroundColor: '#e2e8f0',
    marginBottom: vs(16),
  },
  modalTitle: {
    fontSize: ms(14),
    fontWeight: '900',
    color: '#0f172a',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  modalSubtitle: {
    fontSize: ms(10),
    color: '#94a3b8',
    textAlign: 'center',
    lineHeight: vs(14),
    marginTop: vs(6),
    paddingHorizontal: hs(20),
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
    height: Math.max(40, vs(40)),
    borderRadius: ms(12),
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  keepBtnText: {
    color: '#475569',
    fontSize: ms(10),
    fontWeight: '900',
  },
  exitBtn: {
    flex: 1,
    height: Math.max(40, vs(40)),
    borderRadius: ms(12),
    alignItems: 'center',
    justifyContent: 'center',
  },
  exitBtnText: {
    color: '#ffffff',
    fontSize: ms(10),
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
