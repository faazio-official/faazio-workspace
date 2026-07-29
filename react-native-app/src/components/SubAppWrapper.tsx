import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Image,
  Dimensions,
  Alert,
  BackHandler,
  Modal,
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
  Percent,
} from 'lucide-react-native';

// Import sub-app views
import { FaMartScreen } from '../features/ecommerce/FaMartScreen';
import { GroceryScreen } from '../features/ecommerce/GroceryScreen';
import { EcommerceScreen } from '../features/ecommerce/EcommerceScreen';

import { FoodScreen } from '../features/food/FoodScreen';
import { PharmaScreen } from '../features/pharma/PharmaScreen';
import AccountView from './AccountView';
import CartView from './CartView';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

interface SubAppWrapperProps {
  subAppId: 'FA_MART' | 'FOOD' | 'GROCERY' | 'PHARMA';
  onExit: () => void;
  addToCart: (id: string, name: string, price: number, emoji: string) => void;
  cartItems: { id: string; name: string; price: number; quantity: number; emoji: string }[];
  setCartItems: React.Dispatch<React.SetStateAction<{ id: string; name: string; price: number; quantity: number; emoji: string }[]>>;
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

  // Bind hardware back button in Android to open "Exit Sub-App?" confirmation sheet
  useEffect(() => {
    const onBackPress = () => {
      setShowExitConfirm(true);
      return true; // prevent default back action
    };

    const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => subscription.remove();
  }, []);

  const handleSubModeChange = (mode: 'order' | 'booking') => {
    setActiveSubMode(mode);
    setActiveTab('Home');
  };

  // Preset configuration matching Web exactly
  const getConfig = () => {
    const configPresets = {
      FA_MART: {
        name: 'FA MART',
        primaryColor: '#1162D3',
        textColor: '#1162D3',
        accentBg: '#eff6ff',
        tabs: [
          { name: 'Home', icon: Home },
          { name: 'Categories', icon: LayoutGrid },
          { name: 'Cart', icon: ShoppingBag },
          { name: 'Profile', icon: User },
        ],
      },
      FOOD: {
        name: 'FOOD',
        primaryColor: '#1E5D44',
        textColor: '#1E5D44',
        accentBg: '#ecfdf5',
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
        name: 'FA GROCERY',
        primaryColor: '#10B981',
        textColor: '#10B981',
        accentBg: '#f0fdf4',
        tabs: [
          { name: 'Home', icon: Home },
          { name: 'Aisles', icon: LayoutGrid },
          { name: 'Smart Cart', icon: ShoppingBag },
          { name: 'Profile', icon: User },
        ],
      },
      PHARMA: {
        name: 'FA PHARMA',
        primaryColor: '#db2777',
        textColor: '#db2777',
        accentBg: '#fdf2f8',
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

  // Sub-app specific screens and tabs rendering
  const renderSubAppContent = () => {
    // 1. Centralized Cart and Profile tabs
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

    // 2. Sub-app specific content
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
            <ScrollView style={styles.tabScroll} showsVerticalScrollIndicator={false}>
              <View style={styles.noDataState}>
                <Text style={styles.noDataEmoji}>📜</Text>
                <Text style={styles.noDataTitle}>Gourmet Menus</Text>
                <Text style={styles.noDataSub}>Vetted menus of local restaurant partners are currently synchronized with Faazio delivery agents.</Text>
              </View>
            </ScrollView>
          );
        }
        if (activeTab === 'My Bookings') {
          return (
            <ScrollView style={styles.tabScroll} showsVerticalScrollIndicator={false}>
              <View style={styles.bookingsBox}>
                <Text style={styles.bookingsTitle}>My Reservations</Text>
                <View style={styles.emptyBookingsCard}>
                  <Calendar size={24} color="#1E5D44" />
                  <Text style={styles.emptyBookingsTitle}>No Reservations Yet</Text>
                  <Text style={styles.emptyBookingsDesc}>
                    Explore our curated gourmet partners, select your preferred table menu, and book instantly!
                  </Text>
                </View>
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
                <Text style={styles.infoTitle}>Aisle Categories</Text>
                <View style={styles.gridContainer}>
                  {[
                    { name: 'Greens & Orchard', count: '14 Fresh Items', emoji: '🥦', bg: '#f0fdf4' },
                    { name: 'Dairy Cold Room', count: '10 Vetted Milks', emoji: '🥛', bg: '#f0f9ff' },
                    { name: 'Bakery Hearth', count: '6 Warm Loaves', emoji: '🍞', bg: '#fff7ed' },
                    { name: 'Sweet Beverages', count: '12 Plant Milks', emoji: '🥤', bg: '#ecfeff' },
                  ].map((cat, idx) => (
                    <TouchableOpacity
                      key={idx}
                      style={[styles.mallCard, { backgroundColor: cat.bg }]}
                      onPress={() => Alert.alert('Aisle Select', `Browsing through "${cat.name}" items.`)}
                    >
                      <Text style={styles.mallIcon}>{cat.emoji}</Text>
                      <View>
                        <Text style={styles.mallName}>{cat.name}</Text>
                        <Text style={styles.mallDesc}>{cat.count}</Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </ScrollView>
          );
        }
        break;

      case 'PHARMA':
        if (activeTab === 'Home') {
          return <PharmaScreen addToCart={addToCart} onProductClick={onProductClick} />;
        }
        if (activeTab === 'For You') {
          return (
            <ScrollView style={styles.tabScroll} contentContainerStyle={styles.centeredPadding} showsVerticalScrollIndicator={false}>
              <View style={styles.noDataState}>
                <Text style={styles.noDataEmoji}>🩺</Text>
                <Text style={styles.noDataTitle}>Health Matrix Recommendations</Text>
                <Text style={styles.noDataSub}>Personalized medical care recommendations tailored to your profile uploads.</Text>
              </View>
            </ScrollView>
          );
        }
        if (activeTab === 'History') {
          return (
            <ScrollView style={styles.tabScroll} contentContainerStyle={styles.centeredPadding} showsVerticalScrollIndicator={false}>
              <View style={styles.noDataState}>
                <Text style={styles.noDataEmoji}>📋</Text>
                <Text style={styles.noDataTitle}>Prescription logs</Text>
                <Text style={styles.noDataSub}>No clinical review histories available for (+91) 98765 43210.</Text>
              </View>
            </ScrollView>
          );
        }
        break;
    }

    // Default fallback
    return (
      <View style={styles.noDataState}>
        <Text style={styles.noDataEmoji}>📦</Text>
        <Text style={styles.noDataTitle}>Synchronizing Page</Text>
        <Text style={styles.noDataSub}>The requested tab view is loading or being framed.</Text>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* 1. Header Row */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity onPress={() => setShowExitConfirm(true)} style={styles.backBtn}>
            <ArrowLeft size={18} color="#0f172a" />
          </TouchableOpacity>
          <View style={styles.brandWrapper}>
            <Text style={styles.hubTitle}>FAAZIO SERVICE HUB</Text>
            <Text style={styles.appName}>{config.name}</Text>
          </View>
        </View>

        <View style={styles.locationBadge}>
          <MapPin size={10} color="#2563eb" />
          <Text style={styles.locationText}>Utama St no. 14</Text>
        </View>
      </View>

      {/* 2. Scrollable Viewport area */}
      <View style={styles.viewport}>
        {renderSubAppContent()}
      </View>

      {/* 3. Bottom Tabs System with glow effect */}
      <View style={styles.tabBar}>
        {config.tabs.map((tab, idx) => {
          const isCurrent = activeTab === tab.name;
          const Icon = tab.icon;

          return (
            <TouchableOpacity
              key={idx}
              onPress={() => setActiveTab(tab.name)}
              style={styles.tabItem}
              activeOpacity={0.8}
            >
              {isCurrent && (
                <View style={[styles.activeIndicator, { backgroundColor: config.primaryColor }]} />
              )}
              <View style={styles.iconContainer}>
                <Icon size={18} color={isCurrent ? config.textColor : '#94a3b8'} />
                {tab.name.toLowerCase().includes('cart') && totalCartQty > 0 && (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{totalCartQty}</Text>
                  </View>
                )}
              </View>
              <Text style={[styles.tabLabel, isCurrent && { color: config.textColor, fontWeight: '900' }]}>
                {tab.name}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* 4. Bottom Exit Confirmation Modal */}
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
                ? 'Exit Foods?'
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
                <Text style={styles.exitBtnText}>Exit to Hub</Text>
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
    backgroundColor: '#ffffff',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderColor: '#f1f5f9',
    backgroundColor: '#ffffff',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backBtn: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#f8fafc',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  brandWrapper: {
    justifyContent: 'center',
  },
  hubTitle: {
    fontSize: 7,
    fontWeight: '900',
    color: '#94a3b8',
    letterSpacing: 0.8,
  },
  appName: {
    fontSize: 12.5,
    fontWeight: '900',
    color: '#0f172a',
    marginTop: 1,
  },
  locationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f4ff',
    borderWidth: 0.5,
    borderColor: '#dbeafe',
    borderRadius: 8,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  locationText: {
    fontSize: 8.5,
    color: '#2563eb',
    fontWeight: '800',
    marginLeft: 3,
  },
  viewport: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  tabScroll: {
    flex: 1,
  },
  centeredPadding: {
    padding: 20,
    alignItems: 'center',
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 40,
    width: '100%',
    marginBottom: 20,
  },
  searchBoxPlaceholder: {
    fontSize: 11,
    color: '#94a3b8',
    marginLeft: 8,
    fontWeight: '600',
  },
  noDataState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 50,
    paddingHorizontal: 24,
  },
  noDataEmoji: {
    fontSize: 32,
    marginBottom: 12,
  },
  noDataTitle: {
    fontSize: 12,
    fontWeight: '900',
    color: '#1e293b',
    textAlign: 'center',
  },
  noDataSub: {
    fontSize: 9.5,
    color: '#94a3b8',
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 14,
    marginTop: 6,
  },
  modeTogglePadding: {
    padding: 16,
  },
  modeToggleRow: {
    flexDirection: 'row',
    backgroundColor: '#f1f5f9',
    borderRadius: 14,
    padding: 4,
    marginBottom: 20,
  },
  modeBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 10,
  },
  modeBtnActive: {
    backgroundColor: '#ffffff',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  modeBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748b',
  },
  modeBtnTextActive: {
    color: '#1E5D44',
  },
  infoSection: {
    padding: 16,
  },
  infoTitle: {
    fontSize: 11,
    fontWeight: '900',
    color: '#0f172a',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  gridContainer: {
    gap: 12,
  },
  mallCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  mallIcon: {
    fontSize: 22,
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: '#f8fafc',
    textAlign: 'center',
    lineHeight: 44,
  },
  mallName: {
    fontSize: 11,
    fontWeight: '900',
    color: '#0f172a',
  },
  mallDesc: {
    fontSize: 9,
    color: '#94a3b8',
    fontWeight: '600',
    marginTop: 2,
  },
  bookingsBox: {
    padding: 16,
  },
  bookingsTitle: {
    fontSize: 11,
    fontWeight: '900',
    color: '#0f172a',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  emptyBookingsCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.02,
    shadowRadius: 6,
    elevation: 1,
  },
  emptyBookingsTitle: {
    fontSize: 11,
    fontWeight: '900',
    color: '#0f172a',
    marginTop: 10,
  },
  emptyBookingsDesc: {
    fontSize: 9.5,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 14,
    marginTop: 6,
    paddingHorizontal: 12,
  },
  tabBar: {
    height: 64,
    borderTopWidth: 1,
    borderColor: '#f1f5f9',
    flexDirection: 'row',
    backgroundColor: '#ffffff',
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  activeIndicator: {
    position: 'absolute',
    top: 0,
    width: 24,
    height: 3,
    borderBottomLeftRadius: 2,
    borderBottomRightRadius: 2,
  },
  iconContainer: {
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: -6,
    right: -10,
    backgroundColor: '#f97316',
    borderRadius: 7,
    minWidth: 14,
    height: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 2,
    borderWidth: 1,
    borderColor: '#ffffff',
  },
  badgeText: {
    color: '#ffffff',
    fontSize: 7.5,
    fontWeight: '900',
  },
  tabLabel: {
    fontSize: 8.5,
    color: '#94a3b8',
    fontWeight: '700',
    marginTop: 3,
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
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 32,
    alignItems: 'center',
    borderTopWidth: 1,
    borderColor: '#f1f5f9',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -12 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 8,
  },
  modalBar: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#e2e8f0',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 13,
    fontWeight: '900',
    color: '#0f172a',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  modalSubtitle: {
    fontSize: 9.5,
    color: '#94a3b8',
    textAlign: 'center',
    lineHeight: 14,
    marginTop: 6,
    paddingHorizontal: 20,
    fontWeight: '600',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
    width: '100%',
  },
  keepBtn: {
    flex: 1,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  keepBtnText: {
    color: '#475569',
    fontSize: 10,
    fontWeight: '900',
  },
  exitBtn: {
    flex: 1,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  exitBtnText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '900',
  },
});
