import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Animated,
  TextInput,
  Platform,
} from 'react-native';
import { SCREEN_W, SCREEN_H, hs, vs, ms, wp, hp } from '@/utils/responsive';
import {
  Home,
  LayoutGrid,
  Heart,
  ShoppingBag,
  User,
  MapPin,
  Bell,
  Menu,
  ChevronDown,
} from 'lucide-react-native';
import Svg, { Defs, LinearGradient, Stop, Rect, Circle } from 'react-native-svg';
import { FaazioLogo } from '@/components/FaazioLogo';

import HomeView from '../../components/HomeView';
import CategoriesView from '../../components/CategoriesView';
import FavouritesView from '../../components/FavouritesView';
import AccountView from '../../components/AccountView';
import CartView from '../../components/CartView';
import SubAppWrapper from '../../components/SubAppWrapper';

const TAB_ORDER = ['Home', 'Categories', 'Favourites', 'Account', 'Cart'] as const;
type TabName = typeof TAB_ORDER[number];

const LABEL_TABS: TabName[] = ['Home', 'Categories', 'Favourites', 'Account'];

const TAB_COLORS: Record<TabName, string> = {
  Home: '#2F80ED',
  Categories: '#27AE60',
  Favourites: '#FF4A6B',
  Account: '#6C5CE7',
  Cart: '#F2994A',
};

const TAB_LABELS: Record<TabName, string> = {
  Home: 'Home',
  Categories: 'Categories',
  Favourites: 'Favourites',
  Account: 'Account',
  Cart: '',
};

const DROPLET_W = ms(32);

interface MainDashboardScreenProps {
  navigation: any;
  route: any;
}

const HEADER_COLLAPSE = vs(52);
const HEADER_H = vs(148);

export function MainDashboardScreen({ navigation }: MainDashboardScreenProps) {
  const [activeTab, setActiveTab] = useState<TabName>('Home');
  const [activeSubApp, setActiveSubApp] = useState<'FA_MART' | 'FOOD' | 'GROCERY' | 'PHARMA' | null>(null);
  const [cartItems, setCartItems] = useState<
    { id: string; name: string; price: number; quantity: number; emoji: string }[]
  >([
    { id: "cat-fm-1", name: "Spicy Tonkotsu Ramen", price: 225, quantity: 1, emoji: "🍜" }
  ]);
  const [favorites, setFavorites] = useState<string[]>(['cat-fm-1', 'cat-gg-2', 'cat-mt-1']);

  const headerCollapseAnim = useRef(new Animated.Value(0)).current;
  const entranceAnim = useRef(new Animated.Value(0)).current;
  const dropletAnim = useRef(new Animated.Value(0)).current;
  const bellPulseAnim = useRef(new Animated.Value(1)).current;

  const scrollYRef = useRef(0);

  const totalCartQty = cartItems.reduce((acc, curr) => acc + curr.quantity, 0);

  const addToCart = (id: string, name: string, price: number, emoji: string) => {
    setCartItems((prev) => {
      const existing = prev.find((item) => item.id === id);
      if (existing) {
        return prev.map((item) =>
          item.id === id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...prev, { id, name, price, quantity: 1, emoji }];
    });
  };

  const updateCartQuantity = (id: string, delta: number) => {
    setCartItems((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          const nextQty = item.quantity + delta;
          return { ...item, quantity: nextQty };
        }
        return item;
      }).filter((item) => item.quantity > 0)
    );
  };

  const toggleFavorite = (productId: string) => {
    setFavorites((prev) =>
      prev.includes(productId) ? prev.filter((id) => id !== productId) : [...prev, productId]
    );
  };

  const handleReset = () => {
    setCartItems([]);
    setActiveTab('Home');
    setActiveSubApp(null);
    navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
  };

  const handleScroll = (offsetY: number) => {
    scrollYRef.current = offsetY;
    const target = offsetY > 40 ? 1 : 0;
    Animated.timing(headerCollapseAnim, {
      toValue: target,
      duration: 300,
      useNativeDriver: true,
    }).start();
  };

  useEffect(() => {
    if (activeTab === 'Cart') return;
    Animated.spring(dropletAnim, {
      toValue: LABEL_TABS.indexOf(activeTab as typeof LABEL_TABS[number]),
      friction: 8,
      tension: 80,
      useNativeDriver: true,
    }).start();
  }, [activeTab, dropletAnim]);

  useEffect(() => {
    Animated.timing(entranceAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [entranceAnim]);

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(bellPulseAnim, { toValue: 0.4, duration: 500, useNativeDriver: true }),
        Animated.timing(bellPulseAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [bellPulseAnim]);

  const headerTranslateY = headerCollapseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -HEADER_COLLAPSE],
  });

  const dropletTranslateX = dropletAnim.interpolate({
    inputRange: [0, 1, 2, 3],
    outputRange: [
      SCREEN_W / 10 - DROPLET_W / 2,
      (3 * SCREEN_W) / 10 - DROPLET_W / 2,
      (5 * SCREEN_W) / 10 - DROPLET_W / 2,
      (7 * SCREEN_W) / 10 - DROPLET_W / 2,
    ],
  });

  if (activeSubApp !== null) {
    return (
      <View style={styles.container}>
        <SubAppWrapper
          subAppId={activeSubApp}
          onExit={() => setActiveSubApp(null)}
          addToCart={addToCart}
          cartItems={cartItems}
          setCartItems={setCartItems}
          updateCartQuantity={updateCartQuantity}
          handleReset={handleReset}
          setShowLocationRequestState={() => {}}
          setIsLoggedIn={() => {}}
          onProductClick={(prod) => navigation.navigate('ProductDetail', { productId: prod.id })}
        />
      </View>
    );
  }

  const activeColor = TAB_COLORS[activeTab];

  const renderHubContent = () => {
    const scrollProps = { onScroll: handleScroll };
    switch (activeTab) {
      case 'Home':
        return <HomeView onLaunchSubApp={(id) => setActiveSubApp(id)} addToCart={addToCart} {...scrollProps} />;
      case 'Categories':
        return <CategoriesView selectedCategory="ALL" setSelectedCategory={() => {}} addToCart={addToCart} favorites={favorites} toggleFavorite={toggleFavorite} onProductClick={(prod) => navigation.navigate('ProductDetail', { productId: prod.id })} {...scrollProps} />;
      case 'Favourites':
        return <FavouritesView addToCart={addToCart} favorites={favorites} toggleFavorite={toggleFavorite} onProductClick={(prod) => navigation.navigate('ProductDetail', { productId: prod.id })} {...scrollProps} />;
      case 'Account':
        return <AccountView handleReset={handleReset} setShowLocationRequestState={() => {}} setIsLoggedIn={() => {}} {...scrollProps} />;
      case 'Cart':
        return <CartView cartItems={cartItems} setCartItems={setCartItems} updateCartQuantity={updateCartQuantity} setActiveTab={(tab) => setActiveTab(tab as TabName)} {...scrollProps} />;
    }
  };

  return (
    <View style={styles.container}>
      <Animated.View
        style={[
          styles.entranceRoot,
          {
            opacity: entranceAnim,
            transform: [{ translateY: entranceAnim.interpolate({ inputRange: [0, 1], outputRange: [vs(10), 0] }) }],
          },
        ]}
      >
        <View style={styles.viewport}>
          {renderHubContent()}
        </View>

        <Animated.View
          style={[
            styles.headerOuter,
            { transform: [{ translateY: headerTranslateY }] },
          ]}
        >
          <Svg style={StyleSheet.absoluteFill}>
            <Defs>
              <LinearGradient id="headerGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                <Stop offset="0%" stopColor="#1162D3" />
                <Stop offset="50%" stopColor="#2F80ED" />
                <Stop offset="100%" stopColor="rgba(124,179,255,0.15)" />
              </LinearGradient>
            </Defs>
            <Rect width="100%" height="100%" fill="url(#headerGrad)" />
            <Circle cx={SCREEN_W * 1.1} cy={vs(-20)} r={ms(96)} fill="rgba(255,255,255,0.05)" />
            <Circle cx={hs(-30)} cy={vs(120)} r={ms(96)} fill="rgba(255,255,255,0.04)" />
          </Svg>

          <View style={styles.headerContent}>
            <View style={styles.headerTopRow}>
              <TouchableOpacity style={styles.iconBtn} activeOpacity={0.7} onPress={() => {}}>
                <Menu size={ms(22)} color="#ffffff" />
              </TouchableOpacity>

              <View style={styles.headerCenter}>
                <View style={styles.logoPill}>
                  <FaazioLogo size={ms(16)} />
                </View>
                <TouchableOpacity style={styles.locationRow} activeOpacity={0.7} onPress={() => navigation.navigate('Location')}>
                  <MapPin size={ms(11)} color="#7CE045" />
                  <Text style={styles.locationText} numberOfLines={1}>Sunnambukkara Street, Karaikal</Text>
                  <ChevronDown size={ms(11)} color="rgba(255,255,255,0.6)" />
                </TouchableOpacity>
              </View>

              <TouchableOpacity style={styles.iconBtn} activeOpacity={0.7}>
                <Bell size={ms(20)} color="#ffffff" />
                <Animated.View style={[styles.bellDot, { opacity: bellPulseAnim }]} />
              </TouchableOpacity>
            </View>

            <View style={styles.searchBar}>
              <TextInput
                style={styles.searchInput}
                placeholder="Search for food, groceries or more..."
                placeholderTextColor="#94a3b8"
                textAlign="center"
              />
            </View>
          </View>
        </Animated.View>

        <View style={styles.tabBar}>
          <View style={styles.tabBarInner}>
            {activeTab !== 'Cart' && (
              <Animated.View
                style={[
                  styles.droplet,
                  { backgroundColor: activeColor, transform: [{ translateX: dropletTranslateX }] },
                ]}
              />
            )}
            {TAB_ORDER.map((name, idx) => {
              const isCart = name === 'Cart';
              const isActive = activeTab === name;
              const Icon = name === 'Home' ? Home : name === 'Categories' ? LayoutGrid : name === 'Favourites' ? Heart : name === 'Cart' ? ShoppingBag : User;
              return (
                <TouchableOpacity
                  key={name}
                  onPress={() => setActiveTab(name)}
                  style={[styles.tabItem, isCart && styles.cartTabItem]}
                  activeOpacity={0.85}
                >
                  {isCart ? (
                    <View style={[styles.cartCircle, isActive && styles.cartCircleActive]}>
                      <Svg style={StyleSheet.absoluteFill}>
                        <Defs>
                          <LinearGradient id="cartFabGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                            <Stop offset="0%" stopColor="#FFE066" />
                            <Stop offset="50%" stopColor="#F2C94C" />
                            <Stop offset="100%" stopColor="#F2994A" />
                          </LinearGradient>
                        </Defs>
                        <Circle cx={ms(32)} cy={ms(32)} r={ms(30)} fill="url(#cartFabGrad)" />
                        <Circle cx={ms(32)} cy={ms(12)} r={ms(18)} fill="rgba(255,255,255,0.65)" />
                      </Svg>
                      <View style={styles.cartCircleInner}>
                        <ShoppingBag size={ms(20)} color="#1e293b" />
                        <Text style={styles.cartCircleLabel}>CART</Text>
                      </View>
                      {totalCartQty > 0 && (
                        <View style={styles.cartBadge}>
                          <Text style={styles.cartBadgeText}>{totalCartQty}</Text>
                        </View>
                      )}
                    </View>
                  ) : (
                    <>
                      <View style={[
                        styles.tabCapsule,
                        isActive && {
                          backgroundColor: 'rgba(255,255,255,0.95)',
                          shadowColor: activeColor,
                          shadowOffset: { width: 0, height: 2 },
                          shadowOpacity: 0.15,
                          shadowRadius: 6,
                          elevation: 3,
                          borderWidth: 1.5,
                          borderColor: '#ffffff',
                        },
                      ]}>
                        <Icon size={isActive ? ms(20) : ms(18)} color={isActive ? activeColor : 'rgba(148,163,184,0.9)'} strokeWidth={isActive ? 2.5 : 2} />
                      </View>
                      <Text style={[styles.tabLabel, isActive && { color: activeColor, fontWeight: '900' }]}>
                        {TAB_LABELS[name]}
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#ffffff' },
  entranceRoot: { flex: 1 },
  viewport: { flex: 1, paddingTop: HEADER_H },
  headerOuter: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 30,
    borderBottomLeftRadius: ms(32),
    borderBottomRightRadius: ms(32),
    overflow: 'hidden',
    shadowColor: 'rgba(47,128,237,0.12)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 12,
    elevation: 8,
  },
  headerContent: { paddingVertical: vs(16), paddingHorizontal: hs(16), gap: vs(14) },
  headerTopRow: { flexDirection: 'row', alignItems: 'center' },
  iconBtn: {
    width: Math.max(44, hs(36)),
    height: Math.max(44, vs(36)),
    borderRadius: ms(12),
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  headerCenter: { flex: 1, alignItems: 'center' },
  logoPill: {
    height: vs(24),
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: ms(12),
    paddingHorizontal: hs(12),
    justifyContent: 'center',
    alignItems: 'center',
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: hs(4),
    marginTop: vs(4),
    maxWidth: hs(200),
  },
  locationText: {
    fontSize: ms(10),
    fontWeight: '900',
    color: 'rgba(255,255,255,0.9)',
    textTransform: 'uppercase',
    maxWidth: hs(160),
  },
  bellDot: {
    position: 'absolute',
    top: vs(6),
    right: hs(6),
    width: ms(8),
    height: ms(8),
    borderRadius: ms(4),
    backgroundColor: '#f43f5e',
    borderWidth: 1.5,
    borderColor: '#2F80ED',
  },
  searchBar: {
    height: Math.max(44, vs(44)),
    borderRadius: ms(22),
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  searchInput: {
    fontSize: ms(12),
    fontWeight: '600',
    color: '#0f172a',
    paddingHorizontal: hs(20),
  },
  tabBar: {
    height: vs(76),
    borderTopLeftRadius: ms(30),
    borderTopRightRadius: ms(30),
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderTopWidth: 1,
    borderColor: 'rgba(255,255,255,0.5)',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.08,
    shadowRadius: 35,
    elevation: 20,
    paddingHorizontal: hs(20),
    justifyContent: 'center',
  },
  tabBarInner: {
    flexDirection: 'row',
    position: 'relative',
    height: vs(64),
    alignItems: 'center',
  },
  droplet: {
    position: 'absolute',
    top: 0,
    width: DROPLET_W,
    height: vs(4),
    borderRadius: ms(2),
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: vs(2),
  },
  cartTabItem: {
    marginTop: -vs(20),
  },
  tabCapsule: {
    width: hs(40),
    height: vs(40),
    borderRadius: ms(12),
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabLabel: {
    fontSize: ms(8),
    fontWeight: '700',
    color: 'rgba(148,163,184,0.9)',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  cartCircle: {
    width: ms(64),
    height: ms(64),
    borderRadius: ms(32),
    borderWidth: 2,
    borderColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    shadowColor: '#F2C94C',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  cartCircleActive: {
    shadowOpacity: 0.5,
    shadowRadius: 12,
    borderColor: 'rgba(242,201,76,0.6)',
    borderWidth: 3,
  },
  cartCircleInner: { alignItems: 'center', justifyContent: 'center', zIndex: 2 },
  cartCircleLabel: {
    fontSize: ms(8),
    fontWeight: '900',
    color: '#1e293b',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    marginTop: vs(-2),
  },
  cartBadge: {
    position: 'absolute',
    top: vs(-4),
    right: hs(-4),
    backgroundColor: '#e11d48',
    borderRadius: ms(8),
    minWidth: hs(18),
    height: vs(18),
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: hs(3),
    borderWidth: 2,
    borderColor: '#ffffff',
    zIndex: 3,
  },
  cartBadgeText: {
    color: '#ffffff',
    fontSize: ms(8),
    fontWeight: '900',
  },
});
