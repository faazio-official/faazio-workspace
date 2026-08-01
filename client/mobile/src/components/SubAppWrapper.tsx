import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Alert,
  BackHandler,
  Modal,
  Animated,
  StatusBar,
} from 'react-native';
import {
  ArrowLeft,
  Home,
  LayoutGrid,
  User,
  ShoppingBag,
  Sparkles,
  MapPin,
  Search,
  Calendar,
  FileText,
  Check,
  Plus,
  Minus,
  IndianRupee,
  ArrowRight,
} from 'lucide-react-native';
import { hs, vs, ms } from '@/utils/responsive';
import type { CartItem } from '@/state/cartStore';

import { FaMartScreen } from '../features/ecommerce/FaMartScreen';
import { GroceryScreen } from '../features/ecommerce/GroceryScreen';
import { FoodScreen } from '../features/food/FoodScreen';
import { PharmaScreen } from '../features/pharma/PharmaScreen';
import AccountView from './AccountView';
import CartView from './CartView';
import FoodMenuView from './FoodMenuView';
import { getBookings } from '../features/food/bookingStore';

const SUB_HEADER_INSET = StatusBar.currentHeight ?? 0;

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
}: SubAppWrapperProps) {
  const [activeTab, setActiveTab] = useState<string>('Home');
  const [activeSubMode, setActiveSubMode] = useState<'order' | 'booking'>('order');
  const [showExitConfirm, setShowExitConfirm] = useState<boolean>(false);

  const tabPositions = useRef<number[]>([]);
  const pillAnim = useRef(new Animated.Value(0)).current;
  const badgeBounce = useRef(new Animated.Value(0)).current;

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
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(badgeBounce, { toValue: 1, duration: 600, useNativeDriver: true }),
        Animated.timing(badgeBounce, { toValue: 0, duration: 600, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [badgeBounce]);

  const handleSubModeChange = (mode: 'order' | 'booking') => {
    setActiveSubMode(mode);
    setActiveTab('Home');
  };

  const getConfig = () => {
    const configPresets = {
      FA_MART: {
        name: 'FA MART',
        primaryColor: '#1162D3',
        textColor: '#1162D3',
        tabs: [
          { name: 'Home', icon: Home },
          { name: 'Categories', icon: LayoutGrid },
          { name: 'Cart', icon: ShoppingBag },
          { name: 'Profile', icon: User },
        ],
      },
      FOOD: {
        name: 'Food',
        primaryColor: '#1E5D44',
        textColor: '#1E5D44',
        tabs:
          activeSubMode === 'order'
            ? [
                { name: 'Home', icon: Home },
                { name: 'Menu', icon: LayoutGrid },
                { name: 'Cart', icon: ShoppingBag },
                { name: 'Profile', icon: User },
              ]
            : [
                { name: 'Home', icon: Home },
                { name: 'Search', icon: Search },
                { name: 'My Bookings', icon: Calendar },
                { name: 'Profile', icon: User },
              ],
      },
      GROCERY: {
        name: 'FA Grocery',
        primaryColor: '#10B981',
        textColor: '#10B981',
        tabs: [
          { name: 'Home', icon: Home },
          { name: 'Aisles', icon: LayoutGrid },
          { name: 'Smart Cart', icon: ShoppingBag },
          { name: 'Profile', icon: User },
        ],
      },
      PHARMA: {
        name: 'FA Pharma',
        primaryColor: '#FF7A59',
        textColor: '#FF7A59',
        tabs: [
          { name: 'Home', icon: Home },
          { name: 'For You', icon: Sparkles },
          { name: 'Cart', icon: ShoppingBag },
          { name: 'History', icon: FileText },
        ],
      },
    };
    return configPresets[subAppId];
  };

  const config = getConfig();
  const totalCartQty = cartItems.reduce((acc, curr) => acc + curr.quantity, 0);

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
        />
      );
    }

    switch (subAppId) {
      case 'FA_MART':
        if (activeTab === 'Home') {
          return <FaMartScreen addToCart={addToCart} onProductClick={onProductClick} />;
        }
        if (activeTab === 'Categories') {
          return (
            <ScrollView style={styles.tabScroll} showsVerticalScrollIndicator={false}>
              <View style={styles.infoSection}>
                <Text style={styles.infoTitle}>Mall Categories</Text>
                <View style={styles.gridContainer}>
                  {[
                    { name: 'Smart Phones', desc: 'Sleek OLED screens', icon: '📱' },
                    { name: 'Casual Wear', desc: 'Classic custom cottons', icon: '👕' },
                    { name: 'Acoustic Sound', desc: 'Noise-canceling gears', icon: '🎧' },
                    { name: 'Fitness Gear', desc: 'Heart trackers & weights', icon: '🏋️' },
                  ].map((cat, idx) => (
                    <TouchableOpacity
                      key={idx}
                      style={styles.mallCard}
                      onPress={() => Alert.alert('Category Select', `Bespoke collection of "${cat.name}" is being filtered.`)}
                    >
                      <Text style={styles.mallIcon}>{cat.icon}</Text>
                      <View>
                        <Text style={styles.mallName}>{cat.name}</Text>
                        <Text style={styles.mallDesc}>{cat.desc}</Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </ScrollView>
          );
        }
        break;

      case 'FOOD':
        if (activeTab === 'Home' || activeTab === 'Search') {
          return (
            <FoodScreen 
              addToCart={addToCart} 
              activeSubMode={activeSubMode} 
              setActiveSubMode={handleSubModeChange}
              searchFocusedInitially={activeTab === 'Search'}
              onProductClick={onProductClick}
            />
          );
        }
        if (activeTab === 'Menu') {
          return (
            <FoodMenuView addToCart={addToCart} onProductClick={onProductClick} />
          );
        }
        if (activeTab === 'My Bookings') {
          const myBookings = getBookings();
          return (
            <ScrollView style={styles.tabScroll} showsVerticalScrollIndicator={false}>
              <View style={styles.bookingsBox}>
                <View style={styles.bookingsHeaderRow}>
                  <Text style={styles.bookingsTitle}>VIP DINING PASS</Text>
                  <View style={styles.bookingsActivePill}>
                    <Text style={styles.bookingsActiveText}>{myBookings.length} Active</Text>
                  </View>
                </View>
                {myBookings.length > 0 ? (
                  myBookings.map((b, i) => (
                    <View key={i} style={styles.emptyBookingsCard}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: hs(8), marginBottom: vs(8) }}>
                        <Text style={{ fontSize: ms(24) }}>{b.dish.emoji}</Text>
                        <View>
                          <Text style={[styles.emptyBookingsTitle, { fontSize: ms(11) }]}>{b.dish.name}</Text>
                          <Text style={{ fontSize: ms(9), color: '#94a3b8', fontWeight: '600' }}>{b.dish.price}</Text>
                        </View>
                      </View>
                      <Text style={{ fontSize: ms(9), color: '#64748b', fontWeight: '600' }}>{b.date} @ {b.time} · {b.guests} {b.guests === 1 ? 'guest' : 'guests'}</Text>
                      <Text style={{ fontSize: ms(8), color: '#1E5D44', fontWeight: '900', marginTop: vs(4) }}>{b.orderId}</Text>
                    </View>
                  ))
                ) : (
                  <View style={styles.emptyBookingsCard}>
                    <Calendar size={24} color="#1E5D44" />
                    <Text style={styles.emptyBookingsTitle}>No Reservations Yet</Text>
                    <Text style={styles.emptyBookingsDesc}>
                      Explore our curated gourmet partners, select your preferred table menu, and book instantly!
                    </Text>
                  </View>
                )}
                <TouchableOpacity onPress={() => setActiveTab('Home')} style={[styles.browsePartnersBtn, { backgroundColor: config.primaryColor }]} activeOpacity={0.8}>
                  <Text style={styles.browsePartnersText}>Browse Partners</Text>
                  <ArrowRight size={ms(10)} color="#ffffff" />
                </TouchableOpacity>
              </View>
            </ScrollView>
          );
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
            />
          );
        }
        if (activeTab === 'Aisles') {
          return (
            <ScrollView style={styles.tabScroll} showsVerticalScrollIndicator={false}>
              <View style={styles.infoSection}>
                <Text style={styles.infoTitle}>Aisle Map</Text>
                <Text style={{ fontSize: ms(10), color: '#64748b', fontWeight: '500', marginBottom: vs(12), marginTop: vs(-6) }}>Fresh organic foods categorized perfectly</Text>
                <View style={styles.gridContainer}>
                  {[
                    { name: 'Fresh Produce', count: '14 Fresh Items', bg: '#ecfdf5', text: '#065f46' },
                    { name: 'Dairy & Eggs', count: '10 Vetted Milks', bg: '#f0f9ff', text: '#075569' },
                    { name: 'Bakery', count: '6 Warm Loaves', bg: '#fffbeb', text: '#92400e' },
                    { name: 'Beverages', count: '12 Refreshing Drinks', bg: '#eef2ff', text: '#3730a3' },
                  ].map((cat, idx) => (
                    <TouchableOpacity
                      key={idx}
                      style={[styles.aisleCard, { backgroundColor: cat.bg }]}
                      onPress={() => Alert.alert('Aisle Select', `Browsing through "${cat.name}" items.`)}
                    >
                      <Text style={[styles.aisleName, { color: cat.text }]}>{cat.name}</Text>
                      <Text style={[styles.aisleCount, { color: cat.text, opacity: 0.7 }]}>{cat.count}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </ScrollView>
          );
        }
        break;


    }

    return (
      <View style={styles.basketContainer}>
        <Text style={styles.basketTitle}>Your Basket</Text>
        {cartItems.length === 0 ? (
          <View style={styles.noDataState}>
            <Text style={styles.noDataEmoji}>🛒</Text>
            <Text style={styles.noDataTitle}>Your basket is empty</Text>
            <Text style={styles.noDataSub}>Browse products and add them to your basket.</Text>
          </View>
        ) : (
          <>
            {cartItems.map((item) => (
              <View key={item.id} style={styles.basketRow}>
                <View style={styles.basketRowLeft}>
                  <Text style={styles.basketRowEmoji}>{item.emoji}</Text>
                  <Text style={styles.basketRowName} numberOfLines={1}>{item.name}</Text>
                </View>
                <View style={styles.basketStepper}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: hs(4), marginRight: hs(4) }}>
                    <IndianRupee size={ms(8)} color="#94a3b8" />
                    <Text style={styles.basketRowPrice}>{item.price}×{item.quantity}</Text>
                  </View>
                  <TouchableOpacity onPress={() => updateCartQuantity(item.id, -1)} style={styles.basketStepperBtn}>
                    <Minus size={ms(12)} color="#64748b" />
                  </TouchableOpacity>
                  <Text style={styles.basketStepperText}>{item.quantity}</Text>
                  <TouchableOpacity onPress={() => updateCartQuantity(item.id, 1)} style={styles.basketStepperBtn}>
                    <Plus size={ms(12)} color="#64748b" />
                  </TouchableOpacity>
                </View>
              </View>
            ))}
            <View style={styles.basketTotalCard}>
              <View style={styles.basketTotalRow}>
                <Text style={styles.basketTotalLabel}>Subtotal</Text>
                <Text style={styles.basketTotalValue}>
                  ₹{cartItems.reduce((s, i) => s + i.price * i.quantity, 0)}
                </Text>
              </View>
              <TouchableOpacity style={[styles.basketCheckoutBtn, { backgroundColor: config.primaryColor }]} activeOpacity={0.8}>
                <Text style={styles.basketCheckoutText}>Checkout</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity onPress={() => setShowExitConfirm(true)} style={styles.backBtn}>
            <ArrowLeft size={ms(22)} color="#0f172a" />
          </TouchableOpacity>
          <View style={styles.brandWrapper}>
            <Text style={styles.hubTitle}>FAAZIO APP HUB</Text>
            <Text style={styles.appName}>{config.name}</Text>
          </View>
        </View>

        <View style={styles.locationBadge}>
          <MapPin size={ms(10)} color="#2F80ED" />
          <Text style={styles.locationText}>Utama St no. 14</Text>
        </View>
      </View>

      <View style={styles.viewport}>
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
              onPress={() => setActiveTab(tab.name)}
              style={styles.tabItem}
              activeOpacity={0.8}
              onLayout={(e) => { tabPositions.current[idx] = e.nativeEvent.layout.x; }}
            >
              <View style={styles.iconContainer}>
                <Icon size={ms(18)} color={isCurrent ? config.textColor : '#94a3b8'} strokeWidth={isCurrent ? 2.5 : 2} style={isCurrent ? { transform: [{ scale: 1.1 }] } : undefined} />
                {tab.name.toLowerCase().includes('cart') && totalCartQty > 0 && (
                  <Animated.View style={{ transform: [{ translateY: badgeBounce.interpolate({ inputRange: [0, 1], outputRange: [0, -3] }) }] }}>
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>{totalCartQty}</Text>
                    </View>
                  </Animated.View>
                )}
              </View>
              <Text style={[styles.tabLabel, isCurrent && { color: config.textColor, fontWeight: '900' }]}>
                {tab.name}
              </Text>
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
            <Text style={styles.modalTitle}>
              {subAppId === 'FOOD'
                ? 'Exit Food?'
                : subAppId === 'PHARMA'
                ? 'Exit Pharma?'
                : subAppId === 'FA_MART'
                ? 'Exit Mart?'
                : 'Exit Grocery?'}
            </Text>
            <Text style={styles.modalSubtitle}>
              Are you sure you want to exit the current service and return to the main Faazio Hub?
            </Text>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                onPress={() => setShowExitConfirm(false)}
                style={styles.keepBtn}
              >
                <Text style={styles.keepBtnText}>Keep Exploring</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  setShowExitConfirm(false);
                  onExit();
                }}
                style={[styles.exitBtn, { backgroundColor: config.primaryColor }]}
              >
                <Text style={styles.exitBtnText}>Exit to Main App</Text>
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
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 30,
    height: SUB_HEADER_INSET + vs(64),
    backgroundColor: '#ffffff',
    borderBottomWidth: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 12,
    elevation: 2,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: hs(16),
    paddingTop: SUB_HEADER_INSET,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backBtn: {
    width: 48,
    height: 48,
    borderRadius: ms(12),
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: hs(-8),
  },
  brandWrapper: {
    justifyContent: 'center',
  },
  hubTitle: {
    fontSize: ms(8),
    fontWeight: '900',
    color: '#94a3b8',
    letterSpacing: 1.2,
  },
  appName: {
    fontSize: ms(12),
    fontWeight: '900',
    color: '#0f172a',
    marginTop: vs(1),
  },
  locationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderWidth: 0.5,
    borderColor: 'rgba(226,232,240,0.5)',
    borderRadius: ms(12),
    paddingVertical: vs(6),
    paddingHorizontal: hs(10),
  },
  locationText: {
    fontSize: ms(9),
    color: '#475569',
    fontWeight: '800',
    marginLeft: hs(3),
  },
  viewport: {
    flex: 1,
    backgroundColor: '#f8fafc',
    paddingTop: SUB_HEADER_INSET + vs(64),
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
  aisleCard: {
    padding: vs(16),
    borderRadius: ms(16),
    width: '48%',
  },
  aisleName: {
    fontSize: ms(11),
    fontWeight: '900',
  },
  aisleCount: {
    fontSize: ms(9),
    fontWeight: '600',
    marginTop: vs(2),
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
